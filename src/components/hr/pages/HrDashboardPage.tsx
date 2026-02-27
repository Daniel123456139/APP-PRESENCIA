import React from 'react';
import { useMemo, useState } from 'react';
import { useHrLayout } from '../HrLayout';
import { toISODateLocal } from '../../../utils/localDate';
import { normalizeDateKey } from '../../../utils/datetime';
import HrFilters from '../HrFilters';
import HrActionPanel from '../HrActionPanel';
import EmployeeDetailDashboard from '../EmployeeDetailDashboard';
import HrDataTableVirtual from '../HrDataTableVirtual';
import HrDataTable from '../HrDataTable';
import AusenciasTable from '../AusenciasTable';
import VacationsTable from '../VacationsTable';
import ActiveBajasTable from '../ActiveBajasTable';
import ExportNominasModal from '../ExportNominasModal';
import ExportPeriodModal from '../ExportPeriodModal';
import { useOperarios } from '../../../hooks/useErp';

const HrDashboardPage: React.FC = () => {
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportMonth, setExportMonth] = useState('');
    const [isVacExportModalOpen, setIsVacExportModalOpen] = useState(false);
    const [vacExportMonth, setVacExportMonth] = useState('');
    const [isHLExportModalOpen, setIsHLExportModalOpen] = useState(false);
    const [hlExportMonth, setHlExportMonth] = useState('');
    const { operarios } = useOperarios(false);
    const {
        startDate, setStartDate,
        endDate, setEndDate,
        startTime, setStartTime,
        endTime, setEndTime,
        selectedDepartment, setSelectedDepartment,
        selectedEmployeeIds, setSelectedEmployeeIds,
        turno, setTurno,
        employeeOptions,
        missingFirebaseEmployees,
        registeringEmployeeIds,
        registerMissingEmployee,
        computedDepartments,
        departmentFilteredEmployees,

        reloadFromServer,
        isReloading,
        handleExport,
        incidentManagerRef,
        handleOpenLateArrivals,
        handleOpenAdjustmentModal,
        handleExportResumen,
        lastUpdated,
        isRefetching,

        selectedEmployeeData,
        shifts,
        companyHolidaySet,
        companyHolidays,

        shouldUseVirtualization,
        processedData,
        datasetResumen,
        erpData,
        handleIncidentClick,
        handleAbsenceIncidentClick,
        handleOpenManualIncident,
        isLongRange,
        handleUnproductivityExport,

        effectiveCalendarDays,
        isLoading,
        employeeCalendarsByDate
    } = useHrLayout();

    // Periodo de nómina: del 26 del mes anterior al 25 del mes seleccionado
    // Ejemplo: "febrero 2026" → 26/01/2026 → 25/02/2026
    const getFullMonthRange = (dateStr: string) => {
        const base = new Date(`${dateStr}T00:00:00`);
        const year = base.getFullYear();
        const month = base.getMonth(); // 0-indexed

        // Inicio: día 26 del mes anterior
        const start = new Date(year, month - 1, 26);
        // Fin: día 25 del mes seleccionado (incluido)
        const end = new Date(year, month, 25);

        return {
            startDate: toISODateLocal(start),
            endDate: toISODateLocal(end)
        };
    };

    const handleExportRequest = () => {
        const defaultMonth = startDate.slice(0, 7);
        setExportMonth(defaultMonth);
        setIsExportModalOpen(true);
    };
    const handleExportFullMonth = () => {
        const monthSource = exportMonth ? `${exportMonth}-01` : startDate;
        const range = getFullMonthRange(monthSource);
        handleExport(range);
        setIsExportModalOpen(false);
    };
    const handleExportSelectedPeriod = () => {
        handleExport({ startDate, endDate });
        setIsExportModalOpen(false);
    };

    // --- Handlers para Exportación Vacaciones por Sección ---
    const handleVacExportRequest = () => {
        setVacExportMonth(startDate.slice(0, 7));
        setIsVacExportModalOpen(true);
    };
    const handleVacExportFullMonth = async () => {
        const monthSource = vacExportMonth ? `${vacExportMonth}-01` : startDate;
        const range = getFullMonthRange(monthSource);
        setIsVacExportModalOpen(false);
        try {
            const svc = await import('../../../services/exports/vacationBySectionExportService');
            await svc.generateVacationBySectionExport(range.startDate, range.endDate, operarios);
        } catch (err: any) {
            window.alert(`Error al generar listado de vacaciones:\n${err.message || 'Error desconocido'}`);
        }
    };
    const handleVacExportSelectedPeriod = async () => {
        setIsVacExportModalOpen(false);
        try {
            const svc = await import('../../../services/exports/vacationBySectionExportService');
            await svc.generateVacationBySectionExport(startDate, endDate, operarios);
        } catch (err: any) {
            window.alert(`Error al generar listado de vacaciones:\n${err.message || 'Error desconocido'}`);
        }
    };

    // --- Handlers para Exportación Horas Libres por Sección ---
    const handleHLExportRequest = () => {
        setHlExportMonth(startDate.slice(0, 7));
        setIsHLExportModalOpen(true);
    };
    const handleHLExportFullMonth = async () => {
        const monthSource = hlExportMonth ? `${hlExportMonth}-01` : startDate;
        const range = getFullMonthRange(monthSource);
        setIsHLExportModalOpen(false);
        try {
            const svc = await import('../../../services/exports/freeHoursBySectionExportService');
            await svc.generateFreeHoursBySectionExport(range.startDate, range.endDate, operarios);
        } catch (err: any) {
            window.alert(`Error al generar listado de horas libres:\n${err.message || 'Error desconocido'}`);
        }
    };
    const handleHLExportSelectedPeriod = async () => {
        setIsHLExportModalOpen(false);
        try {
            const svc = await import('../../../services/exports/freeHoursBySectionExportService');
            await svc.generateFreeHoursBySectionExport(startDate, endDate, operarios);
        } catch (err: any) {
            window.alert(`Error al generar listado de horas libres:\n${err.message || 'Error desconocido'}`);
        }
    };

    const handleRegisterEmployee = async (employeeId: number) => {
        try {
            await registerMissingEmployee(employeeId);
        } catch {
            // Error ya gestionado en servicio/hook
        }
    };

    const flexibleEmployeeIds = useMemo(() => {
        return new Set((employeeOptions as Array<{ id: number; flexible?: boolean }>).filter(emp => emp.flexible).map(emp => emp.id));
    }, [employeeOptions]);

    const matchesTurno = (turnoAsignado: string): boolean => {
        if (turno === 'all') return true;
        const normalized = (turnoAsignado || '').trim().toUpperCase();
        if (turno === 'TN') return normalized === 'TN' || normalized === 'T';
        if (turno === 'M') return normalized === 'M';
        return normalized === turno;
    };

    // Check if we are viewing a single day matches Type 1 (Festive/Saturday)
    const isDayType1 = useMemo(() => {
        if (startDate !== endDate) return false;

        // 1. Try to find in effectiveCalendarDays logic
        // Note: effectiveCalendarDays might be per employee, but usually it's the specific calendar loaded.
        // Actually typically distinct days. 
        if (effectiveCalendarDays && effectiveCalendarDays.length > 0) {
            const dayRecord = effectiveCalendarDays.find(d => d.Fecha === startDate);
            if (dayRecord) {
                // Check loose equality as API sometimes sends "1" or 1
                return String(dayRecord.TipoDia) === "1";
            }
        }

        // 2. Fallback: Check if Saturday (Day 6)
        // Note: Sundays are usually Type 1 too but user specifically mentioned Saturdays logic.
        const d = new Date(startDate);
        return d.getDay() === 6;
    }, [startDate, endDate, effectiveCalendarDays]);

    const isSingleDay = startDate === endDate;

    const leaveWorkConflicts = useMemo(() => {
        const vacationByEmployee = new Map<number, Set<string>>();
        const sickLeaveByEmployee = new Map<number, Set<string>>();
        const workByEmployee = new Map<number, Set<string>>();
        const sickLeaveActivityByEmployee = new Map<number, Map<string, { normalPunchCount: number; hasNonSickIncidence: boolean }>>();
        const nameByEmployee = new Map<number, string>();

        const ensureDateSet = (target: Map<number, Set<string>>, employeeId: number): Set<string> => {
            let set = target.get(employeeId);
            if (!set) {
                set = new Set<string>();
                target.set(employeeId, set);
            }
            return set;
        };

        const normalizeMotivo = (value: unknown): number | null => {
            if (value === null || value === undefined || value === '') return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };

        const ensureSickDayActivity = (employeeId: number, dateKey: string) => {
            let byDate = sickLeaveActivityByEmployee.get(employeeId);
            if (!byDate) {
                byDate = new Map<string, { normalPunchCount: number; hasNonSickIncidence: boolean }>();
                sickLeaveActivityByEmployee.set(employeeId, byDate);
            }

            let stats = byDate.get(dateKey);
            if (!stats) {
                stats = { normalPunchCount: 0, hasNonSickIncidence: false };
                byDate.set(dateKey, stats);
            }

            return stats;
        };

        employeeOptions.forEach(emp => {
            nameByEmployee.set(emp.id, emp.name);
        });

        employeeCalendarsByDate?.forEach((dateMap, employeeId) => {
            dateMap.forEach((day, rawDate) => {
                const dateKey = normalizeDateKey(rawDate || day.Fecha);
                if (!dateKey || dateKey < startDate || dateKey > endDate) return;
                if (String(day.TipoDia) !== '2') return;
                ensureDateSet(vacationByEmployee, employeeId).add(dateKey);
            });
        });

        erpData.forEach(row => {
            const employeeId = Number(row.IDOperario);
            const dateKey = normalizeDateKey(row.Fecha);
            if (!Number.isFinite(employeeId) || !dateKey || dateKey < startDate || dateKey > endDate) return;

            if (row.DescOperario && !nameByEmployee.has(employeeId)) {
                nameByEmployee.set(employeeId, row.DescOperario);
            }

            if (Number(row.TipoDiaEmpresa) === 2) {
                ensureDateSet(vacationByEmployee, employeeId).add(dateKey);
            }

            const motivo = normalizeMotivo(row.MotivoAusencia);
            if (motivo === 10 || motivo === 11) {
                ensureDateSet(sickLeaveByEmployee, employeeId).add(dateKey);
                return;
            }

            const isNormalPunch = motivo === null || motivo === 0 || motivo === 1;
            if (isNormalPunch) {
                ensureDateSet(workByEmployee, employeeId).add(dateKey);
                ensureSickDayActivity(employeeId, dateKey).normalPunchCount += 1;
                return;
            }

            ensureDateSet(workByEmployee, employeeId).add(dateKey);
            ensureSickDayActivity(employeeId, dateKey).hasNonSickIncidence = true;
        });

        const employeeIds = new Set<number>();
        const conflictsByEmployee = new Map<number, {
            employeeId: number;
            employeeName: string;
            vacationDates: string[];
            sickLeaveDates: string[];
        }>();

        workByEmployee.forEach((workDates, employeeId) => {
            const vacationDates = Array.from(vacationByEmployee.get(employeeId) || []).filter(date => workDates.has(date)).sort();
            const sickLeaveDates = Array.from(sickLeaveByEmployee.get(employeeId) || []).filter(date => {
                const stats = sickLeaveActivityByEmployee.get(employeeId)?.get(date);
                if (!stats) return false;
                return stats.hasNonSickIncidence || stats.normalPunchCount > 1;
            }).sort();
            if (vacationDates.length === 0 && sickLeaveDates.length === 0) return;

            employeeIds.add(employeeId);
            conflictsByEmployee.set(employeeId, {
                employeeId,
                employeeName: nameByEmployee.get(employeeId) || `Operario ${employeeId}`,
                vacationDates,
                sickLeaveDates
            });
        });

        return { employeeIds, conflictsByEmployee };
    }, [employeeCalendarsByDate, employeeOptions, erpData, startDate, endDate]);

    const datasetBajas = useMemo(() => {
        const getPrevDate = (dateStr: string): string => {
            const d = new Date(`${dateStr}T00:00:00`);
            d.setDate(d.getDate() - 1);
            return toISODateLocal(d);
        };

        const toNumber = (value: unknown): number | null => {
            if (value === null || value === undefined || value === '') return null;
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        };

        const hasValidSickLeavePunch = (employeeId: number): boolean => {
            const employeeRows = erpData.filter(r => Number(r.IDOperario) === employeeId);
            if (employeeRows.length === 0) return false;

            const entryDates = new Set(
                employeeRows
                    .filter(r => Number(r.Entrada) === 1)
                    .map(r => normalizeDateKey(r.Fecha))
            );

            return employeeRows.some(r => {
                if (Number(r.Entrada) !== 0) return false;
                const motivo = toNumber(r.MotivoAusencia);
                if (motivo !== 10 && motivo !== 11) return false;

                const exitDate = normalizeDateKey(r.Fecha);
                const prevDate = getPrevDate(exitDate);
                return entryDates.has(exitDate) || entryDates.has(prevDate);
            });
        };

        return processedData.filter(row => {
            if (!matchesTurno(row.turnoAsignado)) return false;
            const hasItHours = row.hITAT > 0 || row.hITEC > 0;
            if (!hasItHours) return false;
            if (leaveWorkConflicts.employeeIds.has(row.operario)) return false;
            return hasValidSickLeavePunch(row.operario);
        });
    }, [processedData, erpData, turno, leaveWorkConflicts]);

    const bajasEmployeeIds = useMemo(() => {
        return new Set(datasetBajas.map(row => row.operario));
    }, [datasetBajas]);

    const vacationEmployeeIds = useMemo(() => {
        const ids = new Set<number>();

        employeeCalendarsByDate?.forEach((dateMap, employeeId) => {
            dateMap.forEach((day, rawDate) => {
                const dateKey = normalizeDateKey(rawDate || day.Fecha);
                if (!dateKey || dateKey < startDate || dateKey > endDate) return;
                if (String(day.TipoDia) !== '2') return;
                ids.add(employeeId);
            });
        });

        erpData.forEach(row => {
            const dateKey = normalizeDateKey(row.Fecha);
            if (!dateKey || dateKey < startDate || dateKey > endDate) return;
            if (Number(row.TipoDiaEmpresa) !== 2) return;
            ids.add(Number(row.IDOperario));
        });

        return ids;
    }, [employeeCalendarsByDate, erpData, startDate, endDate]);

    const vacationEmployeeIdsWithoutConflicts = useMemo(() => {
        const ids = new Set<number>();
        vacationEmployeeIds.forEach(employeeId => {
            if (!leaveWorkConflicts.employeeIds.has(employeeId)) {
                ids.add(employeeId);
            }
        });
        return ids;
    }, [vacationEmployeeIds, leaveWorkConflicts]);

    const vacationExcludedEmployeeIds = useMemo(() => {
        const ids = new Set<number>(leaveWorkConflicts.employeeIds);
        if (isSingleDay) {
            bajasEmployeeIds.forEach(id => ids.add(id));
        }
        return ids;
    }, [leaveWorkConflicts, isSingleDay, bajasEmployeeIds]);

    const datasetAusenciasVisible = useMemo(() => {
        const holidaySet = new Set<string>([
            ...Array.from(companyHolidaySet || new Set<string>()),
            ...((effectiveCalendarDays || [])
                .filter(day => String(day.TipoDia) === '1')
                .map(day => day.Fecha))
        ]);

        const buildPeriodAbsentDays = (): string[] => {
            const days: string[] = [];
            const cursor = new Date(`${startDate}T00:00:00`);
            const end = new Date(`${endDate}T00:00:00`);

            while (cursor <= end) {
                const dateStr = toISODateLocal(cursor);
                const dayOfWeek = cursor.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isHoliday = holidaySet.has(dateStr);
                if (!isWeekend && !isHoliday) {
                    days.push(dateStr);
                }
                cursor.setDate(cursor.getDate() + 1);
            }

            return days;
        };

        const fallbackAbsentDays = buildPeriodAbsentDays();

        const employeesWithRows = new Set<number>(
            erpData
                .map(r => Number(r.IDOperario))
                .filter(id => Number.isFinite(id))
        );

        return processedData
            .filter(row => matchesTurno(row.turnoAsignado))
            .filter(row => !bajasEmployeeIds.has(row.operario))
            .filter(row => !vacationEmployeeIdsWithoutConflicts.has(row.operario))
            .filter(row => !employeesWithRows.has(row.operario))
            .map(row => ({
                ...row,
                absentDays: (row.absentDays && row.absentDays.length > 0) ? row.absentDays : fallbackAbsentDays
            }));
    }, [processedData, erpData, bajasEmployeeIds, vacationEmployeeIdsWithoutConflicts, startDate, endDate, companyHolidaySet, effectiveCalendarDays, turno]);

    const ausenciasEmployeeIds = useMemo(() => {
        return new Set(datasetAusenciasVisible.map(row => row.operario));
    }, [datasetAusenciasVisible]);

    const datasetResumenVisible = useMemo(() => {
        return datasetResumen.filter(row => {
            if (!matchesTurno(row.turnoAsignado)) return false;
            if (!isSingleDay) return true;
            return !bajasEmployeeIds.has(row.operario)
                && !ausenciasEmployeeIds.has(row.operario)
                && !vacationEmployeeIdsWithoutConflicts.has(row.operario);
        });
    }, [datasetResumen, bajasEmployeeIds, ausenciasEmployeeIds, vacationEmployeeIdsWithoutConflicts, turno, isSingleDay]);

    return (
        <div className="space-y-6">
            {/* Barra de Progreso Global Superior */}
            {(isLoading || isRefetching) && (
                <div className="fixed top-0 left-0 w-full h-1.5 z-[100] bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-500 animate-progress"></div>
                </div>
            )}

            <div className="bg-gradient-to-br from-white via-slate-50 to-indigo-50 rounded-2xl border border-slate-200/70 p-6 shadow-sm relative overflow-hidden">
                {/* Indicador de Refetching sutil en la cabecera */}
                {isRefetching && !isLoading && (
                    <div className="absolute top-0 right-0 p-2">
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold animate-pulse border border-blue-100 uppercase tracking-tighter">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>
                            Actualizando datos...
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-sky-600">
                            Gestión de Fichajes
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">
                            Control de presencia, ausencias e incidencias en tiempo real.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 rounded-xl bg-white/80 border border-slate-200 text-sm text-slate-600 shadow-sm">
                            <span className="font-semibold">Periodo:</span>{' '}
                            <span className="font-mono text-slate-800">{startDate}</span>
                            <span className="mx-1">→</span>
                            <span className="font-mono text-slate-800">{endDate}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <HrFilters
                    startDate={startDate} setStartDate={setStartDate}
                    endDate={endDate} setEndDate={setEndDate}
                    startTime={startTime} setStartTime={setStartTime}
                    endTime={endTime} setEndTime={setEndTime}
                    selectedDepartment={selectedDepartment} setSelectedDepartment={setSelectedDepartment}
                    selectedEmployeeIds={selectedEmployeeIds} setSelectedEmployeeIds={setSelectedEmployeeIds}
                    turno={turno} setTurno={setTurno}
                    employeeOptions={employeeOptions}
                    computedDepartments={computedDepartments}
                    departmentFilteredEmployees={departmentFilteredEmployees}
                />
                <HrActionPanel
                    onReload={reloadFromServer}
                    isReloading={isReloading}
                    onExport={handleExportRequest}
                    onExportVacaciones={handleVacExportRequest}
                    onExportHorasLibres={handleHLExportRequest}
                    onLateArrivalsOpen={handleOpenLateArrivals}
                    onAdjustmentModalOpen={handleOpenAdjustmentModal}
                    onFutureIncidentsOpen={() => incidentManagerRef.current?.handleOpenFutureIncidentsModal(employeeOptions as any)}
                    onExportResumen={handleExportResumen}
                    lastUpdated={lastUpdated}
                    isRefetching={isRefetching}
                />
            </div>

            {missingFirebaseEmployees.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
                                Empleados ERP sin registro en Firebase
                            </h3>
                            <p className="text-xs text-amber-800 mt-1">
                                Detectados {missingFirebaseEmployees.length} empleados nuevos. Pueden afectar la columna 3 (Nombre) del Excel de nóminas.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {missingFirebaseEmployees.map(emp => {
                            const isRegistering = registeringEmployeeIds.has(emp.id);
                            return (
                                <div key={emp.id} className="bg-white border border-amber-100 rounded-xl p-3 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-800">[{String(emp.id).padStart(3, '0')}] {emp.name}</div>
                                        <div className="text-xs text-slate-500">{emp.department}</div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isRegistering}
                                        onClick={() => handleRegisterEmployee(emp.id)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isRegistering ? 'Añadiendo...' : 'Añadir a Firebase'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {leaveWorkConflicts.employeeIds.size > 0 && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl leading-none">🚨</span>
                        <div>
                            <h3 className="text-base font-extrabold text-rose-900 uppercase tracking-wider">
                                Aviso Crítico: fichajes en días de baja o vacaciones
                            </h3>
                            <p className="text-sm text-rose-800 mt-1">
                                Estos empleados se han movido al resumen principal y se marcan en marrón rojizo para revisión inmediata.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {Array.from(leaveWorkConflicts.conflictsByEmployee.values())
                            .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'es'))
                            .map(conflict => {
                                const labels: string[] = [];
                                if (conflict.vacationDates.length > 0) {
                                    labels.push(`Vacaciones: ${conflict.vacationDates.join(', ')}`);
                                }
                                if (conflict.sickLeaveDates.length > 0) {
                                    labels.push(`Baja: ${conflict.sickLeaveDates.join(', ')}`);
                                }

                                return (
                                    <div key={conflict.employeeId} className="bg-white border border-rose-200 rounded-xl px-3 py-2 text-sm">
                                        <div className="font-bold text-rose-900">[{String(conflict.employeeId).padStart(3, '0')}] {conflict.employeeName}</div>
                                        <div className="text-rose-700 text-xs mt-0.5">{labels.join(' | ')}</div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
                            <div className="absolute top-0 w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-800 font-bold">Cargando datos del portal</p>
                            <p className="text-slate-500 text-xs mt-1">Esto puede tardar unos segundos para rangos amplios...</p>
                        </div>
                    </div>
                </div>
            ) : selectedEmployeeIds.length === 1 && selectedEmployeeData ? (
                <EmployeeDetailDashboard
                    employeeId={parseInt(selectedEmployeeIds[0], 10)}
                    employeeName={selectedEmployeeData.nombre}
                    periodData={selectedEmployeeData}
                    startDate={startDate}
                    endDate={endDate}
                    shifts={shifts}
                    companyNonWorkingSet={companyHolidaySet}
                />
            ) : erpData.length === 0 && isRefetching ? (
                <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-center animate-pulse">
                        <p className="text-slate-400 font-medium italic">Obteniendo fichajes desde el servidor...</p>
                    </div>
                </div>
            ) : (
                shouldUseVirtualization ? (
                    <HrDataTableVirtual
                        data={datasetResumenVisible}
                        onReviewGaps={handleIncidentClick}
                        onManualIncident={handleOpenManualIncident}
                        onExport={handleExportResumen}
                        justifiedIncidentKeys={incidentManagerRef.current?.justifiedIncidentKeys || new Map()}
                        startDate={startDate}
                        endDate={endDate}
                        isLongRange={isLongRange}
                        flexibleEmployeeIds={flexibleEmployeeIds}
                        highlightEmployeeIds={leaveWorkConflicts.employeeIds}
                    />
                ) : (
                    <HrDataTable
                        data={datasetResumenVisible}
                        rawData={erpData}
                        onReviewGaps={handleIncidentClick}
                        onManualIncident={handleOpenManualIncident}
                        onExport={handleExportResumen}
                        justifiedIncidentKeys={incidentManagerRef.current?.justifiedIncidentKeys || new Map()}
                        startDate={startDate}
                        endDate={endDate}
                        companyHolidays={companyHolidays}
                        isLongRange={isLongRange}
                        flexibleEmployeeIds={flexibleEmployeeIds}
                        highlightEmployeeIds={leaveWorkConflicts.employeeIds}
                    />
                )
            )}

            {/* Only show secondary tables if NOT a Type 1 day (Saturday/Festive) when viewing a single day */}
            {(!isDayType1) && (
                <>
                    <ActiveBajasTable
                        data={datasetBajas}
                        startDate={startDate}
                        endDate={endDate}
                    />

                    <AusenciasTable
                        data={datasetAusenciasVisible}
                        onRegisterIncident={handleAbsenceIncidentClick}
                        startDate={startDate}
                        endDate={endDate}
                    />

                    <VacationsTable
                        erpData={erpData}
                        startDate={startDate}
                        endDate={endDate}
                        employeeCalendarsByDate={employeeCalendarsByDate}
                        excludedEmployeeIds={vacationExcludedEmployeeIds}
                        employeeOptions={employeeOptions.map(emp => ({
                            id: emp.id,
                            name: emp.name,
                            department: emp.department
                        }))}
                    />
                </>
            )}

            <ExportNominasModal
                isOpen={isExportModalOpen}
                exportMonth={exportMonth}
                onExportMonthChange={setExportMonth}
                onClose={() => setIsExportModalOpen(false)}
                onExportFullMonth={handleExportFullMonth}
                onExportSelectedPeriod={handleExportSelectedPeriod}
            />

            <ExportPeriodModal
                isOpen={isVacExportModalOpen}
                title="Exportar Listado de Vacaciones por Sección"
                icon="🏖️"
                accentColor="green"
                exportMonth={vacExportMonth}
                onExportMonthChange={setVacExportMonth}
                onClose={() => setIsVacExportModalOpen(false)}
                onExportFullMonth={handleVacExportFullMonth}
                onExportSelectedPeriod={handleVacExportSelectedPeriod}
            />

            <ExportPeriodModal
                isOpen={isHLExportModalOpen}
                title="Exportar Listado de Horas Libres por Sección"
                icon="⏰"
                accentColor="purple"
                exportMonth={hlExportMonth}
                onExportMonthChange={setHlExportMonth}
                onClose={() => setIsHLExportModalOpen(false)}
                onExportFullMonth={handleHLExportFullMonth}
                onExportSelectedPeriod={handleHLExportSelectedPeriod}
            />
        </div>
    );
};

export default HrDashboardPage;
