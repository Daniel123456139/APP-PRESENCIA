import { RawDataRow, ProcessedDataRow, UnjustifiedGap, WorkdayDeviation, Shift, User } from '../types';
import { ANNUAL_CREDITS } from '../constants';
// MOCK_USERS removed
import { resolveTurno } from '../utils/turnoResolver';

import { formatTimeRange } from '../utils/shiftClassifier';
import { EXCLUDE_EMPLOYEE_IDS } from '../config/exclusions';
import { toISODateLocal, parseISOToLocalDate, parseLocalDateTime } from '../utils/localDate';
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

    // 0. Detectar festivos en los datos crudos (TipoDiaEmpresa = 1)
    const effectiveHolidays = new Set<string>(settingsHolidays);
    rawData.forEach(row => {
        if (row.TipoDiaEmpresa === 1) {
            effectiveHolidays.add(row.Fecha);
        }
    });

    let rangeStartDateStr = '';
    let rangeEndDateStr = '';
    let analysisStart: Date;
    let analysisEnd: Date;

    if (analysisRange) {
        rangeStartDateStr = toISODateLocal(analysisRange.start);
        rangeEndDateStr = toISODateLocal(analysisRange.end);
        analysisStart = analysisRange.start;
        analysisEnd = analysisRange.end;
    } else {
        let min = '9999-99-99';
        let max = '0000-00-00';
        rawData.forEach(r => {
            if (r.Fecha < min) min = r.Fecha;
            if (r.Fecha > max) max = r.Fecha;
        });
        rangeStartDateStr = min;
        rangeEndDateStr = max;
        analysisStart = parseISOToLocalDate(min);
        analysisEnd = parseISOToLocalDate(max);
        analysisEnd.setHours(23, 59, 59, 999);
    }

    // 1. Group by Employee
    const dataByEmployee = new Map<number, RawDataRow[]>();
    const sliceFestiveFlags = new Map<number, boolean[]>(); // Stores isFestive flag for each timeSlice index
    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowId = Number(row.IDOperario);
        if (EXCLUDE_EMPLOYEE_IDS.has(rowId)) continue;

        if (row.Fecha < rangeStartDateStr) continue;
        if (row.Fecha > rangeEndDateStr) continue;

        // STRICT TIME FILTER:
        // Ignore ENTRIES that occur strictly AFTER the analysis end time.
        // Exits are allowed to pass to complete ongoing shifts (e.g. night shift ending at 06:00 when filter ends at 02:00).
        if (analysisRange && isEntrada(row.Entrada)) {
            const rowDateTime = parseDateTime(row.Fecha, row.Hora);
            if (rowDateTime > analysisEnd) continue;
        }

        let rows = dataByEmployee.get(rowId);
        if (!rows) {
            rows = [];
            dataByEmployee.set(rowId, rows);
        }
        rows.push(row);
    }



    const getOrCreateEmployee = (id: number, sampleRow?: RawDataRow): ProcessedDataRow => {
        if (resultsMap.has(id)) return resultsMap.get(id)!;
        const user = userMap.get(id);
        const newEmployee: ProcessedDataRow = {
            operario: id,
            nombre: user?.name || sampleRow?.DescOperario || `Operario ${id}`,
            colectivo: sampleRow?.DescDepartamento || user?.department || 'General',
            turnoAsignado: 'M',
            horarioReal: '-',
            timeSlices: [],
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
            numTAJ: 0, hTAJ: 0,
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
        if (user.appRole !== 'HR' && !EXCLUDE_EMPLOYEE_IDS.has(user.id)) {
            getOrCreateEmployee(user.id);
        }
    });

    // Also initialize from raw data (fallback if user list is incomplete or empty)
    for (const [id, rows] of dataByEmployee.entries()) {
        if (!EXCLUDE_EMPLOYEE_IDS.has(id)) {
            // Sort rows by Date and Time to ensure we have chronological order
            // This is crucial for determining the current Department (using the latest record)
            const sortedRows = [...rows].sort((a, b) => {
                if (a.Fecha !== b.Fecha) return a.Fecha < b.Fecha ? -1 : 1;
                return a.Hora.localeCompare(b.Hora);
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
            if (a.Fecha !== b.Fecha) return a.Fecha < b.Fecha ? -1 : 1;
            return a.Hora.localeCompare(b.Hora);
        });

        const normalizeDateStr = (raw: string): string => {
            if (!raw) return '1970-01-01';
            return raw.replace('T', ' ').split(' ')[0];
        };

        const normalizeTimeStr = (raw: string): string => {
            if (!raw) return '00:00';
            let t = raw;
            // Si contiene separador de fecha/hora
            if (t.includes('T')) t = t.split('T')[1];
            else if (t.includes(' ') && t.includes(':')) {
                // Asumimos formato "YYYY-MM-DD HH:MM:SS" -> tomamos la parte de la hora
                t = t.split(' ')[1];
            }
            return t.substring(0, 5);
        };

        const isAbsenceExitRow = (row: RawDataRow): boolean => {
            return isSalida(row.Entrada) &&
                row.MotivoAusencia !== null &&
                row.MotivoAusencia !== 1 &&
                row.MotivoAusencia !== 14 &&
                row.MotivoAusencia !== 0;
        };

        const isTimeNearMinutes = (timeA: string, timeB: string, toleranceMinutes: number): boolean => {
            const a = toMinutes(normalizeTimeStr(timeA));
            const b = toMinutes(normalizeTimeStr(timeB));
            return Math.abs(a - b) <= toleranceMinutes;
        };

        // --- PRE-CALCULAR INTERVALOS JUSTIFICADOS DEL DÍA ---
        // Necesitamos esto para que la detección de retrasos ignore tiempos ya cubiertos por una incidencia.
        const dailyJustifications = new Map<string, { start: number, end: number }[]>();
        allRows.forEach(r => {
            if (isSalida(r.Entrada) && r.MotivoAusencia !== null && r.MotivoAusencia !== 1 && r.MotivoAusencia !== 14 && r.MotivoAusencia !== 0) {
                const ini = normalizeTimeStr(r.Inicio || '');
                const fin = normalizeTimeStr(r.Fin || '');
                if (ini && fin && ini !== '00:00' && fin !== '00:00') {
                    const s = toMinutes(ini);
                    const e = toMinutes(fin);
                    const dateKey = normalizeDateStr(r.Fecha);
                    if (!dailyJustifications.has(dateKey)) dailyJustifications.set(dateKey, []);
                    dailyJustifications.get(dateKey)!.push({ start: s, end: e });
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


        // ...

        while (i < len) {
            const currentRow = allRows[i];
            // 🛑 CRITICAL FIX: Normalizar Fecha y Hora robustamente
            // El backend puede enviar "2026-01-16 00:00:00" en Fecha y timestamp completo en Hora
            const currentDateStr = normalizeDateStr(currentRow.Fecha);
            const currentHoraStr = normalizeTimeStr(currentRow.Hora);

            datesWithActivity.add(currentDateStr);

            if (currentRow.MotivoAusencia !== null && currentRow.MotivoAusencia !== 1 && currentRow.MotivoAusencia !== 14) {
                dailyJustificationMap.add(currentDateStr);
            }

            if (isEntrada(currentRow.Entrada)) {
                // Usar fecha y hora normalizadas
                const currentDateObj = parseDateTime(currentDateStr, currentHoraStr);
                let j = i + 1;
                let nextRow = null;

                while (j < len) {
                    const row = allRows[j];
                    if (isSalida(row.Entrada)) {
                        nextRow = row;
                        const rowDateNormal = normalizeDateStr(row.Fecha); // Normalizar también aquí para check diario
                        if (row.MotivoAusencia !== null && row.MotivoAusencia !== 1 && row.MotivoAusencia !== 14) {
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

                // 🔍 DEBUG MARIO (047)
                if (employeeId === 47 && currentDateStr === '2026-01-16') {
                    console.log('🐞 MARIO DEBUG ENTRY:', {
                        shiftCode: currentShiftCode,
                        shiftStart: assignedShift?.start,
                        isFirstEntry: (!allRows[i - 1] || allRows[i - 1].Fecha !== currentDateStr)
                    });
                }

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

                            // Log debug if Mario
                            if (employeeId === 47) {
                                console.log('🚨 MARIO DETECTED GAP (Caso 2 - Entrada tardía):', { start: assignedShift.start, end: currentHoraStr });
                            }
                        }
                    }
                }

                if (nextRow) {
                    const endTime = parseDateTime(nextRow.Fecha, nextRow.Hora);

                    const nextInicioStr = normalizeTimeStr(nextRow.Inicio || '');
                    const nextFinStr = normalizeTimeStr(nextRow.Fin || '');
                    const hasAbsenceRange = nextInicioStr && nextFinStr && nextInicioStr !== '00:00' && nextFinStr !== '00:00';
                    const isManualTajRange = nextRow.MotivoAusencia === 14 && hasAbsenceRange &&
                        isTimeNearMinutes(currentHoraStr, nextInicioStr, 1) &&
                        isTimeNearMinutes(normalizeTimeStr(nextRow.Hora), nextFinStr, 1);
                    const isSyntheticAbsencePair = (isAbsenceExitRow(nextRow) && hasAbsenceRange &&
                        isTimeNearMinutes(currentHoraStr, nextInicioStr, 1) &&
                        isTimeNearMinutes(normalizeTimeStr(nextRow.Hora), nextFinStr, 1)) || isManualTajRange;

                    if (endTime > currentDateObj) {
                        let effectiveStart = currentDateObj;
                        let effectiveEnd = endTime;

                        // --- LOGICA DE CORTESIA (Snap to Start) ---
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

                        const durationMs = effectiveEnd.getTime() - effectiveStart.getTime();
                        let durationHours = durationMs / 3600000;

                        // CRITICAL FIX: Detectar si es un par de justificación (Entrada -> SalidaConMotivo)
                        // Si es así, sumar a acumuladores de justificación y NO a horas de trabajo (horasDia/timeSlices)
                        const isJustifiedPair = isAbsenceExitRow(nextRow) || isManualTajRange;

                        if (isJustifiedPair && durationHours > 0) {
                            const ma = nextRow.MotivoAusencia;
                            if (ma === 2) employee.hMedico += durationHours;
                            else if (ma === 3) employee.asOficiales += durationHours;
                            else if (ma === 4) employee.asPropios += durationHours;
                            else if (ma === 5) employee.hVacaciones += (durationHours / 8);
                            else if (ma === 6) employee.hEspecialistaAccidente += durationHours;
                            else if (ma === 7) employee.hLDisp += durationHours;
                            else if (ma === 8) {
                                if (nextRow.DescMotivoAusencia && nextRow.DescMotivoAusencia.toUpperCase().includes('ANTERIOR')) {
                                    employee.hVacAnt += (durationHours / 8);
                                } else {
                                    employee.hVacaciones += (durationHours / 8);
                                }
                            }
                            else if (ma === 9) employee.hSindicales += durationHours;
                            else if (ma === 10) employee.hITAT += durationHours;
                            else if (ma === 11) employee.hITEC += durationHours;
                            else if (ma === 13) employee.hLeyFam += durationHours;
                            else if (ma === 14) {
                                // NEW: Manual TAJ Recording (Incidencia 14 insertada a mano)
                                employee.hTAJ += durationHours;
                                employee.numTAJ += 1;
                            }

                            // Justified time does NOT go to dailyHoursMap or timeSlices
                        }
                        else if (!isSyntheticAbsencePair && durationHours > 0) {
                            // FIX: Prevent Double Counting (Presence vs Justification Overlap)
                            // If this presence slice overlaps with known justifications, subtract the overlap from Presence.
                            // Justification takes precedence effectively in the sum (because we count it fully above).
                            // But reality: Presence should probably be reality. However, for "Justification pairs" (synthetic),
                            // they represent "Time I claim I was doing X". If I was working, I shouldn't claim.
                            // In the specific bug case (Entry 11:56, Justified until 11:57), the user considers 8.02h wrong.
                            // Subtracting overlap ensures 8.00h.

                            const presenceStartMin = effectiveStart.getHours() * 60 + effectiveStart.getMinutes();
                            const presenceEndMin = effectiveEnd.getHours() * 60 + effectiveEnd.getMinutes();
                            const justifications = dailyJustifications.get(currentDateStr) || [];

                            let overlapMins = 0;
                            justifications.forEach(j => {
                                const oStart = Math.max(presenceStartMin, j.start);
                                const oEnd = Math.min(presenceEndMin, j.end);
                                if (oEnd > oStart) {
                                    overlapMins += (oEnd - oStart);
                                }
                            });

                            if (overlapMins > 0) {
                                const overlapHours = overlapMins / 60;
                                // Reducimos la duración efectiva de presencia para evitar doble conteo
                                durationHours = Math.max(0, durationHours - overlapHours);
                                // Optional: Log warning if significant?
                            }

                            const currentDayTotal = dailyHoursMap.get(currentDateStr) || 0;
                            dailyHoursMap.set(currentDateStr, currentDayTotal + durationHours);

                            const isNextDay = endTime.getDate() !== currentDateObj.getDate();
                            employee.timeSlices.push({
                                start: currentRow.Hora.substring(0, 5),
                                end: nextRow.Hora.substring(0, 5),
                                endIsNextDay: isNextDay
                            });

                            const startHour = effectiveStart.getHours();
                            const isWeekend = effectiveStart.getDay() === 0; // Only Sunday is weekend
                            const isHoliday = effectiveHolidays.has(toISODateLocal(effectiveStart));
                            const isFestive = isWeekend || isHoliday;

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

                                // Definir límites horarios
                                const bound00 = new Date(startYear, startMonth, startDay, 0, 0, 0);
                                const bound06 = new Date(startYear, startMonth, startDay, 6, 0, 0);
                                const bound07 = new Date(startYear, startMonth, startDay, 7, 0, 0);
                                const bound15 = new Date(startYear, startMonth, startDay, 15, 0, 0);
                                const bound20 = new Date(startYear, startMonth, startDay, 20, 0, 0);
                                const bound23 = new Date(startYear, startMonth, startDay, 23, 0, 0);
                                const bound06Next = new Date(startYear, startMonth, startDay + 1, 6, 0, 0);

                                // Nocturnas (20:00 - 06:00)
                                const hNocturnasMadrugada = getOverlapHours(effectiveStart, effectiveEnd, bound00, bound06);
                                const hNocturnasNoche = getOverlapHours(effectiveStart, effectiveEnd, bound20, bound06Next);
                                const totalNocturnas = hNocturnasMadrugada + hNocturnasNoche;

                                employee.nocturnas += totalNocturnas;

                                if (currentShiftCode === 'TN') {
                                    // Turno Tarde (15:00 - 23:00)
                                    // Horas Tarde = Intersección con 15:00-23:00
                                    const hTarde = getOverlapHours(effectiveStart, effectiveEnd, bound15, bound23);
                                    employee.horasTarde += hTarde;

                                    // El resto diurno que no sea tarde ni nocturna podría caer fuera
                                    // Pero según specs TN: 15:00-23:00.
                                } else {
                                    // Turno Mañana (07:00 - 15:00)
                                    // Horas Dia = Intersección con 07:00-15:00
                                    const hDia = getOverlapHours(effectiveStart, effectiveEnd, bound07, bound15);
                                    employee.horasDia += hDia;

                                    // Exceso Jornada 1 (15:00 - 20:00)
                                    // OJO: employee.excesoJornada1 se calculaba al final, pero es mejor acumularlo aquí?
                                    // El array employee.timeSlices ya se usa abajo (L775) para calcular excesos.
                                    // SIN EMBARGO, para que PRESENCIA sea correcta, 'horasDia' NO debe tener el exceso.
                                    // Con este cambio, horasDia solo tendrá lo de 07-15.

                                    // NOTA: 'hDiurnas' anterior incluía todo. 
                                    // Aquí forzamos que horasDia sea SOLO la parte dentro del turno.
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
                    if (nextRow.MotivoAusencia !== 14) {
                        let k = j + 1;
                        let futureEntry = null;
                        while (k < len) {
                            if (isEntrada(allRows[k].Entrada)) {
                                futureEntry = allRows[k];
                                break;
                            }
                            k++;
                        }

                        if (futureEntry) {
                            const gapStart = parseDateTime(nextRow.Fecha, nextRow.Hora);
                            const gapEnd = parseDateTime(futureEntry.Fecha, futureEntry.Hora);
                            const gapDurationMs = gapEnd.getTime() - gapStart.getTime();

                            if (gapDurationMs < 18000000 && gapDurationMs > 60000) {
                                const exitHour = gapStart.getHours();
                                const exitMin = gapStart.getMinutes();
                                let isActionableGap = true;

                                if (currentShiftCode === 'M') {
                                    if (exitHour >= 15 || (exitHour === 14 && exitMin >= 59)) isActionableGap = false; // Tolerancia 1 min
                                } else if (currentShiftCode === 'TN') {
                                    const gapStartIsNextDay = gapStart.getDate() !== currentDateObj.getDate();
                                    if (exitHour >= 6 && exitHour < 14) {
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
                            const exitDate = parseDateTime(nextRow.Fecha, nextRow.Hora);
                            let shiftEndHour = 15;
                            if (currentShiftCode === 'TN') shiftEndHour = 23;

                            const shiftEndDate = new Date(exitDate);
                            shiftEndDate.setHours(shiftEndHour, 0, 0, 0);

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
                    if (nextRow.MotivoAusencia === 14 && !isManualTajRange) {
                        const tajStart = parseDateTime(nextRow.Fecha, nextRow.Hora);
                        let duration = 0;

                        if (j + 1 < len && isEntrada(allRows[j + 1].Entrada)) {
                            // Caso normal: TAJ con retorno
                            const tajEnd = parseDateTime(allRows[j + 1].Fecha, allRows[j + 1].Hora);

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

                            const tajStartDate = parseDateTime(currentDateStr, nextRow.Hora);
                            const tajStartMin = tajStartDate.getHours() * 60 + tajStartDate.getMinutes();

                            let shiftEndMin = bounds.end;
                            if (shiftEndMin <= bounds.start) shiftEndMin += 1440; // Midnight cross

                            if (shiftEndMin > tajStartMin) {
                                duration = (shiftEndMin - tajStartMin) / 60;
                            }
                        }

                        if (duration > 0 && duration < 9) { // Aumentado a 9 por seguridad jornada completa
                            employee.numTAJ++;
                            employee.hTAJ += duration;

                            // --- TRACK DAILY TAJ ---
                            const tDate = normalizeDateStr(nextRow.Fecha);
                            const currentTaj = dailyTajMap.get(tDate) || 0;
                            dailyTajMap.set(tDate, currentTaj + duration);
                        }
                    }
                    // ...

                    i = j;
                } else {
                    employee.timeSlices.push({
                        start: currentRow.Hora.substring(0, 5),
                        end: '??:??',
                        endIsNextDay: false
                    });
                    sliceFestiveFlags.get(employeeId)?.push(false); // Orphan, doesn't matter

                    const timestamp = `${currentRow.Fecha} ${currentRow.Hora.substring(0, 5)}`;
                    if (!employee.missingClockOuts.includes(timestamp)) {
                        employee.missingClockOuts.push(timestamp);
                    }
                    i++;
                }
            } else if (isSalida(currentRow.Entrada) && currentRow.MotivoAusencia !== 1 && currentRow.MotivoAusencia !== 14 && currentRow.MotivoAusencia !== 0 && currentRow.MotivoAusencia !== null) {
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
                    const isFullDayAbsence = horaStr === '00:00' || horaStr === '00:00:00' || !horaStr;

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

                const ma = currentRow.MotivoAusencia;
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
            } else if (isSalida(currentRow.Entrada) && (currentRow.MotivoAusencia === null || currentRow.MotivoAusencia === 0)) {
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
                        // Push to Unjustified Gaps
                        const gapStart = normalizeTimeStr(currentRow.Hora).substring(0, 5);
                        const gapEnd = normalizeTimeStr(returnTime.toTimeString().substring(0, 5)).substring(0, 5);

                        // Avoid duplicates if already processed
                        if (!employee.unjustifiedGaps.some(g => g.date === currentDateStr && g.start === gapStart)) {
                            employee.unjustifiedGaps.push({ date: currentDateStr, start: gapStart, end: gapEnd });
                        }
                    }
                }
                i++;
            } else {
                i++;
            }
        }

        if (employee.timeSlices.length > 0) {
            const firstSlice = employee.timeSlices[0];
            const lastSlice = employee.timeSlices[employee.timeSlices.length - 1];
            employee.horarioReal = formatTimeRange(firstSlice.start, lastSlice.end, lastSlice.endIsNextDay);
        }

        if (shiftCounts.TN > shiftCounts.M) employee.turnoAsignado = 'TN';
        else employee.turnoAsignado = 'M';

        // Populate Shift Changes
        for (const [date, shift] of dailyShiftMap.entries()) {
            if (shift !== employee.turnoAsignado) {
                employee.shiftChanges.push({ date, shift });
            }
        }

        // --- Calculate EXCESOS (Time worked outside assigned schedule) ---
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
                const dayPunches = allRows.filter(r => normalizeDateStr(r.Fecha) === date);
                // Sort by time
                dayPunches.sort((a, b) => normalizeTimeStr(a.Hora).localeCompare(normalizeTimeStr(b.Hora)));

                // Determinar turno efectivo del día
                const effectiveShift = dailyShiftMap.get(date) || employee.turnoAsignado;
                let sStart = '07:00';
                let sEnd = '15:00';
                if (effectiveShift === 'TN') {
                    sStart = '15:00';
                    sEnd = '23:00';
                }

                if (dayPunches.length > 0) {
                    const firstP = dayPunches.find(p => isEntrada(p.Entrada));
                    const lastP = [...dayPunches].reverse().find(p => isSalida(p.Entrada) || (!isEntrada(p.Entrada)));

                    // 1. Entrada Tardía Synthesized
                    if (firstP && normalizeTimeStr(firstP.Hora) > sStart) {
                        const gapStart = sStart;
                        const gapEnd = normalizeTimeStr(firstP.Hora).substring(0, 5);
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
                    if (lastP && normalizeTimeStr(lastP.Hora) < sEnd) {
                        const gapStart = normalizeTimeStr(lastP.Hora).substring(0, 5);
                        const gapEnd = sEnd;
                        const gapDiff = toMinutes(gapEnd) - toMinutes(gapStart);

                        if (gapDiff > 1 && !employee.unjustifiedGaps.some(g => g.date === date && g.end === gapEnd)) {
                            const justifi = dailyJustifications.get(date) || [];
                            const isCovered = justifi.some(j => j.start <= toMinutes(gapStart) && j.end >= toMinutes(gapEnd));
                            if (!isCovered) {
                                employee.unjustifiedGaps.push({ date, start: gapStart, end: gapEnd });
                            }
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
                    const dayPunches = allRows.filter(r => normalizeDateStr(r.Fecha) === date);
                    const firstP = dayPunches.find(p => isEntrada(p.Entrada));
                    const lastP = [...dayPunches].reverse().find(p => isSalida(p.Entrada) || (!isEntrada(p.Entrada)));

                    employee.workdayDeviations.push({
                        date: date,
                        actualHours: totalHours,
                        start: firstP ? normalizeTimeStr(firstP.Hora).substring(0, 5) : undefined,
                        end: lastP ? normalizeTimeStr(lastP.Hora).substring(0, 5) : undefined
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

        // 3. PRESENCIA: Base Work Hours - TAJ - JUSTIFICADAS
        // CRITICAL FIX: Absences (JUSTIFICADAS) must be subtracted from base work time
        // According to spec: PRESENCIA = Tiempo trabajado dentro de jornada - TODAS las ausencias
        let rawWorkHours = 0;
        if (employee.turnoAsignado === 'M') {
            rawWorkHours = employee.horasDia;
        } else {
            rawWorkHours = employee.horasTarde;
        }

        // Calculate Presence Minutes: Work Minutes - TAJ Minutes
        // CRITICAL UPDATE from User: Justified hours are NOT subtracted from Presence.
        // Presence is purely calculated from actual punches (minus TAJ).
        // Example: 6h worked -> Presence 6h. 2h incident -> Justified 2h. Total 8h.
        const workMinutes = Math.round(rawWorkHours * 60);
        // Correct formula: Max(0, Work). Work already excludes TAJ gaps.
        let presenceMinutes = workMinutes;
        employee.presencia = toHoursRounded(presenceMinutes);

        // 4. TOTAL: Sum of Visual Components
        // REGLA CRÍTICA: "NO PUEDE HABER EN LA COLUMNA total MAS DE 8H"
        // Si la suma supera 8h (ej. 8.02h por redondeo o solapamiento), se recorta de PRESENCIA.
        const currentTotal = employee.presencia + employee.horasJustificadas + employee.hTAJ;

        // Use a small epsilon for float comparison, but stricter logic for the 8h cap
        if (currentTotal > 8.009) {
            const excess = currentTotal - 8.00;
            // Subtract excess from presence (presuming presence is the flexible 'worked' part)
            employee.presencia = Number((employee.presencia - excess).toFixed(2));
            if (employee.presencia < 0) employee.presencia = 0;
        }

        // Re-calculate Total ensures exactly 8.00 (or less)
        employee.horasTotalesConJustificacion = Number((employee.presencia + employee.horasJustificadas + employee.hTAJ).toFixed(2));

        // totalHoras (Bruto - solo informativo)
        const rawTotalWorked =
            employee.horasDia +
            employee.horasTarde +
            employee.nocturnas +
            employee.excesoJornada1 +
            employee.festivas;
        employee.totalHoras = Math.round((rawTotalWorked + Number.EPSILON) * 10000) / 10000;



        // 🔍 DEBUG: Logging para depurar casos imposibles
        if (Math.abs(employee.presencia - employee.horasTotalesConJustificacion) > 2) {
            console.warn(`⚠️ ALERTA EMPLEADO ${employee.operario} (${employee.nombre}):`, {
                turno: employee.turnoAsignado,
                horasDia: employee.horasDia,
                horasTarde: employee.horasTarde,
                hTAJ: employee.hTAJ,
                presenciaCalculada: employee.presencia,
                horasJustificadas: employee.horasJustificadas,
                desglose: {
                    hMedico: employee.hMedico,
                    asOficiales: employee.asOficiales,
                    asPropios: employee.asPropios,
                    hVacaciones: employee.hVacaciones,
                    hEspecialistaAccidente: employee.hEspecialistaAccidente,
                    hLDisp: employee.hLDisp,
                    hLeyFam: employee.hLeyFam,
                    hSindicales: employee.hSindicales,
                    hVacAnt: employee.hVacAnt,
                    hITAT: employee.hITAT,
                    hITEC: employee.hITEC
                },
                totalCalculado: employee.horasTotalesConJustificacion,
                formula: `${employee.presencia} (PRESENCIA) + ${employee.horasJustificadas} (JUSTIFICA) + ${employee.hTAJ} (TAJ) = ${employee.horasTotalesConJustificacion}`
            });
        }


        // --- Detect Vacation Conflicts (NEW: Cambio 1) ---
        // Check if employee has vacations (TipoDiaEmpresa = 2) on days they also have punches
        const vacationDates = new Set<string>();
        allRows.forEach(r => {
            if (r.TipoDiaEmpresa === 2) {
                vacationDates.add(r.Fecha);
            }
        });

        // Check if any of these vacation dates also have normal punches (Entrada=true)
        vacationDates.forEach(vDate => {
            const hasPunches = allRows.some(r =>
                r.Fecha === vDate &&
                isEntrada(r.Entrada) &&
                (r.MotivoAusencia === null || r.MotivoAusencia === 0 || r.MotivoAusencia === 1)
            );
            if (hasPunches && !employee.vacationConflicts!.includes(vDate)) {
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

        while (curr <= end) {
            const dayOfWeek = curr.getDay();
            const dateStr = toISODateLocal(curr);

            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                if (!effectiveHolidays.has(dateStr)) {
                    // CRITICAL FIX: Ensure day is not marked absent if there is ANY activity, 
                    // or if identified as having gaps/modifications/missing-outs.
                    const hasActivity = datesWithActivity.has(dateStr);
                    const hasGaps = employee.unjustifiedGaps.some(g => g.date === dateStr);
                    const hasDeviations = employee.workdayDeviations.some(d => d.date === dateStr);
                    const hasMissingOut = employee.missingClockOuts && employee.missingClockOuts.some(m => m === dateStr);

                    // ✅ NUEVO (Bug Fix): Verificar si el empleado tiene vacaciones ese día
                    // Primero verificar en el calendario del empleado (TipoDia=2)
                    // Si no hay calendario, verificar en fichajes (TipoDiaEmpresa=2)
                    let hasVacation = false;

                    if (employeeCalendars && employeeCalendars.has(employeeId)) {
                        const empCal = employeeCalendars.get(employeeId)!;
                        const tipoDia = empCal.get(dateStr);
                        hasVacation = tipoDia === 2; // TipoDia=2 => Vacaciones
                    }

                    // Fallback: verificar en los datos de fichajes
                    if (!hasVacation) {
                        hasVacation = allRows.some(r =>
                            r.Fecha === dateStr &&
                            r.TipoDiaEmpresa === 2
                        );
                    }

                    // 🔍 DEBUG: Log para empleado 019 el día 16
                    if (employeeId === 19 && dateStr === '2026-01-16') {
                        console.log('🔍 DEBUG empleado 019 día 2026-01-16:', {
                            hasActivity,
                            hasGaps,
                            hasDeviations,
                            hasMissingOut,
                            hasVacation,
                            calendarData: employeeCalendars?.get(employeeId)?.get(dateStr),
                            allRowsForDate: allRows.filter(r => r.Fecha === dateStr),
                            willBeMarkedAbsent: !hasActivity && !hasGaps && !hasDeviations && !hasMissingOut && !hasVacation
                        });
                    }

                    if (!hasActivity && !hasGaps && !hasDeviations && !hasMissingOut && !hasVacation) {
                        employee.absentDays.push(dateStr);
                    }
                }
            }
            curr.setDate(curr.getDate() + 1);
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
