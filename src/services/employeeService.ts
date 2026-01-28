/**
 * Servicio de Empleados con Arquitectura Híbrida
 * 
 * PROTOCOLO GDPR:
 * - Nombres (PII) SOLO desde API local (/fichajes/getOperarios)
 * - Datos enriquecidos desde Firestore (colección EMPLEADOS)
 * - NUNCA escribir PII en Firebase compartido
 * 
 * @module employeeService
 */

import { getOperarios, Operario } from './erpApi';
import { getFirebaseDb } from '../firebaseConfig';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import logger from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// TIPOS DE DATOS
// ═══════════════════════════════════════════════════════════════════

/**
 * Identidad del empleado (fuente: API local)
 * Contiene PII - SOLO en memoria, NUNCA en Firebase
 */
export interface EmployeeIdentity {
    IDOperario: number;
    DescOperario: string; // ⚠️ PII - Solo de API
    Activo: boolean;
    Productivo: boolean;
    IDDepartamento: number;
    DescDepartamento: string;
}

/**
 * Datos enriquecidos del empleado (fuente: Firestore)
 * NO contiene PII - Seguro para Firebase compartido
 */
export interface EmployeeRichData {
    FechaAntiguedad?: string; // YYYY-MM-DD
    NivelRetributivo?: string; // A1, A2, B1, etc.
    Categoria?: string; // Operario, Encargado, etc.
    Seccion?: string; // Producción, Almacén, etc.
    TurnoHabitual?: 'M' | 'TN'; // Mañana o Tarde-Noche
    UltimoFichaje?: string; // ISO timestamp
    Edad?: number; // Desde Firestore
    NivelEstudios?: string; // Desde Firestore
    FechaNacimiento?: string; // YYYY-MM-DD
    updatedAt?: any; // Firestore Timestamp
    updatedBy?: string; // Sistema que actualizó
}

/**
 * Competencia evaluada del empleado
 * Compartido con APP - TALENTO
 */
export interface CompetenciaEvaluacion {
    skillId: string;
    skillName: string;
    nivel: 1 | 2 | 3; // Básico, Intermedio, Avanzado
    fechaEvaluacion: string;
    evaluadoPor: string;
}

/**
 * Nota de seguimiento del empleado
 * Compartido con APP - TALENTO
 */
export interface NotaEmpleado {
    id: string;
    fecha: string;
    autor: string;
    contenido: string;
    tipo: 'observacion' | 'formacion' | 'incidencia';
    skillId?: string; // ID de la competencia relacionada (si existe)
}

/**
 * Perfil completo del empleado (merge híbrido)
 * Combina API + Firestore en memoria
 */
export interface EmployeeFullProfile extends EmployeeIdentity, EmployeeRichData {
    competencias?: CompetenciaEvaluacion[];
    notas?: NotaEmpleado[];
    // Flag para indicar si hay datos pendientes de APP - TALENTO
    hasPendingData?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES DE SERVICIO
// ═══════════════════════════════════════════════════════════════════

/**
 * Obtener identidades de empleados desde API local
 * Esta es la ÚNICA fuente de verdad para nombres
 */
export async function getEmployeeIdentities(onlyActive: boolean = true): Promise<EmployeeIdentity[]> {
    try {
        const operarios = await getOperarios(onlyActive);

        return operarios.map(op => ({
            IDOperario: op.IDOperario,
            DescOperario: op.DescOperario, // PII desde API
            Activo: op.Activo,
            Productivo: op.Productivo,
            IDDepartamento: op.IDDepartamento,
            DescDepartamento: op.DescDepartamento
        }));
    } catch (error) {
        logger.error('❌ Error obteniendo identidades de empleados desde API:', error);
        throw new Error('No se pudieron cargar los datos de empleados desde el servidor local');
    }
}

/**
 * Obtener datos enriquecidos de un empleado desde Firestore
 * NO contiene PII - Solo datos de RRHH
 * 
 * @param employeeId - ID del operario (formato: "005", "049", "120")
 * @returns Datos enriquecidos o null si no existe
 */
export async function getEmployeeRichData(employeeId: string): Promise<EmployeeRichData | null> {
    try {
        const db = getFirebaseDb();

        // Normalizar ID a formato consistente (3 dígitos con ceros a la izquierda)
        const normalizedId = employeeId.toString().padStart(3, '0');

        const docRef = doc(db, 'EMPLEADOS', normalizedId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            logger.info(`ℹ️ Empleado ${normalizedId} no encontrado en Firebase - Datos pendientes de Talento`);
            return null;
        }

        const data = docSnap.data() as EmployeeRichData;

        // Validación: Asegurar que NO hay PII en Firestore
        if ('DescOperario' in data || 'nombre' in data || 'apellidos' in data) {
            logger.error('🚨 VIOLACIÓN GDPR: Se encontró PII en Firestore para empleado', normalizedId);
            throw new Error('Error de integridad de datos - Contacte al administrador');
        }

        return data;
    } catch (error) {
        logger.error('❌ Error obteniendo datos enriquecidos de empleado:', error);
        return null;
    }
}

/**
 * Obtener competencias de un empleado desde Firestore
 * 
 * @param employeeId - ID del operario (numérico o string)
 * @returns Array de competencias evaluadas
 */
export async function getEmployeeCompetencias(employeeId: string | number): Promise<CompetenciaEvaluacion[]> {
    try {
        const db = getFirebaseDb();
        const normalizedId = employeeId.toString().padStart(3, '0');

        const competenciasRef = collection(db, 'COMPETENCIAS');
        const q = query(competenciasRef, where('employeeId', '==', normalizedId));
        const querySnapshot = await getDocs(q);

        const competencias: CompetenciaEvaluacion[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            competencias.push({
                skillId: data.skillId || doc.id,
                skillName: data.skillName || 'Habilidad sin nombre',
                nivel: data.nivel || 1,
                fechaEvaluacion: data.fechaEvaluacion || '',
                evaluadoPor: data.evaluadoPor || 'Sistema'
            });
        });

        return competencias;
    } catch (error) {
        logger.error('❌ Error obteniendo competencias de empleado:', error);
        return [];
    }
}

