/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['woodford-mark.svg', 'favicon.ico', '*.png'],
      manifest: {
        name: 'Minis Coach Assistant — Woodford RFC',
        short_name: 'Minis Coach',
        description: 'Match-day assistant for Woodford RFC U12',
        theme_color: '#3D0066',
        background_color: '#3D0066',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png',              sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',             sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',             sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png',   sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
