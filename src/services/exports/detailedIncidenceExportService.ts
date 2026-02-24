
import { ProcessedDataRow, RawDataRow, User, Role } from '../../types';
import { ANNUAL_CREDITS } from '../../constants';
import { toISODateLocal } from '../../utils/localDate';
import type { Operario } from '../erpApi';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXCEL DE NÓMINAS - ESPECIFICACIÓN DE 34 COLUMNAS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este servicio genera un Excel con datos de presencia y ausencias para nóminas.
 * Todos los cálculos se basan DIRECTAMENTE en fichajes del swagger (RawDataRow).
 * 
 * COLUMNAS:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1.  Colectivo:        Sección/Departamento del empleado
 * 2.  Operario:         FV + ID de 3 dígitos (ej: FV049)
 * 3.  Nombre:           Nombre completo del operario
 * 
 * 4.  TOTAL Horas:      Suma de: Horas Dia + Horas Tarde + Horas Noche + 
 *                       H. Medico + As. Oficiales + H. Vacaciones + Esp. y Acc. +
 *                       H.L. Disp + H. Sind + H. ITAT + H. ITEC + H. Vac. Ant +
 *                       H. Ley Fam + H. TAJ + Tiempo Retrasos + HORAS FESTIVAS
 * 
 * 5.  Horas Dia:        Tiempo trabajado 07:00-15:00 (MENOS TAJ en ese rango)
 * 6.  EXCESO JORNADA 1: Solo turno M, horas realizadas 15:00-19:59
 * 7.  Horas Tarde:      Tiempo trabajado 15:00-23:00 (MENOS TAJ en ese rango)
 * 8.  NOCTURNAS:        Cualquier turno, tiempo trabajado 20:00-06:00
 * 9.  Horas Noche:      Reservado para turno N (actualmente sin uso, queda en 0)
 * 10. FESTIVAS:         Horas en fines de semana + festivos calendario
 * 
 * 11. H. Medico:        (Código 02) Horas usadas en PERIODO seleccionado
 * 12. Acum. Medico:     (Código 02) Horas acumuladas desde inicio año hasta hoy
 * 13. Disp. Medico:     16h - Acum. Medico
 * 
 * 14. H. Vacaciones:    (Código 05) DÍAS usados en periodo (mostrar en días)
 * 15. Acum. Vacaciones: (Código 05) DÍAS acumulados YTD
 * 16. Disp. Vacaciones: 22 días - Acum. Vacaciones
 * 
 * 17. H.L. Disp:        (Código 07) Horas Libre Disposición en periodo
 * 18. Acum. H.L. Disp:  (Código 07) Horas acumuladas YTD
 * 19. Disp. H.L. Disp:  8h - Acum. H.L. Disp
 * 
 * 20. H. Ley Fam:       (Código 13) Horas Ley Familias en periodo
 * 21. Acum. HLF:        (Código 13) Horas acumuladas YTD
 * 22. Disp. HLF:        32h - Acum. HLF
 * 
 * 23. As. Oficiales:    (Código 03) Horas Asuntos Oficiales en periodo
 * 24. Esp. y Ac:        (Código 06) Horas Especialista/Accidente en periodo
 * 25. H. Sind:          (Código 09) Horas Sindicales en periodo
 * 26. H. Vac. Ant:      (Código 08) Vacaciones año anterior, en DÍAS
 * 
 * 27. Dias ITAT:        (Código 10) Número de días distintos con ITAT
 * 28. H. ITAT:          (Código 10) Horas totales ITAT en periodo
 * 29. Dias ITEC:        (Código 11) Número de días distintos con ITEC
 * 30. H. ITEC:          (Código 11) Horas totales ITEC en periodo
 * 
 * 31. Num. TAJ:         (Código 14) Cantidad de registros TAJ (torno/fumar)
 * 32. H. TAJ:           (Código 14) Horas totales TAJ en periodo
 * 
 * 33. Num. Retrasos:    Cantidad de días con entrada tardía (>1min 59seg)
 * 34. Tiempo Retrasos:  Suma de minutos de retraso en todas las entradas tardías
 * 
 * ─────────────────────────────────────────────────────────────────────────────
 * REGLAS CRÍTICAS:
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * 1. TRABAJO REAL = Fichajes con MotivoAusencia null/0/1 únicamente
 *    - NO incluye TAJ (14), Médico (02), Vacaciones (05), etc.
 * 
 * 2. TAJ se RESTA de las horas trabajadas en el rango horario correspondiente
 *    - Si TAJ 10:00-10:30, se resta de "Horas Dia"
 *    - Si TAJ 16:00-16:15, se resta de "Horas Tarde" o "Exceso Jornada 1"
 * 
 * 3. RETRASOS: Solo primera entrada normal del día
 *    - Turno M: esperado 07:00, margen 1min 59seg
 *    - Turno TN: esperado 15:00, margen 1min 59seg
 * 
 * 4. FESTIVAS: Si día es festivo, TODO el tiempo va a festivas
 *    - No se mezcla con Horas Dia/Tarde/Noche
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */


// Definición estricta de la fila de exportación
export interface DetailedIncidenceRow {
    colectivo: string;          // 1
    operario: string;           // 2 (FV...)
    nombre: string;             // 3
    jF: boolean;                // Jornada flexible
    rJ: boolean;                // Reduccion de jornada
    totalHoras: number;         // 4
    productivo: boolean;        // 35
    horasDia: number;           // 5
    excesoJornada1: number;     // 6
    horasTarde: number;         // 7
    nocturnas: number;          // 8
    horasNoche: number;         // 9
    festivas: number;           // 10
    hMedico: number;            // 11
    acumMedico: number;         // 12
    dispMedico: number;         // 13
    hVacaciones: number;        // 14
    acumVacaciones: number;     // 15
    dispVacaciones: number;     // 16
    hLDisp: number;             // 17
    acumHLDisp: number;         // 18
    dispHLDisp: number;         // 19
    hLeyFam: number;            // 20
    acumHLF: number;            // 21
    dispHLF: number;            // 22
    asOficiales: number;        // 23
    espYAc: number;             // 24
    hSind: number;              // 25
    hVacAnt: number;            // 26
    diasITAT: number;           // 27
    hITAT: number;              // 28
    diasITEC: number;           // 29
    hITEC: number;              // 30
    numTAJ: number;             // 31
    hTAJ: number;               // 32
    numRetrasos: number;        // 33
    tiempoRetrasos: number;     // 34
}

export interface PayrollExportProgress {
    phase: 'validando' | 'cargando_periodo' | 'cargando_ytd' | 'procesando_empleados' | 'construyendo_excel' | 'finalizando';
    percent: number;
    message: string;
    completedEmployees?: number;
    totalEmployees?: number;
}

// Helper para convertir HH:MM a minutos desde medianoche
const getMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const normalizeDateStr = (raw: string): string => {
    if (!raw) return '1970-01-01';
    return raw.replace('T', ' ').split(' ')[0];
};

const normalizeTimeStr = (raw: string): string => {
    if (!raw) return '00:00';
    let t = raw;
    if (t.includes('T')) t = t.split('T')[1];
    else if (t.includes(' ') && t.includes(':')) t = t.split(' ')[1];
    return t.substring(0, 5);
};

const addDaysStr = (dateStr: string, days: number): string => {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return toISODateLocal(d);
};

const isEntrada = (entrada: boolean | number | string | null | undefined): boolean => {
    return entrada === true || entrada === 1 || entrada === '1';
};

const isSalida = (entrada: boolean | number | string | null | undefined): boolean => {
    return entrada === false || entrada === 0 || entrada === '0';
};

const toMotivoNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const n = parseInt(value, 10);
        return Number.isFinite(n) ? n : null;
    }
    return null;
};

const isNormalWorkMotivo = (value: unknown): boolean => {
    const motivo = toMotivoNumber(value);
    return motivo === null || motivo === 0 || motivo === 1;
};

const toOperarioIdNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
};

const resolveDepartment = (rows: RawDataRow[], fallback: string): string => {
    if (rows.length === 0) return fallback;
    const sorted = [...rows].sort((a, b) => {
        if (a.Fecha !== b.Fecha) return a.Fecha.localeCompare(b.Fecha);
        return (a.Hora || '00:00:00').localeCompare(b.Hora || '00:00:00');
    });
    const last = sorted[sorted.length - 1];
    return last.DescDepartamento || fallback;
};

const resolveShiftFromRows = (rows: RawDataRow[], fallback: 'M' | 'TN'): 'M' | 'TN' => {
    if (rows.length === 0) return fallback;

    let turnoM = 0;
    let turnoTN = 0;
    rows.forEach(r => {
        const turno = String(r.TurnoTexto || '').toUpperCase().trim();
        if (!turno) return;
        if (turno.includes('TN') || turno.includes('TARDE') || turno.includes('NOCHE')) {
            turnoTN += 1;
            return;
        }
        if (turno.includes('M') || turno.includes('MANANA') || turno.includes('MAÑANA')) {
            turnoM += 1;
        }
    });
    if (turnoTN > turnoM) return 'TN';
    if (turnoM > turnoTN) return 'M';

    const entradas = rows
        .filter(r => isEntrada(r.Entrada) && r.Hora && r.Hora !== '00:00:00')
        .map(r => getMinutes(normalizeTimeStr(r.Hora || '')))
        .filter(m => Number.isFinite(m))
        .sort((a, b) => a - b);

    if (entradas.length > 0) {
        const median = entradas[Math.floor(entradas.length / 2)];
        return median >= 12 * 60 ? 'TN' : 'M';
    }

    return fallback;
};

interface TimeInterval {
    startDate: string;
    endDate: string;
    startMin: number;
    endMin: number;
}

const getIntervalDuration = (interval: TimeInterval): number => {
    if (interval.startDate === interval.endDate) {
        if (interval.endMin < interval.startMin) {
            return (1440 - interval.startMin + interval.endMin) / 60;
        }
        return (interval.endMin - interval.startMin) / 60;
    }
    return (1440 - interval.startMin + interval.endMin) / 60;
};

