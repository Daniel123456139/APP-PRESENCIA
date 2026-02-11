/**
 * GRÁFICO TOP 5 DESVIACIONES
 * 
 * Muestra los 5 empleados con más trabajos NO urgentes
 * en formato de barras horizontales
 */

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { EmployeePriorityAnalysis } from '../../types';
import { formatHours } from '../../services/priorityAnalysisService';
import { TrendingDown } from 'lucide-react';

interface PriorityTopDeviationsChartProps {
    employeeData: EmployeePriorityAnalysis[];
}

const PriorityTopDeviationsChart: React.FC<PriorityTopDeviationsChartProps> = ({ employeeData }) => {
    // Obtener TOP 5 por trabajos NO urgentes
    const top5 = [...employeeData]
        .sort((a, b) => b.horasNoUrgentes - a.horasNoUrgentes) // Ordenar por HORAS, no solo trabajos
        .slice(0, 5)
        .map(emp => ({
            name: emp.employeeName,
            trabajosNoUrgentes: emp.trabajosNoUrgentes,
            horasNoUrgentes: emp.horasNoUrgentes,
            displayLabel: `${emp.trabajosNoUrgentes} Art. | ${formatHours(emp.horasNoUrgentes)}`
        }));

    // Gradiente rojo para barras
    const barColors = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];

    if (top5.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                    <TrendingDown className="w-7 h-7 text-red-600" />
                    TOP 5 Empleados con Más Desviaciones
                </h2>
                <div className="text-center py-12 text-slate-500">
                    No hay datos de desviaciones para mostrar
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <TrendingDown className="w-7 h-7 text-red-600" />
                TOP 5 Empleados con Más Desviaciones
            </h2>

            <p className="text-sm text-slate-600 mb-6">
                Empleados que dedicaron más horas a trabajos <strong className="text-red-600">NO urgentes</strong>
            </p>

            <ResponsiveContainer width="100%" height={320}>
                <BarChart
                    data={top5}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                        type="number"
                        stroke="#64748b"
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Horas en Trabajos NO Urgentes', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#64748b"
                        tick={{ fontSize: 12 }}
                        width={110}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-white p-4 rounded-lg shadow-xl border border-red-200">
                                        <p className="font-bold text-slate-800 mb-2">{data.name}</p>
                                        <p className="text-sm text-red-600">
                                            {data.trabajosNoUrgentes} Artículos NO Urgentes
                                        </p>
                                        <p className="text-sm font-semibold text-red-700">
                                            {formatHours(data.horasNoUrgentes)} dedicadas
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar
                        dataKey="horasNoUrgentes"
                        radius={[0, 8, 8, 0]}
                    >
                        <LabelList
                            dataKey="displayLabel"
                            position="right"
                            fill="#991b1b"
                            fontSize={11}
                            fontWeight={600}
                        />
                        {top5.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={barColors[index]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* Explicación */}
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-xs text-red-800">
                    <strong>⚠️ Desviaciones:</strong> Trabajos realizados en artículos con fecha de entrega superior a 7 días o sin fecha,
                    cuando deberían priorizarse artículos urgentes (≤7 días).
                </p>
            </div>
        </div>
    );
};

export default PriorityTopDeviationsChart;
