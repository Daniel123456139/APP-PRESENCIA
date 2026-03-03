import {
    Firestore,
    collection,
    query,
    limit,
    getDocs,
    doc,
    getDoc,
    DocumentData,
    DocumentSnapshot,
    QuerySnapshot
} from 'firebase/firestore';
import logger from '../utils/logger';

const EMPLOYEE_COLLECTION_CANDIDATES = ['EMPLEADOS_REF', 'EMPLEADOS'] as const;
const EMPLOYEE_FALLBACK_COLLECTION = 'EMPLEADOS';
let resolvedEmployeeCollection: string | null = null;

function parseEmployeeNumericId(rawId: unknown): number | null {
    if (rawId === null || rawId === undefined) return null;
    const numericStr = String(rawId).replace(/\D/g, '');
    if (!numericStr) return null;
    const parsed = Number.parseInt(numericStr, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function hasEmployeeLikeDocuments(snapshot: QuerySnapshot<DocumentData>): boolean {
    return snapshot.docs.some((employeeDoc) => {
        if (employeeDoc.id === '_meta') return false;

        const data = employeeDoc.data();
        const rawId = data.IDOperario ?? employeeDoc.id;
        return parseEmployeeNumericId(rawId) !== null;
    });
}

export async function resolveEmployeeCollection(db: Firestore): Promise<string> {
    if (resolvedEmployeeCollection) {
        return resolvedEmployeeCollection;
    }

    const accessibleCollections: string[] = [];

    for (const candidate of EMPLOYEE_COLLECTION_CANDIDATES) {
        try {
            const snapshot = await getDocs(query(collection(db, candidate), limit(25)));
            accessibleCollections.push(candidate);

            if (hasEmployeeLikeDocuments(snapshot)) {
                resolvedEmployeeCollection = candidate;
                logger.info(`🔥 Coleccion de empleados activa: ${candidate}`);
                return candidate;
            }

            logger.warn(`⚠️ Coleccion ${candidate} accesible, pero sin documentos de empleados validos.`);
        } catch {
            // Intentar siguiente candidato
        }
    }

    if (accessibleCollections.length > 0) {
        resolvedEmployeeCollection = accessibleCollections.includes(EMPLOYEE_FALLBACK_COLLECTION)
            ? EMPLOYEE_FALLBACK_COLLECTION
            : accessibleCollections[0];
        logger.warn(`⚠️ No se detectaron empleados validos. Usando fallback ${resolvedEmployeeCollection}.`);
        return resolvedEmployeeCollection;
    }

    resolvedEmployeeCollection = EMPLOYEE_FALLBACK_COLLECTION;
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
