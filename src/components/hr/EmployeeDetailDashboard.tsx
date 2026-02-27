
import React, { useEffect, useState, useMemo } from 'react';
import { ProcessedDataRow, Shift, RawDataRow, Role } from '../../types';
import { fetchFichajes } from '../../services/apiService';
import { getCalendarioOperario, CalendarioDia } from '../../services/erpApi';
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
    itatDays: number;
    itatHours: number;
    itecDays: number;
    itecHours: number;
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
        leyFamiliasHoursUsed: 0,
        itatDays: 0,
        itatHours: 0,
        itecDays: 0,
        itecHours: 0
    });

    // Fetch All Data (YTD + Period) specific to this employee
    useEffect(() => {
        const loadEmployeeData = async () => {
            setLoading(true);
            try {
                const cutoffDate = endDate;
                const ytdStart = `${cutoffDate.substring(0, 4)}-01-01`;

                // 1. Fetch YTD (for Balances) and Period (for Dashboard metrics) in parallel
                // Use employeeId filter strictly
                const [ytdRaw, periodRaw, annualCalendar]: [RawDataRow[], RawDataRow[], CalendarioDia[]] = await Promise.all([
                    fetchFichajes(ytdStart, cutoffDate, employeeId.toString(), '00:00', '23:59'),
                    fetchFichajes(startDate, endDate, employeeId.toString(), '00:00', '23:59'),
                    getCalendarioOperario(employeeId.toString(), ytdStart, cutoffDate).catch(() => [] as CalendarioDia[])
                ]);

                // 2. Process YTD Stats
                const vac = annualCalendar.reduce((acc, day) => {
                    if (String(day?.TipoDia ?? '') !== '2') return acc;
                    const dur = Number(day?.Duracion ?? 8);
                    if (Number.isFinite(dur) && dur > 0) return acc + (dur / 8);
                    return acc + 1;
                }, 0);

                let med = 0, ld = 0, lf = 0, itatHours = 0, itecHours = 0;
                const itatDaysSet = new Set<string>();
                const itecDaysSet = new Set<string>();

                const getDuration = (r: RawDataRow) => {
                    if (r.Inicio && r.Fin && r.Inicio !== '00:00' && r.Fin !== '00:00') {
                        const [h1, m1] = r.Inicio.split(':').map(Number);
                        const [h2, m2] = r.Fin.split(':').map(Number);
                        return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
                    }
                    return 8;
                };

                const getDateKey = (value: string) => {
                    if (!value) return '';
                    if (value.includes('T')) return value.split('T')[0];
                    if (value.includes(' ')) return value.split(' ')[0];
                    return value;
                };

                ytdRaw.forEach(r => {
                    if (r.IDOperario !== employeeId) return;
                    if (!r.MotivoAusencia) return;
                    // Filter absences (rows with Entrada=0 and Motivo or just Motivo)
                    if (r.Entrada === 1) return;

                    const dur = getDuration(r);
                    if (r.MotivoAusencia === 2) med += dur;
                    if (r.MotivoAusencia === 7) ld += dur;
                    if (r.MotivoAusencia === 13) lf += dur;
                    if (r.MotivoAusencia === 10) {
                        itatHours += dur;
                        itatDaysSet.add(getDateKey(r.Fecha));
                    }
                    if (r.MotivoAusencia === 11) {
                        itecHours += dur;
                        itecDaysSet.add(getDateKey(r.Fecha));
                    }
                });

                setYtdStats({
                    vacationUsed: vac,
                    medicalHoursUsed: med,
                    libreDispHoursUsed: ld,
                    leyFamiliasHoursUsed: lf,
                    itatDays: itatDaysSet.size,
                    itatHours,
                    itecDays: itecDaysSet.size,
                    itecHours
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
                    employeeId,
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
            .filter(s => s.operarioId === employeeId && new Date(s.date) >= today)
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

    const annualBalances = [
        {
            key: 'vac',
            label: 'Vacaciones',
            used: ytdStats.vacationUsed,
            total: ANNUAL_CREDITS.VACATION_DAYS,
            unit: 'dias'
        },
        {
            key: 'med',
            label: 'Medico',
            used: ytdStats.medicalHoursUsed,
            total: ANNUAL_CREDITS.MEDICO_HOURS,
            unit: 'h'
        },
        {
            key: 'ld',
            label: 'Libre Disp.',
            used: ytdStats.libreDispHoursUsed,
            total: ANNUAL_CREDITS.LIBRE_DISPOSICION_HOURS,
            unit: 'h'
        },
        {
            key: 'lf',
            label: 'Ley Familias',
            used: ytdStats.leyFamiliasHoursUsed,
            total: ANNUAL_CREDITS.LEY_FAMILIAS_HOURS,
            unit: 'h'
        }
    ];

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#ffe4e6] p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Vista individual</p>
                        <h2 className="text-3xl font-black text-slate-900 mt-1">{employeeName}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold">ID {String(employeeId).padStart(3, '0')}</span>
                            <span className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">Periodo {startDate} - {endDate}</span>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">Turno {pData?.turnoAsignado || 'N/D'}</span>
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-semibold">Horario {pData?.horarioReal || 'Sin fichajes'}</span>
                        </div>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 w-fit">
                        {loading ? 'Actualizando...' : 'Datos cargados'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Resumen claro del periodo</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] uppercase font-bold tracking-wide text-slate-500">Total horas</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{pData ? pData.totalHoras.toFixed(2) : '0.00'}h</p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-[11px] uppercase font-bold tracking-wide text-emerald-700">Presencia</p>
                            <p className="text-2xl font-black text-emerald-900 mt-1">{pData ? pData.presencia.toFixed(2) : '0.00'}h</p>
                        </div>
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                            <p className="text-[11px] uppercase font-bold tracking-wide text-blue-700">Justificadas</p>
                            <p className="text-2xl font-black text-blue-900 mt-1">{pData ? pData.horasJustificadas.toFixed(2) : '0.00'}h</p>
                        </div>
                        <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3">
                            <p className="text-[11px] uppercase font-bold tracking-wide text-fuchsia-700">Tot + justif</p>
                            <p className="text-2xl font-black text-fuchsia-900 mt-1">{pData ? pData.horasTotalesConJustificacion.toFixed(2) : '0.00'}h</p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-[11px] uppercase font-bold tracking-wide text-amber-700">Exceso</p>
                            <p className="text-xl font-black text-amber-900 mt-1">{pData ? pData.excesoJornada1.toFixed(2) : '0.00'}h</p>
                        </div>
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <p className="text-[11px] uppercase font-bold tracking-wide text-rose-700">Retrasos</p>
                            <p className="text-xl font-black text-rose-900 mt-1">{pData?.numRetrasos || 0} ({pData ? pData.tiempoRetrasos.toFixed(2) : '0.00'}h)</p>
                        </div>
                        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                            <p className="text-[11px] uppercase font-bold tracking-wide text-cyan-700">TAJ</p>
                            <p className="text-xl font-black text-cyan-900 mt-1">{pData?.numTAJ || 0} ({pData ? pData.hTAJ.toFixed(2) : '0.00'}h)</p>
                        </div>
                        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                            <p className="text-[11px] uppercase font-bold tracking-wide text-violet-700">Festivas</p>
                            <p className="text-xl font-black text-violet-900 mt-1">{pData ? pData.festivas.toFixed(2) : '0.00'}h</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Saldos anuales</h3>
                    <div className="space-y-4">
                        {annualBalances.map(item => {
                            const used = loading ? 0 : item.used;
                            const available = item.total - used;
                            const pct = item.total > 0 ? Math.min(100, Math.max(0, (used / item.total) * 100)) : 0;
                            const danger = available < 0;
                            return (
                                <div key={item.key} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-700">{item.label}</span>
                                        <span className={`font-bold ${danger ? 'text-rose-700' : 'text-slate-800'}`}>{loading ? '-' : `${available.toFixed(2)} ${item.unit}`}</span>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                                        <div className={`h-full ${danger ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }}></div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">Usado: {loading ? '-' : `${used.toFixed(2)} / ${item.total.toFixed(2)} ${item.unit}`}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Incidencias anuales (YTD)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50"><span className="text-slate-500">H. Medico</span><p className="font-black text-slate-900">{loading ? '-' : `${ytdStats.medicalHoursUsed.toFixed(2)}h`}</p></div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50"><span className="text-slate-500">H. Vacaciones</span><p className="font-black text-slate-900">{loading ? '-' : `${ytdStats.vacationUsed.toFixed(2)} dias`}</p></div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50"><span className="text-slate-500">H. Libre Disp.</span><p className="font-black text-slate-900">{loading ? '-' : `${ytdStats.libreDispHoursUsed.toFixed(2)}h`}</p></div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50"><span className="text-slate-500">H. Ley Familias</span><p className="font-black text-slate-900">{loading ? '-' : `${ytdStats.leyFamiliasHoursUsed.toFixed(2)}h`}</p></div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50"><span className="text-slate-500">Dias ITAT / Horas ITAT</span><p className="font-black text-slate-900">{loading ? '-' : `${ytdStats.itatDays} / ${ytdStats.itatHours.toFixed(2)}h`}</p></div>
                    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50"><span className="text-slate-500">Dias ITEC / Horas ITEC</span><p className="font-black text-slate-900">{loading ? '-' : `${ytdStats.itecDays} / ${ytdStats.itecHours.toFixed(2)}h`}</p></div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Proximos 7 turnos</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {nextDays.map((date, idx) => {
                        const dateStr = toISODateLocal(date);
                        const shift = upcomingShifts.find(s => s.date === dateStr);
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
                        const shiftLabel = shift ? shift.shiftCode : (isWeekend ? 'LIBRE' : 'LAB');
                        return (
                            <div key={idx} className={`rounded-xl border p-3 text-center ${isWeekend ? 'bg-rose-50 border-rose-200' : 'bg-indigo-50 border-indigo-200'}`}>
                                <p className="text-[10px] font-bold tracking-wide text-slate-500">{dayName}</p>
                                <p className="text-2xl font-black text-slate-900">{date.getDate()}</p>
                                <p className="text-xs font-bold text-slate-700 mt-1">{shiftLabel}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default EmployeeDetailDashboard;
