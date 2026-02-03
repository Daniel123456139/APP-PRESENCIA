import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useHrPortalData } from '../hooks/useHrPortalData';
import { getControlOfPorOperario } from '../services/erpApi';
import { JobControlEntry, RawDataRow } from '../types';
import { format, differenceInMinutes } from 'date-fns';
import { useNotification } from '../components/shared/NotificationContext';
import { ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Smartphone, Layers, Search, PieChart, FileText, BarChart3, CheckCircle2, Clock } from 'lucide-react';
import { exportImproductiveRankingToPDF, exportWeeklyJobAuditToPDF, exportImproductiveByArticleToPDF } from '../services/jobAuditExportService';
import { getImproductiveArticle } from '../data/improductiveArticles';
import { ProductivityDashboard } from '../components/hr/ProductivityDashboard';

/**
 * Helper para parsear fechas del ERP (dd/MM/yyyy + HH:mm:ss)
 */
const parseErpDateTime = (fechaStr: string | null, horaStr: string | null): Date => {
    if (!fechaStr) return new Date(NaN);

    try {
        // Cleaning: Handle ISO strings in Date field (e.g., "2026-01-22T00:00:00")
        const cleanFecha = fechaStr.includes('T') ? fechaStr.split('T')[0] : fechaStr;

        let day, month, year;
        if (cleanFecha.includes('/')) {
            [day, month, year] = cleanFecha.split('/').map(Number);
        } else {
            [year, month, day] = cleanFecha.split('-').map(Number);
        }

        // Cleaning: Handle ISO strings in Time field (e.g., "1900-01-01T09:30:00")
        let cleanHora = horaStr || '00:00:00';
        if (cleanHora.includes('T')) {
            cleanHora = cleanHora.split('T')[1];
        }

        const [hour, min, sec] = cleanHora.split(':').map(Number);
        return new Date(year, month - 1, day, hour || 0, min || 0, sec || 0);
    } catch (e) {
        console.error("Error parsing ERP DateTime:", fechaStr, horaStr);
        return new Date(NaN);
    }
};

const normalizeDateStr = (raw?: string | null): string => {
    if (!raw) return '';
    let clean = raw.includes('T') ? raw.split('T')[0] : raw;
    if (clean.includes(' ')) clean = clean.split(' ')[0];
    return clean;
};

const normalizeTimeStr = (raw?: string | null): string => {
    if (!raw) return '';
    let t = raw;
    if (t.includes('T')) t = t.split('T')[1];
    if (t.includes(' ')) t = t.split(' ')[1];
    return t.substring(0, 5);
};

const isEntrada = (entrada: boolean | number): boolean => entrada === true || entrada === 1;

const isIncidentRow = (row: RawDataRow): boolean => {
    return row.MotivoAusencia !== null && row.MotivoAusencia !== 0 && row.MotivoAusencia !== 1 && row.MotivoAusencia !== 14;
};

