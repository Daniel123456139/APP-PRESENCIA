/**
 * Panel de Selección de Empleado para Ficha Completa
 * Permite buscar y seleccionar un empleado para ver su perfil híbrido
 */

import React, { useState } from 'react';
import { useEmployeeData } from '../../hooks/useEmployeeData';
import EmployeeProfileCard from '../employee/EmployeeProfileCard';

const EmployeeProfilePanel: React.FC = () => {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');

    // Obtener todos los empleados activos para búsqueda
    // ACTIVADO autoRefresh para cargar datos de Firebase en tiempo real
    const { employees, loading: allLoading, error: allError } = useEmployeeData({
        onlyActive: true,
        autoRefresh: true  // ✅ Ahora carga datos de Firebase
    });

    // Filtrar empleados por búsqueda
    const filteredEmployees = employees.filter(emp =>
        emp.DescOperario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.IDOperario.toString().includes(searchTerm) ||
        emp.DescDepartamento.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (selectedEmployeeId) {
        return (
            <div className="space-y-6">
                <button
                    onClick={() => setSelectedEmployeeId(undefined)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition flex items-center"
                >
                    ← Volver a la Lista
                </button>
                <EmployeeProfileCard
                    employeeId={selectedEmployeeId}
                    showCompetencias={true}
                    showNotas={true}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Fichas de Empleados</h2>
                <p className="text-gray-600">
                    Sistema híbrido de datos: API Local (nombres) + Firebase Compartido (datos enriquecidos)
                </p>
            </div>

            {/* BUSCADOR */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre, ID o departamento..."
                        className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="absolute left-3 top-3 text-gray-400">🔍</span>
                </div>
            </div>

            {/* LISTA DE EMPLEADOS */}
            {allLoading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Cargando empleados...</p>
                </div>
            ) : allError ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h3 className="text-xl font-bold text-red-600 mb-2">Error al Cargar Empleados</h3>
                    <p className="text-gray-600">{allError.message}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredEmployees.length > 0 ? (
                        filteredEmployees.map((employee) => (
                            <div
                                key={employee.IDOperario}
                                onClick={() => setSelectedEmployeeId(employee.IDOperario)}
                                className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer p-4 border-2 border-transparent hover:border-blue-500"
                            >
                                <div className="flex items-center space-x-3 mb-3">
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-lg font-bold text-blue-600">
                                        {employee.DescOperario.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 truncate">{employee.DescOperario}</h3>
                                        <p className="text-sm text-gray-500">FV{employee.IDOperario.toString().padStart(3, '0')}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Departamento:</span>
                                        <span className="font-medium text-gray-800">{employee.DescDepartamento}</span>
                                    </div>

                                    {employee.Categoria && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Categoría:</span>
                                            <span className="font-medium text-gray-800">{employee.Categoria}</span>
                                        </div>
                                    )}

                                    {employee.NivelRetributivo && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Nivel:</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${employee.NivelRetributivo.startsWith('A') ? 'bg-blue-100 text-blue-700' :
                                                employee.NivelRetributivo.startsWith('B') ? 'bg-green-100 text-green-700' :
                                                    'bg-purple-100 text-purple-700'
                                                }`}>
                                                {employee.NivelRetributivo}
                                            </span>
                                        </div>
                                    )}

                                    {employee.hasPendingData && (
                                        <div className="flex items-center justify-center mt-2">
                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                                                ⚠️ Datos Pendientes
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            <div className="text-4xl mb-2">🔍</div>
                            <p>No se encontraron empleados que coincidan con "{searchTerm}"</p>
                        </div>
                    )}
                </div>
            )}

            {/* FOOTER */}
            {!allLoading && !allError && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
                    <p className="flex items-center">
                        <span className="mr-2">ℹ️</span>
                        Mostrando {filteredEmployees.length} de {employees.length} empleados activos.
                        Haz clic en cualquier tarjeta para ver la ficha completa.
                    </p>
                </div>
            )}
        </div>
    );
};

export default EmployeeProfilePanel;
