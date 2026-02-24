import React, { useMemo } from 'react';
import { RawDataRow } from '../../types';
import { normalizeDateKey } from '../../utils/datetime';
import { CalendarioDia } from '../../services/erpApi';

interface VacationsTableProps {
    erpData: RawDataRow[];
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    employeeCalendarsByDate: Map<number, Map<string, CalendarioDia>>;
    employeeOptions: Array<{ id: number; name: string; department: string }>;
    excludedEmployeeIds?: Set<number>;
}

interface VacationEntry {
    employeeId: number;
    employeeName: string;
    department: string;
    vacationDates: string[]; // All dates with TipoDiaEmpresa === 2 in range
}

const VacationsTable: React.FC<VacationsTableProps> = ({
    erpData,
    startDate,
    endDate,
    employeeCalendarsByDate,
    employeeOptions,
    excludedEmployeeIds
}) => {
    const vacations = useMemo(() => {
        // Group by employee and merge vacations from both sources:
        // 1) Personal calendar (TipoDia = 2)
        // 2) ERP punches fallback (TipoDiaEmpresa = 2)
        const employeeMap = new Map<number, VacationEntry>();
        const employeeMeta = new Map<number, { name: string; department: string }>();

        employeeOptions.forEach(emp => {
            employeeMeta.set(emp.id, { name: emp.name, department: emp.department || '' });
        });

        const ensureEntry = (employeeId: number, fallbackName = 'Desconocido', fallbackDept = '') => {
            if (!employeeMap.has(employeeId)) {
                const meta = employeeMeta.get(employeeId);
                employeeMap.set(employeeId, {
                    employeeId,
                    employeeName: meta?.name || fallbackName,
                    department: meta?.department || fallbackDept,
                    vacationDates: []
                });
            }

            return employeeMap.get(employeeId)!;
        };

        employeeCalendarsByDate.forEach((dateMap, employeeId) => {
            dateMap.forEach((day, rawDate) => {
                const dateKey = normalizeDateKey(rawDate || day.Fecha);
                if (!dateKey || dateKey < startDate || dateKey > endDate) return;
                if (String(day.TipoDia) !== '2') return;

                const entry = ensureEntry(employeeId);
                if (!entry.vacationDates.includes(dateKey)) {
                    entry.vacationDates.push(dateKey);
                }
            });
        });

        erpData.forEach(row => {
            const dateKey = normalizeDateKey(row.Fecha);
            if (!dateKey || dateKey < startDate || dateKey > endDate) return;
            if (Number(row.TipoDiaEmpresa) !== 2) return;

            const entry = ensureEntry(row.IDOperario, row.DescOperario, row.DescDepartamento || '');
            if (!entry.vacationDates.includes(dateKey)) {
                entry.vacationDates.push(dateKey);
            }
        });

        // Convert to array and sort
        const result = Array.from(employeeMap.values())
            .filter(entry => !excludedEmployeeIds?.has(entry.employeeId))
            .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

        // Sort vacation dates for each employee
        result.forEach(entry => {
            entry.vacationDates.sort();
        });

        return result;
    }, [erpData, startDate, endDate, employeeCalendarsByDate, employeeOptions, excludedEmployeeIds]);

    const formatDateRange = (dates: string[]): string => {
        if (dates.length === 0) return '';
        if (dates.length === 1) return dates[0];

        // Find consecutive ranges
        const ranges: string[] = [];
        let rangeStart = dates[0];
        let rangeEnd = dates[0];

        for (let i = 1; i < dates.length; i++) {
            const prevDate = new Date(dates[i - 1]);
            const currDate = new Date(dates[i]);
            const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Consecutive
                rangeEnd = dates[i];
            } else {
                // Break in sequence
                if (rangeStart === rangeEnd) {
                    ranges.push(rangeStart);
                } else {
                    ranges.push(`${rangeStart} → ${rangeEnd}`);
                }
                rangeStart = dates[i];
                rangeEnd = dates[i];
            }
        }

        // Add last range
        if (rangeStart === rangeEnd) {
            ranges.push(rangeStart);
        } else {
            ranges.push(`${rangeStart} → ${rangeEnd}`);
        }

        return ranges.join(', ');
    };

    return (
        <div className="bg-white/90 rounded-2xl shadow-lg border border-green-200 overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-4 border-b border-green-100 flex items-center justify-between">
                <h3 className="font-bold text-green-800 flex items-center gap-2 uppercase tracking-wider">
                    <span className="text-xl">🏖️</span>
                    Personal de Vacaciones
                </h3>
                <span className="bg-green-200 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full">{vacations.length}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/80">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Empleado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sección</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fechas de Vacaciones</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Días</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {vacations.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">
                                    No hay empleados de vacaciones en este periodo.
                                </td>
                            </tr>
                        )}
                        {vacations.map((v) => (
                            <tr key={v.employeeId} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">{v.employeeId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{v.employeeName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{v.department}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{formatDateRange(v.vacationDates)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {v.vacationDates.length} día{v.vacationDates.length !== 1 ? 's' : ''}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default VacationsTable;
