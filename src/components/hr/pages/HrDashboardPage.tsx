import React from 'react';
import { useMemo, useState } from 'react';
import { useHrLayout } from '../HrLayout';
import { toISODateLocal } from '../../../utils/localDate';
import HrFilters from '../HrFilters';
import HrActionPanel from '../HrActionPanel';
import EmployeeDetailDashboard from '../EmployeeDetailDashboard';
import HrDataTableVirtual from '../HrDataTableVirtual';
import HrDataTable from '../HrDataTable';
import AusenciasTable from '../AusenciasTable';
import VacationsTable from '../VacationsTable';
import ExportNominasModal from '../ExportNominasModal';

const HrDashboardPage: React.FC = () => {
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportMonth, setExportMonth] = useState('');
    const {
        startDate, setStartDate,
        endDate, setEndDate,
        startTime, setStartTime,
        endTime, setEndTime,
        selectedDepartment, setSelectedDepartment,
        selectedEmployeeIds, setSelectedEmployeeIds,
        turno, setTurno,
        employeeOptions,
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
        datasetResumen,
        erpData,
        handleIncidentClick,
        handleOpenManualIncident,
        isLongRange,
        handleUnproductivityExport,

        datasetAusencias,
        effectiveCalendarDays
    } = useHrLayout();

    const getFullMonthRange = (dateStr: string) => {
        const base = new Date(`${dateStr}T00:00:00`);
        const year = base.getFullYear();
        const month = base.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
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

    const flexibleEmployeeIds = useMemo(() => {
        return new Set((employeeOptions as Array<{ id: number; flexible?: boolean }>).filter(emp => emp.flexible).map(emp => emp.id));
    }, [employeeOptions]);

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

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-white via-slate-50 to-indigo-50 rounded-2xl border border-slate-200/70 p-6 shadow-sm">
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
                    onFreeHoursExport={() => incidentManagerRef.current?.handleOpenFreeHoursModal(employeeOptions as any, computedDepartments)}
                    onLateArrivalsOpen={handleOpenLateArrivals}
                    onAdjustmentModalOpen={handleOpenAdjustmentModal}
                    onFutureIncidentsOpen={() => incidentManagerRef.current?.handleOpenFutureIncidentsModal(employeeOptions as any)}
                    onExportResumen={handleExportResumen}
                    lastUpdated={lastUpdated}
                    isRefetching={isRefetching}
                />
            </div>

            {selectedEmployeeIds.length === 1 && selectedEmployeeData ? (
                <EmployeeDetailDashboard
                    employeeId={parseInt(selectedEmployeeIds[0], 10)}
                    employeeName={selectedEmployeeData.nombre}
                    periodData={selectedEmployeeData}
                    startDate={startDate}
                    endDate={endDate}
                    shifts={shifts}
                    companyNonWorkingSet={companyHolidaySet}
                />
            ) : (
                shouldUseVirtualization ? (
                    <HrDataTableVirtual
                        data={datasetResumen}
                        onReviewGaps={handleIncidentClick}
                        onManualIncident={handleOpenManualIncident}
                        onExport={handleExportResumen}
                        justifiedIncidentKeys={incidentManagerRef.current?.justifiedIncidentKeys || new Map()}
                        startDate={startDate}
                        endDate={endDate}
                        isLongRange={isLongRange}
                        flexibleEmployeeIds={flexibleEmployeeIds}
                    />
                ) : (
                    <HrDataTable
                        data={datasetResumen}
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
                    />
                )
            )}

            {/* Only show secondary tables if NOT a Type 1 day (Saturday/Festive) when viewing a single day */}
            {(!isDayType1) && (
                <>
                    <AusenciasTable
                        data={datasetAusencias}
                        onRegisterIncident={handleIncidentClick}
                        startDate={startDate}
                        endDate={endDate}
                    />

                    <VacationsTable
                        erpData={erpData}
                        startDate={startDate}
                        endDate={endDate}
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
        </div>
    );
};

export default HrDashboardPage;
