
/**
 * Devuelve la fecha en formato YYYY-MM-DD usando la hora local del sistema.
 * Evita el problema de toISOString() que devuelve el día anterior en UTC+X por la noche.
 */
export const toISODateLocal = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Parsea "YYYY-MM-DD" a un objeto Date local (00:00:00).
 */
export const parseISOToLocalDate = (isoDate: string): Date => {
    if (!isoDate) return new Date();
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d);
};

/**
 * Parsea fecha y hora a un objeto Date local.
 * @param dateISO YYYY-MM-DD
 * @param timeStr HH:mm o HH:mm:ss
 */
export const parseLocalDateTime = (dateISO: string, timeStr: string = '00:00:00'): Date => {
    const [y, m, d] = dateISO.split('-').map(Number);

    const cleanTime = timeStr.length > 8 ? timeStr.substring(0, 8) : timeStr;
    const parts = cleanTime.split(':');
    const hh = parseInt(parts[0] || '0', 10);
    const mm = parseInt(parts[1] || '0', 10);
    const ss = parseInt(parts[2] || '0', 10);

    return new Date(y, m - 1, d, hh, mm, ss);
};

/**
 * Cuenta los días laborables (Lunes a Viernes) en un rango, excluyendo festivos específicos.
 */
export const countWorkingDays = (startDateStr: string, endDateStr: string, holidaySet?: Set<string>): number => {
    let count = 0;
    const start = parseISOToLocalDate(startDateStr);
    const end = parseISOToLocalDate(endDateStr);
    const cur = new Date(start);
    let guard = 0;

    while (cur <= end) {
        guard++;
        if (guard > 4000) {
            console.error('[countWorkingDays] Guard limit reached, breaking loop.', { startDateStr, endDateStr });
            break;
        }
        const dayOfWeek = cur.getDay();
        const iso = toISODateLocal(cur);

        // Es laborable si no es finde (0=Domingo, 6=Sábado) y no está en festivos
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            if (!holidaySet || !holidaySet.has(iso)) {
                count++;
            }
        }
        cur.setDate(cur.getDate() + 1);
    }
    return count;
};


/**
 * Devuelve un rango de fechas "inteligente" por defecto basado en el día actual.
 * - Domingo (0): Devuelve el "Viernes anterior" (hace 2 días).
 * - Lunes (1): Devuelve "El lunes anterior" (hace 7 días).
 * - Resto (Martes a Sábado): Devuelve "Ayer" (hace 1 día).
 *   (Nota: Si es Sábado, "Ayer" es Viernes, cumpliendo la regla de "Viernes anterior").
 */
export const getSmartDefaultDateRange = (): { startDate: string, endDate: string } => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado

    let daysToSubtract = 1; // Por defecto: Ayer

    if (dayOfWeek === 0) {
        // Domingo -> Viernes anterior (2 días atrás)
        daysToSubtract = 2;
    } else if (dayOfWeek === 1) {
        // Lunes -> Viernes anterior (3 días atrás)
        daysToSubtract = 3;
    }
    // Para Sábado (6), daysToSubtract es 1 (Ayer = Viernes), que es correcto.

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysToSubtract);

    const iso = toISODateLocal(targetDate);
    return { startDate: iso, endDate: iso };
};
