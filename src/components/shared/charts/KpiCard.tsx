import React from 'react';

interface KpiCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon: React.ReactNode;
    color?: 'blue' | 'purple' | 'amber' | 'emerald';
}

const colorVariants = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
};


const KpiCard: React.FC<KpiCardProps> = ({ title, value, description, icon, color = 'blue' }) => {
    const { bg, text } = colorVariants[color];
    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 transition-all hover:shadow-md hover:-translate-y-1">
            <div className={`flex-shrink-0 h-14 w-14 flex items-center justify-center rounded-full ${bg} ${text}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
                 {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
            </div>
        </div>
    );
};

export default KpiCard;