import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseDb } from '../firebaseConfig';
import {
    RawDataRow,
    ProcessedDataRow,
    Role
} from '../types';
import { useOperarios, useMotivos, useCalendario } from './useErp';
import { useFichajes } from './useFichajes';
import { useProcessDataWorker } from './useProcessDataWorker';
import { fetchSyntheticPunches } from '../services/firestoreService';
import { getCalendarioOperario, CalendarioDia } from '../services/erpApi';
import { normalizeDateKey, extractTimeHHMM } from '../utils/datetime';
import { toISODateLocal } from '../utils/localDate';
import logger from '../utils/logger';
import { resolveEmployeeCollection } from '../services/firebaseSchemaService';
import type { PayrollExportProgress } from '../services/exports/detailedIncidenceExportService';

export interface UseHrPortalDataProps {
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
}

export interface MissingFirebaseEmployee {
    id: number;
    name: string;
    department: string;
    flexible: boolean;
}

export interface PayrollExportUiProgress {
    percent: number;
    message: string;
    phase: 'validando' | 'cargando_periodo' | 'cargando_ytd' | 'procesando_empleados' | 'construyendo_excel' | 'finalizando';
    completedEmployees?: number;
    totalEmployees?: number;
}

export const useHrPortalData = ({ startDate, endDate, startTime = '00:00', endTime = '23:59' }: UseHrPortalDataProps) => {
    const queryDb = getFirebaseDb();

    // 1. Cargar Datos Maestros y Fichajes desde ERP (via TanStack Query)
    const { loading: loadingMotivos } = useMotivos();
    const { operarios, loading: loadingOperarios } = useOperarios(false);
    const { calendario: companyCalendarDays, loading: loadingCalendario } = useCalendario(startDate, endDate);

    // Fichajes y Mutaciones
    const {
        erpData,
        isLoading: isLoadingFichajes,
        isFetching: isFetchingFichajes,
        dataUpdatedAt,
        error: fichajesError,
        refresh: refreshErpData
    } = useFichajes(startDate, endDate, startTime, endTime);

    const lastSystemDayRef = useRef<string>(toISODateLocal(new Date()));

    // 2. Cargar Bajas Médicas Activas desde Firestore
    const { data: activeSickLeavesRaw = [], refetch: refetchActiveSickLeaves } = useQuery({
        queryKey: ['sick_leaves', 'active'],
        queryFn: async () => {
            const q = query(
                collection(queryDb, 'SICK_LEAVES'),
                where('status', '==', 'Activa')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown as RawDataRow[];
        },
        staleTime: 1000 * 60 * 5,
    });

    // 3. Cargar Fichajes Sintéticos desde Firestore
    const { data: syntheticPunches = new Map() } = useQuery({
        queryKey: ['synthetic_punches', { startDate, endDate }],
        queryFn: () => fetchSyntheticPunches(startDate, endDate),
        staleTime: 1000 * 60 * 5,
    });

    const {
        data: firebaseEmployeeIds = new Set<number>(),
        refetch: refetchFirebaseEmployeeIds
    } = useQuery({
        queryKey: ['firebase_employee_ids'],
        queryFn: async () => {
            const db = getFirebaseDb();
            const collectionName = await resolveEmployeeCollection(db);
            const snapshot = await getDocs(collection(db, collectionName));
            const ids = new Set<number>();

            snapshot.forEach((employeeDoc) => {
                const data = employeeDoc.data();
                const rawId = data.IDOperario ?? employeeDoc.id;
                const parsedId = parseInt(String(rawId), 10);
                if (!Number.isNaN(parsedId)) {
                    ids.add(parsedId);
                }
            });

            return ids;
        },
        staleTime: 1000 * 60 * 5,
    });

    // 4. Estados locales para UI
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
    const [registeringEmployeeIds, setRegisteringEmployeeIds] = useState<Set<number>>(new Set());
    const [isPayrollExporting, setIsPayrollExporting] = useState(false);
    const [payrollExportProgress, setPayrollExportProgress] = useState<PayrollExportUiProgress>({
        phase: 'validando',
        percent: 0,
        message: 'Preparando exportacion...'
    });

    // 5. Lógica de Calendarios (Estado local temporal)
    const [employeeCalendarsByDate, setEmployeeCalendarsByDate] = useState<Map<number, Map<string, CalendarioDia>>>(new Map());
    const [isFetchingCalendars, setIsFetchingCalendars] = useState(false);

    const erpDataWithSynthetic = useMemo(() => {
        if (!erpData || erpData.length === 0) return [] as RawDataRow[];
        if (!syntheticPunches || syntheticPunches.size === 0) return erpData;

        return erpData.map(row => {
            const normalizedDate = normalizeDateKey(row.Fecha);
            const timeKey = extractTimeHHMM(row.Hora);
            const key = `${row.IDOperario}_${normalizedDate}_${timeKey}`;
            if (syntheticPunches.has(key)) {
                return { ...row, GeneradoPorApp: true };
            }
            return row;
        });
    }, [erpData, syntheticPunches]);

    const allUsers = useMemo(() => {
        return operarios.map(op => ({
            id: op.IDOperario,
            name: op.DescOperario,
            role: Role.Employee,
            department: op.DescDepartamento || 'General',
            flexible: op.Flexible
        }));
    }, [operarios]);

    const missingFirebaseEmployees = useMemo<MissingFirebaseEmployee[]>(() => {
        if (!operarios || operarios.length === 0) return [];

        return operarios
            .filter(op => !firebaseEmployeeIds.has(op.IDOperario))
            .map(op => ({
                id: op.IDOperario,
                name: op.DescOperario,
                department: op.DescDepartamento || 'General',
                flexible: Boolean(op.Flexible)
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [operarios, firebaseEmployeeIds]);

    const analysisRange = useMemo(() => {
        if (!startDate || !endDate) return undefined;
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
        return { start, end };
    }, [startDate, endDate]);

    const holidaysSet = useMemo(() => {
        const set = new Set<string>();
        companyCalendarDays.forEach(day => {
            if (String(day.TipoDia) === '1') {
                const cleanDate = day.Fecha?.includes('T') ? day.Fecha.split('T')[0] : day.Fecha;
                if (cleanDate) set.add(cleanDate);
            }
        });
        return set;
    }, [companyCalendarDays]);

    const employeeCalendarTipoDiaRecord = useMemo(() => {
        const record: Record<number, Record<string, number>> = {};
        employeeCalendarsByDate.forEach((dateMap, employeeId) => {
            const dayRecord: Record<string, number> = {};
            dateMap.forEach((day, date) => {
                dayRecord[date] = Number(day.TipoDia ?? 0);
            });
            record[employeeId] = dayRecord;
        });
        return record;
    }, [employeeCalendarsByDate]);

    const employeeCalendarsKey = useMemo(
        () => JSON.stringify(employeeCalendarTipoDiaRecord),
        [employeeCalendarTipoDiaRecord]
    );

    // 6. Procesamiento de Datos (Worker)
    const { result: processedData, status } = useProcessDataWorker(
        erpDataWithSynthetic,
        allUsers,
        analysisRange,
        holidaysSet,
        dataUpdatedAt,
        employeeCalendarTipoDiaRecord,
        employeeCalendarsKey
    );
    const isProcessing = status === 'processing';

    // 7. Agrupar Datos para el Resumen y Ausencias
    const { datasetResumen, datasetAusencias } = useMemo(() => {
        let processed: ProcessedDataRow[] = processedData;

        if (selectedEmployeeIds.length > 0) {
            const ids = new Set(selectedEmployeeIds.map(id => Number(id)));
            processed = processed.filter(p => ids.has(p.operario));
        } else if (selectedDepartment !== 'all' && selectedDepartment !== 'TODOS') {
            processed = processed.filter(p => p.colectivo === selectedDepartment);
        }

        const resumen: ProcessedDataRow[] = [];
        const ausencias: ProcessedDataRow[] = [];

        processed.forEach(p => {
            const resolvedAbsentDays = p.absentDays || [];

            if (resolvedAbsentDays.length === 0) {
                resumen.push(p);
                return;
            }

            ausencias.push({
                ...p,
                absentDays: resolvedAbsentDays
            });
        });

        return { datasetResumen: resumen, datasetAusencias: ausencias };
    }, [processedData, selectedEmployeeIds, selectedDepartment]);

    // Lógica de carga de calendarios por empleado
    const lastFetchParams = useRef<string>('');
    const calendarAbortController = useRef<AbortController | null>(null);
    const employeeCalendarCacheRef = useRef<Map<string, CalendarioDia[]>>(new Map());

    useEffect(() => {
        const fetchParams = `${startDate}|${endDate}|${operarios.length}`;
        if (lastFetchParams.current === fetchParams) return;
        lastFetchParams.current = fetchParams;

        const timer = setTimeout(() => {
            const updateCalendar = async () => {
                if (operarios.length === 0) return;
                setIsFetchingCalendars(true);

                if (calendarAbortController.current) {
                    calendarAbortController.current.abort();
                }
                calendarAbortController.current = new AbortController();

                try {
                    const allActiveOperatorIds = operarios
                        .filter(op => op.Activo)
                        .map(op => op.IDOperario);

                    if (allActiveOperatorIds.length === 0) return;

                    const results: { id: number; cal: CalendarioDia[] }[] = [];
                    const batchSize = 6;

                    for (let i = 0; i < allActiveOperatorIds.length; i += batchSize) {
                        if (calendarAbortController.current?.signal.aborted) break;

                        const batch = allActiveOperatorIds.slice(i, i + batchSize);
                        const batchPromises = batch.map(id =>
                            {
                                const cacheKey = `${id}|${startDate}|${endDate}`;
                                const cached = employeeCalendarCacheRef.current.get(cacheKey);

                                if (cached) {
                                    return Promise.resolve({ id, cal: cached });
                                }

                                return getCalendarioOperario(id.toString(), startDate, endDate)
                                    .then(cal => {
                                        employeeCalendarCacheRef.current.set(cacheKey, cal);
                                        return { id, cal };
                                    })
                                    .catch(() => ({ id, cal: [] as CalendarioDia[] }));
                            }
                        );

                        const batchResults = await Promise.all(batchPromises);
                        results.push(...batchResults);

                        if (i + batchSize < allActiveOperatorIds.length) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }

                    if (calendarAbortController.current?.signal.aborted) return;

                    const empCalMap = new Map<number, Map<string, CalendarioDia>>();
                    results.forEach(({ id, cal }) => {
                        const dateMap = new Map<string, CalendarioDia>();
                        cal.forEach(day => {
                            if (!day.Fecha) return;
                            const cleanDate = normalizeDateKey(day.Fecha);
                            if (!cleanDate) return;
                            dateMap.set(cleanDate, day);
                        });
                        empCalMap.set(id, dateMap);
                    });

                    setEmployeeCalendarsByDate(empCalMap);
                } catch (e) {
                    logger.error("Error fetching calendars:", e);
                } finally {
                    setIsFetchingCalendars(false);
                }
            };

            updateCalendar();
        }, 100);

        return () => {
            clearTimeout(timer);
            if (calendarAbortController.current) {
                calendarAbortController.current.abort();
            }
        };
    }, [operarios, startDate, endDate]);

    // 8. Handlers para Acciones
    const handleExport = async (range?: { startDate: string; endDate: string }) => {
        const exportStartDate = (range?.startDate ?? startDate).trim().substring(0, 10);
        const exportEndDate = (range?.endDate ?? endDate).trim().substring(0, 10);

        logger.info('Generando Excel de Nóminas...');
        setIsPayrollExporting(true);
        setPayrollExportProgress({
            phase: 'validando',
            percent: 1,
            message: 'Iniciando exportacion de nomina...'
        });
        try {
            const exportService = await import('../services/exports/detailedIncidenceExportService');
            await exportService.generatePayrollExport(exportStartDate, exportEndDate, operarios, (progress: PayrollExportProgress) => {
                setPayrollExportProgress({
                    phase: progress.phase,
                    percent: progress.percent,
                    message: progress.message,
                    completedEmployees: progress.completedEmployees,
                    totalEmployees: progress.totalEmployees
                });
            });
            setPayrollExportProgress({
                phase: 'finalizando',
                percent: 100,
                message: 'Exportacion completada.'
            });
        } catch (error: any) {
            logger.error('Error al generar Excel:', error);
            setPayrollExportProgress({
                phase: 'finalizando',
                percent: Math.max(5, payrollExportProgress.percent),
                message: error?.message || 'Error en la exportacion'
            });
            if (typeof window !== 'undefined') {
                window.alert(`No se pudo generar el Excel de nomina.\n\nDetalle: ${error?.message || 'Error desconocido'}`);
            }
        } finally {
            setTimeout(() => setIsPayrollExporting(false), 1200);
        }
    };

    const handleFreeHoursExport = async (section: string, filterEmployeeIds: string[]) => {
        logger.info('Generando Excel de Horas Libres...');
        try {
            const exportService = await import('../services/exports/freeHoursExportService');
            // @ts-ignore - Temporary until service is updated
            await exportService.generateFreeHoursExport(section, filterEmployeeIds, operarios);
        } catch (error: any) {
            logger.error('Error:', error);
        }
    };

    const registerMissingEmployee = async (employeeId: number): Promise<void> => {
        const target = operarios.find(op => op.IDOperario === employeeId);
        if (!target) {
            throw new Error(`No se encontró el empleado ERP ${employeeId}`);
        }

        setRegisteringEmployeeIds(prev => {
            const next = new Set(prev);
            next.add(employeeId);
            return next;
        });

        try {
            const db = getFirebaseDb();
            const collectionName = await resolveEmployeeCollection(db);
            const docId = String(employeeId).padStart(3, '0');

            await setDoc(doc(db, collectionName, docId), {
                IDOperario: docId,
                DescOperario: target.DescOperario || `Empleado ${employeeId}`,
                IDDepartamento: target.IDDepartamento || 0,
                DescDepartamento: target.DescDepartamento || 'General',
                Seccion: target.DescDepartamento || 'General',
                Activo: target.Activo !== false,
                Productivo: target.Productivo !== false,
                Flexible: Boolean(target.Flexible),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                updatedBy: 'hr-dashboard-auto-sync'
            }, { merge: true });

            await refetchFirebaseEmployeeIds();
            logger.success(`Empleado ${docId} añadido en Firebase`);
        } catch (error) {
            logger.error(`Error registrando empleado ${employeeId} en Firebase`, error);
            throw error;
        } finally {
            setRegisteringEmployeeIds(prev => {
                const next = new Set(prev);
                next.delete(employeeId);
                return next;
            });
        }
    };


    const selectedEmployeeData = useMemo(() => {
        if (selectedEmployeeIds.length !== 1) return undefined;
        const id = Number(selectedEmployeeIds[0]);
        return processedData.find(p => p.operario === id);
    }, [selectedEmployeeIds, processedData]);

    const isLongRange = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > 2;
    }, [startDate, endDate]);

    useEffect(() => {
        const timer = setInterval(() => {
            const today = toISODateLocal(new Date());
            if (today === lastSystemDayRef.current) return;

            lastSystemDayRef.current = today;
            refreshErpData();
        }, 60000);

        return () => clearInterval(timer);
    }, [refreshErpData]);

    return {
        erpData,
        processedData,
        datasetResumen,
        datasetAusencias,
        employeeOptions: operarios.map(op => ({
            id: op.IDOperario,
            name: op.DescOperario,
            role: Role.Employee,
            department: op.DescDepartamento || 'General',
            flexible: op.Flexible
        })),
        activeSickLeavesRaw,
        companyCalendarDays,
        selectedEmployeeData,
        isLoading: isLoadingFichajes || loadingOperarios || loadingMotivos || loadingCalendario || isProcessing,
        isRefetching: isFetchingFichajes && !isLoadingFichajes,
        fichajesError,
        refreshErpData,
        selectedDepartment,
        setSelectedDepartment,
        selectedEmployeeIds,
        setSelectedEmployeeIds,
        handleExport,
        handleFreeHoursExport,
        isPayrollExporting,
        payrollExportProgress,
        isLongRange,
        computedDepartments: Array.from(new Set(operarios.map(op => op.DescDepartamento).filter(Boolean))).sort(),
        employeeCalendarsByDate,
        setEmployeeCalendarsByDate,
        isFetchingCalendars,
        lastUpdated: dataUpdatedAt || null,
        refetchActiveSickLeaves,
        missingFirebaseEmployees,
        registerMissingEmployee,
        registeringEmployeeIds
    };
};
