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
