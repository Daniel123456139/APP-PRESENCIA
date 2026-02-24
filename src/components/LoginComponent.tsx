import React, { useState } from 'react';
import { signInWithEmailPassword } from '../services/firebaseAuthService';
import { useNotification } from './shared/NotificationContext';
import { LogIn, Mail, Lock, ShieldCheck } from 'lucide-react';

interface LoginComponentProps {
    onRoleSelect?: (role: 'HR' | 'EMPLOYEE') => void;
}

const LoginComponent: React.FC<LoginComponentProps> = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { showNotification } = useNotification();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            showNotification('Por favor, completa todos los campos.', 'warning');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmailPassword(email, password);
            showNotification('Sesión iniciada correctamente.', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Error al iniciar sesión.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
            <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl space-y-8">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-full mb-4">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-800">Suite RRHH Pro</h1>
                    <p className="mt-2 text-slate-500 font-medium">Accede a la gestión de personal</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Correo Electrónico
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition-all"
                                    placeholder="ejemplo@favram.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Contraseña
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <LogIn className="mr-2" size={18} />
                                Iniciar Sesión
                            </>
                        )}
                    </button>
                </form>

                <div className="pt-4 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                        Favram S.L. &copy; 2026
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginComponent;