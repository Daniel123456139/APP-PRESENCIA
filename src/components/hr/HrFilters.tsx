import React from 'react';
import AdvancedEmployeeFilter from '../shared/AdvancedEmployeeFilter';
import { Role } from '../../types';

export interface EmployeeOption {
    id: number;
    name: string;
    role: Role; // Using Role type from types.ts
    department: string;
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

    return (
        <div className="lg:col-span-3 space-y-3 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700">Filtros Globales</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700">Desde</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => {
                                setStartDate(e.target.value);
                                setTimeout(() => {
                                    const endInput = document.getElementById('endDateInput') as HTMLInputElement | null;
                                    if (endInput) {
                                        if ('showPicker' in endInput) {
                                            (endInput as any).showPicker();
                                        } else {
                                            endInput.focus();
                                        }
                                    }
                                }, 100);
                            }}
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                    <div className="w-24">
                        <label className="block text-sm font-medium text-slate-700">&nbsp;</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700">Hasta</label>
                        <input
                            id="endDateInput"
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                    <div className="w-24">
                        <label className="block text-sm font-medium text-slate-700">&nbsp;</label>
                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700">Sección</label>
                    <select
                        value={selectedDepartment}
                        onChange={e => {
                            setSelectedDepartment(e.target.value);
                            setSelectedEmployeeIds([]);
                        }}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                        <option value="all">Todas las secciones</option>
                        {computedDepartments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Filtrar Empleados</label>
                    <AdvancedEmployeeFilter
                        allEmployees={employeeOptions as any}
                        selectedEmployeeIds={selectedEmployeeIds}
                        onChange={setSelectedEmployeeIds}
                        visibleForSelectionEmployees={departmentFilteredEmployees as any}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700">Turno</label>
                    <select
                        value={turno}
                        onChange={e => setTurno(e.target.value)}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
