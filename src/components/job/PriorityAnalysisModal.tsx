/**
 * MODAL DE ANÁLISIS DE PRIORIDADES
 * 
 * Componente modal para configurar y lanzar análisis:
 * - Selección de rango de fechas (DESDE/HASTA)
 * - Carga de archivo Excel "LISTADO DE CARGA"
 * - Validación de inputs
 */

import React, { useState, useEffect } from 'react';
import { X, Upload, Calendar, AlertCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { isValidExcelFile } from '../../services/excelPriorityService';
import SmartDateInput from '../shared/SmartDateInput';

interface PriorityAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExecute: (startDate: string, endDate: string, excelFile: File) => Promise<void>;
}

const PriorityAnalysisModal: React.FC<PriorityAnalysisModalProps> = ({
    isOpen,
    onClose,
    onExecute
}) => {
    // Estados
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Inicializar fechas al día anterior (default)
    useEffect(() => {
        if (isOpen) {
            const yesterday = subDays(new Date(), 1);
            const formattedDate = format(yesterday, 'yyyy-MM-dd');
            setStartDate(formattedDate);
            setEndDate(formattedDate);
            setExcelFile(null);
            setError(null);
        }
    }, [isOpen]);

    // Handler de cambio de archivo
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setError(null);

        if (file) {
            if (!isValidExcelFile(file)) {
                setError('El archivo debe ser un Excel válido (.xlsx o .xls)');
                setExcelFile(null);
                return;
            }
            setExcelFile(file);
        }
    };

    // Validación antes de ejecutar
    const validateInputs = (): boolean => {
        if (!startDate || !endDate) {
            setError('Debe seleccionar fechas DESDE y HASTA');
            return false;
        }

        if (new Date(startDate) > new Date(endDate)) {
            setError('La fecha DESDE no puede ser posterior a HASTA');
            return false;
        }

        if (!excelFile) {
            setError('Debe adjuntar el archivo Excel "LISTADO DE CARGA"');
            return false;
        }

        return true;
    };

    // Handler de ejecución
    const handleExecute = async () => {
        if (!validateInputs()) return;

        setIsLoading(true);
        setError(null);

        try {
            await onExecute(startDate, endDate, excelFile!);
            // onClose(); // El componente padre cerrará el modal tras éxito
        } catch (err) {
            setError((err as Error).message || 'Error al procesar el análisis');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Upload className="w-7 h-7" />
                            ANÁLISIS DE PRIORIDADES
                        </h2>
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="text-white/80 hover:text-white transition-colors disabled:opacity-50"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-violet-100 mt-2 text-sm">
                        Configure el periodo y adjunte el archivo Excel LISTADO DE CARGA
                    </p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Error Alert */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-red-800 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-violet-600" />
                                DESDE
                            </label>
                            <SmartDateInput
                                value={startDate}
                                onChange={setStartDate}
                                disabled={isLoading}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-violet-600" />
                                HASTA
                            </label>
                            <SmartDateInput
                                value={endDate}
                                onChange={setEndDate}
                                disabled={isLoading}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Excel Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <Upload className="w-4 h-4 text-violet-600" />
                            LISTADO DE CARGA (Excel)
                        </label>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                disabled={isLoading}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                        {excelFile && (
                            <p className="mt-2 text-sm text-green-600 flex items-center gap-2">
                                ✓ Archivo seleccionado: <span className="font-semibold">{excelFile.name}</span>
                            </p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                            Archivo debe contener hoja "BASE DATOS" con datos desde fila 44
                        </p>
                    </div>

                    {/* Información Adicional */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <h3 className="font-semibold text-indigo-900 text-sm mb-2">
                            📌 Criterio de Urgencia
                        </h3>
                        <ul className="text-xs text-indigo-700 space-y-1">
                            <li>• <strong>URGENTE</strong>: Fecha requerida ≤ 7 días</li>
                            <li>• <strong>NO URGENTE</strong>: Fecha requerida &gt; 7 días o sin fecha</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-5 py-2.5 text-slate-700 hover:bg-slate-200 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleExecute}
                        disabled={isLoading || !excelFile}
                        className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                Ejecutar Auditoría
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PriorityAnalysisModal;
