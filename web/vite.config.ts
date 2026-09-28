import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@compshopper/shared': path.resolve(__dirname, '../shared/src/index.ts') },
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname, '..')] },
    proxy: { '/api': { target: process.env.API_URL || 'http://localhost:3001', changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
