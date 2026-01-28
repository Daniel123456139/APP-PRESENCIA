
import React, { useState, useMemo, useCallback } from 'react';
import { RawDataRow, ProcessedDataRow } from '../../types';
import { processData } from '../../services/dataProcessor';
import { DEPARTMENTS } from '../../constants';
import BarChart from '../shared/charts/BarChart';
import DoughnutChart from '../shared/charts/DoughnutChart';
import KpiCard from '../shared/charts/KpiCard';
import { SvgIcon } from '../shared/Nav';
import { toISODateLocal, parseLocalDateTime, parseISOToLocalDate } from '../../utils/localDate';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#F97316'];

const ChartEmptyState: React.FC<{ title: string }> = ({ title }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-[300px] bg-slate-50/70 rounded-md">
            <p className="text-slate-500">No hay datos para mostrar.</p>
        </div>
    </div>
);

interface AggregatedStats {
    totalHoras: number;
    excesoJornada1: number;
    numRetrasos: number;
    hMedico: number;
    hVacaciones: number;
    hLDisp: number;
    hLeyFam: number;
    asOficiales: number;
    byDept: Map<string, { excesoJornada1: number, numRetrasos: number, employeeCount: Set<number> }>;
}


const VisualDashboard: React.FC<{ erpData: RawDataRow[] }> = ({ erpData }) => {
    const today = new Date();
    const firstDayOfMonth = toISODateLocal(new Date(today.getFullYear(), today.getMonth(), 1));
    const lastDayOfMonth = toISODateLocal(new Date(today.getFullYear(), today.getMonth() + 1, 0));

    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
    const [fechaInicio, setFechaInicio] = useState<string>(firstDayOfMonth);
    const [fechaFin, setFechaFin] = useState<string>(lastDayOfMonth);
    
    const filteredRawData = useMemo(() => {
        let data = erpData;
        if (selectedDepartment !== 'all') {
            data = data.filter(row => row.DescDepartamento === selectedDepartment);
        }
        if (fechaInicio) data = data.filter(row => row.Fecha >= fechaInicio);
        if (fechaFin) data = data.filter(row => row.Fecha <= fechaFin);
        return data;
    }, [selectedDepartment, fechaInicio, fechaFin, erpData]);

    const processedData: ProcessedDataRow[] = useMemo(() => {
        if (!filteredRawData.length) return [];
        return processData(filteredRawData);
    }, [filteredRawData]);

    const handleClearFilters = useCallback(() => {
        setSelectedDepartment('all');
        setFechaInicio(firstDayOfMonth);
        setFechaFin(lastDayOfMonth);
    }, [firstDayOfMonth, lastDayOfMonth]);

    const aggregatedData = useMemo(() => {
        const initial: AggregatedStats = {
            totalHoras: 0, excesoJornada1: 0, numRetrasos: 0,
            hMedico: 0, hVacaciones: 0, hLDisp: 0, hLeyFam: 0, asOficiales: 0,
            byDept: new Map<string, { excesoJornada1: number, numRetrasos: number, employeeCount: Set<number> }>()
        };

        if (!processedData) return initial;

        return processedData.reduce((acc: AggregatedStats, curr) => {
            acc.totalHoras += curr.totalHoras;
            acc.excesoJornada1 += curr.excesoJornada1;
            acc.numRetrasos += curr.numRetrasos;
            acc.hMedico += curr.hMedico;
            acc.hVacaciones += curr.hVacaciones;
            acc.hLDisp += curr.hLDisp;
            acc.hLeyFam += curr.hLeyFam;
            acc.asOficiales += curr.asOficiales;

            const dept = curr.colectivo;
            if (!acc.byDept.has(dept)) {
                acc.byDept.set(dept, { excesoJornada1: 0, numRetrasos: 0, employeeCount: new Set() });
            }
            const deptData = acc.byDept.get(dept)!;
            deptData.excesoJornada1 += curr.excesoJornada1;
            deptData.numRetrasos += curr.numRetrasos;
            deptData.employeeCount.add(curr.operario);
            
            return acc;
        }, initial);
    }, [processedData]);
    
    const totalAbsenceDays = aggregatedData.hVacaciones + (aggregatedData.hMedico + aggregatedData.hLDisp + aggregatedData.hLeyFam + aggregatedData.asOficiales) / 8;

    const absenceDistributionData = [
        { label: 'Médico', value: aggregatedData.hMedico },
        { label: 'Vacaciones', value: aggregatedData.hVacaciones * 8 },
        { label: 'Libre Disp.', value: aggregatedData.hLDisp },
        { label: 'Ley Familias', value: aggregatedData.hLeyFam },
        { label: 'As. Oficiales', value: aggregatedData.asOficiales },
    ].filter(d => d.value > 0);

    const dailyHoursData = useMemo(() => {
        if (!filteredRawData.length) return [];
        const hoursByDay = new Map<string, number>();

        const dailyRecords = filteredRawData.reduce<Record<string, { ins: number[], outs: number[] }>>((acc, row) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(row.Fecha) || !/^\d{2}:\d{2}:\d{2}$/.test(row.Hora)) return acc;
            const key = `${row.IDOperario}-${row.Fecha}`;
            if (!acc[key]) acc[key] = { ins: [], outs: [] };
            
            const dateTime = parseLocalDateTime(row.Fecha, row.Hora).getTime();
            
            if (row.Entrada === 1) acc[key].ins.push(dateTime);
            else if (row.MotivoAusencia === 1) acc[key].outs.push(dateTime);
            return acc;
        }, {});
        
        Object.values(dailyRecords).forEach((records: { ins: number[], outs: number[] }) => {
            if (records.ins.length > 0 && records.outs.length > 0) {
                const firstIn = Math.min(...records.ins);
                const lastOut = Math.max(...records.outs);
                const dateKey = toISODateLocal(new Date(firstIn));
                if (lastOut > firstIn) {
                    const workedHours = (lastOut - firstIn) / (1000 * 60 * 60);
                    hoursByDay.set(dateKey, (hoursByDay.get(dateKey) || 0) + workedHours);
                }
            }
        });

        if (hoursByDay.size === 0) return [];
        const sorted = Array.from(hoursByDay.entries()).sort((a,b) => a[0].localeCompare(b[0]));
        return sorted.map(([date, hours]) => ({
            label: parseISOToLocalDate(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
            value: hours
        }));
    }, [filteredRawData]);

    const departmentOvertimeData = Array.from(aggregatedData.byDept.entries()).map(([dept, data]) => ({
        label: dept,
        value: data.employeeCount.size > 0 ? data.excesoJornada1 / data.employeeCount.size : 0,
    })).sort((a,b) => b.value - a.value);

    const departmentDelayData = Array.from(aggregatedData.byDept.entries()).map(([dept, data]) => ({
        label: dept,
        value: data.numRetrasos,
    })).sort((a,b) => b.value - a.value);

    const hasData = processedData && processedData.length > 0;
    const hasAbsenceData = absenceDistributionData.some(d => d.value > 0);
    const hasOvertimeData = departmentOvertimeData.some(d => d.value > 0);
    const hasDelayData = departmentDelayData.some(d => d.value > 0);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">Análisis Visual Global</h1>
            
            <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-slate-700">Filtrar por Sección</label>
                        <select value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 bg-white text-slate-900 rounded-md">
                            <option value="all">Todas las secciones</option>
                            {DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="vis-fechaInicio" className="block text-sm font-medium text-slate-700">Fecha Inicio</label>
                        <input type="date" id="vis-fechaInicio" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-slate-300 bg-white text-slate-900 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="vis-fechaFin" className="block text-sm font-medium text-slate-700">Fecha Fin</label>
                        <input type="date" id="vis-fechaFin" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-slate-300 bg-white text-slate-900 rounded-md shadow-sm"/>
                    </div>
                </div>
                 <div className="mt-4 flex justify-end">
                     <button onClick={handleClearFilters} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-md hover:bg-slate-700">
                        Limpiar Filtros
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Total Horas" value={hasData ? aggregatedData.totalHoras.toFixed(0) : '0'} description="Suma de horas computables" icon={<SvgIcon type="dashboard" className="h-6 w-6" />} color="blue"/>
                <KpiCard title="Total H. Extra" value={hasData ? aggregatedData.excesoJornada1.toFixed(0) : '0'} description="Horas sobre jornada estándar" icon={<SvgIcon type="shifts" className="h-6 w-6"/>} color="purple"/>
                <KpiCard title="Días Ausencia" value={hasData ? totalAbsenceDays.toFixed(1) : '0'} description="Ausencias justificadas (aprox)" icon={<SvgIcon type="sickleave" className="h-6 w-6"/>} color="emerald"/>
                <KpiCard title="Nº Retrasos" value={hasData ? aggregatedData.numRetrasos.toString() : '0'} description="Fichajes fuera de hora" icon={<SvgIcon type="late" className="h-6 w-6"/>} color="amber"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2">
                    {dailyHoursData && dailyHoursData.length > 0 ? (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full">
                            <BarChart 
                                data={dailyHoursData}
                                title="Evolución de Horas Totales por Día"
                            />
                        </div>
                    ) : <ChartEmptyState title="Evolución de Horas Totales por Día" />}
                 </div>
                 <div>
                    {hasAbsenceData ? (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full">
                            <DoughnutChart 
                                data={absenceDistributionData}
                                title="Distribución de Ausencias (en Horas)"
                                colors={CHART_COLORS}
                            />
                        </div>
                    ) : <ChartEmptyState title="Distribución de Ausencias (en Horas)" />}
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {hasOvertimeData ? (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <BarChart 
                            data={departmentOvertimeData}
                            title="Promedio de Horas Extra por Sección"
                            color="#10B981"
                            horizontal
                        />
                    </div>
                ) : <ChartEmptyState title="Promedio de Horas Extra por Sección" />}
                {hasDelayData ? (
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <BarChart 
                            data={departmentDelayData}
                            title="Total de Retrasos por Sección"
                            color="#F59E0B"
                            horizontal
                        />
                    </div>
                ) : <ChartEmptyState title="Total de Retrasos por Sección" />}
            </div>
        </div>
    );
};

export default VisualDashboard;
