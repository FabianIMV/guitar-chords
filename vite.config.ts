import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Project site on GitHub Pages is served from /<repo>/
const base = '/guitar-chords/'

export default defineConfig({
  base,
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-180.png'],
      manifest: {
        name: 'Acordes',
        short_name: 'Acordes',
        description: 'Busca acordes y letras de cualquier canción, sin publicidad.',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        lang: 'es',
        categories: ['music', 'entertainment'],
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Don't cache cross-origin scraping responses; only the app shell.
        navigateFallback: base + 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Apply new versions immediately so deploys aren't stuck behind an old
        // cached service worker.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Artist pictures in result lists: cache them so lists look right offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/akamai\.sscdn\.co\/.*\.(?:jpg|jpeg|png|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'artist-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
})
