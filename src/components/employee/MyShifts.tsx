import React, { useState, useMemo, useContext, memo } from 'react';
import { AuthContext, AuthContextType } from '../../App';
import { Shift, SHIFT_TYPES } from '../../types';

interface MyShiftsProps {
    shifts: Shift[];
}

const MyShifts: React.FC<MyShiftsProps> = ({ shifts }) => {
    const auth = useContext(AuthContext) as AuthContextType;
    const [currentDate, setCurrentDate] = useState(new Date());

    const employeeShifts = useMemo(() => {
        if (!auth?.user) return [];
        return shifts.filter(s => s.operarioId === auth.user.id);
    }, [auth?.user, shifts]);

    const shiftsMap = useMemo(() => {
        const map = new Map<string, Shift>();
        employeeShifts.forEach(shift => {
            map.set(shift.date, shift);
        });
        return map;
    }, [employeeShifts]);

    const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const renderShiftForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const shift = shiftsMap.get(dateStr);
        if (!shift) return null;

        const shiftInfo = SHIFT_TYPES[shift.shiftCode];
        return (
            <div
                className={`text-xs p-1 rounded-md mt-1 text-center font-medium ${shiftInfo.color}`}
                title={shiftInfo.label}
            >
                {shiftInfo.label}
            </div>
        );
    };

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">Mis Turnos</h1>

            <div className="flex justify-between items-center mb-4">
                 <button onClick={() => changeMonth(-1)} className="px-3 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">&lt;</button>
                <h2 className="text-lg sm:text-xl font-semibold text-center text-slate-700">
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
                            {renderShiftForDay(day)}
                        </div>
                    );
                })}
            </div>
             <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
                 <p className="font-semibold text-sm mr-4 self-center text-slate-700">Leyenda:</p>
                 {Object.values(SHIFT_TYPES).map(({label, color}) => (
                      <div key={label} className="flex items-center">
                        <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${color.split(' ')[0]} mr-2`}></span>
                        <span className="text-sm text-slate-600">{label}</span>
                      </div>
                 ))}
             </div>
        </div>
    );
};

export default memo(MyShifts);