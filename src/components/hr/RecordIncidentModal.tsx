
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { RawDataRow, ProcessedDataRow, UnjustifiedGap, WorkdayDeviation } from '../../types';
import { DataContext } from '../../App';
import ValidationErrorsModal from '../shared/ValidationErrorsModal';
import { validateNewIncidents, ValidationIssue } from '../../services/validationService';
import { generateGapStrategy, generateFullDayStrategy, generateWorkdayStrategy } from '../../services/incidentStrategies';
import { useMotivos } from '../../hooks/useErp';

interface RecordIncidentModalProps {
    // ... same props ...
    isOpen: boolean;
    onClose: () => void;
    employeeData: ProcessedDataRow | null;
    onJustify: (
        incident: { type: 'gap' | 'workday' | 'absentDay'; data: UnjustifiedGap | WorkdayDeviation | { date: string } },
        reason: { id: number; desc: string },
        employee: ProcessedDataRow
    ) => Promise<void>;
    justifiedKeys?: Map<string, number>;
}
interface IncidentToJustify {
    type: 'gap' | 'workday' | 'absentDay';
    key: string;
    description: React.ReactNode;
    data: UnjustifiedGap | WorkdayDeviation | { date: string };
}

const RecordIncidentModal: React.FC<RecordIncidentModalProps> = ({ isOpen, onClose, employeeData, onJustify, justifiedKeys }) => {
    const { erpData } = useContext(DataContext);
    const [selectedIncidentKey, setSelectedIncidentKey] = useState<string>('');
    const [motivoId, setMotivoId] = useState<string>('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { motivos, loading, error: motivoError, refresh } = useMotivos();

    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

    // Track previous isOpen to detect opening transition
    const prevIsOpenRef = React.useRef(isOpen);

    // --- MANUAL MODE STATE ---
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualDate, setManualDate] = useState<string>('');


    const getShiftBounds = (shiftCode: string): { start: string; end: string } => {
        if (shiftCode === 'TN' || shiftCode === 'T') return { start: '15:00', end: '23:00' };
        if (shiftCode === 'N') return { start: '23:00', end: '07:00' };
        if (shiftCode === 'C') return { start: '08:00', end: '17:00' };
        return { start: '07:00', end: '15:00' };
    };

    const getShiftCodeForDate = (date: string): string => {
        // FIX #2: Always return a valid shift code with fallback to employee's assigned shift
        const change = employeeData?.shiftChanges?.find(c => c.date === date);
        if (change?.shift) return change.shift;
        if (employeeData?.turnoAsignado) return employeeData.turnoAsignado;
        // Ultimate fallback: Morning shift
        return 'M';
    };

    const normalizeDisplayTime = (timeStr: string): string => {
        if (!timeStr) return '';
        return timeStr.replace(' (+1)', '').substring(0, 5);
    };

    const addOneMinute = (timeStr: string): string => {
        if (!timeStr) return '';
        const parts = timeStr.substring(0, 5).split(':');
        if (parts.length < 2) return timeStr;

        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);

        const date = new Date();
        date.setHours(h);
        date.setMinutes(m + 1);

        return date.toTimeString().substring(0, 5);
    };

    const incidents = useMemo((): IncidentToJustify[] => {
        if (!employeeData) return [];
        const keysToCheck = justifiedKeys || new Map();

        const gapIncidents: IncidentToJustify[] = (employeeData.unjustifiedGaps || [])
            .map((gap, i): IncidentToJustify | null => {
                const shiftCode = getShiftCodeForDate(gap.date);
                const shiftBounds = getShiftBounds(shiftCode);

                // Fix: Display GAP start as 1 minute after punch out ONLY IF it's NOT the start of the shift
                // User requirement: "si se va a las 8:30, incidencia de 8:31 a 10" -> Apply +1
                // Late Arrival: "15:00 -> 16:00" -> DO NOT Apply +1 (Must start at 15:00)
                let adjustedStart = gap.start;
                if (gap.start !== shiftBounds.start) {
                    adjustedStart = addOneMinute(gap.start);
                }

                // FIX #1: Include BOTH start AND end time to allow multiple gaps on same day
                const uniqueKey = `gap-${employeeData.operario}-${gap.date}-${gap.start}-${gap.end}`;
                if (keysToCheck.has(uniqueKey)) return null;

                return {
                    type: 'gap',
                    key: uniqueKey,
                    description: (
                        <span>
                            Salto detectado: <strong className="font-bold text-red-600 bg-red-50 px-1 rounded mx-1">{normalizeDisplayTime(adjustedStart)} ➔ {normalizeDisplayTime(gap.end)}</strong>
                            <span className="text-slate-500 text-xs text-nowrap">({gap.date})</span>
                            <span className="text-slate-500 text-xs text-nowrap ml-2">Tramo: {shiftBounds.start}-{shiftBounds.end}</span>
                        </span>
                    ),
                    data: { ...gap, start: adjustedStart }, // Pass adjusted Start
                };
            })
            .filter((item): item is IncidentToJustify => item !== null);

        const workdayIncidents: IncidentToJustify[] = (employeeData.workdayDeviations || [])
            .filter(dev => {
                const uniqueKey = `dev-${employeeData.operario}-${dev.date}`;
                if (keysToCheck.has(uniqueKey)) return false;
                const hasGapOnSameDay = (employeeData.unjustifiedGaps || []).some(gap => gap.date === dev.date);
                return !hasGapOnSameDay;
            })
            .map((dev, i): IncidentToJustify => {
                const deviation = dev.actualHours - 8;
                const sign = deviation > 0 ? '+' : '';
                const shiftCode = getShiftCodeForDate(dev.date);
                const shiftBounds = getShiftBounds(shiftCode);
                return {
                    type: 'workday',
                    key: `dev-${employeeData.operario}-${dev.date}`,
                    description: (
                        <span>
                            Jornada de {dev.actualHours.toFixed(2)}h ({sign}{deviation.toFixed(2)}h) el {dev.date}
                            <span className="text-slate-500 text-xs text-nowrap ml-2">Tramo: {shiftBounds.start}-{shiftBounds.end}</span>
                            {dev.start && dev.end && (
                                <span className="text-blue-600 text-xs text-nowrap ml-2 font-medium">
                                    (Fichajes: {dev.start} - {dev.end})
                                </span>
                            )}
                        </span>
                    ),
                    data: dev,
                };
            });

        const absentIncidents: IncidentToJustify[] = (employeeData.absentDays || [])
            .map((date): IncidentToJustify | null => {
                const uniqueKey = `abs-${employeeData.operario}-${date}`;
                if (keysToCheck.has(uniqueKey)) return null;
                const shiftCode = getShiftCodeForDate(date);
                const shiftBounds = getShiftBounds(shiftCode);
                return {
                    type: 'absentDay',
                    key: uniqueKey,
                    description: (
                        <span className="font-semibold text-red-700">
                            Ausencia completa el {date}
                            <span className="text-slate-500 text-xs text-nowrap ml-2">Tramo: {shiftBounds.start}-{shiftBounds.end}</span>
                        </span>
                    ),
                    data: { date },
                };
            })
            .filter((item): item is IncidentToJustify => item !== null);

        // 🔍 DEBUG: Log para empleado 047 (VELAZQUEZ MARTIN, MARIO)
        if (employeeData?.operario === 47) {
            console.log('🔍 DEBUG empleado 047 (VELAZQUEZ MARTIN):', {
                absentDays: employeeData.absentDays,
                unjustifiedGaps: employeeData.unjustifiedGaps,
                workdayDeviations: employeeData.workdayDeviations,
                totalIncidents: [...gapIncidents, ...absentIncidents].length,
                gapCount: gapIncidents.length,
                absentCount: absentIncidents.length
            });
        }

        const combined = [...gapIncidents, ...workdayIncidents, ...absentIncidents];
        if (combined.length === 0 && employeeData.operario) {
            console.warn('⚠️ RecordIncidentModal: No incidents found.', {
                unjustifiedGaps: employeeData.unjustifiedGaps,
                absentDays: employeeData.absentDays,
                workdayDeviations: employeeData.workdayDeviations,
                justifiedKeysSize: keysToCheck.size
            });
        }
        return combined;
    }, [employeeData, justifiedKeys]);

    const selectedIncident = useMemo(() => {
        return incidents.find(inc => inc.key === selectedIncidentKey);
    }, [selectedIncidentKey, incidents]);

    const availableReasons = useMemo(() => {
        return motivos
            .filter(m => ![1].includes(parseInt(m.IDMotivo))) // FIX: Allow Code 14 (TAJ) for manual entry
            .map(m => ({
                id: parseInt(m.IDMotivo),
                desc: `${m.IDMotivo.padStart(2, '0')} - ${m.DescMotivo}`
            }))
            .sort((a, b) => a.id - b.id);
    }, [motivos]);

    useEffect(() => {
        // Reset only when opening
        if (isOpen && !prevIsOpenRef.current) {
            if (incidents.length > 0) {
                setSelectedIncidentKey(incidents[0].key);
            }
            setMotivoId('');
            setError('');
            setIsSaving(false);
            setIsManualMode(false); // Reset manual mode on open
            setManualDate(new Date().toISOString().split('T')[0]); // Default to today or safely handle in render
        }
        // If incidents change while open (e.g. one justified), ensure existing selection is valid
        if (isOpen && prevIsOpenRef.current && incidents.length > 0) {
            if (!incidents.find(i => i.key === selectedIncidentKey)) {
                setSelectedIncidentKey(incidents[0].key);
                setMotivoId(''); // Reset reason if we auto-switched incident
            }
        }

        prevIsOpenRef.current = isOpen;
    }, [isOpen, incidents, selectedIncidentKey]);

    useEffect(() => {
        // Clear motivo only if the USER manually switched incidents, handled by setting it in the onChange handler, not here.
        // Actually, separating the state reset is safer.
        // But for now, let's just NOT reset motivoId on every selectedIncidentKey change if it was triggered by the code above.
        // The requirement "vuelve a la posicion init" implies full reset.
        // We will remove the dedicated Effect for setMotivoId('') on key change and handle it manually in the radio onChange.
    }, []);

    if (!isOpen || !employeeData) return null;

    const handleSubmit = async () => {
        if (!motivoId || !selectedIncident) {
            setError('Debes seleccionar una incidencia y un motivo.');
            return;
        }
        // reason id is number
        const reason = availableReasons.find(r => r.id === parseInt(motivoId));
        if (!reason) return;

        // Usar la estrategia centralizada para generar las filas exactas
        let strategyResult;

        if (isManualMode) {
            // MANUAL MODE LOGIQUE
            if (!manualDate) {
                setError('Debes seleccionar una fecha.');
                return;
            }
            strategyResult = generateFullDayStrategy(manualDate, reason, employeeData);
        } else {
            // STANDARD MODE LOGIC
            if (!selectedIncident) return;

            if (selectedIncident.type === 'gap') {
                const gapData = selectedIncident.data as UnjustifiedGap;
                strategyResult = generateGapStrategy(gapData, reason, employeeData);
            } else if (selectedIncident.type === 'workday') {
                const workdayData = selectedIncident.data as WorkdayDeviation;
                strategyResult = generateWorkdayStrategy(workdayData, reason, employeeData);
            } else if (selectedIncident.type === 'absentDay') {
                const { date } = selectedIncident.data as { date: string };
                strategyResult = generateFullDayStrategy(date, reason, employeeData);
            } else {
                return; // Should not happen
            }
        }

        // Combinar inserts y updates para validar
        // Para updates, necesitamos simular el estado final. 
        // ValidationService espera "NewRows". Si es update, pasamos la fila modificada
        const rowsToValidate = [...strategyResult.rowsToInsert, ...strategyResult.rowsToUpdate] as RawDataRow[];

        let issues: ValidationIssue[] = [];
        try {
            if (erpData && Array.isArray(erpData)) {
                issues = validateNewIncidents(erpData, rowsToValidate);
            } else {
                console.warn("⚠️ skipping validation: erpData not available or invalid");
            }
        } catch (validationErr) {
            console.error("❌ Critical Validation Error:", validationErr);
            // Optionally set a non-blocking error to notify user but not freeze
            // For now, we allow proceeding if validation crashes to avoid "freeze"
        }

        const errors = issues.filter(i => i.type === 'error');
        const warnings = issues.filter(i => i.type === 'warning');

        // Log warnings but don't block
        if (warnings.length > 0) {
            console.warn('⚠️ [VALIDATION] Warnings (no bloquean):', warnings);
        }

        // Only block if there are actual errors
        if (errors.length > 0) {
            console.error('❌ [VALIDATION] Errors found - blocking submission:', errors);
            setValidationIssues(errors);
            setIsValidationModalOpen(true);
            return;
        }

        const isFullDayAbsence = selectedIncident.type === 'absentDay';

        // console.group('📝 [SUBMIT] Incidencia a registrar');
        // console.log('👤 Empleado:', employeeData.nombre);
        // console.log('Strategy:', strategyResult.description);
        // console.log('Rows to Insert:', strategyResult.rowsToInsert);
        // console.log('Rows to Update:', strategyResult.rowsToUpdate);
        // console.groupEnd();

        setError('');
        setIsSaving(true);
        try {
            await onJustify(selectedIncident, reason, employeeData);
            // Si llega aquí, es éxito
            const hasMoreIncidents = incidents.length > 1;
            if (hasMoreIncidents) {
                const nextIncident = incidents.find(inc => inc.key !== selectedIncidentKey);
                if (nextIncident) {
                    setSelectedIncidentKey(nextIncident.key);
                }
                setMotivoId('');
            } else {
                onClose();
            }
        } catch (err: any) {
            console.error("Error saving incident:", err);
            // Mostrar error amigable
            setError(err.message || "Error al guardar en el servidor. Inténtalo de nuevo.");
        } finally {
            // Asegurar desbloqueo
            setIsSaving(false);
        }
    };

    const handleContinueDespiteWarning = async () => {
        const reason = availableReasons.find(r => r.id === parseInt(motivoId));
        if (reason && selectedIncident) {
            setIsValidationModalOpen(false);
            setIsSaving(true);
            try {
                await onJustify(selectedIncident, reason, employeeData);
                const hasMoreIncidents = incidents.length > 1;
                if (hasMoreIncidents) {
                    const nextIncident = incidents.find(inc => inc.key !== selectedIncidentKey);
                    if (nextIncident) {
                        setSelectedIncidentKey(nextIncident.key);
                    }
                    setMotivoId('');
                } else {
                    onClose();
                }
            } catch (err: any) {
                setError(err.message || "Error al guardar tras validación.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4" onClick={onClose}>
                <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                        <h2 className="text-xl font-bold text-slate-800">Registrar Incidencia</h2>
                        <button onClick={onClose} disabled={isSaving} className="text-slate-500 hover:text-slate-800 text-2xl">&times;</button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-500">Empleado</label>
                            <p className="font-semibold text-slate-800">{employeeData.nombre}</p>
                        </div>

                        {/* TOGGLE MANUAL MODE */}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsManualMode(!isManualMode)}
                                className="text-sm text-blue-600 hover:text-blue-800 underline"
                            >
                                {isManualMode ? 'Volver a Incidencias Detectadas' : 'Registrar Ausencia Manualmente'}
                            </button>
                        </div>

                        {isManualMode ? (
                            <div className="bg-orange-50 p-4 rounded-md border border-orange-200 space-y-3">
                                <h3 className="font-semibold text-orange-800 flex items-center">
                                    <span className="mr-2">⚡</span> Modo Manual
                                </h3>
                                <div>
                                    <label className="block text-sm font-medium text-orange-800 mb-1">Fecha de la Ausencia</label>
                                    <input
                                        type="date"
                                        value={manualDate}
                                        onChange={(e) => setManualDate(e.target.value)}
                                        className="block w-full border-orange-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                                    />
                                    <p className="text-xs text-orange-600 mt-1">
                                        Se registrará una ausencia de día completo (Entrada Normal ➔ Salida con Incidencia).
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-slate-700">1. Selecciona la incidencia a justificar</label>
                                {incidents.length > 0 ? (
                                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-md p-2 bg-slate-50">
                                        {incidents.map(inc => (
                                            <label key={inc.key} className="flex items-center p-2 rounded-md bg-white hover:bg-blue-50 cursor-pointer border border-slate-100">
                                                <input
                                                    type="radio"
                                                    name="incident"
                                                    value={inc.key}
                                                    checked={selectedIncidentKey === inc.key}
                                                    onChange={(e) => setSelectedIncidentKey(e.target.value)}
                                                    disabled={isSaving}
                                                    className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                                />
                                                <span className="ml-3 text-sm text-slate-700">{inc.description}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-2 p-4 bg-green-50 text-green-700 rounded-md text-sm text-center border border-green-200">
                                        <p className="font-semibold">¡Todo al día!</p>
                                        <p>No quedan incidencias pendientes para este empleado.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="motivo-select" className="block text-sm font-medium text-slate-700">2. Motivo de la justificación</label>
                                {(error || (availableReasons.length === 0 && !loading)) && (
                                    <button
                                        onClick={() => refresh()}
                                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                                        type="button"
                                    >
                                        Reintentar carga
                                    </button>
                                )}
                            </div>
                            <select
                                id="motivo-select"
                                value={motivoId}
                                onChange={(e) => setMotivoId(e.target.value)}
                                disabled={(!isManualMode && (!selectedIncidentKey || incidents.length === 0)) || isSaving || loading}
                                className="mt-1 block w-full pl-3 pr-10 py-2 border-slate-300 rounded-md disabled:bg-slate-200"
                            >
                                <option value="">-- Selecciona un motivo --</option>
                                {loading && <option value="" disabled>Cargando listado...</option>}
                                {error && <option value="" disabled>Error de carga</option>}
                                {!loading && !error && availableReasons.length === 0 && (
                                    <option value="" disabled>No hay motivos disponibles</option>
                                )}
                                {availableReasons.map(reason => (
                                    <option key={reason.id} value={reason.id}>{reason.desc}</option>
                                ))}
                            </select>
                            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                        </div>
                    </div>

                    {selectedIncident && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                            <h4 className="text-sm font-semibold text-blue-800 mb-1 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                Previsualización de Registro
                            </h4>
                            <p className="text-sm text-blue-700">
                                {(() => {
                                    // Calculate preview using actual strategy logic
                                    try {
                                        const dummyReason = { id: 99, desc: 'Preview' }; // Dummy reason for time calc
                                        let result;

                                        if (isManualMode && manualDate) {
                                            result = generateFullDayStrategy(manualDate, dummyReason, employeeData);
                                        } else if (selectedIncident.type === 'gap') {
                                            const gapData = selectedIncident.data as UnjustifiedGap;
                                            result = generateGapStrategy(gapData, dummyReason, employeeData);
                                        } else if (selectedIncident.type === 'absentDay') {
                                            const date = (selectedIncident.data as { date: string }).date;
                                            result = generateFullDayStrategy(date, dummyReason, employeeData);
                                        } else if (selectedIncident.type === 'workday') {
                                            const workdayData = selectedIncident.data as WorkdayDeviation;
                                            result = generateWorkdayStrategy(workdayData, dummyReason, employeeData);
                                        } else {
                                            return "Se registrará una desviación de jornada.";
                                        }

                                        // Extract time range from rowsToInsert/Update
                                        // Usually strategies return [Entry, Exit]. Exit row has Inicio/Fin fields for reference.
                                        let rangeText = "";
                                        const exitRow = result.rowsToInsert.find(r => r.Entrada === 0) || result.rowsToUpdate.find(r => r.IDControlPresencia);

                                        if (exitRow && exitRow.Inicio && exitRow.Fin) {
                                            rangeText = `${normalizeDisplayTime(exitRow.Inicio)} ➔ ${normalizeDisplayTime(exitRow.Fin)}`;
                                        } else if (result.rowsToInsert.length === 2) {
                                            // Fallback if properties missing
                                            const start = result.rowsToInsert[0].Hora;
                                            const end = result.rowsToInsert[1].Hora;
                                            rangeText = `${normalizeDisplayTime(start || '')} ➔ ${normalizeDisplayTime(end || '')}`;
                                        }

                                        return (
                                            <>
                                                Se grabará incidencia: <strong className="font-bold">{rangeText}</strong>
                                                <br />
                                                <span className="text-xs opacity-75">{result.description}</span>
                                            </>
                                        );
                                    } catch (e) {
                                        return "Selecciona una incidencia para ver detalles.";
                                    }
                                })()}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-5 py-2 bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!motivoId || (!isManualMode && incidents.length === 0) || isSaving}
                            className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center min-w-[120px] justify-center"
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Guardando...
                                </>
                            ) : (
                                'Guardar Justificante'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <ValidationErrorsModal
                isOpen={isValidationModalOpen}
                onClose={() => setIsValidationModalOpen(false)}
                issues={validationIssues}
                onContinue={handleContinueDespiteWarning}
            />
        </>
    );
};

export default RecordIncidentModal;
