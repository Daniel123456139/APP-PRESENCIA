import React from 'react';

interface LoginComponentProps {
    onRoleSelect: (role: 'HR' | 'EMPLOYEE') => void;
    // Props antiguos eliminados o hechos opcionales para compatibilidad si fuera necesario, 
    // pero limpiamos la interfaz para el nuevo flujo.
}

const LoginComponent: React.FC<LoginComponentProps> = ({ onRoleSelect }) => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-xl text-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Suite RRHH Pro</h1>
                    <p className="mt-2 text-slate-600">Bienvenido al portal de gestión.</p>
                </div>
                <div className="space-y-4">
                    <button
                        onClick={() => onRoleSelect('HR')}
                        className="w-full p-6 text-left border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-700">Acceso RRHH</h3>
                        <p className="text-sm text-slate-500">Gestión de personal, incidencias y reportes.</p>
                    </button>
                    {/* Employee access removed as per request */}
                </div>
            </div>
        </div>
    );
};

export default LoginComponent;