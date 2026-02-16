import React from 'react';
import { useHrLayout } from '../HrLayout';

// Components
import HrCalendarView from '../HrCalendarView';
import SickLeaveManager from '../SickLeaveManager';
import VacationManager from '../VacationManager';
import IncidentHistoryPanel from '../IncidentHistoryPanel';
import EmployeeProfilePanel from '../EmployeeProfilePanel';
import BlogManager from '../BlogManager';
import Settings from '../Settings';
import { JobManagement } from '../../../pages/JobManagement';

export const HrCalendarPage: React.FC = () => {
    return <HrCalendarView />;
};

export const HrSickLeavesPage: React.FC = () => {
    const { activeSickLeavesRaw, fetchActiveSickLeaves } = useHrLayout();
    return <SickLeaveManager activeSickLeaves={activeSickLeavesRaw} onRefresh={fetchActiveSickLeaves} />;
};

export const HrVacationsPage: React.FC = () => {
    const { employeeOptions } = useHrLayout();
    return <VacationManager allEmployees={employeeOptions as any} />;
};

export const HrHistoryPage: React.FC = () => {
    const { incidentLog, setIncidentLog } = useHrLayout();
    return (
        <IncidentHistoryPanel
            incidentLog={incidentLog}
            onDelete={(id) => setIncidentLog(prev => prev.filter(item => item.id !== id))}
        />
    );
};

export const HrProfilesPage: React.FC = () => {
    return <EmployeeProfilePanel />;
};

export const HrBlogPage: React.FC = () => {
    const { blogPosts, setBlogPosts } = useHrLayout();
    return <BlogManager blogPosts={blogPosts} setBlogPosts={setBlogPosts} />;
};

export const HrSettingsPage: React.FC = () => {
    const { companyHolidays, setCompanyHolidays } = useHrLayout();
    return <Settings companyHolidays={companyHolidays} setCompanyHolidays={setCompanyHolidays} />;
};

export const HrJobsPage: React.FC = () => {
    const {
        startDate, setStartDate, endDate, setEndDate,
        startTime, endTime,
        erpData, datasetResumen, isReloading,
        departmentFilteredEmployees, selectedDepartment, setSelectedDepartment, computedDepartments,
        employeeCalendarsByDate, lastUpdated, reloadFromServer
    } = useHrLayout();

    return (
        <JobManagement
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            startTime={startTime}
            endTime={endTime}
            erpData={erpData}
            datasetResumen={datasetResumen}
            isReloading={isReloading}
            departmentFilteredEmployees={departmentFilteredEmployees as any}
            selectedDepartment={selectedDepartment}
            setSelectedDepartment={setSelectedDepartment}
            computedDepartments={computedDepartments}
            employeeCalendarsByDate={employeeCalendarsByDate}
            lastUpdated={lastUpdated}
            reloadFromServer={reloadFromServer}
        />
    );
};
