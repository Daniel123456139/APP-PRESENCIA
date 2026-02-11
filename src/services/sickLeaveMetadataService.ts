import { getFirebaseDb } from '../firebaseConfig';
import { collection, doc, setDoc, onSnapshot, query, Timestamp, getDocs } from 'firebase/firestore';

export interface SickLeaveMetadata {
    id: string;
    employeeId: string;
    startDate: string;
    nextRevisionDate?: string | null;
    dischargeDate?: string | null;
    doctorNotes?: string;
    confirmedByEmployee?: boolean;
    updatedAt?: any;
    updatedBy?: string;
}


const metadataCache = new Map<string, SickLeaveMetadata>();
let isInitialized = false;
let unsubscribe: (() => void) | null = null;

export const SickLeaveMetadataService = {
    async init() {
        if (isInitialized) {
            return;
        }

        try {
            const db = getFirebaseDb();
            const q = query(collection(db, 'BAJAS_METADATA'));

            // Intentar leer una vez para verificar permisos
            try {
                const snapshot = await getDocs(q);
                snapshot.forEach(docItem => {
                    const data = docItem.data();
                    metadataCache.set(docItem.id, {
                        id: docItem.id,
                        employeeId: data.employeeId || '',
                        startDate: data.startDate || '',
                        nextRevisionDate: data.nextRevisionDate || null,
                        dischargeDate: data.dischargeDate || null,
                        doctorNotes: data.doctorNotes || '',
                        confirmedByEmployee: data.confirmedByEmployee || false,
                        updatedAt: data.updatedAt,
                        updatedBy: data.updatedBy
                    });
                });
                console.log('[SickLeaveMetadata] Loaded ' + metadataCache.size + ' records from Firestore');

                unsubscribe = onSnapshot(q, (snapshot) => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added' || change.type === 'modified') {
                            const data = change.doc.data();
                            metadataCache.set(change.doc.id, {
                                id: change.doc.id,
                                employeeId: data.employeeId || '',
                                startDate: data.startDate || '',
                                nextRevisionDate: data.nextRevisionDate || null,
                                dischargeDate: data.dischargeDate || null,
                                doctorNotes: data.doctorNotes || '',
                                confirmedByEmployee: data.confirmedByEmployee || false,
                                updatedAt: data.updatedAt,
                                updatedBy: data.updatedBy
                            });
                        } else if (change.type === 'removed') {
                            metadataCache.delete(change.doc.id);
                        }
                    });
                    console.log('[SickLeaveMetadata] Cache updated: ' + metadataCache.size + ' records');
                });

                isInitialized = true;
            } catch (permError: any) {
                if (permError.code === 'permission-denied' || permError.message?.includes('Missing or insufficient permissions')) {
                    console.warn('[SickLeaveMetadata] ⚠️ Acceso denegado a Firebase (BAJAS_METADATA). El servicio funcionará en modo local/offline temporal.');
                    // Marcar como inicializado para evitar reintentos infinitos que spammean la consola
                    isInitialized = true;
                } else {
                    throw permError;
                }
            }
        } catch (e) {
            console.error('[SickLeaveMetadata] Error initializing service:', e);
            // Evitar crash total, permitir reintento manual o futuro
        }
    },

    get(employeeId: string | number, startDate: string): SickLeaveMetadata | null {
        if (!isInitialized) {
            // Ya no auto-inicializamos aquí para evitar bucles si falló antes.
            // init() debe llamarse explícitamente al arranque de la app.
            return null;
        }

        const key = employeeId + '_' + startDate;
        return metadataCache.get(key) || null;
    },

    async update(employeeId: string | number, startDate: string, updates: Partial<SickLeaveMetadata>, updatedBy: string) {
        const key = employeeId + '_' + startDate;
        const db = getFirebaseDb();

        const metadata = {
            id: key,
            employeeId: String(employeeId),
            startDate,
            ...metadataCache.get(key),
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy
        };

        try {
            await setDoc(doc(db, 'BAJAS_METADATA', key), metadata);
            metadataCache.set(key, metadata);
            console.log('[SickLeaveMetadata] Updated ' + key + ':', metadata);
            return metadata;
        } catch (e) {
            console.error('[SickLeaveMetadata] Error updating ' + key + ':', e);
            throw e;
        }
    },

    cleanup() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        metadataCache.clear();
        isInitialized = false;
        console.log('[SickLeaveMetadata] Service cleaned up');
    }
};
