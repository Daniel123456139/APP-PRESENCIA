
import React, { useState, useMemo, useCallback, memo } from 'react';
import { Shift, ShiftCode, SHIFT_TYPES, MANAGEABLE_SHIFT_TYPES, User, RawDataRow, Role } from '../../types';
import { DEPARTMENTS } from '../../constants';
import AdvancedEmployeeFilter from '../shared/AdvancedEmployeeFilter';
import ConfirmationModal from '../shared/ConfirmationModal';
import { SvgIcon } from '../shared/Nav';
import { toISODateLocal } from '../../utils/localDate';

interface ShiftManagerProps {
    shifts: Shift[];
    setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
    erpData: RawDataRow[];
}

type SortDirection = 'ascending' | 'descending';

const ShiftManager: React.FC<ShiftManagerProps> = ({ shifts, setShifts, erpData }) => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [startDate, setStartDate] = useState(toISODateLocal(firstDayOfMonth));
    const [endDate, setEndDate] = useState(toISODateLocal(lastDayOfMonth));
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
    const [bulkShiftType, setBulkShiftType] = useState<ShiftCode>('M');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [bulkSelectionIds, setBulkSelectionIds] = useState<number[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: SortDirection } | null>({ key: 'name', direction: 'ascending' });
    const [conflictMessage, setConflictMessage] = useState<string>('');

    // Extract employees dynamically from the uploaded ERP data
    const employeeOptions = useMemo(() => {
        const uniqueEmployees = new Map<number, User>();
        
        erpData.forEach(row => {
            if (!uniqueEmployees.has(row.IDOperario)) {
                uniqueEmployees.set(row.IDOperario, {
                    id: row.IDOperario,
                    name: row.DescOperario,
                    role: row.DescDepartamento === 'Dirección' ? Role.Management : Role.Employee,
                });
            }
        });

        return Array.from(uniqueEmployees.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [erpData]);
    
    const { employeeDepartmentMap } = useMemo(() => {
        const employeeDepartmentMap = new Map<number, string>();
        erpData.forEach(row => {
            if (!employeeDepartmentMap.has(row.IDOperario)) {
                employeeDepartmentMap.set(row.IDOperario, row.DescDepartamento);
            }
        });
        return { employeeDepartmentMap };
    }, [erpData]);

    const departmentFilteredEmployees = useMemo(() => {
        if (selectedDepartment === 'all') {
            return employeeOptions;
        }
        return employeeOptions.filter(emp => employeeDepartmentMap.get(emp.id) === selectedDepartment);
    }, [selectedDepartment, employeeOptions, employeeDepartmentMap]);


    const daysInRange = useMemo(() => {
        const days = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end || !startDate || !endDate) return [];
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
            days.push(new Date(dt));
        }
        return days;
    }, [startDate, endDate]);

    // FIX: Logic updated to show department employees if no specific IDs are selected
    const filteredEmployees = useMemo(() => {
        if (selectedEmployeeIds.length > 0) {
            const numericIds = selectedEmployeeIds.map(id => parseInt(id, 10));
            return employeeOptions.filter(emp => numericIds.includes(emp.id));
        }
        // Fallback to showing all employees in the selected department (or all if dept is 'all')
        return departmentFilteredEmployees;
    }, [selectedEmployeeIds, departmentFilteredEmployees, employeeOptions]);
    
    const requestSort = (key: keyof User) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedEmployees = useMemo(() => {
        let sortableItems = [...filteredEmployees];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredEmployees, sortConfig]);

    const getSortIndicator = (key: keyof User) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return <span className="text-slate-400">{sortConfig.direction === 'ascending' ? ' ▲' : ' ▼'}</span>;
    };

    const shiftsMap = useMemo(() => {
        const map = new Map<string, ShiftCode>();
        shifts.forEach(shift => {
            map.set(`${shift.operarioId}-${shift.date}`, shift.shiftCode);
        });
        return map;
    }, [shifts]);

    // --- Conflict Detection Logic ---
    const checkConflict = useCallback((operarioId: number, date: string): string | null => {
        // Look for absences in erpData. 
        // MotivoAusencia codes: 10 (ITAT), 11 (ITEC), 5 (Vacaciones), 8 (Vacaciones Año Anterior)
        const absence = erpData.find(row => 
            row.IDOperario === operarioId && 
            row.Fecha === date && 
            [5, 8, 10, 11].includes(row.MotivoAusencia || 0)
        );
        
        if (absence) {
            return absence.DescMotivoAusencia;
        }
        return null;
    }, [erpData]);
    
    const handleSingleShiftChange = useCallback((operarioId: number, date: string, newShiftCode: ShiftCode) => {
        const conflict = checkConflict(operarioId, date);
        if (conflict) {
            const confirmOverride = window.confirm(`⚠️ CONFLICTO DETECTADO:\nEl empleado tiene registrado "${conflict}" para el ${date}.\n\n¿Estás seguro de que quieres asignar un turno manual?`);
            if (!confirmOverride) return;
        }

        setShifts(prevShifts => {
            const newShifts = [...prevShifts];
            const shiftIndex = newShifts.findIndex(s => s.operarioId === operarioId && s.date === date);
            if (shiftIndex > -1) {
                newShifts[shiftIndex] = { ...newShifts[shiftIndex], shiftCode: newShiftCode };
            } else {
                newShifts.push({ operarioId, date, shiftCode: newShiftCode });
            }
            return newShifts;
        });
    }, [setShifts, checkConflict]);

    const executeBulkUpdate = useCallback(() => {
        setShifts(prevShifts => {
            let updatedShifts = [...prevShifts];
            const employeeIdsToUpdate = bulkSelectionIds;

            daysInRange.forEach(day => {
                const dateStr = toISODateLocal(day);
                employeeIdsToUpdate.forEach(operarioId => {
                    const shiftIndex = updatedShifts.findIndex(s => s.operarioId === operarioId && s.date === dateStr);
                    if (shiftIndex > -1) {
                        updatedShifts[shiftIndex].shiftCode = bulkShiftType;
                    } else {
                        updatedShifts.push({ operarioId, date: dateStr, shiftCode: bulkShiftType });
                    }
                });
            });
            return updatedShifts;
        });
        setSuccessMessage(`Turnos actualizados correctamente para ${bulkSelectionIds.length} empleado(s).`);
        setTimeout(() => setSuccessMessage(''), 5000);
        setBulkSelectionIds([]);
    }, [setShifts, bulkSelectionIds, daysInRange, bulkShiftType]);

    const handleBulkUpdate = useCallback(() => {
        if (bulkSelectionIds.length === 0) {
            alert("Por favor, selecciona al menos un empleado de la tabla para aplicar los cambios.");
            return;
        }

        // Check for conflicts in bulk
        let conflictsFound: string[] = [];
        daysInRange.forEach(day => {
            const dateStr = toISODateLocal(day);
            bulkSelectionIds.forEach(id => {
                const conflict = checkConflict(id, dateStr);
                if (conflict) {
                    const emp = employeeOptions.find(e => e.id === id);
                    conflictsFound.push(`- ${emp?.name} (${dateStr}): ${conflict}`);
                }
            });
        });

        if (conflictsFound.length > 0) {
            // Limit conflict message size
            const displayConflicts = conflictsFound.slice(0, 5).join('\n');
            const more = conflictsFound.length > 5 ? `\n... y ${conflictsFound.length - 5} conflictos más.` : '';
            setConflictMessage(`⚠️ SE HAN DETECTADO CONFLICTOS:\nAlgunos empleados tienen bajas o vacaciones registradas en este periodo:\n\n${displayConflicts}${more}\n\n¿Deseas sobrescribir y asignar el turno de todas formas?`);
        } else {
            setConflictMessage('');
        }

        setIsConfirmModalOpen(true);
    }, [bulkSelectionIds, daysInRange, checkConflict, employeeOptions]);

    const handleToggleAllVisible = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        const visibleIds = sortedEmployees.map(emp => emp.id);
        
        if (isChecked) {
            setBulkSelectionIds(prevIds => [...new Set([...prevIds, ...visibleIds])]);
        } else {
            setBulkSelectionIds(prevIds => prevIds.filter(id => !visibleIds.includes(id)));
        }
    };

    const handleToggleOne = (employeeId: number) => {
        setBulkSelectionIds(prevIds => {
            if (prevIds.includes(employeeId)) {
                return prevIds.filter(id => id !== employeeId);
            } else {
                return [...prevIds, employeeId];
            }
        });
    };

    const isAllVisibleSelected = useMemo(() => {
        if (sortedEmployees.length === 0) return false;
        return sortedEmployees.every(emp => bulkSelectionIds.includes(emp.id));
    }, [sortedEmployees, bulkSelectionIds]);

    const handleExportExcel = useCallback(() => {
        if (sortedEmployees.length === 0) {
            alert("No hay datos visibles para exportar.");
            return;
        }

        let tableHTML = `<table border="1" style="border-collapse: collapse; width: 100%;">`;
        
        // Header
        tableHTML += `<thead style="background-color: #f3f4f6;"><tr>`;
        tableHTML += `<th style="padding: 10px; text-align: left;">Empleado</th>`;
        daysInRange.forEach(day => {
            tableHTML += `<th style="padding: 5px; text-align: center;">${day.getDate()}<br/><small>${day.toLocaleDateString('es-ES', { weekday: 'short' })}</small></th>`;
        });
        tableHTML += `</tr></thead><tbody>`;

        // Body
        sortedEmployees.forEach(emp => {
            tableHTML += `<tr>`;
            tableHTML += `<td style="padding: 8px; font-weight: bold;">${emp.name}</td>`;
            
            daysInRange.forEach(day => {
                const dateStr = toISODateLocal(day);
                const shiftCode = shiftsMap.get(`${emp.id}-${dateStr}`) || 'L';
                const shiftInfo = SHIFT_TYPES[shiftCode];
                
                // Extract basic color for excel style (tailwind classes won't work in pure excel html)
                let bgColor = '#ffffff'; // default white
                let textColor = '#000000';
                
                if (shiftCode === 'M') { bgColor = '#fef9c3'; textColor = '#854d0e'; } // yellow-100
                else if (shiftCode === 'TN') { bgColor = '#e0e7ff'; textColor = '#3730a3'; } // indigo-100
                else if (shiftCode === 'V') { bgColor = '#dcfce7'; textColor = '#166534'; } // green-100
                
                tableHTML += `<td style="padding: 5px; text-align: center; background-color: ${bgColor}; color: ${textColor};">${shiftInfo.label}</td>`;
            });
            
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;

        const blob = new Blob([`\uFEFF${tableHTML}`], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Cuadrante_Turnos_${startDate}_${endDate}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    }, [sortedEmployees, daysInRange, shiftsMap, startDate, endDate]);

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-2xl font-semibold text-slate-800">Gestión de Turnos</h2>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center px-4 py-2 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
                >
                    <SvgIcon type="download" className="h-5 w-5 mr-2" />
                    Exportar Cuadrante
                </button>
            </div>

            {successMessage && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md transition-opacity duration-300">
                    {successMessage}
                </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 border border-slate-200 rounded-lg bg-slate-50 mb-6">
                {/* FILTERS */}
                <div className="space-y-4">
                     <h3 className="text-lg font-medium text-slate-700">Filtros de Visualización</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="start-date" className="block text-sm font-medium text-slate-700">Fecha Inicio</label>
                            <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm"/>
                        </div>
                        <div>
                            <label htmlFor="end-date" className="block text-sm font-medium text-slate-700">Fecha Fin</label>
                            <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm"/>
                        </div>
                         <div>
                            <label htmlFor="department-filter" className="block text-sm font-medium text-slate-700">Sección</label>
                             <select id="department-filter" value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                <option value="all">Todas las secciones</option>
                                {DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="shift-employee-filter" className="block text-sm font-medium text-slate-700">Filtrar Empleados Visibles</label>
                         <AdvancedEmployeeFilter
                            allEmployees={employeeOptions}
                            visibleForSelectionEmployees={departmentFilteredEmployees}
                            selectedEmployeeIds={selectedEmployeeIds}
                            onChange={setSelectedEmployeeIds}
                        />
                        <p className="text-xs text-slate-500 mt-1">Filtra y luego selecciona empleados en la tabla.</p>
                    </div>
                </div>

                {/* BULK ACTIONS */}
                <div className="space-y-4 lg:border-l lg:pl-6 border-slate-200">
                    <h3 className="text-lg font-medium text-slate-700">Acción Masiva sobre Selección</h3>
                     <p className="text-sm text-slate-600">
                        Aplica un turno a los empleados seleccionados en la tabla para el rango de fechas visible.
                    </p>
                     <div>
                        <label htmlFor="bulk-shift-type" className="block text-sm font-medium text-slate-700">Asignar Turno</label>
                        <select id="bulk-shift-type" value={bulkShiftType} onChange={e => setBulkShiftType(e.target.value as ShiftCode)} className="mt-1 block w-full py-2 pl-3 pr-10 border-slate-300 rounded-md">
                            {Object.entries(MANAGEABLE_SHIFT_TYPES).map(([code, { label }]) => (
                                <option key={code} value={code}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleBulkUpdate} className="flex-grow py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
                            Aplicar Cambios ({bulkSelectionIds.length})
                        </button>
                         {bulkSelectionIds.length > 0 && (
                            <button onClick={() => setBulkSelectionIds([])} className="px-4 py-2 bg-red-500 text-white font-semibold rounded-md hover:bg-red-600">
                                Quitar Selección
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500 border-collapse">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                        <tr>
                             <th scope="col" className="px-2 py-3 border border-slate-200 sticky left-0 bg-slate-100 z-20">
                                <input
                                    type="checkbox"
                                    title="Seleccionar todos los visibles"
                                    checked={isAllVisibleSelected}
                                    onChange={handleToggleAllVisible}
                                    disabled={sortedEmployees.length === 0}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                            </th>
                            <th scope="col" className="px-4 py-3 border border-slate-200 sticky left-10 bg-slate-100 z-20 cursor-pointer hover:bg-slate-200" onClick={() => requestSort('name')}>
                                Empleado{getSortIndicator('name')}
                            </th>
                            {daysInRange.map(day => (
                                <th key={day.toISOString()} scope="col" className="px-2 py-3 border border-slate-200 text-center font-medium">
                                    <span className="text-slate-400">{day.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0,1)}</span><br/>
                                    {day.getDate()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEmployees.map(emp => (
                            <tr key={emp.id} className={`hover:bg-slate-50 ${bulkSelectionIds.includes(emp.id) ? 'bg-blue-50' : 'bg-white'}`}>
                                <td className={`px-2 py-2 border border-slate-200 sticky left-0 z-10 ${bulkSelectionIds.includes(emp.id) ? 'bg-blue-50' : 'bg-white'}`}>
                                    <input
                                        type="checkbox"
                                        checked={bulkSelectionIds.includes(emp.id)}
                                        onChange={() => handleToggleOne(emp.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </td>
                                <td className={`px-4 py-2 font-medium text-slate-900 border border-slate-200 whitespace-nowrap sticky left-10 z-10 ${bulkSelectionIds.includes(emp.id) ? 'bg-blue-50' : 'bg-white'}`}>{emp.name}</td>
                                {daysInRange.map(day => {
                                    const dateStr = toISODateLocal(day);
                                    const shiftCode = shiftsMap.get(`${emp.id}-${dateStr}`) || 'L';
                                    const shiftInfo = SHIFT_TYPES[shiftCode];
                                    return (
                                        <td key={dateStr} className={`border border-slate-200 p-0`}>
                                            <select 
                                                value={shiftCode} 
                                                onChange={(e) => handleSingleShiftChange(emp.id, dateStr, e.target.value as ShiftCode)}
                                                className={`w-full h-full text-center p-2 border-0 rounded-none appearance-none focus:ring-2 focus:ring-blue-500 ${shiftInfo.color}`}
                                                title={`${emp.name} - ${day.toLocaleDateString()}: ${shiftInfo.label}`}
                                            >
                                                {Object.entries(MANAGEABLE_SHIFT_TYPES).map(([code, { label }]) => (
                                                    <option key={code} value={code}>{label}</option>
                                                ))}
                                                {!MANAGEABLE_SHIFT_TYPES[shiftCode as 'M' | 'TN'] && <option value={shiftCode} disabled>{shiftCode}</option>}
                                            </select>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {sortedEmployees.length === 0 && (
                    <div className="text-center p-8">
                        <p className="text-slate-500">Usa los filtros para mostrar empleados y luego selecciónalos en la tabla.</p>
                    </div>
                )}
            </div>
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => { setIsConfirmModalOpen(false); setConflictMessage(''); }}
                onConfirm={executeBulkUpdate}
                title="Confirmar Cambios Masivos"
            >
                <div className="text-sm text-slate-500">
                    <p>
                        Vas a asignar el turno <strong>'{SHIFT_TYPES[bulkShiftType].label}'</strong> a <strong>{bulkSelectionIds.length} empleado(s)</strong> en el periodo del <strong>{new Date(startDate).toLocaleDateString()}</strong> al <strong>{new Date(endDate).toLocaleDateString()}</strong>.
                    </p>
                    
                    {conflictMessage && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 whitespace-pre-wrap font-medium">
                            {conflictMessage}
                        </div>
                    )}

                    <p className="mt-4">¿Estás seguro de que quieres continuar?</p>
                </div>
            </ConfirmationModal>
        </div>
    );
};

export default memo(ShiftManager);
