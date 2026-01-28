import React, { useMemo, useState } from 'react';
import { ProcessedDataRow } from '../../types';

interface LateArrivalsModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: ProcessedDataRow[];
}

type SortDirection = 'ascending' | 'descending';
type SortableKeys = 'nombre' | 'numRetrasos' | 'tiempoRetrasos';

const LateArrivalsModal: React.FC<LateArrivalsModalProps> = ({ isOpen, onClose, data }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>({ key: 'numRetrasos', direction: 'descending' });

    const lateEmployees = useMemo(() => data.filter(employee => employee.numRetrasos > 0), [data]);

    const requestSort = (key: SortableKeys) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedLateEmployees = useMemo(() => {
        let sortableItems = [...lateEmployees];
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
    }, [lateEmployees, sortConfig]);

    const getSortIndicator = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return <span className="text-slate-400">{sortConfig.direction === 'ascending' ? ' ▲' : ' ▼'}</span>;
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl transform transition-all border border-slate-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Informe de Retrasos</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">&times;</button>
                </div>

                {sortedLateEmployees.length > 0 ? (
                    <div className="overflow-y-auto max-h-[60vh]">
                        {/* Mobile View */}
                        <div className="sm:hidden space-y-3">
                            {sortedLateEmployees.map(employee => (
                                <div key={employee.operario} className="bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                                    <p className="font-semibold text-slate-800">{employee.nombre}</p>
                                    <div className="flex justify-between mt-1 text-sm">
                                        <span className="text-slate-600">Nº de Retrasos:</span>
                                        <span className="font-medium text-slate-800">{employee.numRetrasos}</span>
                                    </div>
                                    <div className="flex justify-between mt-1 text-sm">
                                        <span className="text-slate-600">Tiempo Total (min):</span>
                                        <span className="font-medium text-slate-800">{(employee.tiempoRetrasos * 60).toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop View */}
                        <table className="w-full text-sm text-left text-slate-500 hidden sm:table">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-center rounded-tl-lg">ID</th>
                                    <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('nombre')}>
                                        Empleado{getSortIndicator('nombre')}
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('numRetrasos')}>
                                        Nº de Retrasos{getSortIndicator('numRetrasos')}
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors rounded-tr-lg" onClick={() => requestSort('tiempoRetrasos')}>
                                        Tiempo Total (minutos){getSortIndicator('tiempoRetrasos')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="">
                                {sortedLateEmployees.map(employee => (
                                    <tr key={employee.operario} className="bg-white border-b border-slate-200 hover:bg-slate-50">
                                        <td className="px-6 py-4 text-center text-slate-500 text-xs">
                                            {String(employee.operario).padStart(3, '0')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                            {employee.nombre}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {employee.numRetrasos}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {(employee.tiempoRetrasos * 60).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-slate-600">No se han encontrado empleados con retrasos para los filtros seleccionados.</p>
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-600 text-white font-semibold rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LateArrivalsModal;