const buildIntervals = (rows: RawDataRow[], allowRow: (row: RawDataRow) => boolean): TimeInterval[] => {
    const intervals: TimeInterval[] = [];
    const rowsWithExplicitRange = rows.filter(r => {
        if (!allowRow(r)) return false;
        const ini = normalizeTimeStr(r.Inicio || '');
        const fin = normalizeTimeStr(r.Fin || '');
        return ini !== '00:00' && fin !== '00:00';
    });

    rowsWithExplicitRange.forEach(r => {
        const dateStr = normalizeDateStr(r.Fecha);
        const ini = normalizeTimeStr(r.Inicio || '');
        const fin = normalizeTimeStr(r.Fin || '');
        const startMin = getMinutes(ini);
        const endMin = getMinutes(fin);
        let endDate = dateStr;
        if (endMin < startMin) {
            endDate = addDaysStr(dateStr, 1);
        }
        intervals.push({ startDate: dateStr, endDate, startMin, endMin });
    });

    const rowsForPairing = rows
        .filter(r => allowRow(r))
        .filter(r => {
            const ini = normalizeTimeStr(r.Inicio || '');
            const fin = normalizeTimeStr(r.Fin || '');
            return ini === '00:00' || fin === '00:00';
        })
        .sort((a, b) => {
            const ad = normalizeDateStr(a.Fecha);
            const bd = normalizeDateStr(b.Fecha);
            if (ad !== bd) return ad.localeCompare(bd);
            const ah = normalizeTimeStr(a.Hora || '');
            const bh = normalizeTimeStr(b.Hora || '');
            return ah.localeCompare(bh);
        });

    const openEntries: RawDataRow[] = [];
    rowsForPairing.forEach(row => {
        if (isEntrada(row.Entrada)) {
            openEntries.push(row);
            return;
        }
        if (!isSalida(row.Entrada) || openEntries.length === 0) return;

        const startRow = openEntries.shift()!;
        const startDate = normalizeDateStr(startRow.Fecha);
        const endDateRaw = normalizeDateStr(row.Fecha);
        const startMin = getMinutes(normalizeTimeStr(startRow.Hora || ''));
        const endMin = getMinutes(normalizeTimeStr(row.Hora || ''));
        let endDate = endDateRaw || startDate;

        if (endDate === startDate && endMin < startMin) {
            endDate = addDaysStr(startDate, 1);
        }

        intervals.push({ startDate, endDate, startMin, endMin });
    });

    return intervals;
};

const auditUnpairedPunches = (
    rows: RawDataRow[],
    allowRow: (row: RawDataRow) => boolean,
    salidaMustMatchCode?: number
): { unmatchedEntries: number; unmatchedExits: number } => {
    const rowsForPairing = rows
        .filter(r => allowRow(r))
        .filter(r => {
            const ini = normalizeTimeStr(r.Inicio || '');
            const fin = normalizeTimeStr(r.Fin || '');
            return ini === '00:00' || fin === '00:00';
        })
        .sort((a, b) => {
            const ad = normalizeDateStr(a.Fecha);
            const bd = normalizeDateStr(b.Fecha);
            if (ad !== bd) return ad.localeCompare(bd);
            const ah = normalizeTimeStr(a.Hora || '');
            const bh = normalizeTimeStr(b.Hora || '');
            return ah.localeCompare(bh);
        });

    let openEntries = 0;
    let unmatchedExits = 0;

    rowsForPairing.forEach(row => {
        if (isEntrada(row.Entrada)) {
            openEntries++;
            return;
        }
        if (!isSalida(row.Entrada)) return;
        if (typeof salidaMustMatchCode === 'number' && toMotivoNumber(row.MotivoAusencia) !== salidaMustMatchCode) {
            return;
        }
        if (openEntries > 0) {
            openEntries--;
        } else {
            unmatchedExits++;
        }
    });

    return {
        unmatchedEntries: openEntries,
        unmatchedExits
    };
};

const hasExplicitRange = (row: RawDataRow): boolean => {
    const ini = normalizeTimeStr(row.Inicio || '');
    const fin = normalizeTimeStr(row.Fin || '');
    return ini !== '00:00' && fin !== '00:00';
};

const sortRowsByDateTime = (rows: RawDataRow[]): RawDataRow[] => {
    return [...rows].sort((a, b) => {
        const ad = normalizeDateStr(a.Fecha);
        const bd = normalizeDateStr(b.Fecha);
        if (ad !== bd) return ad.localeCompare(bd);
        const ah = normalizeTimeStr(a.Hora || '');
        const bh = normalizeTimeStr(b.Hora || '');
        return ah.localeCompare(bh);
    });
};

const buildWorkedIntervals = (rows: RawDataRow[]): TimeInterval[] => {
    const sorted = sortRowsByDateTime(rows);
    const intervals: TimeInterval[] = [];

    sorted.forEach(row => {
        if (!isNormalWorkMotivo(row.MotivoAusencia)) return;
        if (!hasExplicitRange(row)) return;

        const dateStr = normalizeDateStr(row.Fecha);
        const ini = normalizeTimeStr(row.Inicio || '');
        const fin = normalizeTimeStr(row.Fin || '');
        const startMin = getMinutes(ini);
        const endMin = getMinutes(fin);
        let endDate = dateStr;
        if (endMin < startMin) {
            endDate = addDaysStr(dateStr, 1);
        }
        intervals.push({ startDate: dateStr, endDate, startMin, endMin });
    });

    const rowsForPairing = sorted.filter(r => !hasExplicitRange(r));
    let i = 0;
    while (i < rowsForPairing.length - 1) {
        const current = rowsForPairing[i];
        const next = rowsForPairing[i + 1];

        if (!isEntrada(current.Entrada) || !isSalida(next.Entrada) || (!isNormalWorkMotivo(next.MotivoAusencia) && toMotivoNumber(next.MotivoAusencia) !== 14)) {
            i++;
            continue;
        }

        const startDate = normalizeDateStr(current.Fecha);
        const endDateRaw = normalizeDateStr(next.Fecha) || startDate;
        const startMin = getMinutes(normalizeTimeStr(current.Hora || ''));
        const endMin = getMinutes(normalizeTimeStr(next.Hora || ''));
        let endDate = endDateRaw;
        if (endDate === startDate && endMin < startMin) {
            endDate = addDaysStr(startDate, 1);
        }

        intervals.push({ startDate, endDate, startMin, endMin });
        i += 2;
    }

    return intervals;
};

const buildIncidentIntervalsByCode = (rows: RawDataRow[], code: number): TimeInterval[] => {
    const sorted = sortRowsByDateTime(rows);
    const intervals: TimeInterval[] = [];

    // 1) Rangos explícitos Inicio/Fin para ese código
    sorted.forEach(row => {
        if (toMotivoNumber(row.MotivoAusencia) !== code) return;
        if (!hasExplicitRange(row)) return;

        const dateStr = normalizeDateStr(row.Fecha);
        const ini = normalizeTimeStr(row.Inicio || '');
        const fin = normalizeTimeStr(row.Fin || '');
        const startMin = getMinutes(ini);
        const endMin = getMinutes(fin);
        let endDate = dateStr;
        if (endMin < startMin) {
            endDate = addDaysStr(dateStr, 1);
        }
        intervals.push({ startDate: dateStr, endDate, startMin, endMin });
    });

    // 2) Emparejado estricto por pares consecutivos Entrada -> Salida(código)
    const rowsForPairing = sorted.filter(r => !hasExplicitRange(r));
    let i = 0;
    while (i < rowsForPairing.length - 1) {
        const current = rowsForPairing[i];
        const next = rowsForPairing[i + 1];

        if (!isEntrada(current.Entrada) || !isSalida(next.Entrada) || toMotivoNumber(next.MotivoAusencia) !== code) {
            i++;
            continue;
        }

        const startDate = normalizeDateStr(current.Fecha);
        const endDateRaw = normalizeDateStr(next.Fecha) || startDate;
        const startMin = getMinutes(normalizeTimeStr(current.Hora || ''));
        const endMin = getMinutes(normalizeTimeStr(next.Hora || ''));
        let endDate = endDateRaw;
        if (endDate === startDate && endMin < startMin) {
            endDate = addDaysStr(startDate, 1);
        }

        intervals.push({ startDate, endDate, startMin, endMin });
        i += 2;
    }

    return intervals;
};

const buildTAJIntervals = (rows: RawDataRow[]): TimeInterval[] => {
    const sorted = sortRowsByDateTime(rows);
    const intervals: TimeInterval[] = [];

    const rowsForPairing = sorted.filter(r => !hasExplicitRange(r));
    let i = 0;
    while (i < rowsForPairing.length - 1) {
        const current = rowsForPairing[i];

        if (isSalida(current.Entrada) && toMotivoNumber(current.MotivoAusencia) === 14) {
            const next = rowsForPairing[i + 1];
            if (isEntrada(next.Entrada)) {
                const startDate = normalizeDateStr(current.Fecha);
                const endDateRaw = normalizeDateStr(next.Fecha) || startDate;
                const startMin = getMinutes(normalizeTimeStr(current.Hora || ''));
                const endMin = getMinutes(normalizeTimeStr(next.Hora || ''));
                let endDate = endDateRaw;
                if (endDate === startDate && endMin < startMin) {
                    endDate = addDaysStr(startDate, 1);
                }
                const diffDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24);
                if (diffDays <= 1 && diffDays >= 0) {
                    intervals.push({ startDate, endDate, startMin, endMin });
                }
            }
        }
        i++;
    }
    return intervals;
};

// Determina si una fecha es fin de semana (Sábado=6, Domingo=0)
const isWeekend = (dateStr: string): boolean => {
    const d = new Date(dateStr);
    const day = d.getDay();
    return day === 0 || day === 6;
};

