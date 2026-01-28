
import React from 'react';
import { ProcessedDataRow } from '../../types';

interface AbsenceTableProps {
    absentEmployees: ProcessedDataRow[];
    onExport: () => void;
    startDate: string;
    endDate: string;
}

const AbsenceTable: React.FC<AbsenceTableProps> = ({ absentEmployees, onExport, startDate, endDate }) => {
    if (absentEmployees.length === 0) return null;

    return (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-red-50">
                <div>
                    <h3 className="text-sm font-bold text-red-800 flex items-center">
                        <span className="mr-2">🚫</span> AUSENCIAS (sin entrada ni salida)
                    </h3>
                    <p className="text-xs text-red-600 mt-1">
                        Empleados sin fichajes de presencia en el periodo seleccionado.
                    </p>
                </div>
                <button
                    onClick={onExport}
                    className="flex items-center px-4 py-2 bg-white text-red-700 border border-red-200 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                    </svg>
                    Exportar Ausencias
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Colectivo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Operario</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Detalle</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {absentEmployees.map((row) => (
                            <tr key={row.operario} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.colectivo}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{row.operario}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{row.nombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    Sin presencia del {startDate} al {endDate}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AbsenceTable;
