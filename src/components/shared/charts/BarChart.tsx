import React, { useState } from 'react';

interface BarChartProps {
    data: { label: string; value: number }[];
    title: string;
    color?: string;
    horizontal?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({ data, title, color = '#3B82F6', horizontal = false }) => {
    const [hoveredBar, setHoveredBar] = useState<string | null>(null);
    const maxValue = Math.max(...data.map(d => d.value), 0);
    const chartHeight = 300;
    const barGap = 10;
    const barWidth = horizontal ? 30 : (400 - (data.length - 1) * barGap) / data.length;

    if (data.length === 0) {
        return (
            <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-4">{title}</h3>
                <div className="flex items-center justify-center h-[300px] bg-slate-50/70 rounded-md">
                    <p className="text-slate-500">No hay datos disponibles.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4">{title}</h3>
            <div className={`relative ${horizontal ? 'h-auto' : `h-[${chartHeight}px]`}`}>
                <svg width="100%" height={horizontal ? data.length * (barWidth + barGap) : chartHeight} className="overflow-visible">
                    {horizontal ? (
                         <g>
                            {data.map((item, index) => {
                                const y = index * (barWidth + barGap);
                                const barLength = item.value > 0 ? (item.value / maxValue) * 80 : 0; // use 80% to leave space for label
                                return (
                                    <g 
                                        key={item.label} 
                                        onMouseEnter={() => setHoveredBar(item.label)} 
                                        onMouseLeave={() => setHoveredBar(null)}
                                        className="transition-opacity duration-200"
                                    >
                                        <text x="-10" y={y + barWidth / 2} dy=".35em" textAnchor="end" className="text-xs fill-current text-slate-500">{item.label}</text>
                                        <rect
                                            x="0"
                                            y={y}
                                            width={`${barLength}%`}
                                            height={barWidth}
                                            fill={color}
                                            rx="4"
                                            ry="4"
                                        >
                                            <title>{`${item.label}: ${item.value.toFixed(2)}`}</title>
                                        </rect>
                                        <text
                                            x={`${barLength + 2}%`}
                                            y={y + barWidth / 2}
                                            dy=".35em"
                                            className="text-xs fill-current text-slate-600 font-medium"
                                        >
                                            {item.value.toFixed(1)}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                    ) : (
                        <g>
                            {data.map((item, index) => {
                                const x = index * (barWidth + barGap);
                                const barHeight = item.value > 0 ? (item.value / maxValue) * (chartHeight - 30) : 0; // Reserve space for label
                                return (
                                    <g 
                                        key={item.label} 
                                        onMouseEnter={() => setHoveredBar(item.label)} 
                                        onMouseLeave={() => setHoveredBar(null)}
                                        className="transition-opacity duration-200"
                                    >
                                        <rect
                                            x={x}
                                            y={chartHeight - barHeight - 20}
                                            width={barWidth}
                                            height={barHeight}
                                            fill={color}
                                            rx="4"
                                            ry="4"
                                        >
                                            <title>{`${item.label}: ${item.value.toFixed(2)}`}</title>
                                        </rect>
                                        <text 
                                            x={x + barWidth / 2} 
                                            y={chartHeight - 5}
                                            textAnchor="middle" 
                                            className="text-xs fill-current text-slate-500"
                                        >
                                            {item.label}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                    )}
                </svg>
            </div>
        </div>
    );
};

export default BarChart;