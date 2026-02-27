
import React, { useState, memo, useMemo, useRef, useEffect } from 'react';
import { ProcessedDataRow, RawDataRow, CompanyHoliday } from '../../types';
import { formatPeriodoAnalisis } from '../../utils/dateFormatter';
import { countWorkingDays } from '../../utils/localDate';
import { formatEmployeeId } from '../../utils/formatters';

interface HrDataTableProps {
    data: ProcessedDataRow[];
    rawData: RawDataRow[];
    onReviewGaps: (employee: ProcessedDataRow) => void;
    onManualIncident: (employee: ProcessedDataRow) => void;
    onExport: () => void;
    justifiedIncidentKeys: Map<string, number>;
    startDate?: string;
    endDate?: string;
    companyHolidays?: CompanyHoliday[];
    isLongRange?: boolean;
    flexibleEmployeeIds?: Set<number>;
    highlightEmployeeIds?: Set<number>;
}

// Helpers for keys
const normalizeGapBoundary = (value: string): string => {
    if (!value) return '';
    return value.replace(' (+1)', '').substring(0, 5);
};

const getGapKey = (empId: number, date: string, start: string, end: string) =>
    `gap-${empId}-${date}-${normalizeGapBoundary(start)}-${normalizeGapBoundary(end)}`;
const getDevKey = (empId: number, date: string) => `dev-${empId}-${date}`;

