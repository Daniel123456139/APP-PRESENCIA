
import React, { useContext, useMemo, memo } from 'react';
import { AuthContext, AuthContextType, DataContext } from '../../App';
import { processData } from '../../services/dataProcessor';
import { ProcessedDataRow, Shift, SHIFT_TYPES } from '../../types';
import { toISODateLocal } from '../../utils/localDate';
import { resolveTurno } from '../../utils/turnoResolver';

interface MyDashboardProps {
    shifts: Shift[];
}

const DataCard: React.FC<{ title: string; value: string | number; subtext?: string; className?: string }> = memo(({ title, value, subtext, className }) => (
    <div className={`p-4 bg-white rounded-xl shadow-sm border border-slate-200/80 flex flex-col justify-between ${className}`}>
        <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
    </div>
));

const ShiftCard: React.FC<{ date: string; shiftCode: string }> = ({ date, shiftCode }) => {
    const shiftInfo = SHIFT_TYPES[shiftCode as keyof typeof SHIFT_TYPES];
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' });
    const dayNum = dateObj.getDate();

    return (
        <div className={`p-3 rounded-lg border flex flex-col items-center justify-center min-w-[80px] ${shiftInfo?.color || 'bg-gray-100'}`}>
            <span className="text-xs uppercase font-bold opacity-70">{dayName}</span>
            <span className="text-lg font-bold">{dayNum}</span>
            <span className="text-xs mt-1 font-medium">{shiftInfo?.label || shiftCode}</span>
        </div>
    );
};

const MyDashboard: React.FC<MyDashboardProps> = ({ shifts }) => {
    const auth = useContext(AuthContext) as AuthContextType;
    const { erpData } = useContext(DataContext);

    const myData: ProcessedDataRow | null = useMemo(() => {
        if (!auth?.user || !erpData) return null;
        // Pass the shifts array (which comes from props here, but matches DataContext) to ensure accurate calculations
        const data = processData(erpData, [auth.user], Number(auth.user.id));
        return data.length > 0 ? data[0] : null;
    }, [auth?.user, erpData, shifts]);

    // Calculate upcoming shifts for the next 7 days based on manual assignments or erp data inference
    const upcomingShifts = useMemo(() => {
        if (!auth?.user) return [];
        const today = new Date();
        const nextWeek = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dateStr = toISODateLocal(d);

            // Check for manual override first (shifts from props/store)
            const manualShift = shifts.find(s => s.operarioId === auth.user?.id && s.date === dateStr);
            let shiftCode = manualShift ? manualShift.shiftCode : 'L'; // Default to Libre if unknown

            // Try to use backend turno if no manual shift
            if (!manualShift) {
                const row = erpData.find(r => r.IDOperario === auth.user?.id && r.Fecha === dateStr);
                if (row) {
                    const { code } = resolveTurno(row);
                    if (code !== 'UNKNOWN') {
                        shiftCode = code;
                    }
                }
            }

            nextWeek.push({ date: dateStr, code: shiftCode });
        }
        return nextWeek;
    }, [auth?.user, shifts, erpData]);

    if (!myData) {
        return (
            <div className="text-center p-8">
                <h1 className="text-3xl font-bold text-slate-800 mb-6">Mi Panel de Empleado</h1>
                <p className="text-slate-500">No se encontraron datos para mostrar. Es posible que no haya registros para ti en el archivo subido.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Hola, {auth?.user?.name.split(',')[1] || auth?.user?.name}</h1>
                <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
                    Turno: {myData.turnoAsignado === 'TN' ? 'Tarde' : (myData.turnoAsignado === 'M' ? 'Mañana' : myData.turnoAsignado)}
                </span>
            </div>

            {/* Shifts Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold text-slate-700 mb-4">Mis Próximos Turnos</h2>
                <div className="flex space-x-4 overflow-x-auto pb-2">
                    {upcomingShifts.map(shift => (
                        <ShiftCard key={shift.date} date={shift.date} shiftCode={shift.code} />
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <DataCard
                    title="Total Horas (Periodo)"
                    value={myData.totalHoras.toFixed(2)}
                    subtext="Horas trabajadas en el periodo seleccionado"
                />
                <DataCard
                    title="Días de Vacaciones Restantes"
                    value={myData.dispVacaciones}
                    subtext={`${myData.acumVacaciones} día(s) tomados este año`}
                />
                <DataCard
                    title="Horas de Médico Disponibles"
                    value={myData.dispMedico.toFixed(2)}
                    subtext={`${myData.acumMedico.toFixed(2)}h usadas este año`}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Incidencias del Periodo</h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600">Pausas para Fumar (TAJ)</span>
                            <div className="text-right">
                                <span className="block font-bold text-slate-800">{myData.numTAJ} veces</span>
                                <span className="text-xs text-slate-500">{myData.hTAJ.toFixed(2)}h total</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600">Retrasos</span>
                            <div className="text-right">
                                <span className="block font-bold text-slate-800">{myData.numRetrasos} veces</span>
                                <span className="text-xs text-slate-500">{myData.tiempoRetrasos.toFixed(2)}h total</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Resumen de Permisos</h2>
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-2 border rounded-lg">
                            <p className="text-slate-500 text-xs uppercase">H. Libre Disp.</p>
                            <p className="font-bold text-lg text-slate-800">{myData.dispHLDisp.toFixed(1)}h</p>
                            <p className="text-xs text-slate-400">Restantes</p>
                        </div>
                        <div className="p-2 border rounded-lg">
                            <p className="text-slate-500 text-xs uppercase">H. Ley Familias</p>
                            <p className="font-bold text-lg text-slate-800">{myData.dispHLF.toFixed(1)}h</p>
                            <p className="text-xs text-slate-400">Restantes</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(MyDashboard);
