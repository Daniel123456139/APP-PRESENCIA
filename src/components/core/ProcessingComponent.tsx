
import React, { useState, useEffect } from 'react';

const PROCESSING_MESSAGES = [
    "Analizando la estructura del archivo...",
    "Validando el formato de los datos...",
    "Enviando datos a Gemini para un análisis profundo...",
    "Gemini está pensando... Este proceso puede tardar para garantizar la máxima precisión.",
    "El análisis de alto nivel está en curso...",
    "Generando el informe de incidencias...",
    "Recopilando resultados y finalizando...",
    "Casi listo. Cargando el portal..."
];

const ProcessingComponent: React.FC = () => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex(prevIndex => (prevIndex + 1) % PROCESSING_MESSAGES.length);
        }, 3000); // Change message every 3 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 text-center p-4">
            <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-xl">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto"></div>
                <h1 className="text-2xl font-bold text-slate-800 mt-8">Procesando Datos</h1>
                <p className="text-slate-600 mt-4 h-10">
                    {PROCESSING_MESSAGES[messageIndex]}
                </p>
            </div>
        </div>
    );
};

export default ProcessingComponent;
