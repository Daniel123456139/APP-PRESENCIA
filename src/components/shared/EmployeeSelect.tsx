import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useOperarios } from '../../hooks/useErp';
import { Operario } from '../../services/erpApi';
import { EXCLUDE_EMPLOYEE_IDS } from '../../config/exclusions';

interface EmployeeSelectProps {
    value: string | number | undefined;
    onChange: (employee: Operario | null) => void;
    placeholder?: string;
    includeInactive?: boolean;
    disabled?: boolean;
    className?: string;
    options?: Operario[];
}

const EmployeeSelect: React.FC<EmployeeSelectProps> = ({
    value,
    onChange,
    placeholder = "Buscar empleado...",
    includeInactive = false,
    disabled = false,
    className = "",
    options
}) => {
    const { operarios, loading: hookLoading } = useOperarios(!includeInactive);
    const loading = options ? false : hookLoading;
    const dataToUse = options || operarios;

    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const validEmployees = useMemo(() => {
        return dataToUse.filter(op => !EXCLUDE_EMPLOYEE_IDS.has(op.IDOperario));
    }, [dataToUse]);

    const selectedEmployee = useMemo(() => {
        if (!value) return null;
        const valId = typeof value === 'string' ? parseInt(value, 10) : value;
        return validEmployees.find(op => op.IDOperario === valId) || null;
    }, [validEmployees, value]);

    const filteredEmployees = useMemo(() => {
        if (!searchTerm) return validEmployees;

        const lowerTerm = searchTerm.toLowerCase();

        return validEmployees.filter(op => {
            const idStr = op.IDOperario.toString();
            if (op.DescOperario.toLowerCase().includes(lowerTerm)) return true;
            if (idStr.includes(lowerTerm)) return true;
            if (/^\d+$/.test(lowerTerm)) {
                const numericSearch = parseInt(lowerTerm, 10).toString();
                if (idStr.includes(numericSearch)) return true;
            }
            const combined = `${op.IDOperario} ${op.DescOperario}`.toLowerCase();
            return combined.includes(lowerTerm);
        });
    }, [validEmployees, searchTerm]);

    const handleSelect = (op: Operario) => {
        onChange(op);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    w-full min-h-[42px] px-3 py-2 border rounded-md shadow-sm bg-white text-left cursor-pointer flex items-center justify-between
                    ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-75' : 'hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500'}
                    ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'}
                `}
            >
                <div className="flex-1 truncate">
                    {selectedEmployee ? (
                        <span className={!selectedEmployee.Activo ? 'text-slate-400' : 'text-slate-800'}>
                            <span className="font-mono text-slate-500 mr-2">{selectedEmployee.IDOperario}</span>
                            {selectedEmployee.DescOperario}
                            {!selectedEmployee.Activo && <span className="ml-2 text-xs italic text-slate-400">(Inactivo)</span>}
                        </span>
                    ) : (
                        <span className="text-slate-400">{loading ? 'Cargando...' : placeholder}</span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {selectedEmployee && !disabled && (
                        <button
                            onClick={handleClear}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por ID, nombre..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                        {loading ? (
                            <div className="p-4 text-center text-slate-500 text-sm">Cargando datos...</div>
                        ) : filteredEmployees.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">No se encontraron empleados.</div>
                        ) : (
                            filteredEmployees.map(op => (
                                <div
                                    key={op.IDOperario}
                                    onClick={() => handleSelect(op)}
                                    className={`
                                        px-3 py-2 cursor-pointer rounded-md text-sm flex items-center justify-between
                                        ${selectedEmployee?.IDOperario === op.IDOperario ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}
                                        ${!op.Activo ? 'opacity-70' : ''}
                                    `}
                                >
                                    <div>
                                        <span className="font-mono text-slate-500 w-10 inline-block">{op.IDOperario}</span>
                                        <span>{op.DescOperario}</span>
                                        {!op.Activo && <span className="ml-2 text-xs italic text-slate-400">(Inactivo)</span>}
                                    </div>
                                    {selectedEmployee?.IDOperario === op.IDOperario && (
                                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    {(filteredEmployees.length !== validEmployees.length) && (
                        <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-right">
                            {filteredEmployees.length} resultados
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EmployeeSelect;
