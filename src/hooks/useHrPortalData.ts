import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RawDataRow, ProcessedDataRow, Role, Shift, SickLeave, CompanyHoliday, BlogPost, FutureAbsence, IncidentLogEntry } from '../types';
import { useErpDataState, useErpDataActions } from '../store/erpDataStore';
import { useNotification } from '../components/shared/NotificationContext';
import { fetchFichajes, fetchFichajesBatched } from '../services/apiService';
import { fetchSyntheticPunches, SyntheticPunchParams } from '../services/firestoreService';
import { CalendarioDia, getCalendarioEmpresa, getCalendarioOperario } from '../services/erpApi';
import { groupRawDataToLeaves } from '../services/leaveService';
import { SickLeaveMetadataService } from '../services/sickLeaveMetadataService';
import { useAutoRefresh } from './useAutoRefresh';
import { useOperarios } from './useErp';
import { useProcessDataWorker } from './useProcessDataWorker';
import { processData } from '../services/dataProcessor';
import { exportDetailedIncidenceToXlsx } from '../services/exports/detailedIncidenceExportService';
import { exportFreeHoursToXlsx } from '../services/exports/freeHoursExportService';
import { toISODateLocal } from '../utils/localDate';


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
    const { erpData, lastUpdated: erpLastUpdated } = useErpDataState();
    const { setErpData } = useErpDataActions();
    const { showNotification } = useNotification();
    const { operarios } = useOperarios(true);

    const [isReloading, setIsReloading] = useState(false);
    const [activeSickLeavesRaw, setActiveSickLeavesRaw] = useState<RawDataRow[]>([]);
    const [effectiveCalendarDays, setEffectiveCalendarDays] = useState<CalendarioDia[]>([]);
    const [employeeCalendarsByDate, setEmployeeCalendarsByDate] = useState<Map<number, Map<string, CalendarioDia>>>(new Map());

    // Synthetic Punches State
    const [syntheticPunches, setSyntheticPunches] = useState<Map<string, SyntheticPunchParams>>(new Map());
    const [isFetchingSynthetic, setIsFetchingSynthetic] = useState(false);

    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [turno, setTurno] = useState('all');

    const appliedRange = useMemo(() => ({
        startDate,
        endDate,
        startTime,
        endTime
    }), [startDate, endDate, startTime, endTime]);

    // Settings (performance mode)
    const [settings] = useState(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : { sistema: { modoRendimiento: false } };
    });
    const performanceMode = settings.sistema?.modoRendimiento;

    const appliedRangeDays = useMemo(() => {
        try {
            const start = new Date(`${appliedRange.startDate}T00:00:00`);
            const end = new Date(`${appliedRange.endDate}T23:59:59`);
            const diffMs = Math.abs(end.getTime() - start.getTime());
            return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        } catch {
            return 0;
        }
    }, [appliedRange]);

    const effectivePerformanceMode = performanceMode;

    // --- Auto Refresh Sync ---
    const { isRefetching, lastUpdated, error, manualRefresh } = useAutoRefresh(
        appliedRange.startDate,
        appliedRange.endDate,
        setErpData,
        { enabled: true, intervalMs: 120000 }
    );

    const analysisRange = useMemo(() => {
        // Effective Analysis Range for PROCESSING
        // For long ranges, always analyze full days to avoid partial filters
        // For short ranges (1-2 days), if times are 00:00, default to full day
        const isDefaultTime = appliedRange.startTime === '00:00' && appliedRange.endTime === '00:00';

        const startTimeValue = (appliedRangeDays > 2 || isDefaultTime) ? '00:00' : appliedRange.startTime;
        const endTimeValue = (appliedRangeDays > 2 || isDefaultTime) ? '23:59' : appliedRange.endTime;

        const start = new Date(`${appliedRange.startDate}T${startTimeValue}:00`);
        const end = new Date(`${appliedRange.endDate}T${endTimeValue}:59`);
        return { start, end };
    }, [appliedRange, appliedRangeDays]);

    const normalizeCalendarDate = (value?: string) => {
        if (!value) return '';
        const clean = String(value).trim();
        if (clean.includes('T')) return clean.split('T')[0];
        if (clean.includes(' ')) return clean.split(' ')[0];
        return clean;
    };

    const companyHolidaySet = useMemo(() => {
        if (effectiveCalendarDays && effectiveCalendarDays.length > 0) {
            const fromCalendar = effectiveCalendarDays
                .filter(d => String(d.TipoDia) === '1')
                .map(d => normalizeCalendarDate(d.Fecha))
                .filter(Boolean);
            return new Set(fromCalendar);
        }
        return new Set(companyHolidays.map(h => normalizeCalendarDate(h.date)).filter(Boolean));
    }, [companyHolidays, effectiveCalendarDays]);

    useEffect(() => {
        let cancelled = false;

        const fetchCompanyCalendar = async () => {
            if (!appliedRange.startDate || !appliedRange.endDate) return;
            try {
                const data = await getCalendarioEmpresa(appliedRange.startDate, appliedRange.endDate);
                if (cancelled) return;
                const normalized = data.map(day => ({
                    ...day,
                    Fecha: normalizeCalendarDate(day.Fecha)
                }));
                setEffectiveCalendarDays(normalized);
            } catch (error) {
                if (!cancelled) {
                    console.error('❌ Error fetching company calendar:', error);
                }
            }
        };

        fetchCompanyCalendar();

        return () => {
            cancelled = true;
        };
    }, [appliedRange.startDate, appliedRange.endDate]);

    // FETCH SYNTHETIC PUNCHES
    useEffect(() => {
        let cancelled = false;

        const loadSynthetic = async () => {
            // Only fetch if we have a valid range
            if (!appliedRange.startDate || !appliedRange.endDate) return;

            setIsFetchingSynthetic(true);
            try {
                const punches = await fetchSyntheticPunches(appliedRange.startDate, appliedRange.endDate);
                if (!cancelled) {
                    setSyntheticPunches(punches);
                }
            } catch (err) {
                console.error("Error loading synthetic punches:", err);
            } finally {
                if (!cancelled) setIsFetchingSynthetic(false);
            }
        };

        loadSynthetic();

        return () => { cancelled = true; };
    }, [appliedRange.startDate, appliedRange.endDate, erpLastUpdated]); // Refetch when ERP updates too, to keep in sync if needed

    const employeeOptions = useMemo(() => {
        return operarios.map(op => ({
            id: op.IDOperario,
            name: op.DescOperario,
            role: op.DescDepartamento === 'Dirección' ? Role.Management : Role.Employee,
            department: op.DescDepartamento || 'General',
            productivo: op.Productivo,
            flexible: op.Flexible
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [operarios]);

    const employeeCalendarMap = useMemo(() => {
        const map = new Map<number, Map<string, number>>();
        employeeCalendarsByDate.forEach((dateMap, empId) => {
            const tipoDiaMap = new Map<string, number>();
            dateMap.forEach((calDay, fecha) => {
                const rawTipo = typeof calDay.TipoDia === 'number'
                    ? calDay.TipoDia
                    : parseInt(calDay.TipoDia, 10);
                const tipoDia = rawTipo === 0 ? 0 : (rawTipo === 1 ? 1 : 2);
                tipoDiaMap.set(fecha, tipoDia);
            });
            map.set(empId, tipoDiaMap);
        });
        return map;
    }, [employeeCalendarsByDate]);

    const serializedEmployeeCalendars = useMemo(() => {
        const obj: Record<number, Record<string, number>> = {};
        employeeCalendarMap.forEach((dateMap, empId) => {
            const dateObj: Record<string, number> = {};
            dateMap.forEach((tipo, fecha) => {
                dateObj[fecha] = tipo;
            });
            obj[empId] = dateObj;
        });
        return obj;
    }, [employeeCalendarMap]);

    const calendarsKey = useMemo(() => {
        return `${appliedRange.startDate}|${appliedRange.endDate}|${employeeCalendarMap.size}`;
    }, [appliedRange, employeeCalendarMap]);

    const usersKey = useMemo(() => {
        return employeeOptions.map(emp => `${emp.id}:${emp.flexible ? '1' : '0'}`).join('|');
    }, [employeeOptions]);

    // MERGE ERP DATA WITH SYNTHETIC PUNCHES
    const augmentedErpData = useMemo(() => {
        return mergeSyntheticData(erpData, syntheticPunches, employeeOptions);
    }, [erpData, syntheticPunches, employeeOptions]);

    const { result: workerResult } = useProcessDataWorker(
        augmentedErpData,
        employeeOptions,
        analysisRange,
        companyHolidaySet,
        erpLastUpdated,
        serializedEmployeeCalendars,
        calendarsKey,
        usersKey
    );

    // DEBUG: Trace data flow
    useEffect(() => {
        console.log(`📡 [useHrPortalData] erpData updated. Length: ${erpData.length}. Augmented: ${augmentedErpData.length}. Synths: ${syntheticPunches.size}`);
    }, [erpData, augmentedErpData, syntheticPunches]);

    useEffect(() => {
        console.log(`⚙️ [useHrPortalData] WorkerResult updated. Length: ${workerResult.length}`);
    }, [workerResult]);


    const { datasetResumen, datasetAusencias } = useMemo(() => {
        // OPTIMIZATION: Index erpData by employee and date for O(1) lookups
        // Key: "empId:dateStr"
        const punchLookup = new Map<string, boolean>();
        const datesWithAnyPunch = new Set<string>(); // For O(1) date check
        const vacationLookup = new Map<string, boolean>(); // TipoDiaEmpresa === 2

        erpData.forEach(r => {
            const dateStr = r.Fecha ? r.Fecha.split('T')[0] : '';
            if (!dateStr || !r.IDControlPresencia || r.IDControlPresencia <= 0) return;

            datesWithAnyPunch.add(dateStr);
            const key = `${r.IDOperario}:${dateStr}`;
            punchLookup.set(key, true);

            if (r.TipoDiaEmpresa === 2) {
                vacationLookup.set(key, true);
            }
        });

        // PRE-FILTER: Determine valid employee IDs first
        let validEmployeeIds = new Set<number>();
        let isFiltered = false;

        if (selectedEmployeeIds.length > 0) {
            selectedEmployeeIds.forEach(id => validEmployeeIds.add(parseInt(id, 10)));
            isFiltered = true;
        } else if (selectedDepartment !== 'all') {
            employeeOptions
                .filter(e => e.department === selectedDepartment)
                .forEach(e => validEmployeeIds.add(e.id));
            isFiltered = true;
        }

        // OPTIMIZATION: Filter Raw Data & Options BEFORE Processing
        let filteredErpData = erpData;
        let filteredEmployeeOptions = employeeOptions;

        if (isFiltered) {
            filteredErpData = erpData.filter(row => validEmployeeIds.has(row.IDOperario));
            filteredEmployeeOptions = employeeOptions.filter(e => validEmployeeIds.has(e.id));
        }

        let processed: ProcessedDataRow[] = workerResult;

        if (selectedEmployeeIds.length > 0) {
            // Additional safety filter if worker returned everything
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

        const appliedStartDate = appliedRange.startDate;
        const appliedEndDate = appliedRange.endDate;

        // REGLA CRÍTICA: Identificar empleados con bajas médicas activas
        // Estos empleados NO deben aparecer en la tabla de "Ausencias" porque ya aparecen en "Bajas Activas"
        // 🔧 FIX: Usar activeSickLeavesRaw CON VERIFICACIÓN DE VIGENCIA
        // Solo excluir empleados si tienen una baja ACTIVA (sin fecha fin o fecha fin futura)

        const sickLeaveEmployeeIds = new Set<number>();

        // Agrupar filas raw en rangos lógicos
        const leaves = groupRawDataToLeaves(activeSickLeavesRaw);
        const todayStr = toISODateLocal(new Date());

        leaves.forEach(l => {
            if (l.motivoId === 10 || l.motivoId === 11) {
                // Verificar metadatos de cierre
                const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);

                // Una baja es ACTIVA si NO tiene fecha de alta O la fecha de alta es futura
                const isActive = !meta?.dischargeDate || meta.dischargeDate > todayStr;

                if (isActive) {
                    sickLeaveEmployeeIds.add(l.employeeId);
                }
            }
        });

        // console.log('🔍 DEBUG active sick leaves filtered:', Array.from(sickLeaveEmployeeIds));

        const start = new Date(appliedStartDate);
        const end = new Date(appliedEndDate);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const isShortRange = diffDays <= 1;

        let hasWorkingDayInRange = false;
        const rangeIter = new Date(appliedStartDate);
        const rangeEnd = new Date(appliedEndDate);
        while (rangeIter <= rangeEnd) {
            const dayOfWeek = rangeIter.getDay();
            const dateStr = toISODateLocal(rangeIter);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = companyHolidaySet.has(dateStr);
            if (!isWeekend && !isHoliday) {
                hasWorkingDayInRange = true;
                break;
            }
            // NUEVO: Si hay fichajes en este día (aunque sea fin de semana), también lo contamos como procesable
            // OPTIMIZATION: Check if ANY employee has punches on this specific date (O(1))
            const dayHasPunches = datesWithAnyPunch.has(dateStr);
            if (dayHasPunches) {
                hasWorkingDayInRange = true;
                break;
            }
            rangeIter.setDate(rangeIter.getDate() + 1);
        }

        processed.forEach(p => {
            // NUEVA REGLA: Excluir empleados con bajas médicas de TODAS las tablas
            // Estos empleados se gestionan exclusivamente en la tabla "Bajas Activas"
            if (sickLeaveEmployeeIds.has(p.operario)) {
                // No aparecen ni en resumen ni en ausencias
                return;
            }

            // ENTIRELY ABSENT check:
            // They are absent if they have 0 presence AND no justified hours in the window
            const hasPresence = (p.totalHoras + p.horasJustificadas + p.hTAJ) > 0 || (p.timeSlices && p.timeSlices.length > 0);
            const isTotalAbsence = !hasPresence;

            // EXCLUSIÓN POR VACACIONES:
            // Solo excluimos de las tablas de presencia/ausencia si el empleado está TOTALMENTE ausente 
            // y tiene vacaciones (TipoDia=2) en el rango usando el mapa de calendarios REAL.
            let hasVacationInRange = false;

            // Verificar primero en el mapa de calendarios cargado explícitamente
            if (employeeCalendarMap.has(p.operario)) {
                const empDates = employeeCalendarMap.get(p.operario)!;
                // Verificar si algún día en el rango tiene TipoDia=2 (Vacaciones)
                // Iteramos por los días del análisis actual
                const iterDate = new Date(appliedStartDate);
                const endDateObj = new Date(appliedEndDate);

                while (iterDate <= endDateObj) {
                    const dStr = toISODateLocal(iterDate);
                    if (empDates.get(dStr) === 2) {
                        hasVacationInRange = true;
                        break;
                    }
                    iterDate.setDate(iterDate.getDate() + 1);
                }
            } else {
                // FALLBACK: Use pre-indexed vacation lookup
                hasVacationInRange = false;
                const iter = new Date(appliedStartDate);
                const endIter = new Date(appliedEndDate);
                while (iter <= endIter) {
                    const dStr = toISODateLocal(iter);
                    if (vacationLookup.get(`${p.operario}:${dStr}`)) {
                        hasVacationInRange = true;
                        break;
                    }
                    iter.setDate(iter.getDate() + 1);
                }
            }

            // Excluir empleados totalmente ausentes con vacaciones
            if (isTotalAbsence && hasVacationInRange) return;

            // Logic for Tables:
            if (isTotalAbsence) {
                if (!hasWorkingDayInRange) {
                    resumen.push(p);
                    return;
                }
                // If totally absent (and NOT on sick leave or vacation), they go to Ausencias
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
    }, [erpData, shifts, effectivePerformanceMode, workerResult, selectedEmployeeIds, selectedDepartment, turno, analysisRange, companyHolidaySet, appliedRange, effectiveCalendarDays, employeeCalendarsByDate, activeSickLeavesRaw]);

    // Calendar Specific Logic
    const lastFetchParams = useRef<string>('');
    const calendarAbortController = useRef<AbortController | null>(null);

    useEffect(() => {
        const fetchParams = `${appliedRange.startDate}|${appliedRange.endDate}|${operarios.length}`;

        // Prevent re-running if params identical to last SUCCESSFUL or ATTEMPTED run
        // We update the ref immediately to prevent loop if re-render happens during fetch
        if (lastFetchParams.current === fetchParams) return;
        lastFetchParams.current = fetchParams;

        // Debounce small delays (e.g. rapid date changes)
        const timer = setTimeout(() => {
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
                    const batchSize = 6;

                    for (let i = 0; i < allActiveOperatorIds.length; i += batchSize) {
                        if (calendarAbortController.current?.signal.aborted) break;

                        const batch = allActiveOperatorIds.slice(i, i + batchSize);
                        const batchPromises = batch.map(id =>
                            getCalendarioOperario(id.toString(), appliedRange.startDate, appliedRange.endDate)
                                .then(cal => ({ id, cal }))
                                .catch(err => {
                                    // Silent fail for aborts, warn for others
                                    if (err.name !== 'AbortError') {
                                        console.warn(`Could not fetch calendar for employee ${id}:`, err);
                                    }
                                    return { id, cal: [] as CalendarioDia[] };
                                })
                        );

                        const batchResults = await Promise.all(batchPromises);
                        results.push(...batchResults);

                        if (i + batchSize < allActiveOperatorIds.length) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }

                    if (calendarAbortController.current?.signal.aborted) return;

                    // Crear mapa por empleado
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

                    console.log(`📅 Employee calendars updated for ${appliedRange.startDate}`);
                } catch (e) {
                    if ((e as Error).name !== 'AbortError') {
                        console.error("❌ Error fetching calendars:", e);
                    }
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
    }, [operarios, appliedRange]);

    const selectedEmployeeData = useMemo(() => {
        if (selectedEmployeeIds.length !== 1) return undefined;
        const id = parseInt(selectedEmployeeIds[0], 10);
        const source: ProcessedDataRow[] = workerResult;
        return source.find(p => p.operario === id);
    }, [selectedEmployeeIds, effectivePerformanceMode, workerResult, erpData, employeeOptions, shifts, analysisRange, companyHolidaySet]);

    const isLongRange = useMemo(() => {
        const start = new Date(appliedRange.startDate);
        const end = new Date(appliedRange.endDate);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > 2;
    }, [appliedRange]);

    const fetchActiveSickLeaves = useCallback(async () => {
        try {
            const now = new Date();
            // Optimización: Solo buscar bajas en los últimos 45 días para evitar descargar 
            // todo el año de fichajes en cada refresco.
            const searchStart = new Date(now);
            searchStart.setDate(now.getDate() - 45);

            const data = await fetchFichajes(toISODateLocal(searchStart), toISODateLocal(now), '', '00:00', '23:59');
            setActiveSickLeavesRaw(data);
        } catch (err) {
            console.error("Error fetching active sick leaves", err);
        }
    }, [toISODateLocal]);

    const normalizeDateStr = (value: string): string | null => {
        if (!value) return null;
        let clean = String(value).trim();

        // Remove time/T part if present (e.g. 2026-02-01T00:00:00 -> 2026-02-01)
        if (clean.includes('T')) clean = clean.split('T')[0];
        if (clean.includes(' ')) clean = clean.split(' ')[0];

        // 1. Check YYYY-MM-DD (ISO) - Standard HTML5 input type="date"
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
            return clean;
        }

        // 2. Check DD/MM/YYYY (common in Spain/Manual Input)
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
            const [d, m, y] = clean.split('/');
            return `${y}-${m}-${d}`;
        }

        // 3. Fallback: try generic Date parsing
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
        return null; // Totally invalid
    };

    const reloadFromServer = useCallback(async (rangeOverride?: { startDate: string; endDate: string; startTime: string; endTime: string } | any) => {
        // FIX: Handle case where function is called from onClick (passing an Event object)
        const isValidRangeObj = rangeOverride && typeof rangeOverride === 'object' && 'startDate' in rangeOverride && typeof rangeOverride.startDate === 'string';
        const rawRange = isValidRangeObj ? rangeOverride : { startDate, endDate, startTime, endTime };

        const validStart = normalizeDateStr(rawRange.startDate);
        const validEnd = normalizeDateStr(rawRange.endDate);

        if (!validStart || !validEnd) {
            // Log params separately to avoid [Object] in console and help debugging
            console.error("❌ Invalid Date Range Detected. Start:", rawRange.startDate, "End:", rawRange.endDate, "Raw:", rawRange);
            showNotification(`Rango de fechas inválido (Start: ${rawRange.startDate}, End: ${rawRange.endDate})`, 'error');
            return;
        }

        const range = {
            ...rawRange,
            startDate: validStart,
            endDate: validEnd
        };
        if (range.startDate > range.endDate) {
            showNotification('La fecha de inicio no puede ser posterior a la fecha de fin.', 'error');
            return;
        }
        setIsReloading(true);
        try {
            // EXACT FETCH STRATEGY:
            // Use user's selected start and end times exactly.

            console.log(`🚀 [Reload] Fetching Range: ${range.startDate} ${startTime} to ${range.endDate} ${endTime}`);

            const rangeDays = Math.ceil(Math.abs(new Date(`${range.endDate}T23:59:59`).getTime() - new Date(`${range.startDate}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24));

            const fetchStartTime = '';
            const fetchEndTime = '';

            let serverData = rangeDays > 2
                ? await fetchFichajesBatched(
                    range.startDate,
                    range.endDate,
                    '',
                    fetchStartTime,
                    fetchEndTime
                )
                : await fetchFichajes(
                    range.startDate,
                    range.endDate,
                    '',
                    fetchStartTime,
                    fetchEndTime
                );

            if (serverData.length === 0) {
                // Retry logic or simplify?
                // The original code might have had retry logic too. I'll keep it simple as per original intent or re-add the retry part without buffer.
                // Actually, let's keep the retry if it was fetching same range.
                // But wait, the retry used same params in the viewed file... why? Maybe retry logic?
                // Let's just do the primary fetch clearly.
            }
            setErpData(serverData);
            showNotification(`Datos actualizados: ${serverData.length} registros cargados.`, 'success');
        } catch (error: unknown) {
            if (error instanceof Error) {
                showNotification(`Error al cargar datos: ${error.message}`, 'error');
            }
        } finally {
            setIsReloading(false);
        }
    }, [startDate, endDate, startTime, endTime, setErpData, showNotification]);

    // Simplified Auto-Reload Logic
    useEffect(() => {
        const nextRange = { startDate, endDate, startTime, endTime };

        // Validation
        if (!nextRange.startDate || !nextRange.endDate) return;
        if (nextRange.startDate > nextRange.endDate) return;

        // Debounce reload
        const timer = setTimeout(() => {
            reloadFromServer(nextRange);
        }, 600);

        return () => clearTimeout(timer);
    }, [startDate, endDate, startTime, endTime, reloadFromServer]);


    const handleFreeHoursExport = async (section: string, filterEmployeeIds: string[]) => {
        showNotification('Generando Excel de Horas Libres...', 'info');
        try {
            const currentYear = new Date().getFullYear();
            const ytdEnd = `${currentYear}-12-31`;
            const ytdRaw = await fetchFichajesBatched(`${currentYear}-01-01`, ytdEnd, '', '', '');
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
        const exportStartDate = (range?.startDate ?? startDate).trim().substring(0, 10);
        const exportEndDate = (range?.endDate ?? endDate).trim().substring(0, 10);

        showNotification('Generando Excel de Nóminas...', 'info');
        try {
            const currentYear = new Date(exportEndDate).getFullYear();
            const ytdStart = `${currentYear}-01-01`;
            const ytdEnd = `${currentYear}-12-31`;

            // Robust Fetching for YTD
            const ytdData = await fetchFichajesBatched(ytdStart, ytdEnd, '', '', '');

            // Robust Fetching for Period 
            // Use batched only if > 2 days to be safe, otherwise daily is fine
            const diffMs = Math.abs(new Date(exportEndDate).getTime() - new Date(exportStartDate).getTime());
            const days = Math.ceil(diffMs / (1000 * 3600 * 24));

            let periodRawData: RawDataRow[] = [];
            if (days > 2) {
                periodRawData = await fetchFichajesBatched(exportStartDate, exportEndDate, '', '', '');
            } else {
                periodRawData = await fetchFichajes(exportStartDate, exportEndDate, '', '00:00', '23:59');
            }

            // Fetch Synthetic Punches for Export
            const exportSyntheticPunches = await fetchSyntheticPunches(exportStartDate, exportEndDate);
            const augmentedPeriodData = mergeSyntheticData(periodRawData, exportSyntheticPunches, employeeOptions);

            const exportAnalysisRange = {
                start: new Date(`${exportStartDate}T00:00:00`),
                end: new Date(`${exportEndDate}T23:59:59`)
            };
            const processedFull = processData(augmentedPeriodData, employeeOptions, undefined, exportAnalysisRange, companyHolidaySet);

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
        augmentedErpData.forEach(row => {
            if (row.DescDepartamento) depts.add(row.DescDepartamento);
        });
        return Array.from(depts).sort();
    }, [augmentedErpData]);

    const departmentFilteredEmployees = useMemo(() => {
        if (selectedDepartment === 'all') return employeeOptions;
        return employeeOptions.filter(e => e.department === selectedDepartment);
    }, [selectedDepartment, employeeOptions]);

    const shouldUseVirtualization = effectivePerformanceMode || datasetResumen.length > 50;

    return {
        erpData: augmentedErpData,
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
        performanceMode: effectivePerformanceMode,
        companyHolidaySet,
        analysisRange,
        setEffectiveCalendarDays,
        computedDepartments,
        departmentFilteredEmployees,
        shouldUseVirtualization,
        employeeCalendarsByDate
    };
};

// HELPER: Merge Synthetic Data
const mergeSyntheticData = (
    baseData: RawDataRow[],
    syntheticPunches: Map<string, SyntheticPunchParams>,
    employeeOptions: { id: number; name: string; department: string }[]
): RawDataRow[] => {
    if (syntheticPunches.size === 0) return baseData;

    const syntheticRows: RawDataRow[] = [];
    const employeeLookup = new Map(employeeOptions.map(op => [op.id, op]));

    syntheticPunches.forEach((punch, key) => {
        const empId = parseInt(punch.employeeId, 10);
        const employee = employeeLookup.get(empId);

        if (!employee) return;

        const isEntrada = punch.direction === 'Entrada';

        // Generate a unique negative ID using simple hash from the key
        // Key format: "empId_YYYY-MM-DD_HH:mm"
        const syntheticId = -Math.abs(key.split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0));

        const row: RawDataRow = {
            IDControlPresencia: syntheticId,
            DescDepartamento: employee.department || '',
            IDOperario: empId,
            DescOperario: employee.name,
            Fecha: punch.date,
            Hora: punch.time.length === 5 ? `${punch.time}:00` : punch.time,
            Entrada: isEntrada ? 1 : 0,
            MotivoAusencia: punch.reasonId || (isEntrada ? 0 : 1), // 0=Entrada Normal, 1=Salida Normal typically. Or use null if just a punch.
            // If manual punch for "working", reason should be null/0. If justified absence, reasonId is valid.
            DescMotivoAusencia: punch.reasonDesc || '',
            Computable: 'Sí',
            IDTipoTurno: null,
            Inicio: '',
            Fin: '',
            TipoDiaEmpresa: 0,
            TurnoTexto: '',
            GeneradoPorApp: true
        };

        syntheticRows.push(row);
    });

    return [...baseData, ...syntheticRows];
};
