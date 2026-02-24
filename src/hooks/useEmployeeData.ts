/**
 * Hook de Empleados desde Firebase (Fuente Principal) + Enriquecimiento API
 * 
 * ESTRATEGIA:
 * 1. Fuente de Verdad para EXISTENCIA: Firebase (colección EMPLEADOS)
 * 2. Fuente de Verdad para NOMBRE: API Local (si disponible)
 * 3. Enriquecimiento: Competencias y Notas
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    collection,
    onSnapshot,
    query,
    where,
    getDocs,
    Unsubscribe
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebaseConfig';
import { EmployeeFullProfile, CompetenciaEvaluacion, NotaEmpleado, getEmployeeIdentities, EmployeeIdentity } from '../services/employeeService';
import { resolveEmployeeCollection } from '../services/firebaseSchemaService';
import logger from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════

export interface UseEmployeeDataOptions {
    employeeId?: number;               // Filtrar por ID específico
    onlyActive?: boolean;              // Solo empleados activos (default: true)
    includeCompetencias?: boolean;     // Cargar competencias (default: false)
    includeNotas?: boolean;            // Cargar notas (default: false)
    autoRefresh?: boolean;             // Suscripción en tiempo real (default: true)
}

export interface UseEmployeeDataReturn {
    employees: EmployeeFullProfile[];
    employee: EmployeeFullProfile | null; // Si se filtró por ID
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    isEmpty: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════

/**
 * Cargar competencias de un empleado desde Firebase
 */
