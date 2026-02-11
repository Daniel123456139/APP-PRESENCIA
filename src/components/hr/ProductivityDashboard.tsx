import React, { useMemo, useState } from 'react';
import {
    BarChart3,
    PieChart,
    AlertTriangle,
    Clock,
    CheckCircle2,
    XCircle,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Layers,
    FileDown
} from 'lucide-react';
import { getImproductiveArticle } from '../../data/improductiveArticles';
import { exportProductivityDashboardToPDF } from '../../services/productivityDashboardExportService';
import { useNotification } from '../shared/NotificationContext';

interface DashboardProps {
    rows: any[];
    globalStats: {
        totalPresence: number;
        totalCovered: number;
        totalImproductiveProduced: number;
        totalGap: number;
        occupancy: number;
    };
    startDate: string;
    endDate: string;
    department: string;
    onClose: () => void;
}

export const ProductivityDashboard: React.FC<DashboardProps> = ({ rows, globalStats, startDate, endDate, department, onClose }) => {
    const [filterSection, setFilterSection] = useState<string>('all');
    const { showNotification } = useNotification();

    const getJobDurationHours = (job: any): number => {
        try {
            const cleanFecha = (job.FechaInicio || '').includes('T')
                ? job.FechaInicio.split('T')[0]
                : job.FechaInicio;
            let day: number, month: number, year: number;
            if (cleanFecha.includes('/')) {
                [day, month, year] = cleanFecha.split('/').map(Number);
            } else {
                [year, month, day] = cleanFecha.split('-').map(Number);
            }

            let cleanHora = job.HoraInicio || '00:00:00';
            if (cleanHora.includes('T')) cleanHora = cleanHora.split('T')[1];
            const [startHour, startMin] = cleanHora.split(':').map(Number);

            let cleanHoraEnd = job.HoraFin || '00:00:00';
            if (cleanHoraEnd.includes('T')) cleanHoraEnd = cleanHoraEnd.split('T')[1];
            const [endHour, endMin] = cleanHoraEnd.split(':').map(Number);

            const start = new Date(year, month - 1, day, startHour || 0, startMin || 0);
            const end = new Date(year, month - 1, day, endHour || 0, endMin || 0);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
            const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            return duration > 0 ? duration : 0;
        } catch {
            return 0;
        }
    };

    // 1. Process Data for Charts
    const statsBySection = useMemo(() => {
        const sections = new Map<string, {
            worked: number;
            improductive: number;
            gap: number;
            presence: number;
            count: number;
        }>();

        rows.forEach(row => {
            const section = row.emp.department || 'Sin Sección';
            const curr = sections.get(section) || { worked: 0, improductive: 0, gap: 0, presence: 0, count: 0 };

            curr.worked += row.totalJobTimeProduced;
            curr.improductive += row.improductiveTimeProduced;
            curr.gap += row.timeGap;
            curr.presence += row.totalPresence;
            curr.count++;

            sections.set(section, curr);
        });

        return Array.from(sections.entries()).map(([name, data]) => ({
            name,
            ...data,
            efficiency: data.presence > 0 ? ((data.worked - data.improductive) / data.presence) * 100 : 0
        })).sort((a, b) => b.efficiency - a.efficiency);
    }, [rows]);

    const filteredRows = useMemo(() => {
        if (filterSection === 'all') return rows;
        return rows.filter(row => (row.emp.department || 'Sin Sección') === filterSection);
    }, [rows, filterSection]);

    const topImproductiveEmployees = useMemo(() => {
        return [...filteredRows]
            .sort((a, b) => b.improductiveTimeProduced - a.improductiveTimeProduced)
            .slice(0, 5)
            .map(row => ({
                name: row.emp.name,
                hours: row.improductiveTimeProduced,
                percent: row.totalPresence > 0 ? (row.improductiveTimeProduced / row.totalPresence) * 100 : 0
            }));
    }, [filteredRows]);


    const filteredStats = useMemo(() => {
        if (filterSection === 'all') return globalStats;
        const sectionData = statsBySection.find(s => s.name === filterSection);
        if (!sectionData) return globalStats;

        return {
            totalPresence: sectionData.presence,
            totalCovered: sectionData.worked, // Conceptual mapping
            totalImproductiveProduced: sectionData.improductive,
            totalGap: sectionData.gap,
            occupancy: sectionData.presence > 0 ? (sectionData.worked / sectionData.presence) * 100 : 0
        };
    }, [filterSection, globalStats, statsBySection]);

    const activityRows = useMemo(() => {
        const map = new Map<string, { name: string; hours: number; count: number }>();
        filteredRows.forEach(row => {
            row.jobs.forEach((job: any) => {
                const article = getImproductiveArticle(job.IDArticulo);
                if (!article) return;
                const duration = getJobDurationHours(job);
                if (duration <= 0) return;
                const key = job.IDArticulo;
                const current = map.get(key) || { name: article.desc, hours: 0, count: 0 };
                current.hours += duration;
                current.count += 1;
                map.set(key, current);
            });
        });

        const totalImproductive = filteredStats.totalImproductiveProduced;
        return Array.from(map.entries())
            .map(([id, data]) => ({
                id,
                name: data.name,
                hours: data.hours,
                count: data.count,
                percent: totalImproductive > 0 ? (data.hours / totalImproductive) * 100 : 0
            }))
            .sort((a, b) => b.hours - a.hours);
    }, [filteredRows, filteredStats.totalImproductiveProduced]);

    // Calcular porcentajes globales para las tarjetas
    const pctProductive = filteredStats.totalPresence > 0
        ? ((filteredStats.totalCovered - filteredStats.totalImproductiveProduced) / filteredStats.totalPresence) * 100
        : 0;

    const pctImproductive = filteredStats.totalPresence > 0
        ? (filteredStats.totalImproductiveProduced / filteredStats.totalPresence) * 100
        : 0;

    const pctGap = filteredStats.totalPresence > 0
        ? (filteredStats.totalGap / filteredStats.totalPresence) * 100
        : 0;

    const handleExportPDF = async () => {
        try {
            showNotification('Generando PDF del dashboard...', 'info');
            await exportProductivityDashboardToPDF(
                filteredStats,
                topImproductiveEmployees,
                activityRows,
                statsBySection,
                {
                    startDate,
                    endDate,
                    department,
                    section: filterSection
                }
            );
            showNotification('✅ PDF generado correctamente', 'success');
        } catch (error) {
            console.error('Error exportando PDF dashboard:', error);
            showNotification('❌ Error al generar el PDF del dashboard', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto animate-in fade-in duration-200">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 className="w-8 h-8 text-indigo-600" />
                            Dashboard de Productividad Interactiva
                        </h2>
                        <p className="text-slate-500 text-sm">Análisis en tiempo real de eficiencia y costes ocultos</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100">Periodo: {startDate} - {endDate}</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100">Departamento: {department === 'all' ? 'Todos' : department}</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100">Seccion: {filterSection === 'all' ? 'Global' : filterSection}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportPDF}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                        >
                            <FileDown className="w-4 h-4" />
                            Exportar PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                        >
                            Cerrar Informe
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

                {/* 1. Filtros y Resumen KPI */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Control de Filtros */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 col-span-1 lg:col-span-4 flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Filter className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filtrar por Sección</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setFilterSection('all')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${filterSection === 'all'
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    Global
                                </button>
                                {statsBySection.map(s => (
                                    <button
                                        key={s.name}
                                        onClick={() => setFilterSection(s.name)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${filterSection === s.name
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl shadow-sm border border-emerald-200 relative overflow-hidden group">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-white/60 rounded-lg text-emerald-700">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <span className="text-emerald-700 font-bold bg-white/40 px-2 py-1 rounded text-xs">
                                    {pctProductive.toFixed(1)}%
                                </span>
                            </div>
                            <h3 className="text-emerald-900 text-sm font-bold uppercase tracking-wider">Tiempo Productivo</h3>
                            <p className="text-3xl font-black text-emerald-800 mt-1">
                                {(filteredStats.totalCovered - filteredStats.totalImproductiveProduced).toFixed(1)}h
                            </p>
                            <p className="text-emerald-700 text-xs mt-2 font-medium">Trabajo real efectivo</p>
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-y-1/4 translate-x-1/4 group-hover:scale-110 transition-transform">
                            <CheckCircle2 className="w-48 h-48" />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl shadow-sm border border-amber-200 relative overflow-hidden group">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-white/60 rounded-lg text-amber-700">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <span className="text-amber-700 font-bold bg-white/40 px-2 py-1 rounded text-xs">
                                    {pctImproductive.toFixed(1)}%
                                </span>
                            </div>
                            <h3 className="text-amber-900 text-sm font-bold uppercase tracking-wider">T. Improductivo</h3>
                            <p className="text-3xl font-black text-amber-800 mt-1">
                                {filteredStats.totalImproductiveProduced.toFixed(1)}h
                            </p>
                            <p className="text-amber-700 text-xs mt-2 font-medium">Limpieza, Mantenimiento, etc.</p>
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-y-1/4 translate-x-1/4 group-hover:scale-110 transition-transform">
                            <Clock className="w-48 h-48" />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-2xl shadow-sm border border-red-200 relative overflow-hidden group">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-white/60 rounded-lg text-red-700">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <span className="text-red-700 font-bold bg-white/40 px-2 py-1 rounded text-xs">
                                    {pctGap.toFixed(1)}%
                                </span>
                            </div>
                            <h3 className="text-red-900 text-sm font-bold uppercase tracking-wider">No Cubierto (GAP)</h3>
                            <p className="text-3xl font-black text-red-800 mt-1">
                                {filteredStats.totalGap.toFixed(1)}h
                            </p>
                            <p className="text-red-700 text-xs mt-2 font-medium">Tiempo pagado sin actividad registrada</p>
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-y-1/4 translate-x-1/4 group-hover:scale-110 transition-transform">
                            <AlertTriangle className="w-48 h-48" />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Horas Presencia</h3>
                        <p className="text-4xl font-black text-slate-800">
                            {filteredStats.totalPresence.toFixed(1)}h
                        </p>
                        <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden flex">
                            <div className="bg-emerald-500 h-full" style={{ width: `${pctProductive}%` }} />
                            <div className="bg-amber-400 h-full" style={{ width: `${pctImproductive}%` }} />
                            <div className="bg-red-400 h-full" style={{ width: `${pctGap}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                            <span>Prod.</span>
                            <span>Impr.</span>
                            <span>Gap</span>
                        </div>
                    </div>
                </div>

                {/* 2. Gráficos Detallados */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Top Improductivos */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <ArrowDownRight className="text-amber-500" />
                            Top 5 Mayores Tiempos Improductivos
                        </h3>
                        <div className="space-y-4">
                            {topImproductiveEmployees.map((emp, idx) => (
                                <div key={idx} className="relative">
                                    <div className="flex justify-between text-sm mb-1 z-10 relative">
                                        <span className="font-medium text-slate-700 truncate w-2/3">{emp.name}</span>
                                        <span className="font-bold text-amber-600">{emp.hours.toFixed(2)}h ({emp.percent.toFixed(0)}%)</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className="bg-amber-400 h-full rounded-full"
                                                style={{ width: `${topImproductiveEmployees[0]?.hours ? (emp.hours / topImproductiveEmployees[0].hours) * 100 : 0}%` }}
                                            />
                                    </div>
                                </div>
                            ))}
                            {topImproductiveEmployees.length === 0 && (
                                <p className="text-slate-400 py-4 text-center italic">No hay registros improductivos en este periodo.</p>
                            )}
                        </div>
                    </div>

                    {/* Desglose por Actividad / Artículo - NUEVO */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 col-span-1 lg:col-span-2">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Layers className="text-orange-500" />
                            Distribución por Actividad Improductiva
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activityRows.map(activity => (
                                <div key={activity.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{activity.id}</span>
                                        <h4 className="text-xs font-bold text-slate-700 mt-1 line-clamp-1" title={activity.name}>{activity.name}</h4>
                                    </div>
                                    <div className="mt-3 flex justify-between items-end">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-medium text-slate-400">{activity.count} veces</span>
                                            <span className="text-lg font-black text-orange-600">{activity.hours.toFixed(1)}h</span>
                                        </div>
                                        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-orange-100/50 text-orange-600">
                                            <span className="text-xs font-black">{activity.percent.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {activityRows.length === 0 && (
                                <div className="col-span-full py-10 text-center text-slate-400 italic">
                                    No se han detectado actividades improductivas en la selección actual.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desglose por Sección */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <PieChart className="text-indigo-500" />
                            Eficiencia por Sección
                        </h3>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {statsBySection.map(section => (
                                <div key={section.name} className="flex items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm mr-4">
                                        {section.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-bold text-slate-700 text-sm">{section.name}</h4>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${section.efficiency > 85 ? 'bg-emerald-100 text-emerald-700' :
                                                section.efficiency > 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {section.efficiency.toFixed(1)}% Efic.
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500">
                                            <span>Prod: {section.worked.toFixed(1)}h</span>
                                            <span>Imp: {section.improductive.toFixed(1)}h</span>
                                            <span>Pres: {section.presence.toFixed(1)}h</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
