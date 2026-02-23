import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  loadEnv(mode, '.', '');
  return {
    publicDir: 'public',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/erp': {
          target: 'http://10.0.0.19:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/erp/, ''),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
