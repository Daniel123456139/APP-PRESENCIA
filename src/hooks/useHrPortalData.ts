import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RawDataRow, ProcessedDataRow, Role, Shift, SickLeave, CompanyHoliday, BlogPost, FutureAbsence, IncidentLogEntry } from '../types';
import { useErpDataState, useErpDataActions } from '../store/erpDataStore';
import { useNotification } from '../components/shared/NotificationContext';
import { fetchFichajes } from '../services/apiService';
import { CalendarioDia, getCalendarioEmpresa, getCalendarioOperario } from '../services/erpApi';
import { toISODateLocal } from '../utils/localDate';
import { useAutoRefresh } from './useAutoRefresh';
import { useOperarios } from './useErp';
import { useProcessDataWorker } from './useProcessDataWorker';
import { processData } from '../services/dataProcessor';
import { exportDetailedIncidenceToXlsx } from '../services/exports/detailedIncidenceExportService';
import { exportFreeHoursToXlsx } from '../services/exports/freeHoursExportService';

export interface UseHrPortalDataProps {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    shifts: Shift[];
    companyHolidays: CompanyHoliday[];
    incidentLog: IncidentLogEntry[];
    setIncidentLog: React.Dispatch<React.SetStateAction<IncidentLogEntry[]>>;
    includeAbsencesInResumen?: boolean;
}

// LOGICAL WORK DAY: 05:00 AM current day to 04:59 AM next day?
// Or better: Fetch Range covers next morning (09:00).
// Analysis Range matches Calendar Days.

const LOGICAL_START_TIME = '06:00'; // Start of early shift
const LOGICAL_END_TIME = '09:00';   // End of NEXT day margin for night shift

