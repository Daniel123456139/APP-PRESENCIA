
import React, { useState, useMemo, useEffect } from 'react';
import { ANNUAL_CREDITS } from '../../constants';
import { CompanyHoliday } from '../../types';
import { getApiBaseUrl, setApiBaseUrl, clearApiBaseUrl, getErpUsername, setErpUsername } from '../../config/apiConfig';
import { checkConnection } from '../../services/apiService';
import SmartDateInput from '../shared/SmartDateInput';

// Define the structure of our settings
interface SettingsState {
    permisos: {
        medico: number;
        vacaciones: number;
        libreDisposicion: number;
        leyFamilias: number;
    };
    fichaje: {
        retrasoMinutos: number;
        retrasoSegundos: number;
    };
    alertas: {
        vacaciones: number;
        excesoJornada: number;
        numRetrasos: number;
    };
    sistema: {
        modoRendimiento: boolean;
    };
}

// Define the default state based on hardcoded values
const DEFAULT_SETTINGS: SettingsState = {
    permisos: {
        medico: ANNUAL_CREDITS.MEDICO_HOURS,
        vacaciones: ANNUAL_CREDITS.VACATION_DAYS,
        libreDisposicion: ANNUAL_CREDITS.LIBRE_DISPOSICION_HOURS,
        leyFamilias: ANNUAL_CREDITS.LEY_FAMILIAS_HOURS,
    },
    fichaje: {
        retrasoMinutos: 1,
        retrasoSegundos: 59,
    },
    alertas: {
        vacaciones: 2, // Warn when <= 2 days left
        excesoJornada: 10, // Warn when > 10 hours
        numRetrasos: 3, // Danger when > 3 delays
    },
    sistema: {
        modoRendimiento: false
    }
};

const SettingsSection: React.FC<{ title: string; description: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, description, children, icon }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
            <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    {icon}
                </div>
                <div className="ml-4">
                    <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>
            </div>
        </div>
        <div className="md:col-span-2">
            <div className="bg-slate-50/70 p-6 rounded-xl space-y-4">
                {children}
            </div>
        </div>
    </div>
);

const SettingsInput: React.FC<{ label: string; name: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: 'number' | 'text', unit: string }> = ({ label, name, value, onChange, type = 'number', unit }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-slate-700">{label}</label>
        <div className="mt-1 relative rounded-md shadow-sm">
            <input
                type={type}
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                className="block w-full pl-3 pr-12 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-slate-500 sm:text-sm">{unit}</span>
            </div>
        </div>
    </div>
);

interface SettingsProps {
    companyHolidays: CompanyHoliday[];
    setCompanyHolidays: React.Dispatch<React.SetStateAction<CompanyHoliday[]>>;
}

