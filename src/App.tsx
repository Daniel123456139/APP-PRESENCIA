import React, { useState, createContext, useMemo, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import LoginComponent from './components/LoginComponent';
import HrLayout from './components/hr/HrLayout';
import HrDashboardPage from './components/hr/pages/HrDashboardPage';
import {
    HrCalendarPage,
    HrVacationsPage,
    HrProfilesPage,
    HrBlogPage,
    HrSettingsPage
} from './components/hr/pages/HrPages';

import ProcessingComponent from './components/core/ProcessingComponent';
import InitialConfigComponent from './components/core/InitialConfigComponent';

import { User, Role, RawDataRow, BlogPost, Shift, SickLeave, IncidentLogEntry, CompanyHoliday, FutureAbsence } from './types';
import { MOCK_BLOG_POSTS } from './data/mockBlog';
import { NotificationProvider, useNotification } from './components/shared/NotificationContext';
import { useFichajes } from './hooks/useFichajes';
import { useCalendario } from './hooks/useErp';
import RealtimeNotificationsBridge from './components/shared/RealtimeNotificationsBridge';
import GlobalStatusPanel from './components/shared/GlobalStatusPanel';
import { AuditBridge } from './services/AuditBridge';
import { SickLeaveMetadataService } from './services/sickLeaveMetadataService';
import { SyncService } from './services/syncService';
import { encryptStorageData, decryptStorageData } from './services/encryptionService';
import { signOutApp, subscribeToAuthChanges } from './services/firebaseAuthService';
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
    const [authLoading, setAuthLoading] = useState(true);

    // 1. Suscribirse a cambios de autenticación
    useEffect(() => {
        const unsubscribe = subscribeToAuthChanges((authUser) => {
            if (authUser) {
                setCurrentUser({
                    id: authUser.uid,
                    name: authUser.displayName,
                    role: authUser.appRole as any,
                    rolUnificado: authUser.rolUnificado
                });
            } else {
                setCurrentUser(null);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

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
        if (!currentUser) {
            return;
        }

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
    }, [currentUser, showNotification, queryClient]);

    const handleInitialConfigContinue = async (startDate: string, endDate: string, startTime: string, endTime: string) => {
        setGlobalFilterState({ startDate, endDate, startTime, endTime });
        navigate('/processing');
    };

    // Auto-navigate from processing to portal when data is ready
    useEffect(() => {
        const isProcessing = location.pathname === '/processing';
        if (isProcessing && !loadingFichajes && !loadingCalendario) {
            navigate('/portal');
        }
    }, [loadingFichajes, loadingCalendario, erpData, navigate, location.pathname]);

    const handleLogin = useCallback((user: User) => {
        setCurrentUser(user);
    }, []);

    const handleLogout = useCallback(async () => {
        await signOutApp();
        setCurrentUser(null);
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

    if (authLoading) {
        return <ProcessingComponent />;
    }

    return (
        <AuthContext.Provider value={authContextValue}>
            <DataContext.Provider value={dataContextValue}>
                <RealtimeNotificationsBridge />
                {currentUser && <GlobalStatusPanel />}
                <Routes>
                    <Route
                        path="/login"
                        element={!currentUser ? <LoginComponent /> : <Navigate to="/portal" />}
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
                                    setCompanyHolidays={() => { }}
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
            <BrowserRouter>
                <MainRoutes />
            </BrowserRouter>
        </NotificationProvider>
    );
};

export default App;
