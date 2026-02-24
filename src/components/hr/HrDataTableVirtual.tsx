
import React, { memo, useState, useMemo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { ProcessedDataRow } from '../../types';
import { formatPeriodoAnalisis } from '../../utils/dateFormatter';
import { ScheduleCell, JustifiedCell, computeDisplayJustifiedHours } from './HrDataTable';
import { formatEmployeeId } from '../../utils/formatters';

interface HrDataTableVirtualProps {
    data: ProcessedDataRow[];
    onReviewGaps: (employee: ProcessedDataRow) => void;
    onManualIncident: (employee: ProcessedDataRow) => void;
    onExport: () => void;
    justifiedIncidentKeys: Map<string, number>;
    startDate?: string;
    endDate?: string;
    isLongRange?: boolean;
    flexibleEmployeeIds?: Set<number>;
}

// Helpers
const getGapKey = (empId: number, date: string, start: string) => `gap-${empId}-${date}-${start}`;
const getDevKey = (empId: number, date: string) => `dev-${empId}-${date}`;

// Sorting
type SortDirection = 'ascending' | 'descending';
type SortableKeys = keyof ProcessedDataRow | 'displaySchedule' | 'incidentCount';

const parseStartMinutes = (schedule: string): number | null => {
    if (!schedule || schedule === '-' || schedule === '??:??' || schedule.includes('AUSENTE')) return null;
    const match = schedule.match(/(\d{1,2}):(\d{2})/);
    if (match) {
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    return null;
};

const turnoRank = (turno: string): number => {
    if (turno === 'M') return 1;
    if (turno === 'TN' || turno === 'T') return 2;
    if (turno === 'N') return 3;
    return 4;
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

// Independent component for header to avoid re-creation issues
const TableHeader: React.FC<{
    colKey: SortableKeys;
    label: string;
    width: string;
    align?: 'left' | 'center' | 'right';
    sortConfig: { key: SortableKeys; direction: SortDirection } | null;
    onSort: (key: SortableKeys) => void;
}> = ({ colKey, label, width, align = 'left', sortConfig, onSort }) => {
    const isActive = sortConfig?.key === colKey;
    const direction = sortConfig?.direction || 'ascending';
    const textAlign = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

    return (
        <div
            className={`${width} px-4 cursor-pointer select-none group flex items-center ${textAlign} h-full hover:bg-slate-200 transition-colors`}
            onClick={() => onSort(colKey)}
        >
            <span className={`text-xs font-bold uppercase truncate ${isActive ? 'text-blue-700' : 'text-slate-500 group-hover:text-slate-700'}`}>
                {label}
            </span>
            <SortIcon active={isActive} direction={direction} />
        </div>
    );
};

interface RowProps {
    row: any; // Using any for augmented row properties
    style?: React.CSSProperties;
    onReview: (employee: ProcessedDataRow) => void;
    onManualIncident: (employee: ProcessedDataRow) => void;
    justifiedMetaByEmployee: Map<number, { count: number; motiveIds: Set<number> }>;
    isLongRange?: boolean;
    setViewingShiftChanges?: (data: { name: string, changes: any[] } | null) => void;
    flexibleEmployeeIds?: Set<number>;
    startDate?: string;
    endDate?: string;
}

const Row = memo(({ row, style, onReview, onManualIncident, justifiedMetaByEmployee, isLongRange, setViewingShiftChanges, flexibleEmployeeIds, startDate, endDate }: RowProps) => {
    const hasPendingIncidents = row.incidentCount > 0;
    const justifiedMeta = justifiedMetaByEmployee.get(row.operario);
    const justifiedCount = justifiedMeta?.count || 0;
    const uniqueMotiveIds = justifiedMeta ? [...justifiedMeta.motiveIds].sort((a, b) => a - b) : [];
    const motiveIdString = uniqueMotiveIds.map(id => String(id).padStart(2, '0')).join(', ');
    const hasAbsence = row.absentDays && row.absentDays.length > 0;
    const hasMissingOut = row.missingClockOuts && row.missingClockOuts.length > 0;

    const isFlexible = row.isFlexible || flexibleEmployeeIds?.has(row.operario);
    const rowClass = isFlexible
        ? "bg-emerald-50 hover:bg-emerald-100 border-l-4 border-l-emerald-400"
        : "hover:bg-slate-50/70 border-l-4 border-l-transparent";

    return (
        <div style={style} className={`flex items-center border-b border-slate-200 text-sm h-[50px] ${rowClass}`}>
            <div className="w-24 px-4 font-medium text-slate-900 truncate font-mono">{formatEmployeeId(row.operario)}</div>
            <div className="flex-1 px-4 truncate">{row.nombre}</div>
            <div className="w-40 px-4">
                {!isLongRange && <ScheduleCell row={row} />}
            </div>
            <div className="w-32 px-4 text-center">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${row.turnoAsignado === 'M' ? 'bg-amber-100 text-amber-800' : (row.turnoAsignado === 'TN' || row.turnoAsignado === 'T' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800')}`}>
                    {row.turnoAsignado}
                </span>
                {isLongRange && row.shiftChanges && row.shiftChanges.length > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setViewingShiftChanges({ name: row.nombre, changes: row.shiftChanges }); }}
                        className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded hover:bg-emerald-200 transition-colors font-bold"
                    >
                        Cambios 🏷️
                    </button>
                )}
            </div>
            <div className="w-32 px-4 text-right">{row.presencia.toFixed(2)} h</div>
            <div className="w-32 px-4 text-right">
                <JustifiedCell row={row} startDate={startDate} endDate={endDate} align="right" />
            </div>
            <div className="w-32 px-4 text-right font-bold font-mono">{row.horasTotalesConJustificacion.toFixed(2)} h</div>
            <div className="w-32 px-4 text-right text-orange-600 font-mono">{row.horasExceso.toFixed(2)} h</div>
            <div className="w-32 px-4 text-right text-purple-600 font-mono">{row.festivas ? row.festivas.toFixed(2) : '0.00'} h</div>
            <div className="w-32 px-4 text-right">{`${row.numTAJ} / ${row.hTAJ.toFixed(2)}`}</div>
            {isLongRange && (
                <div className="w-32 px-4 text-center">
                    {row.absentDays && row.absentDays.length > 0 ? (
                        <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded text-xs cursor-help" title={row.absentDays.join(', ')}>
                            {row.absentDays.length} días
                        </span>
                    ) : (
                        <span className="text-slate-300">-</span>
                    )}
                </div>
            )}
            <div className="w-64 px-4">
                {hasPendingIncidents ? (
                    <button
                        onClick={() => onReview(row)}
                        className="text-xs font-semibold text-white bg-blue-600 rounded px-2 py-1 hover:bg-blue-700"
                    >
                        Registrar
                    </button>
                ) : justifiedCount > 0 ? (
                    <span className="text-green-700 font-bold text-xs uppercase">INCIDENCIA REGISTRADA ({motiveIdString})</span>
                ) : hasMissingOut ? (
                    <span className="text-amber-600 font-bold text-xs">🛑 Falta Salida</span>
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
            </div>
        </div>
    );
});


const HrDataTableVirtual: React.FC<HrDataTableVirtualProps> = ({ data, onReviewGaps, onManualIncident, onExport, justifiedIncidentKeys, startDate, endDate, isLongRange, flexibleEmployeeIds }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>({ key: 'operario', direction: 'ascending' });
    const [viewingShiftChanges, setViewingShiftChanges] = useState<{ name: string, changes: any[] } | null>(null);

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

    const justifiedMetaByEmployee = useMemo(() => {
        const metaByEmployee = new Map<number, { count: number; motiveIds: Set<number> }>();

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

    // Calculate augmented data with incident counts for sorting
    const augmentedData = useMemo(() => {
        return data.map(row => {
            const pendingGaps = row.unjustifiedGaps.filter(g => !justifiedIncidentKeys.has(getGapKey(row.operario, g.date, g.start))).length;
            const pendingDevs = row.workdayDeviations.filter(d => !justifiedIncidentKeys.has(getDevKey(row.operario, d.date))).length;
            const missingOuts = row.missingClockOuts?.length || 0;
            const absences = row.absentDays?.length || 0;
            const totalPending = pendingGaps + pendingDevs + missingOuts + absences;
            const displayJustifiedHours = computeDisplayJustifiedHours(row);

            return {
                ...row,
                horasJustificadas: displayJustifiedHours,
                horasTotalesConJustificacion: Number((row.presencia + displayJustifiedHours + (row.hTAJ || 0)).toFixed(2)),
                incidentCount: totalPending,
                // Add explicit sortable properties if needed
            };
        });
    }, [data, justifiedIncidentKeys]);

    const sortedData = useMemo(() => {
        let items = [...augmentedData];

        if (sortConfig !== null) {
            items.sort((a, b) => {
                const { key, direction } = sortConfig;
                let valA: any = a[key as keyof typeof a];
                let valB: any = b[key as keyof typeof b];
                let isNumeric = false;

                if (key === 'horarioReal' || key === 'displaySchedule') {
                    valA = parseStartMinutes(a.horarioReal);
                    valB = parseStartMinutes(b.horarioReal);
                    isNumeric = true;
                } else if (key === 'turnoAsignado') {
                    valA = turnoRank(a.turnoAsignado);
                    valB = turnoRank(b.turnoAsignado);
                    isNumeric = true;
                } else if (['operario', 'presencia', 'totalHoras', 'horasJustificadas', 'horasTotalesConJustificacion', 'horasExceso', 'hTAJ', 'numTAJ', 'incidentCount', 'festivas'].includes(key as string)) {
                    isNumeric = true;
                }

                return sortValues(valA, valB, direction, isNumeric);
            });
        }
        return items;
    }, [augmentedData, sortConfig]);

    if (data.length === 0) {
        return <div className="p-8 text-center text-slate-500">No hay datos para mostrar.</div>;
    }

    type RowItemData = {
        rows: typeof sortedData;
        onReviewGaps: (employee: ProcessedDataRow) => void;
        onManualIncident: (employee: ProcessedDataRow) => void;
        justifiedMetaByEmployee: Map<number, { count: number; motiveIds: Set<number> }>;
        isLongRange?: boolean;
        setViewingShiftChanges: (data: { name: string, changes: any[] } | null) => void;
        flexibleEmployeeIds?: Set<number>;
        startDate?: string;
        endDate?: string;
    };

    const rowItemData: RowItemData = {
        rows: sortedData,
        onReviewGaps,
        onManualIncident,
        justifiedMetaByEmployee,
        isLongRange,
        setViewingShiftChanges,
        flexibleEmployeeIds,
        startDate,
        endDate
    };

    const VirtualRow = ({ index, style, data: itemData }: ListChildComponentProps<RowItemData>) => {
        const row = itemData.rows[index];
        return (
            <Row
                row={row}
                style={style}
                onReview={itemData.onReviewGaps}
                onManualIncident={itemData.onManualIncident}
                justifiedMetaByEmployee={itemData.justifiedMetaByEmployee}
                isLongRange={itemData.isLongRange}
                setViewingShiftChanges={itemData.setViewingShiftChanges}
                flexibleEmployeeIds={itemData.flexibleEmployeeIds}
                startDate={itemData.startDate}
                endDate={itemData.endDate}
            />
        );
    };

    return (
        <div className="bg-white/90 rounded-2xl shadow-lg border border-slate-200/70 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-r from-indigo-50 via-sky-50 to-slate-50 gap-3">
                <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-[11px]">⚡</span>
                        Resumen Empleados
                    </h3>
                    {startDate && endDate && (
                        <p className="text-xs text-slate-600 mt-1">
                            Periodo: {formatPeriodoAnalisis(startDate, endDate)}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onExport}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-700 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors text-xs font-semibold shadow-sm"
                        title="Exportar tabla a Excel"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                        </svg>
                        Exportar
                    </button>
                    <span className="text-xs text-slate-500">{data.length} filas renderizadas</span>
                </div>
            </div>

            <div className="flex items-center bg-slate-100/80 border-b border-slate-200 h-10">
                <TableHeader colKey="operario" label="ID" width="w-24" sortConfig={sortConfig} onSort={handleSort} />
                <TableHeader colKey="nombre" label="NOMBRE" width="flex-1" sortConfig={sortConfig} onSort={handleSort} />
                <TableHeader colKey="horarioReal" label="TIEMPO REAL" width="w-40" sortConfig={sortConfig} onSort={handleSort} />
                <TableHeader colKey="turnoAsignado" label="TURNO" width="w-32" align="center" sortConfig={sortConfig} onSort={handleSort} />
                <TableHeader colKey="presencia" label="PRESENCIA" width="w-32" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <TableHeader colKey="horasJustificadas" label="JUSTIFICADAS" width="w-32" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <TableHeader colKey="horasTotalesConJustificacion" label="TOTAL" width="w-32" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <TableHeader colKey="horasExceso" label="EXCESOS" width="w-32" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <TableHeader colKey="festivas" label="FESTIVAS" width="w-32" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <TableHeader colKey="hTAJ" label="TAJ" width="w-32" align="right" sortConfig={sortConfig} onSort={handleSort} />
                {isLongRange && (
                    <TableHeader colKey="absentDays" label="AUSENCIAS" width="w-32" align="center" sortConfig={sortConfig} onSort={handleSort} />
                )}
                <TableHeader colKey="incidentCount" label="ESTADO" width="w-64" sortConfig={sortConfig} onSort={handleSort} />
            </div>

            <div className="overflow-hidden" style={{ height: 600 }}>
                <List
                    height={600}
                    width={'100%'}
                    itemCount={sortedData.length}
                    itemSize={50}
                    itemData={rowItemData}
                    itemKey={(index, data) => String(data.rows[index]?.operario ?? index)}
                >
                    {VirtualRow}
                </List>
            </div>
            {/* Modal de Detalles de Cambios de Turno */}
            {viewingShiftChanges && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={() => setViewingShiftChanges(null)}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Cambios de Turno</h3>
                                <p className="text-sm text-slate-500">{viewingShiftChanges.name}</p>
                            </div>
                            <button onClick={() => setViewingShiftChanges(null)} className="text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {viewingShiftChanges.changes.map((c, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs font-semibold text-slate-600">{c.date}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.shift === 'TN' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                                        Turno: {c.shift}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setViewingShiftChanges(null)} className="w-full mt-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HrDataTableVirtual;
