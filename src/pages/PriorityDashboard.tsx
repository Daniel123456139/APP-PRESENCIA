/**
 * DASHBOARD PRINCIPAL DE ANÁLISIS DE PRIORIDADES
 * 
 * Integra todos los componentes:
 * - Resumen General (KPI + Dona)
 * - TOP 5 Desviaciones (Barras)
 * - Tabla Interactiva de Empleados
 * - Botones de Exportación (PDF/Excel)
 */

import React, { useState } from 'react';
import { Download, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { EmployeePriorityAnalysis, GlobalPriorityStats } from '../types';
import PrioritySummarySection from '../components/job/PrioritySummarySection';
import PriorityTopDeviationsChart from '../components/job/PriorityTopDeviationsChart';
import PriorityEmployeeTable from '../components/job/PriorityEmployeeTable';
import { exportPriorityDashboardToPDF, exportPriorityDataToExcel } from '../services/priorityExportService';

interface PriorityDashboardProps {
    globalStats: GlobalPriorityStats;
    employeeData: EmployeePriorityAnalysis[];
    dateRange: {
        startDate: string;
        endDate: string;
    };
    onBack?: () => void;
}

const PriorityDashboard: React.FC<PriorityDashboardProps> = ({
    globalStats,
    employeeData,
    dateRange,
    onBack
}) => {
    const [isExporting, setIsExporting] = useState(false);

    // Handler de exportación a PDF
    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            await exportPriorityDashboardToPDF(globalStats, employeeData, {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
        } catch (error) {
            console.error('Error exportando PDF:', error);
            alert('Error al generar el PDF. Por favor, intenta nuevamente.');
        } finally {
            setIsExporting(false);
        }
    };

    // Handler de exportación a Excel
    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            await exportPriorityDataToExcel(employeeData);
        } catch (error) {
            console.error('Error exportando Excel:', error);
            alert('Error al generar el Excel. Por favor, intenta nuevamente.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-indigo-50">
            <div id="priority-dashboard-capture" className="max-w-[1600px] mx-auto p-8">
                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => (onBack ? onBack() : undefined)}
                            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-violet-600 hover:bg-white rounded-lg transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Volver a Auditoría de Trabajos
                        </button>

                        <div className="flex gap-3" data-export-ignore="true">
                            <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/70 border border-slate-200 shadow-sm" data-export-ignore="true">
                                <button
                                    onClick={handleExportPDF}
                                    disabled={isExporting}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Download className="w-4 h-4" />
                                    PDF
                                </button>

                                <button
                                    onClick={handleExportExcel}
                                    disabled={isExporting}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Excel
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 mb-2">
                            ANÁLISIS DE PRIORIDADES
                        </h1>
                        <p className="text-slate-600">
                            Periodo: <span className="font-semibold">{dateRange.startDate}</span> hasta{' '}
                            <span className="font-semibold">{dateRange.endDate}</span>
                        </p>
                    </div>
                </header>

                {/* Secciones del Dashboard */}
                <div className="space-y-8">
                    {/* 1. Resumen General */}
                    <PrioritySummarySection stats={globalStats} />

                    {/* 2. TOP 5 Desviaciones */}
                    <PriorityTopDeviationsChart employeeData={employeeData} />

                    {/* 3. Tabla Interactiva */}
                    <PriorityEmployeeTable employeeData={employeeData} />
                </div>

                {/* Footer Info */}
                <div className="mt-8 text-center text-sm text-slate-500">
                    <p>
                        Dashboard generado automáticamente | Total empleados: {employeeData.length} |{' '}
                        Artículos analizados: {globalStats.totalArticulos}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PriorityDashboard;
