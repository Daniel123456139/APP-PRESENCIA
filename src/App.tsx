import React, { useState, createContext, useMemo, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import LoginComponent from './components/LoginComponent';
import HrLayout from './components/hr/HrLayout';
import HrDashboardPage from './components/hr/pages/HrDashboardPage';
import {
    HrCalendarPage,
    HrVacationsPage,
    HrHistoryPage,
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
// import { ErpDataProvider, useErpDataActions, useErpDataState } from './store/erpDataStore'; // DEPRECATED
import { useFichajes } from './hooks/useFichajes';
import { useCalendario } from './hooks/useErp';
import RealtimeNotificationsBridge from './components/shared/RealtimeNotificationsBridge';
import GlobalStatusPanel from './components/shared/GlobalStatusPanel';
import { AuditBridge } from './services/AuditBridge';
import { SickLeaveMetadataService } from './services/sickLeaveMetadataService';
// import { fetchFichajes } from './services/apiService'; // Handled by hook
// import { getCalendarioEmpresa, CalendarioDia } from './services/erpApi'; // Handled by hook
import { SyncService } from './services/syncService';
import { encryptStorageData, decryptStorageData } from './services/encryptionService';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirebaseApp } from './firebaseConfig';

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
    const queryClient = useQueryClient();
    const [loginRole, setLoginRole] = useState<'HR' | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Global Filter State
    const [globalFilterState, setGlobalFilterState] = useState<{
        startDate: string;
        endDate: string;
        startTime: string;
        endTime: string;
    } | null>(null);

    // React Query Hooks
    const { erpData, isLoading: loadingFichajes, error: errorFichajes } = useFichajes(
        globalFilterState?.startDate || '',
        globalFilterState?.endDate || ''
    );

    const { calendario, loading: loadingCalendario, error: errorCalendario } = useCalendario(
        globalFilterState?.startDate || '',
        globalFilterState?.endDate || ''
    );

    const { showNotification } = useNotification();

    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>(MOCK_BLOG_POSTS);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [sickLeaves, setSickLeaves] = useState<SickLeave[]>([]);
    const [futureAbsences, setFutureAbsences] = useState<FutureAbsence[]>([]);
    const [incidentLog, setIncidentLog] = useState<IncidentLogEntry[]>(() => {
        try {
            const saved = localStorage.getItem('incidentLog');
            return saved ? (decryptStorageData(saved) || []) : [];
        } catch (e) {
            console.error('Error parsing incidentLog from localStorage', e);
            return [];
        }
    });

    // Persist incidentLog changes
    useEffect(() => {
        localStorage.setItem('incidentLog', encryptStorageData(incidentLog));
    }, [incidentLog]);

    // Derived States
    const companyCalendarDays = calendario;
    const companyHolidays = useMemo(() => {
        return calendario
            .filter(d => d.TipoDia === "1")
            .map((d, index) => ({
                id: index + 1,
                date: d.Fecha,
                description: d.DescTurno || 'Festivo'
            }));
    }, [calendario]);

    // Error Handling
    useEffect(() => {
        if (errorFichajes) showNotification(`Error cargando fichajes: ${errorFichajes}`, 'error');
        if (errorCalendario) showNotification(`Error cargando calendario: ${errorCalendario}`, 'warning');
    }, [errorFichajes, errorCalendario, showNotification]);

    useEffect(() => {
        AuditBridge.init();
        SickLeaveMetadataService.init();
        const handleOnline = async () => {
            showNotification("Conexión restablecida. Sincronizando datos pendientes...", "success");
            await SyncService.processQueue();
            // Invalidate queries to refresh data after sync
            queryClient.invalidateQueries({ queryKey: ['fichajes'] });
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
    }, [showNotification, queryClient]);

    // Firebase Auth
    useEffect(() => {
        let cancelled = false;
        const initFirebaseAuth = async () => {
            try {
                const app = getFirebaseApp();
                const auth = getAuth(app);
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
            } catch (error: any) {
                if (cancelled) return;
                console.error('Firebase anonymous auth failed:', error);
                if (error.code === 'auth/admin-restricted-operation') {
                    showNotification('Error: Autenticación Anónima deshabilitada en Firebase Console.', 'error');
                } else {
                    showNotification('No se pudo autenticar en Firebase.', 'error');
                }
            }
        };

        initFirebaseAuth();
        return () => {
            cancelled = true;
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
        // Data loading is triggered automatically by hooks when state changes
    };

    // Auto-navigate from processing to portal when data is ready
    useEffect(() => {
        if (location.pathname === '/processing' && !loadingFichajes && !loadingCalendario && erpData.length > 0) {
            navigate('/portal');
        }
        // If error, maybe stay or show error? Notification handles error.
        // If data is empty but loaded, we still go to portal?
        if (location.pathname === '/processing' && !loadingFichajes && !loadingCalendario && erpData.length === 0 && !errorFichajes) {
            navigate('/portal');
        }
    }, [loadingFichajes, loadingCalendario, erpData, errorFichajes, navigate]);

    const handleLogin = useCallback((user: User) => {
        setCurrentUser(user);
    }, []);

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        // Clean React Query Cache
        queryClient.removeQueries();

        setAnalysisResult('');
        setLoginRole(null);
        setGlobalFilterState(null);
        navigate('/login');
    }, [navigate, queryClient]);

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
                                    // setCompanyHolidays={setCompanyHolidays} // Derived from query, read-only mostly? Or separate state?
                                    // If HrLayout needs to modify holidays, we might need state. 
                                    // But holidays usually come from ERP.
                                    // For now passing as prop. If HrLayout expects setter, we might need a local state synced with query.
                                    setCompanyHolidays={() => { }} // Placeholder or handle updates via mutation if needed
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
            {/* ErpDataProvider REMOVED */}
            <BrowserRouter>
                <MainRoutes />
            </BrowserRouter>
        </NotificationProvider>
    );
};

export default App;
