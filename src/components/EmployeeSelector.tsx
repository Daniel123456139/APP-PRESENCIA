
import React, { useState, useMemo } from 'react';
import { RawDataRow, User, Role } from '../types';
import { EXCLUDE_EMPLOYEE_IDS } from '../config/exclusions';

interface EmployeeSelectorProps {
    erpData: RawDataRow[];
    onSelect: (user: User) => void;
}

const EmployeeSelector: React.FC<EmployeeSelectorProps> = ({ erpData, onSelect }) => {
    const [selectedId, setSelectedId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const employees = useMemo(() => {
        const uniqueEmployees = new Map<number, User>();
        erpData.forEach(row => {
            if (!uniqueEmployees.has(row.IDOperario) && !EXCLUDE_EMPLOYEE_IDS.has(row.IDOperario)) {
                uniqueEmployees.set(row.IDOperario, {
                    id: row.IDOperario,
                    name: row.DescOperario,
                    role: row.DescDepartamento === 'Dirección' ? Role.Management : Role.Employee,
                });
            }
        });
        return Array.from(uniqueEmployees.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [erpData]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => 
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            String(emp.id).includes(searchTerm)
        );
    }, [employees, searchTerm]);

    const handleConfirm = () => {
        if (!selectedId) return;
        const user = employees.find(e => e.id === parseInt(selectedId));
        if (user) {
            onSelect(user);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
            <div className="w-full max-w-lg p-8 bg-white rounded-xl shadow-xl space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800">Identificación de Empleado</h1>
                    <p className="mt-2 text-slate-600">Hemos procesado {employees.length} empleados del archivo. ¿Quién eres tú?</p>
                </div>

                <div>
                    <input
                        type="text"
                        placeholder="Buscar por nombre o ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none mb-4"
                    />
                    
                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                        {filteredEmployees.length > 0 ? (
                            filteredEmployees.map(emp => (
                                <button
                                    key={emp.id}
                                    onClick={() => setSelectedId(String(emp.id))}
                                    className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors flex justify-between items-center ${selectedId === String(emp.id) ? 'bg-green-50' : ''}`}
                                >
                                    <div>
                                        <p className={`font-semibold ${selectedId === String(emp.id) ? 'text-green-800' : 'text-slate-800'}`}>{emp.name}</p>
                                        <p className="text-xs text-slate-500">ID: {emp.id} - {emp.role}</p>
                                    </div>
                                    {selectedId === String(emp.id) && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="p-4 text-center text-slate-500">No se encontraron empleados.</div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleConfirm}
                    disabled={!selectedId}
                    className="w-full py-3 px-4 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                    Acceder al Portal
                </button>
            </div>
        </div>
    );
};

export default EmployeeSelector;
