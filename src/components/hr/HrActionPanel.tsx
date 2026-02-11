import React from 'react';

interface HrActionPanelProps {
    onReload: () => void;
    isReloading: boolean;
    onExport: () => void;
    onFreeHoursExport: () => void;
    onLateArrivalsOpen: () => void;
    onAdjustmentModalOpen: () => void;
    onFutureIncidentsOpen: () => void;
    onExportResumen: () => void;
    lastUpdated: number | null;
    isRefetching: boolean;
}

const HrActionPanel: React.FC<HrActionPanelProps> = ({
    onReload,
    isReloading,
    onExport,
    onFreeHoursExport,
    onLateArrivalsOpen,
    onAdjustmentModalOpen,
    onFutureIncidentsOpen,
    onExportResumen,
    lastUpdated,
    isRefetching
}) => {
    return (
        <div className="space-y-4 p-5 bg-white/90 rounded-2xl border border-slate-200/70 shadow-lg backdrop-blur">
            <div className="flex items-center gap-3">
                <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-sky-500" />
                <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Acciones de Datos
                    </h3>
                    <p className="text-xs text-slate-500">Exportaciones y utilidades rápidas</p>
                </div>

            </div>

            <div className="grid grid-cols-1 gap-2">
                <button
                    onClick={onReload}
                    disabled={isReloading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700"
                >
                    <svg className={`w-4 h-4 ${isReloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isReloading ? 'Cargando...' : 'Recargar Datos'}
                </button>


                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onExport}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                        </svg>
                        Excel Nóminas
                    </button>
                    <button
                        onClick={onFreeHoursExport}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Excel Horas
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onLateArrivalsOpen}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-semibold shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Retrasos
                    </button>
                    <button
                        onClick={onAdjustmentModalOpen}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Ajuste Masivo
                    </button>
                </div>

                <button
                    onClick={onFutureIncidentsOpen}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Incidencias Futuras
                </button>

                <button
                    onClick={onExportResumen}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exportar Vista Actual (CSV)
                </button>
            </div>

            {lastUpdated && (
                <div className="pt-2 border-t border-slate-200">
                    <p className="text-[10px] text-slate-500 flex items-center justify-between">
                        <span>Sincronización automática</span>
                        <span className="font-mono">{new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                    {isRefetching && (
                        <div className="mt-1 h-0.5 w-full bg-slate-200 overflow-hidden">
                            <div className="h-full bg-blue-500 animate-progress"></div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HrActionPanel;
