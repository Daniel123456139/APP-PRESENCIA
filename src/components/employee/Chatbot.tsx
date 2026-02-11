
import React, { useState, useEffect, useContext, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AuthContext, AuthContextType, DataContext } from '../../App';
import { processData } from '../../services/dataProcessor';
import { ProcessedDataRow } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    text: string;
    sender: 'user' | 'bot';
}

// Safe API Key retrieval to prevent crash in environments where process is undefined
const getApiKey = () => {
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return process.env.API_KEY;
        }
    } catch (e) { }
    return '';
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey: apiKey }) : null;

const Chatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [employeeData, setEmployeeData] = useState<ProcessedDataRow | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const auth = useContext(AuthContext) as AuthContextType;
    const { erpData, shifts } = useContext(DataContext);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const initialMessage = "Soy ProBot, tu asistente personal. Puedes preguntarme sobre tus horas, vacaciones, permisos, etc. ¿En qué puedo ayudarte?";

    useEffect(() => {
        if (auth?.user && erpData.length > 0) {
            // Pass shifts to ensure chatbot sees the correct calculated data
            const processed = processData(erpData, [auth.user], auth.user.id);
            setEmployeeData(processed.length > 0 ? processed[0] : null);
        }
        if (messages.length === 0) {
            setMessages([{ text: initialMessage, sender: 'bot' }]);
        }
    }, [auth?.user, erpData, shifts, messages.length]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (messageText: string) => {
        const text = messageText.trim();
        if (text === '' || isLoading) return;

        if (!ai) {
            setMessages(prev => [...prev, { text: text, sender: 'user' }, { text: "⚠️ Error: API Key no configurada. No puedo responder.", sender: 'bot' }]);
            return;
        }

        setShowSuggestions(false);
        const userMessage: Message = { text, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const systemInstruction = `
            Actúas como 'ProBot', un asistente de RRHH directo y eficiente para empleados. Tu única función es responder preguntas sobre los datos laborales del empleado.

            **REGLAS ESTRICTAS:**
            1.  **BASADO EN DATOS:** Basa TODAS tus respuestas exclusivamente en el siguiente objeto JSON que representa los datos del empleado. NO inventes información.
                Datos del empleado: ${JSON.stringify(employeeData, null, 2)}
            2.  **CONCISO Y DIRECTO:** Responde de la forma más breve y directa posible. Evita saludos, despedidas o cualquier tipo de relleno conversacional. Ve directamente al grano.
            3.  **FORMATO:** Utiliza el formato que mejor presente la información. Para datos tabulares (como horas por día), usa una tabla Markdown. Para listas simples, usa viñetas (\`*\`).
            4.  **IDIOMA:** Responde siempre en español.
            5.  **SI NO SABES:** Si la pregunta no se puede responder con los datos proporcionados, responde únicamente con: "No tengo esa información en tus datos laborales."
        `;

        try {
            const stream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: text,
                config: { systemInstruction }
            });

            let botResponse = '';
            setMessages(prev => [...prev, { text: '', sender: 'bot' }]);

            for await (const chunk of stream) {
                botResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = botResponse;
                    return newMessages;
                });
            }

        } catch (error) {
            console.error("Error getting chatbot response:", error);
            const errorMessage: Message = { text: "Lo siento, ha ocurrido un error al procesar tu solicitud.", sender: 'bot' };
            setMessages(prev => {
                const newMessages = [...prev];
                // Replace the empty bot message with the error message
                if (newMessages[newMessages.length - 1].sender === 'bot' && newMessages[newMessages.length - 1].text === '') {
                    newMessages[newMessages.length - 1] = errorMessage;
                } else {
                    newMessages.push(errorMessage);
                }
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = () => {
        setMessages([{ text: initialMessage, sender: 'bot' }]);
        setShowSuggestions(true);
    };

    const suggestions = [
        "¿Cuántas vacaciones me quedan?",
        "¿He llegado tarde este mes?",
        "Resume mis permisos disponibles",
    ];

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-blue-600 text-white rounded-full p-3.5 shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 z-50 transition-transform hover:scale-110"
                aria-label="Toggle Chatbot"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            </button>
            {isOpen && (
                <div className="fixed bottom-20 right-4 sm:right-6 w-[calc(100%-2rem)] max-w-sm h-[70vh] max-h-[500px] bg-white rounded-xl shadow-2xl flex flex-col z-40 transition-all duration-300 ease-in-out border border-slate-200">
                    <div className="p-3 bg-blue-600 text-white rounded-t-xl flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Asistente de RRHH</h3>
                        <button onClick={handleClearChat} title="Limpiar chat" className="text-white hover:text-blue-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'bot' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">P</div>}
                                <div className={`px-4 py-2 rounded-2xl max-w-xs break-words ${msg.sender === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-slate-200 text-slate-800 rounded-bl-none prose prose-sm max-w-none prose-slate prose-table:w-full prose-thead:bg-slate-300/70 prose-tr:border-b-slate-300/70'}`}>
                                    {msg.sender === 'bot' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown> : msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-end gap-2 justify-start">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">P</div>
                                <div className="px-4 py-3 rounded-2xl bg-slate-200 text-slate-800 rounded-bl-none flex items-center space-x-1">
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse"></span>
                                </div>
                            </div>
                        )}
                        {showSuggestions && (
                            <div className="pt-2 flex flex-col items-start gap-2">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(s)}
                                        className="px-3 py-1.5 bg-white border border-blue-400 text-blue-600 rounded-full text-sm hover:bg-blue-50 transition-colors"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-3 border-t bg-white rounded-b-xl">
                        <div className="flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend(input)}
                                placeholder="Haz una pregunta..."
                                disabled={isLoading}
                                className="flex-1 px-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                            />
                            <button onClick={() => handleSend(input)} disabled={isLoading} className="ml-2 flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Chatbot;
