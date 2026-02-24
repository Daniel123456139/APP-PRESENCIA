import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, Firestore } from 'firebase/firestore';
import { getFirebaseDb } from '../firebaseConfig';
import { resolveEmployeeCollection } from '../services/firebaseSchemaService';
import logger from '../utils/logger';

// Tipos compartidos con APP TALENTO
export interface FirestoreEmpleado {
    IDOperario: string;
    DescDepartamento: string;
    Activo: boolean;
    FechaAntiguedad?: string;
    NivelRetributivo?: string;
    NivelEstudios?: string;
    FechaNacimiento?: string;
    TurnoHabitual?: 'M' | 'TN';
    UltimoFichaje?: string;
    updatedAt?: any;
    updatedBy?: string;
}

export interface SickLeave {
    id: string;
    employeeId: string;
    type: 'ITEC' | 'ITAT';
    startDate: string;
    endDate: string | null;
    status: 'Activa' | 'Cerrada';
    motivo?: string;
    createdAt: any;
    updatedAt?: any;
    createdBy?: string;
}

interface FirestoreData {
    empleados: Map<string, FirestoreEmpleado>;
    sickLeaves: SickLeave[];
    loading: boolean;
    error: string | null;
}

/**
 * Hook para sincronizar datos de Firestore en tiempo real
 * Sincroniza con APP TALENTO automáticamente
 */
export const useFirestoreSync = (): FirestoreData => {
    const [empleados, setEmpleados] = useState<Map<string, FirestoreEmpleado>>(new Map());
    const [sickLeaves, setSickLeaves] = useState<SickLeave[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let unsubscribeEmpleados: (() => void) | null = null;
        let unsubscribeSickLeaves: (() => void) | null = null;

        const setup = async () => {
            let db: Firestore;

            try {
                db = getFirebaseDb();
            } catch (err) {
                logger.error("Firebase initialization error:", err);
                setError("No se pudo conectar con Firestore");
                setLoading(false);
                return;
            }

            const employeesCollectionName = await resolveEmployeeCollection(db);
            if (cancelled) return;

            // Listener para EMPLEADOS o EMPLEADOS_REF
            unsubscribeEmpleados = onSnapshot(
                collection(db, employeesCollectionName),
                (snapshot) => {
                    const empMap = new Map<string, FirestoreEmpleado>();
                    snapshot.forEach((doc) => {
                        empMap.set(doc.id, doc.data() as FirestoreEmpleado);
                    });
                    setEmpleados(empMap);
                    logger.success(`Sincronizados ${empMap.size} empleados desde Firestore (${employeesCollectionName})`);
                    setLoading(false);
                },
                (err) => {
                    logger.error("Firestore Error (Empleados):", err);
                    setError("Error sincronizando empleados");
                    setLoading(false);
                }
            );

            // Listener para SICK_LEAVES
            unsubscribeSickLeaves = onSnapshot(
                query(collection(db, 'SICK_LEAVES'), orderBy('createdAt', 'desc')),
                (snapshot) => {
                    const leaves: SickLeave[] = [];
                    snapshot.forEach((doc) => {
                        leaves.push({ id: doc.id, ...doc.data() } as SickLeave);
                    });
                    setSickLeaves(leaves);
                    logger.success(`Sincronizadas ${leaves.length} bajas médicas desde Firestore`);
                },
                (err) => {
                    logger.error("Firestore Error (Sick Leaves):", err);
                }
            );
        };

        setup();

        return () => {
            cancelled = true;
            if (unsubscribeEmpleados) unsubscribeEmpleados();
            if (unsubscribeSickLeaves) unsubscribeSickLeaves();
        };
    }, []);

    return { empleados, sickLeaves, loading, error };
};
