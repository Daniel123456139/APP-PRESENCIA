
import React, { useEffect, useState, useMemo } from 'react';
import { ProcessedDataRow, Shift, RawDataRow, Role } from '../../types';
import { fetchFichajes } from '../../services/apiService';
import { processData } from '../../services/dataProcessor';
import { ANNUAL_CREDITS } from '../../constants';
import { toISODateLocal } from '../../utils/localDate';

interface EmployeeDetailDashboardProps {
    employeeId: number;
    employeeName: string;
    // periodData is now optional/initial, we will fetch fresh data
    periodData?: ProcessedDataRow;
    startDate: string;
    endDate: string;
    shifts: Shift[];
    companyNonWorkingSet?: Set<string>;
}

interface YtdStats {
    vacationUsed: number;
    medicalHoursUsed: number;
    libreDispHoursUsed: number;
    leyFamiliasHoursUsed: number;
}

const EmployeeDetailDashboard: React.FC<EmployeeDetailDashboardProps> = ({
    employeeId,
    employeeName,
    startDate,
    endDate,
    shifts,
    companyNonWorkingSet
}) => {
    const [loading, setLoading] = useState(true);
    const [processedRow, setProcessedRow] = useState<ProcessedDataRow | null>(null);
    const [ytdStats, setYtdStats] = useState<YtdStats>({
        vacationUsed: 0,
        medicalHoursUsed: 0,
        libreDispHoursUsed: 0,
        leyFamiliasHoursUsed: 0
    });

    // Fetch All Data (YTD + Period) specific to this employee
    useEffect(() => {
        const loadEmployeeData = async () => {
            setLoading(true);
            try {
                const currentYear = new Date().getFullYear();
                const ytdStart = `${currentYear}-01-01`;
                const today = toISODateLocal(new Date());

                // 1. Fetch YTD (for Balances) and Period (for Dashboard metrics) in parallel
                // Use employeeId filter strictly
                const [ytdRaw, periodRaw] = await Promise.all([
                    fetchFichajes(ytdStart, today, employeeId.toString(), '00:00', '23:59'),
                    fetchFichajes(startDate, endDate, employeeId.toString(), '00:00', '23:59')
                ]);

                // 2. Process YTD Stats
                let vac = 0, med = 0, ld = 0, lf = 0;

                const getDuration = (r: RawDataRow) => {
                    if (r.Inicio && r.Fin && r.Inicio !== '00:00' && r.Fin !== '00:00') {
                        const [h1, m1] = r.Inicio.split(':').map(Number);
                        const [h2, m2] = r.Fin.split(':').map(Number);
                        return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
                    }
                    return 8;
                };

                ytdRaw.forEach(r => {
                    if (r.IDOperario !== employeeId) return;
                    if (!r.MotivoAusencia) return;
                    // Filter absences (rows with Entrada=0 and Motivo or just Motivo)
                    if (r.Entrada === 1) return;

                    const dur = getDuration(r);
                    if (r.MotivoAusencia === 5 || r.MotivoAusencia === 8) vac += dur / 8; // Days
                    if (r.MotivoAusencia === 2) med += dur;
                    if (r.MotivoAusencia === 7) ld += dur;
                    if (r.MotivoAusencia === 13) lf += dur;
                });

                setYtdStats({
                    vacationUsed: vac,
                    medicalHoursUsed: med,
                    libreDispHoursUsed: ld,
                    leyFamiliasHoursUsed: lf
                });

                // 3. Process Period Data (Calculate Hours, TAJ, etc)
                // We use processData from dataProcessor ensuring we treat this user as active
                const tempUser = { id: employeeId, name: employeeName, role: Role.Employee };
                const analysisRange = {
                    start: new Date(`${startDate}T00:00:00`),
                    end: new Date(`${endDate}T23:59:59`)
                };

                const processedResult = processData(
                    periodRaw,
                    [tempUser],
                    shifts,
                    undefined,
                    analysisRange,
                    companyNonWorkingSet
                );

                const row = processedResult.find(p => p.operario === employeeId);
                setProcessedRow(row || null);

            } catch (err) {
                console.error("Error fetching employee dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadEmployeeData();
    }, [employeeId, startDate, endDate, shifts, companyNonWorkingSet, employeeName]);

    // upcoming shifts
    const upcomingShifts = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return shifts
            .filter(s => s.employeeId === employeeId && new Date(s.date) >= today)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 7);
    }, [shifts, employeeId]);

    // Fallback if no specific shifts (show days of week)
    const nextDays = useMemo(() => {
        const days = [];
        const d = new Date();
        for (let i = 0; i < 7; i++) {
            days.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }
        return days;
    }, []);

    const pData = processedRow; // Shortcut for UI

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Hola, {employeeName}</h2>
                    {pData && <p className="text-slate-500 mt-1">Turno: <span className="font-semibold text-blue-600">{pData.turnoAsignado || 'Sin Turno'}</span></p>}
                </div>
                <div className="bg-blue-50 px-4 py-2 rounded-lg text-blue-700 font-medium text-sm">
                    {loading ? 'Actualizando datos...' : 'Vista Detallada'}
                </div>
            </div>

            {/* Next Shifts Strip */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-700 mb-4">Mis Próximos Turnos</h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                    {nextDays.map((date, idx) => {
                        const dateStr = toISODateLocal(date);
                        const shift = upcomingShifts.find(s => s.date === dateStr);
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
                        const dayNum = date.getDate();
                        const bgColor = isWeekend ? 'bg-rose-100 text-rose-800' : 'bg-pink-100 text-pink-800';

                        return (
                            <div key={idx} className={`flex flex-col items-center justify-center min-w-[80px] h-24 rounded-xl ${bgColor}`}>
                                <span className="text-xs font-bold mb-1">{dayName}</span>
                                <span className="text-2xl font-black mb-1">{dayNum}</span>
                                <span className="text-[10px] font-medium opacity-80">{shift ? shift.shiftType : (isWeekend ? 'Libre' : 'Laborable')}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* KPI Cards Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Total Period Hours */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-sm font-medium text-slate-500 mb-2">Total Horas (Periodo)</p>
                    <div className="text-4xl font-bold text-slate-800">
                        {pData ? pData.totalHoras.toFixed(2) : '0.00'}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Horas trabajadas en el periodo seleccionado</p>
                </div>

                {/* Vacation Balance */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-sm font-medium text-slate-500 mb-2">Días de Vacaciones Restantes</p>
                    <div className="text-4xl font-bold text-slate-800">
                        {loading ? '-' : (ANNUAL_CREDITS.VACATION_DAYS - ytdStats.vacationUsed).toFixed(0)}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        {loading ? 'Cargando...' : `${ytdStats.vacationUsed.toFixed(1)} día(s) tomados este año`}
                    </p>
                </div>

                {/* Medical Balance */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-sm font-medium text-slate-500 mb-2">Horas de Médico Disponibles</p>
                    <div className="text-4xl font-bold text-slate-800">
                        {loading ? '-' : (ANNUAL_CREDITS.MEDICO_HOURS - ytdStats.medicalHoursUsed).toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        {loading ? 'Cargando...' : `${ytdStats.medicalHoursUsed.toFixed(2)}h usados este año`}
                    </p>
                </div>
            </div>

            {/* KPI Cards Row 2 (Detailed Incidents & Permits) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Incidents / Anomalies */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-700 mb-4">Incidencias del Periodo</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-slate-600">Pausas para Fumar (TAJ)</span>
                            <div className="text-right">
                                <span className="block font-bold text-slate-800">{pData?.numTAJ || 0} veces</span>
                                <span className="text-xs text-slate-400">{pData?.hTAJ.toFixed(2) || '0.00'}h total</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-slate-600">Retrasos</span>
                            <div className="text-right">
                                <span className="block font-bold text-slate-800">{pData?.numRetrasos || 0} veces</span>
                                <span className="text-xs text-slate-400">{pData?.tiempoRetrasos.toFixed(2) || '0.00'}h total</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-slate-600">Exceso Jornada (+1h)</span>
                            <div className="text-right">
                                <span className="block font-bold text-slate-800">{pData?.excesoJornada1.toFixed(2) || '0.00'}h</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Permits Summary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-700 mb-4">Resumen de Permisos</h3>
                    <div className="flex gap-4">
                        <div className="flex-1 p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">H. Libre Disp.</p>
                            <p className="text-2xl font-bold text-slate-800">
                                {loading ? '-' : (ANNUAL_CREDITS.LIBRE_DISPOSICION_HOURS - ytdStats.libreDispHoursUsed).toFixed(1)}h
                            </p>
                            <p className="text-[10px] text-slate-400">Restantes</p>
                        </div>
                        <div className="flex-1 p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">H. Ley Familias</p>
                            <p className="text-2xl font-bold text-slate-800">
                                {loading ? '-' : (ANNUAL_CREDITS.LEY_FAMILIAS_HOURS - ytdStats.leyFamiliasHoursUsed).toFixed(1)}h
                            </p>
                            <p className="text-[10px] text-slate-400">Restantes</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default EmployeeDetailDashboard;
