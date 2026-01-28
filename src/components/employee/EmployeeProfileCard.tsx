/**
 * Componente de Ficha de Empleado
 * 
 * ARQUITECTURA HÍBRIDA:
 * - Usa hook useEmployeeData para merge API + Firestore
 * - NO maneja PII directamente, solo renderiza
 * - Actualización en tiempo real automática
 * 
 * @module EmployeeProfileCard
 */

import React, { useState, useEffect } from 'react';
import { useEmployeeData } from '../../hooks/useEmployeeData';
import { EmployeeProfile } from '../../types';
import { logEmployeeAccess } from '../../services/auditLogService';
import { exportEmployeeProfileToPDF } from '../../services/pdfExportService';
import logger from '../../utils/logger';
import { fetchFichajes } from '../../services/apiService';
import { toISODateLocal } from '../../utils/localDate';

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

export interface EmployeeProfileCardProps {
    employeeId: number;
    showCompetencias?: boolean;
    showNotas?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export const EmployeeProfileCard: React.FC<EmployeeProfileCardProps> = ({
    employeeId,
    showCompetencias = true,
    showNotas = true
}) => {
    const [activeTab, setActiveTab] = useState<'info' | 'historial'>('info');
    const [todayShift, setTodayShift] = useState<string | null>(null);

    // Fetch Turno de Hoy
    useEffect(() => {
        const fetchTodayShift = async () => {
            try {
                const todayStr = toISODateLocal(new Date());
                // Llamamos a fetchFichajes solo para hoy y para este empleado
                // Nota: fetchFichajes normalmente filtra en memoria si la API devuelve todo, 
                // o pasamos params si la API lo soporta. Según types.ts, fetchFichajes acepta params.
                // Firma: (startDate, endDate, departmentId?, startTime?, endTime?)
                // NO acepta employeeId directamente en la firma pública actual de apiService (según analicé antes),
                // pero miraré si puedo filtrar el resultado.

                const data = await fetchFichajes(todayStr, todayStr);
                const employeeData = data.find(row => row.IDOperario === employeeId);

                if (employeeData) {
                    setTodayShift(employeeData.TurnoTexto || employeeData.IDTipoTurno || 'No Asignado');
                } else {
                    setTodayShift('Sin registros hoy');
                }
            } catch (err) {
                logger.warn('Error fetching today shift', err);
                setTodayShift('Error cargando turno');
            }
        };

        if (employeeId) {
            fetchTodayShift();
        }
    }, [employeeId]);

    // Hook híbrido con tiempo real
    const { employee, loading, error, refresh } = useEmployeeData({
        employeeId,
        includeCompetencias: showCompetencias,
        includeNotas: showNotas,
        autoRefresh: true
    });

    // 📊 Registro de acceso automático (Audit Log)
    // 📊 Registro de acceso automático (Audit Log) - Deduplicado
    const loggedIdRef = React.useRef<string | null>(null);

    useEffect(() => {
        if (employee && employee.IDOperario) {
            const currentIdStr = employeeId.toString();

            // Solo registrar si es un ID diferente al último registrado en esta sesión de componente
            if (loggedIdRef.current !== currentIdStr) {
                logEmployeeAccess(currentIdStr, 'view', 'sistema@presencia.local')
                    .then(() => {
                        loggedIdRef.current = currentIdStr;
                    })
                    .catch(err => {
                        // Silenciar error de log para no bloquear UI, pero reportar una vez
                        if (loggedIdRef.current !== 'error') {
                            logger.warn('⚠️ Fallo en Audit Log (posible config Firebase):', err);
                            loggedIdRef.current = 'error'; // Evitar spam de errores
                        }
                    });
            }
        }
    }, [employee, employeeId]);

    // 📄 Handler de exportación PDF
    const handleExportPDF = () => {
        if (!employee) return;

        logEmployeeAccess(employeeId.toString(), 'export_pdf', 'sistema@presencia.local')
            .catch(err => logger.warn('⚠️ No se pudo registrar exportación:', err));

        exportEmployeeProfileToPDF(employee, {
            includeCompetencias: showCompetencias,
            includeNotas: showNotas,
            includeTimestamp: true
        }).catch(err => {
            logger.error('❌ Error exportando PDF:', err);
            alert('Error al generar PDF. Revise la consola para más detalles.');
        });
    };

    // ═══ ESTADO: LOADING ═══
    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
                <div className="animate-pulse">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="w-20 h-20 bg-gray-300 rounded-full"></div>
                        <div className="flex-1">
                            <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                    </div>
                </div>
            </div>
        );
    }

    // ═══ ESTADO: ERROR ═══
    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
                <div className="text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h3 className="text-xl font-bold text-red-600 mb-2">Error al Cargar Datos</h3>
                    <p className="text-gray-600 mb-4">{error.message}</p>
                    <button
                        onClick={refresh}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        🔄 Reintentar
                    </button>
                </div>
            </div>
        );
    }

    // ═══ ESTADO: NO ENCONTRADO ═══
    if (!employee) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">Empleado no Encontrado</h3>
                    <p className="text-gray-600">No se encontró ningún empleado con ID: {employeeId}</p>
                </div>
            </div>
        );
    }

    // ═══ HELPERS ═══
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const getNivelColor = (nivel?: string) => {
        if (!nivel) return 'bg-gray-100 text-gray-600';
        if (nivel.startsWith('A')) return 'bg-blue-100 text-blue-700';
        if (nivel.startsWith('B')) return 'bg-green-100 text-green-700';
        return 'bg-purple-100 text-purple-700';
    };

    const getTurnoLabel = (turno?: 'M' | 'TN') => {
        if (!turno) return 'No asignado';
        return turno === 'M' ? '🌅 Mañana (07:00 - 15:00)' : '🌆 Tarde-Noche (15:00 - 23:00)';
    };

    const getCompetenciaColor = (nivel: 1 | 2 | 3) => {
        const colors = {
            1: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            2: 'bg-blue-100 text-blue-800 border-blue-300',
            3: 'bg-green-100 text-green-800 border-green-300'
        };
        return colors[nivel];
    };

    const getCompetenciaLabel = (nivel: 1 | 2 | 3) => {
        const labels = { 1: 'Básico', 2: 'Intermedio', 3: 'Avanzado' };
        return labels[nivel];
    };

    // ═══ RENDER ═══
    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-4xl mx-auto">
            {/* HEADER */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
                <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
                        {employee.DescOperario.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold">{employee.DescOperario}</h2>
                        <p className="text-blue-100">ID: FV{employee.IDOperario.toString().padStart(3, '0')}</p>
                        <p className="text-sm text-blue-200 mt-1">
                            {employee.DescDepartamento}
                            {employee.Activo ? (
                                <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">Activo</span>
                            ) : (
                                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">Inactivo</span>
                            )}
                        </p>
                    </div>
                    {employee.hasPendingData && (
                        <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                            <span className="mr-1">⚠️</span>
                            Pendiente de Talento
                        </div>
                    )}
                    <button
                        onClick={handleExportPDF}
                        className="ml-4 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition font-semibold flex items-center space-x-2"
                        title="Descargar ficha en PDF"
                    >
                        <span>📄</span>
                        <span>PDF</span>
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div className="border-b border-gray-200">
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`px-6 py-3 font-medium transition ${activeTab === 'info'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        📋 Información
                    </button>
                    {(showCompetencias || showNotas) && (
                        <button
                            onClick={() => setActiveTab('historial')}
                            className={`px-6 py-3 font-medium transition ${activeTab === 'historial'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                                }`}
                        >
                            📅 Historial y Seguimiento
                        </button>
                    )}
                </div>
            </div>

            {/* CONTENIDO */}
            <div className="p-6">
                {activeTab === 'info' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Tarjeta de Datos Personales */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Datos Personales</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-500">Edad</label>
                                    <p className="font-medium text-gray-800">
                                        {employee.Edad ? `${employee.Edad} años` : '--'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nivel de Estudios</label>
                                    <p className="font-medium text-gray-800">
                                        {employee.NivelEstudios || '--'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tarjeta de Datos Laborales */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Datos Laborales</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-500">Antigüedad</label>
                                    <p className="font-medium text-gray-800">{formatDate(employee.FechaAntiguedad)}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Nivel Retributivo</label>
                                    <span className={`inline-block px-2 py-0.5 rounded text-sm font-semibold ${getNivelColor(employee.NivelRetributivo)}`}>
                                        {employee.NivelRetributivo || '--'}
                                    </span>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Sección / Dept.</label>
                                    <p className="font-medium text-gray-800">{employee.DescDepartamento}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Horario Habitual</label>
                                    <p className="font-medium text-gray-800">{getTurnoLabel(employee.TurnoHabitual)}</p>
                                </div>
                                <div className="col-span-2 bg-blue-50 p-2 rounded border border-blue-100">
                                    <label className="text-xs text-blue-600 font-bold uppercase tracking-wider">Turno Asignado Hoy</label>
                                    <p className="font-bold text-blue-900 text-lg">
                                        {todayShift || <span className="text-gray-400 italic text-sm">Consultando...</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB HISTORIAL UNIFICADO (COMPETENCIAS + NOTAS) */}
                {activeTab === 'historial' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
                            <h3 className="font-bold text-blue-800">Línea de Tiempo</h3>
                            <span className="text-sm text-blue-600">
                                {((employee.competencias?.length || 0) + (employee.notas?.length || 0))} eventos registrados
                            </span>
                        </div>

                        <div className="space-y-8">
                            {/* 1. COMPETENCIAS CON NOTAS VINCULADAS */}
                            {showCompetencias && employee.competencias && employee.competencias.length > 0 && (
                                <div>
                                    <h4 className="flex items-center text-gray-700 font-bold mb-4">
                                        <span className="bg-purple-100 text-purple-700 p-1 rounded mr-2">🎯</span>
                                        Competencias y Habilidades
                                    </h4>
                                    <div className="space-y-4">
                                        {employee.competencias.map((comp, idx) => {
                                            // Filtrar notas vinculadas a esta competencia
                                            const linkedNotes = employee.notas?.filter(n => n.skillId === comp.skillId) || [];

                                            return (
                                                <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition">
                                                    {/* Cabecera de Competencia */}
                                                    <div className="p-4 flex items-center justify-between bg-gray-50">
                                                        <div>
                                                            <p className="font-bold text-gray-800 text-lg">{comp.skillName}</p>
                                                            <p className="text-xs text-gray-500">Evaluado: {formatDate(comp.fechaEvaluacion)} por {comp.evaluadoPor}</p>
                                                        </div>
                                                        <div className={`px-3 py-1 rounded-full text-sm font-bold border ${getCompetenciaColor(comp.nivel)}`}>
                                                            {getCompetenciaLabel(comp.nivel)}
                                                        </div>
                                                    </div>

                                                    {/* Notas vinculadas a esta competencia */}
                                                    {linkedNotes.length > 0 && (
                                                        <div className="p-4 bg-white border-t border-gray-100">
                                                            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Observaciones de Competencia</p>
                                                            <div className="space-y-2">
                                                                {linkedNotes.map(note => (
                                                                    <div key={note.id} className="bg-yellow-50 p-3 rounded-md border-l-4 border-yellow-400">
                                                                        <p className="text-sm text-gray-800">{note.contenido}</p>
                                                                        <div className="flex justify-between items-center mt-1">
                                                                            <span className="text-xs text-gray-500">{formatDate(note.fecha)}</span>
                                                                            <span className="text-xs text-gray-500 font-medium">{note.autor}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 2. NOTAS GENERALES (Sin vincular a competencia específica) */}
                            {showNotas && employee.notas && employee.notas.filter(n => !n.skillId).length > 0 && (
                                <div>
                                    <h4 className="flex items-center text-gray-700 font-bold mb-4">
                                        <span className="bg-yellow-100 text-yellow-700 p-1 rounded mr-2">📝</span>
                                        Notas Generales y Seguimiento
                                    </h4>
                                    <div className="space-y-3">
                                        {employee.notas.filter(n => !n.skillId).map((nota, idx) => (
                                            <div key={idx} className="bg-gray-50 border-l-4 border-blue-400 p-4 rounded-r-lg hover:bg-gray-100 transition">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                        {nota.tipo || 'Observación'}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{formatDate(nota.fecha)}</span>
                                                </div>
                                                <p className="text-gray-800 whitespace-pre-wrap">{nota.contenido}</p>
                                                <p className="text-xs text-gray-400 mt-2 text-right">Por: {nota.autor}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(!employee.competencias?.length && !employee.notas?.length) && (
                                <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-lg">
                                    <p>No hay historial de competencias ni notas registradas.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════════



export default EmployeeProfileCard;
