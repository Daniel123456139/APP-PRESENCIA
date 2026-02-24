import React from 'react';
import AdvancedEmployeeFilter from '../shared/AdvancedEmployeeFilter';
import SmartDateInput from '../shared/SmartDateInput';
import { Role } from '../../types';
import { toISODateLocal } from '../../utils/localDate';

export interface EmployeeOption {
    id: number;
    name: string;
    role: Role; // Using Role type from types.ts
    department: string;
    flexible?: boolean;
}

interface HrFiltersProps {
    startDate: string;
    setStartDate: (val: string) => void;
    endDate: string;
    setEndDate: (val: string) => void;
    startTime: string;
    setStartTime: (val: string) => void;
    endTime: string;
    setEndTime: (val: string) => void;
    selectedDepartment: string;
    setSelectedDepartment: (val: string) => void;
    selectedEmployeeIds: string[];
    setSelectedEmployeeIds: (ids: string[]) => void;
    turno: string;
    setTurno: (val: string) => void;
    employeeOptions: EmployeeOption[];
    computedDepartments: string[];
    departmentFilteredEmployees: EmployeeOption[];
}

const HrFilters: React.FC<HrFiltersProps> = ({
    startDate, setStartDate,
    endDate, setEndDate,
    startTime, setStartTime,
    endTime, setEndTime,
    selectedDepartment, setSelectedDepartment,
    selectedEmployeeIds, setSelectedEmployeeIds,
    turno, setTurno,
    employeeOptions,
    computedDepartments,
    departmentFilteredEmployees
}) => {
    // --- Shortcuts Helpers ---
    const handleMonthShortcut = (type: 'current' | 'last' | 'year') => {
        const now = new Date();
        let start: Date;
        let end: Date;

        if (type === 'current') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (type === 'last') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        } else {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
        }

        const s = toISODateLocal(start);
        const e = toISODateLocal(end);

        setStartDate(s);
        setEndDate(e);
    };

    const handleDayShortcut = (type: 'today' | 'yesterday') => {
        const now = new Date();
        let target = now;
        if (type === 'yesterday') {
            target = new Date(now);
            target.setDate(now.getDate() - 1);
        }
        const iso = toISODateLocal(target);
        setStartDate(iso);
        setEndDate(iso);
    };

    // --- Direct Handlers (No Local State Debounce) ---
    // UX improvement: When start date changes, strict validation is handled by the data hook,
    // but here we ensure immediate UI reflection.

    return (
        <div className="lg:col-span-3 space-y-4 p-5 bg-white/90 rounded-2xl shadow-lg border border-slate-200/70 backdrop-blur">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-indigo-500 to-sky-400" />
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Filtros Globales</h3>
                        <p className="text-xs text-slate-500">Rango, sección y personal a analizar</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
                <button onClick={() => handleDayShortcut('today')} className="px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-md bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-all border border-slate-200">Hoy</button>
                <button onClick={() => handleDayShortcut('yesterday')} className="px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-md bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-all border border-slate-200">Ayer</button>
                <div className="w-px h-4 bg-slate-200 mx-1 self-center" />
                <button onClick={() => handleMonthShortcut('current')} className="px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 italic">Este Mes</button>
                <button onClick={() => handleMonthShortcut('last')} className="px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 italic">Mes Anterior</button>
                <button onClick={() => handleMonthShortcut('year')} className="px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-md bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-all border border-slate-200">Este Año</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label htmlFor="startDateInput" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Desde</label>
                        <div className="mt-1">
                            <SmartDateInput id="startDateInput" value={startDate} onChange={setStartDate} showHint />
                        </div>
                    </div>
                    <div className="w-24">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">&nbsp;</label>
                        <input
                            type="time"
                            value={startTime}
                            onChange={e => setStartTime(e.target.value)}
                            className="mt-1 block w-full rounded-lg border-slate-200 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1">
                        <label htmlFor="endDateInput" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Hasta</label>
                        <div className="mt-1">
                            <SmartDateInput id="endDateInput" value={endDate} onChange={setEndDate} />
                        </div>
                    </div>
                    <div className="w-24">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">&nbsp;</label>
                        <input
                            type="time"
                            value={endTime}
                            onChange={e => setEndTime(e.target.value)}
                            className="mt-1 block w-full rounded-lg border-slate-200 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                        />
                    </div>
                </div>

                <div className="flex flex-col">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Sección</label>
                    <select
                        value={selectedDepartment}
                        onChange={e => {
                            setSelectedDepartment(e.target.value);
                            setSelectedEmployeeIds([]);
                        }}
                        className="mt-1 block w-full rounded-lg border-slate-200 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    >
                        <option value="all">Todas las secciones</option>
                        {computedDepartments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtrar Empleados</label>
                    <AdvancedEmployeeFilter
                        allEmployees={employeeOptions as any}
                        selectedEmployeeIds={selectedEmployeeIds}
                        onChange={setSelectedEmployeeIds}
                        visibleForSelectionEmployees={departmentFilteredEmployees as any}
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Turno</label>
                    <select
                        value={turno}
                        onChange={e => setTurno(e.target.value)}
                        className="mt-1 block w-full rounded-lg border-slate-200 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    >
                        <option value="all">Todos los turnos</option>
                        <option value="M">Mañana</option>
                        <option value="TN">Tarde</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default HrFilters;
