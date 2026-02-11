
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getFirebaseDb } from '../../firebaseConfig';
import { LeaveRange, RawDataRow, Role, SickLeave } from '../../types';
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
import { SickLeaveSyncService } from '../../services/sickLeaveSyncService';
import { toISODateLocal, parseISOToLocalDate } from '../../utils/localDate';
import { getCalendarioOperario, Operario } from '../../services/erpApi';

interface SickLeaveManagerProps {
    activeSickLeaves: RawDataRow[];
    onRefresh: () => void;
}

interface ClosedSickLeaveRecord {
    id: string;
    employeeId: string | number;
    employeeName: string;
    type: 'ITEC' | 'ITAT';
    startDate: string;
    endDate: string;
    dischargeDate: string;
    motivo?: string;
}

interface SickLeaveEmployeeOption {
    id: number;
    name: string;
    role: Role;
}

type SickLeaveFormData = Omit<SickLeave, 'id' | 'operarioName'> & {
    id?: number;
    startTime?: string;
    endTime?: string;
    fechaRevision?: string;
};

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

    // Historico Firestore (BAJAS)
    const [historicalBajas, setHistoricalBajas] = useState<ClosedSickLeaveRecord[]>([]);

    // Validation
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

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
            // FIX: Allow scheduling discharge. Active if NO discharge date OR discharge date is in FUTURE
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

    // 2. HISTORICAL LEAVES: Leaves WITH discharge date (fallback local)
    const historicalLeaves = useMemo(() => {
        const allLeaves = groupRawDataToLeaves(activeSickLeaves);

        return allLeaves.filter(l => {
            if (!isSickLeave(l.motivoId)) return false;
            const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
            return !!meta?.dischargeDate; // History if HAS discharge date
        }).sort((a, b) => parseISOToLocalDate(b.startDate).getTime() - parseISOToLocalDate(a.startDate).getTime());
    }, [activeSickLeaves]);


    useEffect(() => {
        let unsubscribe = () => { };
        try {
            const db = getFirebaseDb();
            // FIX #4: Verify collection access and add debugging
            console.log("Inicializando listener de BAJAS históricos...");

            const q = query(collection(db, 'BAJAS'), orderBy('dischargeDate', 'desc'));

            unsubscribe = onSnapshot(q, (snapshot) => {
                console.log(`Recibidos ${snapshot.size} registros históricos de bajas.`);
                const rows: ClosedSickLeaveRecord[] = [];
                snapshot.forEach(docSnap => {
                    const data = docSnap.data() as any;
                    rows.push({
                        id: docSnap.id,
                        employeeId: data.employeeId,
                        employeeName: data.employeeName || '',
                        type: data.type,
                        startDate: data.startDate,
                        endDate: data.endDate || data.dischargeDate,
                        dischargeDate: data.dischargeDate,
                        motivo: data.motivo
                    });
                });
                setHistoricalBajas(rows);
            }, (err) => {
                console.error('Firestore Error (BAJAS):', err);
                if (err.code === 'permission-denied') {
                    showNotification('Error de permisos al leer histórico de bajas. Contacte al administrador.', 'error');
                } else {
                    showNotification('Error de conexión al leer histórico de bajas.', 'error');
                }
            });
        } catch (err) {
            console.error('Error inicializando Firestore BAJAS:', err);
        }

        return () => unsubscribe();
        return () => unsubscribe();
    }, []);

    // NEW: Auto-Archive Effect
    // Checks for leaves that have a discharge date <= today but are NOT yet in the historical Firestore collection (BAJAS)
    useEffect(() => {
        const checkAndArchive = async () => {
            const todayStr = toISODateLocal(new Date());
            const allLeaves = groupRawDataToLeaves(activeSickLeaves);

            // Find candidates: Sick leaves with dischargeDate <= today
            const candidates = allLeaves.filter(l => {
                if (!isSickLeave(l.motivoId)) return false;
                const meta = SickLeaveMetadataService.get(l.employeeId, l.startDate);
                return meta?.dischargeDate && meta.dischargeDate <= todayStr;
            });

            // For each candidate, check if it exists in 'historicalBajas' and if not, add it
            for (const leave of candidates) {
                const meta = SickLeaveMetadataService.get(leave.employeeId, leave.startDate);
                const dischargeDate = meta?.dischargeDate!;

                // Avoid duplicates: Check if we already have this record in history
                // We assume ID is generated or unique enough, or check by employee+startDate
                const alreadyArchived = historicalBajas.some(h =>
                    String(h.employeeId) === String(leave.employeeId) &&
                    h.startDate === leave.startDate
                );

                if (!alreadyArchived) {
                    console.log(`Auto-archiving expired sick leave for ${leave.employeeName} (Discharge: ${dischargeDate})`);
                    try {
                        // Import dynamically to avoid circular dependencies if any, or just use imported service
                        const { upsertClosedSickLeave } = await import('../../services/firestoreService');
                        await upsertClosedSickLeave({
                            employeeId: String(leave.employeeId),
                            employeeName: leave.employeeName,
                            type: leave.motivoId === 10 ? 'ITAT' : 'ITEC',
                            startDate: leave.startDate,
                            endDate: leave.endDate, // Logic might differ if we want to truncate
                            dischargeDate: dischargeDate,
                            motivo: leave.motivoDesc,
                            closedBy: 'SYSTEM_AUTO'
                        });
                        showNotification(`Baja de ${leave.employeeName} movida al histórico`, 'info');
                    } catch (err) {
                        console.error('Error auto-archiving leave:', err);
                    }
                }
            }
        };

        if (activeSickLeaves.length > 0 && historicalBajas.length > 0) {
            // We need historicalBajas loaded to check for duplicates efficiently, 
            // or we can rely on upsert idempotency (firestoreService usually handles ID generation, need to check).
            // If upsertClosedSickLeave uses a deterministic ID (e.g. empId_startDate), it's safe to call.
            checkAndArchive();
        }
        // Run this check periodically or when data changes
    }, [activeSickLeaves, historicalBajas]); // Dependency on historicalBajas ensures we don't try before loading history


    const historicalBajasAsLeaves = useMemo(() => {
        if (historicalBajas.length === 0) return [] as (LeaveRange & { dischargeDate?: string })[];
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
        const historySource = historicalBajasAsLeaves.length > 0 ? historicalBajasAsLeaves : historicalLeaves;
        const source = activeView === 'active' ? activeLeaves : historySource;
        if (!searchTerm) return source;
        const lower = searchTerm.toLowerCase();
        return source.filter(l => {
            const paddedId = l.employeeId.toString().padStart(3, '0');
            return l.employeeName.toLowerCase().includes(lower) || paddedId.includes(lower);
        });
    }, [activeView, activeLeaves, historicalLeaves, historicalBajasAsLeaves, searchTerm]);

    const employeeOptions = useMemo(() => {
        const uniqueMap = new Map<number, SickLeaveEmployeeOption>();
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

    // Handler: Synchronize Sick Leaves
    const handleSyncSickLeaves = async () => {
        if (isSyncing) return;

        setIsSyncing(true);
        setSyncProgress(null);

        try {
            const result = await SickLeaveSyncService.syncAllActiveSickLeaves(
                activeSickLeaves,
                (current, total) => setSyncProgress({ current, total })
            );

            const { processed, fichajesCreated, errors } = result;

            if (errors > 0) {
                showNotification(
                    `Sincronizadas ${processed} bajas con ${errors} errores. Fichajes creados: ${fichajesCreated}`,
                    'warning'
                );
            } else {
                showNotification(
                    `✅ Sincronización completada: ${processed} bajas procesadas, ${fichajesCreated} fichajes creados`,
                    'success'
                );
            }

            // Refrescar datos para mostrar los nuevos fichajes
            onRefresh();
        } catch (error) {
            console.error('Error durante sincronización:', error);
            showNotification(
                `Error al sincronizar: ${error instanceof Error ? error.message : 'Desconocido'}`,
                'error'
            );
        } finally {
            setIsSyncing(false);
            setSyncProgress(null);
        }
    };

    // Actions
    const handleSaveNewSickLeave = async (leaveData: SickLeaveFormData, operario?: Operario) => {
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
            }, 'System');
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
        SickLeaveMetadataService.update(leave.employeeId, leave.startDate, { nextRevisionDate: date }, 'System');
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
                        {activeView === 'active' && (
                            <button
                                onClick={handleSyncSickLeaves}
                                disabled={isSyncing || activeLeaves.length === 0}
                                className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center shadow-sm whitespace-nowrap transition-all ${isSyncing
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                title="Sincronizar fichajes de bajas activas"
                            >
                                {isSyncing ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sincronizando...
                                    </>
                                ) : (
                                    <>
                                        <span className="mr-2">🔄</span> Sincronizar Fichajes
                                    </>
                                )}
                            </button>
                        )}
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
                                    const dischargeDate = (leave as any).dischargeDate || meta?.dischargeDate || leave.endDate;
                                    const endDateObj = dischargeDate ? parseISOToLocalDate(dischargeDate) : today;
                                    const durationDays = Math.max(0, Math.floor((endDateObj.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
                                    const canManage = Array.isArray(leave.originalRows) && leave.originalRows.length > 0;

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
                                                {dischargeDate ? parseISOToLocalDate(dischargeDate).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-slate-600 font-medium">{durationDays} días</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {canManage ? (
                                                    <button
                                                        onClick={() => { setRangeToEdit(leave); setIsEditModalOpen(true); }}
                                                        className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors"
                                                    >
                                                        Gestionar
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Solo lectura</span>
                                                )}
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