export const useHrPortalData = ({
    startDate,
    endDate,
    startTime,
    endTime,
    shifts,
    companyHolidays,
    incidentLog,
    setIncidentLog,
    includeAbsencesInResumen = false
}: UseHrPortalDataProps) => {
    // ... context ...
    const { erpData } = useErpDataState();
    const { setErpData } = useErpDataActions();
    const { showNotification } = useNotification();
    const { operarios } = useOperarios(true);

    const [isReloading, setIsReloading] = useState(false);
    const [activeSickLeavesRaw, setActiveSickLeavesRaw] = useState<RawDataRow[]>([]);
    const [effectiveCalendarDays, setEffectiveCalendarDays] = useState<CalendarioDia[]>([]);
    const [employeeCalendarsByDate, setEmployeeCalendarsByDate] = useState<Map<number, Map<string, CalendarioDia>>>(new Map());

    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [turno, setTurno] = useState('all');

    // Settings (performance mode)
    const [settings] = useState(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : { sistema: { modoRendimiento: false } };
    });
    const performanceMode = settings.sistema?.modoRendimiento;

    // --- Auto Refresh Sync ---
    const { isRefetching, lastUpdated, error, manualRefresh } = useAutoRefresh(startDate, endDate, setErpData, { enabled: true, intervalMs: 120000 });

    const analysisRange = useMemo(() => {
        // Effective Analysis Range for PROCESSING
        // Use user-provided limits for filtering displayed ENTRIES
        const start = new Date(`${startDate}T${startTime}:00`);
        const end = new Date(`${endDate}T${endTime}:59`);
        return { start, end };
    }, [startDate, endDate, startTime, endTime]);

    const companyHolidaySet = useMemo(() => {
        return new Set(companyHolidays.map(h => h.date));
    }, [companyHolidays]);

    const employeeOptions = useMemo(() => {
        return operarios.map(op => ({
            id: op.IDOperario,
            name: op.DescOperario,
            role: op.DescDepartamento === 'Dirección' ? Role.Management : Role.Employee,
            department: op.DescDepartamento || 'General',
            productivo: op.Productivo
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [operarios]);

    const { result: workerResult } = useProcessDataWorker(
        performanceMode ? erpData : [],
        employeeOptions,
        performanceMode ? analysisRange : undefined,
        performanceMode ? companyHolidaySet : undefined
    );

    const { datasetResumen, datasetAusencias } = useMemo(() => {
        // Construir mapa de calendarios: Map<employeeId, Map<date, TipoDia>>
        const employeeCalendarMap = new Map<number, Map<string, number>>();

        // Convertir employeeCalendarsByDate a Map<employeeId, Map<date, TipoDia>>
        employeeCalendarsByDate.forEach((dateMap, empId) => {
            const tipoDiaMap = new Map<string, number>();
            dateMap.forEach((calDay, fecha) => {
                const tipoDia = calDay.TipoDia === '0' ? 0 : (calDay.TipoDia === '1' ? 1 : 2);
                tipoDiaMap.set(fecha, tipoDia);
            });
            employeeCalendarMap.set(empId, tipoDiaMap);
        });

        let processed: ProcessedDataRow[] = [];
        if (performanceMode) {
            processed = workerResult;
        } else {
            processed = processData(erpData, employeeOptions, undefined, analysisRange, companyHolidaySet, employeeCalendarMap);
        }

        if (selectedEmployeeIds.length > 0) {
            const ids = new Set(selectedEmployeeIds.map(id => parseInt(id, 10)));
            processed = processed.filter(p => ids.has(p.operario));
        } else if (selectedDepartment !== 'all') {
            processed = processed.filter(p => p.colectivo === selectedDepartment);
        }

        if (turno !== 'all') {
            processed = processed.filter(p => p.turnoAsignado === turno);
        }

        const resumen: ProcessedDataRow[] = [];
        const ausencias: ProcessedDataRow[] = [];
        const sickLeaveEmployeeIds = new Set<number>();
        erpData.forEach(r => {
            if (r.MotivoAusencia === 10 || r.MotivoAusencia === 11) {
                sickLeaveEmployeeIds.add(r.IDOperario);
            }
        });

        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const isShortRange = diffDays <= 1;

        processed.forEach(p => {
            // Skip employees with sick leaves completely (don't show in any table)
            if (!includeAbsencesInResumen && sickLeaveEmployeeIds.has(p.operario)) return;

            // ENTIRELY ABSENT check:
            // They are absent if they have 0 presence AND no justified hours in the window
            const hasPresence = (p.totalHoras + p.horasJustificadas + p.hTAJ) > 0 || (p.timeSlices && p.timeSlices.length > 0);
            const isTotalAbsence = !hasPresence;

            // EXCLUSIÓN POR VACACIONES:
            // Solo excluimos de las tablas de presencia/ausencia si el empleado está TOTALMENTE ausente 
            // y tiene vacaciones (TipoDia=2) en el rango. Si trabajó algún día, debe aparecer.
            // EXCLUSIÓN POR VACACIONES:
            // Solo excluimos de las tablas de presencia/ausencia si el empleado está TOTALMENTE ausente 
            // y tiene vacaciones (TipoDia=2) en el rango usando el mapa de calendarios REAL.
            let hasVacationInRange = false;

            // Verificar primero en el mapa de calendarios cargado explícitamente
            if (employeeCalendarMap.has(p.operario)) {
                const empDates = employeeCalendarMap.get(p.operario)!;
                // Verificar si algún día en el rango tiene TipoDia=2 (Vacaciones)
                // Iteramos por los días del análisis actual
                const iterDate = new Date(startDate);
                const endDateObj = new Date(endDate);

                while (iterDate <= endDateObj) {
                    const dStr = toISODateLocal(iterDate);
                    if (empDates.get(dStr) === 2) {
                        hasVacationInRange = true;
                        break;
                    }
                    iterDate.setDate(iterDate.getDate() + 1);
                }
            } else {
                // Fallback a erpData solo si no hay calendario cargado (aunque debería haber)
                hasVacationInRange = erpData.some(r =>
                    r.IDOperario === p.operario &&
                    r.TipoDiaEmpresa === 2 &&
                    r.Fecha >= startDate &&
                    r.Fecha <= endDate
                );
            }

            if (!includeAbsencesInResumen && isTotalAbsence && hasVacationInRange) return;

            // Logic for Tables:
            if (isTotalAbsence) {
                // If totally absent, they definitely go to Ausencias
                ausencias.push(p);

                // If it's a long range, we might still want them in the main table to see the absence count
                // But for short ranges, we only want them in Ausencias
                if (!isShortRange) {
                    resumen.push(p);
                }
            } else {
                // If they HAVE presence, they belong in Resumen
                resumen.push(p);

                // If they have *some* absent days in a long range, we show them in Ausencias too
                const hasPartialAbsence = p.absentDays && p.absentDays.length > 0;
                if (!isShortRange && hasPartialAbsence) {
                    ausencias.push(p);
                }
            }
        });

        return { datasetResumen: resumen, datasetAusencias: ausencias };
    }, [erpData, shifts, performanceMode, workerResult, selectedEmployeeIds, selectedDepartment, turno, analysisRange, companyHolidaySet, startDate, endDate, effectiveCalendarDays, employeeCalendarsByDate]);

    // Calendar Specific Logic
    const lastFetchParams = useRef<string>('');
    const calendarAbortController = useRef<AbortController | null>(null);

    useEffect(() => {
        const fetchParams = `${startDate}|${endDate}|${operarios.length}`;
        if (lastFetchParams.current === fetchParams) return;

        const updateCalendar = async () => {
            if (operarios.length === 0) return;

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

                // 🚀 BATCH FETCHING (Limit concurrency to avoid ERR_INSUFFICIENT_RESOURCES)
                const batchSize = 10;
                for (let i = 0; i < allActiveOperatorIds.length; i += batchSize) {
                    const batch = allActiveOperatorIds.slice(i, i + batchSize);
                    const batchPromises = batch.map(id =>
                        getCalendarioOperario(id.toString(), startDate, endDate)
                            .then(cal => ({ id, cal }))
                            .catch(err => {
                                console.warn(`Could not fetch calendar for employee ${id}:`, err);
                                return { id, cal: [] as CalendarioDia[] };
                            })
                    );

                    const batchResults = await Promise.all(batchPromises);
                    results.push(...batchResults);
                }

                // Crear mapa por empleado
                const empCalMap = new Map<number, Map<string, CalendarioDia>>();
                results.forEach(({ id, cal }) => {
                    const dateMap = new Map<string, CalendarioDia>();
                    cal.forEach(day => {
                        const cleanDate = day.Fecha.includes('T') ? day.Fecha.split('T')[0] : day.Fecha;
                        dateMap.set(cleanDate, day);
                    });
                    empCalMap.set(id, dateMap);
                });

                setEmployeeCalendarsByDate(empCalMap);

                // Mapa global combinado
                const flat = results.flatMap(r => r.cal);
                const mergedMap = new Map<string, CalendarioDia>();
                flat.forEach(day => {
                    const existing = mergedMap.get(day.Fecha);
                    if (!existing || day.TipoDia === '1') {
                        mergedMap.set(day.Fecha, day);
                    }
                });

                setEffectiveCalendarDays(Array.from(mergedMap.values()));
                lastFetchParams.current = fetchParams;
            } catch (e) {
                if ((e as Error).name !== 'AbortError') {
                    console.error("❌ Error fetching calendars:", e);
                }
            }
        };

        updateCalendar();

        return () => {
            if (calendarAbortController.current) {
                calendarAbortController.current.abort();
            }
        };
    }, [operarios, startDate, endDate]);

    const selectedEmployeeData = useMemo(() => {
        if (selectedEmployeeIds.length !== 1) return undefined;
        const id = parseInt(selectedEmployeeIds[0], 10);
        let source: ProcessedDataRow[] = [];
        if (performanceMode) {
            source = workerResult;
        } else {
            source = processData(erpData, employeeOptions, undefined, analysisRange, companyHolidaySet);
        }
        return source.find(p => p.operario === id);
    }, [selectedEmployeeIds, performanceMode, workerResult, erpData, employeeOptions, shifts, analysisRange, companyHolidaySet]);

    const isLongRange = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > 2;
    }, [startDate, endDate]);

    const fetchActiveSickLeaves = useCallback(async () => {
        try {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const data = await fetchFichajes(toISODateLocal(startOfYear), toISODateLocal(now), '', '00:00', '23:59');
            setActiveSickLeavesRaw(data);
        } catch (err) {
            console.error("Error fetching active sick leaves", err);
        }
    }, []);

    const reloadFromServer = async () => {
        if (startDate > endDate) {
            showNotification('La fecha de inicio no puede ser posterior a la fecha de fin.', 'error');
            return;
        }
        setIsReloading(true);
        try {
            // EXACT FETCH STRATEGY:
            // Use user's selected start and end times exactly.

            // console.log(`[Reload] Fetching Range: ${startDate} ${startTime} to ${endDate} ${endTime}`);

            const serverData = await fetchFichajes(
                startDate,
                endDate,
                '',
                startTime,
                endTime
            );
            setErpData(serverData);
            showNotification(`Datos actualizados: ${serverData.length} registros cargados.`, 'success');
        } catch (error: unknown) {
            if (error instanceof Error) {
                showNotification(`Error al cargar datos: ${error.message}`, 'error');
            }
        } finally {
            setIsReloading(false);
        }
    };

    // Auto-reload when filter dates or times change
    const [prevFilters, setPrevFilters] = useState({ startDate: '', endDate: '', startTime: '', endTime: '' });
    useEffect(() => {
        const filtersChanged =
            prevFilters.startDate !== startDate ||
            prevFilters.endDate !== endDate ||
            prevFilters.startTime !== startTime ||
            prevFilters.endTime !== endTime;

        if (filtersChanged) {
            // console.log('[HrPortalData] Filters changed, auto-reloading data');
            reloadFromServer();
            setPrevFilters({ startDate, endDate, startTime, endTime });
        }
    }, [startDate, endDate, startTime, endTime, prevFilters]);

    const handleFreeHoursExport = async (section: string, filterEmployeeIds: string[]) => {
        showNotification('Generando Excel de Horas Libres...', 'info');
        try {
            const currentYear = new Date().getFullYear();
            const ytdEnd = `${currentYear}-12-31`;
            const ytdRaw = await fetchFichajes(`${currentYear}-01-01`, ytdEnd, '', '00:00', '23:59');
            let targetUsers = employeeOptions;
            if (filterEmployeeIds.length > 0) {
                const idSet = new Set(filterEmployeeIds.map(id => parseInt(id, 10)));
                targetUsers = employeeOptions.filter(u => idSet.has(u.id));
            } else if (section !== 'all') {
                const idSet = new Set(ytdRaw.filter(r => r.DescDepartamento === section).map(r => r.IDOperario));
                targetUsers = employeeOptions.filter(u => idSet.has(u.id));
            }
            exportFreeHoursToXlsx(ytdRaw, targetUsers, ytdEnd);
            showNotification('Exportación de Horas Libres completada.', 'success');
        } catch (error: unknown) {
            if (error instanceof Error) showNotification(`Error: ${error.message}`, 'error');
        }
    };

    const handleExport = async (range?: { startDate: string; endDate: string }) => {
        const exportStartDate = range?.startDate ?? startDate;
        const exportEndDate = range?.endDate ?? endDate;
        showNotification('Generando Excel de Nóminas...', 'info');
        try {
            const currentYear = new Date(exportEndDate).getFullYear();
            const ytdStart = `${currentYear}-01-01`;
            const ytdEnd = `${currentYear}-12-31`;
            const ytdData = await fetchFichajes(ytdStart, ytdEnd, '', '00:00', '23:59');
            const periodRawData = await fetchFichajes(exportStartDate, exportEndDate, '', '00:00', '23:59');
            const exportAnalysisRange = {
                start: new Date(`${exportStartDate}T00:00:00`),
                end: new Date(`${exportEndDate}T23:59:59`)
            };
            const processedFull = processData(periodRawData, employeeOptions, undefined, exportAnalysisRange, companyHolidaySet);

            // ═══════════════════════════════════════════════════════════════════
            // NUEVO: Usar función con calendario por empleado
            // ═══════════════════════════════════════════════════════════════════
            // console.log('📅 [Excel] Usando buildDetailedIncidenceRowsWithCalendar...');
            const { buildDetailedIncidenceRowsWithCalendar } = await import('../services/exports/detailedIncidenceExportService');
            const exportRows = await buildDetailedIncidenceRowsWithCalendar(
                processedFull,
                periodRawData,
                ytdData,
                employeeOptions,
                exportStartDate,
                exportEndDate
            );

            exportDetailedIncidenceToXlsx(exportRows, `Base_Nominas_${exportStartDate}_${exportEndDate}.xlsx`, exportStartDate, exportEndDate);
            showNotification('Exportación a Excel completada.', 'success');
        } catch (error: unknown) {
            if (error instanceof Error) showNotification(`Error al generar Excel: ${error.message}`, 'error');
        }
    };

    const computedDepartments = useMemo(() => {
        const depts = new Set<string>();
        erpData.forEach(row => {
            if (row.DescDepartamento) depts.add(row.DescDepartamento);
        });
        return Array.from(depts).sort();
    }, [erpData]);

    const departmentFilteredEmployees = useMemo(() => {
        if (selectedDepartment === 'all') return employeeOptions;
        return employeeOptions.filter(e => e.department === selectedDepartment);
    }, [selectedDepartment, employeeOptions]);

    const shouldUseVirtualization = performanceMode || datasetResumen.length > 50;

    return {
        erpData,
        datasetResumen,
        datasetAusencias,
        employeeOptions,
        activeSickLeavesRaw,
        effectiveCalendarDays,
        selectedEmployeeData,
        isReloading,
        isRefetching,
        lastUpdated,
        refreshError: error,
        manualRefresh,
        selectedDepartment,
        setSelectedDepartment,
        selectedEmployeeIds,
        setSelectedEmployeeIds,
        turno,
        setTurno,
        reloadFromServer,
        handleExport,
        handleFreeHoursExport,
        fetchActiveSickLeaves,
        isLongRange,
        performanceMode,
        companyHolidaySet,
        analysisRange,
        setEffectiveCalendarDays,
        computedDepartments,
        departmentFilteredEmployees,
        shouldUseVirtualization,
        employeeCalendarsByDate
    };
};
