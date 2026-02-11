import React, { useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import { RawDataRow, ProcessedDataRow, Role, IncidentLogEntry, UnjustifiedGap, WorkdayDeviation } from '../../types';
import { useErpDataActions } from '../../store/erpDataStore';
import { useNotification } from '../shared/NotificationContext';
import RecordIncidentModal from './RecordIncidentModal';
import ManualIncidentModal, { ManualIncidentData } from './ManualIncidentModal';
import ValidationErrorsModal from '../shared/ValidationErrorsModal';
import MultipleAdjustmentModal from './MultipleAdjustmentModal';
import LateArrivalsModal from './LateArrivalsModal';
import FreeHoursFilterModal from './FreeHoursFilterModal';
import FutureIncidentsModal from './FutureIncidentsModal';
import { getMotivosAusencias } from '../../services/erpApi';
import { validateNewIncidents, ValidationIssue } from '../../services/validationService';
import { generateGapStrategy, generateFullDayStrategy, generateWorkdayStrategy } from '../../services/incidentStrategies';
import { toISODateLocal, parseISOToLocalDate } from '../../utils/localDate';
import { logIncident as logFirestoreIncident, logSyntheticPunch } from '../../services/firestoreService';

export interface EmployeeOption {
    id: number;
    name: string;
    role: Role;
    department: string;
    flexible?: boolean;
}

export interface IncidentManagerHandle {
    handleIncidentClick: (employee: ProcessedDataRow) => void;
    handleOpenManualIncident: (employee: ProcessedDataRow) => void;
    handleOpenLateArrivals: (data: ProcessedDataRow[]) => void;
    handleOpenAdjustmentModal: (data: RawDataRow[], shifts: Map<number, string>) => void;
    handleOpenFreeHoursModal: (employees: EmployeeOption[], departments: string[]) => void;
    handleOpenFutureIncidentsModal: (employees: EmployeeOption[]) => void;
    justifiedIncidentKeys: Map<string, number>;
}

interface IncidentManagerProps {
    erpData: RawDataRow[];
    employeeOptions: EmployeeOption[];
    onRefreshNeeded: () => void;
    setIncidentLog: React.Dispatch<React.SetStateAction<IncidentLogEntry[]>>;
    startDate: string;
    endDate: string;
}

const IncidentManager = forwardRef<IncidentManagerHandle, IncidentManagerProps>((props, ref) => {
    const {
        erpData,
        employeeOptions,
        onRefreshNeeded,
        setIncidentLog,
        startDate,
        endDate
    } = props;
    const { showNotification } = useNotification();
    const { addIncidents, updateRows } = useErpDataActions();

    const logIncident = (employee: ProcessedDataRow, reasonId: number, reasonDesc: string, type: string, details: string) => {
        const newEntry: IncidentLogEntry = {
            id: `RRHH-${Date.now()}`,
            employeeId: employee.operario,
            employeeName: employee.nombre,
            type: type,
            // Mapping to adhere to IncidentLogEntry interface in types.ts
            timestamp: new Date().toLocaleString(),
            reason: reasonDesc,
            dates: details,
            source: 'Registrar Incidencia',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setIncidentLog(prev => [newEntry, ...prev].slice(0, 500)); // Limit to last 500

        // NUEVO: Log en Firestore para auditoría
        logFirestoreIncident({
            employeeId: employee.operario.toString().padStart(3, '0'),
            employeeName: employee.nombre,
            type: type,
            reason: reasonDesc,
            dates: details,
            source: 'Registrar Incidencia',
            registeredBy: 'rrhh@favram.com' // O usar auth.user?.email si está disponible
        }).catch(err => console.error('⚠️ Error logging to Firestore:', err));
    };

    // UI state for modals (moved from HrPortal)
    const [selectedEmployeeForIncident, setSelectedEmployeeForIncident] = useState<ProcessedDataRow | null>(null);
    const [isRecordIncidentModalOpen, setIsRecordIncidentModalOpen] = useState(false);

    const [selectedEmployeeForManual, setSelectedEmployeeForManual] = useState<ProcessedDataRow | null>(null);
    const [isManualIncidentModalOpen, setIsManualIncidentModalOpen] = useState(false);

    const [isLateModalOpen, setIsLateModalOpen] = useState(false);
    const [lateArrivalData, setLateArrivalData] = useState<ProcessedDataRow[]>([]);

    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentData, setAdjustmentData] = useState<RawDataRow[]>([]);
    const [adjustmentShifts, setAdjustmentShifts] = useState<Map<number, string>>(new Map());
    const flexibleEmployeeIds = useMemo(() => {
        return new Set(employeeOptions.filter(emp => emp.flexible).map(emp => emp.id));
    }, [employeeOptions]);

    const [isFreeHoursModalOpen, setIsFreeHoursModalOpen] = useState(false);
    const [freeHoursEmployees, setFreeHoursEmployees] = useState<EmployeeOption[]>([]);
    const [freeHoursDepts, setFreeHoursDepts] = useState<string[]>([]);

    const [isFutureIncidentsModalOpen, setIsFutureIncidentsModalOpen] = useState(false);
    const [futureIncidentsEmployees, setFutureIncidentsEmployees] = useState<EmployeeOption[]>([]);
    const [motivosAusencia, setMotivosAusencia] = useState<{ id: number; desc: string }[]>([]);

    const [justifiedIncidentKeys, setJustifiedIncidentKeys] = useState<Map<string, number>>(new Map());

    useImperativeHandle(ref, () => ({
        handleIncidentClick: (employee) => {
            setSelectedEmployeeForIncident(employee);
            setIsRecordIncidentModalOpen(true);
        },
        handleOpenManualIncident: (employee) => {
            setSelectedEmployeeForManual(employee);
            setIsManualIncidentModalOpen(true);
        },
        handleOpenLateArrivals: (data) => {
            setLateArrivalData(data);
            setIsLateModalOpen(true);
        },
        handleOpenAdjustmentModal: (data, shifts) => {
            setAdjustmentData(data);
            setAdjustmentShifts(shifts);
            setIsAdjustmentModalOpen(true);
        },
        handleOpenFreeHoursModal: (employees, depts) => {
            setFreeHoursEmployees(employees);
            setFreeHoursDepts(depts);
            setIsFreeHoursModalOpen(true);
        },
        handleOpenFutureIncidentsModal: async (employees) => {
            setFutureIncidentsEmployees(employees);

            // Cargar motivos del swagger
            try {
                const motivos = await getMotivosAusencias();
                const motivosMapeados = motivos.map(m => ({
                    id: parseInt(m.IDMotivo, 10),
                    desc: m.DescMotivo
                }));
                setMotivosAusencia(motivosMapeados);
            } catch (error) {
                console.error('Error cargando motivos:', error);
                showNotification('Error cargando motivos de ausencia', 'error');
                // Fallback a lista básica si falla
                setMotivosAusencia([
                    { id: 2, desc: 'Médico' },
                    { id: 3, desc: 'Vacaciones' },
                    { id: 4, desc: 'Permiso' },
                    { id: 5, desc: 'Libre Disposición' },
                ]);
            }

            setIsFutureIncidentsModalOpen(true);
        },
        justifiedIncidentKeys
    }));

    // Helper for shift times
    const getShiftBounds = (turno: string) => {
        if (turno === 'TN' || turno === 'T') return { start: '15:00:00', end: '23:00:00' };
        if (turno === 'N') return { start: '23:00:00', end: '07:00:00' };
        return { start: '07:00:00', end: '15:00:00' }; // Default M
    };

    const addMinutes = (timeStr: string, minutes: number): string => {
        const [h, m, s] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m, s || 0);
        date.setMinutes(date.getMinutes() + minutes);
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    const normalizeGapTime = (timeStr: string): string => {
        if (!timeStr) return '';
        const clean = timeStr.replace(' (+1)', '');
        return clean.substring(0, 5);
    };

    const handleManualIncidentSave = async (data: ManualIncidentData) => {
        if (!selectedEmployeeForManual) return;

        try {
            const shift = getShiftBounds(selectedEmployeeForManual.turnoAsignado);
            let entryRow: Partial<RawDataRow>;
            let exitRow: Partial<RawDataRow>;
            let desc = '';

            if (!data.isFullDay) {
                // MANUAL PARTIAL
                if (!data.startTime || !data.endTime) {
                    showNotification("Para incidencias parciales debe indicar Hora Inicio y Hora Fin.", "error");
                    return;
                }

                const startStr = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
                const endStr = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;

                entryRow = {
                    IDOperario: selectedEmployeeForManual.operario,
                    DescOperario: selectedEmployeeForManual.nombre,
                    Fecha: data.date,
                    Hora: startStr,
                    Entrada: 1,
                    MotivoAusencia: null,
                    DescMotivoAusencia: '',
                    DescDepartamento: selectedEmployeeForManual.colectivo || '',
                    IDControlPresencia: 0,
                    Computable: 'Sí',
                    TipoDiaEmpresa: 0,
                    TurnoTexto: selectedEmployeeForManual.turnoAsignado,
                    GeneradoPorApp: true
                };

                exitRow = {
                    IDOperario: selectedEmployeeForManual.operario,
                    DescOperario: selectedEmployeeForManual.nombre,
                    Fecha: data.date,
                    Hora: endStr,
                    Entrada: 0,
                    MotivoAusencia: data.reasonId,
                    DescMotivoAusencia: data.reasonDesc,
                    DescDepartamento: selectedEmployeeForManual.colectivo || '',
                    IDControlPresencia: 0,
                    Computable: 'No',
                    TipoDiaEmpresa: 0,
                    TurnoTexto: selectedEmployeeForManual.turnoAsignado,
                    Inicio: startStr,
                    Fin: endStr,
                    GeneradoPorApp: true
                };
                desc = "Manual Gap Pair";

            } else {
                // MANUAL FULL DAY
                entryRow = {
                    IDOperario: selectedEmployeeForManual.operario,
                    DescOperario: selectedEmployeeForManual.nombre,
                    Fecha: data.date,
                    Hora: shift.start,
                    Entrada: 1,
                    MotivoAusencia: null,
                    DescMotivoAusencia: '',
                    DescDepartamento: selectedEmployeeForManual.colectivo || '',
                    IDControlPresencia: 0,
                    Computable: 'Sí',
                    TipoDiaEmpresa: 0,
                    TurnoTexto: selectedEmployeeForManual.turnoAsignado,
                    GeneradoPorApp: true
                };

                exitRow = {
                    IDOperario: selectedEmployeeForManual.operario,
                    DescOperario: selectedEmployeeForManual.nombre,
                    Fecha: data.date,
                    Hora: shift.end,
                    Entrada: 0,
                    MotivoAusencia: data.reasonId,
                    DescMotivoAusencia: data.reasonDesc,
                    DescDepartamento: selectedEmployeeForManual.colectivo || '',
                    IDControlPresencia: 0,
                    Computable: 'No',
                    TipoDiaEmpresa: 0,
                    TurnoTexto: selectedEmployeeForManual.turnoAsignado,
                    Inicio: shift.start.substring(0, 5),
                    Fin: shift.end.substring(0, 5),
                    GeneradoPorApp: true
                };
                desc = data.isFullDay ? 'Ausencia Completa' : 'Incidencia Manual';
            }

            // Save to Database/ERP
            await addIncidents([entryRow as RawDataRow, exitRow as RawDataRow], desc);

            // Logging Synthetic Punches to Firestore
            const newRows = [entryRow, exitRow];
            for (const row of newRows) {
                if (row.GeneradoPorApp && row.IDOperario) {
                    await logSyntheticPunch({
                        employeeId: row.IDOperario.toString(),
                        date: row.Fecha || '',
                        time: row.Hora || '',
                        reasonId: row.MotivoAusencia || null,
                        reasonDesc: row.DescMotivoAusencia || '',
                        direction: row.Entrada ? 'Entrada' : 'Salida'
                    });
                }
            }

            showNotification(`Incidencia manual registrada: ${desc}`, "success");
            onRefreshNeeded();

        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Error saving manual incident:", error.message);
                showNotification(`Error: ${error.message}`, "error");
            }
        }
    };

    const getIncidentKey = (incident: { type: 'gap' | 'workday' | 'absentDay'; data: UnjustifiedGap | WorkdayDeviation | { date: string } }, employee: ProcessedDataRow) => {
        if (incident.type === 'gap') {
            const gapData = incident.data as UnjustifiedGap;
            const gapStart = normalizeGapTime(gapData.start || '');
            return `gap-${employee.operario}-${gapData.date}-${gapStart}`;
        }
        if (incident.type === 'workday') {
            const workdayData = incident.data as WorkdayDeviation;
            return `dev-${employee.operario}-${workdayData.date}`;
        }
        const absentData = incident.data as { date: string };
        return `abs-${employee.operario}-${absentData.date}`;
    };

    const handleJustifyIncident = async (
        incident: { type: 'gap' | 'workday' | 'absentDay'; data: UnjustifiedGap | WorkdayDeviation | { date: string } },
        reason: { id: number; desc: string },
        employee: ProcessedDataRow
    ) => {
        try {
            const { type } = incident;
            let didSave = false;
            let strategyResult;

            // 1. Delegar la lógica a incidentStrategies.ts
            if (type === 'gap') {
                const gapData = incident.data as UnjustifiedGap;
                strategyResult = generateGapStrategy(gapData, reason, employee);
            } else if (type === 'absentDay') {
                const { date } = incident.data as { date: string };
                strategyResult = generateFullDayStrategy(date, reason, employee);
            } else if (type === 'workday') {
                const workdayData = incident.data as WorkdayDeviation;
                strategyResult = generateWorkdayStrategy(workdayData, reason, employee);
            }

            if (!strategyResult) return;

            console.log(`📝 [JUSTIFY] Estrategia calculada: ${strategyResult.description}`);

            // 2. Ejecutar Acciones (Inserts y Updates)
            if (strategyResult.rowsToInsert.length > 0) {
                await addIncidents(strategyResult.rowsToInsert as RawDataRow[], strategyResult.description);
                didSave = true;

                // LOGGING SYNTHETIC PUNCHES TO FIRESTORE (SIDECAR)
                for (const row of strategyResult.rowsToInsert) {
                    if (row.GeneradoPorApp && row.IDOperario) {
                        await logSyntheticPunch({
                            employeeId: row.IDOperario.toString(),
                            date: row.Fecha || '',
                            time: row.Hora || '',
                            reasonId: row.MotivoAusencia || null,
                            reasonDesc: row.DescMotivoAusencia || '',
                            direction: row.Entrada ? 'Entrada' : 'Salida'
                        });
                    }
                }
            }

            if (strategyResult.rowsToUpdate.length > 0) {
                const updates = strategyResult.rowsToUpdate;
                const oldRows: RawDataRow[] = [];
                const newRows: RawDataRow[] = [];

                for (const update of updates) {
                    const original = erpData.find(r => r.IDControlPresencia === update.IDControlPresencia);
                    if (original) {
                        oldRows.push(original);
                        newRows.push({ ...original, ...update } as RawDataRow);
                    } else {
                        console.warn(`No se encontró registro original para update ID ${update.IDControlPresencia}`);
                    }
                }

                if (oldRows.length > 0) {
                    await updateRows(oldRows, newRows);
                    didSave = true;
                }
            }

            if (didSave) {
                showNotification(strategyResult.description, "success");
                // logIncident(employee, reason.id, reason.desc, type === 'gap' ? 'Justificación Hueco' : 'Ausencia Completa', strategyResult.description);
            }

            onRefreshNeeded();
            if (didSave) {
                const key = getIncidentKey(incident, employee);
                setJustifiedIncidentKeys(prev => {
                    const next = new Map(prev);
                    next.set(key, reason.id);
                    return next;
                });
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Error justifying incident:", error.message);
                showNotification(`Error: ${error.message}`, "error");
            }
        }
    };

    return (
        <>
            {selectedEmployeeForIncident && (
                <RecordIncidentModal
                    isOpen={isRecordIncidentModalOpen}
                    onClose={() => setIsRecordIncidentModalOpen(false)}
                    employeeData={selectedEmployeeForIncident}
                    onJustify={handleJustifyIncident}
                    justifiedKeys={justifiedIncidentKeys}
                />
            )}

            {selectedEmployeeForManual && (
                <ManualIncidentModal
                    isOpen={isManualIncidentModalOpen}
                    onClose={() => setIsManualIncidentModalOpen(false)}
                    employee={selectedEmployeeForManual}
                    startDate={startDate}
                    endDate={endDate}
                    onSave={handleManualIncidentSave}
                />
            )}

            {isAdjustmentModalOpen && (
                <MultipleAdjustmentModal
                    isOpen={isAdjustmentModalOpen}
                    onClose={() => setIsAdjustmentModalOpen(false)}
                    data={adjustmentData}
                    onApply={async (updated) => {
                        const changed = updated.filter(u => {
                            const orig = adjustmentData.find(a => a.IDControlPresencia === u.IDControlPresencia);
                            return orig && (orig.Hora !== u.Hora || orig.Inicio !== u.Inicio || orig.Fin !== u.Fin);
                        });
                        if (changed.length > 0) {
                            const old = adjustmentData.filter(a => changed.some(c => c.IDControlPresencia === a.IDControlPresencia));
                            await updateRows(old, changed);
                            showNotification(`${changed.length} fichajes actualizados`, 'success');
                            onRefreshNeeded();
                        }
                        setIsAdjustmentModalOpen(false);
                    }}
                    employeeShifts={adjustmentShifts}
                    flexibleEmployeeIds={flexibleEmployeeIds}
                />
            )}

            {isLateModalOpen && (
                <LateArrivalsModal
                    isOpen={isLateModalOpen}
                    onClose={() => setIsLateModalOpen(false)}
                    data={lateArrivalData}
                />
            )}

            {isFreeHoursModalOpen && (
                <FreeHoursFilterModal
                    isOpen={isFreeHoursModalOpen}
                    onClose={() => setIsFreeHoursModalOpen(false)}
                    onExport={(filters) => {
                        // This usually triggers a heavy export in parent
                    }}
                    allEmployees={freeHoursEmployees}
                    departments={freeHoursDepts}
                />
            )}

            {isFutureIncidentsModalOpen && (
                <FutureIncidentsModal
                    isOpen={isFutureIncidentsModalOpen}
                    onClose={() => setIsFutureIncidentsModalOpen(false)}
                    employees={futureIncidentsEmployees}
                    motivos={motivosAusencia}
                    onSave={async (data) => {
                        try {
                            const { employeeId, employeeName, startDate, endDate, reasonId, reasonDesc } = data;

                            // Generate all dates in range
                            const start = new Date(startDate);
                            const end = new Date(endDate);
                            const dates: string[] = [];

                            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                dates.push(toISODateLocal(d));
                            }

                            // For each date create full day incident (Case 4)
                            const incidents: Partial<RawDataRow>[] = [];
                            const emp = futureIncidentsEmployees.find(e => e.id === employeeId);
                            const shift = getShiftBounds('M'); // Default to morning shift

                            for (const date of dates) {
                                const entryRow: Partial<RawDataRow> = {
                                    IDOperario: employeeId,
                                    DescOperario: employeeName,
                                    Fecha: date,
                                    Hora: shift.start,
                                    Entrada: 1,
                                    MotivoAusencia: null,
                                    DescMotivoAusencia: '',
                                    DescDepartamento: emp?.department || '',
                                    IDControlPresencia: 0,
                                    Computable: 'Sí',
                                    TipoDiaEmpresa: 0,
                                    TurnoTexto: 'M'
                                };

                                const exitRow: Partial<RawDataRow> = {
                                    IDOperario: employeeId,
                                    DescOperario: employeeName,
                                    Fecha: date,
                                    Hora: shift.end,
                                    Entrada: 0,
                                    MotivoAusencia: reasonId,
                                    DescMotivoAusencia: reasonDesc,
                                    DescDepartamento: emp?.department || '',
                                    IDControlPresencia: 0,
                                    Computable: 'No',
                                    TipoDiaEmpresa: 0,
                                    TurnoTexto: 'M'
                                };

                                incidents.push(entryRow, exitRow);
                            }

                            await addIncidents(incidents as RawDataRow[], `Future Incidents: ${reasonDesc}`);
                            showNotification(`Incidencias futuras registradas: ${dates.length} día(s) para ${employeeName}`, 'success');
                            onRefreshNeeded();
                        } catch (error: unknown) {
                            if (error instanceof Error) {
                                console.error('Error saving future incidents:', error.message);
                                showNotification(`Error: ${error.message}`, 'error');
                            }
                        }
                    }}
                />
            )}
        </>
    );
});

export default IncidentManager;
