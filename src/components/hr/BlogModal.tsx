
import React, { useState, useEffect } from 'react';
import { BlogPost } from '../../types';
import { generateBlogPost } from '../../services/geminiService';
import { SvgIcon } from '../shared/Nav';

interface BlogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (post: Omit<BlogPost, 'id' | 'date' | 'summary'> & { id?: number }) => void;
    postToEdit: BlogPost | null;
}

const BlogModal: React.FC<BlogModalProps> = ({ isOpen, onClose, onSave, postToEdit }) => {
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('Ana García (RRHH)'); // Default author
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    const [error, setError] = useState('');

    // AI State
    const [aiTopic, setAiTopic] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAiPanel, setShowAiPanel] = useState(true);

    useEffect(() => {
        if (postToEdit) {
            setTitle(postToEdit.title);
            setAuthor(postToEdit.author);
            setContent(postToEdit.content);
            setTags(postToEdit.tags.join(', '));
            setShowAiPanel(false); // Hide AI panel by default when editing
        } else {
            // Reset for new post
            setTitle('');
            setAuthor('Ana García (RRHH)');
            setContent('');
            setTags('');
            setAiTopic('');
            setShowAiPanel(true);
        }
        setError('');
    }, [postToEdit, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!title || !content) {
            setError('El título y el contenido son obligatorios.');
            return;
        }
        onSave({
            id: postToEdit?.id,
            title,
            author,
            content,
            tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        });
    };

    const handleGenerateAi = async () => {
        if (!aiTopic.trim()) {
            setError('Por favor, introduce un tema para que la IA genere el contenido.');
            return;
        }
        
        setIsGenerating(true);
        setError('');
        
        try {
            const result = await generateBlogPost(aiTopic);
            setTitle(result.title);
            setAuthor(result.author);
            setContent(result.content);
            setTags(result.tags.join(', '));
            // Optional: You could allow the user to review the summary if you added a field for it,
            // but for now we auto-generate summary on save based on content or let it be handled by BlogManager logic.
            // The generated 'summary' from AI is currently ignored or could be prepended/used if we add a summary field to this modal.
        } catch (err) {
            console.error(err);
            setError('Error al generar contenido con IA. Por favor, inténtalo de nuevo.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl transform transition-all border border-slate-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800">{postToEdit ? 'Editar Entrada' : 'Crear Nueva Entrada'}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">&times;</button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                    {/* AI Generator Section */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                        <div className="flex justify-between items-center mb-2 cursor-pointer" onClick={() => setShowAiPanel(!showAiPanel)}>
                            <h3 className="text-sm font-bold text-blue-800 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Asistente de Redacción IA
                            </h3>
                            <button className="text-blue-500 hover:text-blue-700 text-xs font-medium">
                                {showAiPanel ? 'Ocultar' : 'Mostrar'}
                            </button>
                        </div>
                        
                        {showAiPanel && (
                            <div className="space-y-3 animate-fadeIn">
                                <p className="text-xs text-blue-600">
                                    Describe brevemente el tema (ej: "Aviso de cierre por vacaciones en Agosto" o "Nuevas normas de seguridad en planta") y la IA redactará la noticia completa por ti.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={aiTopic}
                                        onChange={(e) => setAiTopic(e.target.value)}
                                        placeholder="Sobre qué quieres escribir..."
                                        className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        onKeyPress={(e) => e.key === 'Enter' && handleGenerateAi()}
                                    />
                                    <button
                                        onClick={handleGenerateAi}
                                        disabled={isGenerating || !aiTopic}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center min-w-[100px] justify-center"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                                ...
                                            </>
                                        ) : (
                                            <>
                                                Generar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-slate-700">Título</label>
                            <input
                                type="text"
                                id="title"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="author" className="block text-sm font-medium text-slate-700">Autor</label>
                            <input
                                type="text"
                                id="author"
                                value={author}
                                onChange={e => setAuthor(e.target.value)}
                                className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="content" className="block text-sm font-medium text-slate-700">Contenido (Markdown soportado)</label>
                            <textarea
                                id="content"
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                rows={10}
                                className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label htmlFor="tags" className="block text-sm font-medium text-slate-700">Etiquetas (separadas por comas)</label>
                            <input
                                type="text"
                                id="tags"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                className="mt-1 block w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                    </div>
                </div>

                {error && <p className="mt-4 text-sm text-red-600 flex-shrink-0">{error}</p>}
                
                <div className="mt-6 flex justify-end space-x-3 flex-shrink-0 border-t border-slate-100 pt-4">
                    <button onClick={onClose} className="px-5 py-2 bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
                        Guardar Noticia
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlogModal;
