import React, { useMemo, useState } from 'react';
import { RawDataRow } from '../../types';
import { parseISOToLocalDate, toISODateLocal } from '../../utils/localDate';
import { SickLeaveMetadataService } from '../../services/sickLeaveMetadataService';
import { useNotification } from '../shared/NotificationContext';
import { groupRawDataToLeaves } from '../../services/leaveService';

interface ActiveSickLeavesTableProps {
    data: RawDataRow[];
    onExtend: (leave: any) => void;
    onRefresh: () => void;
}

const ActiveSickLeavesTable: React.FC<ActiveSickLeavesTableProps> = ({ data, onExtend, onRefresh }) => {
    const { showNotification } = useNotification();
    const isSickLeave = (motivoId: number) => motivoId === 10 || motivoId === 11;

    const activeLeaves = useMemo(() => {
        const allLeaves = groupRawDataToLeaves(data);
        const filtered = allLeaves.filter(l => {
            if (!isSickLeave(l.motivoId)) return false;
            const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
            return !meta?.dischargeDate;
        });

        // DEDUPLICATION: One row per employee (the most recent one)
        const uniqueByEmployee = new Map<number, any>();
        filtered.forEach(leave => {
            const existing = uniqueByEmployee.get(leave.employeeId);
            if (!existing || parseISOToLocalDate(leave.startDate) > parseISOToLocalDate(existing.startDate)) {
                uniqueByEmployee.set(leave.employeeId, leave);
            }
        });

        return Array.from(uniqueByEmployee.values())
            .sort((a, b) => parseISOToLocalDate(a.startDate).getTime() - parseISOToLocalDate(b.startDate).getTime());
    }, [data]);

    const handleUpdateDischargeDate = (employeeId: number, startDate: string, date: string) => {
        if (!date) return;
        // Confirm before moving to history? Maybe too intrusive. 
        // Logic: active -> sets date -> re-render -> filter removes it -> appears in history
        if (window.confirm("¿Establecer fecha de alta? La baja pasará al histórico.")) {
            SickLeaveMetadataService.update(employeeId, startDate, { dischargeDate: date });
            onRefresh();
            showNotification("Fecha de alta establecida. Baja movida al histórico.", 'success');
        }
    };

    const handleExport = () => {
        if (activeLeaves.length === 0) {
            showNotification("No hay bajas activas para exportar", "warning");
            return;
        }

        const headers = ['ID Operario', 'Nombre', 'Tipo', 'Fecha Inicio', 'Fecha Fin', 'Duración (días)', 'Próxima Revisión', 'Fecha Alta', 'Estado']; // Added Fecha Alta header
        const rows = activeLeaves.map(leave => {
            const meta = SickLeaveMetadataService.get(leave.employeeId, leave.startDate);
            const start = parseISOToLocalDate(leave.startDate);
            const today = new Date();
            const duration = Math.floor((today.getTime() - start.getTime()) / (1000 * 3600 * 24));

            return [
                leave.employeeId,
                leave.employeeName,
                leave.motivoId === 10 ? 'ITAT' : 'ITEC',
                leave.startDate,
                leave.endDate,
                duration,
                meta?.nextRevisionDate || '',
                meta?.dischargeDate || '', // Export discharge date
                'Activa'
            ].join(';');
        });

        const csvContent = [headers.join(';'), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `bajas_activas_${toISODateLocal(new Date())}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Always render the table structure, even if empty


    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-red-50">
                <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="font-bold text-red-800">BAJAS ACTIVAS</h3>
                    <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{activeLeaves.length}</span>
                </div>
                <button
                    onClick={handleExport}
                    className="text-xs font-semibold text-red-700 hover:text-red-900 bg-red-100 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                >
                    Exportar Excel
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-3">Operario</th>
                            <th className="px-6 py-3">Tipo</th>
                            <th className="px-6 py-3">Fechas</th>
                            <th className="px-6 py-3">Próx. Revisión</th>
                            <th className="px-6 py-3 text-orange-600">FECHA ALTA</th>
                            <th className="px-6 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {activeLeaves.map(leave => {
                            const meta = SickLeaveMetadataService.get(leave.employeeId, leave.startDate);
                            const nextRevision = meta?.nextRevisionDate;
                            const today = new Date();
                            const revisionDateObj = nextRevision ? parseISOToLocalDate(nextRevision) : null;

                            let revisionClass = "border-transparent";
                            if (revisionDateObj) {
                                const diff = (revisionDateObj.getTime() - today.getTime()) / (1000 * 3600 * 24);
                                if (diff < 0) revisionClass = "text-red-600 font-bold border-red-200 bg-red-50";
                                else if (diff <= 3) revisionClass = "text-amber-600 font-bold border-amber-200 bg-amber-50";
                            }

                            return (
                                <tr key={leave.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium text-slate-900">
                                        [{leave.employeeId.toString().padStart(3, '0')}] {leave.employeeName}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${leave.motivoId === 10 ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {leave.motivoId === 10 ? 'ITAT' : 'ITEC'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="text-xs">
                                            <span className="font-semibold">Desde:</span> {parseISOToLocalDate(leave.startDate).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            Hasta: {parseISOToLocalDate(leave.endDate).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-slate-500 mb-0.5">Revisión:</span>
                                            <input
                                                type="date"
                                                value={nextRevision || ''}
                                                onChange={(e) => {
                                                    SickLeaveMetadataService.update(leave.employeeId, leave.startDate, { nextRevisionDate: e.target.value });
                                                    onRefresh();
                                                    showNotification("Revisión actualizada", 'success');
                                                }}
                                                className={`text-xs border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none w-32 ${revisionClass}`}
                                            />
                                        </div>
                                    </td>
                                    {/* FECHA ALTA INPUT */}
                                    <td className="px-6 py-3 bg-orange-50/50">
                                        <input
                                            type="date"
                                            className="text-xs border border-orange-200 rounded px-2 py-1 focus:ring-2 focus:ring-orange-500 outline-none w-32 bg-white"
                                            onChange={(e) => handleUpdateDischargeDate(leave.employeeId, leave.startDate, e.target.value)}
                                            title="Introducir fecha para dar de alta y mover al histórico"
                                        />
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <button
                                            onClick={() => onExtend(leave)}
                                            className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-medium transition-colors"
                                        >
                                            Ampliar
                                        </button>
                                        <div className='mt-1'>
                                            <span className="text-green-600 font-semibold text-xs flex items-center justify-center">
                                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                                                Activa
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {activeLeaves.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">
                    No hay bajas médicas activas actualmente.
                </div>
            )}
        </div>
    );
};

export default ActiveSickLeavesTable;
