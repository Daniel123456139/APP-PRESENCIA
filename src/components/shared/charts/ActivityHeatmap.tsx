
import React, { useMemo, useState } from 'react';
import { toISODateLocal } from '../../../utils/localDate';

interface HeatmapProps {
    data: { date: string; value: number }[];
    startDate: string;
    endDate: string;
}

const ActivityHeatmap: React.FC<HeatmapProps> = ({ data, startDate, endDate }) => {
    const [tooltip, setTooltip] = useState<{ x: number, y: number, content: string } | null>(null);

    const dataMap = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach(item => map.set(item.date, item.value));
        return map;
    }, [data]);

    const maxValue = useMemo(() => Math.max(1, ...(Array.from(dataMap.values()) as number[])), [dataMap]);

    const getColor = (value: number) => {
        if (value === 0) return 'bg-slate-100 hover:bg-slate-200';
        const intensity = Math.min(Math.ceil((value / maxValue) * 4), 4);
        switch (intensity) {
            case 1: return 'bg-emerald-200 hover:bg-emerald-300';
            case 2: return 'bg-emerald-400 hover:bg-emerald-500';
            case 3: return 'bg-emerald-600 hover:bg-emerald-700';
            case 4: return 'bg-emerald-800 hover:bg-emerald-900';
            default: return 'bg-slate-100 hover:bg-slate-200';
        }
    };
    
    const calendarGrid = useMemo(() => {
        if (!startDate || !endDate) return [];
        const grid = [];
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        let current = new Date(start);

        // Pad start
        const startDayOfWeek = current.getDay(); // 0 = Sunday
        for (let i = 0; i < startDayOfWeek; i++) {
            grid.push({ key: `pad-start-${i}` });
        }

        // Fill days
        while (current <= end) {
            grid.push({ 
                key: toISODateLocal(current), 
                date: new Date(current) 
            });
            current.setDate(current.getDate() + 1);
        }
        return grid;

    }, [startDate, endDate]);
    
    const handleMouseOver = (e: React.MouseEvent<HTMLDivElement>, dateStr: string, value: number) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY - 40,
            content: `${new Date(dateStr + 'T00:00:00').toLocaleDateString()}: ${value} incidencia(s)`
        });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">Mapa de Actividad de Incidencias</h3>
             {tooltip && (
                <div 
                    className="fixed z-30 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-md shadow-lg pointer-events-none"
                    style={{ top: tooltip.y, left: tooltip.x }}
                >
                    {tooltip.content}
                </div>
            )}
            <div className="grid grid-cols-7 gap-1.5">
                {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(day => (
                    <div key={day} className="text-center font-medium text-xs text-slate-500">{day}</div>
                ))}
                {calendarGrid.map(cell => {
                    if (!cell.date) {
                        return <div key={cell.key}></div>;
                    }
                    const dateStr = cell.key;
                    const value = dataMap.get(dateStr) || 0;
                    return (
                        <div
                            key={cell.key}
                            className={`w-full aspect-square rounded-md transition-colors ${getColor(value)}`}
                            onMouseOver={(e) => handleMouseOver(e, dateStr, value)}
                            onMouseLeave={() => setTooltip(null)}
                        >
                            <span className="sr-only">{dateStr}: {value} incidents</span>
                        </div>
                    );
                })}
            </div>
             <div className="flex justify-end items-center mt-4 space-x-4 text-xs">
                <span className="text-slate-500">Menos</span>
                <div className="flex space-x-1">
                    <div className="w-4 h-4 rounded bg-slate-100"></div>
                    <div className="w-4 h-4 rounded bg-emerald-200"></div>
                    <div className="w-4 h-4 rounded bg-emerald-400"></div>
                    <div className="w-4 h-4 rounded bg-emerald-600"></div>
                    <div className="w-4 h-4 rounded bg-emerald-800"></div>
                </div>
                <span className="text-slate-500">Más</span>
            </div>
        </div>
    );
};

export default ActivityHeatmap;
