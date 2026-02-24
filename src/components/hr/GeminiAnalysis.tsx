

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SvgIcon } from '../shared/Nav';
import { RawDataRow } from '../../types';
import { getGeminiAnalysis } from '../../services/geminiService';
import { useMotivos, useOperarios } from '../../hooks/useErp';
interface GeminiAnalysisProps {
    analysisResult: string;
    setAnalysisResult: React.Dispatch<React.SetStateAction<string>>;
    erpData: RawDataRow[];
}

const SparklesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
);

const GeminiAnalysis: React.FC<GeminiAnalysisProps> = ({
    analysisResult,
    setAnalysisResult,
    erpData
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { motivos } = useMotivos();
    const { operarios } = useOperarios();

    const handleRunAnalysis = async () => {
        if (!erpData || erpData.length === 0) {
            setError("No hay datos disponibles para analizar.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await getGeminiAnalysis(erpData, motivos, operarios);
            setAnalysisResult(result);
        } catch (err: any) {
            setError(err.message || "Error al generar el análisis.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = React.useCallback(() => {
        if (!analysisResult) return;

        const header = "Análisis de IA de Gemini (basado en el archivo completo subido)\n===========================================================\n\n";
        const content = header + analysisResult;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const date = new Date().toISOString().split('T')[0];
        link.download = `analisis_gemini_${date}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [analysisResult]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col justify-center items-center h-full min-h-[300px] text-center p-6 bg-slate-50/70 rounded-lg">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-purple-500 mb-4"></div>
                    <h3 className="text-lg font-medium text-slate-800">Analizando Datos con Gemini AI...</h3>
                    <p className="mt-1 text-sm text-slate-500">Esto puede tardar unos segundos. Estamos procesando los registros día por día.</p>
                </div>
            );
        }

        if (!analysisResult) {
            return (
                <div className="flex flex-col justify-center items-center h-full min-h-[200px] text-center p-6 bg-slate-50/70 rounded-lg border border-dashed border-slate-300">
                    <SparklesIcon />
                    <h3 className="mt-4 text-lg font-medium text-slate-800">Análisis Inteligente Disponible</h3>
                    <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto mb-6">
                        Utiliza la IA de Google Gemini para detectar patrones, jornadas irregulares y generar un informe detallado de incidencias automáticamente.
                    </p>
                    <button
                        onClick={handleRunAnalysis}
                        className="px-6 py-3 bg-purple-600 text-white font-bold rounded-full shadow-lg hover:bg-purple-700 transition-all transform hover:scale-105 flex items-center"
                    >
                        <span className="mr-2">✨</span> Generar Análisis con IA
                    </button>
                    {error && <p className="mt-4 text-red-600 text-sm font-semibold">{error}</p>}
                </div>
            );
        }

        return (
            <div className="prose prose-sm max-w-none prose-slate prose-headings:font-semibold prose-headings:text-slate-800 prose-h2:mt-6 prose-h2:mb-2 prose-table:w-full prose-table:border-collapse prose-table:border prose-table:border-slate-400 prose-thead:bg-slate-200 prose-thead:text-slate-700 prose-th:border prose-th:border-slate-400 prose-th:px-3 prose-th:py-2 prose-th:font-bold prose-th:text-left prose-td:border prose-td:border-slate-400 prose-td:px-3 prose-td:py-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult}</ReactMarkdown>
            </div>
        );
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-slate-800 flex items-center">
                    <SparklesIcon />
                    Análisis con IA (Gemini)
                </h2>
                {analysisResult && (
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleRunAnalysis}
                            className="flex items-center px-3 py-1.5 bg-slate-100 text-slate-700 font-semibold text-sm rounded-md hover:bg-slate-200 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Regenerar
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex items-center px-3 py-1.5 bg-emerald-600 text-white font-semibold text-sm rounded-md hover:bg-emerald-700 transition-colors"
                            aria-label="Descargar análisis como archivo de texto"
                        >
                            <SvgIcon type="download" className="h-4 w-4 mr-2" />
                            Descargar
                        </button>
                    </div>
                )}
            </div>
            {renderContent()}
        </div>
    );
};

export default GeminiAnalysis;