const toMinutes = (hhmm: string): number => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const formatShortDate = (dateStr: string): string => {
    try {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}`;
    } catch {
        return dateStr;
    }
};

interface JobManagementProps {
    initialStartDate?: string;
    initialEndDate?: string;
}

export const JobManagement: React.FC<JobManagementProps> = ({ initialStartDate, initialEndDate }) => {
    // PERSISTENCE KEYS
    const STORAGE_KEY = 'jobAuditState';

    // 1. Initialize State from Storage if available
    const getStoredState = () => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error("Error reading jobAuditState", e);
            return null;
        }
    };

    const storedState = getStoredState();

    const [startDate, setStartDate] = useState(initialStartDate || storedState?.startDate || format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(initialEndDate || storedState?.endDate || format(new Date(), 'yyyy-MM-dd'));
    const [showDebug, setShowDebug] = useState(false);
    const [searchFilter, setSearchFilter] = useState<string>('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
    const [sortKey, setSortKey] = useState<'gap' | 'worked' | 'empId' | 'name'>('gap');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [showDashboard, setShowDashboard] = useState(false);

    // Sincronizar con fechas globales si cambian (solo si se proveen props explícitas)
    useEffect(() => {
        if (initialStartDate) setStartDate(initialStartDate);
        if (initialEndDate) setEndDate(initialEndDate);
    }, [initialStartDate, initialEndDate]);

    // Use HR Portal Logic for Presence Calculation
    const {
        erpData,
        datasetResumen,
        isReloading,
        departmentFilteredEmployees,
        selectedDepartment,
        setSelectedDepartment,
        computedDepartments,
        employeeCalendarsByDate,
        reloadFromServer
    } = useHrPortalData({
        startDate,
        endDate,
        startTime: '00:00',
        endTime: '23:59',
        shifts: [],
        companyHolidays: [],
        incidentLog: [],
        setIncidentLog: () => { },
        includeAbsencesInResumen: true
    });

    const { showNotification } = useNotification();
    const [jobData, setJobData] = useState<Record<string, JobControlEntry[]>>(storedState?.jobData || {});
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // 2. Restore selectedDepartment on mount if exists in storage
    useEffect(() => {
        if (storedState?.selectedDepartment && storedState.selectedDepartment !== 'all') {
            setSelectedDepartment(storedState.selectedDepartment);
        }
    }, []); // Run once on mount

    // 3. Persist State Changes
    useEffect(() => {
        const stateToSave = {
            startDate,
            endDate,
            selectedDepartment,
            jobData
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }, [startDate, endDate, selectedDepartment, jobData]);
    const abortControllerRef = useRef<AbortController | null>(null);

    const productiveEmployees = useMemo(() => {
        return departmentFilteredEmployees.filter(emp => emp.productivo !== false);
    }, [departmentFilteredEmployees]);

    const vacationDaysByEmployee = useMemo(() => {
        const map = new Map<number, number>();
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (employeeCalendarsByDate && employeeCalendarsByDate.size > 0) {
            employeeCalendarsByDate.forEach((dateMap, empId) => {
                let count = 0;
                const iter = new Date(start);
                while (iter <= end) {
                    const dStr = format(iter, 'yyyy-MM-dd');
                    const tipoDia = dateMap.get(dStr)?.TipoDia;
                    if (tipoDia === '2' || tipoDia === 2) count += 1;
                    iter.setDate(iter.getDate() + 1);
                }
                if (count > 0) map.set(empId, count);
            });
            return map;
        }

        const byEmployee = new Map<number, Set<string>>();
        erpData.forEach(row => {
            const date = normalizeDateStr(row.Fecha);
            if (!date || date < startDate || date > endDate) return;
            if (row.TipoDiaEmpresa !== 2) return;
            const empId = row.IDOperario;
            if (!byEmployee.has(empId)) byEmployee.set(empId, new Set());
            byEmployee.get(empId)!.add(date);
        });
        byEmployee.forEach((dates, empId) => {
            if (dates.size > 0) map.set(empId, dates.size);
        });
        return map;
    }, [employeeCalendarsByDate, erpData, startDate, endDate]);

    const recordedIncidentsByEmployee = useMemo(() => {
        const map = new Map<number, {
            date: string;
            start: string;
            end: string;
            durationHours: number;
            durationHoursInt: number;
            motivoId: number;
            motivoDesc?: string;
            endsNextDay: boolean;
        }[]>();

        const rowsByEmployee = new Map<number, RawDataRow[]>();
        erpData.forEach(row => {
            const date = normalizeDateStr(row.Fecha);
            if (!date || date < startDate || date > endDate) return;
            const empId = row.IDOperario;
            if (!rowsByEmployee.has(empId)) rowsByEmployee.set(empId, []);
            rowsByEmployee.get(empId)!.push(row);
        });

        rowsByEmployee.forEach((rows, empId) => {
            const sorted = [...rows].sort((a, b) => {
                const aDate = normalizeDateStr(a.Fecha);
                const bDate = normalizeDateStr(b.Fecha);
                if (aDate !== bDate) return aDate.localeCompare(bDate);
                return normalizeTimeStr(a.Hora).localeCompare(normalizeTimeStr(b.Hora));
            });

            const incidents: {
                date: string;
                start: string;
                end: string;
                durationHours: number;
                durationHoursInt: number;
                motivoId: number;
                motivoDesc?: string;
                endsNextDay: boolean;
            }[] = [];

            sorted.forEach((row, idx) => {
                if (!isIncidentRow(row)) return;
                const date = normalizeDateStr(row.Fecha);
                const inicio = normalizeTimeStr(row.Inicio || '');
                const fin = normalizeTimeStr(row.Fin || '');

                let start = inicio;
                let end = fin;

                if (!start || !end) {
                    const endCandidate = normalizeTimeStr(row.Hora || '');
                    if (!end) end = endCandidate;

                    if (!start) {
                        let startCandidate = '';
                        for (let k = idx - 1; k >= 0; k--) {
                            if (normalizeDateStr(sorted[k].Fecha) !== date) break;
                            if (isEntrada(sorted[k].Entrada)) {
                                startCandidate = normalizeTimeStr(sorted[k].Hora || '');
                                break;
                            }
                        }
                        start = startCandidate || end;
                    }
                }

                if (!start || !end) return;

                const startMin = toMinutes(start);
                let endMin = toMinutes(end);
                let endsNextDay = false;
                if (endMin < startMin) {
                    endMin += 1440;
                    endsNextDay = true;
                }
                const durationHours = Math.max(0, (endMin - startMin) / 60);
                const durationHoursInt = durationHours > 0 ? Math.max(1, Math.round(durationHours)) : 0;

                incidents.push({
                    date,
                    start,
                    end,
                    durationHours,
                    durationHoursInt,
                    motivoId: Number(row.MotivoAusencia),
                    motivoDesc: row.DescMotivoAusencia || undefined,
                    endsNextDay
                });
            });

            if (incidents.length > 0) map.set(empId, incidents);
        });

        return map;
    }, [erpData, startDate, endDate]);

    // BATCH FETCHING STRATEGY
    const fetchJobsForVisibleEmployees = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setLoadingJobs(true);
        const newJobData: Record<string, JobControlEntry[]> = {};
        const targetEmployees = productiveEmployees;

        if (targetEmployees.length === 0) {
            setLoadingJobs(false);
            return;
        }

        // Concurrency Limiter (Batch size 5)
        const batchSize = 5;
        const employeeIds = targetEmployees.map(e => e.id.toString());

        try {
            for (let i = 0; i < employeeIds.length; i += batchSize) {
                const batch = employeeIds.slice(i, i + batchSize);
                const promises = batch.map(async (id) => {
                    try {
                        const jobs = await getControlOfPorOperario(id, startDate, endDate);
                        newJobData[id] = jobs;
                    } catch (e) {
                        if ((e as Error).name !== 'AbortError') {
                            console.error(`Error fetching jobs for ${id}`, e);
                        }
                    }
                });
                await Promise.all(promises);

                // Update state progressively for better UX
                setJobData(prev => ({ ...prev, ...newJobData }));
            }
            showNotification(`Análisis de trabajos completado.`, 'success');
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error("Error global fetching jobs", error);
                showNotification("Error obteniendo datos del ERP.", 'error');
            }
        } finally {
            setLoadingJobs(false);
        }
    };

    // Clear job data ONLY when dates change actively, not on initial mount if restored
    const isFirstRun = useRef(true);
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            // If we have restored data, don't clear it.
            if (Object.keys(storedState?.jobData || {}).length > 0) {
                return;
            }
        }
        setJobData({});
    }, [startDate, endDate]);

    const handleSearch = () => {
        reloadFromServer();
        fetchJobsForVisibleEmployees();
    };

    // LOGIC: TIME COVERED (UNION) calculation
    const calculateTimeCovered = (jobs: JobControlEntry[]) => {
        if (jobs.length === 0) return 0;

        // 1. Convert to intervals
        const intervals = jobs.map(j => {
            const start = parseErpDateTime(j.FechaInicio, j.HoraInicio);
            const end = parseErpDateTime(j.FechaFin, j.HoraFin);

            if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
                return null;
            }

            return { start, end };
        }).filter(i => i !== null) as { start: Date, end: Date }[];

        if (intervals.length === 0) return 0;

        // 2. Sort by start time
        intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

        // 3. Merge intervals logic
        let coveredMinutes = 0;
        let currentInterval = { ...intervals[0] };

        for (let i = 1; i < intervals.length; i++) {
            const nextInterval = intervals[i];

            if (nextInterval.start < currentInterval.end) {
                // Overlapping or Adjacent
                if (nextInterval.end > currentInterval.end) {
                    currentInterval.end = nextInterval.end; // Extend
                }
            } else {
                // Gap found, push current and start new
                coveredMinutes += differenceInMinutes(currentInterval.end, currentInterval.start);
                currentInterval = { ...nextInterval };
            }
        }
        // Add last one
        coveredMinutes += differenceInMinutes(currentInterval.end, currentInterval.start);

        return coveredMinutes / 60;
    };

    const comparisonRows = useMemo(() => {
        return productiveEmployees.map(emp => {
            const presenceRow = datasetResumen.find(r => r.operario === emp.id);

            const vacationDays = vacationDaysByEmployee.get(emp.id) || 0;
            const sickLeaveHours = presenceRow ? (presenceRow.hITAT || 0) + (presenceRow.hITEC || 0) : 0;
            const sickLeaveType = presenceRow?.hITAT ? 'ITAT' : (presenceRow?.hITEC ? 'ITEC' : '');
            const recordedIncidents = recordedIncidentsByEmployee.get(emp.id) || [];

            // Calcular Presencia Total (Tiempo en planta + Justificado)
            // Usamos horasTotalesConJustificacion (TOTAL) + horasExceso + festivas
            const totalPresence = presenceRow ?
                (presenceRow.horasTotalesConJustificacion || 0) +
                (presenceRow.horasExceso || 0) +
                (presenceRow.festivas || 0) : 0;

            const jobs = jobData[emp.id] || [];

            // 1. Suma de Tiempos (Coste / Producción)
            let totalJobTimeMinutes = 0;
            let improductiveTimeMinutes = 0;
            jobs.forEach(job => {
                const s = parseErpDateTime(job.FechaInicio, job.HoraInicio);
                const e = parseErpDateTime(job.FechaFin, job.HoraFin);
                if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
                    const d = differenceInMinutes(e, s);
                    if (d > 0) {
                        totalJobTimeMinutes += d;
                        if (getImproductiveArticle(job.IDArticulo)) {
                            improductiveTimeMinutes += d;
                        }
                    }
                }
            });
            const totalJobTimeProduced = totalJobTimeMinutes / 60;
            const improductiveTimeProduced = improductiveTimeMinutes / 60;

            // 2. Tiempo Cubierto (Línea de tiempo real sin duplicar solapes)
            const totalTimeCovered = calculateTimeCovered(jobs);

            // GAPS: Si la presencia es mayor que el tiempo cubierto por trabajos
            const timeGap = Math.max(0, totalPresence - totalTimeCovered);

            // OVERLAP/MULTITASKING Coefficient
            const overlapRatio = totalTimeCovered > 0 ? totalJobTimeProduced / totalTimeCovered : 0;

            return {
                emp,
                presenceRow,
                totalPresence,
                jobs,
                totalJobTimeProduced,
                improductiveTimeProduced,
                totalTimeCovered,
                timeGap,
                overlapRatio,
                vacationDays,
                sickLeaveHours,
                sickLeaveType,
                recordedIncidents
            };
        });
    }, [productiveEmployees, datasetResumen, jobData, vacationDaysByEmployee, recordedIncidentsByEmployee]);

    // Filtrado adicional por búsqueda y selección de empleados
    const filteredRows = useMemo(() => {
        let filtered = comparisonRows;

        // Si hay empleados seleccionados, mostrar solo esos
        if (selectedEmployeeIds.size > 0) {
            filtered = filtered.filter(row => selectedEmployeeIds.has(row.emp.id));
        }

        // Búsqueda por nombre/ID
        if (searchFilter.trim()) {
            const search = searchFilter.toLowerCase();
            filtered = filtered.filter(row =>
                row.emp.name.toLowerCase().includes(search) ||
                row.emp.id.toString().includes(search)
            );
        }

        return filtered;
    }, [comparisonRows, searchFilter, selectedEmployeeIds]);

    const sortedRows = useMemo(() => {
        const rows = [...filteredRows];
        const dir = sortDir === 'asc' ? 1 : -1;

        rows.sort((a, b) => {
            if (sortKey === 'empId') {
                return (a.emp.id - b.emp.id) * dir;
            }
            if (sortKey === 'name') {
                return a.emp.name.localeCompare(b.emp.name) * dir;
            }
            if (sortKey === 'worked') {
                return (a.totalTimeCovered - b.totalTimeCovered) * dir;
            }
            return (a.timeGap - b.timeGap) * dir;
        });

        return rows;
    }, [filteredRows, sortKey, sortDir]);

    // Estadísticas Globales para el Panel Superior
    const globalStats = useMemo(() => {
        const totalPresence = comparisonRows.reduce((acc, row) => acc + row.totalPresence, 0);
        const totalCovered = comparisonRows.reduce((acc, row) => acc + row.totalTimeCovered, 0);
        const totalImproductiveProduced = comparisonRows.reduce((acc, row) => acc + row.improductiveTimeProduced, 0);
        const occupancy = totalPresence > 0 ? (totalCovered / totalPresence) * 100 : 0;
        const totalGap = Math.max(0, totalPresence - totalCovered);

        return {
            totalPresence,
            totalCovered,
            totalImproductiveProduced,
            occupancy,
            totalGap
        };
    }, [comparisonRows]);


    const toggleExpand = (id: number) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRows(newSet);
    };

    // Handler para exportar reporte a PDF
    const handleExportPDF = async () => {
        try {
            showNotification('Generando reporte PDF...', 'info');

            const employeeData = sortedRows.map(row => ({
                operario: row.emp.id,
                nombre: row.emp.name,
                departamento: row.emp.department,
                totalPresence: row.totalPresence,
                totalCovered: row.totalTimeCovered,
                timeGap: row.timeGap,
                occupancy: row.totalPresence > 0 ? (row.totalTimeCovered / row.totalPresence) * 100 : 0
            }));

            const avgEfficiency = comparisonRows.length > 0 ? globalStats.totalCovered / comparisonRows.length : 0;

            await exportWeeklyJobAuditToPDF(
                { ...globalStats, avgEfficiency, employeeCount: comparisonRows.length },
                employeeData,
                {
                    startDate,
                    endDate,
                    department: selectedDepartment,
                    includeEmployeeDetails: true
                }
            );

            showNotification('✅ Reporte PDF generado correctamente', 'success');
        } catch (error) {
            console.error('Error exportando PDF:', error);
            showNotification('❌ Error al generar el ranking', 'error');
        }
    };

    const handleExportImproductiveByArticle = async () => {
        try {
            showNotification('Generando informe de actividades...', 'info');

            // Aggregate by Article
            const articleMap = new Map<string, { name: string; hours: number; count: number }>();

            filteredRows.forEach(row => {
                row.jobs.forEach(job => {
                    const article = getImproductiveArticle(job.IDArticulo);
                    if (article) {
                        const s = parseErpDateTime(job.FechaInicio, job.HoraInicio);
                        const e = parseErpDateTime(job.FechaFin, job.HoraFin);
                        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
                            const d = differenceInMinutes(e, s) / 60; // hours
                            if (d > 0) {
                                const key = job.IDArticulo;
                                const current = articleMap.get(key) || { name: article.desc, hours: 0, count: 0 };
                                current.hours += d;
                                current.count += 1;
                                articleMap.set(key, current);
                            }
                        }
                    }
                });
            });

            const totalImproductiveHours = Array.from(articleMap.values()).reduce((acc, v) => acc + v.hours, 0);

            const articleRows = Array.from(articleMap.entries()).map(([id, data]) => ({
                articleId: id,
                articleName: data.name,
                totalHours: data.hours,
                percentOfTotalImproductive: totalImproductiveHours > 0 ? (data.hours / totalImproductiveHours) * 100 : 0,
                occurrenceCount: data.count
            })).sort((a, b) => b.totalHours - a.totalHours);

            await exportImproductiveByArticleToPDF(articleRows, {
                startDate,
                endDate,
                department: selectedDepartment
            });

            showNotification('✅ Informe de actividades exportado', 'success');
        } catch (error) {
            console.error('Error exportando informe actividades:', error);
            showNotification('❌ Error al generar el informe', 'error');
        }
    };

    const handleExportImproductiveRanking = async () => {
        try {
            showNotification('Generando ranking de improductivos...', 'info');

            const rankingRows = [...filteredRows]
                .map(row => ({
                    operario: row.emp.id,
                    nombre: row.emp.name,
                    departamento: row.emp.department,
                    improductiveHours: row.improductiveTimeProduced,
                    totalPresence: row.totalPresence,
                    improductivePercent: row.totalPresence > 0
                        ? (row.improductiveTimeProduced / row.totalPresence) * 100
                        : 0
                }))
                .sort((a, b) => b.improductiveHours - a.improductiveHours);

            await exportImproductiveRankingToPDF(rankingRows, {
                startDate,
                endDate,
                department: selectedDepartment
            });

            showNotification('✅ Ranking de improductivos exportado', 'success');
        } catch (error) {
            console.error('Error exportando ranking:', error);
            showNotification('❌ Error al exportar el ranking de improductivos', 'error');
        }
    };
    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-orange-600 flex items-center gap-2">
                            <Layers className="text-orange-500 w-8 h-8" />
                            Auditoría de Trabajos
                        </h1>
                        <p className="text-slate-500 mt-1 text-sm">
                            Análisis de cobertura de jornada vs imputaciones de fabricación (Datos Reales ERP)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-3 custom-filters">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Desde</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Hasta</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div className="min-w-[180px]">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Sección</label>
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="all">Todas las secciones</option>
                                {computedDepartments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>

                        <div className="min-w-[250px]">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Buscar Empleado</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Nombre o ID..."
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            {selectedEmployeeIds.size > 0 && (
                                <button
                                    onClick={() => setSelectedEmployeeIds(new Set())}
                                    className="text-xs text-blue-600 mt-1 hover:underline"
                                >
                                    Limpiar selección ({selectedEmployeeIds.size})
                                </button>
                            )}
                        </div>

                        <div className="min-w-[220px]">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Ordenar por</label>
                            <select
                                value={sortKey}
                                onChange={(e) => setSortKey(e.target.value as 'gap' | 'worked' | 'empId' | 'name')}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="gap">Tiempo sin trabajar</option>
                                <option value="worked">Tiempo trabajado</option>
                                <option value="empId">Numero de empleado</option>
                                <option value="name">Nombre</option>
                            </select>
                        </div>

                        <div className="min-w-[140px]">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Direccion</label>
                            <select
                                value={sortDir}
                                onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="desc">Descendente</option>
                                <option value="asc">Ascendente</option>
                            </select>
                        </div>

                        <button
                            onClick={handleSearch}
                            disabled={isReloading || loadingJobs}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white font-medium shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5
                                ${isReloading || loadingJobs ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            {(isReloading || loadingJobs) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {isReloading ? 'Calculando Presencia...' : (loadingJobs ? 'Analizando Trabajos...' : 'Auditar')}
                        </button>

                        <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-100/50 rounded-xl border border-slate-200/60 shadow-inner">
                            <div className="flex flex-col mr-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Herramientas de</span>
                                <span className="text-xs font-black text-indigo-600 uppercase tracking-wider leading-none">Exportación</span>
                            </div>

                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all hover:-translate-y-0.5"
                                title="Informe General de Presencia"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                General
                            </button>

                            <button
                                onClick={handleExportImproductiveRanking}
                                className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all hover:-translate-y-0.5"
                                title="Ranking de Empleados Improductivos"
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                Ranking
                            </button>

                            <button
                                onClick={handleExportImproductiveByArticle}
                                className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all hover:-translate-y-0.5"
                                title="Informe de Actividades Improductivas"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                Actividades
                            </button>
                        </div>

                        <button
                            onClick={() => setShowDashboard(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95 animate-pulse"
                        >
                            <PieChart className="w-4 h-4" />
                            DASHBOARD INTERACTIVO
                        </button>

                        <button
                            onClick={() => setShowDebug(!showDebug)}
                            className="text-xs text-slate-400 hover:text-slate-600 font-medium px-2"
                        >
                            {showDebug ? 'Ocultar Debug' : 'Debug'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Global Summary Stats - NUEVO */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 mt-4 animate-fadeIn">
                {/* Ocupación Global (Donut Chart) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-6 transition-all hover:shadow-md col-span-1 md:col-span-1">
                    <div className="relative w-24 h-24 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-slate-100"
                            />
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 40}
                                strokeDashoffset={2 * Math.PI * 40 * (1 - globalStats.occupancy / 100)}
                                strokeLinecap="round"
                                className="text-indigo-600 transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-slate-800">{globalStats.occupancy.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Ocupación Dept.</h3>
                        <p className="text-2xl font-black text-slate-800">{globalStats.totalCovered.toFixed(1)}h</p>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">De {globalStats.totalPresence.toFixed(1)}h totales</p>
                    </div>
                </div>

                {/* KPI BLOCKS */}
                <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Tiempo Productivo */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <CheckCircle2 className="w-16 h-16 text-emerald-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Tiempo Productivo</h3>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-emerald-600">
                                {(globalStats.totalCovered - globalStats.totalImproductiveProduced).toFixed(1)}h
                            </p>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                {globalStats.totalPresence > 0 ? (((globalStats.totalCovered - globalStats.totalImproductiveProduced) / globalStats.totalPresence) * 100).toFixed(0) : 0}%
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Trabajo real efectivo (neto)</p>
                    </div>

                    {/* 2. Tiempo Improductivo */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <Clock className="w-16 h-16 text-amber-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Tiempo Improductivo</h3>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-amber-600">{globalStats.totalImproductiveProduced.toFixed(1)}h</p>
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                {globalStats.totalPresence > 0 ? ((globalStats.totalImproductiveProduced / globalStats.totalPresence) * 100).toFixed(0) : 0}%
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Limpieza, Mantenimiento, etc.</p>
                    </div>

                    {/* 3. Tiempo No Empleado (GAP) */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <AlertTriangle className="w-16 h-16 text-red-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">No Cubierto (GAP)</h3>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-red-600">{globalStats.totalGap.toFixed(1)}h</p>
                            <span className="text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                                {globalStats.totalPresence > 0 ? ((globalStats.totalGap / globalStats.totalPresence) * 100).toFixed(0) : 0}%
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Tiempo pagado sin actividad</p>
                    </div>
                </div>
            </div>

            {/* List */}
            < div className="space-y-4" >
                {
                    filteredRows.length === 0 && comparisonRows.length > 0 && (
                        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                            <p className="text-slate-400 font-medium">No se encontraron empleados que coincidan con la búsqueda "{searchFilter}"</p>
                            <button
                                onClick={() => setSearchFilter('')}
                                className="mt-3 text-sm text-blue-600 hover:underline"
                            >
                                Limpiar búsqueda
                            </button>
                        </div>
                    )
                }
                {
                    sortedRows.map(({ emp, totalPresence, totalTimeCovered, totalJobTimeProduced, improductiveTimeProduced, jobs, timeGap, overlapRatio, vacationDays, sickLeaveHours, sickLeaveType, recordedIncidents }) => {
                        const isMissingJobs = totalPresence > 0.5 && totalTimeCovered === 0;
                        const isBigGap = timeGap > 0.5; // > 30 min gap
                        const hasHighOverlap = overlapRatio > 1.1; // > 10% parallel work
                        const hasPresence = totalPresence > 0.05;
                        const hasCoverage = totalTimeCovered > 0.05;
                        const hasOverCoverage = totalTimeCovered > totalPresence + 0.05;
                        const isNoPresenceButWork = !hasPresence && hasCoverage;
                        const hasVacation = vacationDays > 0;
                        const hasSickLeave = sickLeaveHours > 0;
                        const hasRecordedIncidents = recordedIncidents.length > 0;
                        const gapLabel = isNoPresenceButWork
                            ? 'SIN JORNADA'
                            : hasOverCoverage
                                ? 'REVISION'
                                : timeGap > 0.05
                                    ? timeGap.toFixed(2) + 'h'
                                    : 'OK';
                        const gapClass = (isNoPresenceButWork || hasOverCoverage)
                            ? 'text-amber-600'
                            : isBigGap
                                ? 'text-red-500'
                                : 'text-slate-300';

                        return (
                            <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md group">
                                <div
                                    className="p-5 cursor-pointer flex flex-col lg:flex-row gap-6 items-center"
                                    onClick={() => toggleExpand(emp.id)}
                                >
                                    {/* Operario Info */}
                                    <div className="w-full lg:w-1/4 flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner transition-colors duration-500
                                        ${isMissingJobs || isBigGap ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {emp.id}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{emp.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-slate-500 text-xs font-medium bg-slate-100 px-2 py-0.5 rounded-md">{emp.department}</span>
                                                {hasHighOverlap && <span className="text-amber-600 text-[10px] font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">MULTITASK x{overlapRatio.toFixed(1)}</span>}
                                                {improductiveTimeProduced > 0 && (
                                                    <span className="text-amber-700 text-[10px] font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                        IMPROD. {improductiveTimeProduced.toFixed(2)}h
                                                    </span>
                                                )}
                                                {showDebug && <span className="text-xs font-mono text-purple-600 ml-2">[{jobs.length} regs / ID:{emp.id}]</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bars Visualization */}
                                    <div className="w-full lg:flex-1 flex flex-col gap-3 relative">
                                        {/* Presencia (Jornada) */}
                                        <div className="flex items-center gap-3 relative z-10">
                                            <div className="w-24 text-xs font-bold text-slate-500 text-right uppercase tracking-wider">Jornada</div>
                                            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full relative"
                                                    style={{ width: `${Math.min((totalPresence / 10) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="w-16 text-right font-mono font-bold text-emerald-600 text-sm">
                                                {totalPresence.toFixed(2)}h
                                            </div>
                                        </div>

                                        {/* Cobertura (Tiempo Tocado) */}
                                        <div className="flex items-center gap-3 relative z-10">
                                            <div className="w-24 text-xs font-bold text-slate-500 text-right uppercase tracking-wider">Ocupación</div>
                                            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                                                {/* Fondo: Total Producido (Opaco) */}
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-blue-200/50"
                                                    style={{ width: `${Math.min((totalJobTimeProduced / 10) * 100, 100)}%` }}
                                                ></div>
                                                {/* Frente: Cobertura Real (Sólido) */}
                                                <div
                                                    className="h-full bg-blue-600 rounded-full relative"
                                                    style={{ width: `${Math.min((totalTimeCovered / 10) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="w-16 text-right font-mono font-bold text-blue-600 text-sm">
                                                {totalTimeCovered.toFixed(2)}h
                                            </div>
                                        </div>

                                        {(hasVacation || hasSickLeave || hasRecordedIncidents) && (
                                            <div className="flex flex-wrap gap-2 text-[11px]">
                                                {hasVacation && (
                                                    <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 font-semibold">
                                                        Vacaciones {vacationDays}d
                                                    </span>
                                                )}
                                                {hasSickLeave && (
                                                    <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded border border-rose-100 font-semibold">
                                                        Baja {sickLeaveType || 'IT'} {sickLeaveHours.toFixed(1)}h
                                                    </span>
                                                )}
                                                {recordedIncidents.map((inc, idx) => (
                                                    <span key={`${emp.id}-inc-${idx}`} className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-semibold">
                                                        {formatShortDate(inc.date)} · INC {String(inc.motivoId).padStart(2, '0')} · {inc.start}-{inc.end}{inc.endsNextDay ? ' (+1)' : ''} · {inc.durationHoursInt}h
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Summary & Alerts */}
                                    <div className="w-full lg:w-1/5 flex justify-end items-center gap-4 border-l border-slate-100 pl-6">
                                        <div className="text-right bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                                            <div className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-1">Improductivo</div>
                                            <div className={`text-xl font-black ${improductiveTimeProduced > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                                {improductiveTimeProduced.toFixed(2)}h
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Sin Cubrir</div>
                                            <div className={`text-2xl font-black ${gapClass}`}>
                                                {gapLabel}
                                            </div>
                                        </div>
                                        <div className="w-8 flex justify-center">
                                            {expandedRows.has(emp.id) ? (
                                                <ChevronUp className="w-5 h-5 text-slate-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-slate-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Alerts Banner */}
                                {(isMissingJobs || isBigGap || hasOverCoverage) && (
                                    <div className="px-5 pb-3 flex flex-wrap gap-2 text-xs">
                                        {isMissingJobs && <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 flex items-center gap-1 font-bold"><AlertTriangle className="w-3 h-3" /> SIN IMPUTACIONES</span>}
                                        {isBigGap && totalTimeCovered > 0 && <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 flex items-center gap-1 font-bold"><AlertTriangle className="w-3 h-3" /> HUECO DE {timeGap.toFixed(2)}h</span>}
                                        {isNoPresenceButWork && <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 flex items-center gap-1 font-bold"><AlertTriangle className="w-3 h-3" /> IMPUTADO SIN JORNADA</span>}
                                        {hasOverCoverage && !isNoPresenceButWork && <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 flex items-center gap-1 font-bold"><AlertTriangle className="w-3 h-3" /> IMPUTACION &gt; PRESENCIA</span>}
                                    </div>
                                )}

                                {/* Detailed List */}
                                {expandedRows.has(emp.id) && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-5 animate-fadeIn">
                                        {showDebug && (
                                            <div className="mb-4 p-4 bg-slate-900 rounded-lg overflow-x-auto">
                                                <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">Raw API Data Debug</h4>
                                                <pre className="text-[10px] font-mono text-green-400 whitespace-pre">
                                                    {JSON.stringify(jobs.slice(0, 3), null, 2)}
                                                    {jobs.length > 3 && `\n... y ${jobs.length - 3} más`}
                                                    {jobs.length === 0 && "\n[No Data Returned from API]"}
                                                </pre>
                                            </div>
                                        )}

                                        {jobs.length > 0 ? (
                                            <table className="w-full text-sm text-left border-separate border-spacing-0">
                                                <thead className="text-slate-400 font-semibold text-xs uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-2 border-b border-slate-200">Orden</th>
                                                        <th className="px-4 py-2 border-b border-slate-200">Operación</th>
                                                        <th className="px-4 py-2 border-b border-slate-200">Artículo</th>
                                                        <th className="px-4 py-2 border-b border-slate-200 text-center">Cant.</th>
                                                        <th className="px-4 py-2 border-b border-slate-200">Horario</th>
                                                        <th className="px-4 py-2 border-b border-slate-200 text-right">Duración</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-slate-600">
                                                    {[...jobs]
                                                        .sort((a, b) => {
                                                            const aStart = parseErpDateTime(a.FechaInicio, a.HoraInicio).getTime();
                                                            const bStart = parseErpDateTime(b.FechaInicio, b.HoraInicio).getTime();
                                                            return aStart - bStart;
                                                        })
                                                        .map((job, idx) => {
                                                            const start = parseErpDateTime(job.FechaInicio, job.HoraInicio);
                                                            const end = parseErpDateTime(job.FechaFin, job.HoraFin);
                                                            const duration = !isNaN(start.getTime()) && !isNaN(end.getTime())
                                                                ? differenceInMinutes(end, start) / 60
                                                                : 0;
                                                            const improductiveInfo = getImproductiveArticle(job.IDArticulo);

                                                            return (
                                                                <tr key={idx} className={`hover:bg-white transition-colors ${improductiveInfo ? 'bg-amber-50/60' : ''}`}>
                                                                    <td className="px-4 py-3 border-b border-slate-100 font-mono font-medium text-slate-900 bg-white/50">{job.NOrden}</td>
                                                                    <td className="px-4 py-3 border-b border-slate-100">{job.DescOperacion}</td>
                                                                    <td className="px-4 py-3 border-b border-slate-100 text-xs">
                                                                        <div className="flex items-center gap-2">
                                                                            <span>{job.IDArticulo}</span>
                                                                            {improductiveInfo && (
                                                                                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
                                                                                    Improductivo
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {improductiveInfo && (
                                                                            <div className="text-[10px] text-amber-700 mt-1">
                                                                                {improductiveInfo.desc}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 border-b border-slate-100 text-center font-mono">
                                                                        <span className="text-blue-600 font-bold">{job.QBuena ?? 0}</span>
                                                                        <span className="text-slate-400 mx-1">/</span>
                                                                        <span className="text-slate-500">{job.QFabricar ?? 0}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 border-b border-slate-100 font-mono text-xs">
                                                                        {!isNaN(start.getTime()) ? format(start, 'HH:mm') : '??'} - {!isNaN(end.getTime()) ? format(end, 'HH:mm') : '??'}
                                                                    </td>
                                                                    <td className="px-4 py-3 border-b border-slate-100 text-right font-bold text-slate-800">
                                                                        {duration.toFixed(2)}h
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                </tbody>
                                                <tfoot className="bg-slate-100 text-xs uppercase">
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-2 text-right text-slate-500">Tiempo Imputado (Suma):</td>
                                                        <td className="px-4 py-2 text-right font-bold text-slate-700">{totalJobTimeProduced.toFixed(2)}h</td>
                                                    </tr>
                                                    {improductiveTimeProduced > 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-2 text-right text-amber-700 font-bold border-t border-amber-100">Tiempo Improductivo (Suma):</td>
                                                            <td className="px-4 py-2 text-right font-bold text-amber-700 border-t border-amber-100">{improductiveTimeProduced.toFixed(2)}h</td>
                                                        </tr>
                                                    )}
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-2 text-right text-blue-600 font-bold border-t border-slate-200">Tiempo Cubierto (Sin Solapes):</td>
                                                        <td className="px-4 py-2 text-right font-bold text-blue-600 border-t border-slate-200">{totalTimeCovered.toFixed(2)}h</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        ) : (
                                            <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2">
                                                <Smartphone className="w-8 h-8 opacity-50" />
                                                <p>No hay imputaciones de trabajo registradas para este periodo.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                }

                {
                    comparisonRows.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                            <p className="text-slate-400 font-medium">No se encontraron empleados con actividad en este periodo.</p>
                        </div>
                    )
                }
            </div>

            {showDashboard && (
                <ProductivityDashboard
                    rows={filteredRows}
                    globalStats={globalStats}
                    onClose={() => setShowDashboard(false)}
                />
            )}
        </div>
    );
};
