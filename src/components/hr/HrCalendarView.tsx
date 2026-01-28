
import React, { useState, useMemo, useCallback } from 'react';
import { RawDataRow, Role, User, CompanyHoliday } from '../../types';
import { CalendarioDia, getCalendarioEmpresa, getCalendarioOperario } from '../../services/erpApi';
import { DEPARTMENTS } from '../../constants';
// MOCK_USERS usage removed
import AdvancedEmployeeFilter from '../shared/AdvancedEmployeeFilter';
import CalendarEventModal from './CalendarEventModal';
import ConfirmationModal from '../shared/ConfirmationModal';
import ValidationErrorsModal from '../shared/ValidationErrorsModal';
import { validateNewIncidents, ValidationIssue } from '../../services/validationService';
import { toISODateLocal } from '../../utils/localDate';
import { useEffect } from 'react';

const INCIDENT_COLORS: { [key: number]: string } = {
    2: 'bg-green-100 border-green-300 text-green-800',
    7: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    8: 'bg-blue-100 border-blue-300 text-blue-800',
    13: 'bg-purple-100 border-purple-300 text-purple-800',
    100: 'bg-red-100 border-red-300 text-red-800', // Festivo
    101: 'bg-orange-100 border-orange-300 text-orange-800', // Puente/Cierre
    102: 'bg-indigo-100 border-indigo-300 text-indigo-800', // Jornada Especial
};

interface HrCalendarViewProps {
    erpData: RawDataRow[];
    setErpData: React.Dispatch<React.SetStateAction<RawDataRow[]>>;
    allEmployees: User[];
    companyHolidays: CompanyHoliday[];
    companyCalendarDays?: CalendarioDia[];
    selectedEmployeeIds: string[];
    setSelectedEmployeeIds: (ids: string[]) => void;
    selectedDepartment: string;
    setSelectedDepartment: (dept: string) => void;
    departments: string[];
}

