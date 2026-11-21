import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.png'],
      manifest: {
        name: 'NotesMaxxing',
        short_name: 'NotesMaxxing',
        description: 'Local-first dark-mode PDF study and annotation workspace',
        theme_color: '#0C0C0E',
        background_color: '#0C0C0E',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/app-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/app-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mjs,wasm}'],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
});
