import { parseLocalDateTime } from '../../utils/localDate';
import { SHIFT_SPECS } from '../constants/shifts';

// Cache simple para evitar new Date repetidos si string es identico
const dateCache = new Map<string, Date>();

/**
 * Convierte un string HH:MM a minutos totales del día
 */
export const toMinutes = (hhmm: string): number => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

/**
 * Parsea fecha y hora usando cache para optimizar rendimiento en bucles grandes
 */
export const parseDateTime = (date: string, time: string): Date => {
    // Normalizar time a HH:MM:SS si viene HH:MM
    const cleanTime = time.length === 5 ? `${time}:00` : time;
    const key = `${date}T${cleanTime}`;
    // Limpieza básica de cache para no saturar memoria en sesiones largas
    if (dateCache.size > 2000) dateCache.clear();

    if (dateCache.has(key)) return new Date(dateCache.get(key)!);

    const d = parseLocalDateTime(date, cleanTime);
    dateCache.set(key, d);
    return d;
};

export const clearDateCache = () => {
    dateCache.clear();
};

/**
 * Detecta si un registro es ENTRADA (soporta boolean true o number 1)
 */
export const isEntrada = (entrada: boolean | number | string): boolean => {
    return entrada === true || entrada === 1 || entrada === '1';
};

/**
 * Detecta si un registro es SALIDA
 */
export const isSalida = (entrada: boolean | number | string): boolean => {
    return entrada === false || entrada === 0 || entrada === '0';
};

/**
 * Determina el turno más probable basado en la hora de entrada
 */
export const getShiftByTime = (timeStr: string): string => {
    const entryMin = toMinutes(timeStr);
    let bestShift = 'M';
    let minDiff = Infinity;

    SHIFT_SPECS.forEach(s => {
        // Ignorar turnos sin horario definido (V, L, F)
        if (s.start === '00:00' && s.end === '00:00') return;

        const shiftStart = toMinutes(s.start);
        let diff = Math.abs(entryMin - shiftStart);

        // HEURÍSTICA MEJORADA:
        // Es más probable llegar tarde a un turno que ya empezó (entry > start)
        // que llegar muy pronto a un turno futuro (entry < start).
        // Penalizamos las llegadas tempranas ("Adelantos") multiplicando su diferencia.
        if (entryMin < shiftStart) {
            diff = diff * 3;
        }

        if (diff < minDiff) {
            minDiff = diff;
            bestShift = s.code;
        }
    });
    return bestShift;
};

/**
 * Calcula horas de solapamiento entre dos rangos
 */
export const getOverlapHours = (start: Date, end: Date, targetStart: Date, targetEnd: Date): number => {
    const overlapStart = start > targetStart ? start : targetStart;
    const overlapEnd = end < targetEnd ? end : targetEnd;

    if (overlapEnd > overlapStart) {
        return (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
    }
    return 0;
};
