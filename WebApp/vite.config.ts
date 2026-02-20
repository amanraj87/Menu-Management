import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Menu Management',
        short_name: 'Menu',
        description: 'Admin & Vendor menu and orders',
        theme_color: '#0f0f12',
        background_color: '#0f0f12',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
