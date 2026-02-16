import React, { useState, useMemo } from 'react';
import { useHrLayout } from './HrLayout';
import {
    Calendar,
    User,
    Trash2,
    Search,
    CheckCircle,
    Clock,
    AlertCircle,
    Filter,
    History
} from 'lucide-react';
import { IncidentLogEntry } from '../../types';
import SmartDateInput from '../shared/SmartDateInput';

interface IncidentHistoryPanelProps {
    incidentLog: IncidentLogEntry[];
    onDelete: (id: string) => void;
}

const IncidentHistoryPanel: React.FC<IncidentHistoryPanelProps> = ({ incidentLog, onDelete }) => {
    const { employeeOptions } = useHrLayout();

    const [filterDate, setFilterDate] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterType, setFilterType] = useState('all');

    const uniqueTypes = useMemo(() => {
        const types = new Set(incidentLog.map(entry => entry.type));
        return Array.from(types);
    }, [incidentLog]);

    const filteredLog = useMemo(() => {
        return incidentLog
            .filter(entry => {
                if (filterDate && entry.dates !== filterDate) return false;
                if (filterEmployee && entry.employeeId !== parseInt(filterEmployee, 10)) return false;
                if (filterType !== 'all' && entry.type !== filterType) return false;
                return true;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [incidentLog, filterDate, filterEmployee, filterType]);

    const groupedLogs = useMemo(() => {
        const groups: Record<string, IncidentLogEntry[]> = {};
        filteredLog.forEach(log => {
            const date = log.dates || 'Sin fecha';
            if (!groups[date]) groups[date] = [];
            groups[date].push(log);
        });
        return groups;
    }, [filteredLog]);

    const sortedDates = useMemo(() => {
        return Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));
    }, [groupedLogs]);

    const getEmployeeName = (id: number, fallback?: string) => {
        const emp = employeeOptions.find(e => e.id === id);
        return emp ? emp.name : (fallback || `Operario ${id}`);
    };

    const getTypeIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'incidencia':
                return <CheckCircle className="text-green-500" size={18} />;
            case 'ajuste':
                return <Clock className="text-blue-500" size={18} />;
            case 'error':
                return <AlertCircle className="text-red-500" size={18} />;
            default:
                return <AlertCircle className="text-slate-400" size={18} />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Historial de Incidencias</h2>
                    <p className="text-slate-500">Registro de acciones realizadas en el portal</p>
                </div>
                <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border border-slate-200">
                    <History className="text-blue-500" size={20} />
                    <span className="font-semibold text-slate-700">{incidentLog.length}</span>
                    <span className="text-slate-500 text-sm">Registros totales</span>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-2 mb-4 text-slate-700 font-medium">
                    <Filter size={18} />
                    <span>Filtros de busqueda</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase px-1">Fecha Afectada</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <SmartDateInput
                                value={filterDate}
                                onChange={setFilterDate}
                                className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase px-1">Operario</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select
                                value={filterEmployee}
                                onChange={(e) => setFilterEmployee(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 appearance-none"
                            >
                                <option value="">Todos los empleados</option>
                                {employeeOptions.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase px-1">Tipo Accion</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 appearance-none"
                            >
                                <option value="all">Todos los tipos</option>
                                {uniqueTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {sortedDates.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 border-dashed p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <History size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">No hay registros</h3>
                        <p className="text-slate-500 mt-1">No se encontraron incidencias que coincidan con los filtros aplicados.</p>
                        {(filterDate || filterEmployee || filterType !== 'all') && (
                            <button
                                onClick={() => { setFilterDate(''); setFilterEmployee(''); setFilterType('all'); }}
                                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    sortedDates.map(date => (
                        <div key={date} className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <div className="h-px flex-1 bg-slate-200"></div>
                                <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                    {date}
                                </span>
                                <div className="h-px flex-1 bg-slate-200"></div>
                            </div>

                            <div className="space-y-2">
                                {groupedLogs[date].map(entry => (
                                    <div key={entry.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">{getTypeIcon(entry.type)}</div>
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-slate-800">
                                                        {getEmployeeName(entry.employeeId, entry.employeeName)}
                                                        <span className="text-xs text-slate-400 ml-2">{entry.type}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {entry.reason}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                            {entry.source}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => onDelete(String(entry.id))}
                                                className="text-red-600 hover:text-red-900 transition-colors p-2 rounded hover:bg-red-50"
                                                title="Eliminar registro del historial"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default IncidentHistoryPanel;
