import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import * as alphaTabVite from '@coderline/alphatab-vite'

const alphaTab = (alphaTabVite as any).alphaTab || (alphaTabVite as any).default?.alphaTab || alphaTabVite.default || alphaTabVite;

export default defineConfig({
  optimizeDeps: {
    exclude: ['bungee-pitch-shift', '@coderline/alphatab']
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://146.181.32.238:3001',
        changeOrigin: true,
      },
      '/downloads': {
        target: 'http://146.181.32.238:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://146.181.32.238:3001',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://146.181.32.238:3001',
        changeOrigin: true,
      }
    }
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
        display: 'fullscreen',
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