// --- SORTING UTILS ---
const parseStartMinutes = (schedule: string): number | null => {
    if (!schedule || schedule === '-' || schedule === '??:??' || schedule.includes('AUSENTE')) return null;
    const match = schedule.match(/(\d{1,2}):(\d{2})/);
    if (match) {
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    return null;
};

export const computeDisplayJustifiedHours = (row: ProcessedDataRow): number => {
    const base = Number(row.horasJustificadas || 0);

    const intervals = row.justifiedIntervals || [];
    if (intervals.length === 0) {
        return Number.isFinite(base) ? Number(base.toFixed(2)) : 0;
    }

    const toMinutes = (hhmm: string): number => {
        const [h, m] = (hhmm || '00:00').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const inferred = intervals.reduce((acc, interval) => {
        const motivoId = Number(interval.motivoId || 0);
        const motivoDesc = (interval.motivoDesc || '').toUpperCase();
        if (motivoId === 14 || motivoDesc.includes('TAJ')) return acc;

        const start = toMinutes(interval.start || '00:00');
        let end = toMinutes(interval.end || '00:00');
        if (interval.endIsNextDay || end < start) end += 1440;
        const hours = Math.max(0, (end - start) / 60);
        return acc + hours;
    }, 0);

    const inferredRounded = Number(inferred.toFixed(2));
    if (!Number.isFinite(base) || base <= 0) return inferredRounded;
    if (inferredRounded <= 0) return Number(base.toFixed(2));
    return Number(Math.max(base, inferredRounded).toFixed(2));
};

const turnoRank = (turno: string): number => {
    if (turno === 'M') return 1;
    if (turno === 'TN' || turno === 'T') return 2;
    if (turno === 'N') return 3;
    return 4;
};

type SortDirection = 'ascending' | 'descending';
type SortableKeys = keyof ProcessedDataRow | 'displaySchedule' | 'incidentCount' | 'estadoText';

type JustifiedEmployeeMeta = {
    count: number;
    motiveIds: Set<number>;
};

const sortValues = (a: any, b: any, direction: SortDirection, isNumeric: boolean = false) => {
    const isEmptyA = a === null || a === undefined || a === '' || a === '-';
    const isEmptyB = b === null || b === undefined || b === '' || b === '-';

    if (isEmptyA && isEmptyB) return 0;
    if (isEmptyA) return 1;
    if (isEmptyB) return -1;

    let comparison = 0;
    if (isNumeric) {
        comparison = Number(a) - Number(b);
    } else {
        const strA = String(a).toLowerCase();
        const strB = String(b).toLowerCase();
        if (strA < strB) comparison = -1;
        if (strA > strB) comparison = 1;
    }

    return direction === 'ascending' ? comparison : -comparison;
};

// --- SUB-COMPONENTS ---

const SortIcon = ({ active, direction }: { active: boolean; direction: SortDirection }) => {
    if (!active) {
        return (
            <svg className="w-3 h-3 ml-1 text-slate-300 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
        );
    }
    return direction === 'ascending' ? (
        <svg className="w-3 h-3 ml-1 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
    ) : (
        <svg className="w-3 h-3 ml-1 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
    );
};

const TableHeader: React.FC<{
    colKey: SortableKeys;
    label: string;
    currentSort: { key: SortableKeys; direction: SortDirection } | null;
    onSort: (key: SortableKeys) => void;
    className?: string;
    align?: 'left' | 'right' | 'center';
}> = ({ colKey, label, currentSort, onSort, className, align = 'left' }) => {
    const isActive = currentSort?.key === colKey;
    const direction = currentSort?.direction || 'ascending';

    // Flex alignment
    const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

    return (
        <th scope="col" className={`px-4 py-3 select-none cursor-pointer group hover:bg-slate-100 transition-colors ${className}`} onClick={() => onSort(colKey)}>
            <div className={`flex items-center ${justify} w-full`}>
                <span className={`text-xs font-bold uppercase truncate ${isActive ? 'text-blue-700' : 'text-slate-500 group-hover:text-slate-700'}`}>
                    {label}
                </span>
                <SortIcon active={isActive} direction={direction} />
            </div>
        </th>
    );
};

export const ScheduleCell: React.FC<{
    row: ProcessedDataRow,
    startDate?: string,
    endDate?: string,
    companyHolidays?: CompanyHoliday[]
}> = ({ row, startDate, endDate, companyHolidays }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const numAbsentDays = row.absentDays?.length || 0;
    const isMissingOut = row.missingClockOuts && row.missingClockOuts.length > 0;

    // Calcular días laborables esperados
    const expectedWorkingDays = useMemo(() => {
        if (!startDate || !endDate) return 999;
        const holidays = new Set<string>((companyHolidays || []).map(h => h.date));
        return countWorkingDays(startDate, endDate, holidays);
    }, [startDate, endDate, companyHolidays]);


    // Lógica para determinar "AUSENCIA TOTAL" no es necesaria aquí (filtrado arriba)
    const isTotalAbsence = false;

    // Solo si faltó a TODOS los días laborables esperados
    // const isTotalAbsence = numAbsentDays >= expectedWorkingDays && expectedWorkingDays > 0;

    const gaps = useMemo(() => {
        const list: string[] = [];
        if (row.unjustifiedGaps && row.unjustifiedGaps.length > 0) {
            row.unjustifiedGaps.forEach(g => list.push(`Salto: ${g.start} - ${g.end}`));
        }
        if (row.timeSlices && row.timeSlices.length > 1) {
            for (let i = 0; i < row.timeSlices.length - 1; i++) {
                const current = row.timeSlices[i];
                const next = row.timeSlices[i + 1];
                list.push(`Descanso: ${current.end} - ${next.start}`);
            }
        }
        return list;
    }, [row]);

    const hasDetails = gaps.length > 0 || (row.timeSlices && row.timeSlices.length > 0);

    let displayText = row.horarioReal;
    let textColor = "text-slate-700";
    let bgColor = "";

    if (isMissingOut) {
        textColor = "text-amber-700 font-bold";
    }

    return (
        <div className="relative flex items-center">
            <div className={`font-mono text-xs whitespace-nowrap ${textColor} ${bgColor}`}>
                {displayText}
            </div>
            {hasDetails && (
                <div className="ml-2">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                        className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-200 border border-blue-200 transition-colors"
                    >
                        Intervalos trabajados
                    </button>
                    {isOpen && (
                        <div
                            ref={dropdownRef}
                            className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-3 min-w-[200px] animate-fadeIn"
                        >
                            <div className="text-[11px] font-bold text-slate-600 mb-2 border-b border-slate-100 pb-1">
                                Intervalos Trabajados
                            </div>
                            <div className="space-y-1.5">
                                {row.timeSlices && row.timeSlices.map((slice, idx) => (
                                    <div key={idx} className={`font-mono text-xs whitespace-nowrap px-2 py-1 rounded border ${slice.isSynthetic ? 'bg-purple-50 text-purple-700 border-purple-200 dashed-border' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                        {slice.start} - {slice.end} {slice.isSynthetic && <span className="text-[10px] ml-1">🤖</span>}
                                    </div>
                                ))}
                                {(!row.timeSlices || row.timeSlices.length === 0) && (
                                    <div className="text-xs text-slate-400">Sin intervalos registrados</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const formatShortDate = (dateStr: string): string => {
    try {
        const [year, month, day] = dateStr.split('-');
        if (!year || !month || !day) return dateStr;
        return `${day}/${month}`;
    } catch {
        return dateStr;
    }
};

export const JustifiedCell: React.FC<{
    row: ProcessedDataRow;
    startDate?: string;
    endDate?: string;
    align?: 'left' | 'right' | 'center';
}> = ({ row, startDate, endDate, align = 'left' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const intervals = row.justifiedIntervals || [];
    const hasIntervals = intervals.length > 0;
    const isMultiDay = useMemo(() => {
        if (startDate && endDate) return startDate !== endDate;
        const uniqueDates = new Set(intervals.map(i => i.date));
        return uniqueDates.size > 1;
    }, [startDate, endDate, intervals]);

    const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

    return (
        <div className={`relative flex items-center gap-2 ${justify}`}>
            <span className="font-mono text-blue-600">{row.horasJustificadas.toFixed(2)} h</span>
            {hasIntervals && (
                <div>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                        className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-200 border border-blue-200 transition-colors"
                    >
                        Detalle
                    </button>
                    {isOpen && (
                        <div
                            ref={dropdownRef}
                            className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-3 min-w-[220px] animate-fadeIn"
                        >
                            <div className="text-[11px] font-bold text-slate-600 mb-2 border-b border-slate-100 pb-1">
                                Tramos Justificados
                            </div>
                            <div className="space-y-1.5">
                                {intervals.map((interval, idx) => (
                                    <div key={idx} className={`font-mono text-xs whitespace-nowrap px-2 py-1 rounded border mb-1 last:mb-0 ${interval.isSynthetic
                                        ? 'bg-purple-100 text-purple-800 border-purple-300 dashed-border'
                                        : 'bg-amber-100 text-amber-800 border-amber-200'
                                        }`}>
                                        <div className="flex items-center gap-1">
                                            <span>{interval.start} - {interval.end}</span>
                                            {interval.isSynthetic && <span className="text-[10px]">🤖</span>}
                                        </div>
                                        <div className="text-[10px] opacity-75 truncate max-w-[120px]" title={interval.motivoDesc}>
                                            {interval.motivoDesc || `Motivo ${interval.motivoId}`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const SummaryView: React.FC<{
    data: ProcessedDataRow[];
    rawData: RawDataRow[];
    onReviewGaps: (employee: ProcessedDataRow) => void;
    onManualIncident: (employee: ProcessedDataRow) => void;
    onExport: () => void;
    justifiedIncidentKeys: Map<string, number>;
    startDate?: string;
    endDate?: string;
    companyHolidays?: CompanyHoliday[];
    isLongRange?: boolean;
    flexibleEmployeeIds?: Set<number>;
    highlightEmployeeIds?: Set<number>;
}> = memo(({ data, rawData, onReviewGaps, onManualIncident, onExport, justifiedIncidentKeys, startDate, endDate, companyHolidays, isLongRange, flexibleEmployeeIds, highlightEmployeeIds }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>({ key: 'operario', direction: 'ascending' });

    const handleSort = (key: SortableKeys) => {
        setSortConfig(current => {
            if (current && current.key === key) {
                return {
                    key,
                    direction: current.direction === 'ascending' ? 'descending' : 'ascending'
                };
            }
            return { key, direction: 'ascending' };
        });
    };

    const augmentedData = useMemo(() => {
        return data.map(row => {
            const pendingGaps = row.unjustifiedGaps.filter(g => !justifiedIncidentKeys.has(getGapKey(row.operario, g.date, g.start, g.end))).length;
            const pendingDevs = row.workdayDeviations.filter(d => !justifiedIncidentKeys.has(getDevKey(row.operario, d.date))).length;
            const missingOuts = row.missingClockOuts?.length || 0;
            const absences = row.absentDays?.length || 0;
            const totalPending = pendingGaps + pendingDevs + missingOuts + absences;

            const justifiedCount = Array.from(justifiedIncidentKeys.keys()).filter((k: string) => {
                const idStr = String(row.operario);
                return k.startsWith(`gap-${idStr}-`) || k.startsWith(`dev-${idStr}-`);
            }).length;

            // Text for sorting status
            let estadoText = 'Correcto';
            if (totalPending > 0) estadoText = 'Pendiente';
            else if (justifiedCount > 0) estadoText = 'Justificado';
            else if (row.absentDays && row.absentDays.length > 0) {
                // Should not happen in this table, but keep for robustness or fallback
                estadoText = 'Ausencia';
            }

            const displayJustifiedHours = computeDisplayJustifiedHours(row);
            const displayTotal = Number((row.presencia + displayJustifiedHours + (row.hTAJ || 0)).toFixed(2));

            return {
                ...row,
                formattedOperario: formatEmployeeId(row.operario),
                displaySchedule: row.horarioReal || '-',
                horasJustificadas: displayJustifiedHours,
                horasTotalesConJustificacion: displayTotal,
                incidentCount: totalPending,
                estadoText: estadoText // Helper for sorting status column
            };
        });
    }, [data, justifiedIncidentKeys]);

    const sortedAndFilteredData = useMemo(() => {
        let items = [...augmentedData];

        if (sortConfig !== null) {
            items.sort((a, b) => {
                const { key, direction } = sortConfig;
                let valA: any = a[key as keyof typeof a];
                let valB: any = b[key as keyof typeof b];
                let isNumeric = false;

                if (key === 'displaySchedule') {
                    valA = parseStartMinutes(a.displaySchedule);
                    valB = parseStartMinutes(b.displaySchedule);
                    isNumeric = true;
                } else if (key === 'turnoAsignado') {
                    valA = turnoRank(a.turnoAsignado);
                    valB = turnoRank(b.turnoAsignado);
                    isNumeric = true;
                } else if (['operario', 'totalHoras', 'presencia', 'horasJustificadas', 'horasTotalesConJustificacion', 'horasExceso', 'festivas', 'hTAJ', 'incidentCount'].includes(key as string)) {
                    isNumeric = true;
                }

                return sortValues(valA, valB, direction, isNumeric);
            });
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            return items.filter(row =>
                row.nombre.toLowerCase().includes(lowerTerm) ||
                String(row.operario).includes(lowerTerm) ||
                row.formattedOperario.includes(lowerTerm)
            );
        }

        return items;
    }, [augmentedData, searchTerm, sortConfig]);

    const justifiedMetaByEmployee = useMemo(() => {
        const metaByEmployee = new Map<number, JustifiedEmployeeMeta>();

        for (const [key, motive] of justifiedIncidentKeys.entries()) {
            if (!key.startsWith('gap-') && !key.startsWith('dev-')) continue;
            const parts = key.split('-');
            if (parts.length < 3) continue;

            const employeeId = Number(parts[1]);
            if (!Number.isFinite(employeeId)) continue;

            let meta = metaByEmployee.get(employeeId);
            if (!meta) {
                meta = { count: 0, motiveIds: new Set<number>() };
                metaByEmployee.set(employeeId, meta);
            }

            meta.count += 1;
            const numericMotive = Number(motive);
            if (Number.isFinite(numericMotive)) {
                meta.motiveIds.add(numericMotive);
            }
        }

        return metaByEmployee;
    }, [justifiedIncidentKeys]);

    return (
        <div className="bg-white/90 p-5 sm:p-6 rounded-2xl shadow-lg border border-slate-200/70">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-5 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-[11px]">⚡</span>
                        Resumen Empleados
                    </h3>
                    {startDate && endDate && (
                        <p className="text-sm text-slate-600 mt-1">Periodo: {formatPeriodoAnalisis(startDate, endDate)}</p>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <button
                        onClick={onExport}
                        className="flex items-center gap-2 px-3 py-2 bg-white text-emerald-700 rounded-lg hover:bg-emerald-50 border border-emerald-200 transition-colors text-sm font-semibold shadow-sm"
                        title="Exportar tabla a Excel"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                        </svg>
                        Exportar Excel
                    </button>
                    <div className="relative w-full sm:w-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-64 pl-10 pr-4 py-2 border border-slate-200 bg-slate-50 text-slate-900 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="hidden md:block overflow-auto max-h-[600px] border border-slate-200 rounded-xl relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                <table className="w-full text-sm text-left text-slate-500">
                    <thead className="bg-slate-100/80 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <TableHeader colKey="operario" label="ID" currentSort={sortConfig} onSort={handleSort} className="rounded-tl-lg w-20" />
                            <TableHeader colKey="nombre" label="NOMBRE" currentSort={sortConfig} onSort={handleSort} />
                            <TableHeader colKey="displaySchedule" label="TIEMPO REAL" currentSort={sortConfig} onSort={handleSort} />
                            <TableHeader colKey="turnoAsignado" label="TURNO" currentSort={sortConfig} onSort={handleSort} />
                            <TableHeader colKey="presencia" label="PRESENCIA (h)" currentSort={sortConfig} onSort={handleSort} />
                            <TableHeader colKey="horasJustificadas" label="JUSTIFICADAS (h)" currentSort={sortConfig} onSort={handleSort} />
                            <TableHeader colKey="horasTotalesConJustificacion" label="TOTAL (h)" currentSort={sortConfig} onSort={handleSort} />
                            <TableHeader colKey="horasExceso" label="EXCESOS (h)" currentSort={sortConfig} onSort={handleSort} />
                            <TableHeader colKey="festivas" label="FESTIVAS (h)" currentSort={sortConfig} onSort={handleSort} />
                            <TableHeader colKey="hTAJ" label="TAJ" currentSort={sortConfig} onSort={handleSort} />
                            {isLongRange && (
                                <TableHeader colKey="absentDays" label="AUSENCIAS" currentSort={sortConfig} onSort={handleSort} />
                            )}
                            <TableHeader colKey="incidentCount" label="ESTADO" currentSort={sortConfig} onSort={handleSort} className="rounded-tr-lg" />
                        </tr>
                    </thead>
                    <tbody className="overflow-visible">
                        {sortedAndFilteredData.map(row => {
                            const justifiedMeta = justifiedMetaByEmployee.get(row.operario);
                            const justifiedCount = justifiedMeta?.count || 0;
                            const uniqueMotiveIds = justifiedMeta ? [...justifiedMeta.motiveIds].sort((a, b) => a - b) : [];
                            const motiveIdString = uniqueMotiveIds.map(id => String(id).padStart(2, '0')).join(', ');
                            const hasAbsence = false; // row.absentDays && row.absentDays.length > 0;
                            const hasMissingOut = row.missingClockOuts && row.missingClockOuts.length > 0;
                            const hasPendingIncidents = row.incidentCount > 0;

                            const isFlexible = row.isFlexible || flexibleEmployeeIds?.has(row.operario);
                            const hasLeaveConflict = highlightEmployeeIds?.has(row.operario);
                            const rowClass = hasLeaveConflict
                                ? "bg-[#f3d7cf] hover:bg-[#ecc2b5] border-l-4 border-l-[#8b3f2f]"
                                : (isFlexible
                                    ? "bg-emerald-50 hover:bg-emerald-100 border-l-4 border-l-emerald-400"
                                    : "bg-white hover:bg-slate-50 border-l-4 border-l-transparent");


                            return (
                                <tr key={row.operario} className={`${rowClass} border-b border-slate-200 transition-colors`}>
                                    <td className="px-4 py-4 font-mono font-medium text-slate-900">{row.formattedOperario}</td>
                                    <td className="px-4 py-4 font-medium text-slate-800 relative group/name">
                                        <div className="flex items-center gap-1">
                                            <span>{row.nombre}</span>
                                            {hasLeaveConflict && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#8b3f2f] text-white">BAJA/VAC + FICHAJE</span>
                                            )}
                                            {row.vacationConflicts && row.vacationConflicts.length > 0 && (
                                                <span className="text-amber-500 cursor-help" title="Conflicto: Vacaciones con fichajes">
                                                    ⚠️
                                                </span>
                                            )}
                                        </div>
                                        {row.vacationConflicts && row.vacationConflicts.length > 0 && (
                                            <div className="absolute left-0 bottom-full mb-1 w-64 p-3 bg-amber-50 border border-amber-200 text-slate-700 text-xs rounded shadow-lg opacity-0 invisible group-hover/name:opacity-100 group-hover/name:visible z-50 transition-all font-normal">
                                                <div className="font-bold border-b border-amber-200 pb-1 mb-1 text-amber-800">⚠️ Conflicto Vacaciones:</div>
                                                <div className="mb-1">Este empleado tiene fichajes en días marcados como vacaciones:</div>
                                                <ul className="list-disc pl-4 space-y-0.5">
                                                    {row.vacationConflicts.map(d => (
                                                        <li key={d} className="font-mono">{d}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        {!isLongRange && (
                                            <ScheduleCell
                                                row={row}
                                                startDate={startDate}
                                                endDate={endDate}
                                                companyHolidays={companyHolidays}
                                            />
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider w-fit ${row.turnoAsignado === 'M' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                                {row.turnoAsignado}
                                            </span>
                                            {isLongRange && row.shiftChanges && row.shiftChanges.length > 0 && (
                                                <div className="relative group/tooltip">
                                                    <button className="text-[10px] items-center gap-1 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 hover:bg-emerald-200 flex transition-colors">
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        Cambios
                                                    </button>
                                                    <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible z-50 transition-all">
                                                        <div className="font-bold mb-1 border-b border-slate-600 pb-1">Cambios de Turno:</div>
                                                        {row.shiftChanges.map((sc, i) => (
                                                            <div key={i} className="flex justify-between">
                                                                <span>{sc.date}:</span>
                                                                <span className="font-mono">{sc.shift}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 font-mono">{row.presencia.toFixed(2)} h</td>
                                    <td className="px-4 py-4">
                                        <JustifiedCell row={row} startDate={startDate} endDate={endDate} />
                                    </td>
                                    <td className="px-4 py-4 font-mono font-bold">{row.horasTotalesConJustificacion.toFixed(2)} h</td>
                                    <td className="px-4 py-4 font-mono text-orange-600">{row.horasExceso.toFixed(2)} h</td>
                                    <td className="px-4 py-4 font-mono text-purple-600">{row.festivas ? row.festivas.toFixed(2) : '0.00'} h</td>
                                    <td className="px-4 py-4">{`${row.numTAJ} / ${row.hTAJ.toFixed(2)}`}</td>
                                    {
                                        isLongRange && (
                                            <td className="px-4 py-4">
                                                {row.absentDays && row.absentDays.length > 0 ? (
                                                    <div className="relative group/absences">
                                                        <span className="cursor-help font-bold text-red-600 hover:text-red-800 bg-red-50 px-2 py-1 rounded border border-red-100">
                                                            {row.absentDays.length} días
                                                        </span>
                                                        <div className="absolute right-0 top-full mt-1 w-32 p-2 bg-white border border-red-100 text-slate-700 text-xs rounded shadow-lg opacity-0 invisible group-hover/absences:opacity-100 group-hover/absences:visible z-50">
                                                            <div className="font-bold border-b border-red-50 pb-1 mb-1 text-red-800">Ausencias:</div>
                                                            {row.absentDays.map(d => (
                                                                <div key={d}>{d}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                        )
                                    }
                                    <td className="px-4 py-4">
                                        {hasPendingIncidents ? (
                                            <button
                                                onClick={() => onReviewGaps(row)}
                                                className="text-xs font-semibold text-white bg-blue-600 rounded px-3 py-1.5 hover:bg-blue-700 shadow-sm flex items-center gap-1"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                Registrar
                                            </button>
                                        ) : justifiedCount > 0 ? (
                                            <div className="flex items-center space-x-2">
                                                <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                                                <span className="text-green-700 font-bold text-xs uppercase">INCIDENCIA REGISTRADA ({motiveIdString})</span>
                                            </div>
                                        ) : hasMissingOut ? (
                                            <div className="flex items-center space-x-2 text-amber-600 font-bold text-xs">
                                                <span>🛑 Falta Salida</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-xs">Correcto</span>
                                        )}
                                        <button
                                            onClick={() => onManualIncident(row)}
                                            className="ml-2 text-xs font-bold text-slate-500 hover:text-blue-600 bg-slate-100 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                                            title="Añadir incidencia manual"
                                        >
                                            + Incidencia
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {
                sortedAndFilteredData.length === 0 && (
                    <div className="text-center p-8">
                        <p className="text-slate-500">No se encontraron empleados que coincidan con la búsqueda.</p>
                    </div>
                )
            }
        </div >
    );
});

const HrDataTable: React.FC<HrDataTableProps> = ({
    data,
    rawData,
    onReviewGaps,
    onManualIncident,
    onExport,
    justifiedIncidentKeys,
    startDate,
    endDate,
    companyHolidays,
    isLongRange,
    flexibleEmployeeIds,
    highlightEmployeeIds
}) => {
    return <SummaryView data={data} rawData={rawData} onReviewGaps={onReviewGaps} onManualIncident={onManualIncident} onExport={onExport} justifiedIncidentKeys={justifiedIncidentKeys} startDate={startDate} endDate={endDate} companyHolidays={companyHolidays} isLongRange={isLongRange} flexibleEmployeeIds={flexibleEmployeeIds} highlightEmployeeIds={highlightEmployeeIds} />;
};

export default memo(HrDataTable);
