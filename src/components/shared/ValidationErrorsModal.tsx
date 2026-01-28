
import React from 'react';
import { ValidationIssue } from '../../services/validationService';

interface ValidationErrorsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onContinue?: () => void; // Solo si hay warnings y no errores
    issues: ValidationIssue[];
}

const ValidationErrorsModal: React.FC<ValidationErrorsModalProps> = ({ isOpen, onClose, onContinue, issues }) => {
    if (!isOpen) return null;

    const hasErrors = issues.some(i => i.type === 'error');
    
    // Group issues by employee
    const issuesByEmployee = issues.reduce((acc, issue) => {
        if (!acc[issue.employeeName]) acc[issue.employeeName] = [];
        acc[issue.employeeName].push(issue);
        return acc;
    }, {} as Record<string, ValidationIssue[]>);

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl transform transition-all border border-slate-200 animate-fadeIn">
                <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-4">
                    <div className="flex items-center">
                        <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${hasErrors ? 'bg-red-100' : 'bg-amber-100'} mr-4`}>
                            {hasErrors ? (
                                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            ) : (
                                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {hasErrors ? 'Conflictos Detectados' : 'Advertencias de Validación'}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {hasErrors 
                                    ? 'No se puede guardar la operación debido a los siguientes conflictos.' 
                                    : 'Revisa las siguientes advertencias antes de continuar.'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <span className="sr-only">Cerrar</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[60vh] pr-2 space-y-4">
                    {Object.entries(issuesByEmployee).map(([employee, empIssues]) => (
                        <div key={employee} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <h4 className="font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-2 flex items-center">
                                <svg className="w-4 h-4 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                {employee}
                            </h4>
                            <ul className="space-y-2">
                                {(empIssues as ValidationIssue[]).map((issue, idx) => (
                                    <li key={idx} className={`flex items-start text-sm p-2 rounded ${issue.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
                                        <span className="font-mono font-bold mr-2 whitespace-nowrap">[{issue.date}]</span>
                                        <span>{issue.message}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-100">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 bg-white text-slate-700 font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                        {hasErrors ? 'Cerrar y Corregir' : 'Cancelar'}
                    </button>
                    {!hasErrors && onContinue && (
                        <button 
                            onClick={onContinue} 
                            className="px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
                        >
                            Continuar de todos modos
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ValidationErrorsModal;