interface TimeBuckets {
    horasDia: number;       // 07:00 - 15:00
    excesoJornada1: number; // 15:00 - 19:59 (Solo Turno M)
    horasTarde: number;     // 15:00 - 23:00 (Solo Turno TN)
    nocturnas: number;      // M: 20:00-07:00 | TN: 23:00-07:00
    horasNoche: number;     // Reservado para turno N (actualmente 0)
    festivas: number;       // Fines de semana / Festivos
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const roundRow = (row: DetailedIncidenceRow): DetailedIncidenceRow => ({
    ...row,
    totalHoras: round2(row.totalHoras),
    horasDia: round2(row.horasDia),
    excesoJornada1: round2(row.excesoJornada1),
    horasTarde: round2(row.horasTarde),
    nocturnas: round2(row.nocturnas),
    horasNoche: round2(row.horasNoche),
    festivas: round2(row.festivas),
    hMedico: round2(row.hMedico),
    acumMedico: round2(row.acumMedico),
    dispMedico: round2(row.dispMedico),
    hVacaciones: round2(row.hVacaciones),
    acumVacaciones: round2(row.acumVacaciones),
    dispVacaciones: round2(row.dispVacaciones),
    hLDisp: round2(row.hLDisp),
    acumHLDisp: round2(row.acumHLDisp),
    dispHLDisp: round2(row.dispHLDisp),
    hLeyFam: round2(row.hLeyFam),
    acumHLF: round2(row.acumHLF),
    dispHLF: round2(row.dispHLF),
    asOficiales: round2(row.asOficiales),
    espYAc: round2(row.espYAc),
    hSind: round2(row.hSind),
    hVacAnt: round2(row.hVacAnt),
    diasITAT: round2(row.diasITAT),
    hITAT: round2(row.hITAT),
    diasITEC: round2(row.diasITEC),
    hITEC: round2(row.hITEC),
    numTAJ: round2(row.numTAJ),
    hTAJ: round2(row.hTAJ),
    numRetrasos: round2(row.numRetrasos),
    tiempoRetrasos: round2(row.tiempoRetrasos)
});

const getFestiveDatesFromCalendar = (calendar: any[]): Set<string> => {
    const festiveDates = new Set<string>();
    calendar.forEach((day: any) => {
        const tipoDia = day?.TipoDia;
        if (tipoDia === 1 || tipoDia === '1') {
            if (day?.Fecha) festiveDates.add(normalizeDateStr(day.Fecha));
        }
    });
    return festiveDates;
};

const getVacationDatesFromCalendar = (calendar: any[]): Set<string> => {
    const vacationDates = new Set<string>();
    calendar.forEach((day: any) => {
        const tipoDia = String(day?.TipoDia ?? '');
        if (tipoDia === '2' && day?.Fecha) {
            vacationDates.add(normalizeDateStr(day.Fecha));
        }
    });
    return vacationDates;
};

const hasReducedWorkingDay = (calendar: any[]): boolean => {
    for (const day of calendar) {
        const tipoDia = String(day?.TipoDia ?? '');
        if (tipoDia !== '0') continue;
        const duracion = Number(day?.Duracion ?? 0);
        if (Number.isFinite(duracion) && duracion > 0 && duracion < 7.95) return true;
    }
    return false;
};

/**
 * Calcula en qué "cubos" caen las horas trabajadas de una fila RawData.
 * Reglas Estrictas:
 * 1. Festivas: Si es Fin de Semana o Festivo (TipoDiaEmpresa===1), TODO va a Festivas.
 *    NOTA: Para que TOTAL sume correctamente (Total = Dia + Tarde + Noche + Festivas),
 *    si va a Festivas, NO va a los otros cubos.
 *
 * 2. Si no es festivo (Laborable):
 *    Depende del Turno Asignado al usuario (M o TN).
 *    
 *    Turno M (Mañana):
 *       - Horas Dia: 07:00 - 15:00
 *       - Exceso Jornada 1: 15:00 - 19:59
 *       - Nocturnas: 20:00 - 07:00 (dia siguiente)
 *
 *    Turno TN (Tarde/Noche):
 *       - Horas Tarde: 15:00 - 23:00
 *       - Nocturnas: desde 23:00 en adelante (hasta 07:00 del dia siguiente)
 *       - Horas Dia: 07:00 - 15:00 (mantenido para compatibilidad histórica)
 *
 *    Horas Noche:
 *       - Reservado para hipotético turno N. En operación actual se mantiene en 0.
 */
const calculateTimeBuckets = (
    row: RawDataRow,
    userShift: 'M' | 'TN',
    isFestiveDay: boolean // Pasa true si es festivo calendario o fin de semana
): TimeBuckets => {
    const buckets: TimeBuckets = {
        horasDia: 0,
        excesoJornada1: 0,
        horasTarde: 0,
        nocturnas: 0,
        horasNoche: 0,
        festivas: 0
    };

    if (!row.Inicio || !row.Fin || row.Inicio === '00:00' || row.Fin === '00:00') return buckets;

    let startMin = getMinutes(row.Inicio);
    let endMin = getMinutes(row.Fin);

    // Manejo de cruce de medianoche (ej: 22:00 a 06:00)
    // Se asume que si Fin < Inicio, es día siguiente.
    // Para simplificar "Splitting", si cruza medianoche, lo tratamos como hasta 1440 (24h) + resto.
    // PERO la función simple de intersección no maneja > 1440.
    // Mejor estrategia: Procesar en dos tramos si cruza medianoche.
    if (endMin < startMin) {
        // Tramo 1: startMin a 1440
        // Tramo 2: 0 a endMin
        const b1 = resolveBucket(startMin, 1440, userShift, isFestiveDay);
        const b2 = resolveBucket(0, endMin, userShift, isFestiveDay);
        return sumBuckets(b1, b2);
    } else {
        return resolveBucket(startMin, endMin, userShift, isFestiveDay);
    }
};

const sumBuckets = (b1: TimeBuckets, b2: TimeBuckets): TimeBuckets => ({
    horasDia: b1.horasDia + b2.horasDia,
    excesoJornada1: b1.excesoJornada1 + b2.excesoJornada1,
    horasTarde: b1.horasTarde + b2.horasTarde,
    nocturnas: b1.nocturnas + b2.nocturnas,
    horasNoche: b1.horasNoche + b2.horasNoche,
    festivas: b1.festivas + b2.festivas
});

const resolveBucket = (start: number, end: number, shift: 'M' | 'TN', isFestive: boolean): TimeBuckets => {
    const b: TimeBuckets = { horasDia: 0, excesoJornada1: 0, horasTarde: 0, nocturnas: 0, horasNoche: 0, festivas: 0 };
    const duration = (end - start) / 60;
    if (duration <= 0) return b;

    // 1. FESTIVAS
    if (isFestive) {
        b.festivas = duration;
        return b;
    }

    // 2. LABORABLES
    // Definir rangos en minutos
    const R_07_15 = { s: 7 * 60, e: 15 * 60 };   // 420 - 900
    const R_15_20 = { s: 15 * 60, e: 20 * 60 };  // 900 - 1200
    const R_15_23 = { s: 15 * 60, e: 23 * 60 };  // 900 - 1380
    const R_20_07_A = { s: 20 * 60, e: 24 * 60 }; // 1200 - 1440 (Nocturnas M parte 1)
    const R_20_07_B = { s: 0, e: 7 * 60 };        // 0 - 420 (Nocturnas M parte 2)
    const R_23_07_A = { s: 23 * 60, e: 24 * 60 }; // 1380 - 1440 (Nocturnas TN parte 1)
    const R_23_07_B = { s: 0, e: 7 * 60 };        // 0 - 420 (Nocturnas TN parte 2)

    // Función intersección
    const intersect = (s1: number, e1: number, s2: number, e2: number) => {
        const s = Math.max(s1, s2);
        const e = Math.min(e1, e2);
        return Math.max(0, (e - s) / 60);
    };

    if (shift === 'M') {
        b.horasDia += intersect(start, end, R_07_15.s, R_07_15.e);
        b.excesoJornada1 += intersect(start, end, R_15_20.s, R_15_20.e);
        b.nocturnas += intersect(start, end, R_20_07_A.s, R_20_07_A.e);
        b.nocturnas += intersect(start, end, R_20_07_B.s, R_20_07_B.e);
    } else {
        b.horasDia += intersect(start, end, R_07_15.s, R_07_15.e);
        b.horasTarde += intersect(start, end, R_15_23.s, R_15_23.e);
        b.nocturnas += intersect(start, end, R_23_07_A.s, R_23_07_A.e);
        b.nocturnas += intersect(start, end, R_23_07_B.s, R_23_07_B.e);
        // Horas Noche queda en 0 por decisión funcional actual (sin turno N activo)
    }

    return b;
};

const addIntervalToBuckets = (
    base: TimeBuckets,
    interval: TimeInterval,
    shift: 'M' | 'TN',
    festiveDates: Set<string>,
    vacationDates: Set<string>
): TimeBuckets => {
    const isFestiveDate = (dateStr: string): boolean =>
        festiveDates.has(dateStr) || isWeekend(dateStr) || vacationDates.has(dateStr);

    if (interval.startDate === interval.endDate) {
        const isFestive = isFestiveDate(interval.startDate);
        const added = resolveBucket(interval.startMin, interval.endMin, shift, isFestive);
        return sumBuckets(base, added);
    }

    const firstDate = interval.startDate;
    const secondDate = interval.endDate;
    const firstPart = resolveBucket(interval.startMin, 1440, shift, isFestiveDate(firstDate));
    const secondPart = resolveBucket(0, interval.endMin, shift, isFestiveDate(secondDate));
    return sumBuckets(base, sumBuckets(firstPart, secondPart));
};

const sumIncidentHours = (rows: RawDataRow[], code: number, dateFilter: (d: string) => boolean): number => {
    const intervals = buildIncidentIntervalsByCode(rows.filter(r => dateFilter(r.Fecha)), code);
    return intervals.reduce((acc, interval) => acc + getIntervalDuration(interval), 0);
};

const countIncidentDays = (rows: RawDataRow[], code: number, dateFilter: (d: string) => boolean): number => {
    const dates = new Set(
        rows
            .filter(r => toMotivoNumber(r.MotivoAusencia) === code && dateFilter(r.Fecha))
            .map(r => normalizeDateStr(r.Fecha))
    );
    return dates.size;
};

const countIncidentRecords = (rows: RawDataRow[], code: number, dateFilter: (d: string) => boolean): number => {
    return rows.filter(r => toMotivoNumber(r.MotivoAusencia) === code && dateFilter(r.Fecha)).length;
};

const isAnnualAccumIncident = (row: RawDataRow): boolean => {
    const motivo = toMotivoNumber(row.MotivoAusencia);
    return motivo !== null && motivo !== 1 && motivo !== 14 && motivo !== 11 && motivo !== 10;
};

interface EmployeeAnalysisContext {
    employeeId: number;
    user: User;
    pData?: ProcessedDataRow;
    periodStart: string;
    periodEnd: string;
    ytdStart: string;
    ytdEnd: string;
    empRawPeriod: RawDataRow[];
    empRawYTD: RawDataRow[];
    workRows: RawDataRow[];
    userShift: 'M' | 'TN';
    colectivo: string;
    festiveDates: Set<string>;
    vacationDates: Set<string>;
    vacationDaysPeriodFromCalendar: number;
    vacationDaysYtdFromCalendar: number;
    reducedWorkingDay: boolean;
}

const sumVacationDaysFromCalendar = (calendar: any[], startDate: string, endDate: string): number => {
    return calendar.reduce((acc, day) => {
        const tipoDia = String(day?.TipoDia ?? '');
        if (tipoDia !== '2') return acc;
        const date = normalizeDateStr(String(day?.Fecha || ''));
        if (!date || date < startDate || date > endDate) return acc;
        const duracion = Number(day?.Duracion ?? 8);
        if (Number.isFinite(duracion) && duracion > 0) {
            return acc + (duracion / 8);
        }
        return acc + 1;
    }, 0);
};

const buildEmployeeAnalysisContext = (
    employeeId: number,
    user: User,
    pData: ProcessedDataRow | undefined,
    allRawDataPeriod: RawDataRow[],
    allRawDataYTD: RawDataRow[],
    periodStart: string,
    periodEnd: string,
    festiveDates: Set<string>,
    vacationDates: Set<string>,
    reducedWorkingDay: boolean,
    ytdCutoffDate?: string,
    periodCalendar: any[] = [],
    annualCalendar: any[] = []
): EmployeeAnalysisContext => {
    const currentYear = new Date(periodEnd).getFullYear();
    const ytdStart = `${currentYear}-01-01`;
    const ytdEnd = ytdCutoffDate && ytdCutoffDate.length >= 10
        ? ytdCutoffDate.substring(0, 10)
        : periodEnd;

    const empRawPeriod = allRawDataPeriod.filter(r => toOperarioIdNumber(r.IDOperario) === employeeId);
    const empRawYTD = allRawDataYTD.filter(r => toOperarioIdNumber(r.IDOperario) === employeeId);
    const fallbackShift: 'M' | 'TN' = pData?.turnoAsignado === 'TN' ? 'TN' : 'M';
    const userShift = resolveShiftFromRows(empRawYTD.length > 0 ? empRawYTD : empRawPeriod, fallbackShift);
    const colectivo = resolveDepartment(
        empRawYTD.length > 0 ? empRawYTD : empRawPeriod,
        pData?.colectivo || user.department || ''
    );

    const effectiveFestiveDates = new Set<string>(festiveDates);
    const effectiveVacationDates = new Set<string>(vacationDates);
    empRawPeriod.forEach(row => {
        if (Number(row.TipoDiaEmpresa) === 1) {
            effectiveFestiveDates.add(normalizeDateStr(row.Fecha));
        }
    });

    const workRows = empRawPeriod.filter(r => {
        const d = normalizeDateStr(r.Fecha);
        return d >= periodStart && d <= periodEnd;
    });

    const vacationDaysPeriodFromCalendar = sumVacationDaysFromCalendar(periodCalendar, periodStart, periodEnd);
    const vacationDaysYtdFromCalendar = sumVacationDaysFromCalendar(annualCalendar, ytdStart, ytdEnd);

    return {
        employeeId,
        user,
        pData,
        periodStart,
        periodEnd,
        ytdStart,
        ytdEnd,
        empRawPeriod,
        empRawYTD,
        workRows,
        userShift,
        colectivo,
        festiveDates: effectiveFestiveDates,
        vacationDates: effectiveVacationDates,
        vacationDaysPeriodFromCalendar,
        vacationDaysYtdFromCalendar,
        reducedWorkingDay
    };
};

const validateEmployeeRowDoubleReview = (ctx: EmployeeAnalysisContext, row: DetailedIncidenceRow): void => {
    const inPeriod = (date: string) => {
        const d = normalizeDateStr(date);
        return d >= ctx.periodStart && d <= ctx.periodEnd;
    };
    const inYtd = (date: string) => {
        const d = normalizeDateStr(date);
        return d >= ctx.ytdStart && d <= ctx.ytdEnd;
    };

    const workIntervals = buildWorkedIntervals(ctx.workRows);
    let b: TimeBuckets = { horasDia: 0, excesoJornada1: 0, horasTarde: 0, nocturnas: 0, horasNoche: 0, festivas: 0 };
    workIntervals.forEach(interval => {
        b = addIntervalToBuckets(b, interval, ctx.userShift, ctx.festiveDates, ctx.vacationDates);
    });
    const tajIntervals = buildTAJIntervals(ctx.workRows);
    // El TAJ ya no se resta aquí de los buckets de trabajo, porque 'buildWorkedIntervals' 
    // solo utiliza fichajes normales, excluyendo intrínsecamente el tiempo de TAJ.
    const hTAJFromIntervals = tajIntervals.reduce((acc, interval) => acc + getIntervalDuration(interval), 0);

    const annualRows = ctx.empRawYTD;
    const hMedico = sumIncidentHours(ctx.empRawPeriod, 2, inPeriod);
    const acumMedico = sumIncidentHours(annualRows, 2, inYtd);
    const hVacacionesDias = ctx.vacationDaysPeriodFromCalendar > 0
        ? ctx.vacationDaysPeriodFromCalendar
        : (sumIncidentHours(ctx.empRawPeriod, 5, inPeriod) / 8);
    const acumVacacionesDias = ctx.vacationDaysYtdFromCalendar > 0
        ? ctx.vacationDaysYtdFromCalendar
        : (sumIncidentHours(annualRows, 5, inYtd) / 8);
    const hVacAntDias = sumIncidentHours(ctx.empRawPeriod, 8, inPeriod) / 8;
    const hLDisp = sumIncidentHours(ctx.empRawPeriod, 7, inPeriod);
    const acumHLDisp = sumIncidentHours(annualRows, 7, inYtd);
    const hLeyFam = sumIncidentHours(ctx.empRawPeriod, 13, inPeriod);
    const acumHLF = sumIncidentHours(annualRows, 13, inYtd);
    const asOficiales = sumIncidentHours(ctx.empRawPeriod, 3, inPeriod);
    const espYAc = sumIncidentHours(ctx.empRawPeriod, 6, inPeriod);
    const hSind = sumIncidentHours(ctx.empRawPeriod, 9, inPeriod);
    const diasITAT = countIncidentDays(ctx.empRawPeriod, 10, inPeriod);
    const hITAT = sumIncidentHours(ctx.empRawPeriod, 10, inPeriod);
    const diasITEC = countIncidentDays(ctx.empRawPeriod, 11, inPeriod);
    const hITEC = sumIncidentHours(ctx.empRawPeriod, 11, inPeriod);
    const numTAJ = countIncidentRecords(ctx.empRawPeriod, 14, inPeriod);
    const hTAJ = hTAJFromIntervals;

    const checks: Array<[string, number, number]> = [
        ['Horas Dia', row.horasDia, b.horasDia],
        ['Exceso Jornada 1', row.excesoJornada1, b.excesoJornada1],
        ['Horas Tarde', row.horasTarde, b.horasTarde],
        ['Nocturnas', row.nocturnas, b.nocturnas],
        ['Horas Noche', row.horasNoche, b.horasNoche],
        ['Festivas', row.festivas, b.festivas],
        ['H. Medico', row.hMedico, hMedico],
        ['Acum. Medico', row.acumMedico, acumMedico],
        ['H. Vacaciones', row.hVacaciones, hVacacionesDias],
        ['Acum. Vacaciones', row.acumVacaciones, acumVacacionesDias],
        ['H.L. Disp', row.hLDisp, hLDisp],
        ['Acum. H.L. Disp', row.acumHLDisp, acumHLDisp],
        ['H. Ley Fam', row.hLeyFam, hLeyFam],
        ['Acum. HLF', row.acumHLF, acumHLF],
        ['As. Oficiales', row.asOficiales, asOficiales],
        ['Esp. y Ac', row.espYAc, espYAc],
        ['H. Sind', row.hSind, hSind],
        ['H. Vac. Ant', row.hVacAnt, hVacAntDias],
        ['Dias ITAT', row.diasITAT, diasITAT],
        ['H. ITAT', row.hITAT, hITAT],
        ['Dias ITEC', row.diasITEC, diasITEC],
        ['H. ITEC', row.hITEC, hITEC],
        ['Num. TAJ', row.numTAJ, numTAJ],
        ['H. TAJ', row.hTAJ, hTAJ]
    ];

    const tolerance = 0.03;
    const mismatches = checks.filter(([, left, right]) => Math.abs(left - right) > tolerance);
    if (mismatches.length > 0) {
        const detail = mismatches
            .slice(0, 6)
            .map(([k, l, r]) => `${k}: export=${round2(l)} rev=${round2(r)}`)
            .join(' | ');
        throw new Error(`Doble revision fallida para ${ctx.user.name} (${ctx.employeeId}). ${detail}`);
    }

    const recomputedTotal =
        row.horasDia + row.horasTarde + row.horasNoche + row.hMedico + row.asOficiales +
        (row.hVacaciones * 8) + row.espYAc + row.hLDisp + row.hSind + row.hITAT + row.hITEC +
        (row.hVacAnt * 8) + row.hLeyFam + row.hTAJ + row.tiempoRetrasos;
    if (Math.abs(row.totalHoras - recomputedTotal) > tolerance) {
        throw new Error(
            `Doble revision TOTAL fallida para ${ctx.user.name} (${ctx.employeeId}). ` +
            `total=${round2(row.totalHoras)} esperado=${round2(recomputedTotal)}`
        );
    }
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NUEVA FUNCIÓN: Excel de Nóminas con Calendario por Empleado
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Esta función implementa el flujo correcto según especificación:
 * 
 * Para cada empleado:
 * 1. Consultar /fichajes/getCalendarioOperario (calendario personal)
 * 2. Obtener fichajes con /fichajes/getFichajes
 * 3. Calcular las 34 columnas combinando calendario + fichajes
 * 4. Generar tabla lista para exportación
 * 
 * VENTAJAS:
 * - Precisión máxima: usa datos del calendario personal
 * - Detecta vacaciones (TipoDia=2) correctamente
 * - Festivos personalizados por empleado
 * - Cumple 100% con 08_excel_nominas_columnas.md
 * 
 * @param processedData Datos procesados (para metadata)
 * @param allRawDataPeriod Fichajes del periodo
 * @param allRawDataYTD Fichajes Year-To-Date
 * @param allUsers Lista de todos los usuarios
 * @param filterStartDate Fecha inicio periodo (YYYY-MM-DD)
 * @param filterEndDate Fecha fin periodo (YYYY-MM-DD)
 * @returns Promise con filas del Excel
 */
export const buildDetailedIncidenceRowsWithCalendar = async (
    processedData: ProcessedDataRow[],
    allRawDataPeriod: RawDataRow[],
    allRawDataYTD: RawDataRow[],
    allUsers: User[],
    filterStartDate: string,
    filterEndDate: string,
    annualCutoffDate: string,
    onProgress?: (progress: PayrollExportProgress) => void
): Promise<DetailedIncidenceRow[]> => {
    const { getCalendarioOperario } = await import('../erpApi');

    console.log('📅 [Excel Nóminas] Iniciando generación con calendario por empleado...');
    console.log(`📊 Total empleados: ${allUsers.length}`);

    const rows: DetailedIncidenceRow[] = [];
    const processedMap = new Map<number, ProcessedDataRow>();
    processedData.forEach(p => processedMap.set(p.operario, p));

    // ═══════════════════════════════════════════════════════════════════
    // Consultar calendarios en lotes pequeños (evitando colapsos)
    // ═══════════════════════════════════════════════════════════════════
    console.log('⏳ Consultando calendarios en lotes...');
    const annualYear = filterEndDate.substring(0, 4);
    const annualStart = `${annualYear}-01-01`;
    const annualEnd = annualCutoffDate;

    const calendars: any[][] = [];
    const annualCalendars: any[][] = [];

    const BATCH_SIZE = 3;

    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
        const batch = allUsers.slice(i, i + BATCH_SIZE);

        onProgress?.({
            phase: 'procesando_empleados',
            percent: Math.round((i / allUsers.length) * 10), // Usar primer 10% para calendarios
            message: `Descargando calendarios (${i + 1}-${Math.min(i + BATCH_SIZE, allUsers.length)}/${allUsers.length})`,
            completedEmployees: i,
            totalEmployees: allUsers.length
        });

        // Lanzar bloque
        const periodBatchPromises = batch.map(user =>
            getCalendarioOperario(user.id.toString(), filterStartDate, filterEndDate).catch(err => {
                throw new Error(`Fallo al obtener calendario de periodo para el empleado ${user.id} (${user.name}): ${err.message}`);
            })
        );
        const annualBatchPromises = batch.map(user =>
            getCalendarioOperario(user.id.toString(), annualStart, annualEnd).catch(err => {
                throw new Error(`Fallo al obtener calendario anual para el empleado ${user.id} (${user.name}): ${err.message}`);
            })
        );

        const periodBatchResults = await Promise.all(periodBatchPromises);
        const annualBatchResults = await Promise.all(annualBatchPromises);

        calendars.push(...periodBatchResults);
        annualCalendars.push(...annualBatchResults);

        // Pequeña pausa de estabilización si quedan más lotes
        if (i + BATCH_SIZE < allUsers.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log('✅ Calendarios consultados correctamente');

    // ═══════════════════════════════════════════════════════════════════
    // Procesar cada empleado con su calendario
    // ═══════════════════════════════════════════════════════════════════
    for (let i = 0; i < allUsers.length; i++) {
        const user = allUsers[i];
        const calendar = calendars[i];
        const annualCalendar = annualCalendars[i] || [];
        const userId = Number(user.id); // Normalizar a number
        const pData = processedMap.get(userId);

        const employeePercent = allUsers.length === 0
            ? 0
            : 10 + Math.round(((i + 1) / allUsers.length) * 90); // El resto del 90%
        onProgress?.({
            phase: 'procesando_empleados',
            percent: employeePercent,
            message: `Contexto de ${user.name} (${i + 1}/${allUsers.length})`,
            completedEmployees: i,
            totalEmployees: allUsers.length
        });

        try {
            const festiveDates = getFestiveDatesFromCalendar(calendar);
            const vacationDates = getVacationDatesFromCalendar(calendar);
            const reducedWorkingDay = hasReducedWorkingDay(calendar);

            const ctx = buildEmployeeAnalysisContext(
                userId,
                user,
                pData,
                allRawDataPeriod,
                allRawDataYTD,
                filterStartDate,
                filterEndDate,
                festiveDates,
                vacationDates,
                reducedWorkingDay,
                annualCutoffDate,
                calendar,
                annualCalendar
            );

            onProgress?.({
                phase: 'procesando_empleados',
                percent: employeePercent,
                message: `Analizando pares e incidencias de ${user.name}`,
                completedEmployees: i,
                totalEmployees: allUsers.length
            });

            const row = calculateEmployeeRowWithCalendar(
                userId,
                calendar,
                annualCalendar,
                allRawDataPeriod,
                allRawDataYTD,
                pData,
                user,
                filterStartDate,
                filterEndDate,
                annualCutoffDate
            );

            onProgress?.({
                phase: 'procesando_empleados',
                percent: employeePercent,
                message: `Doble revision de ${user.name}`,
                completedEmployees: i,
                totalEmployees: allUsers.length
            });

            validateEmployeeRowDoubleReview(ctx, row);

            rows.push(row);

        } catch (error: any) {
            console.error(`❌ Error procesando empleado ${userId} (${user.name}):`, error.message);
            throw new Error(`Revision de nomina fallida para ${user.name} (${userId}). ${error?.message || 'Error desconocido'}`);
        }

        onProgress?.({
            phase: 'procesando_empleados',
            percent: employeePercent,
            message: `Completado ${user.name} (${i + 1}/${allUsers.length})`,
            completedEmployees: i + 1,
            totalEmployees: allUsers.length
        });
    }

    console.log(`✅ [Excel Nóminas] ${rows.length} empleados procesados`);
    return rows;
};

/**
 * Calcula fila de Excel para un empleado usando su calendario personal
 * 
 * Este método combina:
 * - Calendario personal (vacaciones, festivos)
 * - Fichajes reales
 * - Reglas de cálculo según 08_excel_nominas_columnas.md
 */
const calculateEmployeeRowWithCalendar = (
    employeeId: number,
    periodCalendar: any[],
    annualCalendar: any[],
    allRawDataPeriod: RawDataRow[],
    allRawDataYTD: RawDataRow[],
    pData: ProcessedDataRow | undefined,
    user: User,
    periodStart: string,
    periodEnd: string,
    annualCutoffDate: string
): DetailedIncidenceRow => {
    const festiveDates = getFestiveDatesFromCalendar(periodCalendar);
    const vacationDates = getVacationDatesFromCalendar(periodCalendar);
    const reducedWorkingDay = hasReducedWorkingDay(periodCalendar);

    const legacyRow = calculateEmployeeRowLegacy(
        employeeId,
        allRawDataPeriod,
        allRawDataYTD,
        pData,
        user,
        periodStart,
        periodEnd,
        festiveDates,
        vacationDates,
        annualCutoffDate,
        reducedWorkingDay
    );

    const vacationCredit = user.diasVacaciones ?? ANNUAL_CREDITS.VACATION_DAYS;

    // El periodo de vacaciones se cuenta desde el día 1 del mes de periodEnd (o periodStart si es mismo mes)
    const monthStart = `${periodEnd.substring(0, 7)}-01`;
    const vacationPeriodDays = sumVacationDaysFromCalendar(periodCalendar, monthStart, periodEnd);

    // El acumulado anual (YTD) es siempre desde el 1 de enero
    const annualStart = `${periodEnd.substring(0, 4)}-01-01`;
    const vacationYtdDays = sumVacationDaysFromCalendar(annualCalendar, annualStart, annualCutoffDate);

    const adjusted = {
        ...legacyRow,
        hVacaciones: vacationPeriodDays,
        acumVacaciones: vacationYtdDays,
        dispVacaciones: vacationCredit - vacationYtdDays
    };

    const recomputedTotal =
        adjusted.horasDia +
        adjusted.horasTarde +
        adjusted.horasNoche +
        adjusted.hMedico +
        adjusted.asOficiales +
        (adjusted.hVacaciones * 8) +
        adjusted.espYAc +
        adjusted.hLDisp +
        adjusted.hSind +
        adjusted.hITAT +
        adjusted.hITEC +
        (adjusted.hVacAnt * 8) +
        adjusted.hLeyFam +
        adjusted.hTAJ +
        adjusted.tiempoRetrasos;

    return roundRow({ ...adjusted, totalHoras: recomputedTotal });
};

/**
 * Método legacy (sin consulta individual de calendario)
 * Mantiene compatibilidad con código anterior
 */
const calculateEmployeeRowLegacy = (
    employeeId: number,
    allRawDataPeriod: RawDataRow[],
    allRawDataYTD: RawDataRow[],
    pData: ProcessedDataRow | undefined,
    user: User,
    periodStart: string,
    periodEnd: string,
    festiveDates?: Set<string>,
    vacationDates?: Set<string>,
    ytdCutoffDate?: string,
    reducedWorkingDayFlag: boolean = false
): DetailedIncidenceRow => {
    const currentYear = new Date(periodEnd).getFullYear();
    const ytdStartStr = `${currentYear}-01-01`;
    const ytdEndStr = ytdCutoffDate && ytdCutoffDate.length >= 10
        ? ytdCutoffDate.substring(0, 10)
        : periodEnd;

    const empRawPeriod = allRawDataPeriod.filter(r => toOperarioIdNumber(r.IDOperario) === employeeId);
    const empRawYTD = allRawDataYTD.filter(r => toOperarioIdNumber(r.IDOperario) === employeeId);

    const fallbackShift: 'M' | 'TN' = pData?.turnoAsignado === 'TN' ? 'TN' : 'M';
    const userShift = resolveShiftFromRows(empRawYTD.length > 0 ? empRawYTD : empRawPeriod, fallbackShift);
    const colectivo = resolveDepartment(
        empRawYTD.length > 0 ? empRawYTD : empRawPeriod,
        pData?.colectivo || user.department || ''
    );

    const inPeriod = (date: string) => {
        const d = normalizeDateStr(date);
        return d >= periodStart && d <= periodEnd;
    };
    const inYtd = (date: string) => {
        const d = normalizeDateStr(date);
        return d >= ytdStartStr && d <= ytdEndStr;
    };

    const annualIncidentRows = empRawYTD.filter(r => inYtd(r.Fecha));

    const effectiveFestiveDates = new Set<string>(festiveDates);
    const effectiveVacationDates = new Set<string>(vacationDates);
    empRawPeriod.forEach(row => {
        if (Number(row.TipoDiaEmpresa) === 1) {
            effectiveFestiveDates.add(normalizeDateStr(row.Fecha));
        }
    });

    const workRows = empRawPeriod.filter(r => inPeriod(r.Fecha));

    const normalAudit = auditUnpairedPunches(workRows, (r) => isNormalWorkMotivo(r.MotivoAusencia));
    if (normalAudit.unmatchedEntries > 0 || normalAudit.unmatchedExits > 0) {
        console.warn(
            `⚠️ Integridad de fichajes con huecos para ${user.name} (${employeeId}). ` +
            `Entradas sin salida: ${normalAudit.unmatchedEntries}, salidas sin entrada: ${normalAudit.unmatchedExits}.`
        );
    }

    const workIntervals = buildWorkedIntervals(workRows);

    let b: TimeBuckets = { horasDia: 0, excesoJornada1: 0, horasTarde: 0, nocturnas: 0, horasNoche: 0, festivas: 0 };
    workIntervals.forEach(interval => {
        b = addIntervalToBuckets(b, interval, userShift, effectiveFestiveDates, effectiveVacationDates);
    });

    const tajAudit = auditUnpairedPunches(workRows, () => true, 14);
    if (tajAudit.unmatchedExits > 0) {
        console.warn(
            `⚠️ Integridad TAJ con huecos para ${user.name} (${employeeId}). ` +
            `Salidas TAJ sin entrada previa: ${tajAudit.unmatchedExits}.`
        );
    }

    const tajIntervals = buildTAJIntervals(workRows);
    // El TAJ ya no se resta aquí de los buckets de trabajo, porque 'buildWorkedIntervals' 
    // solo utiliza fichajes normales, excluyendo intrínsecamente el tiempo de TAJ.
    const hTAJFromIntervals = tajIntervals.reduce((acc, interval) => acc + getIntervalDuration(interval), 0);

    const sumHours = (rows: RawDataRow[], code: number, dateFilter: (d: string) => boolean): number => {
        const intervals = buildIncidentIntervalsByCode(rows.filter(r => dateFilter(r.Fecha)), code);
        return intervals.reduce((acc, interval) => acc + getIntervalDuration(interval), 0);
    };

    const countDays = (rows: RawDataRow[], code: number, dateFilter: (d: string) => boolean): number => {
        const dates = new Set(
            rows
                .filter(r => toMotivoNumber(r.MotivoAusencia) === code && dateFilter(r.Fecha))
                .map(r => normalizeDateStr(r.Fecha))
        );
        return dates.size;
    };

    const countIncidents = (rows: RawDataRow[], code: number, dateFilter: (d: string) => boolean): number => {
        return rows.filter(r => toMotivoNumber(r.MotivoAusencia) === code && dateFilter(r.Fecha)).length;
    };

    const hMedico = sumHours(empRawPeriod, 2, inPeriod);
    const acumMedico = sumHours(annualIncidentRows, 2, inYtd);
    const dispMedico = ANNUAL_CREDITS.MEDICO_HOURS - acumMedico;

    // Las vacaciones (ID 5) ya no se cuentan desde fichajes, se inician en 0 
    // y se sobreescriben después con los datos del calendario en calculateEmployeeRowWithCalendar
    const hVacacionesDias = 0;
    const acumVacacionesDias = 0;
    const dispVacacionesDias = user.diasVacaciones ?? ANNUAL_CREDITS.VACATION_DAYS;

    const hVacAntDias = sumHours(empRawPeriod, 8, inPeriod) / 8;

    const hLDisp = sumHours(empRawPeriod, 7, inPeriod);
    const acumHLDisp = sumHours(annualIncidentRows, 7, inYtd);
    const dispHLDisp = ANNUAL_CREDITS.LIBRE_DISPOSICION_HOURS - acumHLDisp;

    const hLeyFam = sumHours(empRawPeriod, 13, inPeriod);
    const acumHLF = sumHours(annualIncidentRows, 13, inYtd);
    const dispHLF = ANNUAL_CREDITS.LEY_FAMILIAS_HOURS - acumHLF;

    const asOficiales = sumHours(empRawPeriod, 3, inPeriod);
    const espYAc = sumHours(empRawPeriod, 6, inPeriod);
    const hSind = sumHours(empRawPeriod, 9, inPeriod);

    const diasITAT = countDays(empRawPeriod, 10, inPeriod);
    const hITAT = sumHours(empRawPeriod, 10, inPeriod);

    const diasITEC = countDays(empRawPeriod, 11, inPeriod);
    const hITEC = sumHours(empRawPeriod, 11, inPeriod);

    const numTAJ = countIncidents(empRawPeriod, 14, inPeriod);
    const hTAJ = hTAJFromIntervals;

    const retrasos = calcularRetrasos(empRawPeriod, userShift, periodStart, periodEnd);
    const numRetrasos = retrasos.num;
    const tiempoRetrasos = retrasos.tiempo;

    const totalHoras =
        b.horasDia +
        b.horasTarde +
        b.horasNoche +
        hMedico +
        asOficiales +
        (hVacacionesDias * 8) +
        espYAc +
        hLDisp +
        hSind +
        hITAT +
        hITEC +
        (hVacAntDias * 8) +
        hLeyFam +
        hTAJ +
        tiempoRetrasos;

    return roundRow({
        colectivo,
        operario: `FV${employeeId.toString().padStart(3, '0')}`,
        nombre: user.name,
        jF: user.flexible === true,
        rJ: reducedWorkingDayFlag,
        totalHoras,
        horasDia: b.horasDia,
        excesoJornada1: b.excesoJornada1,
        horasTarde: b.horasTarde,
        nocturnas: b.nocturnas,
        horasNoche: b.horasNoche,
        festivas: b.festivas,
        hMedico, acumMedico, dispMedico,
        hVacaciones: hVacacionesDias, acumVacaciones: acumVacacionesDias, dispVacaciones: dispVacacionesDias,
        hLDisp, acumHLDisp, dispHLDisp,
        hLeyFam, acumHLF, dispHLF,
        asOficiales,
        espYAc,
        hSind,
        hVacAnt: hVacAntDias,
        diasITAT, hITAT,
        diasITEC, hITEC,
        numTAJ, hTAJ,
        numRetrasos, tiempoRetrasos,
        productivo: user.productivo ?? true
    });
};


const getDuration = (row: RawDataRow): number => {
    const ini = normalizeTimeStr(row.Inicio || '');
    const fin = normalizeTimeStr(row.Fin || '');
    if (ini && fin && ini !== '00:00' && fin !== '00:00') {
        const start = getMinutes(ini);
        const end = getMinutes(fin);
        if (end < start) return (1440 - start + end) / 60;
        return (end - start) / 60;
    }
    return 0; // Sin Inicio/Fin válido no se puede calcular duración
};

/**
 * Calcula retrasos de un empleado en un periodo.
 * 
 * REGLAS:
 * - Turno M: Horario esperado 07:00
 * - Turno TN: Horario esperado 15:00
 * - Margen de tolerancia: 1 minuto 59 segundos (1.983 min)
 * - Solo cuenta la PRIMERA ENTRADA NORMAL del día (sin motivo de ausencia)
 * - Si entrada > horario + margen, se considera retraso
 * 
 * @param rows Todos los fichajes del empleado
 * @param turno Turno asignado al empleado ('M' o 'TN')
 * @param startDate Fecha inicio periodo (YYYY-MM-DD)
 * @param endDate Fecha fin periodo (YYYY-MM-DD)
 * @returns { num: cantidad de días con retraso, tiempo: horas totales de retraso }
 */
const calcularRetrasos = (
    rows: RawDataRow[],
    turno: 'M' | 'TN',
    startDate: string,
    endDate: string
): { num: number; tiempo: number } => {
    const horaEsperada = turno === 'M' ? 7 * 60 : 15 * 60; // En minutos desde medianoche
    const margenMin = 1 + 59 / 60; // 1min 59seg en minutos decimales

    const retrasosPorDia = new Map<string, number>();

    // Agrupar fichajes por fecha
    const porDia = rows
        .filter(r => {
            const d = normalizeDateStr(r.Fecha);
            return d >= startDate && d <= endDate;
        })
        .reduce((acc, r) => {
            const d = normalizeDateStr(r.Fecha);
            if (!acc.has(d)) acc.set(d, []);
            acc.get(d)!.push(r);
            return acc;
        }, new Map<string, RawDataRow[]>());

    // Analizar cada día
    for (const [fecha, fichs] of porDia) {
        // Filtrar solo ENTRADAS normales (isEntrada soporta boolean/number/string)
        const entradas = fichs
            .filter(f =>
                isEntrada(f.Entrada) &&
                f.Hora &&
                f.Hora !== '00:00:00' &&
                isNormalWorkMotivo(f.MotivoAusencia)
            )
            .sort((a, b) => normalizeTimeStr(a.Hora || '').localeCompare(normalizeTimeStr(b.Hora || '')));

        if (entradas.length > 0) {
            const primeraEntrada = entradas[0];
            const minutosEntrada = getMinutes(normalizeTimeStr(primeraEntrada.Hora || ''));
            const retrasoMin = minutosEntrada - horaEsperada;

            // Si supera el margen, es retraso
            if (retrasoMin > margenMin) {
                retrasosPorDia.set(fecha, retrasoMin / 60); // Convertir a horas
            }
        }
    }

    return {
        num: retrasosPorDia.size,
        tiempo: Array.from(retrasosPorDia.values()).reduce((a, b) => a + b, 0)
    };
};


export const buildDetailedIncidenceRows = (
    processedData: ProcessedDataRow[],
    allRawDataPeriod: RawDataRow[],
    allRawDataYTD: RawDataRow[],
    allUsers: User[],
    filterStartDate: string,
    filterEndDate: string
): DetailedIncidenceRow[] => {
    const periodStartStr = filterStartDate;
    const periodEndStr = filterEndDate;
    const processedMap = new Map<number, ProcessedDataRow>();
    processedData.forEach(p => processedMap.set(p.operario, p));

    return allUsers.map(user => {
        const idOperario = Number(user.id);
        const pData = processedMap.get(idOperario);
        return calculateEmployeeRowLegacy(
            idOperario,
            allRawDataPeriod,
            allRawDataYTD,
            pData,
            user,
            periodStartStr,
            periodEndStr,
            undefined,
            undefined,
            periodEndStr
        );
    });
};

const HOURS_FORMAT = '#,##0.00';
const INTEGER_FORMAT = '#,##0';

const getMonthSheetName = (dateIso: string): string => {
    const parsed = new Date(`${dateIso}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return 'RESUMEN';
    }
    return parsed.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase();
};

const colRef = (colNum: number): string => {
    let n = colNum;
    let out = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        n = Math.floor((n - 1) / 26);
    }
    return out;
};

export const exportDetailedIncidenceToXlsx = async (rows: DetailedIncidenceRow[], fileName: string, startDate: string, endDate: string): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'APP PRESENCIA';
    workbook.created = new Date();

    const monthSheetName = getMonthSheetName(endDate);
    const exportTimestamp = new Date();
    const exportTimestampLabel = exportTimestamp.toLocaleString('es-ES', { hour12: false });

    const headers = [
        'Colectivo', 'Operario', 'Nombre', 'Productivo', 'J_F', 'R_J', 'TOTAL Horas', 'Horas Dia', 'EXCESO JORNADA 1', 'Horas Tarde', 'NOCTURNAS',
        'Horas Noche', 'FESTIVAS',
        'H. Medico', 'Acum. Medico', 'Disp. Medico',
        'H. Vacaciones', 'Acum. Vacaciones', 'Disp. Vacaciones',
        'H.L. Disp', 'Acum. H.L. Disp', 'Disp. H.L. Disp',
        'H. Ley Fam', 'Acum. HLF', 'Disp. HLF',
        'As. Oficiales', 'Esp. y Ac', 'H. Sind', 'H. Vac. Ant',
        'Dias ITAT', 'H. ITAT', 'Dias ITEC', 'H. ITEC',
        'Num. TAJ', 'H. TAJ', 'Num. Retrasos', 'Tiempo Retrasos'
    ];

    const sortedRowsByOperario = [...rows].sort((a, b) => {
        const aNum = parseInt(String(a.operario || '').replace(/\D/g, ''), 10);
        const bNum = parseInt(String(b.operario || '').replace(/\D/g, ''), 10);
        if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
            return aNum - bNum;
        }
        return String(a.operario || '').localeCompare(String(b.operario || ''), 'es', { numeric: true });
    });

    const data = sortedRowsByOperario.map(r => [
        r.colectivo, r.operario, r.nombre, r.productivo ? 'SI' : 'NO',
        r.jF ? 'SI' : 'NO', r.rJ ? 'SI' : 'NO',
        r.totalHoras, r.horasDia, r.excesoJornada1, r.horasTarde, r.nocturnas, r.horasNoche, r.festivas,
        r.hMedico, r.acumMedico, r.dispMedico,
        r.hVacaciones, r.acumVacaciones, r.dispVacaciones,
        r.hLDisp, r.acumHLDisp, r.dispHLDisp,
        r.hLeyFam, r.acumHLF, r.dispHLF,
        r.asOficiales, r.espYAc, r.hSind, r.hVacAnt,
        r.diasITAT, r.hITAT, r.diasITEC, r.hITEC,
        r.numTAJ, r.hTAJ, r.numRetrasos, r.tiempoRetrasos
    ]);

    const worksheet = workbook.addWorksheet(monthSheetName, {
        views: [{ state: 'frozen', ySplit: 2, xSplit: 2, topLeftCell: 'C3', showGridLines: false }]
    });

    worksheet.columns = [
        { width: 18 }, { width: 9 }, { width: 28 }, { width: 11 }, { width: 7 }, { width: 7 }, { width: 12 }, { width: 10 }, { width: 16 }, { width: 11 },
        { width: 11 }, { width: 11 }, { width: 9 }, { width: 11 }, { width: 13 }, { width: 13 }, { width: 18 }, { width: 16 }, { width: 17 },
        { width: 9 }, { width: 13 }, { width: 13 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 8 },
        { width: 11 }, { width: 10 }, { width: 8 }, { width: 10 }, { width: 8 }, { width: 9 }, { width: 7 }, { width: 13 }, { width: 14 }
    ];

    worksheet.mergeCells(`A1:${colRef(headers.length)}1`);
    const headerCell = worksheet.getCell('A1');
    headerCell.value = `Parametros = Todos los operarios entre ${startDate} y ${endDate} | Exportado: ${exportTimestampLabel}`;
    headerCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1F4E78' } };
    headerCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 22;

    worksheet.addTable({
        name: 'T_NOMINAS',
        ref: 'A2',
        headerRow: true,
        style: {
            theme: 'TableStyleLight1',
            showRowStripes: true
        },
        columns: headers.map(name => ({ name })),
        rows: data
    });
    worksheet.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: rows.length + 2, column: headers.length }
    };

    const totalTableRows = rows.length + 1;
    const tableStartRow = 2;
    const tableEndRow = tableStartRow + totalTableRows - 1;

    for (let r = tableStartRow; r <= tableEndRow; r++) {
        for (let c = 1; c <= headers.length; c++) {
            const cell = worksheet.getCell(`${colRef(c)}${r}`);
            const isHeader = r === tableStartRow;
            const isOddDataRow = (r - tableStartRow) % 2 === 1;

            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF8E8E8E' } },
                left: { style: 'thin', color: { argb: 'FF8E8E8E' } },
                bottom: { style: 'thin', color: { argb: 'FF8E8E8E' } },
                right: { style: 'thin', color: { argb: 'FF8E8E8E' } }
            };

            if (isHeader) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } };
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            } else {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isOddDataRow ? 'FFF2F2F2' : 'FFFFFFFF' }
                };
                cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E1E1E' } };
            }
        }
    }

    for (let r = 1; r <= 250; r++) {
        for (let c = 1; c <= headers.length; c++) {
            if (r === 1) continue;
            if (r >= tableStartRow && r <= tableEndRow) continue;
            const cell = worksheet.getCell(`${colRef(c)}${r}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
            };
            if (!cell.font) cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E1E1E' } };
        }
    }

    const hourColumns = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 33, 35, 37];
    const integerColumns = [30, 32, 34, 36];
    for (let rowIdx = 3; rowIdx <= rows.length + 2; rowIdx++) {
        for (const col of hourColumns) {
            worksheet.getCell(`${colRef(col)}${rowIdx}`).numFmt = HOURS_FORMAT;
        }
        for (const col of integerColumns) {
            worksheet.getCell(`${colRef(col)}${rowIdx}`).numFmt = INTEGER_FORMAT;
        }
    }

