
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BlogPost } from '../../types';

interface BlogViewProps {
    blogPosts: BlogPost[];
}

const BlogView: React.FC<BlogViewProps> = ({ blogPosts }) => {
    const [expandedPostId, setExpandedPostId] = useState<number | null>(null);

    const featuredPost = blogPosts[0];
    const otherPosts = blogPosts.slice(1);

    if (blogPosts.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-slate-200">
                <p className="text-slate-500">No hay noticias publicadas en este momento.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-10">
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Noticias y Actualidad</h1>
            
            {/* Featured Post */}
            {featuredPost && (
                <div 
                    className="relative rounded-2xl overflow-hidden shadow-xl bg-slate-900 text-white cursor-pointer group"
                    onClick={() => setExpandedPostId(expandedPostId === featuredPost.id ? null : featuredPost.id)}
                >
                    <div className="absolute inset-0">
                         {featuredPost.imageUrl ? (
                            <img src={featuredPost.imageUrl} alt={featuredPost.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-50 transition-opacity" />
                         ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-800 opacity-80" />
                         )}
                         <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    </div>
                    
                    <div className="relative p-8 md:p-12 flex flex-col justify-end min-h-[400px]">
                        <div className="space-y-4">
                             <div className="flex flex-wrap gap-2">
                                {featuredPost.tags.map(tag => (
                                    <span key={tag} className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold uppercase tracking-wider">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            <h2 className="text-3xl md:text-5xl font-bold leading-tight group-hover:underline decoration-blue-400 underline-offset-4 decoration-4">
                                {featuredPost.title}
                            </h2>
                            <p className="text-lg text-slate-200 max-w-2xl font-light">
                                {featuredPost.summary}
                            </p>
                            <div className="flex items-center space-x-2 text-sm text-slate-300 pt-4">
                                <span className="font-semibold text-white">{featuredPost.author}</span>
                                <span>&bull;</span>
                                <span>{new Date(featuredPost.date).toLocaleDateString('es-ES', { dateStyle: 'long' })}</span>
                            </div>
                        </div>
                         {expandedPostId === featuredPost.id && (
                             <div className="mt-8 pt-8 border-t border-white/20 prose prose-invert max-w-none animate-fadeIn">
                                <ReactMarkdown>{featuredPost.content}</ReactMarkdown>
                            </div>
                         )}
                    </div>
                </div>
            )}

            {/* Grid for other posts */}
            {otherPosts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {otherPosts.map(post => (
                        <div key={post.id} className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                             <div className="h-48 overflow-hidden bg-slate-200 relative">
                                {post.imageUrl ? (
                                    <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                        </svg>
                                    </div>
                                )}
                                <div className="absolute top-4 right-4 flex gap-1">
                                    {post.tags.slice(0, 2).map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-white/90 text-slate-700 text-[10px] font-bold uppercase rounded shadow-sm">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="p-6 flex-1 flex flex-col">
                                <div className="text-xs text-slate-500 mb-2">
                                    {new Date(post.date).toLocaleDateString()}
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-3 leading-snug">
                                    {post.title}
                                </h3>
                                <p className="text-slate-600 text-sm line-clamp-3 mb-4 flex-1">
                                    {post.summary}
                                </p>
                                
                                {expandedPostId === post.id ? (
                                     <div className="mt-4 pt-4 border-t border-slate-100 prose prose-sm max-w-none text-slate-600">
                                        <ReactMarkdown>{post.content}</ReactMarkdown>
                                        <button 
                                            onClick={() => setExpandedPostId(null)}
                                            className="mt-4 text-blue-600 font-medium hover:underline text-sm"
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => setExpandedPostId(post.id)}
                                        className="inline-flex items-center text-blue-600 font-semibold text-sm hover:text-blue-800 transition-colors"
                                    >
                                        Leer más
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BlogView;
