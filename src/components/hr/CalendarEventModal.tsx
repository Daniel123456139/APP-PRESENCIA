import React, { useState, useMemo } from 'react';
import { useMotivos } from '../../hooks/useErp';

interface CalendarEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (reason: { id: number, desc: string }) => void;
    date: Date | null;
    viewMode: 'employees' | 'company';
}

const CalendarEventModal: React.FC<CalendarEventModalProps> = ({ isOpen, onClose, onSave, date, viewMode }) => {
    const [reasonId, setReasonId] = useState<string>('');
    const { motivos, loading } = useMotivos();

    const manualAbsenceReasons = useMemo(() => {
        return motivos
            .filter(m => ![1].includes(parseInt(m.IDMotivo)))
            .map(m => ({
                id: parseInt(m.IDMotivo),
                desc: `${m.IDMotivo.padStart(2, '0')} - ${m.DescMotivo}`
            }))
            .sort((a, b) => a.id - b.id);
    }, [motivos]);

    if (!isOpen || !date) return null;

    const handleSave = () => {
        if (!reasonId) {
            alert("Por favor, selecciona un motivo.");
            return;
        }

        let reason;
        if (viewMode === 'company') {
            reason = companyReasons.find(r => r.id === parseInt(reasonId, 10));
        } else {
            reason = manualAbsenceReasons.find(r => r.id === parseInt(reasonId, 10));
        }

        if (reason) {
            onSave(reason);
        }
    };

    const companyReasons = [{ id: 100, desc: 'Festivo de Empresa' }];
    const availableReasons = viewMode === 'company' ? companyReasons : manualAbsenceReasons;


    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Registrar Ausencia</h2>
                        <p className="text-sm text-slate-500">{date.toLocaleDateString()}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">&times;</button>
                </div>

                <div className="space-y-4">
                    {viewMode === 'employees' && (
                        <p className="text-sm bg-blue-50 text-blue-800 p-3 rounded-md border border-blue-200">
                            La ausencia se registrará para todos los empleados actualmente visibles según los filtros aplicados.
                        </p>
                    )}
                    {viewMode === 'company' && (
                        <p className="text-sm bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200">
                            Estás a punto de registrar un evento para toda la empresa.
                        </p>
                    )}
                    <div>
                        <label htmlFor="reason-select" className="block text-sm font-medium text-slate-700">Motivo de la Ausencia</label>
                        <select
                            id="reason-select"
                            value={reasonId}
                            onChange={e => setReasonId(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 border-slate-300 rounded-md"
                            disabled={loading && viewMode === 'employees'}
                        >
                            <option value="">{loading && viewMode === 'employees' ? "Cargando..." : "-- Selecciona un motivo --"}</option>
                            {availableReasons.map(reason => (
                                <option key={reason.id} value={reason.id}>{reason.desc}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50">
                        Cancelar
                    </button>
                    <button type="button" onClick={handleSave} disabled={!reasonId} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300">
                        Registrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalendarEventModal;
