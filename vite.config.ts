import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Lưu sẵn cả ảnh (gồm icon 3D trong public/icons3d) để app dùng được khi mất mạng
        globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
      },
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Quản lý quỹ',
        short_name: 'Quỹ',
        description: 'Quản lý các nhóm quỹ cá nhân',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        background_color: '#1e1b4b',
        theme_color: '#1e1b4b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
