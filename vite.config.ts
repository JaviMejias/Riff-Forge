import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
// @ts-ignore
import { alphaTab } from '@coderline/alphatab-vite/dist/alphaTab.vite.mjs';

export default defineConfig({
  optimizeDeps: {
    exclude: ['bungee-pitch-shift']
  },
  server: {
    allowedHosts: true
  },
  plugins: [
    tailwindcss(),
    react(),
    alphaTab(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'Riff Forge',
        short_name: 'RiffForge',
        description: 'Reproductor de partituras y tablaturas avanzado para músicos',
        theme_color: '#f59e0b', // amber-500
        background_color: '#09090b', // zinc-950
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 5000000 // 5MB to handle alphaTab wasm
      }
    })
  ],
})
