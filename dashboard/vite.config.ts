import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Platform API
      '/api/platform': {
        target: 'http://localhost:8200',
        changeOrigin: true,
      },
      // Health endpoint
      '/health': {
        target: 'http://localhost:8200',
        changeOrigin: true,
      },
      // FixAI API (chat, conversations, organizations)
      '/api/v1': {
        target: 'http://localhost:8100',
        changeOrigin: true,
      },
    },
  },
})
