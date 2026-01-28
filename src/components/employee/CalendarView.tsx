
import React, { useState, useMemo, useContext, memo } from 'react';
import { AuthContext, AuthContextType, DataContext } from '../../App';
import { CompanyHoliday, RawDataRow } from '../../types';

const INCIDENT_COLORS: { [key: number]: string } = {
    2: 'bg-green-100 border-green-300 text-green-800', // Médico
    7: 'bg-yellow-100 border-yellow-300 text-yellow-800', // Horas Libres
    8: 'bg-blue-100 border-blue-300 text-blue-800', // Vacaciones
    13: 'bg-purple-100 border-purple-300 text-purple-800', // Ley Familias
    100: 'bg-red-100 border-red-300 text-red-800', // Festivo Empresa (Custom ID)
};

interface CalendarViewProps {
    companyHolidays: CompanyHoliday[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ companyHolidays }) => {
    const auth = useContext(AuthContext) as AuthContextType;
    const { erpData } = useContext(DataContext);
    const [currentDate, setCurrentDate] = useState(new Date());

    const employeeIncidents = useMemo(() => {
        if (!auth?.user) return [];
        // Filter personal incidents from ERP data (Absences where Entry is 0)
        return erpData.filter(
            (row) => row.IDOperario === auth.user?.id && row.Entrada !== 1 && row.MotivoAusencia !== 1 && row.MotivoAusencia !== 14
        );
    }, [auth?.user, erpData]);

    const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const renderEventsForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // 1. Personal Incidents
        const personalEvents = employeeIncidents
            .filter(inc => inc.Fecha === dateStr)
            .map((inc, idx) => (
                <div
                    key={`inc-${idx}`}
                    className={`text-xs p-1 rounded-md mt-1 truncate border ${INCIDENT_COLORS[inc.MotivoAusencia || 0] || 'bg-slate-200 border-slate-400'}`}
                    title={inc.DescMotivoAusencia}
                >
                    {inc.DescMotivoAusencia}
                </div>
            ));

        // 2. Company Holidays
        const holidayEvents = companyHolidays
            .filter(h => h.date === dateStr)
            .map((h, idx) => (
                <div
                    key={`hol-${idx}`}
                    className={`text-xs p-1 rounded-md mt-1 truncate border ${INCIDENT_COLORS[100]}`}
                    title={h.description}
                >
                    🎉 {h.description}
                </div>
            ));

        return [...holidayEvents, ...personalEvents];
    };

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">Mi Calendario</h1>

            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="px-3 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">&lt;</button>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-700 text-center">
                    {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => changeMonth(1)} className="px-3 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">&gt;</button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-slate-600">
                 {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(day => (
                    <div key={day} className="py-2 text-xs sm:text-base">{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="border border-slate-200 rounded-md bg-slate-50 min-h-[90px] sm:min-h-[120px]"></div>
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                    return (
                        <div key={day} className={`border border-slate-200 rounded-md p-1 sm:p-2 min-h-[90px] sm:min-h-[120px] transition-colors ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
                            <div className={`font-bold text-xs sm:text-base ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>{day}</div>
                            <div className="overflow-y-auto max-h-20 sm:max-h-24">
                                {renderEventsForDay(day)}
                            </div>
                        </div>
                    );
                })}
            </div>
             <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
                 <p className="font-semibold text-sm mr-4 self-center text-slate-700">Leyenda:</p>
                 <div className="flex items-center"><span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-200 mr-2"></span><span className="text-sm text-slate-600">Médico</span></div>
                 <div className="flex items-center"><span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-yellow-200 mr-2"></span><span className="text-sm text-slate-600">H. Libres</span></div>
                 <div className="flex items-center"><span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-blue-200 mr-2"></span><span className="text-sm text-slate-600">Vacaciones</span></div>
                 <div className="flex items-center"><span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-purple-200 mr-2"></span><span className="text-sm text-slate-600">L. Familias</span></div>
                 <div className="flex items-center"><span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-red-200 mr-2"></span><span className="text-sm text-slate-600">Festivo Empresa</span></div>
             </div>
        </div>
    );
};

export default memo(CalendarView);