    const totalHoras = rows.reduce((acc, r) => acc + r.totalHoras, 0);
    const totalFestivas = rows.reduce((acc, r) => acc + r.festivas, 0);
    const totalMedico = rows.reduce((acc, r) => acc + r.hMedico, 0);
    const totalVacaciones = rows.reduce((acc, r) => acc + r.hVacaciones, 0);
    const totalRetrasos = rows.reduce((acc, r) => acc + r.tiempoRetrasos, 0);
    const totalTaj = rows.reduce((acc, r) => acc + r.hTAJ, 0);
    const promedioHoras = rows.length > 0 ? totalHoras / rows.length : 0;

    const topHours = [...rows]
        .sort((a, b) => b.totalHoras - a.totalHoras)
        .slice(0, 10);

    const topRetrasos = [...rows]
        .sort((a, b) => b.tiempoRetrasos - a.tiempoRetrasos)
        .slice(0, 10);

    const byColectivo = new Map<string, { colectivo: string; horas: number; festivas: number; retrasos: number; empleados: number }>();
    for (const row of rows) {
        const key = row.colectivo || 'SIN COLECTIVO';
        const agg = byColectivo.get(key) ?? { colectivo: key, horas: 0, festivas: 0, retrasos: 0, empleados: 0 };
        agg.horas += row.totalHoras;
        agg.festivas += row.festivas;
        agg.retrasos += row.tiempoRetrasos;
        agg.empleados += 1;
        byColectivo.set(key, agg);
    }
    const topColectivos = [...byColectivo.values()].sort((a, b) => b.horas - a.horas).slice(0, 8);

