
import React, { useMemo, useState } from 'react';
import { RawDataRow } from '../../../types';
import { DEPARTMENTS } from '../../../constants';
import BarChart from '../../shared/charts/BarChart';
import DoughnutChart from '../../shared/charts/DoughnutChart';

interface AbsenteeismDashboardProps {
    erpData: RawDataRow[];
}

interface BradfordScore {
    employeeId: number;
    name: string;
    department: string;
    spells: number; // S: Número de bajas distintas
    days: number;   // D: Días totales
    score: number;  // S^2 * D
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const AbsenteeismDashboard: React.FC<AbsenteeismDashboardProps> = ({ erpData }) => {
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // 1. Data Processing for Bradford & Heatmap
    const { bradfordScores, heatmapData, totals } = useMemo(() => {
        const scoresMap = new Map<number, { spells: number, days: number, name: string, dept: string, lastEndDate: Date | null }>();
        const deptMonthlyAbsence = new Map<string, number[]>(); // Key: Dept, Val: Array[12] counts
        const typeCounts = { itat: 0, itec: 0, short: 0 }; // Days count

        // Initialize Dept Map
        DEPARTMENTS.forEach(d => deptMonthlyAbsence.set(d, Array(12).fill(0)));
        deptMonthlyAbsence.set('General', Array(12).fill(0));

        // Sort data by employee and date to detect spells correctly
        const sortedRows = [...erpData].sort((a, b) => {
            if (a.IDOperario !== b.IDOperario) return a.IDOperario - b.IDOperario;
            return new Date(a.Fecha).getTime() - new Date(b.Fecha).getTime();
        });

        sortedRows.forEach(row => {
            const date = new Date(row.Fecha);
            if (date.getFullYear() !== selectedYear) return;

            // Filter relevant absence codes: 10 (ITAT), 11 (ITEC), 2 (Medico - sometimes counted), let's stick to ITs and generic sickness for Bradford
            // Bradford usually applies to unplanned absence (Sick leave).
            // Codes: 10 (ITAT), 11 (ITEC). Assuming '02' (Medico) is just hours, not usually separate spell unless full day.
            // Let's count 10 and 11 as Bradford triggers.
            const isRelevantAbsence = (row.MotivoAusencia === 10 || row.MotivoAusencia === 11) && row.Entrada === 0;

            if (!isRelevantAbsence) return;

            // --- Bradford Calc ---
            let entry = scoresMap.get(row.IDOperario);
            if (!entry) {
                entry = { spells: 0, days: 0, name: row.DescOperario, dept: row.DescDepartamento || 'General', lastEndDate: null };
                scoresMap.set(row.IDOperario, entry);
            }

            // Check if this row is part of the previous spell or a new one
            // We assume rows are daily. If current date > lastEndDate + 1 day (allow weekends), it's a new spell.
            const currentDate = new Date(row.Fecha);
            const isNewSpell = !entry.lastEndDate ||
                (currentDate.getTime() - entry.lastEndDate.getTime() > (48 * 60 * 60 * 1000) + 1000); // > 2 days gap roughly

            if (isNewSpell) {
                entry.spells += 1;
            }
            entry.days += 1; // Assuming 1 row = 1 day logic for simplicity on ITs
            entry.lastEndDate = currentDate;

            // --- Heatmap Calc ---
            const month = date.getMonth();
            const dept = row.DescDepartamento || 'General';
            const currentDeptData = deptMonthlyAbsence.get(dept);
            if (currentDeptData) {
                currentDeptData[month] += 1;
            } else {
                // Handle unknown depts
                const fallback = deptMonthlyAbsence.get('General')!;
                fallback[month] += 1;
            }

            // --- Totals Calc ---
            if (row.MotivoAusencia === 10) typeCounts.itat++;
            else if (row.MotivoAusencia === 11) typeCounts.itec++;
            else typeCounts.short++;
        });

        // Finalize Bradford Scores
        const calculatedScores: BradfordScore[] = [];
        scoresMap.forEach((v, k) => {
            calculatedScores.push({
                employeeId: k,
                name: v.name,
                department: v.dept,
                spells: v.spells,
                days: v.days,
                score: (v.spells * v.spells) * v.days
            });
        });

        return {
            bradfordScores: calculatedScores.sort((a, b) => b.score - a.score),
            heatmapData: deptMonthlyAbsence,
            totals: typeCounts
        };
    }, [erpData, selectedYear]);

    // UI Helpers
    const getBradfordColor = (score: number) => {
        if (score >= 400) return 'text-red-600 bg-red-100 border-red-200';
        if (score >= 200) return 'text-orange-600 bg-orange-100 border-orange-200';
        if (score >= 50) return 'text-amber-600 bg-amber-100 border-amber-200';
        return 'text-green-600 bg-green-100 border-green-200';
    };

    const getHeatmapColor = (value: number) => {
        if (value === 0) return 'bg-slate-50';
        if (value < 5) return 'bg-red-50';
        if (value < 10) return 'bg-red-200';
        if (value < 20) return 'bg-red-300';
        return 'bg-red-500 text-white font-bold';
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <span className="text-3xl mr-2">📉</span>
                        Analítica de Absentismo
                    </h2>
                    <p className="text-slate-500 mt-1">Análisis de bajas, patrones de frecuencia y detección de riesgos.</p>
                </div>
                <div className="mt-4 sm:mt-0">
                    <label className="text-sm font-medium text-slate-700 mr-2">Año de Análisis:</label>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                        className="border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value={2023}>2023</option>
                        <option value={2024}>2024</option>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                    </select>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Días Perdidos</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">{totals.itat + totals.itec}</p>
                        </div>
                        <span className="text-2xl" title="Total de días laborables perdidos por bajas">📅</span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accidentes (ITAT)</p>
                            <p className="text-3xl font-bold text-red-600 mt-1">{totals.itat}</p>
                            <p className="text-xs text-slate-400">Días acumulados</p>
                        </div>
                        <span className="text-2xl" title="Bajas por Accidente de Trabajo">🚑</span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enfermedad (ITEC)</p>
                            <p className="text-3xl font-bold text-blue-600 mt-1">{totals.itec}</p>
                            <p className="text-xs text-slate-400">Días acumulados</p>
                        </div>
                        <span className="text-2xl" title="Bajas por Enfermedad Común">🩺</span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Casos Recurrentes</p>
                            <p className="text-3xl font-bold text-amber-600 mt-1">
                                {bradfordScores.filter(s => s.score >= 200).length}
                            </p>
                            <p className="text-xs text-slate-400">Empleados con alta frecuencia</p>
                        </div>
                        <span className="text-2xl" title="Empleados que superan el umbral de riesgo de frecuencia">⚠️</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ranking de Frecuencia (Bradford simplificado) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Ranking de Frecuencia de Bajas</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Identifica patrones de bajas cortas y repetitivas, que suelen impactar más a la operativa.
                                </p>
                            </div>
                            <div className="group relative">
                                <span className="cursor-help text-slate-400 hover:text-blue-500">ℹ️ Información</span>
                                <div className="absolute right-0 w-64 p-3 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none mt-1">
                                    Utilizamos el "Factor de Bradford" (S² × D): Se penaliza exponencialmente el número de bajas distintas (S) frente a la duración total (D).
                                    <br /><br />
                                    Ejemplo:
                                    <br />- 1 baja de 10 días = 10 puntos (Riesgo Bajo)
                                    <br />- 5 bajas de 2 días = 250 puntos (Riesgo Alto)
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-auto max-h-[400px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Empleado</th>
                                    <th className="px-6 py-3 text-center" title="Número de procesos de baja distintos">Nº Bajas</th>
                                    <th className="px-6 py-3 text-center" title="Total de días de baja acumulados">Días Totales</th>
                                    <th className="px-6 py-3 text-right">Nivel de Riesgo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bradfordScores.slice(0, 15).map(item => (
                                    <tr key={item.employeeId} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {item.name}
                                            <span className="block text-xs text-slate-400 font-normal">{item.department}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 font-bold text-xs text-slate-600">
                                                {item.spells}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-mono">{item.days}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`px-3 py-1 rounded-full font-bold text-xs border ${getBradfordColor(item.score)}`}>
                                                {item.score >= 400 ? 'MUY ALTO' :
                                                    item.score >= 200 ? 'ALTO' :
                                                        item.score >= 50 ? 'MEDIO' : 'BAJO'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {bradfordScores.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">No hay datos de absentismo para este año.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Resumen Simple y Distribución */}
                <div className="space-y-6">
                    {/* Top Absentismo Simple - NUEVA TARJETA */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Top 5 - Mayor Duración Total</h3>
                        <div className="space-y-3">
                            {[...bradfordScores].sort((a, b) => b.days - a.days).slice(0, 5).map((item, idx) => (
                                <div key={item.employeeId} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded">
                                    <div className="flex items-center">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${idx < 3 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                                            <p className="text-[10px] text-slate-400">{item.spells} bajas distintas</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-bold text-slate-700">{item.days} días</span>
                                    </div>
                                </div>
                            ))}
                            {bradfordScores.length === 0 && <p className="text-sm text-slate-400 italic">Sin datos disponibles.</p>}
                        </div>
                    </div>

                    {/* Gráfico Distribución */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Distribución por Tipo de Baja</h3>
                        <div className="flex justify-center h-64">
                            <DoughnutChart
                                title=""
                                data={[
                                    { label: 'Accidente (ITAT)', value: totals.itat },
                                    { label: 'Enfermedad (ITEC)', value: totals.itec }
                                ]}
                                colors={['#EF4444', '#3B82F6']}
                            />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                            <div className="p-2 bg-red-50 rounded border border-red-100">
                                <span className="block text-xs text-red-800 font-bold uppercase">Accidentes</span>
                                <span className="text-xl font-bold text-red-600">{totals.itat}</span>
                            </div>
                            <div className="p-2 bg-blue-50 rounded border border-blue-100">
                                <span className="block text-xs text-blue-800 font-bold uppercase">Enfermedades</span>
                                <span className="text-xl font-bold text-blue-600">{totals.itec}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Department Heatmap */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Mapa de Calor: Intensidad por Departamento</h3>
                    <p className="text-sm text-slate-500">Visualiza qué departamentos acumulan más días de baja a lo largo del año.</p>
                </div>

                <div className="overflow-x-auto">
                    <div className="min-w-max">
                        {/* Header Months */}
                        <div className="flex">
                            <div className="w-40 p-2 font-bold text-slate-400 text-xs uppercase tracking-wider">Departamento</div>
                            {MONTHS.map(m => (
                                <div key={m} className="w-16 p-2 text-center font-bold text-slate-600 text-xs">{m}</div>
                            ))}
                        </div>

                        {/* Rows */}
                        {DEPARTMENTS.map(dept => {
                            const monthsData = heatmapData.get(dept);
                            const totalDept = monthsData ? monthsData.reduce((a, b) => a + b, 0) : 0;
                            if (totalDept === 0) return null; // Hide empty rows for cleanliness

                            return (
                                <div key={dept} className="flex border-t border-slate-100 hover:bg-slate-50 transition-colors">
                                    <div className="w-40 p-3 text-sm font-medium text-slate-700 flex items-center">
                                        {dept}
                                    </div>
                                    {monthsData?.map((val, idx) => (
                                        <div key={idx} className="w-16 p-1 h-12 flex items-center justify-center">
                                            <div
                                                className={`w-full h-full rounded flex items-center justify-center text-xs transition-all ${getHeatmapColor(val)}`}
                                                title={`${val} días de baja en ${MONTHS[idx]}`}
                                            >
                                                {val > 0 && val}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AbsenteeismDashboard;
