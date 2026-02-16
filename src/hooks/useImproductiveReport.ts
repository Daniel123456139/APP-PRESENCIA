
import { useState, useCallback } from 'react';
import { getOperarios, getControlOfPorOperario, Operario } from '../services/erpApi';
import { getImproductiveArticle, IMPRODUCTIVE_ARTICLES } from '../data/improductiveArticles';
import { parseErpDateTime, timeToDecimalHours } from '../utils/datetime';
import { parseLocalDateTime } from '../utils/localDate';

export interface ImproductiveRow {
    operatorId: number;
    operatorName: string;
    totalHours: number;
    improductiveHours: number;
    breakdown: Record<string, number>; // Breakdown by Article ID
    productiveHours: number; // Derived
}

export interface DepartmentGroup {
    departmentId: number;
    departmentName: string;
    rows: ImproductiveRow[];
    // Totals for the group
    totalHours: number;
    totalImproductive: number;
    breakdown: Record<string, number>; // Breakdown totals for the group
    totalProductive: number;
}

export const useImproductiveReport = () => {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 100
    const [error, setError] = useState<string | null>(null);

    const generateReportData = useCallback(async (startDate: string, endDate: string, startTime: string = '00:00:00', endTime: string = '23:59:59') => {
        setLoading(true);
        setProgress(0);
        setError(null);

        try {
            const rangeStart = parseLocalDateTime(startDate, startTime);
            const rangeEnd = parseLocalDateTime(endDate, endTime);
            rangeEnd.setMilliseconds(999);

            const getClippedHours = (job: any): number => {
                const start = parseErpDateTime(job.FechaInicio, job.HoraInicio);
                const end = parseErpDateTime(job.FechaFin, job.HoraFin);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

                const clippedStart = start < rangeStart ? rangeStart : start;
                const clippedEnd = end > rangeEnd ? rangeEnd : end;
                return timeToDecimalHours(clippedStart, clippedEnd);
            };

            const getJobArticleId = (job: any): string => {
                return (
                    job?.IDArticulo ??
                    job?.Articulo ??
                    job?.IdArticulo ??
                    job?.idArticulo ??
                    job?.CodigoArticulo ??
                    job?.CodArticulo ??
                    ''
                );
            };

            const getJobArticleDesc = (job: any): string => {
                return (
                    job?.DescArticulo ??
                    job?.DescripcionArticulo ??
                    job?.Descripcion ??
                    job?.DescOperacion ??
                    ''
                );
            };

            // 1. Fetch all active employees
            const allOperarios = await getOperarios(true); // Active only
            // Filter out 'zzz' or invalid ones if necessary, though getOperarios might handle common cases.
            // Explicitly ensuring valid departments and names.
            const validOperarios = allOperarios.filter(op =>
                op.Activo &&
                !op.DescOperario.toLowerCase().includes('zzz') &&
                op.IDOperario !== 999
            );

            const totalOps = validOperarios.length;
            const batchSize = 15; // Optimized for performance (was 5)

            const deptMap = new Map<string, DepartmentGroup>();

            // Helper to get or create dept
            const getDept = (op: Operario) => {
                const deptName = op.DescDepartamento || 'SIN DEPARTAMENTO';
                if (!deptMap.has(deptName)) {
                    deptMap.set(deptName, {
                        departmentId: op.IDDepartamento || 0,
                        departmentName: deptName,
                        rows: [],
                        totalHours: 0,
                        totalImproductive: 0,
                        breakdown: {},
                        totalProductive: 0
                    });
                }
                return deptMap.get(deptName)!;
            };

            // 2. Batch fetch job data
            for (let i = 0; i < totalOps; i += batchSize) {
                const batch = validOperarios.slice(i, i + batchSize);

                await Promise.all(batch.map(async (op) => {
                    try {
                        const jobs = await getControlOfPorOperario(
                            String(op.IDOperario),
                            startDate,
                            endDate
                        );

                        // Process jobs for this operator
                        let userTotal = 0;
                        let userImprod = 0;
                        const userBreakdown: Record<string, number> = {};

                        jobs.forEach(job => {
                            const hours = getClippedHours(job);
                            const articleId = getJobArticleId(job);
                            const articleDesc = getJobArticleDesc(job);

                            if (hours > 0) {
                                userTotal += hours;
                                const impArticle = getImproductiveArticle(articleId, articleDesc);
                                if (impArticle) {
                                    userImprod += hours;
                                    // Track breakdown
                                    const key = impArticle.id;
                                    userBreakdown[key] = (userBreakdown[key] || 0) + hours;
                                }
                            }
                        });

                        // Add to Dept
                        const dept = getDept(op);

                        const row: ImproductiveRow = {
                            operatorId: op.IDOperario,
                            operatorName: op.DescOperario,
                            totalHours: userTotal,
                            improductiveHours: userImprod,
                            breakdown: userBreakdown,
                            productiveHours: userTotal - userImprod
                        };

                        dept.rows.push(row);
                        dept.totalHours += row.totalHours;
                        dept.totalImproductive += row.improductiveHours;
                        dept.totalProductive += row.productiveHours;

                        // Add to Dept Breakdown
                        Object.entries(userBreakdown).forEach(([key, val]) => {
                            dept.breakdown[key] = (dept.breakdown[key] || 0) + val;
                        });

                    } catch (e) {
                        console.error(`Error fetching jobs for ${op.DescOperario}`, e);
                        // Continue even if one fails
                    }
                }));

                const processed = Math.min(i + batchSize, totalOps);
                setProgress(Math.round((processed / totalOps) * 100));
            }

            // 3. Format Output
            const sortedDepts = Array.from(deptMap.values()).sort((a, b) =>
                a.departmentName.localeCompare(b.departmentName)
            );

            // Sort rows within depts
            sortedDepts.forEach(d => {
                d.rows.sort((a, b) => a.operatorName.localeCompare(b.operatorName));
            });

            setLoading(false);

            const officialArticleIds = IMPRODUCTIVE_ARTICLES.map((a) => a.id);

            return {
                data: sortedDepts,
                allArticleIds: officialArticleIds
            };

        } catch (err: any) {
            console.error("Error generating report", err);
            setError(err.message || "Error generando el reporte");
            setLoading(false);
            return {
                data: [],
                allArticleIds: []
            };
        }
    }, []);

    return {
        generateReportData,
        loading,
        progress,
        error
    };
};
