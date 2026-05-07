import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Production base path for stride.deped.gov.ph/insighted-siif/
  base: process.env.VITE_BASE_PATH || './',

  plugins: [react()],

  server: {
    port: 5174,
    proxy: {
      // Dev: proxy /api calls to the SIIF backend on port 3001
      '/api/siif': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
  }
});
