import { RawDataRow, ProcessedDataRow, UnjustifiedGap, WorkdayDeviation, Shift, User } from '../types';
import { ANNUAL_CREDITS } from '../constants';
// MOCK_USERS removed
import { resolveTurno } from '../utils/turnoResolver';

import { formatTimeRange } from '../utils/shiftClassifier';
import { EXCLUDE_EMPLOYEE_IDS } from '../config/exclusions';
import { toISODateLocal, parseISOToLocalDate, parseLocalDateTime, countWorkingDays } from '../utils/localDate';
import { normalizeDateKey, extractTimeHHMM, extractTimeHHMMSS } from '../utils/datetime';
import { SHIFT_SPECS } from '../core/constants/shifts';
import {
    toMinutes,
    parseDateTime,
    clearDateCache,
    isEntrada,
    isSalida,
    getShiftByTime,
    getOverlapHours
} from '../core/helpers/timeUtils';

export const generateProcessedData = (
    rawData: RawDataRow[],
    allUsers: User[],
    analysisRange?: { start: Date, end: Date },
    settingsHolidays?: Set<string>,
    employeeCalendars?: Map<number, Map<string, number>> // Map<employeeId, Map<date, TipoDia>>
): Map<number, ProcessedDataRow> => {
    clearDateCache();

    const resultsMap = new Map<number, ProcessedDataRow>();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const normalizeDateStr = (raw?: string): string => {
        const normalized = normalizeDateKey(raw || '');
        return normalized || '1970-01-01';
    };

    // 0. Detectar festivos en los datos crudos (TipoDiaEmpresa = 1)
    const effectiveHolidays = new Set<string>(settingsHolidays);
    rawData.forEach(row => {
        if (Number(row.TipoDiaEmpresa) === 1) {
            effectiveHolidays.add(normalizeDateStr(row.Fecha));
        }
    });

    let rangeStartDateStr = '';
    let rangeEndDateStr = '';
    let rangeStartDateStrExtended = '';
    let rangeEndDateStrExtended = '';
    let analysisStart: Date;
    let analysisEnd: Date;

    if (analysisRange) {
        rangeStartDateStr = toISODateLocal(analysisRange.start);
        rangeEndDateStr = toISODateLocal(analysisRange.end);
        const extendedStart = new Date(analysisRange.start);
        extendedStart.setDate(extendedStart.getDate() - 1);
        const extendedEnd = new Date(analysisRange.end);
        extendedEnd.setDate(extendedEnd.getDate() + 1);
        rangeStartDateStrExtended = toISODateLocal(extendedStart);
        rangeEndDateStrExtended = toISODateLocal(extendedEnd);
        analysisStart = analysisRange.start;
        analysisEnd = analysisRange.end;
    } else {
        let min = '9999-99-99';
        let max = '0000-00-00';
        rawData.forEach(r => {
            const dateKey = normalizeDateStr(r.Fecha);
            if (dateKey < min) min = dateKey;
            if (dateKey > max) max = dateKey;
        });
        rangeStartDateStr = min;
        rangeEndDateStr = max;
        rangeStartDateStrExtended = min;
        rangeEndDateStrExtended = max;
        analysisStart = parseISOToLocalDate(min);
        analysisEnd = parseISOToLocalDate(max);
        analysisEnd.setHours(23, 59, 59, 999);
    }

    const analysisStartStr = toISODateLocal(analysisStart);
    const analysisEndStr = toISODateLocal(analysisEnd);
    const expectedWorkingDays = countWorkingDays(analysisStartStr, analysisEndStr, effectiveHolidays);
    const maxTotalHours = expectedWorkingDays > 0 ? expectedWorkingDays * 8 : 8;

    const normalizeTimeStr = (raw?: string): string => {
        const normalized = extractTimeHHMM(raw || '');
        return normalized || '00:00';
    };

    const normalizeTimeStrWithSeconds = (raw?: string): string => {
        const normalized = extractTimeHHMMSS(raw || '');
        return normalized || '00:00:00';
    };

    const getMotivoAusencia = (value: RawDataRow['MotivoAusencia'] | string | number | null | undefined): number | null => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            const parsed = parseInt(trimmed, 10);
            return Number.isNaN(parsed) ? null : parsed;
        }
        return null;
    };

    const resolveEffectiveHour = (row: RawDataRow, employeeId: number): string => {
        const rawHour = normalizeTimeStrWithSeconds(row.Hora);
        const isFlexible = userMap.get(employeeId)?.flexible === true;

        if (!isFlexible) {
            return rawHour;
        }

        const realHour = normalizeTimeStrWithSeconds(row.HoraReal);
        if (realHour !== '00:00:00') return realHour;

        return rawHour;
    };

    // 1. Group by Employee
    const dataByEmployee = new Map<number, RawDataRow[]>();
    const sliceFestiveFlags = new Map<number, boolean[]>(); // Stores isFestive flag for each timeSlice index
    const employeeTipoDiaMap = new Map<number, Map<string, number>>();
    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowId = Number(row.IDOperario);
        if (EXCLUDE_EMPLOYEE_IDS.has(rowId)) continue;
        const rowForProcessing: RawDataRow = {
            ...row,
            Hora: resolveEffectiveHour(row, rowId)
        };

        const rowDate = normalizeDateStr(rowForProcessing.Fecha);

        if (rowDate < rangeStartDateStrExtended) continue;
        if (rowDate > rangeEndDateStrExtended) continue;

        if (rowForProcessing.TipoDiaEmpresa !== undefined && rowForProcessing.TipoDiaEmpresa !== null) {
            const rawTipo = typeof rowForProcessing.TipoDiaEmpresa === 'string'
                ? parseInt(rowForProcessing.TipoDiaEmpresa, 10)
                : rowForProcessing.TipoDiaEmpresa;
            if (!Number.isNaN(rawTipo)) {
                let empTipoMap = employeeTipoDiaMap.get(rowId);
                if (!empTipoMap) {
                    empTipoMap = new Map<string, number>();
                    employeeTipoDiaMap.set(rowId, empTipoMap);
                }
                if (!empTipoMap.has(rowDate)) {
                    empTipoMap.set(rowDate, rawTipo);
                }
            }
        }

        // STRICT TIME FILTER:
        // Ignore ENTRIES that occur strictly AFTER the analysis end time.
        // Exits are allowed to pass to complete ongoing shifts (e.g. night shift ending at 06:00 when filter ends at 02:00).
        if (analysisRange && isEntrada(rowForProcessing.Entrada)) {
            const rowDateTime = parseDateTime(normalizeDateStr(rowForProcessing.Fecha), normalizeTimeStr(rowForProcessing.Hora));
            if (rowDateTime > analysisEnd) continue;
        }

        let rows = dataByEmployee.get(rowId);
        if (!rows) {
            rows = [];
            dataByEmployee.set(rowId, rows);
        }
        rows.push(rowForProcessing);
    }



    const getOrCreateEmployee = (id: number, sampleRow?: RawDataRow): ProcessedDataRow => {
        if (resultsMap.has(id)) return resultsMap.get(id)!;
        const user = userMap.get(id);
        const newEmployee: ProcessedDataRow = {
            operario: id,
            nombre: user?.name || sampleRow?.DescOperario || `Operario ${id}`,
            colectivo: sampleRow?.DescDepartamento || user?.department || 'General',
            turnoAsignado: 'M',
            isFlexible: user?.flexible === true,
            horarioReal: '-',
            timeSlices: [],
            justifiedIntervals: [],
            totalHoras: 0,
            presencia: 0,
            horasJustificadas: 0,
            horasTotalesConJustificacion: 0,
            horasExceso: 0,
            horasDia: 0, horasTarde: 0, horasNoche: 0,
            excesoJornada1: 0, nocturnas: 0, festivas: 0,
            hMedico: 0, acumMedico: 0, dispMedico: ANNUAL_CREDITS.MEDICO_HOURS,
            hVacaciones: 0, acumVacaciones: 0, dispVacaciones: ANNUAL_CREDITS.VACATION_DAYS,
            hLDisp: 0, acumHLDisp: 0, dispHLDisp: ANNUAL_CREDITS.LIBRE_DISPOSICION_HOURS,
            hLeyFam: 0, acumHLF: 0, dispHLF: ANNUAL_CREDITS.LEY_FAMILIAS_HOURS,
            hVacAnt: 0, asOficiales: 0,
            hEspecialistaAccidente: 0, hSindicales: 0,
            hITAT: 0, diasITAT: 0,
            hITEC: 0, diasITEC: 0,
            asPropios: 0, vacacionesPeriodo: 0,
            numTAJ: 0, hTAJ: 0, festiveTaj: 0,
            numRetrasos: 0, tiempoRetrasos: 0,
            numJornadasPartidas: 0, tiempoJornadaPartida: 0,
            unjustifiedGaps: [],
            workdayDeviations: [],
            missingClockOuts: [],
            absentDays: [],
            vacationConflicts: [], // NEW: Track vacation conflicts
            incidentCount: 0,
            shiftChanges: []
        };
        sliceFestiveFlags.set(id, []);
        resultsMap.set(id, newEmployee);
        return newEmployee;
    };

    // Initialize from provided users
    userMap.forEach(user => {
        if (user.appRole !== 'HR' && !EXCLUDE_EMPLOYEE_IDS.has(Number(user.id))) {
            getOrCreateEmployee(Number(user.id));
        }
    });

    // Also initialize from raw data (fallback if user list is incomplete or empty)
    for (const [id, rows] of dataByEmployee.entries()) {
        if (!EXCLUDE_EMPLOYEE_IDS.has(id)) {
            // Sort rows by Date and Time to ensure we have chronological order
            // This is crucial for determining the current Department (using the latest record)
            const sortedRows = [...rows].sort((a, b) => {
                const aDate = normalizeDateStr(a.Fecha);
                const bDate = normalizeDateStr(b.Fecha);
                if (aDate !== bDate) return aDate < bDate ? -1 : 1;
                return normalizeTimeStrWithSeconds(a.Hora).localeCompare(normalizeTimeStrWithSeconds(b.Hora));
            });
            // Use the LAST row to get the most recent employee data
            getOrCreateEmployee(id, sortedRows[sortedRows.length - 1]);
        }
    }

    // 2. Process per Employee
    for (const employee of resultsMap.values()) {
        const employeeId = employee.operario;
        const employeeRows = dataByEmployee.get(employeeId) || [];

        const allRows = employeeRows.sort((a, b) => {
            const aDate = normalizeDateStr(a.Fecha);
            const bDate = normalizeDateStr(b.Fecha);
            if (aDate !== bDate) return aDate < bDate ? -1 : 1;
            return normalizeTimeStrWithSeconds(a.Hora).localeCompare(normalizeTimeStrWithSeconds(b.Hora));
        });

        const rowsByDate = new Map<string, RawDataRow[]>();
        allRows.forEach(row => {
            const dateKey = normalizeDateStr(row.Fecha);
            if (!rowsByDate.has(dateKey)) rowsByDate.set(dateKey, []);
            rowsByDate.get(dateKey)!.push(row);
        });

        const isAbsenceExitRow = (row: RawDataRow): boolean => {
            const ma = getMotivoAusencia(row.MotivoAusencia);
            return isSalida(row.Entrada) &&
                ma !== null &&
                ma !== 1 &&
                ma !== 14 &&
                ma !== 0;
        };

        const isTimeNearMinutes = (timeA: string, timeB: string, toleranceMinutes: number): boolean => {
            const a = toMinutes(normalizeTimeStr(timeA));
            const b = toMinutes(normalizeTimeStr(timeB));
            return Math.abs(a - b) <= toleranceMinutes;
        };

        // --- PRE-CALCULAR INTERVALOS JUSTIFICADOS DEL DÍA ---
        // Necesitamos esto para que la detección de retrasos ignore tiempos ya cubiertos por una incidencia.
        // FIX: Store motivoId to allow specific subtraction later
        const dailyJustifications = new Map<string, { start: number, end: number, motivoId: number }[]>();
        allRows.forEach(r => {
            const ma = getMotivoAusencia(r.MotivoAusencia);
            if (isSalida(r.Entrada) && ma !== null && ma !== 1 && ma !== 14 && ma !== 0) {
                const ini = normalizeTimeStr(r.Inicio || '');
                const fin = normalizeTimeStr(r.Fin || '');
                if (ini && fin && ini !== '00:00' && fin !== '00:00') {
                    const s = toMinutes(ini);
                    const e = toMinutes(fin);
                    const dateKey = normalizeDateStr(r.Fecha);
                    if (!dailyJustifications.has(dateKey)) dailyJustifications.set(dateKey, []);
                    dailyJustifications.get(dateKey)!.push({ start: s, end: e, motivoId: ma });
                }
            }
        });

        const dailyHoursMap = new Map<string, number>();
        const dailyTajMap = new Map<string, number>();
        const dailyShiftMap = new Map<string, string>();
        const dailyJustificationMap = new Set<string>();
        const datesWithActivity = new Set<string>();
        const shiftCounts: { M: number; TN: number } = { M: 0, TN: 0 };

        let i = 0;
        const len = allRows.length;

        const getShiftBoundsMinutes = (shiftCode: string): { start: number; end: number } => {
            if (shiftCode === 'TN' || shiftCode === 'T') return { start: 15 * 60, end: 23 * 60 };
            if (shiftCode === 'N') return { start: 23 * 60, end: 7 * 60 };
            if (shiftCode === 'C') return { start: 8 * 60, end: 17 * 60 };
            return { start: 7 * 60, end: 15 * 60 };
        };

        const clampToShiftMinutes = (startMin: number, endMin: number, shiftStart: number, shiftEnd: number): number => {
            let s = startMin;
            let e = endMin;
            let shiftS = shiftStart;
            let shiftE = shiftEnd;

            if (shiftE <= shiftS) {
                // Shift crosses midnight
                shiftE += 1440;
                if (e < s) e += 1440;
            }

            if (e < s) return 0;

            const overlapStart = Math.max(s, shiftS);
            const overlapEnd = Math.min(e, shiftE);
            return overlapEnd > overlapStart ? (overlapEnd - overlapStart) : 0;
        };

        const isFridayTurnoTardeCarryOver = (segmentStart: Date): boolean => {
            // Regla negocio: extras del viernes turno tarde que pasan a madrugada
            // se computan como nocturnas, no como festivas.
            if (segmentStart.getDay() !== 6) return false; // Sabado
            if (segmentStart.getHours() >= 6) return false; // Solo madrugada 00:00-05:59

            const prev = new Date(segmentStart);
            prev.setDate(prev.getDate() - 1);
            const prevDateKey = toISODateLocal(prev);
            const prevShift = dailyShiftMap.get(prevDateKey);

            return prevShift === 'TN' || prevShift === 'T';
        };


        // ...

        let mainLoopGuard = 0;
        while (i < len && mainLoopGuard < 100000) { // Safety break
            mainLoopGuard++;
            const currentRow = allRows[i];
            // 🛑 CRITICAL FIX: Normalizar Fecha y Hora robustamente
            // El backend puede enviar "2026-01-16 00:00:00" en Fecha y timestamp completo en Hora
            const currentDateStr = normalizeDateStr(currentRow.Fecha);
            const currentHoraStr = normalizeTimeStr(currentRow.Hora);
            const currentMotivo = getMotivoAusencia(currentRow.MotivoAusencia);

            datesWithActivity.add(currentDateStr);

            if (currentMotivo !== null && currentMotivo !== 1 && currentMotivo !== 14) {
                dailyJustificationMap.add(currentDateStr);
            }

            if (isEntrada(currentRow.Entrada)) {
                // Usar fecha y hora normalizadas
                const currentDateObj = parseDateTime(currentDateStr, currentHoraStr);
                let j = i + 1;
                let nextRow = null;
                let loopGuard = 0; // SAFETY GUARD

                while (j < len && loopGuard < 1000) { // Max 1000 iteraciones lookahead
                    loopGuard++;
                    const row = allRows[j];
                    if (isSalida(row.Entrada)) {
                        nextRow = row;
                        const rowDateNormal = normalizeDateStr(row.Fecha);
                        const rowMotivo = getMotivoAusencia(row.MotivoAusencia);
                        if (rowMotivo !== null && rowMotivo !== 1 && rowMotivo !== 14) {
                            dailyJustificationMap.add(rowDateNormal);
                        }
                        break;
                    }
                    if (isEntrada(row.Entrada)) break;
                    j++;
                }

                // Determinación del Turno (Prioridad: IDTipoTurno del Backend > ManualFallback)
                if (!dailyShiftMap.has(currentDateStr)) {

                    // 1. Backend Source of Truth (IDTipoTurno)
                    let resolvedShift = 'UNKNOWN';

                    // Comprobar ambos campos posibles
                    if (currentRow.IDTipoTurno && currentRow.IDTipoTurno.trim() !== '') {
                        resolvedShift = currentRow.IDTipoTurno;
                    } else if (currentRow.TurnoTexto && currentRow.TurnoTexto !== '') {
                        resolvedShift = currentRow.TurnoTexto;
                    }

                    // 2. Fallback: Heurística por hora
                    if (resolvedShift === 'UNKNOWN' || resolvedShift === '') {
                        resolvedShift = getShiftByTime(currentHoraStr);
                    }

                    dailyShiftMap.set(currentDateStr, resolvedShift);
                    if (resolvedShift === 'TN') shiftCounts.TN++;
                    else shiftCounts.M++;
                }


                const currentShiftCode = dailyShiftMap.get(currentDateStr) || 'M';
                // CRITICAL FIX: Get definition from SHIFT_SPECS standard, not from manual shifts input
                // manual 'shifts' param are assignments, they don't have start/end times.
                const assignedShift = SHIFT_SPECS.find(s => s.code === currentShiftCode);

                // 🔍 DEBUG MARIO (047) - REMOVED FOR CLEANUP
                /*
                if (employeeId === 47 && currentDateStr === '2026-01-16') {
                    // console.log removed
                }
                */

                // --- DETECCIÓN DE RETRASO INICIAL (GAP AL COMIENZO) ---
                // Si es la PRIMERA entrada del día de este empleado y llega tarde (> 10 min) respecto al turno
                const prevRow = i > 0 ? allRows[i - 1] : null;
                const isFirstEntryOfDay = (!prevRow || normalizeDateStr(prevRow.Fecha) !== currentDateStr) && isEntrada(currentRow.Entrada);

                if (isFirstEntryOfDay && assignedShift) {
                    const shiftStart = parseDateTime(currentDateStr, assignedShift.start);

                    // Usar HORA NORMALIZADA
                    const entryTime = parseDateTime(currentDateStr, currentHoraStr);

                    // Tolerancia 2 minutos (antes 10)
                    // Si la entrada es significativamente POSTERIOR al inicio del turno
                    if (entryTime.getTime() > (shiftStart.getTime() + 120000)) {

                        // Verificar si ya existe un GAP idéntico (por si acaso)
                        const gapExists = employee.unjustifiedGaps.some(g => g.date === currentDateStr && g.start === assignedShift.start);

                        if (!gapExists) {
                            // ⚠️ CASO 2: Entrada tardía
                            // Generar GAP virtual desde el inicio del turno hasta la entrada real
                            // NO incluir originPunchId porque NO queremos modificar la entrada real (11:35)
                            // sino INSERTAR pares sintéticos (07:00 entrada + 11:34 salida con motivo)
                            employee.unjustifiedGaps.push({
                                date: currentDateStr,
                                start: assignedShift.start,
                                end: currentHoraStr, // Hora limpia
                                // originPunchId eliminado intencionalmente para Caso 2
                            });

                            // Log debug if Mario - REMOVED FOR CLEANUP
                            /*
                            if (employeeId === 47) {
                                // console.log removed
                            }
                            */
                        }
                    }
                }

                if (nextRow) {
                    const endTime = parseDateTime(normalizeDateStr(nextRow.Fecha), normalizeTimeStr(nextRow.Hora));

                    const nextInicioStr = normalizeTimeStr(nextRow.Inicio || '');
                    const nextFinStr = normalizeTimeStr(nextRow.Fin || '');
                    const hasAbsenceRange = nextInicioStr && nextFinStr && nextInicioStr !== '00:00' && nextFinStr !== '00:00';
                    const nextMotivo = getMotivoAusencia(nextRow.MotivoAusencia);
                    const isAbsenceExitWithReason = isAbsenceExitRow(nextRow);
                    const isRangeAnchoredToCurrentPair = hasAbsenceRange &&
                        isTimeNearMinutes(currentHoraStr, nextInicioStr, 1) &&
                        isTimeNearMinutes(normalizeTimeStr(nextRow.Hora), nextFinStr, 1);
                    const isManualTajRange = nextMotivo === 14 && hasAbsenceRange &&
                        isTimeNearMinutes(currentHoraStr, nextInicioStr, 1) &&
                        isTimeNearMinutes(normalizeTimeStr(nextRow.Hora), nextFinStr, 1);
                    const isSyntheticAbsencePair = (isAbsenceExitWithReason && isRangeAnchoredToCurrentPair) || isManualTajRange;

                    if (endTime > currentDateObj) {
                        let effectiveStart = currentDateObj;
                        let effectiveEnd = endTime;

                        // --- SNAPPING LOGIC REVERTED (Moved to Manual Button) ---
                        // User Request: "Ajuste masivo a las 7 y a las 12" -> ONLY VIA BUTTON
                        // effectiveStart and effectiveEnd remain as is from data
                        // --------------------------------------------------------

                        // --- LOGICA DE CORTESIA (Snap to Start - Standard Days) ---
                        // Si el empleado llega dentro de los primeros 2 minutos (ej. 07:01:59),
                        // ajustamos la hora efectiva a la hora teórica (07:00:00).
                        let diffMins = 0;
                        let theoreticalHour = 7;
                        if (currentShiftCode === 'TN') theoreticalHour = 15;

                        // Solo aplicar si estamos cerca de la hora de entrada teórica
                        if (effectiveStart.getHours() === theoreticalHour) {
                            const m = effectiveStart.getMinutes();
                            if (m < 2) {
                                // Estamos en 0 o 1 minutos -> Ajustar a en punto
                                effectiveStart.setMinutes(0);
                                effectiveStart.setSeconds(0);
                                effectiveStart.setMilliseconds(0);
                            }
                        }

                        // CORRECCION FESTIVOS: Análisis efectivo desde las 06:00 AM
                        if (effectiveHolidays.has(currentDateStr)) {
                            const holidayStartBound = new Date(currentDateObj);
                            holidayStartBound.setHours(6, 0, 0, 0);

                            if (effectiveStart < holidayStartBound) {
                                effectiveStart = holidayStartBound;
                            }
                        }

                        if (analysisRange) {
                            if (effectiveStart < analysisStart) effectiveStart = new Date(analysisStart);
                            if (effectiveEnd > analysisEnd) effectiveEnd = new Date(analysisEnd);
                        }

                        const durationMs = effectiveEnd.getTime() - effectiveStart.getTime();
                        let durationHours = durationMs / 3600000;

                        const isJustifiedExit = nextMotivo !== null && nextMotivo !== 0 && nextMotivo !== 1;
                        const isSyntheticTajPair =
                            nextMotivo === 14 &&
                            (currentRow.GeneradoPorApp === true || nextRow.GeneradoPorApp === true);
                        const isJustifiedPair = isManualTajRange ||
                            isSyntheticTajPair ||
                            (isAbsenceExitWithReason && nextMotivo !== 14 && (!hasAbsenceRange || isRangeAnchoredToCurrentPair));

                        let justifiedHours = durationHours;
                        let justifiedStart = extractTimeHHMM(currentRow.Hora);
                        let justifiedEnd = extractTimeHHMM(nextRow.Hora);
                        let justifiedEndIsNextDay = endTime.getDate() !== currentDateObj.getDate();

                        if (isJustifiedExit && hasAbsenceRange) {
                            const rangeStartMin = toMinutes(nextInicioStr);
                            let rangeEndMin = toMinutes(nextFinStr);
                            let rangeEndsNextDay = false;

                            if (rangeEndMin < rangeStartMin) {
                                rangeEndMin += 1440;
                                rangeEndsNextDay = true;
                            }

                            const rangeMinutes = nextMotivo === 14
                                ? Math.max(0, rangeEndMin - rangeStartMin)
                                : clampToShiftMinutes(
                                    rangeStartMin,
                                    rangeEndMin,
                                    getShiftBoundsMinutes(currentShiftCode).start,
                                    getShiftBoundsMinutes(currentShiftCode).end
                                );
                            justifiedHours = rangeMinutes / 60;
                            justifiedStart = nextInicioStr;
                            justifiedEnd = nextFinStr;
                            justifiedEndIsNextDay = rangeEndsNextDay;
                        }

                        if (isJustifiedExit && justifiedHours > 0) {
                            employee.justifiedIntervals.push({
                                date: currentDateStr,
                                start: justifiedStart,
                                end: justifiedEnd,
                                endIsNextDay: justifiedEndIsNextDay,
                                motivoId: Number(nextMotivo),
                                motivoDesc: nextRow.DescMotivoAusencia || undefined,
                                source: 'punch',
                                isSynthetic: currentRow.GeneradoPorApp || nextRow.GeneradoPorApp
                            });
                        }

                        const shouldAccumulateJustified =
                            ((nextMotivo !== null && nextMotivo !== 0 && nextMotivo !== 1 && nextMotivo !== 14) || isManualTajRange);

                        if (shouldAccumulateJustified && justifiedHours > 0) {
                            const ma = nextMotivo;
                            if (ma === 2) employee.hMedico += justifiedHours;
                            else if (ma === 3) employee.asOficiales += justifiedHours;
                            else if (ma === 4) employee.asPropios += justifiedHours;
                            else if (ma === 5) employee.hVacaciones += (justifiedHours / 8);
                            else if (ma === 6) employee.hEspecialistaAccidente += justifiedHours;
                            else if (ma === 7) employee.hLDisp += justifiedHours;
                            else if (ma === 8) {
                                if (nextRow.DescMotivoAusencia && nextRow.DescMotivoAusencia.toUpperCase().includes('ANTERIOR')) {
                                    employee.hVacAnt += (justifiedHours / 8);
                                } else {
                                    employee.hVacaciones += (justifiedHours / 8);
                                }
                            }
                            else if (ma === 9) employee.hSindicales += justifiedHours;
                            else if (ma === 10) employee.hITAT += justifiedHours;
                            else if (ma === 11) employee.hITEC += justifiedHours;
                            else if (ma === 13) employee.hLeyFam += justifiedHours;
                            else if (ma === 14) {
                                // NEW: Manual TAJ Recording (Incidencia 14 insertada a mano)
                                employee.hTAJ += justifiedHours;

                                // FIX USER REQ: Si es FESTIVO, el tiempo de TAJ también se suma a FESTIVAS
                                const dateKey = toISODateLocal(effectiveStart);
                                const dayOfWeek = effectiveStart.getDay();
                                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                const isHoliday = effectiveHolidays.has(dateKey);

                                // LOGIC FIX: Decouple sources
                                let empCalType: number | undefined = undefined;

                                // 1. Check Personal Calendar Override (Highest Priority)
                                if (employeeCalendars) {
                                    if (employeeCalendars instanceof Map) {
                                        const empMap = employeeCalendars.get(employeeId);
                                        if (empMap) empCalType = empMap.get(dateKey);
                                    } else {
                                        const empCal = (employeeCalendars as any)[employeeId];
                                        if (empCal) empCalType = empCal[dateKey];
                                    }
                                }

                                // 2. Check Fichaje Data Type (Lowest Priority)
                                const fichajeType = employeeTipoDiaMap.has(employeeId)
                                    ? employeeTipoDiaMap.get(employeeId)?.get(dateKey)
                                    : undefined;

                                const isFridayCarryOver = isFridayTurnoTardeCarryOver(effectiveStart);
                                const isFestive = isFridayCarryOver
                                    ? false
                                    : (empCalType !== undefined
                                        ? empCalType === 1 || (empCalType !== 0 && isWeekend)
                                        : (isHoliday || isWeekend));

                                if (isFestive) {
                                    employee.festivas += justifiedHours;
                                    employee.festiveTaj += justifiedHours;
                                }
                                employee.numTAJ += 1;
                            }

                            // Justified time does NOT go to dailyHoursMap or timeSlices
                        }

                        if (!isJustifiedPair && !isSyntheticAbsencePair && durationHours > 0) {
                            // FIX: Prevent Double Counting (Presence vs Justification Overlap)
                            // Restore subtraction logic to handle cases where real punches conflict with full-day incidents.
                            // Rule: Justification takes precedence. If a justification exists, work hours are reduced.
                            let totalOverlap = 0;
                            const justifications = dailyJustifications.get(currentDateStr) || [];
                            const sMin = effectiveStart.getHours() * 60 + effectiveStart.getMinutes();
                            const eMin = effectiveEnd.getHours() * 60 + effectiveEnd.getMinutes();

                            justifications.forEach(j => {
                                const os = Math.max(sMin, j.start);
                                const oe = Math.min(eMin, j.end);
                                if (oe > os) totalOverlap += (oe - os) / 60;
                            });

                            // Subtraction with floor at 0
                            durationHours = Math.max(0, durationHours - totalOverlap);

                            const currentDayTotal = dailyHoursMap.get(currentDateStr) || 0;
                            dailyHoursMap.set(currentDateStr, currentDayTotal + durationHours);

                            const isNextDay = endTime.getDate() !== currentDateObj.getDate();
                            employee.timeSlices.push({
                                start: extractTimeHHMM(currentRow.Hora),
                                end: extractTimeHHMM(nextRow.Hora),
                                endIsNextDay: isNextDay,
                                isSynthetic: currentRow.GeneradoPorApp || nextRow.GeneradoPorApp
                            });

                            const startHour = effectiveStart.getHours();
                            const dateKey = toISODateLocal(effectiveStart);
                            const dayOfWeek = effectiveStart.getDay();
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                            const isHoliday = effectiveHolidays.has(dateKey);

                            // LOGIC FIX: Decouple sources
                            let empCalType: number | undefined = undefined;

                            // 1. Check Personal Calendar Override (Highest Priority)
                            if (employeeCalendars) {
                                if (employeeCalendars instanceof Map) {
                                    const empMap = employeeCalendars.get(employeeId);
                                    if (empMap) empCalType = empMap.get(dateKey);
                                } else if (typeof employeeCalendars === 'object') {
                                    const empCal = (employeeCalendars as any)[employeeId];
                                    if (empCal) empCalType = empCal[dateKey];
                                }
                            }

                            // 2. Check Fichaje Data Type
                            const fichajeType = employeeTipoDiaMap.get(employeeId)?.get(dateKey);

                            const isFridayCarryOver = isFridayTurnoTardeCarryOver(effectiveStart);
                            const isFestive = isFridayCarryOver
                                ? false
                                : (empCalType !== undefined
                                    ? empCalType === 1 || (empCalType !== 0 && isWeekend)
                                    : (isHoliday || isWeekend));

                            // Sync flag with timeSlice pushed above
                            sliceFestiveFlags.get(employeeId)?.push(isFestive);

                            // IMPORTANT: If we modify 'employee.festivas' here, ensure logic considers the modified flags if needed.
                            // But for accumulators, we just sum hours.

                            if (isFestive) {
                                employee.festivas += durationHours;
                            } else {
                                const startYear = effectiveStart.getFullYear();
                                const startMonth = effectiveStart.getMonth();
                                const startDay = effectiveStart.getDate();

                                const justificationRanges = justifications.map(j => {
                                    const startDate = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
                                    startDate.setMinutes(j.start);

                                    const endDate = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
                                    const endMin = j.end < j.start ? j.end + 1440 : j.end;
                                    endDate.setMinutes(endMin);

                                    return { start: startDate, end: endDate };
                                });

                                const adjustedOverlapHours = (boundStart: Date, boundEnd: Date): number => {
                                    const rawOverlap = getOverlapHours(effectiveStart, effectiveEnd, boundStart, boundEnd);
                                    if (rawOverlap <= 0 || justificationRanges.length === 0) return rawOverlap;

                                    let justifiedOverlap = 0;
                                    justificationRanges.forEach(r => {
                                        justifiedOverlap += getOverlapHours(r.start, r.end, boundStart, boundEnd);
                                    });

                                    return Math.max(0, rawOverlap - justifiedOverlap);
                                };

                                // Definir límites horarios
                                const bound00 = new Date(startYear, startMonth, startDay, 0, 0, 0);
                                const bound06 = new Date(startYear, startMonth, startDay, 6, 0, 0);
                                const bound07 = new Date(startYear, startMonth, startDay, 7, 0, 0);
                                const bound15 = new Date(startYear, startMonth, startDay, 15, 0, 0);
                                const bound20 = new Date(startYear, startMonth, startDay, 20, 0, 0);
                                const bound23 = new Date(startYear, startMonth, startDay, 23, 0, 0);
                                const bound06Next = new Date(startYear, startMonth, startDay + 1, 6, 0, 0);

                                // Nocturnas (20:00 - 06:00)
                                const hNocturnasMadrugada = adjustedOverlapHours(bound00, bound06);
                                const hNocturnasNoche = adjustedOverlapHours(bound20, bound06Next);
                                const totalNocturnas = hNocturnasMadrugada + hNocturnasNoche;

                                employee.nocturnas += totalNocturnas;

                                if (currentShiftCode === 'TN') {
                                    // Turno Tarde (15:00 - 23:00)
                                    // Horas Tarde = Intersección con 15:00-23:00
                                    const hTarde = adjustedOverlapHours(bound15, bound23);
                                    employee.horasTarde += hTarde;

                                    // FIX: Si viene por la mañana (fuera de turno), acumular en Horas Dia
                                    const hDia = adjustedOverlapHours(bound07, bound15);
                                    employee.horasDia += hDia;

                                } else {
                                    // Turno Mañana (07:00 - 15:00)
                                    // Horas Dia = Intersección con 07:00-15:00
                                    const hDia = adjustedOverlapHours(bound07, bound15);
                                    employee.horasDia += hDia;

                                    // FIX: Exceso Jornada 1 (15:00 - 20:00)
                                    // Calcular horas trabajadas en la tarde como exceso
                                    const hExceso1 = adjustedOverlapHours(bound15, bound20);
                                    if (!employee.excesoJornada1) employee.excesoJornada1 = 0;
                                    employee.excesoJornada1 += hExceso1;
                                }
                            }


                            // --- Retrasos (Treat as Gaps if significant) ---
                            if (!isWeekend && !isHoliday && (dailyHoursMap.get(currentDateStr) || 0) <= durationHours) {
                                let theoreticalStartHour = 7;
                                if (currentShiftCode === 'TN') theoreticalStartHour = 15;

                                const theoreticalStartStr = `${theoreticalStartHour.toString().padStart(2, '0')}:00`;
                                let isDelay = false;
                                let delayMins = 0;

                                if (startHour === theoreticalStartHour) {
                                    const min = effectiveStart.getMinutes();
                                    if (min >= 2) {
                                        isDelay = true;
                                        delayMins = min;
                                    }
                                } else if (startHour > theoreticalStartHour && startHour < theoreticalStartHour + 4) {
                                    isDelay = true;
                                    delayMins = (startHour - theoreticalStartHour) * 60 + effectiveStart.getMinutes();
                                }

                                if (isDelay) {
                                    // --- RESTAR TIEMPOS JUSTIFICADOS ---
                                    // Si hay una incidencia que cubre parte o todo el tiempo de retraso, lo descontamos.
                                    const delayStartMin = theoreticalStartHour * 60;
                                    const delayEndMin = effectiveStart.getHours() * 60 + effectiveStart.getMinutes();

                                    let justifiedMins = 0;
                                    const justifications = dailyJustifications.get(currentDateStr) || [];
                                    justifications.forEach(j => {
                                        const overlapStart = Math.max(delayStartMin, j.start);
                                        const overlapEnd = Math.min(delayEndMin, j.end);
                                        if (overlapEnd > overlapStart) {
                                            justifiedMins += (overlapEnd - overlapStart);
                                        }
                                    });

                                    delayMins = Math.max(0, delayMins - justifiedMins);

                                    // Si después de restar lo justificado el retraso es < 2 min, lo ignoramos.
                                    if (delayMins < 2) {
                                        isDelay = false;
                                    }
                                }

                                if (isDelay) {
                                    employee.numRetrasos += 1;
                                    employee.tiempoRetrasos += delayMins / 60;

                                    // NEW: Create a gap for the delay so it can be justified
                                    // Start: Theoretical Start (07:00 or 15:00)
                                    const actualArrivalStr = effectiveStart.toTimeString().substring(0, 5); // HH:MM

                                    // Si hubo justificación parcial, el "hueco" debería empezar al final de la última justificación previa?
                                    // Por simplicidad, si hay justificación que cubre el inicio, ajustamos el inicio del hueco.
                                    let adjustedTheoreticalStartStr = theoreticalStartStr;
                                    const justifications = dailyJustifications.get(currentDateStr) || [];
                                    // Buscar si alguna justificación empieza en el theoretical start y termina después
                                    const tStartMin = theoreticalStartHour * 60;
                                    const matchingJ = justifications.find(j => j.start <= tStartMin && j.end > tStartMin);
                                    if (matchingJ) {
                                        const h = Math.floor(matchingJ.end / 60).toString().padStart(2, '0');
                                        const m = (matchingJ.end % 60).toString().padStart(2, '0');
                                        adjustedTheoreticalStartStr = `${h}:${m}`;
                                    }

                                    // Avoid duplicates: check if a gap already exists for this time
                                    const alreadyHasGap = employee.unjustifiedGaps.some(
                                        g => g.date === currentDateStr && g.start === adjustedTheoreticalStartStr
                                    );

                                    if (!alreadyHasGap && adjustedTheoreticalStartStr < actualArrivalStr) {
                                        employee.unjustifiedGaps.push({
                                            date: currentDateStr,
                                            start: adjustedTheoreticalStartStr,
                                            end: actualArrivalStr
                                        });
                                    }
                                }
                            }
                        }
                    }

                    // --- DETECT GAPS / SALTOS ---
                    if (nextMotivo !== 14) {
                        let k = j + 1;
                        let futureEntry = null;
                        let wGuard = 0;
                        while (k < len && wGuard < 1000) {
                            wGuard++;
                            if (isEntrada(allRows[k].Entrada)) {
                                futureEntry = allRows[k];
                                break;
                            }
                            k++;
                        }

                        if (futureEntry) {
                            const gapStart = parseDateTime(normalizeDateStr(nextRow.Fecha), normalizeTimeStr(nextRow.Hora));
                            const gapEnd = parseDateTime(normalizeDateStr(futureEntry.Fecha), normalizeTimeStr(futureEntry.Hora));
                            const gapDurationMs = gapEnd.getTime() - gapStart.getTime();

                            if (gapDurationMs < 18000000 && gapDurationMs > 60000) {
                                const exitHour = gapStart.getHours();
                                const exitMin = gapStart.getMinutes();
                                const entryHour = gapEnd.getHours();
                                let isActionableGap = true;

                                if (currentShiftCode === 'M') {
                                    if (exitHour >= 15 || (exitHour === 14 && exitMin >= 59)) isActionableGap = false; // Tolerancia 1 min
                                } else if (currentShiftCode === 'TN') {
                                    // FIX: Turno TN (15:00-23:00)
                                    // Ignorar salidas nocturnas sin retorno (horas extra) y salidas fuera del turno

                                    // Caso 1: Salida en madrugada (00:00-06:00) sin entrada posterior
                                    //         → Es fin de jornada con horas extra nocturnas, NO gap
                                    if (exitHour >= 0 && exitHour < 6) {
                                        isActionableGap = false;
                                    }
                                    // Caso 2: Salida Y entrada en rango matutino (06:00-14:59)
                                    //         → Fuera del turno TN, NO gap
                                    else if (exitHour >= 6 && exitHour < 15 && entryHour >= 6 && entryHour < 15) {
                                        isActionableGap = false;
                                    }
                                }

                                if (isActionableGap) {
                                    const endIsNext = gapEnd.getDate() !== gapStart.getDate();
                                    const endStr = endIsNext ? `${gapEnd.toTimeString().substring(0, 5)} (+1)` : gapEnd.toTimeString().substring(0, 5);

                                    // NEW (Cambio 9): Verificar si este gap YA está justificado
                                    const gapStartMin = gapStart.getHours() * 60 + gapStart.getMinutes();
                                    const gapEndMin = gapEnd.getHours() * 60 + gapEnd.getMinutes();

                                    const justifications = dailyJustifications.get(currentDateStr) || [];
                                    let isFullyCovered = false;

                                    // Verificar si alguna justificación cubre completamente este gap
                                    for (const j of justifications) {
                                        if (j.start <= gapStartMin && j.end >= gapEndMin) {
                                            isFullyCovered = true;
                                            break;
                                        }
                                    }

                                    // Solo agregar el gap si NO está completamente cubierto por una justificación
                                    if (!isFullyCovered) {
                                        employee.unjustifiedGaps.push({
                                            date: currentDateStr,
                                            start: gapStart.toTimeString().substring(0, 5),
                                            end: endStr,
                                            originPunchId: nextRow.IDControlPresencia
                                        });
                                    }
                                }
                            }
                        } else {
                            // Logic for Early Exit (No return punch found today)
                            const exitDate = parseDateTime(normalizeDateStr(nextRow.Fecha), normalizeTimeStr(nextRow.Hora));
                            let shiftEndHour = 15;
                            if (currentShiftCode === 'TN') shiftEndHour = 23;

                            const shiftEndDate = parseDateTime(currentDateStr, `${String(shiftEndHour).padStart(2, '0')}:00`);

                            // Tolerance reduced to 1 minute (60000ms)
                            if (exitDate < shiftEndDate && (shiftEndDate.getTime() - exitDate.getTime() > 60000)) {
                                const gapStart = exitDate.toTimeString().substring(0, 5);
                                const gapEnd = shiftEndDate.toTimeString().substring(0, 5);

                                // NEW (Cambio 9): Verificar si esta salida temprana YA está justificada
                                const gapStartMin = exitDate.getHours() * 60 + exitDate.getMinutes();
                                const gapEndMin = shiftEndHour * 60;

                                const justifications = dailyJustifications.get(currentDateStr) || [];
                                let isFullyCovered = false;

                                for (const j of justifications) {
                                    if (j.start <= gapStartMin && j.end >= gapEndMin) {
                                        isFullyCovered = true;
                                        break;
                                    }
                                }

                                // Avoid duplicates and check if already justified
                                const exists = employee.unjustifiedGaps.some(g => g.date === currentDateStr && g.start === gapStart);
                                if (!exists && !isFullyCovered) {
                                    employee.unjustifiedGaps.push({
                                        date: currentDateStr,
                                        start: gapStart,
                                        end: gapEnd
                                    });
                                }
                            }
                        }
                    }



                    // ... existing initialization ...

                    // Inside processing loop
                    // ...
                    if (nextMotivo === 14 && !isManualTajRange) {
                        const tajStart = parseDateTime(normalizeDateStr(nextRow.Fecha), normalizeTimeStr(nextRow.Hora));
                        let duration = 0;

                        if (j + 1 < len && isEntrada(allRows[j + 1].Entrada)) {
                            // Caso normal: TAJ con retorno
                            const tajEnd = parseDateTime(normalizeDateStr(allRows[j + 1].Fecha), normalizeTimeStr(allRows[j + 1].Hora));

                            // FIX: Use integer minutes to avoid "0.12h" for "6 mins" due to seconds
                            const startMin = tajStart.getHours() * 60 + tajStart.getMinutes();
                            const endMin = tajEnd.getHours() * 60 + tajEnd.getMinutes();
                            let diffMins = endMin - startMin;
                            if (diffMins < 0) diffMins += 1440; // Cross midnight check

                            duration = diffMins / 60;
                        } else {
                            // CASO ARTURO: TAJ al final de la jornada (sin retorno)
                            // Calculamos hasta el fin del turno teórico
                            const currentShiftCode = dailyShiftMap.get(currentDateStr) || 'M';
                            const bounds = getShiftBoundsMinutes(currentShiftCode);

                            const tajStartDate = parseDateTime(currentDateStr, normalizeTimeStr(nextRow.Hora));
                            const tajStartMin = tajStartDate.getHours() * 60 + tajStartDate.getMinutes();

                            let shiftEndMin = bounds.end;
                            if (shiftEndMin <= bounds.start) shiftEndMin += 1440; // Midnight cross

                            if (shiftEndMin > tajStartMin) {
                                duration = (shiftEndMin - tajStartMin) / 60;
                            }
                        }

                        if (duration > 0) {
                            employee.numTAJ++;
                            employee.hTAJ += duration;

                            // --- TRACK DAILY TAJ ---
                            const tDate = normalizeDateStr(nextRow.Fecha);
                            const currentTaj = dailyTajMap.get(tDate) || 0;
                            dailyTajMap.set(tDate, currentTaj + duration);
                        }
                    }
                    // ...

                    // Skip the paired exit row to avoid double-processing justified incidents
                    i = j + 1;
                } else {
                    // Entrada huérfana (sin salida)
                    // ⚠️ NUEVA LÓGICA: Verificar si hay incidencia que justifica hasta fin de jornada
                    const entryTime = extractTimeHHMM(currentRow.Hora);
                    const currentDateStr = normalizeDateStr(currentRow.Fecha);
                    const shiftCode = dailyShiftMap.get(currentDateStr) || currentRow.IDTipoTurno || currentRow.TurnoTexto || 'M';
                    const shiftBounds = getShiftBoundsMinutes(shiftCode);

                    // Buscar si hay incidencia (salida con motivo) después de esta entrada
                    let hasJustificationUntilEnd = false;
                    let justificationEndTime = '??:??';

                    for (let k = i + 1; k < len; k++) {
                        const futureRow = allRows[k];
                        if (normalizeDateStr(futureRow.Fecha) !== currentDateStr) break;

                        const futureMotivo = futureRow.MotivoAusencia;
                        // Si hay salida con incidencia (NO es 0, 1 o 14=TAJ)
                        if (isSalida(futureRow.Entrada) && futureMotivo && futureMotivo !== 1 && futureMotivo !== 14 && futureMotivo !== 0) {
                            const finStr = normalizeTimeStr(futureRow.Fin || '');
                            if (finStr && finStr !== '00:00') {
                                const finMin = toMinutes(finStr);
                                const shiftEndMin = shiftBounds.end >= shiftBounds.start ? shiftBounds.end : shiftBounds.end + 1440;

                                // Si la incidencia cubre hasta el fin de jornada (tolerancia ±5 min)
                                if (Math.abs(finMin - (shiftEndMin % 1440)) <= 5) {
                                    hasJustificationUntilEnd = true;
                                    justificationEndTime = finStr;
                                }
                            }
                            break;
                        }
                    }

                    employee.timeSlices.push({
                        start: entryTime,
                        end: hasJustificationUntilEnd ? justificationEndTime : '??:??',
                        endIsNextDay: false
                    });
                    sliceFestiveFlags.get(employeeId)?.push(false); // Orphan, doesn't matter

                    // Solo marcar como missing clock-out si NO hay justificación
                    if (!hasJustificationUntilEnd) {
                        const timestamp = `${currentDateStr} ${entryTime}`;
                        if (!employee.missingClockOuts.includes(timestamp)) {
                            employee.missingClockOuts.push(timestamp);
                        }
                    }
                    i++;
                }
            } else if (isSalida(currentRow.Entrada) && currentMotivo !== null && currentMotivo !== 1 && currentMotivo !== 14 && currentMotivo !== 0) {
                let absenceMinutes = 0;

                const currentDateStr = normalizeDateStr(currentRow.Fecha);
                const shiftCode = dailyShiftMap.get(currentDateStr) || currentRow.IDTipoTurno || currentRow.TurnoTexto || 'M';
                const shiftBounds = getShiftBoundsMinutes(shiftCode);

                const inicioStr = normalizeTimeStr(currentRow.Inicio || '');
                const finStr = normalizeTimeStr(currentRow.Fin || '');

                // 1. Duration from Inicio/Fin if present (Manual Period or ERP Period)
                if (inicioStr && finStr && inicioStr !== '00:00' && finStr !== '00:00') {
                    const startMin = toMinutes(inicioStr);
                    let endMin = toMinutes(finStr);
                    if (endMin < startMin) endMin += 1440;
                    absenceMinutes = clampToShiftMinutes(startMin, endMin, shiftBounds.start, shiftBounds.end);
                } else {
                    const horaStr = normalizeTimeStr(currentRow.Hora || '');
                    const isFullDayAbsence = !horaStr || horaStr === '00:00';

                    if (isFullDayAbsence) {
                        let shiftEnd = shiftBounds.end;
                        if (shiftEnd <= shiftBounds.start) shiftEnd += 1440;
                        absenceMinutes = Math.max(0, shiftEnd - shiftBounds.start);
                    } else {
                        // 2. Automated Gap Calculation (Exit -> Return or Shift End)
                        const exitTime = parseDateTime(currentDateStr, normalizeTimeStr(currentRow.Hora));
                        let returnTime: Date | null = null;

                        // Look for next entry on same day
                        let k = i + 1;
                        while (k < len) {
                            const futureRow = allRows[k];
                            if (normalizeDateStr(futureRow.Fecha) !== currentDateStr) break;
                            if (isEntrada(futureRow.Entrada)) {
                                returnTime = parseDateTime(currentDateStr, normalizeTimeStr(futureRow.Hora));
                                break;
                            }
                            k++;
                        }

                        if (!returnTime) {
                            // No return found today. Assume Shift End.
                            const shiftEndHour = shiftBounds.end;
                            const endDate = new Date(exitTime);
                            const endHour = Math.floor(shiftEndHour / 60) % 24;
                            const endMin = shiftEndHour % 60;
                            endDate.setHours(endHour, endMin, 0, 0);

                            if (endDate > exitTime) {
                                returnTime = endDate;
                            }
                        }

                        if (returnTime && returnTime > exitTime) {
                            const startMin = exitTime.getHours() * 60 + exitTime.getMinutes();
                            const endMin = returnTime.getHours() * 60 + returnTime.getMinutes();
                            absenceMinutes = clampToShiftMinutes(startMin, endMin, shiftBounds.start, shiftBounds.end);
                        }
                    }
                }

                const absenceHours = absenceMinutes / 60;

                const ma = currentMotivo;
                // Add to specific accumulators
                if (ma === 2) employee.hMedico += absenceHours;
                else if (ma === 3) employee.asOficiales += absenceHours;
                else if (ma === 4) employee.asPropios += absenceHours;
                else if (ma === 5) employee.hVacaciones += (absenceHours / 8);
                else if (ma === 6) employee.hEspecialistaAccidente += absenceHours;
                else if (ma === 7) employee.hLDisp += absenceHours;
                else if (ma === 8) {
                    if (currentRow.DescMotivoAusencia && currentRow.DescMotivoAusencia.toUpperCase().includes('ANTERIOR')) {
                        employee.hVacAnt += (absenceHours / 8);
                    } else {
                        employee.hVacaciones += (absenceHours / 8);
                    }
                }
                else if (ma === 9) employee.hSindicales += absenceHours;
                else if (ma === 10) {
                    employee.hITAT += absenceHours;
                }
                else if (ma === 11) { employee.hITEC += absenceHours; }
                else if (ma === 13) employee.hLeyFam += absenceHours;

                i++;
            } else if (isSalida(currentRow.Entrada) && (currentMotivo === null || currentMotivo === 0)) {
                // --- CASE 3: MIDDLE GAP DETECTION (UNJUSTIFIED EXIT) ---
                // User requirement: "El operario se va y vuelve"
                // Detect exits with No Reason (null/0) that are followed by an Entry on the same day.

                const currentDateStr = normalizeDateStr(currentRow.Fecha);
                const exitTime = parseDateTime(currentDateStr, normalizeTimeStr(currentRow.Hora));

                // Look ahead for next Entry
                let k = i + 1;
                let returnTime: Date | null = null;

                while (k < len) {
                    const futureRow = allRows[k];
                    if (normalizeDateStr(futureRow.Fecha) !== currentDateStr) break;
                    if (isEntrada(futureRow.Entrada)) {
                        returnTime = parseDateTime(currentDateStr, normalizeTimeStr(futureRow.Hora));
                        break;
                    }
                    k++;
                }

                if (returnTime && returnTime > exitTime) {
                    const diffMs = returnTime.getTime() - exitTime.getTime();
                    const diffMins = diffMs / 60000;

                    if (diffMins > 1) { // 1 minute threshold
                        const gapStart = normalizeTimeStr(currentRow.Hora);
                        const gapEnd = normalizeTimeStr(returnTime.toTimeString().substring(0, 5));

                        // 🆕 FIX: Verificar si este gap ya está cubierto por una incidencia
                        const gapStartMin = toMinutes(gapStart);
                        const gapEndMin = toMinutes(gapEnd);
                        const justifications = dailyJustifications.get(currentDateStr) || [];

                        let isFullyCovered = false;
                        for (const j of justifications) {
                            // Si la justificación cubre completamente el gap, no lo proponer
                            if (j.start <= gapStartMin && j.end >= gapEndMin) {
                                isFullyCovered = true;
                                break;
                            }
                        }
                        // Solo agregar gaps NO cubiertos
                        if (!isFullyCovered && !employee.unjustifiedGaps.some(g => g.date === currentDateStr && g.start === gapStart)) {
                            employee.unjustifiedGaps.push({ date: currentDateStr, start: gapStart, end: gapEnd });
                        }
                    }
                }
                if (k > i) {
                    i = k;
                } else {
                    i++;
                }
            } else {
                i++;
            }
        }

        if (employee.timeSlices.length > 0) {
            const firstSlice = employee.timeSlices[0];
            const lastSlice = employee.timeSlices[employee.timeSlices.length - 1];

            // 🔧 FIX: Para empleados flexibles con múltiples días, no mostrar rango consolidado
            // Solo mostrar rango si hay máximo 2 time slices (1 jornada simple)
            if (employee.isFlexible && employee.timeSlices.length > 2) {
                employee.horarioReal = `${employee.timeSlices.length} Intervalos`;
            } else {
                employee.horarioReal = formatTimeRange(firstSlice.start, lastSlice.end, lastSlice.endIsNextDay);
            }
        }

        if (shiftCounts.TN > shiftCounts.M) employee.turnoAsignado = 'TN';
        else employee.turnoAsignado = 'M';

        if (employee.isFlexible) {
            employee.unjustifiedGaps = [];
            employee.workdayDeviations = [];
            employee.numRetrasos = 0;
            employee.tiempoRetrasos = 0;
        }

        // 🔧 FIX: Post-proceso para turno TN con fichajes nocturnos
        // Si hay fichajes entre 00:00-06:00, pueden pertenecer al turno TN del día anterior
        // Esto evita marcar incorrectamente ese día como "ausencia completa"
        for (const dateStr of Array.from(datesWithActivity)) {
            const dateRows = rowsByDate.get(dateStr) || [];

            // Verificar si hay fichajes nocturnos (00:00-06:00)
            const hasNightPunches = dateRows.some(r => {
                const hour = parseDateTime(dateStr, normalizeTimeStr(r.Hora)).getHours();
                return hour >= 0 && hour < 6;
            });

            if (hasNightPunches) {
                // Calcular día anterior
                const prevDay = new Date(parseDateTime(dateStr, '00:00'));
                prevDay.setDate(prevDay.getDate() - 1);
                const prevDayStr = toISODateLocal(prevDay);

                // Verificar si el día anterior era turno TN
                const prevShift = dailyShiftMap.get(prevDayStr);
                if (prevShift === 'TN') {
                    // Marcar día anterior como con actividad
                    datesWithActivity.add(prevDayStr);
                }
            }
        }

        // Populate Shift Changes
        for (const [date, shift] of dailyShiftMap.entries()) {
            if (shift !== employee.turnoAsignado) {
                employee.shiftChanges.push({ date, shift });
            }
        }

        // --- Calculate EXCESOS (Time worked outside assigned schedule) ---
        // ⚠️ CRITICAL: Empleados FLEXIBLES NO tienen excesos (solo PRESENCIA y TAJ)
        if (employee.isFlexible) {
            employee.horasExceso = 0;
        } else {
            // Shift M: 07:00 (420m) - 15:00 (900m)
            // Shift TN: 15:00 (900m) - 23:00 (1380m)
            let totalExcesoMinutes = 0;

            const shiftStartMin = employee.turnoAsignado === 'TN' ? 900 : 420; // 15:00 vs 07:00
            const shiftEndMin = employee.turnoAsignado === 'TN' ? 1380 : 900;  // 23:00 vs 15:00

            const empFlags = sliceFestiveFlags.get(employee.operario) || [];

            employee.timeSlices.forEach((slice, idx) => {
                // SKIP IF FESTIVE (User Request: No excess on festive days)
                if (empFlags[idx]) return;

                let start = toMinutes(slice.start);
                let end = toMinutes(slice.end);

                // Handle next day end
                if (slice.endIsNextDay) end += 1440;
                // Handle cross-midnight start (extremely rare, but possible if slice started previous day? No, logic processes daily)

                // Duration of this slice
                const duration = end - start;
                if (duration <= 0) return;

                // Calculate Overlap with Schedule
                // Schedule window for this slice's day
                // Note: If shift is TN, window is 15:00 - 23:00.
                // If slice End is Next Day (e.g. 01:00), it means 25:00.
                // Check overlap [start, end] with [shiftStartMin, shiftEndMin]

                const overlapStart = Math.max(start, shiftStartMin);
                const overlapEnd = Math.min(end, shiftEndMin);

                let overlap = 0;
                if (overlapEnd > overlapStart) {
                    overlap = overlapEnd - overlapStart;
                }

                const excess = duration - overlap;
                if (excess > 0) totalExcesoMinutes += excess;
            });

            employee.horasExceso = Math.round((totalExcesoMinutes / 60 + Number.EPSILON) * 100) / 100;
        }


        // Sort shift changes by date
        employee.shiftChanges.sort((a, b) => a.date.localeCompare(b.date));

        for (const [date, totalHours] of dailyHoursMap.entries()) {
            // NEW CHECK: Include TAJ in the decision "Is Day Complete?"
            const dailyTaj = dailyTajMap.get(date) || 0;
            const effectiveTotal = totalHours + dailyTaj;

            // --- GAP SYNTHESIS: Intentar convertir esta falta de horas en un GAP específico ---
            // Si faltan horas, verificar si es por Entrada Tardía o Salida Anticipada y generar GAP si no existe
            const isDayIncomplete = effectiveTotal < (8 - 0.05);

            if (isDayIncomplete) {
                // 🔧 FIX CRÍTICO: Agrupar fichajes por JORNADA LÓGICA, no por fecha calendario
                // Para turno TN que cruza medianoche, incluir fichajes de madrugada del día siguiente

                // Determinar turno efectivo del día ANTES del filtro
                const effectiveShift = dailyShiftMap.get(date) || employee.turnoAsignado;

                // Calcular fecha del día siguiente
                const nextDay = new Date(parseISOToLocalDate(date));
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDayStr = toISODateLocal(nextDay);

                // Obtener fichajes del día actual
                let dayPunches = [...(rowsByDate.get(date) || [])];

                // Si es turno TN, incluir también fichajes de madrugada del día siguiente (< 12:00)
                if (effectiveShift === 'TN' || effectiveShift === 'T') {
                    const nextDayRows = rowsByDate.get(nextDayStr) || [];
                    const nextDayEarlyPunches = nextDayRows.filter(r => {
                        const hour = parseInt(normalizeTimeStr(r.Hora).substring(0, 2), 10);
                        return hour < 12; // Madrugada (00:00 - 11:59)
                    });
                    dayPunches = [...dayPunches, ...nextDayEarlyPunches];
                }

                // Sort by time
                dayPunches.sort((a, b) => normalizeTimeStr(a.Hora).localeCompare(normalizeTimeStr(b.Hora)));

                let sStart = '07:00';
                let sEnd = '15:00';
                if (effectiveShift === 'TN' || effectiveShift === 'T') {
                    sStart = '15:00';
                    sEnd = '23:00';
                }

                if (dayPunches.length > 0) {
                    const firstP = dayPunches.find(p => isEntrada(p.Entrada));
                    const lastP = [...dayPunches].reverse().find(p => isSalida(p.Entrada) || (!isEntrada(p.Entrada)));

                    // 1. Entrada Tardía Synthesized
                    if (firstP && normalizeTimeStr(firstP.Hora) > sStart) {
                        const gapStart = sStart;
                        const gapEnd = normalizeTimeStr(firstP.Hora);
                        const gapDiff = toMinutes(gapEnd) - toMinutes(gapStart);

                        if (gapDiff > 1 && !employee.unjustifiedGaps.some(g => g.date === date && g.start === gapStart)) {
                            const justifi = dailyJustifications.get(date) || [];
                            const isCovered = justifi.some(j => j.start <= toMinutes(gapStart) && j.end >= toMinutes(gapEnd));
                            if (!isCovered) {
                                employee.unjustifiedGaps.push({ date, start: gapStart, end: gapEnd });
                            }
                        }
                    }

                    // 2. Salida Anticipada Synthesized
                    // 🛑 FIX ROBUSTO TN: Normalizar horas para manejar cruce de medianoche
                    const lastPTimeStr = normalizeTimeStr(lastP.Hora); // "HH:MM"
                    let lastPMinutes = toMinutes(lastPTimeStr);
                    const sEndMinutes = toMinutes(sEnd); // 23:00 -> 1380

                    // Manejo de cruce de medianoche para Turno TN
                    // Si es turno TN (15:00-23:00) y la hora es de madrugada (< 12:00),
                    // significa que es del día siguiente lógico (ej: 02:00 AM -> 26:00)
                    if ((effectiveShift === 'TN' || effectiveShift === 'T') && lastPMinutes < 720) { // 720 min = 12:00
                        lastPMinutes += 1440; // +24h
                    }

                    // Ajustar también el fin de turno si fuera necesario (aunque 23:00 es < 24h, 
                    // pero si fuera turno de noche real N: 23:00-07:00, sEnd seria 07:00 del dia siguiente)
                    // Para TN: sEnd es 23:00 (1380). No cruza medianoche nominalmente, pero la SALIDA puede cruzarla.

                    // Solo si la hora (ajustada) es MENOR que el fin del turno con margen
                    if (lastPMinutes < sEndMinutes) {
                        // FIX: Verificar también que sea el mismo día (para turnos normales)

                        const gapStart = lastPTimeStr.substring(0, 5);
                        const gapEnd = sEnd;
                        const gapDiff = sEndMinutes - lastPMinutes;

                        if (gapDiff > 1 && !employee.unjustifiedGaps.some(g => g.date === date && g.end === gapEnd)) {
                            // ... logica de justificacion ...
                            const justifi = dailyJustifications.get(date) || [];



                            // Verificar cobertura con minutos ajustados si cruza medianoche
                            // PERO: dailyJustifications está normalizado al día en curso o día siguiente?
                            // Las justificaciones se guardan con minutos absolutos (0-1440). 
                            // Si la justificación cruza medianoche, hay que ver cómo se guardó.
                            // Asumamos lógica estándar intra-día por ahora, el caso crítico es NO generar gap si saliste a las 02:00.
                            // Si saliste a las 02:00 (26:00), 2600 > 1380, así que NO entra aquí. CORRECTO.

                            const gStartMin = toMinutes(gapStart);
                            const gEndMin = toMinutes(gapEnd);

                            const isCovered = justifi.some(j => j.start <= gStartMin && j.end >= gEndMin);
                            if (!isCovered) {
                                employee.unjustifiedGaps.push({ date, start: gapStart, end: gapEnd });
                            }
                        }
                    }

                }


                // --- FINAL DECISION ON WORKDAY DEVIATION ---
                // After Gap Synthesis, we check if there are ANY unjustified gaps for this date
                const dateGaps = employee.unjustifiedGaps.filter(g => g.date === date);
                const hasGaps = dateGaps.length > 0;
                const hasJustification = dailyJustificationMap.has(date);

                // USER RULE: Si tiene TAJ y NO tiene SALTOS (gaps), NO propongas incidencia de jornada incompleta
                const skipDeviationBecauseTaj = (dailyTaj > 0 && !hasGaps);

                if (isDayIncomplete && !hasJustification && !skipDeviationBecauseTaj) {
                    if (!employee.workdayDeviations.some(d => d.date === date)) {
                        const dayPunches = rowsByDate.get(date) || [];
                        const firstP = dayPunches.find(p => isEntrada(p.Entrada));
                        const lastP = [...dayPunches].reverse().find(p => isSalida(p.Entrada) || (!isEntrada(p.Entrada)));

                        employee.workdayDeviations.push({
                            date: date,
                            actualHours: totalHours,
                            start: firstP ? normalizeTimeStr(firstP.Hora) : undefined,
                            end: lastP ? normalizeTimeStr(lastP.Hora) : undefined
                        });
                    }
                }
            }

            // ══════════════════════════════════════════════════════════════════════
            // CÁLCULO DE COLUMNAS PRINCIPALES (Según 07_calculo_columnas_principales.md)
            // ══════════════════════════════════════════════════════════════════════
            // Helper
            const toHoursRounded = (mins: number): number => {
                return Math.round((mins / 60 + Number.EPSILON) * 100) / 100;
            };

            // 1. Prepare Components (Rounded)
            const tajMinutes = Math.round(employee.hTAJ * 60);
            employee.hTAJ = toHoursRounded(tajMinutes);

            // 2. JUSTIFICADA: Calculate FIRST (needed for PRESENCIA calculation)
            // Sum all absence types EXCEPT TAJ (14) and normal shifts (00, 01)
            const rawJustified =
                employee.hMedico +
                employee.asOficiales +
                employee.asPropios +
                employee.hEspecialistaAccidente +
                employee.hLDisp +
                employee.hLeyFam +
                employee.hSindicales +
                (employee.hVacaciones * 8) +
                (employee.hVacAnt * 8) +
                employee.hITAT +
                employee.hITEC;

            const justifiedMinutes = Math.round(rawJustified * 60);
            employee.horasJustificadas = toHoursRounded(justifiedMinutes);

            // 3. PRESENCIA: Base Work Hours (Regular + Festive) - TAJ
            // CRITICAL FIX FOR JOB MANAGEMENT: Saturday/Festive work must be included in Presence
            // so the audit doesn't show 0h worked.
            // Presence is purely calculated from actual work punches (minus TAJ).
            let rawWorkHours = 0;
            const dailyWorkedMinutes = Array.from(dailyHoursMap.values()).reduce((acc, h) => acc + Math.round(h * 60), 0);

            // 🔧 FIX: Empleados flexibles pueden trabajar en múltiples franjas
            if (employee.isFlexible) {
                // Para flexibles, usar el acumulado diario neto tras restar justificaciones,
                // sin depender de buckets de turno (que pueden no cubrir todas las franjas reales).
                rawWorkHours = toHoursRounded(dailyWorkedMinutes);
            } else if (employee.turnoAsignado === 'M') {
                rawWorkHours = employee.horasDia;
            } else {
                rawWorkHours = employee.horasTarde;
            }

            // Work already excludes TAJ gaps for regular days.
            // For festive days, 'festivas' includes both work and TAJ, so we subtract 'festiveTaj'.
            const presenceMinutes = employee.isFlexible
                ? Math.round(rawWorkHours * 60)
                : Math.round((rawWorkHours + employee.festivas - (employee.festiveTaj || 0)) * 60);
            employee.presencia = toHoursRounded(presenceMinutes);

            // 4. TOTAL: Sum of Visual Components
            // REGLA DE ORO: TOTAL = PRESENCIA + JUSTIFICADAS + TAJ
            // Note: Since 'presencia' now includes work done on festive days, 
            // the formula simplifies and remains consistent across all days.
            const currentTotal =
                employee.presencia +
                employee.horasJustificadas +
                employee.hTAJ;

            employee.horasTotalesConJustificacion = Number(currentTotal.toFixed(2));

            // totalHoras (Bruto - solo informativo)
            const rawTotalWorked =
                employee.horasDia +
                employee.horasTarde +
                employee.nocturnas +
                employee.excesoJornada1 +
                employee.festivas;
            employee.totalHoras = Math.round((rawTotalWorked + Number.EPSILON) * 100) / 100;

            // --- Detect Vacation Conflicts (NEW: Cambio 1) ---
            // Check if employee has vacations (TipoDiaEmpresa = 2) on days they also have punches
            const vacationDates = new Set<string>();
            const normalPunchDates = new Set<string>();
            const sickLeaveDates = new Set<string>();

            allRows.forEach(r => {
                const dateKey = normalizeDateStr(r.Fecha);
                const ma = getMotivoAusencia(r.MotivoAusencia);

                if (r.TipoDiaEmpresa === 2) {
                    vacationDates.add(dateKey);
                }

                if (isEntrada(r.Entrada) && (ma === null || ma === 0 || ma === 1)) {
                    normalPunchDates.add(dateKey);
                }

                if (ma === 10 || ma === 11) {
                    sickLeaveDates.add(dateKey);
                }
            });

            vacationDates.forEach(vDate => {
                if (normalPunchDates.has(vDate) && !employee.vacationConflicts!.includes(vDate)) {
                    employee.vacationConflicts!.push(vDate);
                }
            });

            // Sort conflicts for display
            if (employee.vacationConflicts!.length > 0) {
                employee.vacationConflicts!.sort();
            }

            // --- Absent Days Calculation ---
            const start = new Date(analysisStart);
            const end = new Date(analysisEnd);
            const curr = new Date(start);
            let absentGuard = 0;
            const employeeCalendarMap = employeeCalendars?.get(employeeId);
            const gapDates = new Set(employee.unjustifiedGaps.map(g => g.date));
            const deviationDates = new Set(employee.workdayDeviations.map(d => d.date));
            const missingClockOutSet = new Set(employee.missingClockOuts || []);

            while (curr <= end) {
                absentGuard++;
                if (absentGuard > 4000) {
                    console.error('[AbsentDays] Guard limit reached, breaking loop.', { employeeId, analysisStart: analysisStartStr, analysisEnd: analysisEndStr });
                    break;
                }
                const dayOfWeek = curr.getDay();
                const dateStr = toISODateLocal(curr);

                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    if (!effectiveHolidays.has(dateStr)) {
                        // CRITICAL FIX 2: Check if analysis window actually covers the shift start for this day
                        // If reports ends at 03:00 and shift starts at 15:00, we should NOT mark absent.
                        // Determine shift for this specific date
                        let dateShift = 'M';
                        // Try to find if we assigned a shift logic earlier for this day? 
                        // We don't have per-day shift map here easily accessible outside the loop unless we stored it.
                        // 'dailyShiftMap' was local to the loop. 
                        // Fallback: Check employee default or check if there are punches (logic circular).
                        // Better: Use employee.turnoAsignado as approximation, OR check 'expected' start.

                        let shiftStartHour = 7;
                        if (employee.turnoAsignado === 'TN') shiftStartHour = 15;

                        const shiftStartDate = new Date(curr);
                        shiftStartDate.setHours(shiftStartHour, 0, 0, 0);

                        // If the Analysis END is BEFORE the Shift Start, ignore this day.
                        if (analysisEnd >= shiftStartDate) {
                            // CRITICAL FIX: Ensure day is not marked absent if there is ANY activity, 
                            // or if identified as having gaps/modifications/missing-outs.
                            const hasActivity = datesWithActivity.has(dateStr);
                            const hasGaps = gapDates.has(dateStr);
                            const hasDeviations = deviationDates.has(dateStr);
                            const hasMissingOut = missingClockOutSet.has(dateStr);

                            // ✅ NUEVO (Bug Fix): Verificar si el empleado tiene vacaciones ese día
                            // Primero verificar en el calendario del empleado (TipoDia=2)
                            // Si no hay calendario, verificar en fichajes (TipoDiaEmpresa=2)
                            let hasVacation = false;

                            if (employeeCalendarMap) {
                                const tipoDia = employeeCalendarMap.get(dateStr);
                                hasVacation = String(tipoDia) === '2'; // TipoDia=2 => Vacaciones
                            }

                            // Fallback: verificar en los datos de fichajes
                            if (!hasVacation) {
                                hasVacation = vacationDates.has(dateStr);
                            }

                            // ⚠️ CRITICAL FIX #2: Verificar si el empleado tiene BAJA MÉDICA activa ese día (ITAT=10 o ITEC=11)
                            const hasSickLeave = sickLeaveDates.has(dateStr);

                            if (!hasActivity && !hasGaps && !hasDeviations && !hasMissingOut && !hasVacation && !hasSickLeave) {
                                employee.absentDays.push(dateStr);
                            }
                        }
                    }
                }

                curr.setDate(curr.getDate() + 1);
            }
        }
    }


    // Calculate accumulated values for all employees
    for (const processed of resultsMap.values()) {
        processed.acumVacaciones = processed.hVacaciones;
        processed.acumMedico = processed.hMedico;
        processed.acumHLDisp = processed.hLDisp;
        processed.acumHLF = processed.hLeyFam;

        processed.dispMedico = ANNUAL_CREDITS.MEDICO_HOURS - processed.acumMedico;
        processed.dispVacaciones = ANNUAL_CREDITS.VACATION_DAYS - processed.acumVacaciones;
        processed.dispHLDisp = ANNUAL_CREDITS.LIBRE_DISPOSICION_HOURS - processed.acumHLDisp;
        processed.dispHLF = ANNUAL_CREDITS.LEY_FAMILIAS_HOURS - processed.acumHLF;
    }

    return resultsMap;
};

export const processData = (
    rawData: RawDataRow[],
    allUsers: User[],
    employeeId?: number,
    analysisRange?: { start: Date, end: Date },
    holidays?: Set<string>,
    employeeCalendars?: Map<number, Map<string, number>> // Map<employeeId, Map<date, TipoDia>>
): ProcessedDataRow[] => {
    const processedDataMap = generateProcessedData(rawData, allUsers, analysisRange, holidays, employeeCalendars);
    if (employeeId) {
        const employeeData = processedDataMap.get(employeeId);
        return employeeData ? [employeeData] : [];
    }
    return Array.from(processedDataMap.values());
};
