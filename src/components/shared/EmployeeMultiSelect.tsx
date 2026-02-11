import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useOperarios } from '../../hooks/useErp';
import { Operario } from '../../services/erpApi';
import { EXCLUDE_EMPLOYEE_IDS } from '../../config/exclusions';

interface EmployeeMultiSelectProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    placeholder?: string;
    includeInactive?: boolean;
    disabled?: boolean;
    className?: string;
    maxHeight?: string;
    options?: Operario[];
}

const EmployeeMultiSelect: React.FC<EmployeeMultiSelectProps> = ({
    selectedIds,
    onChange,
    placeholder = "Seleccionar empleados...",
    includeInactive = false,
    disabled = false,
    className = "",
    maxHeight = "max-h-96",
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

    // Search Logic (Unified)
    const filteredEmployees = useMemo(() => {
        // If not searching, just exclude already selected if desired? 
        // Typically multiselect shows all to allow multi-tick, or filters out selected. 
        // Let's show all but maybe sort selected first or just checkmark them.
        // If filtering:
        if (!searchTerm) return validEmployees;

        const lowerTerm = searchTerm.toLowerCase();

        return validEmployees.filter(op => {
            const paddedId = op.IDOperario.toString().padStart(3, '0');
            const lowerTerm = searchTerm.toLowerCase();

            // Text Search
            if (op.DescOperario.toLowerCase().includes(lowerTerm)) return true;

            // ID Search (Strict on Padded)
            if (paddedId.includes(lowerTerm)) return true;

            // Combined
            const combined = `${paddedId} ${op.DescOperario}`.toLowerCase();
            return combined.includes(lowerTerm);
        });
    }, [validEmployees, searchTerm]);

    const toggleSelection = (id: number) => {
        const strId = id.toString();
        if (selectedIds.includes(strId)) {
            onChange(selectedIds.filter(prev => prev !== strId));
        } else {
            onChange([...selectedIds, strId]);
        }
    };

    const handleSelectAllVisible = () => {
        const visibleIds = filteredEmployees.map(op => op.IDOperario.toString());
        // Add visibleIds to selectedIds, removing duplicates
        const newSet = new Set([...selectedIds, ...visibleIds]);
        onChange(Array.from(newSet));
    };

    const handleClearSelection = () => {
        onChange([]);
    };

    const getSelectionLabel = () => {
        if (selectedIds.length === 0) return placeholder;
        if (selectedIds.length === 1) {
            const op = validEmployees.find(e => e.IDOperario.toString() === selectedIds[0]);
            return op ? `${op.IDOperario.toString().padStart(3, '0')} - ${op.DescOperario}` : selectedIds[0];
        }
        if (selectedIds.length === validEmployees.length && validEmployees.length > 0) return "Todos seleccionados";
        return `${selectedIds.length} seleccionados`;
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    w-full min-h-[44px] px-3 py-2 border rounded-lg shadow-sm bg-slate-50 text-left flex items-center justify-between
                    ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-75' : 'hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500'}
                    ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-slate-200'}
                `}
                disabled={disabled}
            >
                <span className={`block truncate text-sm ${selectedIds.length === 0 ? 'text-slate-400' : 'text-slate-700'}`}>
                    {loading ? 'Cargando...' : getSelectionLabel()}
                </span>
                <span className="flex items-center ml-2 pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                </span>
            </button>

            {isOpen && !disabled && (
                <div className={`absolute z-50 mt-2 w-full bg-white shadow-xl rounded-xl border border-slate-200 flex flex-col ${maxHeight}`}>
                    <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full py-2 px-3 border border-slate-200 bg-white text-slate-900 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex justify-between text-xs">
                            <button onClick={handleSelectAllVisible} className="text-indigo-600 hover:text-indigo-800 font-semibold">
                                Seleccionar visibles
                            </button>
                            <button onClick={handleClearSelection} className="text-red-600 hover:text-red-800 font-semibold">
                                Limpiar todo
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-4 text-center text-slate-500 text-sm">Cargando datos...</div>
                        ) : filteredEmployees.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">No se encontraron empleados.</div>
                        ) : (
                            <ul className="py-1">
                                {filteredEmployees.map(op => {
                                    const isSelected = selectedIds.includes(op.IDOperario.toString());
                                    return (
                                        <li
                                            key={op.IDOperario}
                                            onClick={() => toggleSelection(op.IDOperario)}
                                            className={`
                                                cursor-pointer select-none relative py-2.5 pl-3 pr-9 hover:bg-indigo-50/60
                                                ${isSelected ? 'bg-indigo-50' : ''}
                                                ${!op.Activo ? 'opacity-75' : ''}
                                            `}
                                        >
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    readOnly
                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded mr-2 pointer-events-none"
                                                />
                                                <span className={`block truncate text-sm ${isSelected ? 'font-semibold text-indigo-900' : 'text-slate-700'}`}>
                                                    <span className="font-mono text-slate-500 inline-block w-8">{op.IDOperario.toString().padStart(3, '0')}</span>
                                                    {op.DescOperario}
                                                    {!op.Activo && <span className="ml-1 text-xs italic text-slate-400">(Inactivo)</span>}
                                                </span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
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

export default EmployeeMultiSelect;
