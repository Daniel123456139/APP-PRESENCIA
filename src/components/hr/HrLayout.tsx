import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { BlogPost, Shift, SickLeave, IncidentLogEntry, CompanyHoliday, ProcessedDataRow, RawDataRow, FutureAbsence, Role } from '../../types';
import { CalendarioDia } from '../../services/erpApi';
import { useHrPortalData } from '../../hooks/useHrPortalData';
import { toISODateLocal, getSmartDefaultDateRange } from '../../utils/localDate';
import SyncStatusIndicator from '../shared/SyncStatusIndicator';
import { IncidentManagerHandle } from './IncidentManager';
import IncidentManager from './IncidentManager';
import { exportUnproductivityToXlsx } from '../../services/exports/unproductivityExportService';

// Icons
import {
    LayoutDashboard,
    Briefcase,
    History,
    Stethoscope,
    BarChart3,
    Palmtree,
    CalendarDays,
    Users,
    Newspaper,
    Settings as SettingsIcon,
    Menu,
    X
} from 'lucide-react';

interface HrLayoutProps {
    blogPosts: BlogPost[];
    setBlogPosts: React.Dispatch<React.SetStateAction<BlogPost[]>>;
    shifts: Shift[];
    setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
    sickLeaves: SickLeave[];
    setSickLeaves: React.Dispatch<React.SetStateAction<SickLeave[]>>;
    futureAbsences: FutureAbsence[];
    setFutureAbsences: React.Dispatch<React.SetStateAction<FutureAbsence[]>>;
    analysisResult: string;
    setAnalysisResult: (res: string) => void;
    incidentLog: IncidentLogEntry[];
    setIncidentLog: React.Dispatch<React.SetStateAction<IncidentLogEntry[]>>;
    companyHolidays: CompanyHoliday[];
    setCompanyHolidays: React.Dispatch<React.SetStateAction<CompanyHoliday[]>>;
    initialStartDate?: string;
    initialEndDate?: string;
    initialStartTime?: string;
    initialEndTime?: string;
}

export interface HrLayoutContextType {
    // State from HrPortal/Layout
    startDate: string; setStartDate: React.Dispatch<React.SetStateAction<string>>;
    endDate: string; setEndDate: React.Dispatch<React.SetStateAction<string>>;
    startTime: string; setStartTime: React.Dispatch<React.SetStateAction<string>>;
    endTime: string; setEndTime: React.Dispatch<React.SetStateAction<string>>;

    // Data from useHrPortalData
    erpData: RawDataRow[];
    datasetResumen: ProcessedDataRow[];
    datasetAusencias: any[];
    employeeOptions: { id: number; name: string; role: Role; department: string; productivo: boolean }[];
    activeSickLeavesRaw: RawDataRow[];
    effectiveCalendarDays: CalendarioDia[];

    selectedEmployeeData: any;
    employeeCalendarsByDate: Map<number, Map<string, CalendarioDia>>;

    // UI/Filter State
    selectedDepartment: string; setSelectedDepartment: (val: string) => void;
    selectedEmployeeIds: string[]; setSelectedEmployeeIds: (ids: string[]) => void;
    turno: string; setTurno: (val: string) => void;

    // Computed
    isLongRange: boolean;
    companyHolidaySet: Set<string>;
    computedDepartments: string[];
    departmentFilteredEmployees: { id: number; name: string; role: Role; department: string; productivo: boolean }[];
    shouldUseVirtualization: boolean;

    // Actions
    reloadFromServer: () => Promise<void>;
    handleExport: (range?: { startDate: string; endDate: string }) => void;
    fetchActiveSickLeaves: () => Promise<void>;

    // Status
    isReloading: boolean;
    isRefetching: boolean;
    lastUpdated: number;
    refreshError: string | null;
    manualRefresh: () => void;

    // Handlers passed down
    handleIncidentClick: (employee: ProcessedDataRow) => void;
    handleOpenManualIncident: (employee: ProcessedDataRow) => void;
    handleOpenLateArrivals: () => void;
    handleOpenAdjustmentModal: () => void;
    handleExportResumen: () => void;
    handleUnproductivityExport: () => void;

    // Refs
    incidentManagerRef: React.RefObject<IncidentManagerHandle>;

