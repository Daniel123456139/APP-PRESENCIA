import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebaseConfig';
import { SickLeave } from '../hooks/useFirestoreSync';
import logger from '../utils/logger';

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
        const docRef = doc(db, 'EMPLEADOS', employeeId);
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
        const docRef = doc(db, 'EMPLEADOS', employeeId);
        await updateDoc(docRef, {
            UltimoFichaje: new Date().toISOString(),
            updatedAt: serverTimestamp(),
            updatedBy: 'sistema-presencia'
        });
    } catch (error) {
        logger.error('❌ Error actualizando último fichaje:', error);
    }
}
