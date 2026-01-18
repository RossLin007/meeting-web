import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',  // 绑定到所有网络接口，允许外部访问
    port: 3000,
    allowedHosts: ['morning.829525.xyz', 'localhost', '0.0.0.0'],
    // Cloudflare Tunnel 兼容配置 - 禁用 HMR
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
