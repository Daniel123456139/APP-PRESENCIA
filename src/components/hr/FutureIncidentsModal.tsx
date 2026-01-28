import React, { useState, useMemo, useEffect, useRef } from 'react';
import { EmployeeOption } from './IncidentManager';

interface FutureIncidentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: EmployeeOption[];
    motivos: { id: number; desc: string }[];
    onSave: (data: { employeeId: number; employeeName: string; startDate: string; endDate: string; reasonId: number; reasonDesc: string }) => void;
}

const FutureIncidentsModal: React.FC<FutureIncidentsModalProps> = ({ isOpen, onClose, employees, motivos, onSave }) => {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reasonId, setReasonId] = useState(motivos[0]?.id || 2);

    const searchContainerRef = useRef<HTMLDivElement>(null);

    const today = new Date().toISOString().split('T')[0];

    // Filtrar empleados según término de búsqueda
    const filteredEmployees = useMemo(() => {
        if (!searchTerm) return employees;

        const lowerSearch = searchTerm.toLowerCase();
        return employees.filter(emp => {
            const idStr = emp.id.toString().padStart(3, '0');
            const nameStr = emp.name.toLowerCase();
            return idStr.includes(lowerSearch) || nameStr.includes(lowerSearch);
        });
    }, [employees, searchTerm]);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Actualizar reasonId cuando cambien los motivos
    useEffect(() => {
        if (motivos.length > 0 && !motivos.find(m => m.id === reasonId)) {
            setReasonId(motivos[0].id);
        }
    }, [motivos, reasonId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedEmployeeId) {
            alert('Por favor, seleccione un empleado.');
            return;
        }

        if (!startDate || !endDate) {
            alert('Por favor, complete todos los campos requeridos.');
            return;
        }

        if (startDate < today) {
            alert('La fecha de inicio debe ser igual o posterior a hoy.');
            return;
        }

        if (endDate < startDate) {
            alert('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
            return;
        }

        const employee = employees.find(e => e.id.toString() === selectedEmployeeId);
        if (!employee) return;

        const reason = motivos.find(r => r.id === reasonId);
        if (!reason) {
            alert('Por favor, seleccione un motivo válido.');
            return;
        }

        onSave({
            employeeId: employee.id,
            employeeName: employee.name,
            startDate,
            endDate,
            reasonId: reason.id,
            reasonDesc: reason.desc
        });

        // Reset form
        setSelectedEmployeeId('');
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        setReasonId(motivos[0]?.id || 2);
        onClose();
    };

    const handleClose = () => {
        setSelectedEmployeeId('');
        setSearchTerm('');
        setIsDropdownOpen(false);
        setStartDate('');
        setEndDate('');
        setReasonId(motivos[0]?.id || 2);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
                    <h2 className="text-2xl font-bold text-red-700 flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Registrar Incidencias Futuras
                    </h2>
                    <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-blue-800">
                            <strong>Nota:</strong> Esta funcionalidad permite registrar ausencias planificadas para fechas futuras (vacaciones aprobadas, citas médicas programadas, etc.).
                        </p>
                    </div>

                    {/* Búsqueda de Empleado Mejorada */}
                    <div ref={searchContainerRef} className="relative">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Empleado <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar por ID o nombre..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                className="w-full rounded-md border-slate-300 shadow-sm focus:border-red-500 focus:ring-red-500 pl-10 pr-4 py-2"
                            />
                            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {selectedEmployeeId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedEmployeeId('');
                                        setSearchTerm('');
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Dropdown de Resultados */}
                        {isDropdownOpen && searchTerm && filteredEmployees.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filteredEmployees.map(emp => (
                                    <button
                                        key={emp.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedEmployeeId(emp.id.toString());
                                            setSearchTerm(`[${emp.id.toString().padStart(3, '0')}] ${emp.name}`);
                                            setIsDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-red-50 transition-colors border-b border-slate-100 last:border-0"
                                    >
                                        <span className="font-mono text-xs font-semibold text-red-600">
                                            [{emp.id.toString().padStart(3, '0')}]
                                        </span>
                                        {' '}
                                        <span className="text-slate-800">{emp.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Sin resultados */}
                        {isDropdownOpen && searchTerm && filteredEmployees.length === 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg p-4 text-center text-slate-500 text-sm">
                                No se encontraron empleados con "{searchTerm}"
                            </div>
                        )}

                        {/* Indicador de selección */}
                        {selectedEmployeeId && !isDropdownOpen && (
                            <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Empleado seleccionado
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Fecha Inicio <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                min={today}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full rounded-md border-slate-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Fecha Fin <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate || today}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full rounded-md border-slate-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Motivo <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={reasonId}
                            onChange={(e) => setReasonId(parseInt(e.target.value, 10))}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                            required
                        >
                            {motivos.length === 0 ? (
                                <option value="">Cargando motivos...</option>
                            ) : (
                                motivos.map(reason => (
                                    <option key={reason.id} value={reason.id}>
                                        {reason.desc}
                                    </option>
                                ))
                            )}
                        </select>
                        {motivos.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600">
                                Cargando motivos de ausencia del servidor...
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedEmployeeId || motivos.length === 0}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                            Registrar Incidencia Futura
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FutureIncidentsModal;
