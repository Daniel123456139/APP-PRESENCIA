import React from 'react';
import { useState } from 'react';
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

        datasetAusencias
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

    return (
        <div className="space-y-6">
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
                    />
                )
            )}

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
