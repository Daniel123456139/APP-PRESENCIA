
export interface JobEntry {
    IDMovimiento?: number;
    IDOperario: string;
    DescOperario?: string;
    IDOrden: string; // OF
    DescArticulo?: string;
    Fecha: string; // YYYY-MM-DD
    HoraInicio: string; // HH:mm or HH:mm:ss
    HoraFin: string; // HH:mm or HH:mm:ss
    Tiempo?: number; // Calculated or from API
}

export interface MergedInterval {
    start: number; // Minutes from midnight
    end: number; // Minutes from midnight
    duration: number; // Minutes
}

/**
 * Converts "HH:mm" or "HH:mm:ss" to minutes from midnight.
 */
const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
};

/**
 * Core Algorithm: Flattening Overlapping Intervals
 * 
 * Takes a list of job entries (possibly overlapping) and returns the total REAL time worked.
 * If a worker works on Job A (8:00-9:00) and Job B (8:00-10:00), 
 * the real time is 2 hours (8:00-10:00), not 3 hours.
 */
export const calculateRealTime = (entries: JobEntry[]): number => {
    if (!entries || entries.length === 0) return 0;

    // 1. Convert to simple intervals [start, end] in minutes
    const intervals = entries.map(e => ({
        start: timeToMinutes(e.HoraInicio),
        end: timeToMinutes(e.HoraFin)
    })).filter(i => i.end > i.start); // Remove invalid intervals

    if (intervals.length === 0) return 0;

    // 2. Sort by start time
    intervals.sort((a, b) => a.start - b.start);

    // 3. Merge intervals
    const merged: MergedInterval[] = [];
    let current = intervals[0];

    for (let i = 1; i < intervals.length; i++) {
        const next = intervals[i];

        if (next.start < current.end) {
            // Overlap detected: extend current end if needed
            current.end = Math.max(current.end, next.end);
        } else {
            // No overlap: push current and start new
            merged.push({ ...current, duration: current.end - current.start });
            current = next;
        }
    }
    // Push the last one
    merged.push({ ...current, duration: current.end - current.start });

    // 4. Sum durations (in minutes) and convert to hours
    const totalMinutes = merged.reduce((acc, curr) => acc + curr.duration, 0);
    return Number((totalMinutes / 60).toFixed(2));
};

/**
 * Calculates efficiency/simultaneity ratio.
 * Ratio > 1 means multi-tasking.
 */
export const calculateOverlapEfficiency = (entries: JobEntry[]): number => {
    const realTime = calculateRealTime(entries);
    if (realTime === 0) return 0;

    const totalReportedTime = entries.reduce((acc, curr) => {
        const start = timeToMinutes(curr.HoraInicio);
        const end = timeToMinutes(curr.HoraFin);
        return acc + (end - start);
    }, 0) / 60;

    return Number((totalReportedTime / realTime).toFixed(2));
};
