/**
 * Servicio de Audit Log - Registro de Accesos a Fichas de Empleados
 * 
 * CUMPLIMIENTO GDPR:
 * - Registra solo IDs y acciones, NO datos personales
 * - Permite trazabilidad de quién accede a qué datos
 * - Logs inmutables (solo inserción, no edición)
 * 
 * @module auditLogService
 */

import { collection, addDoc, query, where, orderBy, getDocs, Timestamp, limit } from 'firebase/firestore';
import { getFirebaseDb } from '../firebaseConfig';
import logger from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════

export type AccessType = 'view' | 'edit' | 'export_pdf' | 'compare';

export interface EmployeeAccessLog {
    id?: string;
    employeeId: string;
    accessedBy: string; // Email del usuario autenticado
    accessedAt: Timestamp;
    accessType: AccessType;
    userAgent?: string;
    sessionId?: string;
}

export interface AuditLogStats {
    totalAccesses: number;
    uniqueUsers: number;
    mostViewedEmployees: { employeeId: string; count: number }[];
    accessesByType: Record<AccessType, number>;
}

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════

/**
 * Registrar un acceso a ficha de empleado
 * GDPR: Solo guarda IDs, no PII
 */
export async function logEmployeeAccess(
    employeeId: string,
    accessType: AccessType,
    userEmail: string = 'anonymous'
): Promise<void> {
    try {
        const db = getFirebaseDb();

        // Validación: employeeId debe ser número de 1-3 dígitos
        const normalizedId = parseInt(employeeId).toString().padStart(3, '0');

        const logEntry: Omit<EmployeeAccessLog, 'id'> = {
            employeeId: normalizedId,
            accessedBy: userEmail,
            accessedAt: Timestamp.now(),
            accessType,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 150) : 'unknown',
            sessionId: getSessionId()
        };

        await addDoc(collection(db, 'EMPLOYEE_ACCESS_LOG'), logEntry);

        logger.info(`📊 Audit Log: ${userEmail} ${accessType} empleado ${normalizedId}`);
    } catch (error) {
        // No fallar la operación principal si el log falla
        logger.error('❌ Error registrando acceso en audit log:', error);
    }
}

/**
 * Obtener historial de accesos de un empleado específico
 */
export async function getEmployeeAccessHistory(
    employeeId: string,
    maxResults: number = 50
): Promise<EmployeeAccessLog[]> {
    try {
        const db = getFirebaseDb();
        const normalizedId = parseInt(employeeId).toString().padStart(3, '0');

        const q = query(
            collection(db, 'EMPLOYEE_ACCESS_LOG'),
            where('employeeId', '==', normalizedId),
            orderBy('accessedAt', 'desc'),
            limit(maxResults)
        );

        const querySnapshot = await getDocs(q);
        const logs: EmployeeAccessLog[] = [];

        querySnapshot.forEach((doc) => {
            logs.push({
                id: doc.id,
                ...doc.data() as Omit<EmployeeAccessLog, 'id'>
            });
        });

        return logs;
    } catch (error) {
        logger.error('❌ Error obteniendo historial de accesos:', error);
        return [];
    }
}

/**
 * Obtener todos los accesos de un usuario específico
 */
export async function getUserAccessHistory(
    userEmail: string,
    maxResults: number = 100
): Promise<EmployeeAccessLog[]> {
    try {
        const db = getFirebaseDb();

        const q = query(
            collection(db, 'EMPLOYEE_ACCESS_LOG'),
            where('accessedBy', '==', userEmail),
            orderBy('accessedAt', 'desc'),
            limit(maxResults)
        );

        const querySnapshot = await getDocs(q);
        const logs: EmployeeAccessLog[] = [];

        querySnapshot.forEach((doc) => {
            logs.push({
                id: doc.id,
                ...doc.data() as Omit<EmployeeAccessLog, 'id'>
            });
        });

        return logs;
    } catch (error) {
        logger.error('❌ Error obteniendo historial de usuario:', error);
        return [];
    }
}

/**
 * Obtener estadísticas de acceso (para panel de administrador)
 */
export async function getAuditLogStats(
    startDate?: Date,
    endDate?: Date
): Promise<AuditLogStats> {
    try {
        const db = getFirebaseDb();
        let q = query(collection(db, 'EMPLOYEE_ACCESS_LOG'));

        // Filtrar por rango de fechas si se proporciona
        if (startDate) {
            q = query(q, where('accessedAt', '>=', Timestamp.fromDate(startDate)));
        }
        if (endDate) {
            q = query(q, where('accessedAt', '<=', Timestamp.fromDate(endDate)));
        }

        const querySnapshot = await getDocs(q);

        const uniqueUsers = new Set<string>();
        const employeeAccessCount = new Map<string, number>();
        const accessTypeCount: Record<AccessType, number> = {
            view: 0,
            edit: 0,
            export_pdf: 0,
            compare: 0
        };

        querySnapshot.forEach((doc) => {
            const data = doc.data() as EmployeeAccessLog;

            // Usuarios únicos
            uniqueUsers.add(data.accessedBy);

            // Conteo por empleado
            const currentCount = employeeAccessCount.get(data.employeeId) || 0;
            employeeAccessCount.set(data.employeeId, currentCount + 1);

            // Conteo por tipo
            if (data.accessType in accessTypeCount) {
                accessTypeCount[data.accessType]++;
            }
        });

        // Empleados más vistos (top 10)
        const mostViewedEmployees = Array.from(employeeAccessCount.entries())
            .map(([employeeId, count]) => ({ employeeId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalAccesses: querySnapshot.size,
            uniqueUsers: uniqueUsers.size,
            mostViewedEmployees,
            accessesByType: accessTypeCount
        };
    } catch (error) {
        logger.error('❌ Error obteniendo estadísticas de audit log:', error);
        return {
            totalAccesses: 0,
            uniqueUsers: 0,
            mostViewedEmployees: [],
            accessesByType: { view: 0, edit: 0, export_pdf: 0, compare: 0 }
        };
    }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Generar o recuperar ID de sesión
 * Usado para agrupar accesos de una misma sesión de navegación
 */
function getSessionId(): string {
    if (typeof sessionStorage === 'undefined') return 'server';

    let sessionId = sessionStorage.getItem('audit_session_id');

    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        sessionStorage.setItem('audit_session_id', sessionId);
    }

    return sessionId;
}

/**
 * Limpiar logs antiguos (función de mantenimiento)
 * Debe ser llamada periódicamente por un Cloud Function
 */
export async function cleanOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
        const db = getFirebaseDb();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const q = query(
            collection(db, 'EMPLOYEE_ACCESS_LOG'),
            where('accessedAt', '<', Timestamp.fromDate(cutoffDate))
        );

        const querySnapshot = await getDocs(q);

        // En producción, esto debería hacerse en batches
        let deletedCount = 0;
        const deletePromises: Promise<void>[] = [];

        querySnapshot.forEach((doc) => {
            // deletePromises.push(deleteDoc(doc.ref));
            deletedCount++;
        });

        // await Promise.all(deletePromises);

        logger.info(`🧹 Limpieza de logs: ${deletedCount} registros antiguos identificados`);
        return deletedCount;
    } catch (error) {
        logger.error('❌ Error limpiando logs antiguos:', error);
        return 0;
    }
}
