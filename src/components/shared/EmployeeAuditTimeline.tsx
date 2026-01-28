
import React from 'react';
import { AuditEvent } from '../../services/AuditService';

interface EmployeeAuditTimelineProps {
    events: AuditEvent[];
    compact?: boolean;
}

const getStatusColor = (status: AuditEvent['status']) => {
    switch (status) {
        case 'success': return 'bg-green-500 border-green-500';
        case 'error': return 'bg-red-500 border-red-500';
        case 'pending': return 'bg-amber-500 border-amber-500';
        case 'warning': return 'bg-orange-500 border-orange-500';
        default: return 'bg-blue-500 border-blue-500';
    }
};

const getActionIcon = (action: string) => {
    if (action.includes('INSERT') || action.includes('CREATED')) return (
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
    );
    if (action.includes('ERROR') || action.includes('FAIL')) return (
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    );
    if (action.includes('QUEUED')) return (
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    );
    if (action.includes('APPROVED')) return (
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
    );
    if (action.includes('REJECTED')) return (
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    );
    return (
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    );
};

const EmployeeAuditTimeline: React.FC<EmployeeAuditTimelineProps> = ({ events, compact = false }) => {
    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <p>No hay registros de auditoría disponibles.</p>
            </div>
        );
    }

    return (
        <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
            {events.map((event) => (
                <div key={event.id} className="relative pl-6 group">
                    {/* Icon Bubble */}
                    <div className={`absolute -left-[11px] top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110 ${getStatusColor(event.status)}`}>
                        {getActionIcon(event.action)}
                    </div>
                    
                    {/* Content Card */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-1">
                            <h4 className="font-semibold text-slate-800 text-sm">{event.action}</h4>
                            <time className="text-xs text-slate-400 font-mono">
                                {new Date(event.timestamp).toLocaleString()}
                            </time>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed mb-2">
                            {event.description}
                        </p>
                        
                        {!compact && (
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
                                <div className="flex items-center text-slate-500">
                                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    <span>Actor: <span className="font-medium text-slate-700">{event.actorName}</span></span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full font-medium ${event.status === 'success' ? 'bg-green-100 text-green-700' : event.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                    {event.status.toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default EmployeeAuditTimeline;
