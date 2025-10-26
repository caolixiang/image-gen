import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { r2DevMiddleware } from './server/r2-dev-server'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'r2-dev-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/')) {
            console.log('[R2 Dev] API request:', req.url)
            r2DevMiddleware()(req, res, next)
          } else {
            next()
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})


