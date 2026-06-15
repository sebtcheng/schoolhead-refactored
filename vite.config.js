import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'

// Read version from package.json — single source of truth
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

const handleProxyError = (proxy, _options) => {
  proxy.on('error', (err, req, res) => {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway: Backend server is starting or offline.');
      }
      return; // Suppress connection refusal stack trace in console
    }
    console.error('Proxy error:', err);
  });
};

export default defineConfig({
  base: '/insighted-schoolhead/',
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
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/insighted-schoolhead/, ''),
        configure: handleProxyError,
      },
      '/insighted-schoolhead/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/insighted-schoolhead/, ''),
        configure: handleProxyError,
      },
      // Bare /api fallback (for any direct calls without base prefix)
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
    },
  },
});