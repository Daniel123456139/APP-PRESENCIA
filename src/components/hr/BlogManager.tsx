
import React, { useState, useMemo } from 'react';
import { BlogPost } from '../../types';
import BlogModal from './BlogModal';
import ReactMarkdown from 'react-markdown';
import { SvgIcon } from '../shared/Nav';

interface BlogManagerProps {
    blogPosts: BlogPost[];
    setBlogPosts: React.Dispatch<React.SetStateAction<BlogPost[]>>;
}

const BlogManager: React.FC<BlogManagerProps> = ({ blogPosts, setBlogPosts }) => {
    // Navigation & Modal State
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
    const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

    // Filter & Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');

    // --- Derived Data ---

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        blogPosts.forEach(post => post.tags.forEach(tag => tags.add(tag)));
        return ['Todas', ...Array.from(tags).sort()];
    }, [blogPosts]);

    const filteredPosts = useMemo(() => {
        return blogPosts.filter(post => {
            const matchesSearch = 
                post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                post.author.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesCategory = selectedCategory === 'Todas' || post.tags.includes(selectedCategory);

            return matchesSearch && matchesCategory;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [blogPosts, searchTerm, selectedCategory]);

    // --- Handlers ---

    const handleOpenModal = (post: BlogPost | null = null) => {
        setEditingPost(post);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPost(null);
    };

    const handleSavePost = (postData: Omit<BlogPost, 'id' | 'date' | 'summary'> & { id?: number }) => {
        // Simple summary generation if none provided, taking first ~150 chars or first paragraph
        const summary = postData.content.split('\n').find(line => line.trim().length > 0)?.substring(0, 160).trim() + '...' || 'Sin resumen.';

        if (postData.id) {
            setBlogPosts(prev =>
                prev.map(p =>
                    p.id === postData.id
                        ? { ...p, ...postData, summary, date: new Date().toISOString().split('T')[0] }
                        : p
                )
            );
            // If we are editing the currently viewed post, update the selection
            if (selectedPost && selectedPost.id === postData.id) {
                setSelectedPost({ ...selectedPost, ...postData, summary });
            }
        } else {
            const newPost: BlogPost = {
                id: Math.max(0, ...blogPosts.map(p => p.id)) + 1,
                date: new Date().toISOString().split('T')[0],
                summary,
                ...postData,
            };
            setBlogPosts(prev => [newPost, ...prev]);
        }
        handleCloseModal();
    };
    
    const handleDeletePost = (postId: number) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta entrada? Esta acción no se puede deshacer.')) {
            setBlogPosts(prev => prev.filter(p => p.id !== postId));
            if (selectedPost?.id === postId) {
                handleBackToList();
            }
        }
    };

    const handleCardClick = (post: BlogPost) => {
        setSelectedPost(post);
        setViewMode('detail');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBackToList = () => {
        setSelectedPost(null);
        setViewMode('list');
    };

    // --- Render Components ---

    const renderHeader = () => (
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 transition-all">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Blog Corporativo</h2>
                <p className="text-slate-500 mt-1">Gestión de noticias y comunicados internos.</p>
            </div>
            <button
                onClick={() => handleOpenModal()}
                className="mt-4 md:mt-0 inline-flex items-center px-5 py-2.5 shadow-sm text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all hover:-translate-y-0.5"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Redactar Noticia
            </button>
        </div>
    );

    const renderFilters = () => (
        <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input
                    type="text"
                    placeholder="Buscar artículos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow shadow-sm"
                />
            </div>
            <div className="flex-shrink-0">
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="block w-full md:w-48 pl-3 pr-10 py-2.5 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm bg-white"
                >
                    {allTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>
            </div>
        </div>
    );

    const renderPostList = () => {
        if (filteredPosts.length === 0) {
            return (
                <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <h3 className="text-lg font-medium text-slate-900">No se encontraron artículos</h3>
                    <p className="mt-1 text-slate-500">Prueba a ajustar los filtros o crea una nueva noticia.</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredPosts.map((post) => (
                    <article
                        key={post.id}
                        onClick={() => handleCardClick(post)}
                        className="group flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                        <div className="relative h-48 overflow-hidden bg-slate-100">
                            {post.imageUrl ? (
                                <img 
                                    src={post.imageUrl} 
                                    alt={post.title} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                            <div className="absolute top-0 left-0 p-4 w-full flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-b from-black/50 to-transparent">
                                <div className="flex gap-2">
                                    {/* Action buttons overlay for quick access */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(post); }}
                                        className="p-2 bg-white/90 text-slate-700 hover:text-blue-600 rounded-full shadow-sm hover:bg-white transition-colors"
                                        title="Editar"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}
                                        className="p-2 bg-white/90 text-slate-700 hover:text-red-600 rounded-full shadow-sm hover:bg-white transition-colors"
                                        title="Eliminar"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col flex-grow p-6">
                            <div className="flex flex-wrap gap-2 mb-3">
                                {post.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md border border-slate-200">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            
                            <h3 className="text-xl font-bold text-slate-800 mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                                {post.title}
                            </h3>
                            
                            <p className="text-slate-600 text-sm line-clamp-3 mb-6 flex-grow leading-relaxed">
                                {post.summary}
                            </p>
                            
                            <div className="pt-4 mt-auto border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center">
                                    <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-2 text-[10px]">
                                        {post.author.charAt(0)}
                                    </div>
                                    <span className="font-medium">{post.author.split(' ')[0]}</span>
                                </div>
                                <time dateTime={post.date} className="tabular-nums">
                                    {new Date(post.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </time>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        );
    };

    const renderDetailView = () => {
        if (!selectedPost) return null;

        return (
            <div className="animate-fadeIn pb-12">
                {/* Detail Header / Nav */}
                <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50/95 backdrop-blur-sm py-4 z-10 border-b border-slate-200">
                    <button
                        onClick={handleBackToList}
                        className="flex items-center text-slate-600 hover:text-blue-600 font-medium transition-colors group px-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 transform group-hover:-translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Volver al Blog
                    </button>
                    
                    <div className="flex gap-2">
                         <button
                            onClick={() => handleOpenModal(selectedPost)}
                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-sm"
                        >
                            Editar
                        </button>
                        <button
                            onClick={() => handleDeletePost(selectedPost.id)}
                            className="px-4 py-2 bg-white border border-red-200 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors shadow-sm text-sm"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>

                {/* Article Content */}
                <article className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Hero Image */}
                    <div className="w-full h-64 md:h-96 bg-slate-200 relative">
                        {selectedPost.imageUrl ? (
                            <img 
                                src={selectedPost.imageUrl} 
                                alt={selectedPost.title} 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                             <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    <div className="p-8 md:p-12">
                        {/* Meta Header */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {selectedPost.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wide rounded-full">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
                            {selectedPost.title}
                        </h1>

                        <div className="flex items-center text-sm text-slate-500 mb-8 pb-8 border-b border-slate-100">
                             <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg mr-3 shadow-md">
                                {selectedPost.author.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">{selectedPost.author}</p>
                                <p>{new Date(selectedPost.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>

                        {/* Markdown Content */}
                        <div className="prose prose-lg prose-slate max-w-none 
                            prose-headings:font-bold prose-headings:text-slate-800 
                            prose-p:text-slate-600 prose-p:leading-relaxed 
                            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                            prose-img:rounded-xl prose-img:shadow-md
                            prose-li:text-slate-600">
                            <ReactMarkdown>{selectedPost.content}</ReactMarkdown>
                        </div>
                    </div>
                </article>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
            {viewMode === 'list' ? (
                <div className="animate-fadeIn">
                    {renderHeader()}
                    {blogPosts.length > 0 && renderFilters()}
                    {renderPostList()}
                </div>
            ) : (
                renderDetailView()
            )}

            <BlogModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSavePost}
                postToEdit={editingPost}
            />
        </div>
    );
};

export default BlogManager;
