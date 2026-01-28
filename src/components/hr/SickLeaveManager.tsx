
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { LeaveRange, RawDataRow, User, Role } from '../../types';
import SickLeaveModal from './SickLeaveModal';
import EditLeaveModal from './EditLeaveModal';
import ActiveSickLeavesTable from './ActiveSickLeavesTable';
import ValidationErrorsModal from '../shared/ValidationErrorsModal';
import { groupRawDataToLeaves, generateRowsFromRange } from '../../services/leaveService';
import { validateNewIncidents, ValidationIssue } from '../../services/validationService';
import { useNotification } from '../shared/NotificationContext';
import { AuthContext } from '../../App';
import { useErpDataState, useErpDataActions } from '../../store/erpDataStore';
import { SickLeaveMetadataService } from '../../services/sickLeaveMetadataService';
import { toISODateLocal, parseISOToLocalDate } from '../../utils/localDate';
import { getCalendarioOperario } from '../../services/erpApi';

interface SickLeaveManagerProps {
    activeSickLeaves: RawDataRow[];
    onRefresh: () => void;
}

const SickLeaveManager: React.FC<SickLeaveManagerProps> = ({ activeSickLeaves, onRefresh }) => {
    const { showNotification } = useNotification();
    const auth = useContext(AuthContext);

    // Global State
    const { erpData } = useErpDataState();
    const { addIncidents, editLeaveRange, deleteLeaveRange } = useErpDataActions();

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

    // Helper: Is IT?
    const isSickLeave = (motivoId: number) => motivoId === 10 || motivoId === 11;

    // 1. ACTIVE LEAVES: Leaves WITHOUT discharge date (User Requirement: "sin fecha alta -> activo")
    // NOTE: This might include old leaves if they don't have metadata. 
    // We assume the user wants to process them or they are from the current era.
    const activeLeaves = useMemo(() => {
        // We use activeSickLeaves prop which is always "today" relative data
        const allLeaves = groupRawDataToLeaves(activeSickLeaves);

        const filtered = allLeaves.filter(l => {
            if (!isSickLeave(l.motivoId)) return false;
            const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
            return !meta?.dischargeDate; // Active if NO discharge date
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

    // 2. HISTORICAL LEAVES: Leaves WITH discharge date
    const historicalLeaves = useMemo(() => {
        const allLeaves = groupRawDataToLeaves(activeSickLeaves);

        return allLeaves.filter(l => {
            if (!isSickLeave(l.motivoId)) return false;
            const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
            return !!meta?.dischargeDate; // History if HAS discharge date
        }).sort((a, b) => parseISOToLocalDate(b.startDate).getTime() - parseISOToLocalDate(a.startDate).getTime());
    }, [activeSickLeaves]);

    const visibleLeaves = useMemo(() => {
        const source = activeView === 'active' ? activeLeaves : historicalLeaves;
        if (!searchTerm) return source;
        const lower = searchTerm.toLowerCase();
        return source.filter(l => {
            const paddedId = l.employeeId.toString().padStart(3, '0');
            return l.employeeName.toLowerCase().includes(lower) || paddedId.includes(lower);
        });
    }, [activeView, activeLeaves, historicalLeaves, searchTerm]);

    const employeeOptions = useMemo(() => {
        const uniqueMap = new Map<number, User>();
        erpData.forEach(row => {
            if (!uniqueMap.has(row.IDOperario)) {
                uniqueMap.set(row.IDOperario, {
                    id: row.IDOperario,
                    name: row.DescOperario,
                    role: row.DescDepartamento === 'Dirección' ? Role.Management : Role.Employee,
                });
            }
        });
        return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [erpData]);

    // Actions
    const handleSaveNewSickLeave = async (leaveData: Omit<SickLeave, 'id' | 'operarioName'> & { id?: number }, operario?: Operario) => {
        // If we have specific operario object passed, use it. Otherwise try to find in options (fallback, mainly for validation if old code used)

        let employee = null;
        if (operario && operario.IDOperario) {
            employee = {
                id: operario.IDOperario,
                name: operario.DescOperario,
                // Map DescDepartamento or make up role if missing. In our case Operario has DescDepartamento.
                role: operario.DescDepartamento === 'Dirección' ? Role.Management : Role.Employee
            };
        } else {
            employee = employeeOptions.find(u => u.id === leaveData.employeeId);
        }

        if (!employee) {
            showNotification("No se pudo identificar al empleado.", 'error');
            return;
        }

        // Save Metadata First (Revision)
        if (leaveData.fechaRevision) {
            SickLeaveMetadataService.update(employee.id, leaveData.startDate, {
                nextRevisionDate: leaveData.fechaRevision
            });
        }

        const reasonId = leaveData.type === 'ITAT' ? 10 : 11;
        const reasonDesc = leaveData.type === 'ITAT' ? '10 - ITAT' : '11 - ITEC';

        const startISO = leaveData.startDate;
        const endISO = leaveData.endDate || toISODateLocal(new Date());

        const newRows: RawDataRow[] = [];

        try {
            showNotification("Consultando calendario del operario...", 'info');
            const calendar = await getCalendarioOperario(String(employee.id), startISO, endISO);

            calendar.forEach(calDay => {
                // Registrar solo en días laborables (Tipo 0)
                if (calDay.TipoDia !== "0") return;

                const turno = calDay.IDTipoTurno; // 'M', 'TN', etc.
                let entryTime = '07:00:00';
                let exitTime = '15:00:00';

                if (turno === 'TN' || turno === 'T') {
                    entryTime = '15:00:00';
                    exitTime = '23:00:00';
                } else if (turno === 'N') {
                    entryTime = '23:00:00';
                    exitTime = '07:00:00'; // Siguiente día? Usualmente se registra en el día que empieza.
                }

                const isFirstDay = calDay.Fecha === startISO;
                const partialStartTime = isFirstDay && leaveData.startTime ? leaveData.startTime : null;

                // 1. Fichaje Entrada (Normal)
                // Si es parcial, entra normal a su hora. Si es completo, entra normal a su hora (pero sale con incidencia).
                // La diferencia es la HORA de salida y si cuenta como trabajado ese trozo.

                newRows.push({
                    IDControlPresencia: 0,
                    DescDepartamento: String(employee.role),
                    IDOperario: employee.id,
                    DescOperario: employee.name,
                    Fecha: calDay.Fecha,
                    Hora: entryTime,
                    Entrada: 1,
                    MotivoAusencia: null, // Entrada Normal
                    DescMotivoAusencia: '',
                    Computable: 'Sí',
                    IDTipoTurno: turno,
                    Inicio: '',
                    Fin: '',
                    TipoDiaEmpresa: 0,
                    TurnoTexto: calDay.DescTurno || 'Normal'
                });

                // 2. Fichaje Salida/Incidencia (Baja)
                // Si es parcial: Sale a la hora indicada (partialStartTime) con motivo Incidencia.
                // Si es completo: Sale a la hora de fin de turno (exitTime) con motivo Incidencia.

                let actualExitTime = exitTime;
                if (partialStartTime) {
                    actualExitTime = partialStartTime.length === 5 ? partialStartTime + ':00' : partialStartTime;
                }

                newRows.push({
                    IDControlPresencia: 0,
                    DescDepartamento: String(employee.role),
                    IDOperario: employee.id,
                    DescOperario: employee.name,
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
                showNotification("No se generaron registros (puede que el rango no contenga días laborables).", 'warning');
                return;
            }

        } catch (error: any) {
            console.error("Error generating leave rows:", error);
            showNotification("Error al obtener el calendario: " + error.message, 'error');
            return;
        }

        const issues = validateNewIncidents(erpData, newRows);
        if (issues.length > 0) {
            setValidationIssues(issues);
            setPendingAction(() => async () => {
                await addIncidents(newRows, auth?.user?.name || "HR Admin");
                setIsCreateModalOpen(false);
                setIsValidationModalOpen(false);
                showNotification("Baja registrada exitosamente", 'success');
            });
            setIsValidationModalOpen(true);
        } else {
            const result = await addIncidents(newRows, auth?.user?.name || "HR Admin");
            onRefresh(); // Refresh independent active list
            setIsCreateModalOpen(false);
            if (result.queuedCount > 0) {
                showNotification("Baja guardada EN COLA (Offline).", 'warning');
            } else {
                showNotification("Baja registrada exitosamente", 'success');
            }
        }
    };

    const handleUpdateRevisionDate = (leave: LeaveRange, date: string) => {
        SickLeaveMetadataService.update(leave.employeeId, leave.startDate, { nextRevisionDate: date });
        onRefresh(); // Refresh independent active list
        showNotification("Fecha de revisión actualizada", 'success');
    };

    // Dashboard Metrics
    const itatCount = activeLeaves.filter(l => l.motivoId === 10).length;
    const itecCount = activeLeaves.filter(l => l.motivoId === 11).length;
    const pendingRevisions = activeLeaves.filter(l => {
        const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
        if (!meta?.nextRevisionDate) return false;
        const revDate = parseISOToLocalDate(meta.nextRevisionDate);
        const today = new Date();
        const diffDays = Math.ceil((revDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        return diffDays <= 3; // Alerta si es en 3 días o menos (o vencida)
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
                        <p className="text-sm font-semibold text-slate-800">
                            <span className="text-red-600">{itatCount} ITAT</span> (Accidente)
                        </p>
                        <p className="text-sm font-semibold text-slate-800">
                            <span className="text-blue-600">{itecCount} ITEC</span> (Enfermedad)
                        </p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
                    <div className={`p-4 rounded-full mr-4 ${pendingRevisions > 0 ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Revisiones Pendientes</p>
                        <p className={`text-3xl font-bold ${pendingRevisions > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{pendingRevisions}</p>
                        {pendingRevisions > 0 && <p className="text-xs text-amber-600 font-semibold">Atención requerida</p>}
                    </div>
                </div>
            </div>

            {/* TABS DE VISTA */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setActiveView('active')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${activeView === 'active'
                                ? 'bg-white text-blue-700 shadow-md transform scale-105'
                                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                }`}
                        >
                            Bajas Activas
                        </button>
                        <button
                            onClick={() => setActiveView('history')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${activeView === 'history'
                                ? 'bg-white text-blue-700 shadow-md transform scale-105'
                                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                }`}
                        >
                            Histórico
                        </button>
                    </div>

                    {/* Buscador y Botón de Añadir (Solo visible en Histórico o si queremos añadir en ambos, pero el buscador filtra visibleLeaves) */}
                    <div className="flex w-full sm:w-auto gap-2">
                        {activeView === 'history' && (
                            <input
                                type="text"
                                placeholder="Buscar en histórico..."
                                className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        )}
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold text-sm flex items-center shadow-sm whitespace-nowrap"
                        >
                            <span className="mr-1 text-lg">+</span> Registrar Baja
                        </button>
                    </div>
                </div>
            </div>

            {/* VISTA: BAJAS ACTIVAS */}
            {activeView === 'active' && (
                <ActiveSickLeavesTable
                    data={activeSickLeaves}
                    onRefresh={onRefresh}
                    onExtend={(leave) => {
                        // LOGIC FOR EXTENSION: Open Create Modal (NOT Edit) with pre-filled next day
                        // calculate next day from end date
                        const endDate = parseISOToLocalDate(leave.endDate);
                        const nextDay = new Date(endDate);
                        nextDay.setDate(endDate.getDate() + 1);

                        setCreateModalInitialValues({
                            employeeId: leave.employeeId,
                            employeeName: leave.employeeName,
                            startDate: toISODateLocal(nextDay),
                            type: leave.motivoId === 10 ? 'ITAT' : 'ITEC',
                            motivo: leave.motivoDesc
                        });
                        setIsCreateModalOpen(true);
                    }}
                />
            )}

            {/* VISTA: HISTÓRICO */}
            {activeView === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="bg-white text-xs text-slate-500 uppercase font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Empleado</th>
                                    <th className="px-6 py-4">Tipo</th>
                                    <th className="px-6 py-4">Desde</th>
                                    <th className="px-6 py-4">Fecha Alta</th> {/* Changed from Duracion to Fecha Alta or added? User wanted Fecha Alta column to INPUT in active, and implied it shows in history. */}
                                    <th className="px-6 py-4">Duración</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visibleLeaves.map((leave) => {
                                    const meta = SickLeaveMetadataService.get(leave.employeeId, leave.startDate);
                                    const nextRevision = meta?.nextRevisionDate;
                                    const today = new Date();
                                    const start = parseISOToLocalDate(leave.startDate);
                                    const durationDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 3600 * 24));

                                    let revisionStatusColor = "text-slate-500";
                                    if (nextRevision) {
                                        const revDate = parseISOToLocalDate(nextRevision);
                                        if (revDate < today) revisionStatusColor = "text-red-600 font-bold";
                                        else if ((revDate.getTime() - today.getTime()) / (1000 * 3600 * 24) < 3) revisionStatusColor = "text-amber-600 font-bold";
                                        else revisionStatusColor = "text-green-600";
                                    }

                                    return (
                                        <tr key={leave.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-900">{leave.employeeName}</div>
                                                <div className="text-xs text-slate-400">ID: {leave.employeeId.toString().padStart(3, '0')}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${leave.motivoId === 10 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {leave.motivoId === 10 ? 'ITAT' : 'ITEC'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-slate-700">
                                                {parseISOToLocalDate(leave.startDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-orange-700 font-bold">
                                                {/* DATA DE ALTA */}
                                                {meta?.dischargeDate ? parseISOToLocalDate(meta.dischargeDate).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-slate-600 font-medium">{durationDays} días</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => { setRangeToEdit(leave); setIsEditModalOpen(true); }}
                                                    className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors"
                                                >
                                                    Gestionar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {visibleLeaves.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center p-12 text-slate-400">
                                            No hay bajas en el histórico que mostrar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <SickLeaveModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setCreateModalInitialValues(undefined);
                }}
                onSave={handleSaveNewSickLeave}
                leaveToEdit={null}
                initialValues={createModalInitialValues}
                employeeOptions={employeeOptions}
            />

            <EditLeaveModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                range={rangeToEdit}
                onSave={async (oldR, newR) => {
                    await editLeaveRange(oldR, newR, "RRHH");
                    onRefresh();
                    showNotification("Baja actualizada", 'success');
                    setIsEditModalOpen(false);
                }}
                onDelete={async (range) => {
                    await deleteLeaveRange(range);
                    onRefresh();
                    showNotification("Baja eliminada", 'success');
                    setIsEditModalOpen(false);
                }}
            />

            <ValidationErrorsModal
                isOpen={isValidationModalOpen}
                onClose={() => setIsValidationModalOpen(false)}
                issues={validationIssues}
                onContinue={() => {
                    if (pendingAction) pendingAction();
                }}
            />
        </div>
    );
};

export default SickLeaveManager;
