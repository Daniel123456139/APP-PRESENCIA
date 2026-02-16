
import React, { useState, useMemo, useEffect } from 'react';
import { LeaveRange, RawDataRow, Role, SickLeave } from '../../types';
import SickLeaveModal from './SickLeaveModal';
import EditLeaveModal from './EditLeaveModal';
import ActiveSickLeavesTable from './ActiveSickLeavesTable';
import ValidationErrorsModal from '../shared/ValidationErrorsModal';
import { groupRawDataToLeaves } from '../../services/leaveService';
import { validateNewIncidents, ValidationIssue } from '../../services/validationService';
import { useNotification } from '../shared/NotificationContext';
import { SickLeaveMetadataService } from '../../services/sickLeaveMetadataService';
import { SickLeaveSyncService } from '../../services/sickLeaveSyncService';
import { toISODateLocal, parseISOToLocalDate } from '../../utils/localDate';
import { getCalendarioOperario, Operario } from '../../services/erpApi';
import { useHrLayout } from './HrLayout';
import { useFichajesMutations } from '../../hooks/useFichajes';
import { useBajas } from '../../hooks/useBajas';

interface SickLeaveManagerProps {
    activeSickLeaves: RawDataRow[];
    onRefresh: () => void;
}

type SickLeaveFormData = Omit<SickLeave, 'id' | 'operarioName'> & {
    id?: number;
    startTime?: string;
    endTime?: string;
    fechaRevision?: string;
};

