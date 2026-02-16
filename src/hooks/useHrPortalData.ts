import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
import logger from '../utils/logger';

export interface UseHrPortalDataProps {
    startDate: string;
    endDate: string;
}

export const useHrPortalData = ({ startDate, endDate }: UseHrPortalDataProps) => {
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
    } = useFichajes(startDate, endDate);

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

    // 4. Estados locales para UI
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

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

        const holidaySet = new Set(
            (companyCalendarDays || [])
                .filter(day => String(day.TipoDia) === '1')
                .map(day => (day.Fecha?.includes('T') ? day.Fecha.split('T')[0] : day.Fecha))
                .filter((date): date is string => Boolean(date))
        );

        const buildFallbackAbsentDays = (): string[] => {
            const days: string[] = [];
            const cursor = new Date(`${startDate}T00:00:00`);
            const end = new Date(`${endDate}T00:00:00`);

            while (cursor <= end) {
                const date = cursor.toISOString().slice(0, 10);
                const dayOfWeek = cursor.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isHoliday = holidaySet.has(date);

                if (!isWeekend && !isHoliday) {
                    days.push(date);
                }

                cursor.setDate(cursor.getDate() + 1);
            }

            return days;
        };

        processed.forEach(p => {
            const isTotalAbsence = (p.totalHoras + p.horasJustificadas + p.hTAJ) === 0;
            if (!isTotalAbsence) {
                resumen.push(p);
                return;
            }

            const resolvedAbsentDays = (p.absentDays?.length || 0) > 0
                ? p.absentDays
                : buildFallbackAbsentDays();

            if (resolvedAbsentDays.length > 0) {
                ausencias.push({
                    ...p,
                    absentDays: resolvedAbsentDays
                });
            } else {
                resumen.push(p);
            }
        });

        return { datasetResumen: resumen, datasetAusencias: ausencias };
    }, [processedData, selectedEmployeeIds, selectedDepartment, companyCalendarDays, startDate, endDate]);

    // Lógica de carga de calendarios por empleado
    const lastFetchParams = useRef<string>('');
    const calendarAbortController = useRef<AbortController | null>(null);

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
                            getCalendarioOperario(id.toString(), startDate, endDate)
                                .then(cal => ({ id, cal }))
                                .catch(() => ({ id, cal: [] as CalendarioDia[] }))
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
                            const cleanDate = day.Fecha.includes('T') ? day.Fecha.split('T')[0] : day.Fecha;
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
        try {
            const exportService = await import('../services/exports/detailedIncidenceExportService');
            // @ts-ignore - Temporary until service is updated
            await exportService.generatePayrollExport(exportStartDate, exportEndDate, operarios);
        } catch (error: any) {
            logger.error('Error al generar Excel:', error);
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
        isLongRange,
        computedDepartments: Array.from(new Set(operarios.map(op => op.DescDepartamento).filter(Boolean))).sort(),
        employeeCalendarsByDate,
        setEmployeeCalendarsByDate,
        isFetchingCalendars,
        lastUpdated: dataUpdatedAt || null,
        refetchActiveSickLeaves
    };
};
