
import React, { useState, useMemo, useEffect } from 'react';
import { extractTimeHHMM } from '../../utils/datetime';
import { RawDataRow } from '../../types';

interface MultipleAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: RawDataRow[];
    onApply: (updatedRows: RawDataRow[]) => void;
    employeeShifts?: Map<number, string>; // ID -> 'M' | 'TN'
    flexibleEmployeeIds?: Set<number>;
}

interface AdjustmentCandidate {
    originalRow: RawDataRow;
    originalIndex: number; // Index in the passed data array to identify uniqueness
    targetTime: string; // "07:00:00"
    type: 'Entrada' | 'Salida';
}

// Convert HH:MM to minutes for easier comparison
const toMinutes = (h: number, m: number) => h * 60 + m;

const TARGET_RANGES = [
    {
        // 07:00 Start: [06:30, 07:30] -> 07:00 (Ampliado por petición usuario)
        type: 'Entrada',
        targetHour: 7, targetMinute: 0,
        minMinutes: toMinutes(6, 30),
        maxMinutes: toMinutes(7, 30)
    },
    {
        // 12:00 End: [11:30, 12:30] -> 12:00
        type: 'Salida',
        targetHour: 12, targetMinute: 0,
        minMinutes: toMinutes(11, 30),
        maxMinutes: toMinutes(12, 30)
    },
    {
        // 13:00 End: [12:30, 13:30] -> 13:00
        type: 'Salida',
        targetHour: 13, targetMinute: 0,
        minMinutes: toMinutes(12, 31), // Avoid overlap with 12:30
        maxMinutes: toMinutes(13, 30)
    }
];

