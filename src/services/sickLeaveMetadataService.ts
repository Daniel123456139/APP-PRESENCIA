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

const metadataCache = new Map();
let isInitialized = false;
let unsubscribe = null;

export const SickLeaveMetadataService = {
    async init() {
        if (isInitialized) {
            console.log('[SickLeaveMetadata] Already initialized');
            return;
        }

        try {
            const db = getFirebaseDb();
            const q = query(collection(db, 'BAJAS_METADATA'));

            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                const data = doc.data();
                metadataCache.set(doc.id, {
                    id: doc.id,
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

            console.log(`[SickLeaveMetadata] Loaded ${metadataCache.size} records from Firestore`);

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
                console.log(`[SickLeaveMetadata] Cache updated: ${metadataCache.size} records`);
            });

            isInitialized = true;
        } catch (e) {
            console.error('[SickLeaveMetadata] Error initializing service:', e);
        }
    },

    get(employeeId, startDate) {
        if (!isInitialized) {
            console.warn('[SickLeaveMetadata] Service not initialized, auto-initializing...');
            this.init();
            return null;
        }

        const key = ${ employeeId }_;
        return metadataCache.get(key) || null;
    },

    async update(employeeId, startDate, updates, updatedBy) {
        const key = ${ employeeId }_;
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
            console.log([SickLeaveMetadata] Updated :, metadata);
            return metadata;
        } catch (e) {
            console.error([SickLeaveMetadata] Error updating :, e);
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
