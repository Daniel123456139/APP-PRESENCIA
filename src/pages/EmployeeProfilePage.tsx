/**
 * Página de Perfil de Empleado
 * Wrapper para el componente EmployeeProfileCard
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EmployeeProfileCard from '../components/employee/EmployeeProfileCard';

export const EmployeeProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const employeeId = id ? parseInt(id, 10) : undefined;

    if (!employeeId || isNaN(employeeId)) {
        return (
            <div className="container mx-auto p-6">
                <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-bold text-red-600 mb-2">ID de Empleado Inválido</h2>
                    <p className="text-gray-600 mb-4">
                        El ID proporcionado no es válido: <code className="bg-gray-100 px-2 py-1 rounded">{id}</code>
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        ← Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            {/* Header con breadcrumb */}
            <div className="mb-6">
                <button
                    onClick={() => navigate('/')}
                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center mb-2"
                >
                    ← Volver
                </button>
                <h1 className="text-3xl font-bold text-gray-800">Ficha de Empleado</h1>
                <p className="text-gray-600 mt-1">
                    Información detallada del empleado FV{employeeId.toString().padStart(3, '0')}
                </p>
            </div>

            {/* Componente principal */}
            <EmployeeProfileCard
                employeeId={employeeId}
                showCompetencias={true}
                showNotas={true}
            />

            {/* Footer con disclaimer GDPR */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
                <p className="flex items-center">
                    <span className="mr-2">🔒</span>
                    <strong>Privacidad:</strong> Los datos personales se obtienen de la API local
                    y no se almacenan en Firebase. Datos enriquecidos sincronizados con APP - TALENTO.
                </p>
            </div>
        </div>
    );
};

export default EmployeeProfilePage;
