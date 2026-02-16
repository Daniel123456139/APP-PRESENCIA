type PerfMetric = {
    name: string;
    valueMs: number;
    timestamp: string;
    meta?: Record<string, string | number | boolean>;
};

const STORAGE_KEY = 'perf_metrics_v1';
const MAX_METRICS = 200;

export const trackPerfMetric = (name: string, valueMs: number, meta?: PerfMetric['meta']) => {
    if (typeof window === 'undefined') return;
    if (!Number.isFinite(valueMs) || valueMs < 0) return;

    const metric: PerfMetric = {
        name,
        valueMs: Math.round(valueMs * 100) / 100,
        timestamp: new Date().toISOString(),
        meta
    };

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: PerfMetric[] = raw ? JSON.parse(raw) : [];
        const next = [metric, ...parsed].slice(0, MAX_METRICS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // no-op
    }
};
