import React, { useEffect, useMemo, useRef, useState } from 'react';

interface SmartDateInputProps {
    id?: string;
    name?: string;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    min?: string;
    max?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
    showHint?: boolean;
}

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const formatDisplayDate = (isoDate: string): string => {
    if (!isIsoDate(isoDate)) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
};

const parseTypedDate = (raw: string): string | null => {
    const value = raw.trim();
    if (!value) return null;

    let day = 0;
    let month = 0;
    let year = 0;

    const normalized = value.replace(/\./g, '/').replace(/-/g, '/');

    if (/^\d{4}\/\d{2}\/\d{2}$/.test(normalized)) {
        const [y, m, d] = normalized.split('/').map(Number);
        year = y;
        month = m;
        day = d;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
        const [d, m, y] = normalized.split('/').map(Number);
        day = d;
        month = m;
        year = y;
    } else if (/^\d{8}$/.test(value)) {
        day = Number(value.slice(0, 2));
        month = Number(value.slice(2, 4));
        year = Number(value.slice(4, 8));
    } else {
        return null;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
        return null;
    }

    const testDate = new Date(year, month - 1, day);
    if (
        testDate.getFullYear() !== year ||
        testDate.getMonth() !== month - 1 ||
        testDate.getDate() !== day
    ) {
        return null;
    }

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const isOutOfRange = (iso: string, min?: string, max?: string): boolean => {
    if (!isIsoDate(iso)) return true;
    if (min && isIsoDate(min) && iso < min) return true;
    if (max && isIsoDate(max) && iso > max) return true;
    return false;
};

const SmartDateInput: React.FC<SmartDateInputProps> = ({
    id,
    name,
    value,
    defaultValue,
    onChange,
    min,
    max,
    required,
    disabled,
    className,
    placeholder = 'dd/mm/aaaa',
    showHint = false
}) => {
    const isControlled = typeof value === 'string';
    const [internalIso, setInternalIso] = useState<string>(defaultValue || '');
    const currentIso = isControlled ? (value || '') : internalIso;

    const [draft, setDraft] = useState<string>(formatDisplayDate(currentIso));
    const nativeDateRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setDraft(formatDisplayDate(currentIso));
    }, [currentIso]);

    const resolvedClassName = useMemo(
        () => className || 'block w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-10 py-[9px] text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500',
        [className]
    );

    const commitValue = (nextIso: string) => {
        if (isOutOfRange(nextIso, min, max)) {
            setDraft(formatDisplayDate(currentIso));
            return;
        }

        if (onChange) onChange(nextIso);
        if (!isControlled) setInternalIso(nextIso);
        setDraft(formatDisplayDate(nextIso));
    };

    const commitDraft = () => {
        const trimmed = draft.trim();
        if (!trimmed) {
            if (!required) {
                if (onChange) onChange('');
                if (!isControlled) setInternalIso('');
                setDraft('');
            } else {
                setDraft(formatDisplayDate(currentIso));
            }
            return;
        }

        const parsed = parseTypedDate(trimmed);
        if (parsed) {
            commitValue(parsed);
        } else {
            setDraft(formatDisplayDate(currentIso));
        }
    };

    return (
        <div>
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    inputMode="numeric"
                    placeholder={placeholder}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={commitDraft}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commitDraft();
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            setDraft(formatDisplayDate(currentIso));
                        }
                    }}
                    className={resolvedClassName}
                    disabled={disabled}
                />

                <input
                    ref={nativeDateRef}
                    type="date"
                    id={id ? `${id}-native` : undefined}
                    name={name}
                    value={currentIso}
                    min={min}
                    max={max}
                    required={required}
                    disabled={disabled}
                    onChange={e => commitValue(e.target.value)}
                    className="absolute -z-10 h-0 w-0 opacity-0"
                    tabIndex={-1}
                    aria-hidden="true"
                />

                <button
                    type="button"
                    onClick={() => {
                        const native = nativeDateRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
                        if (!native || disabled) return;
                        if (native.showPicker) native.showPicker();
                        else native.click();
                    }}
                    disabled={disabled}
                    className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 hover:text-indigo-600 disabled:opacity-50"
                    aria-label="Abrir calendario"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </button>
            </div>
            {showHint && <p className="mt-1 text-[11px] text-slate-400">Formato: dd/mm/aaaa, yyyy-mm-dd o ddmmaaaa.</p>}
        </div>
    );
};

export default SmartDateInput;
