
import React, { useState, useEffect, useMemo } from 'react';
import { LeaveRange } from '../../types';
import { useMotivos } from '../../hooks/useErp';
import SmartDateInput from '../shared/SmartDateInput';

interface EditLeaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    range: LeaveRange | null;
    onSave: (oldRange: LeaveRange, newRange: LeaveRange) => Promise<void>;
    onDelete: (range: LeaveRange) => Promise<void>;
}

const EditLeaveModal: React.FC<EditLeaveModalProps> = ({ isOpen, onClose, range, onSave, onDelete }) => {
    const [motivoId, setMotivoId] = useState<number | string>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isFullDay, setIsFullDay] = useState(true);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { motivos, loading } = useMotivos();

    const manualAbsenceReasons = useMemo(() => {
        return motivos
            .filter(m => ![1, 14].includes(parseInt(m.IDMotivo)))
            .map(m => ({
                id: parseInt(m.IDMotivo),
                desc: `${m.IDMotivo.padStart(2, '0')} - ${m.DescMotivo}`
            }))
            .sort((a, b) => a.id - b.id);
    }, [motivos]);

    useEffect(() => {
        if (range) {
            setMotivoId(range.motivoId);
            setStartDate(range.startDate);
            setEndDate(range.endDate);
            setIsFullDay(range.isFullDay);
            setStartTime(range.startTime || '08:00');
            setEndTime(range.endTime || '16:00');
        }
        setError('');
    }, [range, isOpen]);

    if (!isOpen || !range) return null;

    const handleSave = async () => {
        setError('');

        if (new Date(endDate) < new Date(startDate)) {
            setError('La fecha de fin no puede ser anterior a la fecha de inicio.');
            return;
        }
        if (!isFullDay && (!startTime || !endTime)) {
            setError('Debes especificar hora de inicio y fin para ausencias parciales.');
            return;
        }

        const reasonObj = manualAbsenceReasons.find(r => r.id === Number(motivoId));

        const newRange: LeaveRange = {
            ...range,
            motivoId: Number(motivoId),
            motivoDesc: reasonObj?.desc || range.motivoDesc,
            startDate,
            endDate,
            isFullDay,
            startTime: isFullDay ? undefined : startTime,
            endTime: isFullDay ? undefined : endTime
        };

        setIsLoading(true);
        try {
            await onSave(range, newRange);
            onClose();
        } catch (e: any) {
            setError(e.message || "Error al guardar cambios.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("¿Estás seguro de que quieres eliminar esta baja completa? Se borrarán todos los registros asociados.")) {
            return;
        }
        setIsLoading(true);
        try {
            await onDelete(range);
            onClose();
        } catch (e: any) {
            setError(e.message || "Error al eliminar.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Editar Ausencia / Baja</h2>
                        <p className="text-sm text-slate-500">{range.employeeName}</p>
                    </div>
                    <button onClick={onClose} disabled={isLoading} className="text-slate-500 hover:text-slate-800 text-2xl">&times;</button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Motivo</label>
                        <select
                            value={motivoId}
                            onChange={(e) => setMotivoId(Number(e.target.value))}
                            className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            disabled={loading}
                        >
                            {loading && <option>Cargando...</option>}
                            {manualAbsenceReasons.map(r => (
                                <option key={r.id} value={r.id}>{r.desc}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Desde</label>
                            <SmartDateInput
                                value={startDate}
                                onChange={setStartDate}
                                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Hasta</label>
                            <SmartDateInput
                                value={endDate}
                                onChange={setEndDate}
                                className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center mt-2">
                        <input
                            id="edit-full-day"
                            type="checkbox"
                            checked={isFullDay}
                            onChange={(e) => setIsFullDay(e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="edit-full-day" className="ml-2 block text-sm text-slate-900">
                            Jornada Completa
                        </label>
                    </div>

                    {!isFullDay && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded border border-slate-200">
                            <div>
                                <label className="block text-xs font-medium text-slate-700">Hora Inicio</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="mt-1 block w-full border-slate-300 rounded-md sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700">Hora Fin</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="mt-1 block w-full border-slate-300 rounded-md sm:text-sm"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-4 p-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex justify-between items-center">
                    <button
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-50 text-red-600 font-semibold rounded-md border border-red-200 hover:bg-red-100 transition-colors text-sm"
                    >
                        {isLoading ? 'Procesando...' : 'Eliminar Baja'}
                    </button>
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50 transition-colors text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors text-sm shadow-sm"
                        >
                            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditLeaveModal;
