import React, { useState, createContext, useMemo, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginComponent from './components/LoginComponent';
import HrLayout from './components/hr/HrLayout';
import HrDashboardPage from './components/hr/pages/HrDashboardPage';
import {
    HrCalendarPage,
    HrSickLeavesPage,
    HrVacationsPage,
    HrHistoryPage,
    HrAnalyticsPage,
    HrProfilesPage,
    HrBlogPage,
    HrSettingsPage,
    HrJobsPage
} from './components/hr/pages/HrPages';
import ProcessingComponent from './components/core/ProcessingComponent';
import InitialConfigComponent from './components/core/InitialConfigComponent';

import { User, Role, RawDataRow, BlogPost, Shift, SickLeave, IncidentLogEntry, CompanyHoliday, FutureAbsence } from './types';
import { MOCK_BLOG_POSTS } from './data/mockBlog';
import { NotificationProvider, useNotification } from './components/shared/NotificationContext';
import { ErpDataProvider, useErpDataActions, useErpDataState } from './store/erpDataStore';
import RealtimeNotificationsBridge from './components/shared/RealtimeNotificationsBridge';
import GlobalStatusPanel from './components/shared/GlobalStatusPanel';
import { AuditBridge } from './services/AuditBridge';
import { fetchFichajes } from './services/apiService';
import { getCalendarioEmpresa, CalendarioDia } from './services/erpApi';
import { SyncService } from './services/syncService';

export interface AuthContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export interface DataContextType {
    erpData: RawDataRow[];
    shifts: Shift[];
}
export const DataContext = createContext<DataContextType>({ erpData: [], shifts: [] });

// Wrapper to use useNavigate hook
const MainRoutes: React.FC = () => {
    const navigate = useNavigate();
    const [loginRole, setLoginRole] = useState<'HR' | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Read from Store
    const { erpData } = useErpDataState();
    const { setErpData } = useErpDataActions();
    const { showNotification } = useNotification();

    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>(MOCK_BLOG_POSTS);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [sickLeaves, setSickLeaves] = useState<SickLeave[]>([]);
    const [futureAbsences, setFutureAbsences] = useState<FutureAbsence[]>([]);
    const [incidentLog, setIncidentLog] = useState<IncidentLogEntry[]>(() => {
        try {
            const saved = localStorage.getItem('incidentLog');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error parsing incidentLog from localStorage', e);
            return [];
        }
    });

    // Persist incidentLog changes
    useEffect(() => {
        localStorage.setItem('incidentLog', JSON.stringify(incidentLog));
    }, [incidentLog]);

    const [companyHolidays, setCompanyHolidays] = useState<CompanyHoliday[]>([]);
    const [companyCalendarDays, setCompanyCalendarDays] = useState<CalendarioDia[]>([]);

    // Estado para mantener la persistencia de las fechas y HORAS seleccionadas al inicio
    const [globalFilterState, setGlobalFilterState] = useState<{
        startDate: string;
        endDate: string;
        startTime: string;
        endTime: string;
    } | null>(null);

    useEffect(() => {
        AuditBridge.init();
        const handleOnline = async () => {
            showNotification("Conexión restablecida. Sincronizando datos pendientes...", "success");
            await SyncService.processQueue();
        };
        const handleOffline = () => {
            showNotification("Se ha perdido la conexión. Trabajando en modo Offline.", "warning");
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [showNotification]);

    const handleRoleSelect = async (role: 'HR' | 'EMPLOYEE') => {
        if (role === 'HR') {
            setLoginRole('HR');
            const hrUser: User = {
                id: 1,
                name: 'Administrador RRHH',
                role: Role.HR
            };
            setCurrentUser(hrUser);
            navigate('/setup');
        }
    };

    const handleInitialConfigContinue = async (startDate: string, endDate: string, startTime: string, endTime: string) => {
        setGlobalFilterState({ startDate, endDate, startTime, endTime });
        navigate('/processing');
        await executeDataLoad(startDate, endDate, startTime, endTime);
    };

    const executeDataLoad = async (startDate: string, endDate: string, startTime: string, endTime: string) => {
        try {
            const [fichajesResult, calendarResult] = await Promise.allSettled([
                fetchFichajes(startDate, endDate, '', startTime, endTime),
                getCalendarioEmpresa(startDate, endDate)
            ]);

            if (fichajesResult.status === 'fulfilled') {
                setErpData(fichajesResult.value);
            } else {
                console.error("Error loading Fichajes:", fichajesResult.reason);
                showNotification(`Error cargando fichajes: ${fichajesResult.reason?.message || 'Desconocido'}`, 'error');
                setErpData([]);
            }

            if (calendarResult.status === 'fulfilled') {
                const calendarData = calendarResult.value;
                setCompanyCalendarDays(calendarData);
                const holidays: CompanyHoliday[] = calendarData
                    .filter(d => d.TipoDia === "1")
                    .map((d, index) => ({
                        id: index + 1,
                        date: d.Fecha,
                        description: d.DescTurno || 'Festivo'
                    }));
                setCompanyHolidays(holidays);
            } else {
                console.warn("Error loading Calendar:", calendarResult.reason);
                showNotification("No se pudo cargar el calendario de festivos. Algunos datos pueden ser inexactos.", 'warning');
                setCompanyHolidays([]);
            }

        } catch (error: any) {
            console.error("Critical Error in executeDataLoad:", error);
            showNotification(`Error crítico: ${error.message}`, 'error');
        }
        navigate('/portal');
    };

    const handleLogin = useCallback((user: User) => {
        setCurrentUser(user);
    }, []);

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        setErpData([]);
        setAnalysisResult('');
        setLoginRole(null);
        setGlobalFilterState(null);
        navigate('/login');
    }, [setErpData, navigate]);

    const authContextValue = useMemo(() => ({
        user: currentUser,
        login: handleLogin,
        logout: handleLogout
    }), [currentUser, handleLogin, handleLogout]);

    const dataContextValue = useMemo(() => ({
        erpData,
        shifts,
    }), [erpData, shifts]);

    return (
        <AuthContext.Provider value={authContextValue}>
            <DataContext.Provider value={dataContextValue}>
                <RealtimeNotificationsBridge />
                {currentUser && <GlobalStatusPanel />}
                <Routes>
                    <Route
                        path="/login"
                        element={!currentUser ? <LoginComponent onRoleSelect={handleRoleSelect} /> : <Navigate to="/portal" />}
                    />
                    <Route
                        path="/setup"
                        element={currentUser ? <InitialConfigComponent onContinue={handleInitialConfigContinue} onBack={() => navigate('/login')} /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/processing"
                        element={<ProcessingComponent />}
                    />
                    <Route
                        path="/portal"
                        element={
                            currentUser ? (
                                <HrLayout
                                    blogPosts={blogPosts}
                                    setBlogPosts={setBlogPosts}
                                    shifts={shifts}
                                    setShifts={setShifts}
                                    sickLeaves={sickLeaves}
                                    setSickLeaves={setSickLeaves}
                                    futureAbsences={futureAbsences}
                                    setFutureAbsences={setFutureAbsences}
                                    analysisResult={analysisResult}
                                    setAnalysisResult={setAnalysisResult}
                                    incidentLog={incidentLog}
                                    setIncidentLog={setIncidentLog}
                                    companyHolidays={companyHolidays}
                                    setCompanyHolidays={setCompanyHolidays}
                                    initialStartDate={globalFilterState?.startDate}
                                    initialEndDate={globalFilterState?.endDate}
                                    initialStartTime={globalFilterState?.startTime}
                                    initialEndTime={globalFilterState?.endTime}
                                />
                            ) : (
                                <Navigate to="/login" />
                            )
                        }
                    >
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<HrDashboardPage />} />
                        <Route path="jobs" element={<HrJobsPage />} />
                        <Route path="history" element={<HrHistoryPage />} />
                        <Route path="sickleaves" element={<HrSickLeavesPage />} />
                        <Route path="analytics" element={<HrAnalyticsPage />} />
                        <Route path="vacations" element={<HrVacationsPage />} />
                        <Route path="calendar" element={<HrCalendarPage />} />
                        <Route path="profiles" element={<HrProfilesPage />} />
                        <Route path="blog" element={<HrBlogPage />} />
                        <Route path="settings" element={<HrSettingsPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/login" />} />
                </Routes>
            </DataContext.Provider>
        </AuthContext.Provider>
    );
};

const App: React.FC = () => {
    return (
        <NotificationProvider>
            <ErpDataProvider>
                <BrowserRouter>
                    <MainRoutes />
                </BrowserRouter>
            </ErpDataProvider>
        </NotificationProvider>
    );
};

export default App;