async function loadCompetencias(empId: string): Promise<CompetenciaEvaluacion[]> {
    try {
        const db = getFirebaseDb();
        const competenciasRef = collection(db, 'COMPETENCIAS');
        const q = query(competenciasRef, where('employeeId', '==', empId));
        const snapshot = await getDocs(q);

        const competencias: CompetenciaEvaluacion[] = [];
        snapshot.forEach((doc) => {
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
    } catch (err) {
        logger.error(`❌ Error cargando competencias para ${empId}:`, err);
        return [];
    }
}

/**
 * Cargar notas de un empleado desde Firebase
 */
async function loadNotas(empId: string): Promise<NotaEmpleado[]> {
    try {
        const db = getFirebaseDb();
        const notasRef = collection(db, 'NOTAS');
        const q = query(notasRef, where('employeeId', '==', empId));
        const snapshot = await getDocs(q);

        const notas: NotaEmpleado[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            notas.push({
                id: doc.id,
                fecha: data.fecha || '',
                autor: data.autor || 'Anónimo',
                contenido: data.contenido || '',
                tipo: data.tipo || 'observacion'
            });
        });

        // Ordenar por fecha descendente
        return notas.sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (err) {
        logger.error(`❌ Error cargando notas para ${empId}:`, err);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export const useEmployeeData = (options: UseEmployeeDataOptions = {}): UseEmployeeDataReturn => {
    const {
        employeeId,
        onlyActive = true,
        includeCompetencias = false,
        includeNotas = false,
        autoRefresh = true
    } = options;

    // ═══════════════════════════════════════════════════════════════════
    // ESTADO
    // ═══════════════════════════════════════════════════════════════════

    const [employees, setEmployees] = useState<EmployeeFullProfile[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Cache de identidades API
    const apiIdentitiesRef = useRef<Map<number, EmployeeIdentity>>(new Map());

    // ═══════════════════════════════════════════════════════════════════
    // 1. CARGA DE IDENTIDADES (API)
    // ═══════════════════════════════════════════════════════════════════

    useEffect(() => {
        async function fetchIdentities() {
            try {
                const identities = await getEmployeeIdentities(onlyActive);
                const map = new Map<number, EmployeeIdentity>();
                identities.forEach(id => map.set(id.IDOperario, id));
                apiIdentitiesRef.current = map;
                logger.info(`📋 API Cache: ${map.size} identidades cargadas`);
            } catch (err) {
                logger.warn('⚠️ No se pudo conectar a la API local para obtener nombres reales');
            }
        }
        fetchIdentities();
    }, [onlyActive]);

    // ═══════════════════════════════════════════════════════════════════
    // 2. SUSCRIPCIÓN FIREBASE + MERGE
    // ═══════════════════════════════════════════════════════════════════

    useEffect(() => {
        if (!autoRefresh) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        let unsubscribe: Unsubscribe | null = null;
        let cancelled = false;

        const setupSubscription = async () => {
            try {
                const db = getFirebaseDb();
                const employeesCollectionName = await resolveEmployeeCollection(db);
                if (cancelled) return;

                const empleadosRef = collection(db, employeesCollectionName);

                let q = query(empleadosRef);

                // Nota: Filtramos por ID si es necesario, pero el filtro de Activo
                // lo hacemos en memoria o confiamos en el query de Firebase.
                if (employeeId) {
                    const normalizedId = employeeId.toString().padStart(3, '0');
                    q = query(empleadosRef, where('IDOperario', '==', normalizedId));
                }

                unsubscribe = onSnapshot(
                    q,
                    async (snapshot) => {
                        const employeesData: EmployeeFullProfile[] = [];

                        for (const doc of snapshot.docs) {
                            const docId = doc.id;
                            const data = doc.data();

                            // Determinar ID numérico
                            const idNum = parseInt(data.IDOperario || docId, 10);

                            // Buscar identidad real en API Cache
                            const apiIdentity = apiIdentitiesRef.current.get(idNum);

                            // Construir perfil preferendo datos API para PII
                            const profile: EmployeeFullProfile = {
                                IDOperario: idNum,
                                DescOperario: apiIdentity?.DescOperario || data.DescOperario || `Empleado ${docId}`,
                                Activo: data.Activo ?? true,
                                Productivo: apiIdentity?.Productivo ?? data.Productivo ?? true,
                                Flexible: data.Flexible ?? false,
                                IDDepartamento: apiIdentity ? apiIdentity.IDDepartamento : parseInt(data.IDDepartamento || '0', 10),
                                DescDepartamento: apiIdentity?.DescDepartamento || data.DescDepartamento || data.Seccion || '',

                                // Datos enriquecidos (Firebase es source of truth)
                                FechaAntiguedad: data.FechaAntiguedad,
                                NivelRetributivo: data.NivelRetributivo,
                                Categoria: data.Categoria,
                                Seccion: data.Seccion,
                                TurnoHabitual: data.TurnoHabitual,
                                UltimoFichaje: data.UltimoFichaje,
                                Edad: data.Edad,
                                NivelEstudios: data.NivelEstudios,
                                FechaNacimiento: data.FechaNacimiento,
                                updatedAt: data.updatedAt,
                                updatedBy: data.updatedBy,
                                hasPendingData: false
                            };

                            // Cargar subcolecciones
                            if (includeCompetencias) {
                                profile.competencias = await loadCompetencias(docId);
                            }
                            if (includeNotas) {
                                profile.notas = await loadNotas(docId);
                            }

                            // Filtrado final activo (si la API dice inactivo y Firebase activo, o viceversa)
                            // Respetamos lo solicitado en options.onlyActive
                            if (onlyActive && !profile.Activo) continue;

                            employeesData.push(profile);
                        }

                        setEmployees(employeesData);
                        setLoading(false);
                    },
                    (err) => {
                        logger.error('❌ Error suscripción:', err);
                        setError('Error conectando a datos en vivo');
                        setLoading(false);
                    }
                );
            } catch {
                setError('Error de conexión');
                setLoading(false);
            }
        };

        setupSubscription();

        return () => {
            cancelled = true;
            if (unsubscribe) unsubscribe();
        };

    }, [employeeId, onlyActive, includeCompetencias, includeNotas, autoRefresh]);

    const refresh = useCallback(async () => {
        // En arquitectura realtime, refresh recarga las identidades API
        // que es lo único que no es "live"
        try {
            const identities = await getEmployeeIdentities(onlyActive);
            const map = new Map<number, EmployeeIdentity>();
            identities.forEach(id => map.set(id.IDOperario, id));
            apiIdentitiesRef.current = map;
            // Forzar re-render podría requerir un toggle de estado, 
            // pero el próximo snapshot usará los nuevos datos.
        } catch (e) { console.error(e); }
    }, [onlyActive]);

    return {
        employees,
        employee: employees[0] || null,
        loading,
        error,
        refresh,
        isEmpty: employees.length === 0
    };
};

export default useEmployeeData;