    // --- AGREGACIÓN PRODUCTIVIDAD ---
    const prodStats = {
        productivos: { horas: 0, excesos: 0, ausencias: 0, retrasos: 0, empleados: 0 },
        improductivos: { horas: 0, excesos: 0, ausencias: 0, retrasos: 0, empleados: 0 }
    };

    for (const row of rows) {
        // En roles/columnas, si productivo es boolean true
        const isProd = row.productivo === true;
        const target = isProd ? prodStats.productivos : prodStats.improductivos;
        target.empleados += 1;
        target.horas += row.totalHoras;
        // Asumiendo que asOficiales, hMedico, etc son ausencias. O usar hTAJ
        target.ausencias += (row.hMedico + row.hVacaciones + row.asOficiales + row.hSind + row.espYAc + row.hLDisp);
        target.retrasos += row.tiempoRetrasos;
        target.excesos += (row.excesoJornada1 + row.horasNoche + row.nocturnas);
    }

    const bloquesDistribucion = [
        { concepto: 'Horas Dia', valor: rows.reduce((acc, r) => acc + r.horasDia, 0) },
        { concepto: 'Horas Tarde', valor: rows.reduce((acc, r) => acc + r.horasTarde, 0) },
        { concepto: 'Horas Noche', valor: rows.reduce((acc, r) => acc + r.horasNoche, 0) },
        { concepto: 'Nocturnas', valor: rows.reduce((acc, r) => acc + r.nocturnas, 0) },
        { concepto: 'Festivas', valor: totalFestivas },
        { concepto: 'As. Oficiales', valor: rows.reduce((acc, r) => acc + r.asOficiales, 0) },
        { concepto: 'H. Sind', valor: rows.reduce((acc, r) => acc + r.hSind, 0) },
        { concepto: 'H. TAJ', valor: totalTaj }
    ];