const HrCalendarView: React.FC<HrCalendarViewProps> = ({
    erpData, setErpData, allEmployees, companyHolidays, companyCalendarDays,
    selectedEmployeeIds, setSelectedEmployeeIds,
    selectedDepartment, setSelectedDepartment,
    departments
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'employees' | 'company'>('company');

    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [modalDate, setModalDate] = useState<Date | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
    const [confirmMessage, setConfirmMessage] = useState('');

    // Validation
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [pendingRows, setPendingRows] = useState<RawDataRow[] | null>(null);

    const [localCalendarDays, setLocalCalendarDays] = useState<CalendarioDia[]>(companyCalendarDays || []);

    useEffect(() => {
        const fetchMonthCalendar = async () => {
            const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            try {
                let data: CalendarioDia[] = [];
                // If exactly one employee is selected, fetch their specific calendar
                if (selectedEmployeeIds.length === 1) {
                    data = await getCalendarioOperario(selectedEmployeeIds[0], toISODateLocal(firstDay), toISODateLocal(lastDay));
                } else {
                    // Otherwise fetch general company calendar
                    data = await getCalendarioEmpresa(toISODateLocal(firstDay), toISODateLocal(lastDay));
                }
                setLocalCalendarDays(data);
            } catch (error) {
                console.error("Error fetching month calendar:", error);
            }
        };

        fetchMonthCalendar();
    }, [currentDate, selectedEmployeeIds]);

    const employeeOptions = useMemo(() => allEmployees.filter(u => u.role !== Role.HR), [allEmployees]);

    const departmentFilteredEmployees = useMemo(() => {
        if (selectedDepartment === 'all') {
            return employeeOptions;
        }
        return employeeOptions.filter(emp => emp.department === selectedDepartment);
    }, [selectedDepartment, employeeOptions]);

    const visibleEmployees: User[] = useMemo(() => {
        if (selectedEmployeeIds.length > 0) {
            const numericIds = new Set(selectedEmployeeIds.map(id => parseInt(id, 10)));
            return employeeOptions.filter(emp => numericIds.has(emp.id));
        }
        if (selectedDepartment !== 'all') {
            return departmentFilteredEmployees;
        }
        return employeeOptions;
    }, [selectedEmployeeIds, selectedDepartment, departmentFilteredEmployees, employeeOptions]);

    const allIncidents = useMemo(() => {
        if (viewMode === 'company') {
            // Use localCalendarDays (fetched for this specific month)
            if (localCalendarDays && localCalendarDays.length > 0) {
                return localCalendarDays.flatMap(day => {
                    const items: RawDataRow[] = [];
                    // 1. Festivo
                    if (day.TipoDia === "1") {
                        items.push({
                            DescDepartamento: 'Empresa', IDOperario: 0, DescOperario: 'Empresa', Fecha: day.Fecha, Hora: '00:00',
                            Entrada: 0, MotivoAusencia: 100, DescMotivoAusencia: day.DescTipoDia || 'Festivo', Computable: 'No',
                            IDTipoTurno: day.IDTipoTurno, Inicio: '', Fin: '', TipoDiaEmpresa: 1, TurnoTexto: day.DescTurno || 'Festivo',
                        } as any);
                    }
                    // 2. Puente/Cierre (Duracion 0 o Turno null, pero NO Festivo)
                    else if (day.Duracion === 0 || day.IDTipoTurno === null) {
                        items.push({
                            DescDepartamento: 'Empresa', IDOperario: 0, DescOperario: 'Empresa', Fecha: day.Fecha, Hora: '00:00',
                            Entrada: 0, MotivoAusencia: 101, DescMotivoAusencia: 'Cierre/Puente', Computable: 'No',
                            IDTipoTurno: day.IDTipoTurno, Inicio: '', Fin: '', TipoDiaEmpresa: 0, TurnoTexto: day.DescTurno || 'Cierre',
                        } as any);
                    }
                    // 3. Jornada Especial (Duracion < 8 and > 0, and not festivo)
                    else if (day.Duracion > 0 && day.Duracion < 8) {
                        items.push({
                            DescDepartamento: 'Empresa', IDOperario: 0, DescOperario: 'Empresa', Fecha: day.Fecha, Hora: '00:00',
                            Entrada: 0, MotivoAusencia: 102, DescMotivoAusencia: `Jornada ${day.Duracion}h`, Computable: 'No',
                            IDTipoTurno: day.IDTipoTurno, Inicio: '', Fin: '', TipoDiaEmpresa: 0, TurnoTexto: day.DescTurno || 'Especial',
                        } as any);
                    }
                    return items;
                });
            }

            return companyHolidays.map(h => ({
                DescDepartamento: 'Empresa', IDOperario: 0, DescOperario: 'Empresa', Fecha: h.date, Hora: '00:00',
                Entrada: 0, MotivoAusencia: 100, DescMotivoAusencia: h.description || 'Festivo', Computable: 'No',
                IDTipoTurno: null, Inicio: '', Fin: '', TipoDiaEmpresa: 1, TurnoTexto: 'Festivo',
            }));
        }
        return erpData.filter(row => row.MotivoAusencia !== 1 && row.MotivoAusencia !== 14 && row.Entrada !== 1);
    }, [erpData, viewMode, companyHolidays, companyCalendarDays]);

    const filteredIncidents = useMemo(() => {
        if (viewMode === 'company' || selectedEmployeeIds.length === 0) {
            return allIncidents;
        }
        const numericIds = new Set(selectedEmployeeIds.map(id => parseInt(id, 10)));
        return allIncidents.filter(inc => numericIds.has(inc.IDOperario));
    }, [allIncidents, selectedEmployeeIds, viewMode]);

    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startDay = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => { const newDate = new Date(prev); newDate.setMonth(newDate.getMonth() + offset); return newDate; });
    };

    const handleSelectAllInDepartment = () => {
        const allIds = departmentFilteredEmployees.map(emp => String(emp.id));
        setSelectedEmployeeIds(allIds);
    };

    const handleDayClick = (day: number) => {
        if (viewMode === 'employees' && visibleEmployees.length === 0) {
            alert("Por favor, selecciona al menos un empleado en los filtros para añadir una ausencia.");
            return;
        }
        setModalDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
        setIsEventModalOpen(true);
    };

    const executeSave = (newRows: RawDataRow[]) => {
        setErpData(prev => [...prev, ...newRows]);
        setIsConfirmModalOpen(false);
        setPendingRows(null);
        setIsValidationModalOpen(false);
    };

    const handleSaveEvent = useCallback((reason: { id: number; desc: string }) => {
        if (!modalDate) return;

        const newRows: RawDataRow[] = [];
        const dateStr = toISODateLocal(modalDate);

        if (viewMode === 'company') {
            newRows.push({
                DescDepartamento: 'Empresa', IDOperario: 0, DescOperario: 'Empresa', Fecha: dateStr, Hora: '00:00:00',
                Entrada: 0, MotivoAusencia: 100, DescMotivoAusencia: 'Festivo', Computable: 'No',
                IDTipoTurno: null, Inicio: '', Fin: '', TipoDiaEmpresa: 1, TurnoTexto: 'Festivo',
            });
        } else {
            visibleEmployees.forEach(emp => {
                newRows.push({
                    DescDepartamento: emp.department || 'General',
                    IDOperario: emp.id, DescOperario: emp.name, Fecha: dateStr, Hora: '00:00:00',
                    Entrada: 0, MotivoAusencia: reason.id, DescMotivoAusencia: reason.desc, Computable: 'Sí',
                    IDTipoTurno: null, Inicio: '', Fin: '', TipoDiaEmpresa: 0, TurnoTexto: reason.desc,
                });
            });
        }

        // VALIDAR
        if (viewMode !== 'company') {
            const issues = validateNewIncidents(erpData, newRows);
            if (issues.length > 0) {
                setValidationIssues(issues);
                setPendingRows(newRows);
                setIsValidationModalOpen(true);
                setIsEventModalOpen(false);
                return;
            }
        }

        prepareConfirmation(newRows, reason.desc);
        setIsEventModalOpen(false);

    }, [modalDate, visibleEmployees, viewMode, erpData]);

    const prepareConfirmation = (rows: RawDataRow[], reasonDesc: string) => {
        let confirmMsg = `Vas a registrar '${reasonDesc}' el ${rows[0].Fecha}.`;
        if (viewMode === 'employees') {
            confirmMsg += `\n\nEsta acción se aplicará a ${rows.length} empleado(s).`;
        }
        setConfirmMessage(confirmMsg);
        setConfirmAction(() => () => executeSave(rows));
        setIsConfirmModalOpen(true);
    };

    const handleContinueDespiteWarning = () => {
        if (pendingRows) {
            // Re-construct basic desc from first row for message
            prepareConfirmation(pendingRows, pendingRows[0].DescMotivoAusencia);
            setIsValidationModalOpen(false);
        }
    };

    const renderIncidentsForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return filteredIncidents
            .filter(inc => inc.Fecha === dateStr)
            .map(inc => (
                <div key={`${inc.IDOperario}-${inc.Fecha}-${inc.Hora}`} className={`text-xs p-1 rounded mt-1 truncate border ${INCIDENT_COLORS[inc.MotivoAusencia] || 'bg-slate-200 border-slate-400 text-slate-700'}`} title={viewMode === 'company' ? inc.DescMotivoAusencia : `${inc.DescOperario}: ${inc.DescMotivoAusencia}`}>
                    {viewMode === 'company'
                        ? <span className="font-semibold">{inc.DescMotivoAusencia}</span>
                        : <><span className="font-semibold block sm:inline">{inc.DescOperario.split(' ')[0]}:</span> {inc.DescMotivoAusencia}</>
                    }
                </div>
            ));
    };

    return (
        <>
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
                {/* Header & Filters */}
                <div className="flex flex-col lg:flex-row justify-between lg:items-start mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            Calendario Global
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {selectedEmployeeIds.length > 0
                                ? `${selectedEmployeeIds.length} empleado(s) seleccionado(s)`
                                : 'Vista general de la empresa'}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sección</label>
                            <select
                                value={selectedDepartment}
                                onChange={e => {
                                    setSelectedDepartment(e.target.value);
                                    setSelectedEmployeeIds([]);
                                }}
                                className="w-full sm:w-auto block pl-3 pr-10 py-2.5 text-sm border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg shadow-sm"
                            >
                                <option value="all">Todas las secciones</option>
                                {departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                            </select>
                        </div>
                        <div className="w-full sm:w-64">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empleado(s)</label>
                            <AdvancedEmployeeFilter
                                allEmployees={employeeOptions}
                                visibleForSelectionEmployees={departmentFilteredEmployees}
                                selectedEmployeeIds={selectedEmployeeIds}
                                onChange={setSelectedEmployeeIds}
                            />
                        </div>
                    </div>
                </div>

                {/* Navigation Bar */}
                <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-100 shadow-sm border border-blue-300 transition-all flex items-center gap-2 font-semibold"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Anterior
                    </button>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800">{currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</h2>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 font-medium"
                        >
                            Ir a Hoy
                        </button>
                    </div>
                    <button
                        onClick={() => changeMonth(1)}
                        className="px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-100 shadow-sm border border-blue-300 transition-all flex items-center gap-2 font-semibold"
                    >
                        Siguiente
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center font-semibold text-slate-600">
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => <div key={day} className="py-2 text-xs sm:text-base">{day}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} className="border border-slate-200 rounded-md bg-slate-50 min-h-[90px] sm:min-h-[120px]"></div>)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                        const isHoliday = localCalendarDays?.find(d => d.Fecha === dateStr)?.TipoDia === "1";

                        return (
                            <div
                                key={day}
                                onClick={() => handleDayClick(day)}
                                className={`border-2 rounded-lg p-2 sm:p-3 min-h-[100px] sm:min-h-[130px] transition-all cursor-pointer relative ${isToday
                                    ? 'bg-blue-50 hover:bg-blue-100 border-blue-400 shadow-md ring-2 ring-blue-200'
                                    : isHoliday
                                        ? 'bg-red-50 hover:bg-red-100 border-red-300'
                                        : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-300'
                                    }`}
                                title={isToday ? '📍 Hoy' : isHoliday ? '🎉 Festivo' : `Día ${day}`}
                            >
                                <div className={`font-bold text-sm sm:text-lg flex items-center gap-1 ${isToday ? 'text-blue-700' : isHoliday ? 'text-red-700' : 'text-slate-600'}`}>
                                    {isToday && <span className="text-base">📍</span>}
                                    {isHoliday && <span className="text-base">🎉</span>}
                                    {day}
                                </div>
                                <div className="overflow-y-auto max-h-20 sm:max-h-24">{renderIncidentsForDay(day)}</div>
                            </div>
                        );
                    })}
                </div>
                {/* Sticky Legend */}
                <div className="sticky bottom-0 mt-6 bg-white border-t-2 border-slate-200 pt-4 pb-2 shadow-inner">
                    <div className="flex flex-wrap gap-x-6 gap-y-3 items-center justify-center">
                        <p className="font-bold text-sm text-slate-700">
                            Leyenda:
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-red-50 border-2 border-red-300"></span>
                            <span className="text-sm font-medium text-slate-700">Festivo</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-orange-50 border-2 border-orange-300"></span>
                            <span className="text-sm font-medium text-slate-700">Puente/Cierre</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-indigo-50 border-2 border-indigo-300"></span>
                            <span className="text-sm font-medium text-slate-700">Jornada Especial</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-blue-50 border-2 border-blue-400"></span>
                            <span className="text-sm font-medium text-slate-700">Día Actual (Hoy)</span>
                        </div>
                    </div>
                </div>
            </div>
            {isEventModalOpen && (
                <CalendarEventModal
                    isOpen={isEventModalOpen}
                    onClose={() => setIsEventModalOpen(false)}
                    onSave={handleSaveEvent}
                    date={modalDate}
                    viewMode={viewMode}
                />
            )}

            <ValidationErrorsModal
                isOpen={isValidationModalOpen}
                onClose={() => setIsValidationModalOpen(false)}
                issues={validationIssues}
                onContinue={handleContinueDespiteWarning}
            />

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={() => confirmAction?.()}
                title="Confirmar Registro de Ausencia"
            >
                <div className="text-sm whitespace-pre-wrap">{confirmMessage}</div>
            </ConfirmationModal>
        </>
    );
};

export default HrCalendarView;
