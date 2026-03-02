import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import { queryClient } from './lib/queryClient';
import ErrorBoundary from './components/shared/ErrorBoundary';
import logger from './utils/logger';

// --- CAPA 1: Captura de Errores Globales (Fuera de React) ---

// Errores de JavaScript no capturados (síncronos/asíncronos)
window.addEventListener('error', (event) => {
  logger.error('Error de JavaScript global detectado', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack || event.error
  });
});

// Promesas rechazadas sin bloque .catch()
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Promesa rechazada no capturada (unhandledrejection)', {
    reason: event.reason?.message || event.reason,
    stack: event.reason?.stack
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  logger.critical("No se pudo encontrar el elemento root para montar la aplicación");
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