    const analysis = workbook.addWorksheet('ANALISIS', {
        views: [{ showGridLines: false }]
    });
    analysis.properties.defaultRowHeight = 20;
    analysis.columns = [
        { width: 26 }, { width: 18 }, { width: 18 }, { width: 16 },
        { width: 4 },
        { width: 28 }, { width: 18 }, { width: 36 }
    ];

    analysis.mergeCells('A1:H1');
    analysis.getCell('A1').value = 'ANALISIS EJECUTIVO - NOMINAS';
    analysis.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    analysis.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    analysis.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } };
    analysis.getRow(1).height = 28;

    analysis.mergeCells('A2:H2');
    analysis.getCell('A2').value = `Periodo: ${startDate} a ${endDate} | Corte: ${exportTimestampLabel} | Hoja origen: ${monthSheetName}`;
    analysis.getCell('A2').font = { name: 'Arial', size: 10, color: { argb: 'FF1E1E1E' } };
    analysis.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

    const kpis = [
        ['Operarios en reporte', rows.length],
        ['Total horas', totalHoras],
        ['Promedio horas por operario', promedioHoras],
        ['Horas festivas', totalFestivas],
        ['Horas medico', totalMedico],
        ['Horas vacaciones', totalVacaciones],
        ['Tiempo retrasos (min)', totalRetrasos],
        ['Horas TAJ', totalTaj]
    ];

    const styleBlockTable = (
        ws: ExcelJS.Worksheet,
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number
    ) => {
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const cell = ws.getCell(`${colRef(c)}${r}`);
                const isHeader = r === startRow;
                const isOdd = (r - startRow) % 2 === 1;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF8E8E8E' } },
                    left: { style: 'thin', color: { argb: 'FF8E8E8E' } },
                    bottom: { style: 'thin', color: { argb: 'FF8E8E8E' } },
                    right: { style: 'thin', color: { argb: 'FF8E8E8E' } }
                };
                if (isHeader) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } };
                    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
                } else {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: isOdd ? 'FFF2F2F2' : 'FFFFFFFF' }
                    };
                    if (!cell.font) {
                        cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E1E1E' } };
                    }
                }
            }
        }
    };

    analysis.getCell('A4').value = 'KPIS CLAVE';
    analysis.getCell('A4').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1E1E1E' } };

    const kpiRows = kpis.map(([name, value]) => [name, Number(value)]);
    analysis.addTable({
        name: 'T_ANALISIS_KPI',
        ref: 'A5',
        headerRow: true,
        style: { theme: 'TableStyleLight1', showRowStripes: false },
        columns: [{ name: 'KPI' }, { name: 'Valor' }],
        rows: kpiRows
    });
    for (let i = 0; i < kpiRows.length; i++) {
        const row = 6 + i;
        analysis.getCell(`B${row}`).numFmt = i === 0 || i === 6 ? INTEGER_FORMAT : HOURS_FORMAT;
    }
    styleBlockTable(analysis, 5, 5 + kpiRows.length, 1, 2);

    analysis.getCell('A15').value = 'TOP 10 OPERARIOS POR TOTAL HORAS';
    analysis.getCell('A15').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1E1E1E' } };
    const topHoursRows = topHours.length > 0
        ? topHours.map(entry => [entry.operario, entry.nombre, entry.colectivo, entry.totalHoras])
        : [['-', 'Sin datos', '-', 0]];
    analysis.addTable({
        name: 'T_ANALISIS_TOP_HORAS',
        ref: 'A16',
        headerRow: true,
        style: { theme: 'TableStyleLight1', showRowStripes: false },
        columns: [{ name: 'Operario' }, { name: 'Nombre' }, { name: 'Colectivo' }, { name: 'Total Horas' }],
        rows: topHoursRows
    });
    for (let i = 0; i < topHoursRows.length; i++) {
        analysis.getCell(`D${17 + i}`).numFmt = HOURS_FORMAT;
    }
    styleBlockTable(analysis, 16, 16 + topHoursRows.length, 1, 4);

    analysis.getCell('F4').value = 'DISTRIBUCION DE HORAS';
    analysis.getCell('F4').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1E1E1E' } };
    const distRows = bloquesDistribucion.map(item => [item.concepto, item.valor, '']);
    analysis.addTable({
        name: 'T_ANALISIS_DISTRIB',
        ref: 'F5',
        headerRow: true,
        style: { theme: 'TableStyleLight1', showRowStripes: false },
        columns: [{ name: 'Concepto' }, { name: 'Horas' }, { name: 'Grafica' }],
        rows: distRows
    });
    const distStart = 6;
    const distEnd = distStart + distRows.length - 1;
    for (let i = 0; i < distRows.length; i++) {
        const row = distStart + i;
        analysis.getCell(`G${row}`).numFmt = HOURS_FORMAT;
        analysis.getCell(`H${row}`).value = {
            formula: `REPT("█",ROUND((G${row}/MAX($G$${distStart}:$G$${distEnd}))*20,0))&" "&TEXT(G${row}/SUM($G$${distStart}:$G$${distEnd}),"0.0%")`
        };
        analysis.getCell(`H${row}`).font = { name: 'Consolas', color: { argb: 'FF1E1E1E' } };
    }
    styleBlockTable(analysis, 5, 5 + distRows.length, 6, 8);

    analysis.getCell('F16').value = 'TOP COLECTIVOS POR HORAS';
    analysis.getCell('F16').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1E1E1E' } };
    const topColectivosRows = topColectivos.length > 0
        ? topColectivos.map(entry => [entry.colectivo, entry.horas, ''])
        : [['Sin datos', 0, '']];
    analysis.addTable({
        name: 'T_ANALISIS_COLECTIVOS',
        ref: 'F17',
        headerRow: true,
        style: { theme: 'TableStyleLight1', showRowStripes: false },
        columns: [{ name: 'Colectivo' }, { name: 'Horas' }, { name: 'Grafica' }],
        rows: topColectivosRows
    });
    const colectStart = 18;
    const colectEnd = colectStart + topColectivosRows.length - 1;
    for (let i = 0; i < topColectivosRows.length; i++) {
        const row = colectStart + i;
        analysis.getCell(`G${row}`).numFmt = HOURS_FORMAT;
        analysis.getCell(`H${row}`).value = {
            formula: `REPT("█",ROUND((G${row}/MAX($G$${colectStart}:$G$${colectEnd}))*20,0))&" "&TEXT(G${row}/SUM($G$${colectStart}:$G$${colectEnd}),"0.0%")`
        };
        analysis.getCell(`H${row}`).font = { name: 'Consolas', color: { argb: 'FF1E1E1E' } };
    }
    styleBlockTable(analysis, 17, 17 + topColectivosRows.length, 6, 8);

    analysis.getCell('A28').value = 'TOP 10 OPERARIOS POR RETRASOS';
    analysis.getCell('A28').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1E1E1E' } };
    const topRetrasosRows = topRetrasos.length > 0
        ? topRetrasos.map(entry => [entry.operario, entry.nombre, entry.colectivo, entry.tiempoRetrasos])
        : [['-', 'Sin datos', '-', 0]];
    analysis.addTable({
        name: 'T_ANALISIS_RETRASOS',
        ref: 'A29',
        headerRow: true,
        style: { theme: 'TableStyleLight1', showRowStripes: false },
        columns: [{ name: 'Operario' }, { name: 'Nombre' }, { name: 'Colectivo' }, { name: 'Tiempo Retrasos' }],
        rows: topRetrasosRows
    });
    for (let i = 0; i < topRetrasosRows.length; i++) {
        analysis.getCell(`D${30 + i}`).numFmt = HOURS_FORMAT;
    }
    styleBlockTable(analysis, 29, 29 + topRetrasosRows.length, 1, 4);

    // --- RENDERIZAR TABLA DE PRODUCTIVIDAD ---
    analysis.getCell('F29').value = 'COMPARATIVA PRODUCTIVIDAD';
    analysis.getCell('F29').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1E1E1E' } };

    const prodRows = [
        ['Productivos', prodStats.productivos.horas, prodStats.productivos.excesos, prodStats.productivos.ausencias, prodStats.productivos.retrasos],
        ['Improductivos', prodStats.improductivos.horas, prodStats.improductivos.excesos, prodStats.improductivos.ausencias, prodStats.improductivos.retrasos]
    ];

    analysis.addTable({
        name: 'T_ANALISIS_PRODUCTIVIDAD',
        ref: 'F30',
        headerRow: true,
        style: { theme: 'TableStyleLight1', showRowStripes: false },
        columns: [
            { name: 'Tipo' },
            { name: 'Horas Trab.' },
            { name: 'Excesos' },
            { name: 'Ausencias' },
            { name: 'Retrasos' }
        ],
        rows: prodRows
    });

    const prodStart = 31;
    for (let i = 0; i < prodRows.length; i++) {
        const r = prodStart + i;
        analysis.getCell(`G${r}`).numFmt = HOURS_FORMAT;
        analysis.getCell(`H${r}`).numFmt = HOURS_FORMAT;
        analysis.getCell(`I${r}`).numFmt = HOURS_FORMAT;
        analysis.getCell(`J${r}`).numFmt = HOURS_FORMAT;
    }
    // Como las celdas F-J son 5 columnas, ajustamos el style block
    styleBlockTable(analysis, 30, 30 + prodRows.length, 6, 10);

    analysis.getCell('A3').value = 'Panel interactivo: usa filtros en la hoja del mes para analizar casos concretos.';
    analysis.getCell('A3').font = { name: 'Arial', italic: true, color: { argb: 'FF5B5B5B' } };

    for (let row = 1; row <= 120; row++) {
        for (let col = 1; col <= 10; col++) {
            if (row <= 3) continue;
            if (row >= 5 && row <= 13 && col >= 1 && col <= 2) continue;
            if (row >= 16 && row <= (16 + topHoursRows.length) && col >= 1 && col <= 4) continue;
            if (row >= 5 && row <= 13 && col >= 6 && col <= 8) continue;
            if (row >= 17 && row <= (17 + topColectivosRows.length) && col >= 6 && col <= 8) continue;
            if (row >= 29 && row <= (29 + topRetrasosRows.length) && col >= 1 && col <= 4) continue;
            if (row >= 30 && row <= (30 + prodRows.length) && col >= 6 && col <= 10) continue; // Nueva tabla productividad

            const cell = analysis.getCell(`${colRef(col)}${row}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
            };
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * generatePayrollExport — Punto de entrada principal del botón de exportación
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. Obtiene fichajes del periodo seleccionado
 * 2. Obtiene fichajes YTD (desde 01/01/año hasta fecha fin) para acumulados
 * 3. Llama al pipeline de cálculo de 34 columnas con calendarios por empleado
 * 4. Exporta el XLSX con nombre automático
 *
 * @param periodStart Fecha inicio del periodo YYYY-MM-DD
 * @param periodEnd   Fecha fin del periodo YYYY-MM-DD
 * @param operarios   Lista de operarios (User[]) o vacío para todos
 */
export const generatePayrollExport = async (
    periodStart: string,
    periodEnd: string,
    operarios: Operario[],
    onProgress?: (progress: PayrollExportProgress) => void
): Promise<void> => {
    const { fetchFichajesBatched } = await import('../apiService');

    onProgress?.({
        phase: 'validando',
        percent: 2,
        message: 'Validando datos para exportacion...'
    });

    // ── 1. Verificar Online ───────────────────────────────────────────
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Sin conexión. No es posible generar el Excel de nóminas.');
    }
    if (!operarios || operarios.length === 0) {
        throw new Error('No hay operarios para exportar.');
    }

    // Mapear Operario[] → User[] para el pipeline interno
    const { getEmployeeRichData } = await import('../employeeService');
    const users: User[] = await Promise.all(operarios.map(async op => {
        let diasVacaciones: number | undefined;
        try {
            const richData = await getEmployeeRichData(op.IDOperario.toString());
            if (richData && typeof richData.DiasVacaciones === 'number') {
                diasVacaciones = richData.DiasVacaciones;
            }
        } catch (error) {
            console.warn(`⚠️ No se pudo obtener datos enriquecidos para operario ${op.IDOperario}`);
        }
        return {
            id: op.IDOperario,
            name: op.DescOperario,
            role: Role.Employee,
            department: op.DescDepartamento || 'General',
            flexible: op.Flexible,
            productivo: op.Productivo,
            diasVacaciones
        };
    }));

    console.group('📊 [generatePayrollExport] Inicio');
    console.log(`Periodo: ${periodStart} → ${periodEnd}`);
    console.log(`Empleados: ${operarios.length}`);

    // ── 2. Obtener fichajes del PERIODO ───────────────────────────────
    onProgress?.({
        phase: 'cargando_periodo',
        percent: 8,
        message: 'Cargando fichajes del periodo...'
    });
    console.log('⏳ Cargando fichajes del periodo...');
    let allRawDataPeriod: RawDataRow[] = [];
    try {
        allRawDataPeriod = await fetchFichajesBatched(periodStart, periodEnd, '', '', '', 10);
        console.log(`✅ Fichajes periodo: ${allRawDataPeriod.length}`);
    } catch (err: any) {
        console.error('❌ Error crítico cargando datos del periodo:', err);
        throw new Error(`Error al leer fichajes del portal: ${err.message || 'Error desconocido'}. Intenta con un rango más pequeño.`);
    }

    // ── 3. Obtener fichajes YTD (01/01/año → fecha fin) ──────────────
    onProgress?.({
        phase: 'cargando_ytd',
        percent: 18,
        message: 'Cargando fichajes acumulados del ano...'
    });
    const year = periodEnd.substring(0, 4);
    const ytdStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const ytdEnd = periodEnd > yearEnd ? yearEnd : periodEnd;
    console.log(`⏳ Cargando fichajes ANUALES (${ytdStart} → ${ytdEnd})...`);
    let allRawDataYTD: RawDataRow[] = [];
    try {
        allRawDataYTD = await fetchFichajesBatched(ytdStart, ytdEnd, '', '', '', 15);
        console.log(`✅ Fichajes YTD: ${allRawDataYTD.length}`);
    } catch (err: any) {
        console.error('❌ Error crítico cargando acumulados YTD:', err);
        throw new Error(`Fallo al descargar datos anuales (YTD): ${err.message || 'Error desconocido'}. La red puede estar inestable, intente nuevamente.`);
    }

    // ── 4. Calcular filas con calendarios individuales ────────────────
    onProgress?.({
        phase: 'procesando_empleados',
        percent: 24,
        message: `Procesando ${users.length} empleados...`,
        completedEmployees: 0,
        totalEmployees: users.length
    });
    const allRows = await buildDetailedIncidenceRowsWithCalendar(
        [], // processedData no es necesario para el nuevo pipeline
        allRawDataPeriod,
        allRawDataYTD,
        users,
        periodStart,
        periodEnd,
        ytdEnd,
        (employeeProgress) => {
            const base = 24;
            const span = 66;
            const scaled = Math.min(99, Math.max(base, base + Math.round((employeeProgress.percent / 100) * span)));
            onProgress?.({
                phase: 'procesando_empleados',
                percent: scaled,
                message: employeeProgress.message,
                completedEmployees: employeeProgress.completedEmployees,
                totalEmployees: employeeProgress.totalEmployees
            });
        }
    );

    // ── 4.1. Filtrar empleados "fantasma" (Cero actividad) ────────────
    const rows = allRows.filter(r => {
        const totalActividad =
            r.totalHoras + r.festivas + r.hMedico + r.hVacaciones +
            r.hLDisp + r.hLeyFam + r.asOficiales + r.espYAc +
            r.hSind + r.hVacAnt + r.hITAT + r.hITEC + r.hTAJ + r.tiempoRetrasos;

        // Si hay estrictamente al menos algo de tiempo, o si tiene al menos 1 día de ITAT/ITEC, entonces participa.
        return totalActividad > 0 || r.diasITAT > 0 || r.diasITEC > 0;
    });

    console.log(`✅ Filas generadas: ${rows.length} (Excluidos: ${allRows.length - rows.length} inactivos)`);

    // ── 5. Generar nombre de fichero ──────────────────────────────────
    onProgress?.({
        phase: 'construyendo_excel',
        percent: 94,
        message: 'Construyendo archivo Excel...'
    });
    const startFormatted = periodStart.replace(/-/g, '');
    const endFormatted = periodEnd.replace(/-/g, '');
    const fileName = `Nominas_${startFormatted}_${endFormatted}.xlsx`;

    // ── 6. Exportar Excel ─────────────────────────────────────────────
    onProgress?.({
        phase: 'finalizando',
        percent: 98,
        message: 'Guardando archivo en tu equipo...'
    });
    await exportDetailedIncidenceToXlsx(rows, fileName, periodStart, periodEnd);
    onProgress?.({
        phase: 'finalizando',
        percent: 100,
        message: `Excel listo: ${fileName}`
    });
    console.log(`✅ Excel generado: ${fileName}`);
    console.groupEnd();
};
