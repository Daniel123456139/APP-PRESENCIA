import { RawDataRow, ProcessedDataRow, UnjustifiedGap, WorkdayDeviation } from '../types';

/**
 * Normaliza la hora a HH:MM (primeros 5 caracteres)
 */
const normalizeTime = (timeStr: string): string => {
    if (!timeStr) return '';
    return timeStr.replace(' (+1)', '').substring(0, 5);
};

/**
 * Añade minutos a una hora dada (HH:MM)
 */
const addMinutes = (timeStr: string, minutes: number): string => {
    const [h, m] = normalizeTime(timeStr).split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + minutes);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
};

/**
 * Obtiene los límites del turno
 */
const getShiftBounds = (shiftCode: string): { start: string; end: string } => {
    if (shiftCode === 'TN' || shiftCode === 'T') return { start: '15:00', end: '23:00' };
    if (shiftCode === 'N') return { start: '23:00', end: '07:00' };
    if (shiftCode === 'C') return { start: '08:00', end: '17:00' };
    return { start: '07:00', end: '15:00' };
};

const addDaysToDate = (dateStr: string, days: number): string => {
    const base = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(base.getTime())) return dateStr;
    base.setDate(base.getDate() + days);
    return base.toISOString().split('T')[0];
};

export interface IncidentStrategyResult {
    rowsToInsert: Partial<RawDataRow>[];
    rowsToUpdate: Partial<RawDataRow>[]; // Para Caso 3 (Modificación)
    description: string;
}

/**
 * Genera las filas de fichaje para justificar un GAP (Salto)
 * @param gap Datos del hueco (fecha, inicio, fin)
 * @param reason Motivo de ausencia (id, desc)
 * @param employee Datos del empleado
 */
export const generateGapStrategy = (
    gap: UnjustifiedGap,
    reason: { id: number; desc: string },
    employee: ProcessedDataRow
): IncidentStrategyResult => {
    const shiftCode = employee.turnoAsignado || 'M';
    const shift = getShiftBounds(shiftCode);
    const gapStart = normalizeTime(gap.start);
    const gapEnd = normalizeTime(gap.end);

    // Detectar Caso
    const isStartGap = gapStart === shift.start; // Caso 2: Entrada Tardía
    const isEndGap = gapEnd === shift.end;       // Caso 1: Salida Anticipada
    const originPunchId = (gap as any).originPunchId;

    // --- CASO 3: Salida Intermedia (Se va y vuelve) ---
    // El empleado ficha salida y luego vuelve a entrar.
    // Ej: 08:00 (Salida) -> 11:00 (Entrada). Gap real: 08:00 -> 11:00.
    // REGLA USUARIO: "lo que debe hacer es un minuto despues de la primera salida, meter un par de:
    // entrada 'null' un minuto despues
    // salida por el numero de la incidencia un minuto antes de la segunda entrada"

    // IMPORTANTE: Ignoramos 'originPunchId' aquí porque el usuario EXPLICITAMENTE pidió
    // insertar pares (Entry+1, Exit-1) y NO modificar el fichaje original.

    const commonProps = {
        IDOperario: employee.operario,
        DescOperario: employee.nombre,
        Fecha: gap.date,
        DescDepartamento: employee.colectivo || '',
        IDControlPresencia: 0,
        TipoDiaEmpresa: 0,
        TurnoTexto: employee.turnoAsignado
    };

    // --- CASO 2: Entrada Tardía ---
    // El empleado llegó tarde (ej. 11:35). El GAP es 07:00 -> 11:35.
    // REGLA USUARIO: "la hora de entrada se la pone a las 07:02, esto es incorrecto debe de ser a las 07:00"
    if (isStartGap) {
        // La salida de la incidencia es 1 minuto antes de la llegada real
        const exitTime = addMinutes(gapEnd, -1);

        const entryRow = {
            ...commonProps,
            Hora: shift.start, // FORZAR 07:00 o 15:00 exacto
            Entrada: 1,
            MotivoAusencia: null,
            DescMotivoAusencia: '',
            Computable: 'Sí' as any,
            GeneradoPorApp: true
        };

        const exitRow = {
            ...commonProps,
            Hora: exitTime,
            Entrada: 0,
            MotivoAusencia: reason.id,
            DescMotivoAusencia: reason.desc,
            Computable: 'No',
            Inicio: shift.start, // Referencia visual
            Fin: gapEnd,        // Referencia visual
            GeneradoPorApp: true
        };

        return {
            rowsToInsert: [entryRow, exitRow],
            rowsToUpdate: [],
            description: `Entrada Tardía: Insertar ${shift.start} (Entrada) y ${exitTime} (Salida Justificada)`
        };
    }

    // --- CASO 1: Salida Anticipada ---
    // El empleado se fue antes (ej. 12:00). El GAP es 12:00 -> 15:00.
    // REGLA USUARIO: "la app graba la sigueinte entrada para la incidencia alas 12:02, en vez dea las 12:01"
    if (isEndGap) {
        // Entrada de la incidencia: 1 minuto después de la salida real
        const entryTime = addMinutes(gapStart, 1);

        const entryRow = {
            ...commonProps,
            Hora: entryTime,
            Entrada: 1,
            MotivoAusencia: null,
            DescMotivoAusencia: '',
            Computable: 'Sí' as any,
            GeneradoPorApp: true
        };

        const exitRow = {
            ...commonProps,
            Hora: shift.end,
            Entrada: 0,
            MotivoAusencia: reason.id,
            DescMotivoAusencia: reason.desc,
            Computable: 'No',
            Inicio: gapStart,
            Fin: shift.end,
            GeneradoPorApp: true
        };

        return {
            rowsToInsert: [entryRow, exitRow],
            rowsToUpdate: [],
            description: `Salida Anticipada: Insertar ${entryTime} (Entrada) y ${shift.end} (Salida Justificada)`
        };
    }

    // --- CASO 3 (Continuación): Salida Intermedia ---
    // Entrada Incidencia: 1 minuto después de la salida real (gapStart)
    const entryTime = gap.startFromBoundary ? gapStart : addMinutes(gapStart, 1);
    // Salida Incidencia: 1 minuto antes de la entrada real (gapEnd)
    const exitTime = addMinutes(gapEnd, -1);

    const entryRow = {
        ...commonProps,
        Hora: entryTime,
        Entrada: 1,
        MotivoAusencia: null,
        DescMotivoAusencia: '',
        Computable: 'Sí' as any,
        GeneradoPorApp: true
    };

    const exitRow = {
        ...commonProps,
        Hora: exitTime,
        Entrada: 0,
        MotivoAusencia: reason.id, // Aquí va la incidencia (ej. Médico)
        DescMotivoAusencia: reason.desc,
        Computable: 'No' as any,
        Inicio: gapStart, // Ref original
        Fin: gapEnd,      // Ref original
        GeneradoPorApp: true
    };

    return {
        rowsToInsert: [entryRow, exitRow],
        rowsToUpdate: [],
        description: `Salida Intermedia: Insertar ${entryTime} (Entrada) y ${exitTime} (Salida Justificada)`
    };
};

