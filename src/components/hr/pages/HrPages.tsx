import React from 'react';
import { useHrLayout } from '../HrLayout';

// Components
import HrCalendarView from '../HrCalendarView';
import SickLeaveManager from '../SickLeaveManager';
import VacationManager from '../VacationManager';
import EmployeeProfilePanel from '../EmployeeProfilePanel';
import BlogManager from '../BlogManager';
import Settings from '../Settings';

export const HrCalendarPage: React.FC = () => {
    return <HrCalendarView />;
};

export const HrSickLeavesPage: React.FC = () => {
    const { activeSickLeavesRaw, fetchActiveSickLeaves } = useHrLayout();
    return <SickLeaveManager activeSickLeaves={activeSickLeavesRaw} onRefresh={fetchActiveSickLeaves} />;
};

export const HrVacationsPage: React.FC = () => {
    return <VacationManager />;
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

