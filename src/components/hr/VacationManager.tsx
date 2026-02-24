
import React, { useState, useMemo, useEffect } from 'react';
import { LeaveRange, User, Role } from '../../types';
import { groupRawDataToLeaves } from '../../services/leaveService';
import EditLeaveModal from './EditLeaveModal';
import { useNotification } from '../shared/NotificationContext';
import { SvgIcon } from '../shared/Nav';
import { toISODateLocal, parseISOToLocalDate } from '../../utils/localDate';
import { Operario, CalendarioDia } from '../../services/erpApi';
import { exportVacationManagementToXlsx } from '../../services/vacationManagementExportService';
import AdvancedEmployeeFilter from '../shared/AdvancedEmployeeFilter';
import { useHrLayout } from './HrLayout';
import { useFichajesMutations } from '../../hooks/useFichajes';
import EmployeeSelect from '../shared/EmployeeSelect';
import SmartDateInput from '../shared/SmartDateInput';

const DAYS_OF_WEEK = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const VacationManager: React.FC = () => {
    const {
        erpData,
        employeeOptions,
        selectedDepartment,
        setSelectedDepartment,
        selectedEmployeeIds,
        setSelectedEmployeeIds,
        computedDepartments,
        employeeCalendarsByDate,
        setEmployeeCalendarsByDate,
        isFetchingCalendars,
        startDate: globalStartDate
    } = useHrLayout();

    const { updateCalendar, editLeaveRange, deleteLeaveRange } = useFichajesMutations();
    const { showNotification } = useNotification();

    // Local State for month navigation
    // We initialize with globalStartDate if available to sync with portal
    const [currentDate, setCurrentDate] = useState(() => {
        if (globalStartDate) return parseISOToLocalDate(globalStartDate);
        return new Date();
    });

    const [createModalEmployee, setCreateModalEmployee] = useState<Operario | null>(null);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [rangeToEdit, setRangeToEdit] = useState<LeaveRange | null>(null);

    // --- DATA PROCESSING ---

    const employeesWithDepartments = useMemo(() => {
        return employeeOptions.map(emp => ({
            id: emp.id,
            name: emp.name,
            department: emp.department,
            role: Role.Employee // Simplified for UI
        }));
    }, [employeeOptions]);

    const departmentFilteredEmployees = useMemo(() => {
        if (selectedDepartment === 'all' || selectedDepartment === 'TODOS') return employeesWithDepartments;
        return employeesWithDepartments.filter(emp => emp.department === selectedDepartment);
    }, [employeesWithDepartments, selectedDepartment]);

    const filteredEmployees = useMemo(() => {
        if (selectedEmployeeIds.length === 0) return departmentFilteredEmployees;
        const idSet = new Set(selectedEmployeeIds.map(id => Number(id)));
        return departmentFilteredEmployees.filter(emp => idSet.has(emp.id));
    }, [departmentFilteredEmployees, selectedEmployeeIds]);

    // Get Vacation Ranges (Code 8 - Vacaciones Año Anterior)
    const vacationRanges = useMemo(() => {
        const allLeaves = groupRawDataToLeaves(erpData);
        return allLeaves.filter(l => l.motivoId === 8);
    }, [erpData]);

    const holidays = useMemo(() => {
        return new Set(erpData.filter(r => r.TipoDiaEmpresa === 1 || r.MotivoAusencia === 100).map(r => r.Fecha));
    }, [erpData]);

    // --- CALENDAR LOGIC ---

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    const monthDays = useMemo(() => {
        return Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
            return {
                dateObj: d,
                dateStr: toISODateLocal(d),
                dayNum: i + 1,
                dayOfWeek: d.getDay() // 0 = Sun
            };
        });
    }, [currentDate, daysInMonth]);

    const vacationMap = useMemo(() => {
        const map = new Map<string, LeaveRange>();
        const monthStart = monthDays[0].dateStr;
        const monthEnd = monthDays[monthDays.length - 1].dateStr;

        vacationRanges.forEach(range => {
            if (range.endDate < monthStart || range.startDate > monthEnd) return;

            let start = new Date(range.startDate < monthStart ? monthStart : range.startDate);
            const end = new Date(range.endDate > monthEnd ? monthEnd : range.endDate);
            const cur = new Date(start);
            while (cur <= end) {
                const dStr = toISODateLocal(cur);
                map.set(`${range.employeeId}-${dStr}`, range);
                cur.setDate(cur.getDate() + 1);
            }
        });
        return map;
    }, [vacationRanges, monthDays]);

    const getStatus = (employeeId: number, dateStr: string) => {
        // 1. Check global employee calendar from context
        const empCalendarMap = employeeCalendarsByDate.get(employeeId);
        if (empCalendarMap) {
            const dayInfo = empCalendarMap.get(dateStr);
            if (dayInfo && String(dayInfo.TipoDia) === '2') {
                return { type: 'vacation', source: 'calendar' };
            }
        }

        // 2. Fall back to punch-based vacation records
        const range = vacationMap.get(`${employeeId}-${dateStr}`);
        if (range) return { type: 'vacation', range, source: 'punch' };

        // 3. Check company holidays
        if (holidays.has(dateStr)) return { type: 'holiday' };

        return { type: 'available' };
    };

    // --- METRICS ---

    const staffingStats = useMemo(() => {
        return monthDays.map(day => {
            let available = 0;
            let onVacation = 0;

            filteredEmployees.forEach(emp => {
                const status = getStatus(emp.id, day.dateStr);
                if (status.type === 'vacation') onVacation++;
                else if (day.dayOfWeek !== 0 && day.dayOfWeek !== 6 && status.type !== 'holiday') available++;
            });

            const total = available + onVacation;
            const percentage = total > 0 ? (available / total) * 100 : 0;

            return { date: day.dateStr, available, onVacation, percentage };
        });
    }, [monthDays, filteredEmployees, vacationMap, holidays, employeeCalendarsByDate]);

    // KPI Cards Calculations
    const todayStr = toISODateLocal(new Date());
    const peopleOnVacationToday = staffingStats.find(s => s.date === todayStr)?.onVacation || 0;
    const criticalDaysCount = staffingStats.filter(s => s.percentage < 50 && new Date(s.date).getDay() !== 0 && new Date(s.date).getDay() !== 6).length;
    const displayedMonthPrefix = toISODateLocal(currentDate).slice(0, 7);
    const totalVacationDaysPlanned = vacationRanges.filter(r => r.startDate.startsWith(displayedMonthPrefix)).reduce((acc, curr) => {
        const start = new Date(curr.startDate);
        const end = new Date(curr.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
        return acc + days;
    }, 0);

    // --- HANDLERS ---

    const handleCreateVacation = async (leaveData: any, operario?: Operario | null) => {
        if (!operario) {
            showNotification('Debes seleccionar un empleado', 'error');
            return;
        }

        const start = new Date(leaveData.startDate);
        const end = leaveData.endDate ? new Date(leaveData.endDate) : new Date(leaveData.startDate);
        const dates: string[] = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(toISODateLocal(d));
        }

        try {
            showNotification(`Registrando ${dates.length} días de vacaciones...`, 'info');

            // Execute updates in parallel via mutation
            const promises = dates.map(date =>
                updateCalendar({
                    employeeId: operario.IDOperario.toString(),
                    date,
                    tipoDia: 2,
                    userName: "RRHH"
                })
            );

            await Promise.all(promises);

            setEmployeeCalendarsByDate(prev => {
                const next = new Map(prev);
                const employeeId = operario.IDOperario;
                const employeeMap = new Map(next.get(employeeId) || []);

                dates.forEach(date => {
                    const existing = employeeMap.get(date);
                    employeeMap.set(date, {
                        Fecha: date,
                        TipoDia: '2',
                        DescTipoDia: existing?.DescTipoDia || 'Vacaciones',
                        IDTipoTurno: existing?.IDTipoTurno ?? null,
                        DescTurno: existing?.DescTurno || '',
                        Duracion: existing?.Duracion || 0,
                        Inicio: existing?.Inicio,
                        Fin: existing?.Fin
                    } as CalendarioDia);
                });

                next.set(employeeId, employeeMap);
                return next;
            });

            showNotification(
                `Vacaciones registradas correctamente para ${operario.DescOperario}`,
                'success'
            );

            setIsCreateModalOpen(false);
            setCreateModalEmployee(null);
        } catch (e: any) {
            console.error('Error registrando vacaciones:', e);
            showNotification(`Error: ${e.message}`, 'error');
        }
    };

    const handleManagementExport = () => {
        if (filteredEmployees.length === 0) {
            showNotification("No hay datos para exportar", "warning");
            return;
        }
        showNotification("Generando Excel de Gestión...", "info");
        try {
            exportVacationManagementToXlsx(erpData, filteredEmployees as any, currentDate.getFullYear());
            showNotification("Gestión exportada correctamente", "success");
        } catch (error: any) {
            showNotification(`Error: ${error.message}`, "error");
        }
    };

    const handleExport = () => {
        if (filteredEmployees.length === 0) {
            showNotification("No hay datos para exportar", "warning");
            return;
        }

        let tableHTML = `<table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">`;
        tableHTML += `<thead style="background-color: #f3f4f6;"><tr>`;
        tableHTML += `<th style="padding: 10px; text-align: left; background-color: #e5e7eb;">Empleado</th>`;
        monthDays.forEach(day => {
            const bg = (day.dayOfWeek === 0 || day.dayOfWeek === 6) ? '#f3f4f6' : '#ffffff';
            tableHTML += `<th style="padding: 5px; text-align: center; background-color: ${bg}; font-size: 10px;">${day.dayNum}<br/>${DAYS_OF_WEEK[day.dayOfWeek]}</th>`;
        });
        tableHTML += `</tr></thead><tbody>`;

        filteredEmployees.forEach(emp => {
            tableHTML += `<tr>`;
            tableHTML += `<td style="padding: 8px; font-weight: bold; white-space: nowrap;">${emp.name}</td>`;
            monthDays.forEach(day => {
                const status = getStatus(emp.id, day.dateStr);
                let bg = '#ffffff';
                let text = '';
                if (status.type === 'vacation') { bg = '#bfdbfe'; text = 'VAC'; }
                else if (status.type === 'holiday') { bg = '#fecaca'; text = 'FES'; }
                else if (day.dayOfWeek === 0 || day.dayOfWeek === 6) { bg = '#f9fafb'; }
                tableHTML += `<td style="padding: 2px; text-align: center; background-color: ${bg}; font-size: 9px;">${text}</td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;

        const blob = new Blob([`\uFEFF${tableHTML}`], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Cuadrante_Vacaciones_${selectedDepartment}_${toISODateLocal(currentDate).slice(0, 7)}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">De Vacaciones Hoy</p>
                        <p className="text-2xl font-bold text-slate-800">{peopleOnVacationToday}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <SvgIcon type="vacations" className="h-6 w-6" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Días Críticos ({"<"}50%)</p>
                        <p className={`text-2xl font-bold ${criticalDaysCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{criticalDaysCount}</p>
                    </div>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${criticalDaysCount > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Total Días Planificados</p>
                        <p className="text-2xl font-bold text-slate-800">{totalVacationDaysPlanned}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Planificación de Vacaciones</h1>
                        <p className="text-sm text-slate-500">Gestión visual de capacidad y solicitudes.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
                            <button onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="p-2 hover:bg-white rounded-md shadow-sm transition-all text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                            <span className="w-40 text-center font-bold text-slate-700 select-none text-sm uppercase">
                                {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="p-2 hover:bg-white rounded-md shadow-sm transition-all text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                        </div>
                        <button onClick={handleManagementExport} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg font-semibold shadow-sm flex items-center gap-2 transition-colors text-sm">
                            <SvgIcon type="download" className="h-4 w-4" /> Exportar Gestión
                        </button>
                        <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-semibold shadow-sm flex items-center gap-2 transition-colors text-sm">
                            <SvgIcon type="download" className="h-4 w-4" /> Exportar Cuadrante
                        </button>
                        <button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-semibold shadow-sm flex items-center gap-2 transition-colors text-sm">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Registrar
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sección</label>
                        <select
                            value={selectedDepartment}
                            onChange={e => {
                                setSelectedDepartment(e.target.value);
                                setSelectedEmployeeIds([]);
                            }}
                            className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="all">Todas las secciones</option>
                            {computedDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empleado</label>
                        <AdvancedEmployeeFilter
                            allEmployees={employeesWithDepartments}
                            selectedEmployeeIds={selectedEmployeeIds}
                            onChange={setSelectedEmployeeIds}
                            visibleForSelectionEmployees={departmentFilteredEmployees}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
                {isFetchingCalendars && (
                    <div className="absolute inset-0 bg-white/50 z-40 flex items-center justify-center backdrop-blur-sm">
                        <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-lg border border-slate-100">
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent animate-spin rounded-full"></div>
                            <span className="text-sm font-semibold text-slate-700">Actualizando calendarios...</span>
                        </div>
                    </div>
                )}
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <div className="min-w-max">
                        <div className="flex border-b border-slate-200 sticky top-0 bg-slate-50 z-20 shadow-sm">
                            <div className="w-64 flex-shrink-0 p-3 font-bold text-slate-700 border-r border-slate-200 sticky left-0 bg-slate-50 z-30 flex items-center shadow-md">
                                <span className="text-sm">Empleado ({filteredEmployees.length})</span>
                            </div>
                            {monthDays.map(day => {
                                const isToday = day.dateStr === todayStr;
                                return (
                                    <div key={day.dateStr} className={`w-10 flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-100 ${day.dayOfWeek === 0 || day.dayOfWeek === 6 ? 'bg-slate-50/50' : 'bg-white'} ${isToday ? 'bg-blue-50 ring-2 ring-inset ring-blue-200' : ''}`}>
                                        <span className={`text-[9px] font-bold uppercase ${isToday ? 'text-blue-700' : 'text-slate-400'}`}>{DAYS_OF_WEEK[day.dayOfWeek]}</span>
                                        <span className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{day.dayNum}</span>
                                    </div>
                                )
                            })}
                        </div>

                        {filteredEmployees.length > 0 ? (
                            filteredEmployees.map(emp => (
                                <div key={emp.id} className="flex border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                    <div className="w-64 flex-shrink-0 p-2 pl-3 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 flex items-center justify-between shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        <div>
                                            <div className="font-semibold text-slate-800 text-sm truncate w-48">{emp.name}</div>
                                            <div className="text-[10px] text-slate-400">ID: {emp.id}</div>
                                        </div>
                                    </div>
                                    {monthDays.map(day => {
                                        const status = getStatus(emp.id, day.dateStr);
                                        const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                                        let bgClass = isWeekend ? "bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhYWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')] opacity-60" : "bg-white";

                                        let content = null;
                                        if (status.type === 'holiday') {
                                            content = <div className="w-full h-full flex items-center justify-center bg-red-50" title="Festivo"><div className="w-1.5 h-1.5 rounded-full bg-red-400"></div></div>;
                                        } else if (status.type === 'vacation') {
                                            content = (
                                                <div className="w-full h-8 my-auto bg-blue-500/90 hover:bg-blue-600 transition-colors cursor-pointer relative group/cell rounded-sm mx-0.5 shadow-sm"
                                                    onClick={() => { if (status.range) { setRangeToEdit(status.range); setIsEditModalOpen(true); } }}>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/cell:block px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">Vacaciones</div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={day.dateStr} className={`w-10 flex-shrink-0 border-r border-slate-100 h-10 flex items-center justify-center relative ${bgClass}`}>
                                                {content}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        ) : (
                            <div className="p-10 text-center text-slate-500">No hay empleados que coincidan con los filtros.</div>
                        )}

                        <div className="flex border-t border-slate-300 sticky bottom-0 bg-slate-50 z-20 shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.1)]">
                            <div className="w-64 flex-shrink-0 p-2 font-bold text-slate-700 border-r border-slate-200 sticky left-0 bg-slate-50 z-30 flex items-center text-xs"><span>Cobertura (%)</span></div>
                            {staffingStats.map((stat, idx) => {
                                const isCritical = stat.percentage < 50;
                                const isWeekend = monthDays[idx].dayOfWeek === 0 || monthDays[idx].dayOfWeek === 6;
                                return (
                                    <div key={stat.date} className={`w-10 flex-shrink-0 border-r border-slate-200 p-1 flex flex-col justify-end items-center h-12 ${isCritical && !isWeekend ? 'bg-red-50' : ''}`}>
                                        {!isWeekend && (
                                            <div className="w-full flex flex-col items-center gap-0.5">
                                                <div className="w-1.5 bg-slate-200 h-6 rounded-full overflow-hidden relative">
                                                    <div className={`absolute bottom-0 left-0 w-full transition-all duration-500 ${isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ height: `${stat.percentage}%` }}></div>
                                                </div>
                                                <span className={`text-[9px] font-bold ${isCritical ? 'text-red-600' : 'text-slate-500'}`}>{Math.round(stat.percentage)}%</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <div className="p-3 bg-white border-t border-slate-200 flex gap-4 text-xs text-slate-600 justify-end">
                    <div className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-sm mr-2"></span> Vacaciones</div>
                    <div className="flex items-center"><span className="w-3 h-3 bg-red-50 border border-red-100 flex items-center justify-center mr-2"><span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span></span> Festivo</div>
                    <div className="flex items-center"><span className="w-3 h-3 bg-slate-100 border border-slate-200 mr-2"></span> Fin de Semana</div>
                </div>
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4">Registrar Vacaciones</h2>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            if (!createModalEmployee) return;
                            handleCreateVacation({
                                startDate: fd.get('startDate'),
                                endDate: fd.get('endDate')
                            }, createModalEmployee);
                        }}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Empleado</label>
                                    <EmployeeSelect
                                        value={createModalEmployee?.IDOperario}
                                        onChange={setCreateModalEmployee}
                                        includeInactive={false}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium">Desde</label>
                                        <SmartDateInput name="startDate" className="w-full border rounded p-2" required defaultValue={toISODateLocal(new Date())} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Hasta</label>
                                        <SmartDateInput name="endDate" className="w-full border rounded p-2" />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 border rounded">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <EditLeaveModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                range={rangeToEdit}
                onSave={async (oldR, newR) => {
                    await editLeaveRange(oldR, newR, "RRHH");
                    showNotification("Vacaciones actualizadas", 'success');
                    setIsEditModalOpen(false);
                }}
                onDelete={async (range) => {
                    await deleteLeaveRange({ range, userName: "RRHH" });
                    showNotification("Vacaciones eliminadas", 'success');
                    setIsEditModalOpen(false);
                }}
            />
        </div>
    );
};

export default VacationManager;
