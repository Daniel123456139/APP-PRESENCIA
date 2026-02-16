
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, FunctionDeclaration, Type, Tool } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ProcessedDataRow, RawDataRow, User } from '../../types';
import { useFichajesMutations } from '../../hooks/useFichajes';
import { useMotivos } from '../../hooks/useErp';
import { getGeminiClientApiKey, getGeminiDisabledMessage } from '../../config/aiConfig';

interface Message {
    text: string;
    sender: 'user' | 'bot';
}

interface HrChatbotProps {
    processedData: ProcessedDataRow[];
    // setErpData: React.Dispatch<React.SetStateAction<RawDataRow[]>>; // Deprecated
    allEmployees: User[];
}

const apiKey = getGeminiClientApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey: apiKey }) : null;

// Define the function tool for the model
const registerIncidentFunction: FunctionDeclaration = {
    name: "registrar_incidencia",
    description: "Registra una incidencia, ausencia o falta para un empleado específico en una fecha dada.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            id_empleado: {
                type: Type.INTEGER,
                description: "El ID numérico del empleado.",
            },
            id_motivo: {
                type: Type.INTEGER,
                description: "El ID numérico del motivo de la incidencia (ej: 2 para Médico, 3 para Asuntos Propios, etc.).",
            },
            fecha: {
                type: Type.STRING,
                description: "La fecha de la incidencia en formato YYYY-MM-DD.",
            },
            hora_inicio: {
                type: Type.STRING,
                description: "Hora de inicio en formato HH:MM (opcional, por defecto 00:00 para día completo).",
            },
            hora_fin: {
                type: Type.STRING,
                description: "Hora de fin en formato HH:MM (opcional).",
            }
        },
        required: ["id_empleado", "id_motivo", "fecha"],
    },
};