const Settings: React.FC<SettingsProps> = ({ companyHolidays, setCompanyHolidays }) => {
    const [settings, setSettings] = useState<SettingsState>(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    });

    const [initialSettings, setInitialSettings] = useState<SettingsState>(settings);
    const [successMessage, setSuccessMessage] = useState('');
    const [newHoliday, setNewHoliday] = useState({ date: '', description: '' });

    // Server Config State
    const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
    const [erpUsername, setLocalErpUsername] = useState(getErpUsername());
    const [apiCheckResult, setApiCheckResult] = useState<{ status: 'idle' | 'checking' | 'success' | 'error', message: string }>({ status: 'idle', message: '' });

    const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(initialSettings), [settings, initialSettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const [section, key] = name.split('.');

        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section as keyof SettingsState],
                [key]: type === 'checkbox' ? checked : (parseInt(value, 10) || 0),
            }
        }));
    };

    const handleNewHolidayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewHoliday(prev => ({ ...prev, [name]: value }));
    };

    const handleAddHoliday = () => {
        if (!newHoliday.date || !newHoliday.description) {
            alert('Por favor, completa la fecha y la descripción del festivo.');
            return;
        }
        const newHolidayEntry: CompanyHoliday = {
            id: Date.now(),
            date: newHoliday.date,
            description: newHoliday.description,
        };
        setCompanyHolidays(prev => [...prev, newHolidayEntry].sort((a, b) => a.date.localeCompare(b.date)));
        setNewHoliday({ date: '', description: '' });
    };

    const handleDeleteHoliday = (id: number) => {
        setCompanyHolidays(prev => prev.filter(h => h.id !== id));
    };

    const handleSave = () => {
        localStorage.setItem('appSettings', JSON.stringify(settings));
        window.dispatchEvent(new Event('settingsChanged'));
        setInitialSettings(settings);
        setSuccessMessage('¡Configuración guardada correctamente!');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleReset = () => {
        setSettings(DEFAULT_SETTINGS);
    };

    // Server Config Handlers
    const handleSaveApiUrl = () => {
        setApiBaseUrl(apiUrl);
        setSuccessMessage('URL del servidor actualizada. El monitor intentará reconectar.');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleSaveErpUsername = () => {
        setErpUsername(erpUsername);
        setSuccessMessage('Usuario ERP actualizado correctamente.');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleResetApiUrl = () => {
        clearApiBaseUrl();
        setApiUrl(getApiBaseUrl());
        setSuccessMessage('URL restablecida a valores por defecto/entorno.');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleTestConnection = async () => {
        setApiCheckResult({ status: 'checking', message: 'Probando conexión...' });
        const start = Date.now();
        const success = await checkConnection();
        const latency = Date.now() - start;

        if (success) {
            setApiCheckResult({ status: 'success', message: `Conexión Exitosa (${latency}ms)` });
        } else {
            setApiCheckResult({ status: 'error', message: 'Fallo al conectar. Verifica la URL y VPN.' });
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Configuración</h1>
                <p className="mt-2 text-slate-600">Ajusta los parámetros globales de la aplicación.</p>
            </div>

            <div className="space-y-10">
                <SettingsSection
                    title="Servidor / ERP"
                    description="Configura la dirección del servidor de backend. Necesario si cambia la IP o red."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>}
                >
                    <div>
                        <label htmlFor="apiUrl" className="block text-sm font-medium text-slate-700">URL Base del API</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <input
                                type="text"
                                name="apiUrl"
                                id="apiUrl"
                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-slate-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="http://10.0.0.19:8000"
                                value={apiUrl}
                                onChange={(e) => setApiUrl(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={handleSaveApiUrl}
                                className="inline-flex items-center px-3 py-2 border border-l-0 border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100 font-medium text-sm rounded-r-md"
                            >
                                Guardar
                            </button>
                        </div>
                        <div className="mt-2 flex justify-between items-center">
                            <button onClick={handleResetApiUrl} className="text-xs text-blue-600 hover:underline">Restablecer por defecto</button>
                            <button
                                onClick={handleTestConnection}
                                disabled={apiCheckResult.status === 'checking'}
                                className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${apiCheckResult.status === 'success' ? 'bg-green-100 text-green-700 border-green-200' :
                                        apiCheckResult.status === 'error' ? 'bg-red-100 text-red-700 border-red-200' :
                                            'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                {apiCheckResult.status === 'checking' ? 'Probando...' :
                                    apiCheckResult.status === 'idle' ? 'Probar Conexión' : apiCheckResult.message}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <label htmlFor="erpUsername" className="block text-sm font-medium text-slate-700">Usuario ERP (dominio\usuario)</label>
                        <p className="text-xs text-slate-500 mb-2">Este usuario se envía al ERP cuando se insertan o modifican fichajes.</p>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <input
                                type="text"
                                name="erpUsername"
                                id="erpUsername"
                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-slate-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                                placeholder="DOMINIO\\usuario"
                                value={erpUsername}
                                onChange={(e) => setLocalErpUsername(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={handleSaveErpUsername}
                                className="inline-flex items-center px-3 py-2 border border-l-0 border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100 font-medium text-sm rounded-r-md"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection
                    title="Rendimiento del Sistema"
                    description="Opciones avanzadas para optimizar la velocidad en equipos lentos o con muchos datos."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <label htmlFor="modoRendimiento" className="font-medium text-slate-800 block">Modo Alto Rendimiento</label>
                            <p className="text-sm text-slate-500">Activa la virtualización de tablas y Web Workers. Recomendado para +500 empleados.</p>
                        </div>
                        <div className="relative inline-block w-12 h-6 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" name="sistema.modoRendimiento" id="modoRendimiento" checked={settings.sistema?.modoRendimiento} onChange={handleChange} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 checked:right-0 checked:border-green-400" />
                            <label htmlFor="modoRendimiento" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.sistema?.modoRendimiento ? 'bg-green-400' : 'bg-slate-300'}`}></label>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection
                    title="Permisos Anuales"
                    description="Define los días y horas base para los permisos anuales de los empleados."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                >
                    <SettingsInput label="Horas de Médico" name="permisos.medico" value={settings.permisos.medico} onChange={handleChange} unit="horas" />
                    <SettingsInput label="Días de Vacaciones" name="permisos.vacaciones" value={settings.permisos.vacaciones} onChange={handleChange} unit="días" />
                    <SettingsInput label="Horas de Libre Disposición" name="permisos.libreDisposicion" value={settings.permisos.libreDisposicion} onChange={handleChange} unit="horas" />
                    <SettingsInput label="Horas Ley Familias" name="permisos.leyFamilias" value={settings.permisos.leyFamilias} onChange={handleChange} unit="horas" />
                </SettingsSection>

                <SettingsSection
                    title="Parámetros de Fichaje"
                    description="Configura las reglas para el registro de entradas y salidas."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                >
                    <div className="grid grid-cols-2 gap-4">
                        <SettingsInput label="Minutos de cortesía" name="fichaje.retrasoMinutos" value={settings.fichaje.retrasoMinutos} onChange={handleChange} unit="min" />
                        <SettingsInput label="Segundos de cortesía" name="fichaje.retrasoSegundos" value={settings.fichaje.retrasoSegundos} onChange={handleChange} unit="seg" />
                    </div>
                </SettingsSection>

                <SettingsSection
                    title="Días Festivos"
                    description="Gestiona los festivos de la empresa que se aplicarán a todos los empleados."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <div className="sm:col-span-2">
                                <label htmlFor="holidayDescription" className="block text-sm font-medium text-slate-700">Descripción</label>
                                <input type="text" id="holidayDescription" name="description" value={newHoliday.description} onChange={handleNewHolidayChange} className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md bg-white" />
                            </div>
                            <div>
                                <label htmlFor="holidayDate" className="block text-sm font-medium text-slate-700">Fecha</label>
                                <SmartDateInput id="holidayDate" name="date" value={newHoliday.date} onChange={(nextValue) => setNewHoliday(prev => ({ ...prev, date: nextValue }))} className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md bg-white" />
                            </div>
                        </div>
                        <button onClick={handleAddHoliday} className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700">Añadir Festivo</button>

                        <div className="pt-4 border-t border-slate-200">
                            <h4 className="text-md font-medium text-slate-800">Festivos Configurados</h4>
                            <ul className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                                {companyHolidays.map(holiday => (
                                    <li key={holiday.id} className="flex justify-between items-center bg-white p-2 rounded-md border border-slate-200">
                                        <div>
                                            <p className="font-medium text-slate-900">{holiday.description}</p>
                                            <p className="text-sm text-slate-500">{new Date(holiday.date + 'T00:00:00').toLocaleDateString()}</p>
                                        </div>
                                        <button onClick={() => handleDeleteHoliday(holiday.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </li>
                                ))}
                                {companyHolidays.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No hay festivos añadidos.</p>}
                            </ul>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection
                    title="Umbrales de Alerta"
                    description="Establece los límites para que el sistema genere alertas automáticas."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                >
                    <SettingsInput label="Alerta de Días de Vacaciones restantes (≤)" name="alertas.vacaciones" value={settings.alertas.vacaciones} onChange={handleChange} unit="días" />
                    <SettingsInput label="Alerta de Horas Extra acumuladas (>)" name="alertas.excesoJornada" value={settings.alertas.excesoJornada} onChange={handleChange} unit="horas" />
                    <SettingsInput label="Alerta de Nº de Retrasos (>)" name="alertas.numRetrasos" value={settings.alertas.numRetrasos} onChange={handleChange} unit="veces" />
                </SettingsSection>
            </div>

            {successMessage && (
                <div className="mt-6 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md transition-opacity duration-300 text-center font-bold sticky bottom-4 shadow-lg">
                    {successMessage}
                </div>
            )}

            <div className="mt-8 pt-5 border-t border-slate-200 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={handleReset}
                    className="px-5 py-2.5 bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50"
                >
                    Restablecer a Valores por Defecto
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty}
                    className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                    Guardar Cambios
                </button>
            </div>
        </div>
    );
};

export default Settings;
