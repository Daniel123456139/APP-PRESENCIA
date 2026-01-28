
import React, { useState, useEffect } from 'react';
import { checkConnection } from '../../services/apiService';
import { toISODateLocal } from '../../utils/localDate';

interface InitialConfigComponentProps {
    onContinue: (startDate: string, endDate: string, startTime: string, endTime: string) => void;
    onBack: () => void;
}

const InitialConfigComponent: React.FC<InitialConfigComponentProps> = ({ onContinue, onBack }) => {
    const today = new Date();
    // Uso de toISODateLocal para consistencia
    const firstDay = toISODateLocal(new Date(today.getFullYear(), today.getMonth(), 1));
    const lastDay = toISODateLocal(new Date(today.getFullYear(), today.getMonth() + 1, 0));

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    
    const [startTime, setStartTime] = useState('00:00');
    const [endTime, setEndTime] = useState('23:59');

    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        checkServer();
    }, []);

    const checkServer = async () => {
        setConnectionStatus('checking');
        setErrorMsg('');
        try {
            const isOnline = await checkConnection();
            if (isOnline) {
                setConnectionStatus('online');
            } else {
                setConnectionStatus('offline');
                setErrorMsg('No se recibió respuesta del servidor (Timeout o Error de Red).');
            }
        } catch (e: any) {
            setConnectionStatus('offline');
            setErrorMsg(e.message || 'Error desconocido.');
        }
    };

    const handleContinue = () => {
        // Validación básica
        if (endDate < startDate) {
            alert('La fecha de fin debe ser posterior a la de inicio.');
            return;
        }
        onContinue(startDate, endDate, startTime, endTime);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800">Configuración Inicial</h2>
                    <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800">Volver</button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Connection Status */}
                    <div className={`p-4 rounded-lg border flex items-center justify-between ${
                        connectionStatus === 'online' ? 'bg-green-50 border-green-200' : 
                        connectionStatus === 'offline' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                    }`}>
                        <div className="flex items-center gap-3">
                            <div className="relative flex h-3 w-3">
                                {connectionStatus === 'checking' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                                    connectionStatus === 'online' ? 'bg-green-500' : 
                                    connectionStatus === 'offline' ? 'bg-red-500' : 'bg-blue-500'
                                }`}></span>
                            </div>
                            <div>
                                <p className={`font-semibold text-sm ${
                                    connectionStatus === 'online' ? 'text-green-800' : 
                                    connectionStatus === 'offline' ? 'text-red-800' : 'text-blue-800'
                                }`}>
                                    {connectionStatus === 'online' ? 'Servidor Conectado' : 
                                     connectionStatus === 'offline' ? 'Sin Conexión' : 'Comprobando...'}
                                </p>
                                {connectionStatus === 'offline' && <p className="text-xs text-red-600 mt-1">{errorMsg || 'Verifica si la VPN está activa.'}</p>}
                            </div>
                        </div>
                        {connectionStatus === 'offline' && (
                            <button onClick={checkServer} className="text-xs font-semibold text-red-700 hover:underline">Reintentar</button>
                        )}
                    </div>

                    {/* Date & Time Selection */}
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 font-medium">Selecciona el rango de análisis:</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* Inicio */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Desde</label>
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                    className="w-full border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                                <input 
                                    type="time" 
                                    value={startTime} 
                                    onChange={(e) => setStartTime(e.target.value)} 
                                    className="w-full border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* Fin */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Hasta</label>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)} 
                                    className="w-full border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                                <input 
                                    type="time" 
                                    value={endTime} 
                                    onChange={(e) => setEndTime(e.target.value)} 
                                    className="w-full border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleContinue}
                        disabled={connectionStatus === 'checking'}
                        className={`w-full py-3 px-4 rounded-lg font-bold text-white shadow-md transition-all flex justify-center items-center ${
                            connectionStatus === 'offline' 
                                ? 'bg-slate-500 hover:bg-slate-600' 
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {connectionStatus === 'offline' ? 'Entrar en Modo Offline' : 'Cargar Datos y Acceder'}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InitialConfigComponent;
