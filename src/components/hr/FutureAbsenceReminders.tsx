import React, { useMemo } from 'react';
import { FutureAbsence } from '../../types';

interface FutureAbsenceRemindersProps {
    futureAbsences: FutureAbsence[];
}

const FutureAbsenceReminders: React.FC<FutureAbsenceRemindersProps> = ({ futureAbsences }) => {
    const upcomingAbsences = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        const oneWeekFromNow = new Date(today);
        oneWeekFromNow.setDate(today.getDate() + 7);

        return futureAbsences
            .map(absence => ({
                ...absence,
                date: new Date(absence.fechaPrevista + 'T00:00:00') // Avoid timezone issues
            }))
            .filter(absence => absence.date >= today && absence.date <= oneWeekFromNow)
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [futureAbsences]);

    const getDaysUntil = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = date.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Mañana';
        return `en ${diffDays} días`;
    };

    if (upcomingAbsences.length === 0) {
        return null; // Don't render anything if there are no upcoming absences
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-amber-300 bg-amber-50">
            <h2 className="text-2xl font-semibold text-slate-800 mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recordatorio de Ausencias Próximas
            </h2>
            <ul className="space-y-3">
                {upcomingAbsences.map(absence => (
                    <li key={absence.id} className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-semibold text-slate-800">{absence.operarioName}</p>
                            <p className="text-sm text-slate-500">{absence.motivo}</p>
                        </div>
                        <div className="mt-2 sm:mt-0 text-right">
                             <p className="text-sm font-medium text-amber-700">{getDaysUntil(absence.date)}</p>
                             <p className="text-xs text-slate-500">{absence.date.toLocaleDateString()}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FutureAbsenceReminders;