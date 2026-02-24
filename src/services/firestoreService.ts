import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    setDoc,
    serverTimestamp,
    query,
    where,
    getDocs
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebaseConfig';
import { SickLeave } from '../hooks/useFirestoreSync';
import logger from '../utils/logger';
import { resolveEmployeeCollection } from './firebaseSchemaService';

const getDb = () => getFirebaseDb();

// ===== SICK LEAVES =====

/**
 * Crear una nueva baja médica en Firestore
 */
export async function createSickLeave(leave: {
    employeeId: string;
    type: 'ITEC' | 'ITAT';
    startDate: string;
    endDate: string | null;
    motivo?: string;
    createdBy: string;
}): Promise<string> {
    try {
        const db = getDb();
        const docRef = await addDoc(collection(db, 'SICK_LEAVES'), {
            ...leave,
            status: leave.endDate ? 'Cerrada' : 'Activa',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        logger.success('Baja médica creada en Firestore:', docRef.id);
        return docRef.id;
    } catch (error) {
        logger.error('❌ Error creando baja médica:', error);
        throw error;
    }
}

/**
 * Actualizar una baja existente (cerrarla)
 */
export async function updateSickLeave(
    leaveId: string,
    updates: { endDate?: string; motivo?: string }
): Promise<void> {
    try {
        const db = getDb();
        const docRef = doc(db, 'SICK_LEAVES', leaveId);
        await updateDoc(docRef, {
            ...updates,
            status: updates.endDate ? 'Cerrada' : 'Activa',
            updatedAt: serverTimestamp()
        });

        logger.success('Baja médica actualizada:', leaveId);
    } catch (error) {
        logger.error('❌ Error actualizando baja:', error);
        throw error;
    }
}

/**
 * Eliminar una baja médica
 */
export async function deleteSickLeave(leaveId: string): Promise<void> {
    try {
        const db = getDb();
        await deleteDoc(doc(db, 'SICK_LEAVES', leaveId));
        logger.success('Baja médica eliminada:', leaveId);
    } catch (error) {
        logger.error('❌ Error eliminando baja:', error);
        throw error;
    }
}

/**
 * Registrar una baja finalizada en la colección BAJAS
 */
export async function upsertClosedSickLeave(leave: {
    employeeId: string;
    employeeName: string;
    type: 'ITEC' | 'ITAT';
    startDate: string;
    endDate: string;
    dischargeDate: string;
    motivo?: string;
    closedBy?: string;
}): Promise<void> {
    try {
        const db = getDb();
        const docId = `${leave.employeeId}_${leave.startDate}`;
        const docRef = doc(db, 'BAJAS', docId);
        await setDoc(docRef, {
            ...leave,
            status: 'Cerrada',
            updatedAt: serverTimestamp()
        }, { merge: true });
        logger.success('Baja finalizada registrada en BAJAS:', docId);
    } catch (error) {
        logger.error('❌ Error registrando baja finalizada en BAJAS:', error);
        throw error;
    }
}

// ===== INCIDENT LOG =====

/**
 * Registrar una incidencia en el log de auditoría (INMUTABLE)
 */
export async function logIncident(incident: {
    employeeId: string;
    employeeName: string;
    type: string;
    reason: string;
    dates: string;
    source: 'Registrar Incidencia' | 'Resumen Empleados';
    registeredBy: string;
}): Promise<void> {
    try {
        const db = getDb();
        await addDoc(collection(db, 'INCIDENT_LOG'), {
            ...incident,
            timestamp: serverTimestamp()
        });

        logger.success('Incidencia registrada en log de auditoría');
    } catch (error) {
        logger.error('❌ Error registrando incidencia:', error);
        // No lanzar error, el log es opcional
    }
}

// ===== EMPLEADOS (Actualización de campos específicos) =====

/**
 * Actualizar turno habitual de un empleado
 */
export async function updateEmployeeTurno(
    employeeId: string,
    turno: 'M' | 'TN'
): Promise<void> {
    try {
        const db = getDb();
        const employeeCollectionName = await resolveEmployeeCollection(db);
        const docRef = doc(db, employeeCollectionName, employeeId);
        await updateDoc(docRef, {
            TurnoHabitual: turno,
            updatedAt: serverTimestamp(),
            updatedBy: 'sistema-presencia'
        });

        logger.success(`Turno habitual actualizado: ${employeeId} → ${turno}`);
    } catch (error) {
        logger.error('❌ Error actualizando turno:', error);
    }
}

/**
 * Actualizar último fichaje de un empleado
 */
export async function updateEmployeeLastPunch(employeeId: string): Promise<void> {
    try {
        const db = getDb();
        const employeeCollectionName = await resolveEmployeeCollection(db);
        const docRef = doc(db, employeeCollectionName, employeeId);
        await updateDoc(docRef, {
            UltimoFichaje: new Date().toISOString(),
            updatedAt: serverTimestamp(),
            updatedBy: 'sistema-presencia'
        });
    } catch (error) {
        logger.error('❌ Error actualizando último fichaje:', error);
    }
}

// ===== SYNTHETIC PUNCHES (PERSISTENCE) =====

export interface SyntheticPunchParams {
    employeeId: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm:ss
    reasonId: number | null;
    reasonDesc: string;
    direction: 'Entrada' | 'Salida'; // Mandatory for reconstruction
}

/**
 * Registra un fichaje sintético (GeneradoPorApp) en Firestore
 * Se usa para persistir el flag 'GeneradoPorApp' ya que la API ERP no admite campos custom.
 */
export async function logSyntheticPunch(punch: SyntheticPunchParams): Promise<void> {
    try {
        const db = getDb();
        // Normalización de Clave: IDOperario_YYYY-MM-DD_HH:mm
        // Cortamos los segundos para evitar discrepancias menores, o normalizamos a 00 si es necesario.
        // Asumimos que la hora viene en HH:mm:ss o HH:mm.
        // Para mayor seguridad con la API, normalizamos a HH:mm
        const timeKey = punch.time.substring(0, 5);
        const docId = `${punch.employeeId}_${punch.date}_${timeKey}`;

        const docRef = doc(db, 'APP_GENERATED_PUNCHES', docId);

        await setDoc(docRef, {
            ...punch,
            originalTime: punch.time,
            timeKey: timeKey,
            createdAt: serverTimestamp(),
            type: 'synthetic_punch',
            direction: punch.direction
        });

        logger.success(`Fichaje sintético registrado: ${docId}`);
    } catch (error) {
        logger.error('❌ Error registrando fichaje sintético:', error);
        // No lanzamos error para no bloquear el flujo principal, pero logueamos.
    }
}

/**
 * Recupera los fichajes sintéticos para un rango de fechas.
 * Retorna un Set de claves (IDOperario_YYYY-MM-DD_HH:mm) para búsqueda rápida O(1).
 */
export async function fetchSyntheticPunches(
    startDate: string,
    endDate: string
): Promise<Map<string, SyntheticPunchParams>> {
    try {
        const db = getDb();
        const q = query(
            collection(db, 'APP_GENERATED_PUNCHES'),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        );

        const snapshot = await getDocs(q);
        const syntheticPunches = new Map<string, SyntheticPunchParams>();

        snapshot.forEach(doc => {
            const data = doc.data() as SyntheticPunchParams & { timeKey?: string };
            if (data.employeeId && data.date) {
                // Use stored timeKey or derive it
                const timeKey = data.timeKey || data.time.substring(0, 5);
                const key = `${data.employeeId}_${data.date}_${timeKey}`;
                syntheticPunches.set(key, data);
            }
        });

        logger.info(`Recuperados ${syntheticPunches.size} fichajes sintéticos.`);
        return syntheticPunches;
    } catch (error) {
        logger.error('❌ Error recuperando fichajes sintéticos:', error);
        return new Map(); // Retornar vacío en caso de error para no romper la app
    }
}

export async function deleteSyntheticPunch(id: string): Promise<void> {
    try {
        const db = getDb();
        await deleteDoc(doc(db, 'APP_GENERATED_PUNCHES', id));
        logger.info(`Fichaje sintético eliminado: ${id}`);
    } catch (error) {
        logger.error('❌ Error eliminando fichaje sintético:', error);
    }
}

export async function deleteSyntheticPunchesInRange(employeeId: number, startDate: string, endDate: string): Promise<void> {
    const db = getDb();
    const q = query(
        collection(db, 'APP_GENERATED_PUNCHES'),
        where('employeeId', '==', employeeId.toString()),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    );

    const snapshot = await getDocs(q);
    const batch: Promise<void>[] = [];
    snapshot.forEach(doc => {
        batch.push(deleteDoc(doc.ref));
    });

    try {
        await Promise.all(batch);
        if (batch.length > 0) logger.info(`Eliminados ${batch.length} fichajes sintéticos en rango ${startDate}-${endDate}`);
    } catch (error) {
        logger.error('❌ Error eliminando fichajes sintéticos en rango:', error);
    }
}


