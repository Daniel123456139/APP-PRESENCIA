import React from 'react';
import { ProcessedDataRow } from '../../types';
import { formatEmployeeId } from '../../utils/formatters';

interface ActiveBajasTableProps {
    data: ProcessedDataRow[];
    startDate?: string;
    endDate?: string;
}

const ActiveBajasTable: React.FC<ActiveBajasTableProps> = ({
    data,
    startDate,
    endDate
}) => {

    const handleExport = () => {
        if (data.length === 0) return;

        const headers = ['Colectivo', 'Operario', 'Nombre', 'Turno', 'Tipo Baja', 'Horas', 'Días'];
        const csvContent = [
            headers.join(';'),
            ...data.map(row => {
                const tipo = row.hITAT > 0 ? 'ITAT' : (row.hITEC > 0 ? 'ITEC' : 'N/A');
                const horas = row.hITAT > 0 ? row.hITAT : row.hITEC;
                // diasITAT / diasITEC might not be fully populated in all dataProcessor versions, 
                // but we can try to use them or fallback to date counting if needed. 
                // For now assuming dataProcessor populates hITAT/hITEC correctly.
                const dias = row.hITAT > 0 ? (row.hITAT / 8).toFixed(1) : (row.hITEC / 8).toFixed(1);

                return [
                    row.colectivo || '',
                    row.operario,
                    `[${formatEmployeeId(row.operario)}] ${row.nombre}`,
                    row.turnoAsignado,
                    tipo,
                    horas.toFixed(2).replace('.', ','),
                    dias.replace('.', ',')
                ].join(';');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bajas_activas_${startDate}_${endDate}.csv`;
        link.click();
    };



    return (
        <div className="bg-white/90 p-5 sm:p-6 rounded-2xl shadow-lg border border-yellow-200 mt-8 mb-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-yellow-700 flex items-center gap-2 uppercase tracking-wider">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        BAJAS ACTIVAS ({data.length})
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Empleados con bajas médicas registradas (ITAT / ITEC) en el periodo.
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-white text-yellow-700 rounded-lg border border-yellow-300 hover:bg-yellow-50 transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                    </svg>
                    Exportar Bajas
                </button>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent border border-yellow-200 rounded-xl">
                <table className="w-full text-sm text-left text-slate-500">
                    <thead className="bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-800 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">ID</th>
                            <th className="px-4 py-3">Nombre</th>
                            <th className="px-4 py-3">Departamento</th>
                            <th className="px-4 py-3">Turno</th>
                            <th className="px-4 py-3">Tipo Baja</th>
                            <th className="px-4 py-3 text-right">Horas Total</th>
                            <th className="px-4 py-3 text-right rounded-tr-lg">Días Aprox.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">
                                    No hay bajas activas en este periodo.
                                </td>
                            </tr>
                        )}
                        {data.map(row => {
                            const isITAT = row.hITAT > 0;
                            return (
                                <tr key={row.operario} className="bg-white border-b border-yellow-50 hover:bg-yellow-50/30 transition-colors">
                                    <td className="px-4 py-4 font-mono font-medium text-slate-900">{formatEmployeeId(row.operario)}</td>
                                    <td className="px-4 py-4 font-medium text-slate-800">{row.nombre}</td>
                                    <td className="px-4 py-4">{row.colectivo}</td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.turnoAsignado === 'M' ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}`}>
                                            {row.turnoAsignado}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${isITAT ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                                            {isITAT ? 'ITAT' : 'ITEC'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono font-bold text-slate-700">
                                        {(isITAT ? row.hITAT : row.hITEC).toFixed(2)} h
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-slate-600">
                                        {((isITAT ? row.hITAT : row.hITEC) / 8).toFixed(1)} d
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ActiveBajasTable;
