
import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import { DEPARTMENTS } from '../../constants';
import AdvancedEmployeeFilter from '../shared/AdvancedEmployeeFilter';

interface FreeHoursFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (section: string, employeeIds: string[]) => void;
    allEmployees: User[];
    departments: string[];
}

const FreeHoursFilterModal: React.FC<FreeHoursFilterModalProps> = ({
    isOpen,
    onClose,
    onExport,
    allEmployees,
    departments
}) => {
    const [selectedSection, setSelectedSection] = useState('all');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

    if (!isOpen) return null;

    const handleExportClick = () => {
        onExport(selectedSection, selectedEmployeeIds);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Exportar Horas Libres</h2>
                        <p className="text-sm text-slate-500">Filtrar operarios para el reporte Excel</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Por Sección</label>
                        <select
                            value={selectedSection}
                            onChange={e => setSelectedSection(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="all">Todas las secciones</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Por Empleado(s) Concretos</label>
                        <AdvancedEmployeeFilter
                            allEmployees={allEmployees}
                            selectedEmployeeIds={selectedEmployeeIds}
                            onChange={setSelectedEmployeeIds}
                        />
                        <p className="text-xs text-slate-400 mt-1">Si no seleccionas ninguno, se exportarán todos los de la sección seleccionada.</p>
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleExportClick}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-lg shadow-green-200 transition-colors flex items-center justify-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
                        Generar Excel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FreeHoursFilterModal;
