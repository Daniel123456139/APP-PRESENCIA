export const normalizeDateKey = (value: string): string => {
    if (!value) return '';
    let raw = value.trim();
    if (!raw) return '';

    let datePart = raw;
    if (datePart.includes('T')) {
        datePart = datePart.split('T')[0];
    }
    if (datePart.includes(' ')) {
        datePart = datePart.split(' ')[0];
    }

    if (datePart.includes('/')) {
        const parts = datePart.split('/');
        if (parts.length === 3) {
            const [dd, mm, yyyy] = parts;
            if (yyyy && mm && dd) {
                return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
            }
        }
    }

    return datePart.length >= 10 ? datePart.substring(0, 10) : datePart;
};

const extractTimePart = (value: string): string => {
    if (!value) return '';
    let raw = value.trim();
    if (!raw) return '';

    if (raw.includes('T')) {
        raw = raw.split('T')[1];
    } else if (raw.includes(' ')) {
        const parts = raw.split(' ');
        raw = parts.length > 1 ? parts[1] : raw;
    }

    if (raw.includes('Z')) raw = raw.split('Z')[0];
    if (raw.includes('+')) raw = raw.split('+')[0];
    if (raw.length > 8 && raw.lastIndexOf('-') > 2) {
        raw = raw.split('-')[0];
    }
    if (raw.includes('.')) raw = raw.split('.')[0];

    return raw;
};

export const extractTimeHHMM = (value: string): string => {
    const raw = extractTimePart(value);
    if (!raw) return '';

    const match = raw.match(/(\d{1,2}):(\d{2})/);
    if (!match) return '';

    const hh = match[1].padStart(2, '0');
    const mm = match[2].padStart(2, '0');
    return `${hh}:${mm}`;
};

export const extractTimeHHMMSS = (value: string): string => {
    const raw = extractTimePart(value);
    if (!raw) return '';

    const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return '';

    const hh = match[1].padStart(2, '0');
    const mm = match[2].padStart(2, '0');
    const ss = (match[3] || '00').padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
};

/**
 * Helper para parsear fechas del ERP (dd/MM/yyyy + HH:mm:ss)
 */
export const parseErpDateTime = (fechaStr: string | null, horaStr: string | null): Date => {
    if (!fechaStr) return new Date(NaN);

    try {
        // Cleaning: Handle ISO strings in Date field (e.g., "2026-01-22T00:00:00")
        const cleanFecha = fechaStr.includes('T') ? fechaStr.split('T')[0] : fechaStr;

        let day, month, year;
        if (cleanFecha.includes('/')) {
            const parts = cleanFecha.split('/');
            day = Number(parts[0]);
            month = Number(parts[1]);
            year = Number(parts[2]);
        } else {
            const parts = cleanFecha.split('-');
            year = Number(parts[0]);
            month = Number(parts[1]);
            day = Number(parts[2]);
        }

        // Cleaning: Handle ISO strings in Time field (e.g., "1900-01-01T09:30:00")
        let cleanHora = horaStr || '00:00:00';
        if (cleanHora.includes('T')) {
            cleanHora = cleanHora.split('T')[1];
        }

        const [hour, min, sec] = cleanHora.split(':').map(Number);
        return new Date(year, month - 1, day, hour || 0, min || 0, sec || 0);
    } catch {
        return new Date(NaN);
    }
};

/**
 * Convierte diferencia de tiempo a horas decimales
 */
export const timeToDecimalHours = (start: Date, end: Date): number => {
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return 0;
    return diffMs / (1000 * 60 * 60);
};
