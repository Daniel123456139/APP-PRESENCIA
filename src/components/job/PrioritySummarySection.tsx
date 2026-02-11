/**
 * SECCIÓN DE RESUMEN GENERAL
 * 
 * Muestra:
 * - KPI principal (% Cumplimiento de Prioridad)
 * - Gráfico de dona (trabajos urgentes vs no urgentes)
 * - Métricas clave con horas
 */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { GlobalPriorityStats } from '../../types';
import { formatHours } from '../../services/priorityAnalysisService';

interface PrioritySummarySectionProps {
    stats: GlobalPriorityStats;
}

const COLORS = {
    URGENT: '#10b981', // green-500
    NON_URGENT: '#ef4444' // red-500
};

const PrioritySummarySection: React.FC<PrioritySummarySectionProps> = ({ stats }) => {
    // Datos para el gráfico de dona
    const chartData = [
        { name: 'Trabajos Urgentes (Correctos)', value: stats.trabajosCorrectos, hours: stats.horasCorrectas },
        { name: 'Trabajos NO Urgentes (Desviaciones)', value: stats.desviaciones, hours: stats.horasDesviadas }
    ];

    // Custom label para mostrar el total en el centro
    const renderCustomLabel = () => {
        return (
            <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-700 font-bold text-2xl"
            >
                {stats.totalArticulos}
            </text>
        );
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <div className="w-3 h-8 bg-gradient-to-b from-violet-600 to-indigo-600 rounded-full" />
                Resumen General
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* KPI Principal */}
                <div className="flex flex-col justify-center">
                    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-8 border-2 border-violet-200">
                        <h3 className="text-sm font-semibold text-violet-700 uppercase tracking-wide mb-2">
                            Cumplimiento de Prioridad
                        </h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">
                                {stats.tasaExito.toFixed(0)}
                            </span>
                            <span className="text-3xl font-bold text-violet-600">%</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-3">
                            del total de trabajos fueron en artículos urgentes
                        </p>
                    </div>

                    {/* Métricas Detalladas */}
                    <div className="mt-6 space-y-3">
                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-green-500" />
                                <span className="font-semibold text-slate-700">Trabajos Urgentes (Correctos)</span>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-green-700">{stats.trabajosCorrectos}</div>
                                <div className="text-sm text-green-600">{formatHours(stats.horasCorrectas)}</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-red-500" />
                                <span className="font-semibold text-slate-700">Trabajos NO Urgentes (Desviaciones)</span>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-red-700">{stats.desviaciones}</div>
                                <div className="text-sm text-red-600">{formatHours(stats.horasDesviadas)}</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-100 rounded-lg border border-slate-300">
                            <span className="font-semibold text-slate-700">Total Artículos Analizados</span>
                            <div className="text-xl font-bold text-slate-800">{stats.totalArticulos}</div>
                        </div>
                    </div>
                </div>

                {/* Gráfico de Dona */}
                <div className="flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={120}
                                paddingAngle={2}
                                dataKey="value"
                                label={false}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={index === 0 ? COLORS.URGENT : COLORS.NON_URGENT}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                                                <p className="font-semibold text-slate-800">{data.name}</p>
                                                <p className="text-sm text-slate-600">Trabajos: {data.value}</p>
                                                <p className="text-sm text-slate-600">Horas: {formatHours(data.hours)}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>

                    {/* Leyenda Manual */}
                    <div className="flex flex-col gap-2 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-green-500" />
                            <span className="text-sm text-slate-600">
                                {stats.trabajosCorrectos} Trabajos Urgentes | {formatHours(stats.horasCorrectas)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-red-500" />
                            <span className="text-sm text-slate-600">
                                {stats.desviaciones} Trabajos NO Urgentes | {formatHours(stats.horasDesviadas)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrioritySummarySection;
