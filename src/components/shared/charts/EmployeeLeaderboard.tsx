import React, { useState, useMemo } from 'react';
import { ProcessedDataRow } from '../../../types';

interface EmployeeLeaderboardProps {
    data: ProcessedDataRow[];
}

type SortableKeys = 'nombre' | 'totalHoras' | 'excesoJornada1' | 'numRetrasos' | 'totalAbsenceDays';
type SortDirection = 'ascending' | 'descending';

const EmployeeLeaderboard: React.FC<EmployeeLeaderboardProps> = ({ data }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>({ key: 'excesoJornada1', direction: 'descending' });

    const enhancedData = useMemo(() => {
        return data.map(row => ({
            ...row,
            totalAbsenceDays: row.hVacaciones + ((row.hMedico + row.hLDisp + row.hLeyFam) / 8),
        }));
    }, [data]);

    const requestSort = (key: SortableKeys) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

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
        return <span className="ml-1 text-slate-400">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>;
    };
    
    const maxOvertime = Math.max(...sortedData.map(d => d.excesoJornada1), 1);

    const TableHeader: React.FC<{ sortKey: SortableKeys; children: React.ReactNode, className?: string }> = ({ sortKey, children, className }) => (
        <th scope="col" className={`px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors ${className}`} onClick={() => requestSort(sortKey)}>
            <div className="flex items-center">
                {children}{getSortIndicator(sortKey)}
            </div>
        </th>
    );

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">Ranking de Rendimiento de Empleados</h3>
            {sortedData.length > 0 ? (
                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                            <tr>
                                <TableHeader sortKey="nombre">Empleado</TableHeader>
                                <TableHeader sortKey="totalHoras" className="text-center">H. Totales</TableHeader>
                                <TableHeader sortKey="excesoJornada1">H. Extra</TableHeader>
                                <TableHeader sortKey="numRetrasos" className="text-center">Retrasos</TableHeader>
                                <TableHeader sortKey="totalAbsenceDays" className="text-center">Días Aus. (aprox)</TableHeader>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {sortedData.map(row => (
                                <tr key={row.operario} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{row.nombre}</td>
                                    <td className="px-4 py-3 text-center">{row.totalHoras.toFixed(2)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <span className="w-12">{row.excesoJornada1.toFixed(2)}</span>
                                            <div className="w-full bg-slate-200 rounded-full h-2.5 ml-2">
                                                <div 
                                                    className="bg-green-500 h-2.5 rounded-full" 
                                                    style={{ width: `${(row.excesoJornada1 / maxOvertime) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">{row.numRetrasos}</td>
                                    <td className="px-4 py-3 text-center">{row.totalAbsenceDays.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                 <div className="flex-1 flex items-center justify-center bg-slate-50/70 rounded-md">
                    <p className="text-slate-500">No hay datos de empleados para mostrar.</p>
                </div>
            )}
        </div>
    );
};

export default EmployeeLeaderboard;
