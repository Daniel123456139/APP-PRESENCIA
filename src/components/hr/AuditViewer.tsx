
import React, { useState, useEffect, useMemo } from 'react';
import { AuditService, AuditEvent } from '../../services/AuditService';
import EmployeeAuditTimeline from '../shared/EmployeeAuditTimeline';
import { User } from '../../types';
import { SvgIcon } from '../shared/Nav';

interface AuditViewerProps {
    employees: User[];
}

const AuditViewer: React.FC<AuditViewerProps> = ({ employees }) => {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    
    // Cargar eventos y suscribirse a cambios
    useEffect(() => {
        setEvents(AuditService.getAllEvents());
        
        const unsubscribe = AuditService.subscribe((newEvent) => {
            setEvents(prev => [newEvent, ...prev]);
        });
        
        return () => unsubscribe();
    }, []);

    const filteredEvents = useMemo(() => {
        return events.filter(e => {
            const matchesEmp = selectedEmployeeId === 'all' || 
                               String(e.employeeId) === selectedEmployeeId || 
                               String(e.actorId) === selectedEmployeeId;
            
            const matchesType = filterType === 'all' || e.status === filterType;
            
            return matchesEmp && matchesType;
        });
    }, [events, selectedEmployeeId, filterType]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <span className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                            </span>
                            Auditoría del Sistema
                        </h2>
                        <p className="text-slate-500 mt-1">Trazabilidad completa de acciones y sincronizaciones.</p>
                    </div>
                    <button 
                        onClick={() => { if(confirm('¿Borrar historial local?')) { AuditService.clear(); setEvents([]); } }}
                        className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center px-3 py-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <SvgIcon type="clear" className="mr-2" />
                        Purgar Registros
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Filtrar por Empleado</label>
                        <select 
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="all">Todos los eventos</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Estado de la Acción</label>
                        <select 
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="all">Todos</option>
                            <option value="success">Exitosos</option>
                            <option value="error">Errores</option>
                            <option value="pending">Pendientes (Cola)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
                <EmployeeAuditTimeline events={filteredEvents} />
            </div>
        </div>
    );
};

export default AuditViewer;
