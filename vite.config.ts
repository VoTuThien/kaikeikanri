import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    // Hạ cú pháp JS cho Safari / iPhone cũ: three.js dùng "static {}" trong class (chỉ có từ iOS 16.4),
    // máy iOS 15 gặp lỗi cú pháp nên không tải được các trang mô hình 3D của app Trạng thái
    target: ['es2020', 'safari14', 'ios14'],
    // Thêm CSS dự phòng cho Safari / iPhone cũ (xem postcss.config.js)
    cssTarget: ['safari14', 'ios14'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Lưu sẵn cả ảnh (gồm icon 3D trong public/icons3d) để app dùng được khi mất mạng
        globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
        // Bộ đọc chữ hoá đơn (Tesseract.js, ~13MB) không tải sẵn khi cài app: chỉ tải lần đầu mở màn hình Đọc hoá đơn,
        // rồi lưu lại trong máy (CacheFirst) để lần sau đọc được cả khi mất mạng
        globIgnores: ['tesseract/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/tesseract/'),
            handler: 'CacheFirst',
            options: { cacheName: 'tesseract', expiration: { maxEntries: 10 } },
          },
        ],
      },
      includeAssets: ['apple-touch-icon-v2.png', 'icon-v2.svg'],
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
          { src: 'icon-192-v2.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512-v2.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
