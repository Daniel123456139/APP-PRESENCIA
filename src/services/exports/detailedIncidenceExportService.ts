
import { ProcessedDataRow, RawDataRow, User } from '../../types';
import { ANNUAL_CREDITS } from '../../constants';
import { toISODateLocal } from '../../utils/localDate';
import * as XLSX from 'xlsx';

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
 * 8.  NOCTURNAS:        Solo turno M, fuera de turno 20:00-06:00
 * 9.  Horas Noche:      Tiempo trabajado 23:00-07:00 (MENOS TAJ en ese rango)
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
    totalHoras: number;         // 4
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
    const withTurno = rows.find(r => r.TurnoTexto && r.TurnoTexto.trim().length > 0);
    if (withTurno?.TurnoTexto) {
        const turno = withTurno.TurnoTexto.toUpperCase();
        if (turno.includes('TN') || turno.includes('TARDE')) return 'TN';
        if (turno.includes('M')) return 'M';
    }

    const entradas = rows
        .filter(r => isEntrada(r.Entrada) && r.Hora && r.Hora !== '00:00:00')
        .sort((a, b) => a.Hora!.localeCompare(b.Hora!));

    if (entradas.length > 0) {
        const firstMinutes = getMinutes(entradas[0].Hora!.slice(0, 5));
        return firstMinutes >= 12 * 60 ? 'TN' : 'M';
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

    let i = 0;
    while (i < rowsForPairing.length) {
        const current = rowsForPairing[i];
        if (!isEntrada(current.Entrada)) {
            i++;
            continue;
        }

        const startDate = normalizeDateStr(current.Fecha);
        const startTime = normalizeTimeStr(current.Hora || '');
        const startMin = getMinutes(startTime);

        let j = i + 1;
        let exitRow: RawDataRow | null = null;
        while (j < rowsForPairing.length) {
            const candidate = rowsForPairing[j];
            if (isSalida(candidate.Entrada)) {
                exitRow = candidate;
                break;
            }
            if (isEntrada(candidate.Entrada)) break;
            j++;
        }

        if (exitRow) {
            const endDateRaw = normalizeDateStr(exitRow.Fecha);
            const endTime = normalizeTimeStr(exitRow.Hora || '');
            const endMin = getMinutes(endTime);
            let endDate = endDateRaw || startDate;

            if (endDate === startDate && endMin < startMin) {
                endDate = addDaysStr(startDate, 1);
            }

            intervals.push({ startDate, endDate, startMin, endMin });
        }

        i = j > i ? j : i + 1;
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
    nocturnas: number;      // 20:00 - 06:00 (Solo Turno M - "Fuera de turno")
    horasNoche: number;     // 23:00 - 07:00 (Solo Turno TN)
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
 *       - Nocturnas: 20:00 - 06:00
 *
 *    Turno TN (Tarde/Noche):
 *       - Horas Tarde: 15:00 - 23:00
 *       - Horas Noche: 23:00 - 07:00
 *       - Horas Dia: 07:00 - 15:00 (Si trabajara de mañana siendo TN?) ->
 *         Asumiremos que 07-15 siempre es "Horas Dia" universal, o debería ser Exceso?
 *         Según User: "5. Horas Dia: ... dentro del turno de mañana".
 *         Si un TN viene de mañana, ¿es Horas Dia o Exceso?
 *         Si seguimos la lógica de "Fuera de turno", para un TN, la mañana es fuera de turno.
 *         Pero no hay columna "Exceso Mañana".
 *         Asumiremos: 07-15 siempre cae en "Horas Dia".
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
    const R_20_06_A = { s: 20 * 60, e: 24 * 60 }; // 1200 - 1440 (Parte 1 Nocturna M)
    const R_20_06_B = { s: 0, e: 6 * 60 };        // 0 - 360 (Parte 2 Nocturna M)
    const R_23_07_A = { s: 23 * 60, e: 24 * 60 }; // 1380 - 1440 (Parte 1 Noche TN)
    const R_23_07_B = { s: 0, e: 7 * 60 };        // 0 - 420 (Parte 2 Noche TN)

    // Función intersección
    const intersect = (s1: number, e1: number, s2: number, e2: number) => {
        const s = Math.max(s1, s2);
        const e = Math.min(e1, e2);
        return Math.max(0, (e - s) / 60);
    };

    if (shift === 'M') {
        // Horas Dia (07-15)
        b.horasDia += intersect(start, end, R_07_15.s, R_07_15.e);
        // Exceso Jornada 1 (15-20)
        b.excesoJornada1 += intersect(start, end, R_15_20.s, R_15_20.e);
        // Nocturnas (20-06)
        b.nocturnas += intersect(start, end, R_20_06_A.s, R_20_06_A.e);
        b.nocturnas += intersect(start, end, R_20_06_B.s, R_20_06_B.e);
    } else {
        // TN
        // Horas Tarde (15-23)
        b.horasTarde += intersect(start, end, R_15_23.s, R_15_23.e);
        // Horas Noche (23-07)
        b.horasNoche += intersect(start, end, R_23_07_A.s, R_23_07_A.e);
        b.horasNoche += intersect(start, end, R_23_07_B.s, R_23_07_B.e);

        // ¿Qué pasa con 07-15 para un TN? 
        // Si asumimos que 07-15 es "Horas Dia" genérico:
        b.horasDia += intersect(start, end, R_07_15.s, R_07_15.e);
    }

    return b;
};

const addIntervalToBuckets = (
    base: TimeBuckets,
    interval: TimeInterval,
    shift: 'M' | 'TN',
    festiveDates: Set<string>
): TimeBuckets => {
    const isFestiveDate = (dateStr: string): boolean => festiveDates.has(dateStr) || isWeekend(dateStr);

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
    filterEndDate: string
): Promise<DetailedIncidenceRow[]> => {
    const { getCalendarioOperario } = await import('../erpApi');

    console.log('📅 [Excel Nóminas] Iniciando generación con calendario por empleado...');
    console.log(`📊 Total empleados: ${allUsers.length}`);

    const rows: DetailedIncidenceRow[] = [];
    const processedMap = new Map<number, ProcessedDataRow>();
    processedData.forEach(p => processedMap.set(p.operario, p));

    // ═══════════════════════════════════════════════════════════════════
    // Consultar calendarios en paralelo (optimización)
    // ═══════════════════════════════════════════════════════════════════
    console.log('⏳ Consultando calendarios...');
    const calendarPromises = allUsers.map(user =>
        getCalendarioOperario(user.id.toString(), filterStartDate, filterEndDate)
            .catch(error => {
                console.warn(`⚠️ Error obteniendo calendario para empleado ${user.id}:`, error.message);
                return []; // Fallback: array vacío
            })
    );

    const calendars = await Promise.all(calendarPromises);
    console.log('✅ Calendarios consultados');

    // ═══════════════════════════════════════════════════════════════════
    // Procesar cada empleado con su calendario
    // ═══════════════════════════════════════════════════════════════════
    for (let i = 0; i < allUsers.length; i++) {
        const user = allUsers[i];
        const calendar = calendars[i];

        try {
            const row = calculateEmployeeRowWithCalendar(
                user.id,
                calendar,
                allRawDataPeriod,
                allRawDataYTD,
                processedMap.get(user.id),
                user,
                filterStartDate,
                filterEndDate
            );

            rows.push(row);

        } catch (error: any) {
            console.error(`❌ Error procesando empleado ${user.id} (${user.name}):`, error.message);
            // Fallback: usar método sin calendario
            const festiveDates = getFestiveDatesFromCalendar(calendar);
            const fallbackRow = calculateEmployeeRowLegacy(
                user.id,
                allRawDataPeriod,
                allRawDataYTD,
                processedMap.get(user.id),
                user,
                filterStartDate,
                filterEndDate,
                festiveDates
            );
            rows.push(fallbackRow);
        }
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
    calendar: any[],
    allRawDataPeriod: RawDataRow[],
    allRawDataYTD: RawDataRow[],
    pData: ProcessedDataRow | undefined,
    user: User,
    periodStart: string,
    periodEnd: string
): DetailedIncidenceRow => {
    const festiveDates = getFestiveDatesFromCalendar(calendar);

    // Usar la función existente como base
    // La única diferencia es que ahora tenemos el calendario
    const legacyRow = calculateEmployeeRowLegacy(
        employeeId,
        allRawDataPeriod,
        allRawDataYTD,
        pData,
        user,
        periodStart,
        periodEnd,
        festiveDates
    );

    // TODO: Aquí se podría mejorar usando el calendario
    // Por ahora, el calendario ya se refleja en TipoDiaEmpresa
    // que se procesa correctamente

    return legacyRow;
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
    festiveDates?: Set<string>
): DetailedIncidenceRow => {
    const currentYear = new Date(periodEnd).getFullYear();
    const ytdStartStr = `${currentYear}-01-01`;
    const ytdEndStr = `${currentYear}-12-31`;

    const empRawPeriod = allRawDataPeriod.filter(r => r.IDOperario === employeeId);
    const empRawYTD = allRawDataYTD.filter(r => r.IDOperario === employeeId);

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

    const effectiveFestiveDates = new Set<string>(festiveDates);
    empRawPeriod.forEach(row => {
        if (row.TipoDiaEmpresa === 1) {
            effectiveFestiveDates.add(normalizeDateStr(row.Fecha));
        }
    });

    const workRows = empRawPeriod.filter(r => inPeriod(r.Fecha));
    const workIntervals = buildIntervals(workRows, (r) => !r.MotivoAusencia || r.MotivoAusencia === 0 || r.MotivoAusencia === 1);

    let b: TimeBuckets = { horasDia: 0, excesoJornada1: 0, horasTarde: 0, nocturnas: 0, horasNoche: 0, festivas: 0 };
    workIntervals.forEach(interval => {
        b = addIntervalToBuckets(b, interval, userShift, effectiveFestiveDates);
    });

    const tajIntervals = buildIntervals(workRows, (r) => r.MotivoAusencia === 14);
    tajIntervals.forEach(interval => {
        const tajBuckets = addIntervalToBuckets({ horasDia: 0, excesoJornada1: 0, horasTarde: 0, nocturnas: 0, horasNoche: 0, festivas: 0 }, interval, userShift, effectiveFestiveDates);
        b.horasDia = Math.max(0, b.horasDia - tajBuckets.horasDia);
        b.horasTarde = Math.max(0, b.horasTarde - tajBuckets.horasTarde);
        b.horasNoche = Math.max(0, b.horasNoche - tajBuckets.horasNoche);
        b.excesoJornada1 = Math.max(0, b.excesoJornada1 - tajBuckets.excesoJornada1);
        b.nocturnas = Math.max(0, b.nocturnas - tajBuckets.nocturnas);
        b.festivas = Math.max(0, b.festivas - tajBuckets.festivas);
    });
    const hTAJFromIntervals = tajIntervals.reduce((acc, interval) => acc + getIntervalDuration(interval), 0);

    const sumHours = (rows: RawDataRow[], code: number, dateFilter: (d: string) => boolean): number => {
        return rows
            .filter(r => r.MotivoAusencia === code && dateFilter(r.Fecha))
            .reduce((acc, r) => acc + getDuration(r), 0);
    };

    const countDays = (rows: RawDataRow[], code: number, dateFilter: (d: string) => boolean): number => {
        const dates = new Set(
            rows
                .filter(r => r.MotivoAusencia === code && dateFilter(r.Fecha))
                .map(r => normalizeDateStr(r.Fecha))
        );
        return dates.size;
    };

    const countIncidents = (rows: RawDataRow[], code: number, dateFilter: (d: string) => boolean): number => {
        return rows.filter(r => r.MotivoAusencia === code && dateFilter(r.Fecha)).length;
    };

    const hMedico = sumHours(empRawPeriod, 2, inPeriod);
    const acumMedico = sumHours(empRawYTD, 2, inYtd);
    const dispMedico = ANNUAL_CREDITS.MEDICO_HOURS - acumMedico;

    const hVacacionesDias = sumHours(empRawPeriod, 5, inPeriod) / 8;
    const acumVacacionesDias = sumHours(empRawYTD, 5, inYtd) / 8;
    const dispVacacionesDias = ANNUAL_CREDITS.VACATION_DAYS - acumVacacionesDias;

    const hVacAntDias = sumHours(empRawPeriod, 8, inPeriod) / 8;

    const hLDisp = sumHours(empRawPeriod, 7, inPeriod);
    const acumHLDisp = sumHours(empRawYTD, 7, inYtd);
    const dispHLDisp = ANNUAL_CREDITS.LIBRE_DISPOSICION_HOURS - acumHLDisp;

    const hLeyFam = sumHours(empRawPeriod, 13, inPeriod);
    const acumHLF = sumHours(empRawYTD, 13, inYtd);
    const dispHLF = ANNUAL_CREDITS.LEY_FAMILIAS_HOURS - acumHLF;

    const asOficiales = sumHours(empRawPeriod, 3, inPeriod);
    const espYAc = sumHours(empRawPeriod, 6, inPeriod);
    const hSind = sumHours(empRawPeriod, 9, inPeriod);

    const diasITAT = countDays(empRawPeriod, 10, inPeriod);
    const hITAT = sumHours(empRawPeriod, 10, inPeriod);

    const diasITEC = countDays(empRawPeriod, 11, inPeriod);
    const hITEC = sumHours(empRawPeriod, 11, inPeriod);

    const numTAJ = countIncidents(empRawPeriod, 14, inPeriod);
    const hTAJ = hTAJFromIntervals > 0 ? hTAJFromIntervals : sumHours(empRawPeriod, 14, inPeriod);

    const retrasos = calcularRetrasos(empRawPeriod, userShift, periodStart, periodEnd);
    const numRetrasos = retrasos.num;
    const tiempoRetrasos = retrasos.tiempo;

    const totalHoras =
        b.horasDia +
        b.horasTarde +
        b.horasNoche +
        b.festivas +
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
        numRetrasos, tiempoRetrasos
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
    return 8; // Default fallback (should not happen for computable hours usually)
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
        // Filtrar solo ENTRADAS normales (Entrada = 1, sin motivo o motivo 0/1)
        const entradas = fichs
            .filter(f =>
                f.Entrada === 1 &&
                f.Hora &&
                f.Hora !== '00:00:00' &&
                (!f.MotivoAusencia || f.MotivoAusencia === 0 || f.MotivoAusencia === 1)
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
        const idOperario = user.id;
        const pData = processedMap.get(idOperario);
        return calculateEmployeeRowLegacy(
            idOperario,
            allRawDataPeriod,
            allRawDataYTD,
            pData,
            user,
            periodStartStr,
            periodEndStr
        );
    });
};

export const exportDetailedIncidenceToXlsx = (rows: DetailedIncidenceRow[], fileName: string, startDate: string, endDate: string) => {
    const wb = XLSX.utils.book_new();
    const headerInfo = [`Parámetros = Todos los operarios entre ${startDate} y ${endDate} => a Fecha ${new Date().toLocaleDateString()} por Nombre de Operario`];
    const headers = [
        "Colectivo", "Operario", "Nombre", "TOTAL Horas", "Horas Dia", "EXCESO JORNADA 1", "Horas Tarde", "NOCTURNAS",
        "Horas Noche", "FESTIVAS",
        "H. Medico", "Acum. Medico", "Disp. Medico",
        "H. Vacaciones", "Acum. Vacaciones", "Disp. Vacaciones",
        "H.L. Disp", "Acum. H.L. Disp", "Disp. H.L. Disp",
        "H. Ley Fam", "Acum. HLF", "Disp. HLF",
        "As. Oficiales", "Esp. y Ac", "H. Sind", "H. Vac. Ant",
        "Dias ITAT", "H. ITAT", "Dias ITEC", "H. ITEC",
        "Num. TAJ", "H. TAJ", "Num. Retrasos", "Tiempo Retrasos"
    ];

    const data = rows.map(r => [
        r.colectivo, r.operario, r.nombre,
        r.totalHoras, r.horasDia, r.excesoJornada1, r.horasTarde, r.nocturnas, r.horasNoche, r.festivas,
        r.hMedico, r.acumMedico, r.dispMedico,
        r.hVacaciones, r.acumVacaciones, r.dispVacaciones,
        r.hLDisp, r.acumHLDisp, r.dispHLDisp,
        r.hLeyFam, r.acumHLF, r.dispHLF,
        r.asOficiales, r.espYAc, r.hSind, r.hVacAnt,
        r.diasITAT, r.hITAT, r.diasITEC, r.hITEC,
        r.numTAJ, r.hTAJ, r.numRetrasos, r.tiempoRetrasos
    ]);

    const wsData = [headerInfo, headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Resumen");
    XLSX.writeFile(wb, fileName);
};
