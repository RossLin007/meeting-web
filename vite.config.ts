import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 请求日志插件 - 打印所有请求
function requestLogger(): Plugin {
  return {
    name: 'request-logger',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // 只打印 /api 相关请求
        if (req.url?.startsWith('/api')) {
          const start = Date.now();
          res.on('finish', () => {
            const duration = Date.now() - start;
            const statusColor = res.statusCode >= 400 ? '🔴' : '🟢';
            console.log(`${statusColor} [${new Date().toLocaleTimeString()}] ${res.statusCode} ${req.method} ${req.url} (${duration}ms)`);
          });
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), requestLogger()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['morning.829525.xyz', 'localhost', '0.0.0.0'],
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
