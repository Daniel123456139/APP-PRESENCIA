import React, { useState, useCallback } from 'react';
import { analyzeImage } from '../../services/geminiService';

const ImageAnalyzer: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('¿Qué ves en esta imagen?');
    const [image, setImage] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string>('');
    const [analysis, setAnalysis] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                setError('El archivo es demasiado grande. Por favor, selecciona una imagen de menos de 2MB.');
                return;
            }
            setError('');
            setMimeType(file.type);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyzeClick = useCallback(async () => {
        if (!image || !prompt) {
            setError('Por favor, proporciona una imagen y una pregunta.');
            return;
        }
        setIsLoading(true);
        setError('');
        setAnalysis('');
        try {
            const base64Data = image.split(',')[1];
            const result = await analyzeImage(prompt, base64Data, mimeType);
            setAnalysis(result);
        } catch (err) {
            setError('Error al analizar la imagen.');
        } finally {
            setIsLoading(false);
        }
    }, [image, prompt, mimeType]);

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-800 mb-6">Analizador de Imágenes con Gemini</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                         <h2 className="text-xl font-semibold text-slate-700 mb-3">1. Sube una Imagen</h2>
                        <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        {image && (
                            <div className="mt-4 border rounded-lg p-2">
                                <img src={image} alt="Preview" className="max-h-60 w-auto mx-auto rounded" />
                            </div>
                        )}
                    </div>
                     <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-xl font-semibold text-slate-700 mb-3">2. Haz una Pregunta</h2>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                        />
                    </div>
                    <button onClick={handleAnalyzeClick} disabled={isLoading || !image} className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all">
                        {isLoading ? 'Analizando...' : 'Analizar Imagen'}
                    </button>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-700 mb-3">3. Resultado del Análisis</h2>
                    <div className="bg-slate-50/70 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap text-slate-800">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            analysis || 'El análisis aparecerá aquí...'
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageAnalyzer;