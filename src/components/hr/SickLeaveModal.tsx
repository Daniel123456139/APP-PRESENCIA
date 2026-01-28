
import React, { useState, useEffect } from 'react';
import { SickLeave } from '../../types';
import { toISODateLocal } from '../../utils/localDate';
import EmployeeSelect from '../shared/EmployeeSelect';
import { Operario } from '../../services/erpApi';

interface SickLeaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (leave: Omit<SickLeave, 'id' | 'operarioName'> & { id?: number }, operario?: Operario) => void;
    leaveToEdit: SickLeave | null;
    initialValues?: Partial<SickLeave>;
    employeeOptions: { id: number; name: string }[]; // Keeping for backward compatibility or if needed, though unused for select now
}

const SickLeaveModal: React.FC<SickLeaveModalProps> = ({ isOpen, onClose, onSave, leaveToEdit, initialValues }) => {
    const [selectedOperario, setSelectedOperario] = useState<Operario | null>(null);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [type, setType] = useState<'ITEC' | 'ITAT'>('ITEC');
    const [status, setStatus] = useState<'Activa' | 'Cerrada'>('Activa');
    const [motivo, setMotivo] = useState('');
    const [fechaRevision, setFechaRevision] = useState('');
    const [bcc, setBcc] = useState<number | ''>('');
    const [startTime, setStartTime] = useState('');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (leaveToEdit) {
            // validating that we can't easily set the operator object if we only have the ID from leaveToEdit
            // ideally we would load it, but for editing usually the ID is fixed and we might just show it read-only
            // or we rely on the component to fetch it if we pass the ID as value.
            // EmployeeSelect takes `value` as ID.
            // But we need the object for saving? Only for NEW records.
            setSelectedOperario({ IDOperario: leaveToEdit.employeeId, DescOperario: leaveToEdit.operarioName || '', Activo: true } as Operario);
            setStartDate(leaveToEdit.startDate);
            setEndDate(leaveToEdit.endDate || '');
            setType(leaveToEdit.type);
            setStatus(leaveToEdit.status);
            setMotivo(leaveToEdit.motivo || '');
            setFechaRevision(leaveToEdit.fechaRevision || '');
            setBcc(leaveToEdit.bcc || '');
            setStartTime(''); // Editing start time for existing leaves not fully supported yet in this simple view
        } else if (initialValues) {
            // Pre-fill for Extension or other cases
            if (initialValues.employeeId) {
                // If we have name too, great. If not, EmployeeSelect might show ID or fetch.
                setSelectedOperario({
                    IDOperario: initialValues.employeeId,
                    DescOperario: initialValues.operarioName || '',
                    Activo: true
                } as Operario);
            } else {
                setSelectedOperario(null);
            }
            setStartDate(initialValues.startDate || toISODateLocal(new Date()));
            setEndDate(initialValues.endDate || '');
            setType(initialValues.type || 'ITEC');
            setStatus(initialValues.status || 'Activa');
            setMotivo(initialValues.motivo || '');
            setFechaRevision(initialValues.fechaRevision || '');
            setBcc(initialValues.bcc || '');
            setStartTime('');
        } else {
            setSelectedOperario(null);
            setStartDate(toISODateLocal(new Date()));
            setEndDate('');
            setType('ITEC');
            setStatus('Activa');
            setMotivo('');
            setFechaRevision('');
            setBcc('');
            setStartTime('');
        }
        setError('');
    }, [leaveToEdit, isOpen, initialValues]);

    if (!isOpen) {
        return null;
    }

    const handleSave = () => {
        if (!selectedOperario || !startDate || !type || !status) {
            setError('Empleado, Fecha de Inicio, Tipo y Estado son obligatorios.');
            return;
        }

        const newLeaveData = {
            id: leaveToEdit?.id,
            employeeId: selectedOperario.IDOperario,
            startDate,
            endDate: endDate || null,
            type,
            status,
            motivo,
            fechaRevision: fechaRevision || null,
            bcc: typeof bcc === 'number' ? bcc : undefined,
            startTime: startTime || undefined
        };
        onSave(newLeaveData, selectedOperario);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg transform transition-all border border-slate-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">{leaveToEdit ? 'Editar Baja' : 'Registrar Nueva Baja'}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">&times;</button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
                        <EmployeeSelect
                            value={selectedOperario?.IDOperario}
                            onChange={(op) => setSelectedOperario(op)}
                            disabled={!!leaveToEdit}
                            includeInactive={true} // Allow searching inactive employees for historical entries or new leaves
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">Fecha de Inicio</label>
                            <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-slate-700">Fecha de Fin (Opcional)</label>
                            <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="type" className="block text-sm font-medium text-slate-700">Tipo de Baja</label>
                            <select id="type" value={type} onChange={e => setType(e.target.value as 'ITEC' | 'ITAT')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option value="ITEC">ITEC (Enfermedad Común)</option>
                                <option value="ITAT">ITAT (Accidente de Trabajo)</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-slate-700">Estado</label>
                            <select id="status" value={status} onChange={e => setStatus(e.target.value as 'Activa' | 'Cerrada')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option value="Activa">Activa</option>
                                <option value="Cerrada">Cerrada</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="motivo" className="block text-sm font-medium text-slate-700">Motivo de la Baja</label>
                        <input type="text" id="motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="fechaRevision" className="block text-sm font-medium text-slate-700">Próx. Revisión (Opcional)</label>
                            <input type="date" id="fechaRevision" value={fechaRevision} onChange={e => setFechaRevision(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="bcc" className="block text-sm font-medium text-slate-700">Base Cotización (€)</label>
                            <input type="number" step="0.01" id="bcc" value={bcc} onChange={e => setBcc(parseFloat(e.target.value) || '')} className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="startTime" className="block text-sm font-medium text-slate-700">Hora de Inicio (Solo necesario p/ días parciales)</label>
                        <p className="text-xs text-slate-500 mb-1">Si el empleado trabajó parte del día, indique a qué hora se fue (ej: 12:00). Deje en blanco para día completo.</p>
                        <input
                            type="time"
                            id="startTime"
                            value={startTime}
                            onChange={e => setStartTime(e.target.value)}
                            className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>

                </div>

                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-5 py-2 bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300">
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SickLeaveModal;
