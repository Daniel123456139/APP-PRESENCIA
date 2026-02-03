
import React, { useState, useContext, lazy, Suspense, useCallback } from 'react';
import { AuthContext, AuthContextType } from '../../App';
import MyDashboard from './MyDashboard';
import Chatbot from './Chatbot';
import { BlogPost, Shift, CompanyHoliday } from '../../types';
import { NavItem, SvgIcon } from '../shared/Nav';

// Lazy loaded components
const CalendarView = lazy(() => import('./CalendarView'));
const BlogView = lazy(() => import('./BlogView'));

type ActiveTab = 'dashboard' | 'calendar' | 'blog';

interface EmployeePortalProps {
    blogPosts: BlogPost[];
    shifts: Shift[];
    companyHolidays: CompanyHoliday[];
}

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-full w-full p-10">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600"></div>
    </div>
);

const EmployeePortal: React.FC<EmployeePortalProps> = ({ blogPosts, shifts, companyHolidays }) => {
    const auth = useContext(AuthContext) as AuthContextType;
    const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <MyDashboard shifts={shifts} />;
            case 'calendar':
                return <CalendarView companyHolidays={companyHolidays} />;
            case 'blog':
                return <BlogView blogPosts={blogPosts} />;
            default:
                return <MyDashboard shifts={shifts} />;
        }
    };

    const handleNavItemClick = useCallback((tab: ActiveTab) => {
        setActiveTab(tab);
        if (window.innerWidth < 1024) { // lg breakpoint
            setIsSidebarOpen(false);
        }
    }, []);

    const navItemsMap: { tab: ActiveTab; label: string; icon: keyof typeof SvgIcon.types }[] = [
        { tab: 'dashboard', label: 'Mi Panel', icon: 'dashboard' },
        { tab: 'calendar', label: 'Mi Calendario', icon: 'calendar' },
        { tab: 'blog', label: 'Noticias', icon: 'blog' },
    ];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out z-30`}>
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-blue-600">Portal</h1>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <nav className="flex-grow p-4 space-y-1">
                    {navItemsMap.map(item => (
                        <NavItem
                            key={item.tab}
                            tab={item.tab}
                            label={item.label}
                            icon={item.icon}
                            activeTab={activeTab}
                            onClick={(tab) => handleNavItemClick(tab as ActiveTab)}
                        />
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-200 space-y-3">
                    <div>
                        <p className="text-sm font-semibold text-slate-800">{auth?.user?.name}</p>
                        <p className="text-xs text-slate-500">{auth?.user?.role}</p>
                    </div>

                    <button onClick={auth?.logout} className="w-full flex items-center text-sm text-red-600 hover:text-red-800 font-medium">
                        <SvgIcon type="logout" className="h-5 w-5 mr-2" />
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
                <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h2 className="text-lg font-semibold text-slate-800">
                        {navItemsMap.find(item => item.tab === activeTab)?.label}
                    </h2>
                    <div className="w-6"></div>
                </header>
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto relative">
                    <Suspense fallback={<LoadingSpinner />}>
                        {renderContent()}
                    </Suspense>
                    <Chatbot />
                </main>
            </div>
        </div>
    );
};

export default EmployeePortal;
