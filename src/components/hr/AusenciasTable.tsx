
import React, { useMemo } from 'react';
import { ProcessedDataRow } from '../../types';
import { formatEmployeeId } from '../../utils/formatters';

interface AusenciasTableProps {
    data: ProcessedDataRow[];
    onRegisterIncident: (employee: ProcessedDataRow) => void;
    startDate?: string;
    endDate?: string;
}

const AusenciasTable: React.FC<AusenciasTableProps> = ({
    data,
    onRegisterIncident,
    startDate,
    endDate
}) => {

    const handleExport = () => {
        if (data.length === 0) return;

        const headers = ['Colectivo', 'Operario', 'Nombre', 'Turno', 'Dias Ausente'];
        const csvContent = [
            headers.join(';'),
            ...data.map(row => {
                return [
                    row.colectivo || '',
                    row.operario,
                    `[${formatEmployeeId(row.operario)}] ${row.nombre}`,
                    row.turnoAsignado,
                    row.absentDays.join(', ')
                ].join(';');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ausencias_justificar_${startDate}_${endDate}.csv`;
        link.click();
    };

    // if (data.length === 0) return null; // Comentado para mostrar siempre la tabla o un mensaje


    return (
        <div className="bg-white/90 p-5 sm:p-6 rounded-2xl shadow-lg border border-red-100 mt-8 mb-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-red-700 flex items-center gap-2 uppercase tracking-wider">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        AUSENCIAS ({data.length})
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Empleados activos que no han registrado presencia en el periodo seleccionado.
                        <span className="block text-xs text-red-600 font-semibold mt-1">
                            ⚠️ NO incluye empleados con bajas médicas ni vacaciones grabadas.
                        </span>
                    </p>

                </div>
                <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-white text-red-700 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                    </svg>
                    Exportar Ausencias
                </button>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent border border-red-100 rounded-xl">
                <table className="w-full text-sm text-left text-slate-500">
                    <thead className="bg-gradient-to-r from-red-50 to-rose-50 text-red-800 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">ID</th>
                            <th className="px-4 py-3">Nombre</th>
                            <th className="px-4 py-3">Departamento</th>
                            <th className="px-4 py-3">Turno</th>
                            <th className="px-4 py-3">
                                Días Ausente
                                <div className="text-[10px] font-normal normal-case opacity-75 mt-0.5">(aaaa-mm-dd)</div>
                            </th>
                            <th className="px-4 py-3 rounded-tr-lg text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic bg-slate-50 border-b border-red-50">
                                    No hay ausencias totales registradas en este periodo.
                                </td>
                            </tr>
                        ) : (
                            data.map(row => (
                                <tr key={row.operario} className="bg-white border-b border-red-50 hover:bg-red-50/30 transition-colors">
                                    <td className="px-4 py-4 font-mono font-medium text-slate-900">{formatEmployeeId(row.operario)}</td>
                                    <td className="px-4 py-4 font-medium text-slate-800">{row.nombre}</td>
                                    <td className="px-4 py-4">{row.colectivo}</td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.turnoAsignado === 'M' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                            {row.turnoAsignado}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-red-600 font-mono text-xs max-w-xs break-words">
                                        {row.absentDays.length > 5
                                            ? `${row.absentDays.slice(0, 5).join(', ')} ... (+${row.absentDays.length - 5})`
                                            : row.absentDays.join(', ')
                                        }
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <button
                                            onClick={() => onRegisterIncident(row)}
                                            className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded shadow-sm transition-colors"
                                        >
                                            Registrar Incidencia
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AusenciasTable;
