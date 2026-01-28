
import React, { useState, useMemo, memo } from 'react';
import { ProcessedDataRow } from '../../types';

interface HrAbsenceTableProps {
    data: ProcessedDataRow[];
}

type SortDirection = 'ascending' | 'descending';
type SortableKeys = 'operario' | 'nombre' | 'incidentCount';

const HrAbsenceTable: React.FC<HrAbsenceTableProps> = ({ data }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>({ key: 'nombre', direction: 'ascending' });

    const requestSort = (key: SortableKeys) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const enhancedData = useMemo(() => data.map(employee => ({
        ...employee,
        incidentCount: (employee.unjustifiedGaps?.length || 0) + (employee.workdayDeviations?.length || 0) + (employee.missingClockOuts?.length || 0) + (employee.absentDays?.length || 0)
    })), [data]);


    const sortedData = useMemo(() => {
        let sortableItems = [...enhancedData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [enhancedData, sortConfig]);

    const getSortIndicator = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return <span className="text-slate-400">{sortConfig.direction === 'ascending' ? ' ▲' : ' ▼'}</span>;
    };

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xl font-semibold text-slate-700 mb-4">Panel de Incidencias Pendientes</h3>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors rounded-tl-lg" onClick={() => requestSort('operario')}>
                                Operario{getSortIndicator('operario')}
                            </th>
                            <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('nombre')}>
                                Nombre{getSortIndicator('nombre')}
                            </th>
                             <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('incidentCount')}>
                                Nº Incidencias{getSortIndicator('incidentCount')}
                            </th>
                            <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors rounded-tr-lg">
                                Detalle de Incidencias
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.length > 0 ? sortedData.map((row) => (
                            <tr key={row.operario} className="bg-white border-b border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-4">{row.operario}</td>
                                <td className="px-4 py-4 font-medium text-slate-900">{row.nombre}</td>
                                <td className="px-4 py-4 text-center">{row.incidentCount}</td>
                                <td className="px-4 py-4">
                                    <div className="flex flex-col items-start gap-1">
                                        {(row.missingClockOuts || []).map((mo, i) => (
                                            <div key={`mo-${i}`} className="text-xs p-1.5 bg-red-100 text-red-800 rounded border border-red-200 font-bold">
                                                <span>🛑 Sin Salida el {mo}</span>
                                            </div>
                                        ))}
                                        {(row.absentDays || []).map((ad, i) => (
                                            <div key={`ad-${i}`} className="text-xs p-1.5 bg-red-100 text-red-800 rounded border border-red-200 font-bold">
                                                <span>👻 Ausencia Total el {ad}</span>
                                            </div>
                                        ))}
                                        {row.workdayDeviations.map((dev, index) => {
                                             const deviation = dev.actualHours - 8;
                                             const sign = deviation > 0 ? '+' : '';
                                             return (
                                                <div key={`dev-${index}`} className="text-xs p-1.5 bg-rose-100 text-rose-800 rounded">
                                                    <span>Jornada de {dev.actualHours.toFixed(2)}h ({sign}{deviation.toFixed(2)}h) el {dev.date}</span>
                                                </div>
                                             )
                                        })}
                                        {row.unjustifiedGaps.map((gap, index) => (
                                            <div key={`gap-${index}`} className="text-xs p-1.5 bg-amber-100 text-amber-800 rounded">
                                                <span>Salto el {gap.date} de {gap.start.substring(0,5)} a {gap.end.substring(0,5)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="text-center py-8 text-slate-500">
                                    ¡Buen trabajo! No hay incidencias pendientes para los filtros seleccionados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default memo(HrAbsenceTable);