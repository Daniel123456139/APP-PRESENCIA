/**
 * TABLA INTERACTIVA DE EMPLEADOS
 * 
 * Funcionalidades:
 * - Filas colapsables/expandibles por empleado
 * - Subtabla con detalle de trabajos (OF/Artículo)
 * - Ordenamiento por columnas
 * - Filtros (empleado, sección, tipo urgente/no urgente)
 * - Código de colores (verde urgente, rojo no urgente)
 */

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, SortAsc, SortDesc } from 'lucide-react';
import { EmployeePriorityAnalysis, WorkClassification } from '../../types';
import { formatHours } from '../../services/priorityAnalysisService';
import { format } from 'date-fns';

interface PriorityEmployeeTableProps {
    employeeData: EmployeePriorityAnalysis[];
}

type SortColumn = 'name' | 'horasNoUrgentes' | 'cumplimiento';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'urgent' | 'non_urgent';

const PriorityEmployeeTable: React.FC<PriorityEmployeeTableProps> = ({ employeeData }) => {
    // Estados
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [sortColumn, setSortColumn] = useState<SortColumn>('horasNoUrgentes');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Toggle expansión de fila
    const toggleRow = (employeeId: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(employeeId)) {
            newExpanded.delete(employeeId);
        } else {
            newExpanded.add(employeeId);
        }
        setExpandedRows(newExpanded);
    };

    // Handler de ordenamiento
    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    // Datos filtrados y ordenados
    const filteredAndSortedData = useMemo(() => {
        let filtered = employeeData;

        // Filtrar por búsqueda
        if (searchTerm) {
            filtered = filtered.filter(emp =>
                emp.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filtrar por tipo
        if (filterType === 'urgent') {
            filtered = filtered.filter(emp => emp.trabajosUrgentes > 0);
        } else if (filterType === 'non_urgent') {
            filtered = filtered.filter(emp => emp.trabajosNoUrgentes > 0);
        }

        // Ordenar
        const sorted = [...filtered].sort((a, b) => {
            let compareA: number | string = 0;
            let compareB: number | string = 0;

            switch (sortColumn) {
                case 'name':
                    compareA = a.employeeName.toLowerCase();
                    compareB = b.employeeName.toLowerCase();
                    break;
                case 'horasNoUrgentes':
                    compareA = a.horasNoUrgentes;
                    compareB = b.horasNoUrgentes;
                    break;
                case 'cumplimiento':
                    compareA = a.cumplimiento;
                    compareB = b.cumplimiento;
                    break;
            }

            if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
            if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [employeeData, searchTerm, filterType, sortColumn, sortDirection]);

    const missingOFRows = useMemo(() => {
        const allRows: WorkClassification[] = [];
        employeeData.forEach(emp => {
            emp.trabajosDetalle.forEach(work => {
                if (work.missingOF) {
                    allRows.push(work);
                }
            });
        });

        let filtered = allRows;
        if (searchTerm) {
            filtered = filtered.filter(work =>
                work.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filterType === 'urgent') {
            filtered = filtered.filter(work => work.urgency === 'URGENTE');
        } else if (filterType === 'non_urgent') {
            filtered = filtered.filter(work => work.urgency === 'NO_URGENTE');
        }

        return filtered;
    }, [employeeData, searchTerm, filterType]);

    // Renderizar icono de ordenamiento
    const renderSortIcon = (column: SortColumn) => {
        if (sortColumn !== column) {
            return <div className="w-4 h-4" />;
        }
        return sortDirection === 'asc' ? (
            <SortAsc className="w-4 h-4 text-violet-600" />
        ) : (
            <SortDesc className="w-4 h-4 text-violet-600" />
        );
    };

    return (
        <>
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
                    <div className="w-3 h-8 bg-gradient-to-b from-violet-600 to-indigo-600 rounded-full" />
                    Detalle por Empleado
                </h2>

                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-4">
                    {/* Buscador */}
                    <div className="flex-1 min-w-[250px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar empleado..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                    </div>

                    {/* Filtro por tipo */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filterType === 'all'
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterType('urgent')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filterType === 'urgent'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            Urgentes
                        </button>
                        <button
                            onClick={() => setFilterType('non_urgent')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filterType === 'non_urgent'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            NO Urgentes
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left w-12"></th>
                            <th
                                className="px-6 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => handleSort('name')}
                            >
                                <div className="flex items-center gap-2">
                                    Empleado
                                    {renderSortIcon('name')}
                                </div>
                            </th>
                            <th className="px-6 py-3 text-center font-semibold text-slate-700">
                                Trab. Urgentes
                            </th>
                            <th className="px-6 py-3 text-center font-semibold text-slate-700">
                                Horas Urgentes
                            </th>
                            <th
                                className="px-6 py-3 text-center font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => handleSort('horasNoUrgentes')}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    Trab. NO Urgentes
                                    {renderSortIcon('horasNoUrgentes')}
                                </div>
                            </th>
                            <th className="px-6 py-3 text-center font-semibold text-slate-700">
                                Horas NO Urgentes
                            </th>
                            <th
                                className="px-6 py-3 text-center font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => handleSort('cumplimiento')}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    % Cumplimiento
                                    {renderSortIcon('cumplimiento')}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedData.map((employee) => (
                            <React.Fragment key={employee.employeeId}>
                                {/* Fila Principal */}
                                <tr
                                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                                    onClick={() => toggleRow(employee.employeeId)}
                                >
                                    <td className="px-6 py-4">
                                        {expandedRows.has(employee.employeeId) ? (
                                            <ChevronDown className="w-5 h-5 text-violet-600" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-slate-800">
                                        {employee.employeeName}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                            🟢 {employee.trabajosUrgentes}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-green-700 font-semibold">
                                        {formatHours(employee.horasUrgentes)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                                            🔴 {employee.trabajosNoUrgentes}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-red-700 font-semibold">
                                        {formatHours(employee.horasNoUrgentes)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span
                                            className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${employee.cumplimiento >= 50
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                }`}
                                        >
                                            {employee.cumplimiento.toFixed(0)}%
                                        </span>
                                    </td>
                                </tr>

                                {/* Subtabla Expandible */}
                                {expandedRows.has(employee.employeeId) && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-4 bg-slate-50">
                                            <div className="ml-12">
                                                <h4 className="text-sm font-bold text-slate-700 mb-3">
                                                    Detalle de Trabajos
                                                </h4>
                                                <table className="w-full text-sm">
                                                    <thead className="border-b border-slate-200">
                                                        <tr className="text-left text-xs text-slate-600 uppercase">
                                                            <th className="pb-2 pr-4">OF/Artículo</th>
                                                            <th className="pb-2 pr-4">Descripción</th>
                                                            <th className="pb-2 pr-4">Cliente</th>
                                                            <th className="pb-2 pr-4">Fecha Entrega</th>
                                                            <th className="pb-2 pr-4 text-center">Días hasta Entrega</th>
                                                            <th className="pb-2 pr-4 text-center">Horas Dedicadas</th>
                                                            <th className="pb-2 pr-4 text-center">Estado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {employee.trabajosDetalle.map((work, idx) => (
                                                            <tr
                                                                key={idx}
                                                                className={`border-b border-slate-100 ${work.urgency === 'URGENTE'
                                                                        ? 'bg-green-50'
                                                                        : 'bg-red-50'
                                                                    }`}
                                                            >
                                                                <td className="py-2 pr-4 font-mono text-xs">
                                                                    {work.of ? `${work.of} / ${work.articleId}` : work.articleId}
                                                                </td>
                                                                <td className="py-2 pr-4">{work.descripcion}</td>
                                                                <td className="py-2 pr-4">{work.cliente}</td>
                                                                <td className="py-2 pr-4">
                                                                    {work.fechaRequerida
                                                                        ? format(work.fechaRequerida, 'dd/MM/yyyy')
                                                                        : 'Sin fecha'}
                                                                </td>
                                                                <td className="py-2 pr-4 text-center">
                                                                    {work.diasHastaEntrega !== null
                                                                        ? `${work.diasHastaEntrega} días`
                                                                        : 'N/A'}
                                                                </td>
                                                                <td className="py-2 pr-4 text-center font-semibold">
                                                                    {formatHours(work.horasDedicadas)}
                                                                </td>
                                                                <td className="py-2 pr-4 text-center">
                                                                    <span
                                                                        className={`inline-block px-2 py-1 rounded text-xs font-bold ${work.urgency === 'URGENTE'
                                                                                ? 'bg-green-200 text-green-800'
                                                                                : 'bg-red-200 text-red-800'
                                                                            }`}
                                                                    >
                                                                        {work.urgency === 'URGENTE'
                                                                            ? '🟢 URGENTE'
                                                                            : '🔴 NO URGENTE'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}

                        {filteredAndSortedData.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    No se encontraron empleados con los filtros aplicados
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Info */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl">
                <p className="text-sm text-slate-600">
                    Mostrando <strong>{filteredAndSortedData.length}</strong> de <strong>{employeeData.length}</strong> empleados
                </p>
            </div>
            </div>

            {missingOFRows.length > 0 && (
                <div className="mt-8 bg-white rounded-2xl shadow-lg border border-slate-200">
                    <div className="p-6 border-b border-slate-200">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                            <div className="w-3 h-8 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full" />
                            Trabajos sin OF
                        </h2>
                        <p className="text-sm text-slate-600">
                            Artículos imputados sin número de OF. Se incluyen en el análisis, pero se listan aparte.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr className="text-left text-xs text-slate-600 uppercase">
                                    <th className="px-6 py-3">Empleado</th>
                                    <th className="px-6 py-3">Artículo</th>
                                    <th className="px-6 py-3">Sección</th>
                                    <th className="px-6 py-3">Descripción</th>
                                    <th className="px-6 py-3">Cliente</th>
                                    <th className="px-6 py-3">Fecha Entrega</th>
                                    <th className="px-6 py-3 text-center">Días hasta Entrega</th>
                                    <th className="px-6 py-3 text-center">Horas</th>
                                    <th className="px-6 py-3 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {missingOFRows.map((work, idx) => (
                                    <tr
                                        key={`${work.employeeId}-${work.articleId}-${idx}`}
                                        className={`border-b border-slate-100 ${work.urgency === 'URGENTE'
                                                ? 'bg-green-50'
                                                : 'bg-red-50'
                                            }`}
                                    >
                                        <td className="px-6 py-3 font-semibold text-slate-800">
                                            {work.employeeName}
                                        </td>
                                        <td className="px-6 py-3 font-mono text-xs">
                                            {work.articleId}
                                        </td>
                                        <td className="px-6 py-3">{work.department}</td>
                                        <td className="px-6 py-3">{work.descripcion}</td>
                                        <td className="px-6 py-3">{work.cliente}</td>
                                        <td className="px-6 py-3">
                                            {work.fechaRequerida
                                                ? format(work.fechaRequerida, 'dd/MM/yyyy')
                                                : 'Sin fecha'}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {work.diasHastaEntrega !== null
                                                ? `${work.diasHastaEntrega} días`
                                                : 'N/A'}
                                        </td>
                                        <td className="px-6 py-3 text-center font-semibold">
                                            {formatHours(work.horasDedicadas)}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <span
                                                className={`inline-block px-2 py-1 rounded text-xs font-bold ${work.urgency === 'URGENTE'
                                                        ? 'bg-green-200 text-green-800'
                                                        : 'bg-red-200 text-red-800'
                                                    }`}
                                            >
                                                {work.urgency === 'URGENTE'
                                                    ? '🟢 URGENTE'
                                                    : '🔴 NO URGENTE'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl">
                        <p className="text-sm text-slate-600">
                            Total trabajos sin OF: <strong>{missingOFRows.length}</strong>
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export default PriorityEmployeeTable;
