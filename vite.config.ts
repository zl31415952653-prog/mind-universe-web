import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '心智宇宙 INFINITY',
        short_name: '心智宇宙',
        description: '个人认知外化与编码系统：七空、色卡、双链与关系图谱',
        lang: 'zh-CN',
        theme_color: '#070b1c',
        background_color: '#070b1c',
        display: 'standalone',
        start_url: '/universe',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // SPA 路由回退到应用壳；/api 不缓存（用户数据走 IndexedDB 与同步队列）
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  // 生产模式本地验证：npm run build && npm start 后，用 npm run preview 起 4173
  preview: { host: '0.0.0.0', port: 4173, proxy: { '/api': 'http://localhost:8787' } },
});
