import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'all-draw', short_name: 'all-draw', description: 'Diagramador universal: un modelo, muchas notaciones.',
        lang: 'es', theme_color: '#2563eb', background_color: '#f6f7f9', display: 'standalone', start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, globPatterns: ['**/*.{js,css,html,svg,woff2}'], navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/ws\//, /^\/healthz/] },
    }),
  ],
  server: { host: '127.0.0.1', port: 4173, strictPort: false },
  preview: { host: '127.0.0.1', port: 4174 },
});
