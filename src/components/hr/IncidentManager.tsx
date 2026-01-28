import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { RawDataRow, ProcessedDataRow, Role, IncidentLogEntry } from '../../types';
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
import { toISODateLocal, parseISOToLocalDate } from '../../utils/localDate';
import { logIncident as logFirestoreIncident } from '../../services/firestoreService';

export interface EmployeeOption {
    id: number;
    name: string;
    role: Role;
    department: string;
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
}

const IncidentManager = forwardRef<IncidentManagerHandle, IncidentManagerProps>((props, ref) => {
    const {
        erpData,
        employeeOptions,
        onRefreshNeeded,
        setIncidentLog
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

            if (!data.isFullDay) {
                // MANUAL PARTIAL
                if (!data.startTime || !data.endTime) {
                    showNotification("Para incidencias parciales debe indicar Hora Inicio y Hora Fin.", "error");
                    return;
                }

                const startStr = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;

                // Determine if this is a "Late Entry" fix or "Early Exit" fix is hard manual; 
                // BUT User Request Case 1 & 2 logic implies we want to create specific pairs.
                // However, MANUAL interaction usually implies "Create this specific gap filler".
                // If the user inputs 12:00 to 15:00 manually, we treat it like Case 1.
                // If they input 07:00 to 09:00 manually, Case 2.
                // We will stick to the user's explicit request for inserting Entry + Exit pair.

                // ENTRY (Normal, no reason) - at Gap Start?
                // Wait, User Logic Case 1: "Insertar entrada normal... minuto posterior al que el operario ficho la salida".
                // In Manual Mode, we don't necessarily know the "ficho la salida" time unless we look it up.
                // But generally Manual Incident is used when there is NO punch or to override.

                // Let's assume Manual follows the generic pattern:
                // Create Entry (Empty Reason) at Start
                // Create Exit (Reason) at End
                // This matches generic "justification".

                const entryRow: Partial<RawDataRow> = {
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
                    TurnoTexto: selectedEmployeeForManual.turnoAsignado
                };

                const endStr = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;
                const exitRow: Partial<RawDataRow> = {
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
                    Fin: endStr
                };

                await addIncidents([entryRow as RawDataRow, exitRow as RawDataRow], "Manual Gap Pair");
                showNotification("Incidencia manual registrada.", "success");
            } else {
                // MANUAL FULL DAY -> Case 4
                // Insert Entry @ ShiftStart (Null Reason)
                // Insert Exit @ ShiftEnd (Reason)

                const entryRow: Partial<RawDataRow> = {
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
                    TurnoTexto: selectedEmployeeForManual.turnoAsignado
                };

                const exitRow: Partial<RawDataRow> = {
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
                    TurnoTexto: selectedEmployeeForManual.turnoAsignado
                };

                // Check conflicts? User didn't specify conflicts for Case 4, but usually logic implies replacing if exists.
                // For simplified "Strict Logic", we just insert the requested items. 
                // Ideally we'd remove conflicting, but let's stick to the Insert instruction.

                await addIncidents([entryRow as RawDataRow, exitRow as RawDataRow], "Manual Full Day");
                showNotification("Día completo registrado.", "success");
            }

            logIncident(
                selectedEmployeeForManual,
                data.reasonId,
                data.reasonDesc,
                data.isFullDay ? 'Ausencia Completa' : 'Incidencia Manual',
                `Manual: ${data.date}`
            );
            onRefreshNeeded();

        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Error saving manual incident:", error.message);
                showNotification(`Error: ${error.message}`, "error");
            }
        }
    };

    const handleJustifyIncident = async (
        incident: { type: 'gap' | 'workday' | 'absentDay'; data: Record<string, any> },
        reason: { id: number; desc: string },
        employee: ProcessedDataRow
    ) => {
        try {
            const { type, data } = incident;
            let newIncidents: RawDataRow[] = [];
            const shift = getShiftBounds(employee.turnoAsignado);

            if (type === 'gap') {
                const { date, start, end } = data;

                // Normalise times
                const gapStart = start.length === 5 ? `${start}:00` : start;
                const gapEnd = end.length === 5 ? `${end}:00` : end;
                const gapStartShort = normalizeGapTime(gapStart);
                const gapEndShort = normalizeGapTime(gapEnd);

                // Detect Case
                const isStartGap = gapStart === shift.start; // Case 2: 07:00 -> ... (Entrada tardía)
                const isEndGap = gapEnd === shift.end;     // Case 1: ... -> 15:00 (Salida anticipada)
                // Check if we have an originPunchId (Case 3 - se va y vuelve)
                const originPunchId = (data as any).originPunchId;

                console.log(`📝 [JUSTIFY GAP] Empleado ${employee.nombre} (${employee.operario}) - Gap: ${gapStart} → ${gapEnd}`);
                console.log(`   🔍 Detección: isStartGap=${isStartGap}, isEndGap=${isEndGap}, originPunchId=${originPunchId || 'none'}`);
                console.log(`   ⏰ Turno: ${employee.turnoAsignado} (${shift.start} - ${shift.end})`);

                if (originPunchId) {
                    // CASE 3 / Early Exit with Existing Punch
                    // Se va y vuelve: modificar el fichaje de salida intermedia existente
                    console.log(`   ✏️ CASO 3: Modificar fichaje existente (ID: ${originPunchId})`);

                    const originalRow = erpData.find(r => r.IDControlPresencia === originPunchId);

                    if (!originalRow) {
                        console.error(`   ❌ ERROR: No se encontró fichaje con ID ${originPunchId}`);
                        showNotification("Error: No se encontró el fichaje original para actualizar.", "error");
                        return;
                    }

                    const updateRow: RawDataRow = {
                        ...originalRow,
                        MotivoAusencia: reason.id,
                        DescMotivoAusencia: reason.desc,
                        Computable: 'No',
                        Inicio: gapStartShort,
                        Fin: gapEndShort
                    };

                    await updateRows([originalRow], [updateRow]);
                    console.log(`   ✅ CASO 3: Fichaje actualizado correctamente`);
                    showNotification("Salida justificada correctamente (Actualización).", "success");

                } else if (isStartGap) {
                    // CASE 2: Late Entry (Entra tarde justificado)
                    // ⚠️ CRÍTICO: NO modificar la entrada real (ej: 11:35)
                    // ✅ INSERTAR par sintético: 
                    //    - Entrada @ 07:00 (inicio jornada) SIN motivo
                    //    - Salida @ 11:34 (1 min antes de entrada real) CON motivo

                    console.log(`   🔴 CASO 2 - ENTRADA TARDÍA DETECTADA`);
                    console.log(`   📌 Acción: Insertar PAR sintético (NO modificar entrada real a las ${gapEnd})`);

                    const timeExit = addMinutes(gapEnd, -1);

                    const entryRow: Partial<RawDataRow> = {
                        IDOperario: employee.operario,
                        DescOperario: employee.nombre,
                        Fecha: date,
                        Hora: shift.start, // FORZADO 07:00 (inicio jornada)
                        Entrada: 1,
                        MotivoAusencia: null, // ✓ SIN MOTIVO (entrada normal)
                        DescMotivoAusencia: '',
                        DescDepartamento: employee.colectivo || '',
                        IDControlPresencia: 0,
                        Computable: 'Sí',
                        TipoDiaEmpresa: 0,
                        TurnoTexto: employee.turnoAsignado
                    };

                    const exitRow: Partial<RawDataRow> = {
                        IDOperario: employee.operario,
                        DescOperario: employee.nombre,
                        Fecha: date,
                        Hora: timeExit, // Calculado: gapEnd - 1 min (ej: 11:34)
                        Entrada: 0,
                        MotivoAusencia: reason.id, // ✓ CON MOTIVO (justificación)
                        DescMotivoAusencia: reason.desc,
                        DescDepartamento: employee.colectivo || '',
                        IDControlPresencia: 0,
                        Computable: 'No',
                        Inicio: normalizeGapTime(shift.start),
                        Fin: gapEndShort,
                        TipoDiaEmpresa: 0,
                        TurnoTexto: employee.turnoAsignado
                    };

                    console.log(`   ➕ Insertar ENTRADA @ ${shift.start} (sin motivo)`);
                    console.log(`   ➕ Insertar SALIDA @ ${timeExit} (motivo: ${reason.desc})`);
                    console.log(`   ⚠️ La entrada real a las ${gapEnd} NO se toca`);

                    await addIncidents([entryRow as RawDataRow, exitRow as RawDataRow], "Case 2 Late Entry");
                    console.log(`   ✅ CASO 2: Par sintético insertado correctamente`);
                    showNotification("Entrada tardía justificada (Caso 2).", "success");

                } else if (isEndGap) {
                    // CASE 1: Early Exit (Se va y no vuelve)
                    // Insertar par sintético:
                    //    - Entrada @ salida real + 1 min
                    //    - Salida @ 15:00 (fin jornada) CON motivo

                    console.log(`   🔴 CASO 1 - SALIDA ANTICIPADA DETECTADA`);

                    const timeEntry = addMinutes(gapStart, 1);

                    const entryRow: Partial<RawDataRow> = {
                        IDOperario: employee.operario,
                        DescOperario: employee.nombre,
                        Fecha: date,
                        Hora: timeEntry, // Salida real + 1 min (ej: 12:01)
                        Entrada: 1,
                        MotivoAusencia: null,
                        DescMotivoAusencia: '',
                        DescDepartamento: employee.colectivo || '',
                        IDControlPresencia: 0,
                        Computable: 'Sí',
                        TipoDiaEmpresa: 0,
                        TurnoTexto: employee.turnoAsignado
                    };

                    const exitRow: Partial<RawDataRow> = {
                        IDOperario: employee.operario,
                        DescOperario: employee.nombre,
                        Fecha: date,
                        Hora: shift.end, // FORZADO 15:00 (fin jornada)
                        Entrada: 0,
                        MotivoAusencia: reason.id,
                        DescMotivoAusencia: reason.desc,
                        DescDepartamento: employee.colectivo || '',
                        IDControlPresencia: 0,
                        Computable: 'No',
                        Inicio: gapStartShort,
                        Fin: normalizeGapTime(shift.end),
                        TipoDiaEmpresa: 0,
                        TurnoTexto: employee.turnoAsignado
                    };

                    console.log(`   ➕ Insertar ENTRADA @ ${timeEntry} (sin motivo)`);
                    console.log(`   ➕ Insertar SALIDA @ ${shift.end} (motivo: ${reason.desc})`);

                    await addIncidents([entryRow as RawDataRow, exitRow as RawDataRow], "Case 1 Early Exit");
                    console.log(`   ✅ CASO 1: Par sintético insertado correctamente`);
                    showNotification("Salida anticipada justificada (Caso 1).", "success");

                } else {
                    // CASE 3: Middle Gap (Se va y vuelve) - SIN originPunchId (fallback)
                    // Buscar y modificar el fichaje de salida existente
                    console.log(`   🔵 CASO 3 (fallback sin originPunchId) - Buscando fichaje de salida`);

                    const existingExit = erpData.find(r =>
                        r.IDOperario === employee.operario &&
                        r.Fecha === date &&
                        r.Hora.startsWith(gapStart.substring(0, 5)) && // Match approx hour
                        r.Entrada === 0
                    );

                    if (existingExit) {
                        const updatedRow: RawDataRow = {
                            ...existingExit,
                            MotivoAusencia: reason.id,
                            DescMotivoAusencia: reason.desc,
                            Computable: 'No',
                            Inicio: gapStartShort,
                            Fin: gapEndShort
                        };
                        console.log(`   ✏️ Modificar salida existente @ ${existingExit.Hora} (ID: ${existingExit.IDControlPresencia})`);
                        await updateRows([existingExit], [updatedRow]);
                        console.log(`   ✅ CASO 3 (fallback): Salida actualizada`);
                        showNotification("Salida intermedia actualizada (Caso 3).", "success");
                    } else {
                        // No se encontró fichaje de salida para modificar
                        console.warn(`   ⚠️ ADVERTENCIA: No se encontró fichaje de salida @ ${gapStart} para modificar`);
                        console.warn(`   ℹ️ Puede que sea un gap creado por ausencia total (sin fichajes)`);
                        showNotification("No se encontró el fichaje de salida para modificar.", 'warning');
                    }
                }

                logIncident(employee, reason.id, reason.desc, 'Justificación Hueco', `Gap: ${gapStart}-${gapEnd}`);

            } else if (type === 'absentDay') {
                // CASE 4: Absent Day / Full Day
                // Insert Entry @ ShiftStart (Null)
                // Insert Exit @ ShiftEnd (Reason)

                const { date } = data;

                const entryRow: Partial<RawDataRow> = {
                    IDOperario: employee.operario,
                    DescOperario: employee.nombre,
                    Fecha: date,
                    Hora: shift.start,
                    Entrada: 1,
                    MotivoAusencia: null,
                    DescMotivoAusencia: '',
                    DescDepartamento: employee.colectivo || '',
                    IDControlPresencia: 0,
                    Computable: 'Sí',
                    TipoDiaEmpresa: 0,
                    TurnoTexto: employee.turnoAsignado
                };

                const exitRow: Partial<RawDataRow> = {
                    IDOperario: employee.operario,
                    DescOperario: employee.nombre,
                    Fecha: date,
                    Hora: shift.end,
                    Entrada: 0,
                    MotivoAusencia: reason.id,
                    DescMotivoAusencia: reason.desc,
                    DescDepartamento: employee.colectivo || '',
                    IDControlPresencia: 0,
                    Computable: 'No',
                    TipoDiaEmpresa: 0,
                    TurnoTexto: employee.turnoAsignado
                };

                await addIncidents([entryRow as RawDataRow, exitRow as RawDataRow], "Case 4 Absent Day");
                showNotification("Día completo justificado (Caso 4).", "success");

                logIncident(employee, reason.id, reason.desc, 'Ausencia Completa', `Día ${date}`);

            } else if (type === 'workday') {
                // Keep existing workday justification logic (update specific record)
                // OR adapt if this falls into Case 2/1?
                // Workday deviation is usually "I clocked out late" or "Clocked in early".
                // Just use generic update implementation for now as it wasn't strictly redefined in 4 cases.
                // Actually Case 3 "returns" logic might overlap. 
                // Let's keep original logic for 'workday' type as it targets specific "fichaje" justification.

                const { date, time, isEntry } = data;
                const targetTimeShort = time.substring(0, 5);

                const existingRow = erpData.find(row =>
                    row.IDOperario === employee.operario &&
                    row.Fecha === date &&
                    row.Hora.startsWith(targetTimeShort) &&
                    row.Entrada === (isEntry ? 1 : 0) &&
                    (row.MotivoAusencia === null || row.MotivoAusencia === 0 || row.MotivoAusencia === 1)
                );

                if (existingRow) {
                    const updatedRow: RawDataRow = {
                        ...existingRow,
                        MotivoAusencia: reason.id,
                        DescMotivoAusencia: reason.desc,
                        Computable: 'No',
                    };
                    await updateRows([existingRow], [updatedRow]);
                    showNotification(`Fichaje justificado.`, "success");
                }
                logIncident(employee, reason.id, reason.desc, 'Workday Deviation', `Deviation @ ${time}`);
            }
            onRefreshNeeded();
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
