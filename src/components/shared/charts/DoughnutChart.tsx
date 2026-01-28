import React, { useState } from 'react';

interface DoughnutChartProps {
    data: { label: string; value: number }[];
    title: string;
    colors?: string[];
}

const DEFAULT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#3B82F6'];

const DoughnutChart: React.FC<DoughnutChartProps> = ({ data, title, colors = DEFAULT_COLORS }) => {
    const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
    const totalValue = data.reduce((sum, item) => sum + item.value, 0);

    if (totalValue === 0) {
        return (
            <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-4">{title}</h3>
                <div className="flex items-center justify-center h-[300px] bg-slate-50/70 rounded-md">
                    <p className="text-slate-500">No hay datos disponibles.</p>
                </div>
            </div>
        );
    }

    let accumulatedAngle = 0;
    const segments = data.map((item, index) => {
        const percentage = (item.value / totalValue) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = accumulatedAngle;
        accumulatedAngle += angle;
        const endAngle = accumulatedAngle;

        const largeArcFlag = angle > 180 ? 1 : 0;
        const startX = 50 + 40 * Math.cos(Math.PI * (startAngle - 90) / 180);
        const startY = 50 + 40 * Math.sin(Math.PI * (startAngle - 90) / 180);
        const endX = 50 + 40 * Math.cos(Math.PI * (endAngle - 90) / 180);
        const endY = 50 + 40 * Math.sin(Math.PI * (endAngle - 90) / 180);

        const pathData = `M ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY}`;
        
        return {
            ...item,
            pathData,
            color: colors[index % colors.length],
            percentage: percentage.toFixed(1),
        };
    });

    return (
        <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="relative w-full aspect-square">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                        {segments.map(segment => (
                            <path
                                key={segment.label}
                                d={segment.pathData}
                                stroke={segment.color}
                                strokeWidth={hoveredSegment === segment.label ? "12" : "10"}
                                fill="none"
                                className="transition-all duration-200"
                                onMouseEnter={() => setHoveredSegment(segment.label)}
                                onMouseLeave={() => setHoveredSegment(null)}
                            >
                                <title>{`${segment.label}: ${segment.value} (${segment.percentage}%)`}</title>
                            </path>
                        ))}
                    </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-slate-800">
                            {hoveredSegment ? segments.find(s => s.label === hoveredSegment)?.value : totalValue}
                        </span>
                        <span className="text-sm text-slate-500">
                            {hoveredSegment || 'Total'}
                        </span>
                    </div>
                </div>
                <div className="space-y-2">
                    {segments.map(segment => (
                        <div key={segment.label} className="flex items-center text-sm">
                            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: segment.color }}></span>
                            <span className="text-slate-600 flex-1">{segment.label}</span>
                            <span className="font-semibold text-slate-800">{segment.value}</span>
                             <span className="text-slate-400 w-12 text-right">{segment.percentage}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DoughnutChart;