const HrChatbot: React.FC<HrChatbotProps> = ({ processedData, allEmployees }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const chatSession = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { addIncidents } = useFichajesMutations();
    const { motivos } = useMotivos();

    const initialMessage = "Asistente de RRHH potenciado por IA. Puedo analizar datos y registrar incidencias por ti. Ej: 'Registra Médico para Juan el 2023-10-25'.";

    // Helper function to execute the tool call
    const handleRegisterIncident = (args: any) => {
        const { id_empleado, id_motivo, fecha, hora_inicio, hora_fin } = args;

        const employee = allEmployees.find(e => e.id === id_empleado);
        const reason = motivos.find(r => parseInt(r.IDMotivo) === id_motivo);

        if (!employee || !reason) {
            return { result: "Error: Empleado o motivo no encontrado." };
        }

        const newRow: RawDataRow = {
            DescDepartamento: String(employee.role),
            IDOperario: employee.id,
            DescOperario: employee.name,
            Fecha: fecha,
            Hora: hora_inicio || '00:00:00',
            Entrada: 0,
            MotivoAusencia: parseInt(reason.IDMotivo),
            DescMotivoAusencia: reason.DescMotivo,
            Computable: 'Sí',
            IDTipoTurno: null,
            Inicio: '',
            Fin: '',
            TipoDiaEmpresa: 0,
            TurnoTexto: reason.DescMotivo,
        };

        // Usar la acción global para asegurar validación y sincronización (cola)
        // NOTA: No podemos usar await aquí fácilmente porque estamos dentro de una función síncrona helper, 
        // pero podemos devolver una promesa o manejarlo en el flujo principal.
        // Hack: Devolvemos objeto especial para que el caller lo ejecute.
        return {
            action: 'ADD_INCIDENT',
            payload: [newRow],
            successMessage: `Incidencia '${reason.DescMotivo}' registrada correctamente para ${employee.name} el ${fecha}.`,
            result: `Incidencia '${reason.DescMotivo}' registrada correctamente para ${employee.name} el ${fecha}.` // Fallback result for type compatibility
        };
    };

    useEffect(() => {
        if (processedData && ai && motivos.length > 0) {
            const employeeListString = allEmployees.map(e => `ID: ${e.id}, Nombre: ${e.name}`).join('\n');
            const incidentListString = motivos.map(r => `ID: ${r.IDMotivo}, Descripción: ${r.DescMotivo}`).join('\n');

            const systemInstruction = `
                Eres 'ProBot-HR', un asistente avanzado de RRHH.
                
                **TUS CAPACIDADES:**
                1.  **Analizar Datos:** Tienes acceso a los datos procesados de los empleados.
                2.  **Acciones (Tools):** Puedes registrar incidencias en el sistema usando la herramienta 'registrar_incidencia'.

                **CONTEXTO:**
                Lista de Empleados (ID - Nombre):
                ${employeeListString}

                Tipos de Incidencia (ID - Descripción):
                ${incidentListString}

                Datos Procesados Actuales:
                ${JSON.stringify(processedData.slice(0, 50), null, 2)} (Muestra parcial para contexto)

                **REGLAS:**
                *   Si el usuario pide registrar una incidencia, usa la herramienta 'registrar_incidencia'. Debes inferir el ID del empleado a partir de su nombre y el ID del motivo a partir de la descripción.
                *   Si falta información (fecha, motivo, empleado), pregúntala antes de llamar a la herramienta.
                *   Responde de forma concisa y profesional en español.
            `;

            const tools: Tool[] = [{ functionDeclarations: [registerIncidentFunction] }];

            try {
                chatSession.current = ai.chats.create({
                    model: 'gemini-2.5-pro',
                    config: {
                        systemInstruction: systemInstruction,
                        tools: tools,
                    },
                });
            } catch (e) {
                console.error("Failed to create chat session:", e);
            }

            if (messages.length === 0) {
                setMessages([{ text: initialMessage, sender: 'bot' }]);
            }
        } else if (!ai && messages.length === 0) {
            setMessages([{ text: `⚠️ ${getGeminiDisabledMessage()}`, sender: 'bot' }]);
        }
    }, [processedData, messages.length, allEmployees, motivos]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const sendMessage = async (messageText: string) => {
        if (messageText.trim() === '' || isLoading) return;

        if (!ai || !chatSession.current) {
            setMessages(prev => [...prev, { text: messageText, sender: 'user' }, { text: "Error: IA no disponible.", sender: 'bot' }]);
            return;
        }

        setShowSuggestions(false);
        const userMessage: Message = { text: messageText, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const result = await chatSession.current.sendMessage({ message: messageText });

            // Handle Function Calls
            const functionCalls = result.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
                // Add a placeholder message while executing tool
                setMessages(prev => [...prev, { text: "🔄 Procesando solicitud en el sistema...", sender: 'bot' }]);

                const call = functionCalls[0];
                let toolResult = { result: "Error desconocido" };

                if (call.name === 'registrar_incidencia') {
                    const actionResult = handleRegisterIncident(call.args);

                    if (actionResult.action === 'ADD_INCIDENT') {
                        try {
                            await addIncidents({ newRows: actionResult.payload, userName: "Chatbot AI" });
                            toolResult = { result: actionResult.successMessage };
                        } catch (err: any) {
                            toolResult = { result: `Error al guardar en ERP: ${err.message}` };
                        }
                    } else {
                        toolResult = actionResult;
                    }
                }

                // Send the result back to the model
                const responseWithToolResult = await chatSession.current.sendMessage({
                    message: [{
                        functionResponse: {
                            name: call.name,
                            response: toolResult
                        }
                    }]
                });

                // Remove the loading/processing placeholder and show the final response
                setMessages(prev => {
                    const newMsgs = prev.slice(0, -1); // Remove "Procesando..."
                    return [...newMsgs, { text: responseWithToolResult.text || "Acción completada.", sender: 'bot' }];
                });

            } else {
                // Normal text response
                setMessages(prev => [...prev, { text: result.text || "No pude generar una respuesta.", sender: 'bot' }]);
            }

        } catch (error) {
            console.error("Error sending message to Gemini:", error);
            const errorMessage: Message = { text: "Lo siento, ha ocurrido un error al procesar tu solicitud.", sender: 'bot' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = () => {
        setMessages([{ text: initialMessage, sender: 'bot' }]);
        setShowSuggestions(true);
        // Re-initialize chat to clear context history
        if (processedData) {
            // Trigger re-run of useEffect by making dependecy change or just relying on current ref (simplified for this snippet)
        }
    };

    const suggestions = [
        "¿Quién tiene más horas extra?",
        "Registra Médico (ID 2) para Juan hoy",
        "Registra Asuntos Propios para Sergio mañana",
    ];

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-indigo-600 text-white rounded-full p-3.5 shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 z-50 transition-transform hover:scale-110"
                aria-label="Toggle HR Chatbot"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            </button>
            {isOpen && (
                <div className="fixed bottom-20 right-4 sm:right-6 w-[calc(100%-2rem)] max-w-md h-[70vh] max-h-[550px] bg-white rounded-xl shadow-2xl flex flex-col z-40 transition-all duration-300 ease-in-out border border-slate-200">
                    <div className="p-3 bg-indigo-600 text-white rounded-t-xl flex justify-between items-center">
                        <div className="flex items-center">
                            <span className="mr-2 text-xl">⚡</span>
                            <h3 className="text-lg font-semibold">ProBot-HR (Con Acciones)</h3>
                        </div>
                        <button onClick={handleClearChat} title="Limpiar chat" className="text-white hover:text-indigo-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'bot' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">P</div>}
                                <div className={`px-4 py-2 rounded-2xl max-w-xs break-words ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none prose prose-sm max-w-none prose-slate'}`}>
                                    {msg.sender === 'bot' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown> : msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-end gap-2 justify-start">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">P</div>
                                <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 rounded-bl-none flex items-center space-x-1">
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
                                        onClick={() => sendMessage(s)}
                                        className="px-3 py-1.5 bg-white border border-indigo-400 text-indigo-600 rounded-full text-sm hover:bg-indigo-50 transition-colors text-left"
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
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
                                placeholder="Ej: Registra incidencia 3 para Sergio hoy"
                                disabled={isLoading}
                                className="flex-1 px-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                            />
                            <button onClick={() => sendMessage(input)} disabled={isLoading} className="ml-2 flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center">
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

export default HrChatbot;