const MultipleAdjustmentModal: React.FC<MultipleAdjustmentModalProps> = ({ isOpen, onClose, data, onApply, employeeShifts, flexibleEmployeeIds }) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    // Logic to find candidates
    const candidates = useMemo(() => {
        const results: AdjustmentCandidate[] = [];

        data.forEach((row, index) => {
            if (flexibleEmployeeIds?.has(row.IDOperario)) return;
            // Parse Row Time
            const [hStr, mStr] = row.Hora.split(':');
            const hour = parseInt(hStr, 10);
            const minute = parseInt(mStr, 10);
            const rowTimeMinutes = hour * 60 + minute;

            // Determine if it's Entry or Exit based on data
            const isEntry = row.Entrada === 1; // Explicitly 1
            const isExit = row.MotivoAusencia === 1; // Standard clock out code

            if (!isEntry && !isExit) return;

            // --- 1. HOLIDAY LOGIC (Existing) ---
            if (row.TipoDiaEmpresa === 1) {
                for (const range of TARGET_RANGES) {
                    if ((isEntry && range.type !== 'Entrada') || (isExit && range.type !== 'Salida')) continue;
                    if (rowTimeMinutes >= range.minMinutes && rowTimeMinutes <= range.maxMinutes) {
                        const targetMinutes = toMinutes(range.targetHour, range.targetMinute);
                        if (rowTimeMinutes === targetMinutes) continue;

                        results.push({
                            originalRow: row,
                            originalIndex: index,
                            targetTime: `${String(range.targetHour).padStart(2, '0')}:${String(range.targetMinute).padStart(2, '0')}:00`,
                            type: range.type as 'Entrada' | 'Salida'
                        });
                        break;
                    }
                }
                return; // Done for this row
            }

            // --- 2. REGULAR DAY LOGIC (Type 0 / Other) ---
            // Rules:
            // Morning (M):
            //   Entry >= 06:15 -> 07:00
            //   Exit <= 15:15 -> 15:00
            // Afternoon (TN):
            //   Entry >= 14:15 -> 15:00
            //   Exit <= 23:15 -> 23:00

            // Determine Shift. 
            // 1. Check prop (most accurate as it comes from datasetResumen processed logic)
            // 2. Fallback to Row TurnoTexto
            // 3. Last fallback: Infer from time
            let isMorning = false;
            let isAfternoon = false;

            const assignedShift = employeeShifts?.get(row.IDOperario);
            if (assignedShift) {
                isMorning = assignedShift === 'M';
                isAfternoon = assignedShift === 'TN';
            } else if (row.TurnoTexto) {
                const s = row.TurnoTexto.toUpperCase();
                isMorning = s === 'M' || s.startsWith('M');
                isAfternoon = s === 'TN' || s === 'T' || s === 'N';
            }

            // Fallback: Infer from time if TurnoTexto is empty
            if (!isMorning && !isAfternoon) {
                if (isEntry) {
                    if (hour >= 5 && hour <= 10) isMorning = true;
                    else if (hour >= 13 && hour <= 16) isAfternoon = true;
                }
                else if (isExit) {
                    if (hour >= 13 && hour <= 16) isMorning = true;
                    else if (hour >= 21) isAfternoon = true; // 21:00+
                }
            }

            if (isMorning) {
                if (isEntry) {
                    // Start 07:00. Window [06:15 - 06:59]. (45 min antes)
                    if (rowTimeMinutes >= toMinutes(6, 15) && rowTimeMinutes < toMinutes(7, 0)) {
                        results.push({
                            originalRow: row,
                            originalIndex: index,
                            targetTime: '07:00:00',
                            type: 'Entrada'
                        });
                    }
                } else if (isExit) {
                    // End 15:00. Window [15:01 - 15:15]. (15 min después)
                    if (rowTimeMinutes > toMinutes(15, 0) && rowTimeMinutes <= toMinutes(15, 15)) {
                        results.push({
                            originalRow: row,
                            originalIndex: index,
                            targetTime: '15:00:00',
                            type: 'Salida'
                        });
                    }
                }
            } else if (isAfternoon) {
                if (isEntry) {
                    // Start 15:00. Window [14:15 - 14:59]. (45 min antes)
                    if (rowTimeMinutes >= toMinutes(14, 15) && rowTimeMinutes < toMinutes(15, 0)) {
                        results.push({
                            originalRow: row,
                            originalIndex: index,
                            targetTime: '15:00:00',
                            type: 'Entrada'
                        });
                    }
                } else if (isExit) {
                    // End 23:00. Window [23:01 - 23:15]. (15 min después)
                    if (rowTimeMinutes > toMinutes(23, 0) && rowTimeMinutes <= toMinutes(23, 15)) {
                        results.push({
                            originalRow: row,
                            originalIndex: index,
                            targetTime: '23:00:00',
                            type: 'Salida'
                        });
                    }
                }
            }

        });

        return results;
    }, [data, employeeShifts]);

    // Select all by default when candidates change
    useEffect(() => {
        if (isOpen) {
            const allIndices = new Set(candidates.map(c => c.originalIndex));
            setSelectedIndices(allIndices);
        }
    }, [candidates, isOpen]);

    const handleToggleOne = (index: number) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedIndices(newSet);
    };

    const handleToggleAll = () => {
        if (selectedIndices.size === candidates.length) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(candidates.map(c => c.originalIndex)));
        }
    };

    const handleApply = () => {
        if (selectedIndices.size === 0) return;

        // Create a shallow copy of data to update
        const newData = [...data];

        candidates.forEach(candidate => {
            if (selectedIndices.has(candidate.originalIndex)) {
                // Update the row in the cloned array
                const updatedRow = { ...candidate.originalRow };
                updatedRow.Hora = candidate.targetTime;

                // Also update Inicio/Fin helper fields if present, for consistency
                const shortTime = candidate.targetTime.substring(0, 5);
                if (candidate.type === 'Entrada') {
                    if (updatedRow.Inicio) updatedRow.Inicio = shortTime;
                } else {
                    if (updatedRow.Fin) updatedRow.Fin = shortTime;
                }

                newData[candidate.originalIndex] = updatedRow;
            }
        });

        onApply(newData);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Ajuste Masivo de Fichajes</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Ajuste automático para Festivos y Días Regulares (M: 7h-15h, T: 15h-23h) según reglas.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">&times;</button>
                </div>

                {candidates.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No se encontraron registros que requieran ajuste.</p>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg mb-4">
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">
                                            <input
                                                type="checkbox"
                                                checked={candidates.length > 0 && selectedIndices.size === candidates.length}
                                                onChange={handleToggleAll}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-center w-16">ID</th>
                                        <th className="px-4 py-3">Empleado</th>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3 text-right">Hora Real</th>
                                        <th className="px-4 py-3 text-center">➔</th>
                                        <th className="px-4 py-3 text-left font-bold text-blue-700">Ajuste</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {candidates.map((c) => (
                                        <tr key={c.originalIndex} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIndices.has(c.originalIndex)}
                                                    onChange={() => handleToggleOne(c.originalIndex)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center text-xs text-slate-500 font-mono">
                                                {String(c.originalRow.IDOperario).padStart(3, '0')}
                                            </td>
                                            <td className="px-4 py-2 font-medium text-slate-800">{c.originalRow.DescOperario}</td>
                                            <td className="px-4 py-2">{new Date(c.originalRow.Fecha).toLocaleDateString()}</td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.type === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {c.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-500">{extractTimeHHMM(c.originalRow.Hora)}</td>
                                            <td className="px-4 py-2 text-center text-slate-300">➔</td>
                                            <td className="px-4 py-2 font-bold font-mono text-blue-700">{c.targetTime.substring(0, 5)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <p className="text-sm text-slate-500">
                                {selectedIndices.size} registros seleccionados para corrección.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-slate-700 font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleApply}
                                    disabled={selectedIndices.size === 0}
                                    className="px-4 py-2 text-white font-bold bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm"
                                >
                                    Aplicar Correcciones
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MultipleAdjustmentModal;
