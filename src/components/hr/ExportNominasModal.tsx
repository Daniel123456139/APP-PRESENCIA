interface ExportNominasModalProps {
    isOpen: boolean;
    exportMonth: string;
    onExportMonthChange: (value: string) => void;
    onClose: () => void;
    onExportFullMonth: () => void;
    onExportSelectedPeriod: () => void;
}

const ExportNominasModal: React.FC<ExportNominasModalProps> = ({
    isOpen,
    exportMonth,
    onExportMonthChange,
    onClose,
    onExportFullMonth,
    onExportSelectedPeriod
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
            aria-labelledby="export-month-modal-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md transform transition-all border border-slate-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                        <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h6" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22a10 10 0 110-20 10 10 0 010 20z" />
                        </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 id="export-month-modal-title" className="text-lg leading-6 font-bold text-slate-900">
                            ¿Deseas el Excel del mes completo o del periodo seleccionado?
                        </h3>
                        <div className="mt-2 text-slate-600">
                            Si eliges mes completo, selecciona el mes a exportar.
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
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    />
                </div>

                <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onExportSelectedPeriod}
                        className="w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-slate-100 text-base font-medium text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm"
                    >
                        Periodo seleccionado
                    </button>
                    <button
                        type="button"
                        onClick={onExportFullMonth}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm"
                    >
                        Mes completo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportNominasModal;
