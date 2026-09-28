import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'

// Read version from package.json — single source of truth
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

const backendPort = process.env.SCHOOL_HEAD_PORT || process.env.PORT || 3000;
const backendTarget = `http://127.0.0.1:${backendPort}`;

const handleProxyError = (proxy, _options) => {
  proxy.on('error', (err, req, res) => {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      if (!res.headersSent) {
        console.warn(`\n⚠️ [Vite Proxy Error]: Backend server is offline or unreachable at ${backendTarget}.`);
        console.warn('  Setup Checklist:');
        console.warn('  1. Run `pnpm run dev` or `pnpm dev:sh` to start API + Web concurrently.');
        console.warn(`  2. Verify backend is running on ${backendTarget}.\n`);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Backend server offline', 
          message: 'Express backend is starting or offline. Please check terminal logs.',
          details: err.message 
        }));
      }
      return; // Suppress raw connection refusal stack trace in console
    }
    console.error('Proxy error:', err);
  });
};

export default defineConfig({
  base: process.env.VITE_BASE_PATH || (process.env.RENDER ? '/' : '/insighted-schoolhead/'),
  define: {
    // Exposes version to the app as import.meta.env.VITE_APP_VERSION
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: null,
      manifestFilename: 'manifest.json',
      devOptions: {
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html',
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'InsightEd1.png'],
      manifest: {
        name: 'InsightEd',
        short_name: 'InsightEd',
        description: 'School Data Capture Tool',
        theme_color: '#004A99',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'insighted_app.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'insighted_app.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
      workbox: {
        cacheId: 'insighted-v1.3.0'
      }
    })
  ],
  server: {
    proxy: {
      // Proxies for dev when BASE_URL = /insighted-schoolhead/ (matches what api() generates)
      '/insighted-schoolhead/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/insighted-schoolhead/, ''),
        configure: handleProxyError,
      },
      '/insighted-schoolhead/uploads': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/insighted-schoolhead/, ''),
        configure: handleProxyError,
      },
      // Bare /api fallback (for any direct calls without base prefix)
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
    },
  },
});
