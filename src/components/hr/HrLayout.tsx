import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Outlet, NavLink, useLocation, useOutletContext, Navigate } from 'react-router-dom';
import { AuthContext } from '../../App';
import { BlogPost, Shift, SickLeave, IncidentLogEntry, CompanyHoliday, ProcessedDataRow, RawDataRow, FutureAbsence, Role, User } from '../../types';
import { CalendarioDia } from '../../services/erpApi';
import { useHrPortalData } from '../../hooks/useHrPortalData';
import { getSmartDefaultDateRange } from '../../utils/localDate';
import { IncidentManagerHandle } from './IncidentManager';
import IncidentManager from './IncidentManager';
import { exportUnproductivityToXlsx } from '../../services/exports/unproductivityExportService';

// Icons
import {
    LayoutDashboard,
    Palmtree,
    CalendarDays,
    Newspaper,
    Settings as SettingsIcon,
    Menu,
    X,
    Layers
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

    // Data from useHrPortalData
    erpData: RawDataRow[];
    processedData: ProcessedDataRow[];
    datasetResumen: ProcessedDataRow[];
    datasetAusencias: ProcessedDataRow[];
    employeeOptions: { id: number; name: string; role: Role; department: string; flexible: boolean }[];
    activeSickLeavesRaw: RawDataRow[];
    missingFirebaseEmployees: Array<{ id: number; name: string; department: string; flexible: boolean }>;
    registeringEmployeeIds: Set<number>;
    companyHolidays: CompanyHoliday[];
    companyHolidaySet: Set<string>;

    selectedEmployeeData: ProcessedDataRow | undefined;
    employeeCalendarsByDate: Map<number, Map<string, CalendarioDia>>;
    setEmployeeCalendarsByDate: React.Dispatch<React.SetStateAction<Map<number, Map<string, CalendarioDia>>>>;

    // UI/Filter State
    selectedDepartment: string; setSelectedDepartment: (val: string) => void;
    selectedEmployeeIds: string[]; setSelectedEmployeeIds: (ids: string[]) => void;
    startTime: string; setStartTime: (val: string) => void;
    endTime: string; setEndTime: (val: string) => void;
    turno: string; setTurno: (val: string) => void;
    departmentFilteredEmployees: any[];

    // Computed
    isLongRange: boolean;
    computedDepartments: string[];
    isFetchingCalendars: boolean;
    effectiveCalendarDays: CalendarioDia[];
    shouldUseVirtualization: boolean;

    // Actions
    handleExport: (range?: { startDate: string; endDate: string }) => void;
    registerMissingEmployee: (employeeId: number) => Promise<void>;
    handleExportResumen: () => void;
    handleUnproductivityExport: () => void;
    isPayrollExporting: boolean;
    payrollExportProgress: {
        percent: number;
        message: string;
        phase: 'validando' | 'cargando_periodo' | 'cargando_ytd' | 'procesando_empleados' | 'construyendo_excel' | 'finalizando';
        completedEmployees?: number;
        totalEmployees?: number;
    };

    // Status
    isLoading: boolean;
    isReloading: boolean;
    isRefetching: boolean;
    fichajesError: any;
    refreshErpData: () => void;
    reloadFromServer: () => void;
    lastUpdated: number | null;

    // Handlers passed down
    handleIncidentClick: (employee: ProcessedDataRow) => void;
    handleAbsenceIncidentClick: (employee: ProcessedDataRow) => void;
    handleOpenManualIncident: (employee: ProcessedDataRow) => void;
    handleOpenLateArrivals: () => void;
    handleOpenAdjustmentModal: () => void;

    // Refs
    incidentManagerRef: React.RefObject<IncidentManagerHandle>;

    // Props passed through
    shifts: Shift[]; setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
    sickLeaves: SickLeave[]; setSickLeaves: React.Dispatch<React.SetStateAction<SickLeave[]>>;
    setCompanyHolidays: React.Dispatch<React.SetStateAction<CompanyHoliday[]>>;
    incidentLog: IncidentLogEntry[]; setIncidentLog: React.Dispatch<React.SetStateAction<IncidentLogEntry[]>>;
    blogPosts: BlogPost[]; setBlogPosts: React.Dispatch<React.SetStateAction<BlogPost[]>>;
    fetchActiveSickLeaves: () => void;
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
    const auth = React.useContext(AuthContext);
    const currentUser = auth?.user;
    const rol = currentUser?.rolUnificado || 'USER';

    // --- UI State ---
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();

    // Redirección si no hay usuario
    if (!currentUser) return <Navigate to="/login" />;

    // Close sidebar on route change on mobile
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Form State (Driven by UI)
    const defaultDates = getSmartDefaultDateRange();

    const [startDate, setStartDate] = useState(props.initialStartDate || defaultDates.startDate);
    const [endDate, setEndDate] = useState(props.initialEndDate || defaultDates.endDate);
    const [startTime, setStartTime] = useState(props.initialStartTime || '00:00');
    const [endTime, setEndTime] = useState(props.initialEndTime || '23:59');

    // Business Logic Hook
    const {
        erpData,
        processedData,
        datasetResumen,
        datasetAusencias,
        employeeOptions,
        activeSickLeavesRaw,
        missingFirebaseEmployees,
        registeringEmployeeIds,
        companyCalendarDays,
        selectedEmployeeData,
        isLoading,
        isRefetching,
        fichajesError,
        refreshErpData,
        selectedDepartment,
        setSelectedDepartment,
        selectedEmployeeIds,
        setSelectedEmployeeIds,
        handleExport,
        isPayrollExporting,
        payrollExportProgress,
        registerMissingEmployee,
        isLongRange,
        computedDepartments,
        employeeCalendarsByDate,
        setEmployeeCalendarsByDate,
        isFetchingCalendars,
        lastUpdated,
        refetchActiveSickLeaves
    } = useHrPortalData({ startDate, endDate, startTime, endTime });

    const incidentManagerRef = useRef<IncidentManagerHandle>(null);

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
    const handleAbsenceIncidentClick = (employee: ProcessedDataRow) => incidentManagerRef.current?.handleAbsenceIncidentClick(employee);
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

    const [turno, setTurno] = useState('all');

    const departmentFilteredEmployees = useMemo(() => {
        if (selectedDepartment === 'all' || selectedDepartment === 'TODOS') return employeeOptions;
        return employeeOptions.filter(emp => emp.department === selectedDepartment);
    }, [selectedDepartment, employeeOptions]);

    const companyHolidaySet = useMemo(() => {
        return new Set(props.companyHolidays.map(h => h.date));
    }, [props.companyHolidays]);

    const [shouldUseVirtualization, setShouldUseVirtualization] = useState(false);

    useEffect(() => {
        const readSettings = () => {
            try {
                const saved = localStorage.getItem('appSettings');
                if (!saved) {
                    setShouldUseVirtualization(false);
                    return;
                }
                const parsed = JSON.parse(saved);
                setShouldUseVirtualization(Boolean(parsed?.sistema?.modoRendimiento));
            } catch {
                setShouldUseVirtualization(false);
            }
        };

        readSettings();
        window.addEventListener('settingsChanged', readSettings);
        return () => window.removeEventListener('settingsChanged', readSettings);
    }, []);

    const contextValue: HrLayoutContextType = {
        startDate, setStartDate,
        endDate, setEndDate,
        startTime, setStartTime,
        endTime, setEndTime,
        turno, setTurno,
        departmentFilteredEmployees,

        erpData, processedData, datasetResumen, datasetAusencias, employeeOptions,
        activeSickLeavesRaw, companyHolidays: props.companyHolidays, companyHolidaySet, selectedEmployeeData,
        missingFirebaseEmployees, registeringEmployeeIds,
        employeeCalendarsByDate, setEmployeeCalendarsByDate,

        selectedDepartment, setSelectedDepartment,
        selectedEmployeeIds, setSelectedEmployeeIds,

        isLongRange, computedDepartments, isFetchingCalendars,
        effectiveCalendarDays: companyCalendarDays || [],
        shouldUseVirtualization,

        handleExport,
        isPayrollExporting,
        payrollExportProgress,
        registerMissingEmployee,
        handleExportResumen, handleUnproductivityExport,

        isLoading,
        isReloading: isLoading || isRefetching,
        isRefetching,
        fichajesError,
        refreshErpData,
        reloadFromServer: refreshErpData,
        lastUpdated,

        handleIncidentClick,
        handleAbsenceIncidentClick,
        handleOpenManualIncident,
        handleOpenLateArrivals,
        handleOpenAdjustmentModal,

        incidentManagerRef,

        shifts: props.shifts, setShifts: props.setShifts,
        sickLeaves: props.sickLeaves, setSickLeaves: props.setSickLeaves,
        setCompanyHolidays: props.setCompanyHolidays,
        incidentLog: props.incidentLog, setIncidentLog: props.setIncidentLog,
        blogPosts: props.blogPosts, setBlogPosts: props.setBlogPosts,
        fetchActiveSickLeaves: () => { refetchActiveSickLeaves(); }
    };

    const menuItems = [
        { to: "/portal/dashboard", label: "Gestión de Fichajes", icon: <LayoutDashboard size={20} />, roles: ['SUPER_ADMIN', 'RRHH', 'OPERADOR'] },

        { to: "/portal/vacations", label: "Gestión de Vacaciones", icon: <Palmtree size={20} />, roles: ['SUPER_ADMIN', 'RRHH', 'OPERADOR'] },
        { to: "/portal/calendar", label: "Calendario", icon: <CalendarDays size={20} />, roles: ['SUPER_ADMIN', 'RRHH', 'OPERADOR', 'GESTOR_TRABAJOS'] },
        { to: "/portal/blog", label: "Blog", icon: <Newspaper size={20} />, roles: ['SUPER_ADMIN', 'RRHH', 'OPERADOR', 'GESTOR_TRABAJOS'] },
    ].filter(item => item.roles.includes(rol));

    return (
        <div className="flex min-h-screen bg-slate-50">
            <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 transition-transform duration-300 z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="p-6 border-b border-slate-200">
                    <h1 className="text-2xl font-bold text-slate-800">RRHH Portal</h1>
                    <div className="flex items-center mt-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <p className="text-xs text-slate-500 font-medium">{currentUser?.name}</p>
                    </div>
                    <p className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">{rol.replace('_', ' ')}</p>
                </div>
                <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
                    {menuItems.map(item => (
                        <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
                    ))}

                    {['SUPER_ADMIN'].includes(rol) && (
                        <NavItem to="/portal/settings" label="Configuración" icon={<SettingsIcon size={20} />} />
                    )}

                    <div className="mt-8 pt-4 border-t border-slate-100">
                        <button
                            onClick={() => auth?.logout()}
                            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <X size={20} />
                            <span className="font-medium">Cerrar Sesión</span>
                        </button>
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

            {isPayrollExporting && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Exportando nomina mensual</h3>
                            <span className="text-sm font-semibold text-slate-500">{Math.max(0, Math.min(100, payrollExportProgress.percent))}%</span>
                        </div>

                        <div className="mb-3 text-sm text-slate-600">{payrollExportProgress.message}</div>

                        <div className="h-4 w-full rounded-full bg-slate-200 overflow-hidden relative">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-slate-800 via-slate-600 to-slate-400 transition-all duration-500 ease-out"
                                style={{ width: `${Math.max(0, Math.min(100, payrollExportProgress.percent))}%` }}
                            />
                            <div className="absolute inset-0 opacity-30 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.65),transparent)] animate-pulse" />
                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                            <span className="uppercase tracking-wide">Fase: {payrollExportProgress.phase.replace('_', ' ')}</span>
                            {typeof payrollExportProgress.totalEmployees === 'number' && (
                                <span>
                                    Empleados: {payrollExportProgress.completedEmployees || 0}/{payrollExportProgress.totalEmployees}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* UI Modals managed by IncidentManager */}
            <IncidentManager
                ref={incidentManagerRef}
                erpData={erpData}
                employeeOptions={employeeOptions as any}
                onRefreshNeeded={refreshErpData}
                setIncidentLog={props.setIncidentLog}
                startDate={startDate}
                endDate={endDate}
            />
        </div>
    );
};

export default HrLayout;
