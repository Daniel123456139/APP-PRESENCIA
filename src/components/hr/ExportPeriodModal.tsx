import React from 'react';

interface ExportPeriodModalProps {
    isOpen: boolean;
    title: string;
    icon?: string;
    accentColor?: string;
    exportMonth: string;
    onExportMonthChange: (value: string) => void;
    onClose: () => void;
    onExportFullMonth: () => void;
    onExportSelectedPeriod: () => void;
}

const ExportPeriodModal: React.FC<ExportPeriodModalProps> = ({
    isOpen,
    title,
    icon = '📊',
    accentColor = 'blue',
    exportMonth,
    onExportMonthChange,
    onClose,
    onExportFullMonth,
    onExportSelectedPeriod
}) => {
    if (!isOpen) return null;

    const colorMap: Record<string, { bg: string; hover: string; ring: string; iconBg: string; iconText: string }> = {
        blue: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', ring: 'focus:ring-blue-500', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
        green: { bg: 'bg-green-600', hover: 'hover:bg-green-700', ring: 'focus:ring-green-500', iconBg: 'bg-green-100', iconText: 'text-green-600' },
        purple: { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', ring: 'focus:ring-purple-500', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
    };

    const colors = colorMap[accentColor] || colorMap.blue;

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
            aria-labelledby="export-period-modal-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md transform transition-all border border-slate-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="sm:flex sm:items-start">
                    <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${colors.iconBg} sm:mx-0 sm:h-10 sm:w-10 text-xl`}>
                        {icon}
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 id="export-period-modal-title" className="text-lg leading-6 font-bold text-slate-900">
                            {title}
                        </h3>
                        <div className="mt-2 text-slate-600 text-sm">
                            Selecciona si deseas el listado del mes completo o del periodo seleccionado en los filtros.
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                        Mes a exportar
                    </label>
                    <input
                        type="month"
                        value={exportMonth}
                        onChange={(event) => onExportMonthChange(event.target.value)}
                        className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.ring}`}
                    />
                </div>

                <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 sm:w-auto sm:text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onExportSelectedPeriod}
                        className="w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-slate-100 text-base font-medium text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 sm:w-auto sm:text-sm"
                    >
                        Periodo seleccionado
                    </button>
                    <button
                        type="button"
                        onClick={onExportFullMonth}
                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${colors.bg} text-base font-medium text-white ${colors.hover} focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.ring} sm:w-auto sm:text-sm`}
                    >
                        Mes completo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportPeriodModal;
