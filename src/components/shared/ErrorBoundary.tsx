import React, { Component, ErrorInfo, ReactNode } from 'react';
import logger from '../../utils/logger';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/**
 * ErrorBoundary - Captura errores de renderizado en React.
 * Evita la pantalla blanca catastrófica y registra el error.
 */
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        // Actualiza el estado para que el siguiente renderizado muestre la interfaz de repuesto
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Registra el error en nuestro logger centralizado
        logger.error('Error capturado por React ErrorBoundary', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
        });
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    color: '#111827',
                    fontFamily: 'sans-serif'
                }}>
                    <div style={{
                        backgroundColor: '#fee2e2',
                        padding: '1.5rem',
                        borderRadius: '0.75rem',
                        border: '1px solid #fecaca',
                        maxWidth: '500px'
                    }}>
                        <h2 style={{ color: '#b91c1c', marginTop: 0 }}>🚨 Algo salió mal</h2>
                        <p style={{ margin: '1rem 0' }}>
                            La aplicación ha encontrado un error inesperado durante el renderizado.
                        </p>
                        <div style={{
                            textAlign: 'left',
                            fontSize: '0.8rem',
                            backgroundColor: '#fff',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            overflowX: 'auto',
                            marginBottom: '1.5rem',
                            border: '1px solid #e5e7eb'
                        }}>
                            <code>{this.state.error?.message}</code>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Recargar aplicación
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
