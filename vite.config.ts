import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    allowedHosts: ['127.0.0.1'],
    proxy: { '/api/ai': { target: 'http://127.0.0.1:5183', changeOrigin: true } },
  },
  test: {
    exclude: ['e2e/**', 'scripts/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});