
import React, { useState, useMemo } from 'react';
import { IncidentLogEntry } from '../../types';

interface IncidentHistoryPanelProps {
    incidentLog: IncidentLogEntry[];
    onDelete?: (id: string) => void;
}

const IncidentHistoryPanel: React.FC<IncidentHistoryPanelProps> = ({ incidentLog, onDelete }) => {
    const [filterDate, setFilterDate] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterType, setFilterType] = useState('all');

    // Tipos únicos de la lista actual
    const uniqueTypes = useMemo(() => {
        const types = new Set(incidentLog.map(i => i.type));
        return Array.from(types);
    }, [incidentLog]);

    // Empleados únicos para filtro
    const uniqueEmployees = useMemo(() => {
        const map = new Map<number, string>();
        incidentLog.forEach(i => {
            if (!map.has(i.employeeId)) {
                // Format: [ID] Name
                const formattedName = `[${i.employeeId.toString().padStart(3, '0')}] ${i.employeeName}`;
                map.set(i.employeeId, formattedName);
            }
        });
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [incidentLog]);

    // Filtrado
    const filteredLog = useMemo(() => {
        return incidentLog.filter(entry => {
            // Filtro por fecha afectada
            if (filterDate && entry.dates !== filterDate) return false;
            // Filtro por empleado
            if (filterEmployee && entry.employeeId !== parseInt(filterEmployee, 10)) return false;
            // Filtro por tipo
            if (filterType !== 'all' && entry.type !== filterType) return false;
            return true;
        });
    }, [incidentLog, filterDate, filterEmployee, filterType]);

    // Agrupado por fecha de registro (día)
    const groupedByDate = useMemo(() => {
        const groups = new Map<string, IncidentLogEntry[]>();

        filteredLog.forEach(entry => {
            // Extraer solo la fecha del timestamp (asumimos formato "DD/MM/YYYY, HH:MM:SS" o similar)
            const datePart = entry.timestamp?.split(',')[0] || entry.timestamp?.split(' ')[0] || 'Fecha Desconocida';
            if (!groups.has(datePart)) {
                groups.set(datePart, []);
            }
            groups.get(datePart)!.push(entry);
        });

        // Ordenar por fecha descendente (más recientes primero)
        const sorted = Array.from(groups.entries()).sort((a, b) => {
            // Convertir a fecha para comparar
            const parseDate = (str: string) => {
                const parts = str.split('/');
                if (parts.length === 3) {
                    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
                return new Date(str);
            };
            return parseDate(b[0]).getTime() - parseDate(a[0]).getTime();
        });

        return sorted;
    }, [filteredLog]);

    // Estadísticas
    const stats = useMemo(() => ({
        total: incidentLog.length,
        filtrados: filteredLog.length,
        diasUnicos: new Set(incidentLog.map(i => i.dates)).size
    }), [incidentLog, filteredLog]);

    const clearFilters = () => {
        setFilterDate('');
        setFilterEmployee('');
        setFilterType('all');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">📋 Historial de Incidencias</h2>
                        <p className="text-sm text-slate-500">Registro de todas las incidencias justificadas en la aplicación</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="text-center px-4 py-2 bg-blue-50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
                            <p className="text-xs text-blue-600">Total</p>
                        </div>
                        <div className="text-center px-4 py-2 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-700">{stats.diasUnicos}</p>
                            <p className="text-xs text-green-600">Días afectados</p>
                        </div>
                    </div>
                </div>

                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Afectada</label>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
                        <select
                            value={filterEmployee}
                            onChange={e => setFilterEmployee(e.target.value)}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        >
                            <option value="">Todos</option>
                            {uniqueEmployees.map(([id, name]) => (
                                <option key={id} value={id}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        >
                            <option value="all">Todos</option>
                            {uniqueTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={clearFilters}
                            className="w-full px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                            Limpiar Filtros
                        </button>
                    </div>
                </div>
            </div>

            {/* Lista agrupada por día */}
            {filteredLog.length === 0 ? (
                <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
                    <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-slate-600">No hay incidencias registradas</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        {incidentLog.length > 0
                            ? 'Prueba a modificar los filtros'
                            : 'Las incidencias aparecerán aquí cuando las registres'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groupedByDate.map(([date, entries]) => (
                        <div key={date} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Cabecera del grupo (día) */}
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">📅</span>
                                    <h3 className="font-semibold text-slate-700">Registrado el {date}</h3>
                                </div>
                                <span className="text-sm font-medium text-slate-500 bg-white px-2 py-1 rounded">
                                    {entries.length} incidencia{entries.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Tabla de incidencias del día */}
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Hora</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Empleado</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Motivo</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha Afectada</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Origen</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {entries.map(entry => {
                                            const timePart = entry.timestamp?.split(',')[1]?.trim() || entry.timestamp?.split(' ')[1] || '--:--';
                                            return (
                                                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                                                        <span className="font-mono">{timePart}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
                                                        {`[${entry.employeeId.toString().padStart(3, '0')}] ${entry.employeeName}`}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${entry.type.includes('Gap') ? 'bg-amber-100 text-amber-800' :
                                                            entry.type.includes('Ausencia') ? 'bg-red-100 text-red-800' :
                                                                'bg-blue-100 text-blue-800'
                                                            }`}>
                                                            {entry.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">
                                                        {entry.reason}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                                                        {entry.dates}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`text-xs px-2 py-0.5 rounded ${entry.source === 'Registrar Incidencia'
                                                            ? 'bg-purple-50 text-purple-700'
                                                            : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {entry.source}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => onDelete && onDelete(String(entry.id))}
                                                            className="text-red-600 hover:text-red-900 transition-colors p-1 rounded hover:bg-red-50"
                                                            title="Eliminar registro del historial"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IncidentHistoryPanel;
