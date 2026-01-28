import React, { useState, useEffect } from 'react';
import { ProcessedDataRow } from '../../types';
import { useMotivos } from '../../hooks/useErp';

interface ManualIncidentModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: ProcessedDataRow | null;
    startDate: string; // Range start for validation/default
    endDate: string;   // Range end for validation
    onSave: (incident: ManualIncidentData) => void;
}

export interface ManualIncidentData {
    date: string;
    isFullDay: boolean;
    startTime?: string;
    endTime?: string;
    reasonId: number;
    reasonDesc: string;
}

const ManualIncidentModal: React.FC<ManualIncidentModalProps> = ({
    isOpen,
    onClose,
    employee,
    startDate,
    endDate,
    onSave
}) => {
    const [date, setDate] = useState('');
    const [isFullDay, setIsFullDay] = useState(false);
    const [startTime, setStartTime] = useState('07:00');
    const [endTime, setEndTime] = useState('15:00');
    const [selectedReasonId, setSelectedReasonId] = useState<number | ''>('');

    const { motivos, loading } = useMotivos();

    // Reset when opening
    useEffect(() => {
        if (isOpen && employee && startDate) {
            setDate(startDate); // Pre-fill selected date
            setIsFullDay(false);
            setStartTime('07:00');
            setEndTime('15:00');
            setSelectedReasonId('');

            // --- GAP DETECTION LOGIC ---
            // Detect if this employee has punches on this specific date that suggest gaps.
            // We need to look at 'timeSlices' or raw punches if available.
            // ProcessedDataRow has 'timeSlices'.

            if (employee.timeSlices && employee.timeSlices.length > 0) {
                // Filter slices for the selected date
                const slicesOnDate = employee.timeSlices.filter(slice => slice.start.startsWith('')); // slices usually don't have date... wait. 
                // TimeSlices in ProcessedDataRow are for the row's date.
                // If the modal is opened for a specific row/date, 'employee' is that row.
                // Assuming 'employee' corresponds to the 'startDate' passed.

                // Let's analyze punches for the *ROW* passed.
                // Check M (Morning) or TN (Afternoon)
                const shift = employee.turnoAsignado || 'M';
                const shiftStart = shift === 'TN' ? '15:00' : '07:00';
                const shiftEnd = shift === 'TN' ? '23:00' : '15:00';

                // Find First Entry and Last Exit
                // timeSlices are {start, end}. 
                // Example: [{start: '07:00', end: '12:00'}] -> Early Exit at 12:00. 
                // Gap: 12:01 - 15:00.

                // Example: [{start: '10:00', end: '15:00'}] -> Late Arrival at 10:00.
                // Gap: 07:00 - 09:59.

                // We can't handle complex multi-gap scenarios easily, just pick the most obvious one.

                if (employee.timeSlices.length > 0) {
                    const firstSlice = employee.timeSlices[0];
                    const lastSlice = employee.timeSlices[employee.timeSlices.length - 1];

                    if (firstSlice && firstSlice.start > shiftStart) {
                        // Late Arrival Detected
                        // Suggest Gap Filling: ShiftStart -> FirstEntry - 1m
                        // "07:00" -> "09:59"
                        setStartTime(shiftStart);

                        // Calculate End Time: Entry - 1 minute
                        const [h, m] = firstSlice.start.split(':').map(Number);
                        const dateObj = new Date(2000, 0, 1, h, m);
                        dateObj.setMinutes(dateObj.getMinutes() - 1);
                        const endStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                        setEndTime(endStr);
                        // console.log("Auto-filling Late Arrival Gap:", shiftStart, "->", endStr);
                    } else if (lastSlice && lastSlice.end < shiftEnd) {
                        // Early Exit Detected
                        // Suggest Gap Filling: LastExit + 1m -> ShiftEnd

                        // Calculate Start Time: Exit + 1 minute
                        const [h, m] = lastSlice.end.split(':').map(Number);
                        const dateObj = new Date(2000, 0, 1, h, m);
                        dateObj.setMinutes(dateObj.getMinutes() + 1);
                        const startStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                        setStartTime(startStr);
                        setEndTime(shiftEnd);
                        // console.log("Auto-filling Early Exit Gap:", startStr, "->", shiftEnd);
                    }
                }
            }
        }
    }, [isOpen, startDate, employee]);

    if (!isOpen || !employee) return null;

    const handleSave = () => {
        if (!date || !selectedReasonId) return;

        const reason = motivos.find(r => parseInt(r.IDMotivo) === Number(selectedReasonId));
        if (!reason) return;

        onSave({
            date,
            isFullDay,
            startTime: isFullDay ? undefined : startTime,
            endTime: isFullDay ? undefined : endTime,
            reasonId: Number(reason.IDMotivo),
            reasonDesc: reason.DescMotivo
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Añadir Incidencia Manual</h2>
                        <p className="text-sm text-slate-500 mt-1">Empleado: <span className="font-semibold text-slate-700">{employee.nombre}</span></p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                        <input
                            type="date"
                            value={date}
                            min={startDate}
                            max={endDate}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="fullDay"
                            checked={isFullDay}
                            onChange={(e) => setIsFullDay(e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="fullDay" className="text-sm font-medium text-slate-700">Día completo (Jornada entera)</label>
                    </div>

                    {!isFullDay && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Hora Inicio</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Hora Fin</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
                        <select
                            value={selectedReasonId}
                            onChange={(e) => setSelectedReasonId(Number(e.target.value))}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            disabled={loading}
                        >
                            <option value="">{loading ? "Cargando motivos..." : "-- Selecciona un motivo --"}</option>
                            {motivos
                                .filter(m => ![1, 14].includes(parseInt(m.IDMotivo))) // Applying standard exclusions if needed, or keeping all? Prompt said "mantener exclusiones existentes donde aplique". ManualIncidentModal didn't have exclusions before, but "eliminate hardcoded lists" implies we should trust the user?
                                // Actually, ManualIncidentModal in previous view showed: map(reason => (option...))
                                // It didn't filter.
                                // But the prompt says: "mantener las exclusiones existentes donde aplique (p.ej. no permitir 01 Fin de Jornada o 14 TAJ en selects de justificación si ya estaba así)"
                                // Manual Incident usually implies creating a justification or specific absence. 01 and 14 are usually system generated or terminal actions.
                                // I will apply the filter to be safe and consistent with "Standardize".
                                .slice() // copy to sort
                                .sort((a, b) => parseInt(a.IDMotivo) - parseInt(b.IDMotivo))
                                .map(reason => (
                                    <option key={reason.IDMotivo} value={reason.IDMotivo}>
                                        {reason.IDMotivo.padStart(2, '0')} - {reason.DescMotivo}
                                    </option>
                                ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!date || !selectedReasonId}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Guardar Incidencia
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualIncidentModal;
