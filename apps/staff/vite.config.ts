import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Build stamp for the update/version diagnostic (evaluated at build time in Node).
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  optimizeDeps: {
    exclude: ['@powersync/web', '@journeyapps/wa-sqlite'],
    include: ['@powersync/web > js-logger'],
  },
  worker: {
    format: 'es',
  },
  plugins: [
    react(),
    VitePWA({
      // autoUpdate installs + reloads a new build automatically. The missing
      // piece (fixed by SWUpdater) is that the update *check* never fires on a
      // long-open standalone PWA — so a stale build could serve for days.
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,wasm}'],
        // Only the plain sync wa-sqlite build is ever loaded at runtime
        // (OPFSCoopSyncVFS, no encryption — confirmed by capturing runtime
        // requests). The mc-/async variants are ~6.3MB of dead precache weight
        // re-downloaded on every dependency bump over guesthouse wifi.
        globIgnores: ['**/mc-wa-sqlite*', '**/wa-sqlite-async-*'],
        runtimeCaching: [
          {
            // Cache Google Fonts so the brand fonts survive offline and never
            // re-fetch after the first visit. CSS: SWR so updates still flow;
            // font binaries: CacheFirst (immutable; 0 allows opaque responses).
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'KRAFT BASE Staff',
        short_name: 'KB Staff',
        description: 'KRAFT BASE スタッフ向けアプリ',
        lang: 'ja',
        theme_color: '#2d4a3e',
        background_color: '#fdfbf6',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