/**
 * Genera filas para Ausencia de Día Completo (Caso 4)
 */
export const generateFullDayStrategy = (
    date: string,
    reason: { id: number; desc: string },
    employee: ProcessedDataRow
): IncidentStrategyResult => {
    const shiftCode = employee.turnoAsignado || 'M';
    const shift = getShiftBounds(shiftCode);
    const isCrossMidnight = shift.end < shift.start;
    const exitDate = isCrossMidnight ? addDaysToDate(date, 1) : date;

    const commonProps = {
        IDOperario: employee.operario,
        DescOperario: employee.nombre,
        Fecha: date,
        DescDepartamento: employee.colectivo || '',
        IDControlPresencia: 0,
        TipoDiaEmpresa: 0,
        TurnoTexto: employee.turnoAsignado
    };

    const entryRow = {
        ...commonProps,
        Hora: shift.start,
        Entrada: 1,
        MotivoAusencia: null,
        DescMotivoAusencia: '',
        Computable: 'Sí' as any,
        GeneradoPorApp: true
    };

    const exitRow = {
        ...commonProps,
        Fecha: exitDate,
        Hora: shift.end,
        Entrada: 0,
        MotivoAusencia: reason.id,
        DescMotivoAusencia: reason.desc,
        Computable: 'No' as any,
        Inicio: shift.start,
        Fin: shift.end,
        GeneradoPorApp: true
    };

    return {
        rowsToInsert: [entryRow, exitRow],
        rowsToUpdate: [],
        description: `Día Completo: Insertar ${shift.start} a ${shift.end}`
    };
};

/**
 * Genera filas para Desviación de Jornada (Falta de horas sin hueco claro)
 */
export const generateWorkdayStrategy = (
    workday: WorkdayDeviation,
    reason: { id: number; desc: string },
    employee: ProcessedDataRow
): IncidentStrategyResult => {
    // Si la desviación tiene un 'start' y 'end' (punches reales),
    // podemos intentar 'enganchar' la incidencia al final o al inicio.
    // Según Arturo (062), tiene 07:00 a 15:00 pero le faltan minutos.

    const shiftCode = employee.turnoAsignado || 'M';
    const shift = getShiftBounds(shiftCode);

    // CASO: El empleado trabajó su jornada pero sumó menos de 8h (microsaltos)
    // Estrategia: Insertar un micro-registro sintético al final del turno para cubrir el "hueco" de tiempo.
    // O simplemente usar el shift.end como punto de anclaje.

    const commonProps = {
        IDOperario: employee.operario,
        DescOperario: employee.nombre,
        Fecha: workday.date,
        DescDepartamento: employee.colectivo || '',
        IDControlPresencia: 0,
        TipoDiaEmpresa: 0,
        TurnoTexto: employee.turnoAsignado
    };

    // Para un workday deviation, no tenemos un "hueco" físico,
    // así que creamos un par Entrada/Salida en un minuto "pico" (ej. 15:00:01 -> 15:00:02)
    // que el ERP detecte como el motivo de la falta de tiempo.
    // O mejor: Si el usuario quiere ver "el tramo", podemos usar el delta de tiempo si lo calculamos.

    const entryRow = {
        ...commonProps,
        Hora: shift.end, // Anclado al final
        Entrada: 1,
        MotivoAusencia: null,
        DescMotivoAusencia: '',
        Computable: 'Sí' as any,
        GeneradoPorApp: true
    };

    const exitRow = {
        ...commonProps,
        Hora: shift.end, // Mismo minuto, el motivo es lo que importa
        Entrada: 0,
        MotivoAusencia: reason.id,
        DescMotivoAusencia: reason.desc,
        Computable: 'No' as any,
        Inicio: shift.end,
        Fin: shift.end,
        GeneradoPorApp: true
    };

    return {
        rowsToInsert: [entryRow, exitRow],
        rowsToUpdate: [],
        description: `Ajuste Jornada (${(8 - workday.actualHours).toFixed(2)}h): Registro sintético en ${shift.end}`
    };
};
