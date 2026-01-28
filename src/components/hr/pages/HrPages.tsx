import React from 'react';
import { useHrLayout } from '../HrLayout';

// Components
import HrCalendarView from '../HrCalendarView';
import SickLeaveManager from '../SickLeaveManager';
import VacationManager from '../VacationManager';
import IncidentHistoryPanel from '../IncidentHistoryPanel';
import AbsenteeismDashboard from '../analytics/AbsenteeismDashboard';
import EmployeeProfilePanel from '../EmployeeProfilePanel';
import BlogManager from '../BlogManager';
import Settings from '../Settings';
import { JobManagement } from '../../../pages/JobManagement';

export const HrCalendarPage: React.FC = () => {
    const {
        erpData, employeeOptions, companyHolidays, effectiveCalendarDays,
        selectedEmployeeIds, setSelectedEmployeeIds,
        selectedDepartment, setSelectedDepartment, computedDepartments
    } = useHrLayout();

    return (
        <HrCalendarView
            erpData={erpData}
            setErpData={() => { }}
            allEmployees={employeeOptions as any}
            companyHolidays={companyHolidays}
            companyCalendarDays={effectiveCalendarDays}
            selectedEmployeeIds={selectedEmployeeIds}
            setSelectedEmployeeIds={setSelectedEmployeeIds}
            selectedDepartment={selectedDepartment}
            setSelectedDepartment={setSelectedDepartment}
            departments={computedDepartments}
        />
    );
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

export const HrAnalyticsPage: React.FC = () => {
    const { erpData } = useHrLayout();
    return <AbsenteeismDashboard erpData={erpData} />;
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
    const { startDate, endDate } = useHrLayout();
    return <JobManagement initialStartDate={startDate} initialEndDate={endDate} />;
};