    // Props passed through
    shifts: Shift[]; setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
    sickLeaves: SickLeave[]; setSickLeaves: React.Dispatch<React.SetStateAction<SickLeave[]>>;
    companyHolidays: CompanyHoliday[]; setCompanyHolidays: React.Dispatch<React.SetStateAction<CompanyHoliday[]>>;
    incidentLog: IncidentLogEntry[]; setIncidentLog: React.Dispatch<React.SetStateAction<IncidentLogEntry[]>>;
    blogPosts: BlogPost[]; setBlogPosts: React.Dispatch<React.SetStateAction<BlogPost[]>>;
}

export const useHrLayout = () => useOutletContext<HrLayoutContextType>();

const NavItem: React.FC<{
    to: string;
    label: string;
    icon: React.ReactNode;
}> = ({ to, label, icon }) => {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => `
                w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                ${isActive
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }
            `}
        >
            {icon}
            <span className="capitalize">{label}</span>
        </NavLink>
    );
};

const HrLayout: React.FC<HrLayoutProps> = (props) => {
    // --- UI State ---
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();

    // Close sidebar on route change on mobile
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Form State (Driven by UI)
    // Form State (Driven by UI)
    const defaultDates = getSmartDefaultDateRange();

    const [startDate, setStartDate] = useState(props.initialStartDate || defaultDates.startDate);
    const [endDate, setEndDate] = useState(props.initialEndDate || defaultDates.endDate);
    const [startTime, setStartTime] = useState(props.initialStartTime || '00:00');
    const [endTime, setEndTime] = useState(props.initialEndTime || '23:59');

    // Business Logic Hook
    const {
        erpData, datasetResumen, datasetAusencias, employeeOptions,
        activeSickLeavesRaw, effectiveCalendarDays, selectedEmployeeData,
        isReloading, isRefetching, lastUpdated, refreshError, manualRefresh,
        selectedDepartment, setSelectedDepartment,
        selectedEmployeeIds, setSelectedEmployeeIds,
        turno, setTurno,
        reloadFromServer, handleExport, handleFreeHoursExport, fetchActiveSickLeaves,
        isLongRange, performanceMode, companyHolidaySet, computedDepartments,

        departmentFilteredEmployees, shouldUseVirtualization, employeeCalendarsByDate
    } = useHrPortalData({
        startDate, endDate, startTime, endTime,
        shifts: props.shifts,
        companyHolidays: props.companyHolidays,
        incidentLog: props.incidentLog,
        setIncidentLog: props.setIncidentLog
    });

    const incidentManagerRef = useRef<IncidentManagerHandle>(null);

    // Initial load effects
    useEffect(() => {
        fetchActiveSickLeaves();
    }, [fetchActiveSickLeaves]);

    useEffect(() => {
        const saved = localStorage.getItem('incidentHistory');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) props.setIncidentLog(parsed);
            } catch (e) { console.warn('History parse error', e); }
        }
    }, [props.setIncidentLog]);

    useEffect(() => {
        if (props.incidentLog.length > 0) {
            localStorage.setItem('incidentHistory', JSON.stringify(props.incidentLog));
        }
    }, [props.incidentLog]);

    // --- Handlers ---
    const handleIncidentClick = (employee: ProcessedDataRow) => incidentManagerRef.current?.handleIncidentClick(employee);
    const handleOpenManualIncident = (employee: ProcessedDataRow) => incidentManagerRef.current?.handleOpenManualIncident(employee);
    const handleOpenLateArrivals = () => incidentManagerRef.current?.handleOpenLateArrivals(datasetResumen);
    const handleOpenAdjustmentModal = () => {
        const shiftMap = new Map<number, string>();
        datasetResumen.forEach(row => shiftMap.set(row.operario, row.turnoAsignado));
        incidentManagerRef.current?.handleOpenAdjustmentModal(erpData, shiftMap);
    };

    const handleExportResumen = () => {
        if (datasetResumen.length === 0) return;
        const headers = ['ID', 'Nombre', 'Departamento', 'Turno', 'Tiempo Real', 'Presencia', 'Justificadas', 'Total', 'Excesos', 'TAJ', 'Estado'];
        const csvContent = [
            headers.join(';'),
            ...datasetResumen.map(row => [
                row.operario, row.nombre, row.colectivo || '', row.turnoAsignado, row.horarioReal || '-',
                row.totalHoras.toFixed(2).replace('.', ','),
                row.horasJustificadas.toFixed(2).replace('.', ','),
                row.horasTotalesConJustificacion.toFixed(2).replace('.', ','),
                row.horasExceso.toFixed(2).replace('.', ','),
                `${row.numTAJ} / ${row.hTAJ.toFixed(2).replace('.', ',')}`,
                row.incidentCount > 0 ? 'Pendiente' : 'Correcto'
            ].join(';'))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `resumen_empleados_${startDate}_${endDate}.csv`;
        link.click();
    };

    const handleUnproductivityExport = () => {
        if (datasetResumen.length === 0) return;
        const filename = `Improductividad_${startDate}_${endDate}.xlsx`;
        const periodStr = `${startDate} a ${endDate}`;
        exportUnproductivityToXlsx(datasetResumen, filename, periodStr);
    };

    const contextValue: HrLayoutContextType = {
        startDate, setStartDate,
        endDate, setEndDate,
        startTime, setStartTime,
        endTime, setEndTime,

        erpData, datasetResumen, datasetAusencias, employeeOptions,
        activeSickLeavesRaw, effectiveCalendarDays, selectedEmployeeData,
        employeeCalendarsByDate,

        selectedDepartment, setSelectedDepartment,
        selectedEmployeeIds, setSelectedEmployeeIds,
        turno, setTurno,

        isLongRange, companyHolidaySet, computedDepartments,
        departmentFilteredEmployees, shouldUseVirtualization,

        reloadFromServer, handleExport, fetchActiveSickLeaves,

        isReloading, isRefetching, lastUpdated, refreshError, manualRefresh,

        handleIncidentClick,
        handleOpenManualIncident,
        handleOpenLateArrivals,
        handleOpenAdjustmentModal,
        handleExportResumen,
        handleUnproductivityExport,

        incidentManagerRef,

        shifts: props.shifts, setShifts: props.setShifts,
        sickLeaves: props.sickLeaves, setSickLeaves: props.setSickLeaves,
        companyHolidays: props.companyHolidays, setCompanyHolidays: props.setCompanyHolidays,
        incidentLog: props.incidentLog, setIncidentLog: props.setIncidentLog,
        blogPosts: props.blogPosts, setBlogPosts: props.setBlogPosts,
    };

    return (
        <div className="flex min-h-screen bg-slate-50">
            <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 transition-transform duration-300 z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">RRHH Portal</h1>
                        <p className="text-xs text-slate-500">Gestión Integral</p>
                    </div>
                </div>
                <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-100px)]">
                    <NavItem to="/portal/dashboard" label="Gestión de Fichajes" icon={<LayoutDashboard size={20} />} />
                    <NavItem to="/portal/jobs" label="Gestión de Trabajos" icon={<Briefcase size={20} />} />
                    <NavItem to="/portal/history" label="Historial Incidencias" icon={<History size={20} />} />

                    <NavItem to="/portal/vacations" label="Gestión de Vacaciones" icon={<Palmtree size={20} />} />
                    <NavItem to="/portal/calendar" label="Calendario" icon={<CalendarDays size={20} />} />
                    <NavItem to="/portal/blog" label="Blog" icon={<Newspaper size={20} />} />
                    <NavItem to="/portal/settings" label="Configuración" icon={<SettingsIcon size={20} />} />

                    <div className="mt-8 px-4">
                        <SyncStatusIndicator
                            lastUpdated={lastUpdated}
                            isRefetching={isRefetching}
                            error={refreshError}
                            onManualRefresh={manualRefresh}
                        />
                    </div>
                </nav>
            </aside>

            <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <div className="lg:hidden flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Menu</h2>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-white rounded-md shadow-sm border border-slate-200">
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                <Outlet context={contextValue} />
            </main>

            {/* UI Modals managed by IncidentManager */}
            <IncidentManager
                ref={incidentManagerRef}
                erpData={erpData}
                employeeOptions={employeeOptions as any}
                onRefreshNeeded={reloadFromServer}
                setIncidentLog={props.setIncidentLog}
                startDate={startDate}
                endDate={endDate}
            />
        </div>
    );
};

export default HrLayout;