/**
 * Obtener notas de seguimiento de un empleado desde Firestore
 * 
 * @param employeeId - ID del operario (numérico o string)
 * @returns Array de notas
 */
export async function getEmployeeNotas(employeeId: string | number): Promise<NotaEmpleado[]> {
    try {
        const db = getFirebaseDb();
        const normalizedId = employeeId.toString().padStart(3, '0');

        const notasRef = collection(db, 'NOTAS');
        const q = query(notasRef, where('employeeId', '==', normalizedId));
        const querySnapshot = await getDocs(q);

        const notas: NotaEmpleado[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            notas.push({
                id: doc.id,
                fecha: data.fecha || '',
                autor: data.autor || 'Anónimo',
                contenido: data.contenido || '',
                tipo: data.tipo || 'observacion',
                skillId: data.skillId // Mapear skillId si existe para relacionar con competencias
            });
        });

        // Ordenar por fecha descendente
        return notas.sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (error) {
        logger.error('❌ Error obteniendo notas de empleado:', error);
        return [];
    }
}

/**
 * MERGE HÍBRIDO: Combinar identidad (API) + datos ricos (Firestore)
 * Esta es la función principal para obtener perfiles completos
 * 
 * @param employeeId - ID del operario (opcional, si se omite trae todos)
 * @param includeCompetencias - Si incluir competencias (default: false)
 * @param includeNotas - Si incluir notas (default: false)
 * @returns Perfil completo o array de perfiles
 */
export async function getEmployeeFullProfile(
    employeeId?: number,
    includeCompetencias: boolean = false,
    includeNotas: boolean = false
): Promise<EmployeeFullProfile | null> {
    try {
        // 1. Obtener identidad desde API
        const identities = await getEmployeeIdentities(true);
        const identity = identities.find(emp => emp.IDOperario === employeeId);

        if (!identity) {
            logger.warn(`⚠️ Empleado ${employeeId} no encontrado en API local`);
            return null;
        }

        // 2. Obtener datos enriquecidos desde Firestore
        const normalizedId = employeeId!.toString().padStart(3, '0');
        const richData = await getEmployeeRichData(normalizedId);

        // 3. Merge en memoria
        const profile: EmployeeFullProfile = {
            ...identity,
            ...richData,
            hasPendingData: !richData // Flag si faltan datos de Talento
        };

        // 4. Opcionalmente cargar competencias
        if (includeCompetencias) {
            profile.competencias = await getEmployeeCompetencias(normalizedId);
        }

        // 5. Opcionalmente cargar notas
        if (includeNotas) {
            profile.notas = await getEmployeeNotas(normalizedId);
        }

        logger.success(`✅ Perfil completo cargado para: ${identity.DescOperario}`);
        return profile;

    } catch (error) {
        logger.error('❌ Error en merge híbrido de perfil de empleado:', error);
        throw error;
    }
}

/**
 * Obtener todos los perfiles de empleados con merge híbrido
 * ADVERTENCIA: Puede ser costoso si hay muchos empleados
 * 
 * @param onlyActive - Solo empleados activos (default: true)
 * @returns Array de perfiles completos
 */
export async function getAllEmployeeProfiles(onlyActive: boolean = true): Promise<EmployeeFullProfile[]> {
    try {
        // 1. Obtener todas las identidades desde API
        const identities = await getEmployeeIdentities(onlyActive);

        logger.info(`📋 Cargando perfiles para ${identities.length} empleados...`);

        // 2. Obtener datos enriquecidos en paralelo (optimización)
        const profilePromises = identities.map(async (identity) => {
            const normalizedId = identity.IDOperario.toString().padStart(3, '0');
            const richData = await getEmployeeRichData(normalizedId);

            return {
                ...identity,
                ...richData,
                hasPendingData: !richData
            } as EmployeeFullProfile;
        });

        const profiles = await Promise.all(profilePromises);

        logger.success(`✅ ${profiles.length} perfiles cargados correctamente`);
        return profiles;

    } catch (error) {
        logger.error('❌ Error cargando todos los perfiles:', error);
        throw error;
    }
}