const SickLeaveManager: React.FC<SickLeaveManagerProps> = ({ activeSickLeaves, onRefresh }) => {
    const { showNotification } = useNotification();
    const { erpData, employeeOptions } = useHrLayout();
    const { addIncidents, editLeaveRange, deleteLeaveRange } = useFichajesMutations();
    const { historicalBajas, archiveLeave, isLoading: isLoadingHistory } = useBajas();

    // UI State
    const [activeView, setActiveView] = useState<'active' | 'history'>('active');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [rangeToEdit, setRangeToEdit] = useState<LeaveRange | null>(null);
    const [createModalInitialValues, setCreateModalInitialValues] = useState<any>(undefined);

    // Validation
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

    // Helper: Is IT?
    const isSickLeave = (motivoId: number) => motivoId === 10 || motivoId === 11;

    // 1. ACTIVE LEAVES: Leaves WITHOUT discharge date
    const activeLeaves = useMemo(() => {
        const allLeaves = groupRawDataToLeaves(activeSickLeaves);

        const filtered = allLeaves.filter(l => {
            if (!isSickLeave(l.motivoId)) return false;
            const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
            if (!meta?.dischargeDate) return true;
            const todayStr = toISODateLocal(new Date());
            return meta.dischargeDate > todayStr;
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
    }, [activeSickLeaves]);

    // 2. HISTORICAL LEAVES
    const historicalLeavesFromERP = useMemo(() => {
        const allLeaves = groupRawDataToLeaves(activeSickLeaves);
        return allLeaves.filter(l => {
            if (!isSickLeave(l.motivoId)) return false;
            const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
            return !!meta?.dischargeDate;
        });
    }, [activeSickLeaves]);

    // AUTO-ARCHIVE LOGIC
    useEffect(() => {
        const checkAndArchive = async () => {
            const todayStr = toISODateLocal(new Date());
            const allLeaves = groupRawDataToLeaves(activeSickLeaves);

            const candidates = allLeaves.filter(l => {
                if (!isSickLeave(l.motivoId)) return false;
                const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
                return meta?.dischargeDate && meta.dischargeDate <= todayStr;
            });

            for (const leave of candidates) {
                const meta = SickLeaveMetadataService.get(leave.employeeId, leave.startDate);
                const alreadyArchived = historicalBajas.some(h =>
                    String(h.employeeId) === String(leave.employeeId) &&
                    h.startDate === leave.startDate
                );

                if (!alreadyArchived) {
                    try {
                        await archiveLeave({
                            employeeId: String(leave.employeeId),
                            employeeName: leave.employeeName,
                            type: leave.motivoId === 10 ? 'ITAT' : 'ITEC',
                            startDate: leave.startDate,
                            endDate: leave.endDate,
                            dischargeDate: meta?.dischargeDate!,
                            motivo: leave.motivoDesc,
                        });
                        showNotification(`Baja de ${leave.employeeName} movida al histórico`, 'info');
                    } catch (err) {
                        console.error('Error auto-archiving leave:', err);
                    }
                }
            }
        };

        if (activeSickLeaves.length > 0 && historicalBajas.length > 0) {
            checkAndArchive();
        }
    }, [activeSickLeaves, historicalBajas, archiveLeave]);

    // AUTO-SYNC LOGIC
    useEffect(() => {
        const runAutoSync = async () => {
            if (activeSickLeaves.length === 0) return;
            const todayStr = toISODateLocal(new Date());
            const lastSync = localStorage.getItem('sickLeaveAutoSyncDate');
            if (lastSync === todayStr) return;

            try {
                await SickLeaveSyncService.syncAllActiveSickLeaves(activeSickLeaves);
                localStorage.setItem('sickLeaveAutoSyncDate', todayStr);
            } catch (err) {
                console.error('Auto-sync bajas fallido:', err);
            }
        };
        runAutoSync();
    }, [activeSickLeaves]);

    const historicalBajasAsLeaves = useMemo(() => {
        return historicalBajas.map(b => ({
            id: b.id,
            employeeId: Number(b.employeeId),
            employeeName: b.employeeName || `Operario ${b.employeeId}`,
            department: '',
            motivoId: b.type === 'ITAT' ? 10 : 11,
            motivoDesc: b.motivo || b.type,
            startDate: b.startDate,
            endDate: b.endDate || b.dischargeDate,
            isFullDay: true,
            originalRows: [],
            dischargeDate: b.dischargeDate
        }));
    }, [historicalBajas]);

    const visibleLeaves = useMemo(() => {
        const historySource = historicalBajasAsLeaves.length > 0 ? historicalBajasAsLeaves : historicalLeavesFromERP;
        const source = activeView === 'active' ? activeLeaves : historySource;
        if (!searchTerm) return source;
        const lower = searchTerm.toLowerCase();
        return source.filter(l => {
            const paddedId = l.employeeId.toString().padStart(3, '0');
            return l.employeeName.toLowerCase().includes(lower) || paddedId.includes(lower);
        });
    }, [activeView, activeLeaves, historicalLeavesFromERP, historicalBajasAsLeaves, searchTerm]);

    const handleSyncSickLeaves = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncProgress(null);

        try {
            const result = await SickLeaveSyncService.syncAllActiveSickLeaves(
                activeSickLeaves,
                (current, total) => setSyncProgress({ current, total })
            );

            if (result.errors > 0) {
                showNotification(`Sincronizadas ${result.processed} bajas con ${result.errors} errores.`, 'warning');
            } else {
                showNotification(`✅ Sincronización completada: ${result.processed} bajas procesadas.`, 'success');
            }
            onRefresh();
        } catch (error: any) {
            showNotification(`Error al sincronizar: ${error.message}`, 'error');
        } finally {
            setIsSyncing(false);
            setSyncProgress(null);
        }
    };

    const handleSaveNewSickLeave = async (leaveData: SickLeaveFormData, operario?: Operario) => {
        let employeeId = operario?.IDOperario || Number(leaveData.employeeId);
        let employeeName = operario?.DescOperario || "";
        let department = operario?.DescDepartamento || "";

        if (!employeeId) {
            showNotification("No se pudo identificar al empleado.", 'error');
            return;
        }

        if (leaveData.fechaRevision) {
            SickLeaveMetadataService.update(employeeId, leaveData.startDate, {
                nextRevisionDate: leaveData.fechaRevision
            }, 'System');
        }

        const reasonId = leaveData.type === 'ITAT' ? 10 : 11;
        const reasonDesc = leaveData.type === 'ITAT' ? '10 - ITAT' : '11 - ITEC';
        const startISO = leaveData.startDate;
        const endISO = leaveData.endDate || toISODateLocal(new Date());

        try {
            showNotification("Consultando calendario del operario...", 'info');
            const calendar = await getCalendarioOperario(String(employeeId), startISO, endISO);
            const newRows: RawDataRow[] = [];

            calendar.forEach(calDay => {
                if (calDay.TipoDia !== "0") return;
                const turno = calDay.IDTipoTurno;
                let entryTime = '07:00:00';
                let exitTime = '15:00:00';

                if (turno === 'TN' || turno === 'T') { entryTime = '15:00:00'; exitTime = '23:00:00'; }
                else if (turno === 'N') { entryTime = '23:00:00'; exitTime = '07:00:00'; }

                const isFirstDay = calDay.Fecha === startISO;
                const partialStartTime = isFirstDay && leaveData.startTime ? leaveData.startTime : null;

                newRows.push({
                    IDControlPresencia: 0,
                    DescDepartamento: department,
                    IDOperario: employeeId,
                    DescOperario: employeeName,
                    Fecha: calDay.Fecha,
                    Hora: entryTime,
                    Entrada: 1,
                    MotivoAusencia: null,
                    DescMotivoAusencia: '',
                    Computable: 'Sí',
                    IDTipoTurno: turno,
                    Inicio: '',
                    Fin: '',
                    TipoDiaEmpresa: 0,
                    TurnoTexto: calDay.DescTurno || 'Normal'
                });

                let actualExitTime = exitTime;
                if (partialStartTime) {
                    actualExitTime = partialStartTime.length === 5 ? partialStartTime + ':00' : partialStartTime;
                }

                newRows.push({
                    IDControlPresencia: 0,
                    DescDepartamento: department,
                    IDOperario: employeeId,
                    DescOperario: employeeName,
                    Fecha: calDay.Fecha,
                    Hora: actualExitTime,
                    Entrada: 0,
                    MotivoAusencia: reasonId,
                    DescMotivoAusencia: reasonDesc,
                    Computable: 'No',
                    IDTipoTurno: turno,
                    Inicio: '',
                    Fin: '',
                    TipoDiaEmpresa: 0,
                    TurnoTexto: calDay.DescTurno || 'Baja'
                });
            });

            if (newRows.length === 0) {
                showNotification("No se generaron registros para días laborables.", 'warning');
                return;
            }

            const issues = validateNewIncidents(erpData, newRows);
            const saveAction = async () => {
                await addIncidents({ newRows, userName: "HR Admin" });
                setIsCreateModalOpen(false);
                setIsValidationModalOpen(false);
                showNotification("Baja registrada exitosamente", 'success');
                onRefresh();
            };

            if (issues.length > 0) {
                setValidationIssues(issues);
                setPendingAction(() => saveAction);
                setIsValidationModalOpen(true);
            } else {
                await saveAction();
            }
        } catch (error: any) {
            console.error("Error saving sick leave:", error);
            showNotification(error.message, 'error');
        }
    };

    // Metrics
    const itatCount = activeLeaves.filter(l => l.motivoId === 10).length;
    const itecCount = activeLeaves.filter(l => l.motivoId === 11).length;
    const pendingRevisions = activeLeaves.filter(l => {
        const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
        if (!meta?.nextRevisionDate) return false;
        const revDate = parseISOToLocalDate(meta.nextRevisionDate);
        const diffDays = Math.ceil((revDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        return diffDays <= 3;
    }).length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
                    <div className="p-4 rounded-full bg-red-100 text-red-600 mr-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Bajas Activas Totales</p>
                        <p className="text-3xl font-bold text-slate-800">{activeLeaves.length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
                    <div className="p-4 rounded-full bg-blue-100 text-blue-600 mr-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Desglose por Tipo</p>
                        <p className="text-sm font-semibold text-slate-800"><span className="text-red-600">{itatCount} ITAT</span> / <span className="text-blue-600">{itecCount} ITEC</span></p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
                    <div className={`p-4 rounded-full mr-4 ${pendingRevisions > 0 ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Revisiones Pendientes</p>
                        <p className={`text-3xl font-bold ${pendingRevisions > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{pendingRevisions}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex space-x-2">
                        <button onClick={() => setActiveView('active')} className={`px-4 py-2 text-sm font-bold rounded-lg ${activeView === 'active' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Bajas Activas</button>
                        <button onClick={() => setActiveView('history')} className={`px-4 py-2 text-sm font-bold rounded-lg ${activeView === 'history' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Histórico</button>
                    </div>
                    <div className="flex w-full sm:w-auto gap-2">
                        {activeView === 'history' && (
                            <input type="text" placeholder="Buscar..." className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        )}
                        <button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold text-sm flex items-center shadow-sm">+ Registrar Baja</button>
                        {activeView === 'active' && (
                            <button onClick={handleSyncSickLeaves} disabled={isSyncing} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center shadow-sm ${isSyncing ? 'bg-gray-300' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                                {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {activeView === 'active' ? (
                <ActiveSickLeavesTable data={activeLeaves} onRefresh={onRefresh} onExtend={(leave) => {
                    const nextDay = new Date(parseISOToLocalDate(leave.endDate));
                    nextDay.setDate(nextDay.getDate() + 1);
                    setCreateModalInitialValues({ employeeId: leave.employeeId, employeeName: leave.employeeName, startDate: toISODateLocal(nextDay), type: leave.motivoId === 10 ? 'ITAT' : 'ITEC' });
                    setIsCreateModalOpen(true);
                }} />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b">
                                <tr>
                                    <th className="px-6 py-4">Empleado</th>
                                    <th className="px-6 py-4">Tipo</th>
                                    <th className="px-6 py-4">Desde</th>
                                    <th className="px-6 py-4">Alta</th>
                                    <th className="px-6 py-4">Días</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoadingHistory ? (
                                    <tr><td colSpan={6} className="text-center p-10">Cargando histórico...</td></tr>
                                ) : (visibleLeaves.length > 0 ? visibleLeaves.map((leave) => {
                                    const dischargeDate = (leave as any).dischargeDate || leave.endDate;
                                    const start = parseISOToLocalDate(leave.startDate);
                                    const end = dischargeDate ? parseISOToLocalDate(dischargeDate) : new Date();
                                    const duration = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
                                    return (
                                        <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-semibold">{leave.employeeName}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${leave.motivoId === 10 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{leave.motivoId === 10 ? 'ITAT' : 'ITEC'}</span>
                                            </td>
                                            <td className="px-6 py-4 font-mono">{start.toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-mono text-orange-700 font-bold">{dischargeDate ? parseISOToLocalDate(dischargeDate).toLocaleDateString() : '-'}</td>
                                            <td className="px-6 py-4">{duration} d</td>
                                            <td className="px-6 py-4 text-right">
                                                {leave.originalRows.length > 0 ? (
                                                    <button onClick={() => { setRangeToEdit(leave); setIsEditModalOpen(true); }} className="text-blue-600 font-bold hover:underline">Gestionar</button>
                                                ) : <span className="text-slate-400">Lectura</span>}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={6} className="text-center p-10 text-slate-400">No hay registros históricos.</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <SickLeaveModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setCreateModalInitialValues(undefined); }} onSave={handleSaveNewSickLeave} leaveToEdit={null} employeeOptions={employeeOptions.map(e => ({ IDOperario: e.id, DescOperario: e.name, DescDepartamento: String(e.role) })) as any} initialValues={createModalInitialValues} />
            <EditLeaveModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} range={rangeToEdit} onSave={async (oldR, newR) => { await editLeaveRange(oldR, newR, "RRHH"); onRefresh(); showNotification("Baja actualizada", 'success'); setIsEditModalOpen(false); }} onDelete={async (range) => { await deleteLeaveRange({ range, userName: "RRHH" }); onRefresh(); showNotification("Baja eliminada", 'success'); setIsEditModalOpen(false); }} />
            <ValidationErrorsModal isOpen={isValidationModalOpen} onClose={() => setIsValidationModalOpen(false)} issues={validationIssues} onContinue={() => { if (pendingAction) pendingAction(); }} />
        </div>
    );
};

export default SickLeaveManager;
