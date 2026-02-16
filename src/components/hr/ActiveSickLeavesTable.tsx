import React from 'react';
import { parseISOToLocalDate, toISODateLocal } from '../../utils/localDate';
import { SickLeaveMetadataService } from '../../services/sickLeaveMetadataService';
import { useNotification } from '../shared/NotificationContext';
import { useBajas } from '../../hooks/useBajas';
import { LeaveRange } from '../../types';
import SmartDateInput from '../shared/SmartDateInput';

interface ActiveSickLeavesTableProps {
    data: LeaveRange[];
    onExtend: (leave: LeaveRange) => void;
    onRefresh: () => void;
}

const ActiveSickLeavesTable: React.FC<ActiveSickLeavesTableProps> = ({ data, onExtend, onRefresh }) => {
    const { showNotification } = useNotification();
    const { archiveLeave } = useBajas();

    const handleUpdateDischargeDate = async (leave: LeaveRange, date: string) => {
        if (!date) return;

        const todayStr = toISODateLocal(new Date());
        const isFuture = date > todayStr;

        if (!window.confirm(isFuture
            ? `Programar fecha de alta para el ${date}? La baja permanecera activa hasta ese dia.`
            : 'Establecer fecha de alta? La baja pasara al historico inmediatamente.')) {
            return;
        }

        SickLeaveMetadataService.update(leave.employeeId, leave.startDate, { dischargeDate: date }, 'System');

        if (!isFuture) {
            try {
                await archiveLeave({
                    employeeId: String(leave.employeeId),
                    employeeName: leave.employeeName,
                    type: leave.motivoId === 10 ? 'ITAT' : 'ITEC',
                    startDate: leave.startDate,
                    endDate: leave.endDate,
                    dischargeDate: date,
                    motivo: leave.motivoDesc
                });
                showNotification('Baja movida al historico correctamente.', 'success');
            } catch (error: any) {
                showNotification(`Error: No se pudo guardar en historico. ${error.message}`, 'error');
            }
        } else {
            showNotification(`Alta programada para el ${date}.`, 'success');
        }

        onRefresh();
    };

    const handleExport = () => {
        if (data.length === 0) {
            showNotification('No hay bajas activas para exportar', 'warning');
            return;
        }

        const headers = ['ID Operario', 'Nombre', 'Tipo', 'Fecha Inicio', 'Fecha Fin', 'Duracion (dias)', 'Proxima Revision', 'Fecha Alta', 'Estado'];
        const csvRows = data.map(leave => {
            const meta = SickLeaveMetadataService.get(leave.employeeId, leave.startDate);
            const start = parseISOToLocalDate(leave.startDate);
            const today = new Date();
            const duration = Math.floor((today.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

            return [
                leave.employeeId,
                leave.employeeName,
                leave.motivoId === 10 ? 'ITAT' : 'ITEC',
                leave.startDate,
                leave.endDate,
                duration,
                meta?.nextRevisionDate || '',
                meta?.dischargeDate || '',
                'Activa'
            ].join(';');
        });

        const csvContent = [headers.join(';'), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.body.appendChild(document.createElement('a'));
        link.href = URL.createObjectURL(blob);
        link.download = `bajas_activas_${toISODateLocal(new Date())}.csv`;
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-red-50">
                <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="font-bold text-red-800">BAJAS ACTIVAS</h3>
                    <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{data.length}</span>
                </div>
                <button
                    onClick={handleExport}
                    className="text-xs font-semibold text-red-700 hover:text-red-900 bg-red-100 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                >
                    Exportar CSV
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-3">Operario</th>
                            <th className="px-6 py-3">Tipo</th>
                            <th className="px-6 py-3">Fechas</th>
                            <th className="px-6 py-3">Prox. Revision</th>
                            <th className="px-6 py-3">Fecha Alta</th>
                            <th className="px-6 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map(leave => {
                            const meta = SickLeaveMetadataService.get(leave.employeeId, leave.startDate);
                            return (
                                <tr key={leave.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium text-slate-900">
                                        [{leave.employeeId.toString().padStart(3, '0')}] {leave.employeeName}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${leave.motivoId === 10 ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {leave.motivoId === 10 ? 'ITAT' : 'ITEC'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="text-xs"><span className="font-semibold">Desde:</span> {parseISOToLocalDate(leave.startDate).toLocaleDateString()}</div>
                                        <div className="text-xs text-slate-400">Hasta: {parseISOToLocalDate(leave.endDate).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <SmartDateInput
                                            value={meta?.nextRevisionDate || ''}
                                            onChange={(nextValue) => {
                                                SickLeaveMetadataService.update(leave.employeeId, leave.startDate, { nextRevisionDate: nextValue }, 'System');
                                                onRefresh();
                                                showNotification('Revision actualizada', 'success');
                                            }}
                                            className="text-xs border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none w-32"
                                        />
                                    </td>
                                    <td className="px-6 py-3">
                                        <SmartDateInput
                                            value={meta?.dischargeDate || ''}
                                            onChange={(nextValue) => handleUpdateDischargeDate(leave, nextValue)}
                                            className="text-xs border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none w-32"
                                        />
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <button
                                            onClick={() => onExtend(leave)}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                        >
                                            Extender
                                        </button>
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

export default ActiveSickLeavesTable;
