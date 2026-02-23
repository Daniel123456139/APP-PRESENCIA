import {
    Firestore,
    collection,
    query,
    limit,
    getDocs,
    doc,
    getDoc,
    DocumentData,
    DocumentSnapshot
} from 'firebase/firestore';
import logger from '../utils/logger';

const EMPLOYEE_COLLECTION_CANDIDATES = ['EMPLEADOS_REF', 'EMPLEADOS'] as const;
let resolvedEmployeeCollection: string | null = null;

export async function resolveEmployeeCollection(db: Firestore): Promise<string> {
    if (resolvedEmployeeCollection) {
        return resolvedEmployeeCollection;
    }

    for (const candidate of EMPLOYEE_COLLECTION_CANDIDATES) {
        try {
            await getDocs(query(collection(db, candidate), limit(1)));
            resolvedEmployeeCollection = candidate;
            logger.info(`🔥 Coleccion de empleados activa: ${candidate}`);
            return candidate;
        } catch {
            // Intentar siguiente candidato
        }
    }

    resolvedEmployeeCollection = 'EMPLEADOS';
    logger.warn('⚠️ No se pudo resolver coleccion de empleados. Usando fallback EMPLEADOS.');
    return resolvedEmployeeCollection;
}

export async function getEmployeeDocWithFallback(
    db: Firestore,
    employeeId: string
): Promise<{ snapshot: DocumentSnapshot<DocumentData>; collectionName: string } | null> {
    for (const candidate of EMPLOYEE_COLLECTION_CANDIDATES) {
        const ref = doc(db, candidate, employeeId);
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) {
            resolvedEmployeeCollection = candidate;
            return { snapshot, collectionName: candidate };
        }
    }

    return null;
}
