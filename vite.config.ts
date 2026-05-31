import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  resolve: {
    alias: {
      '@': resolve('src/renderer'),
      '@shared': resolve('src/shared')
    }
  },
  build: {
    outDir: '../../out/renderer',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '^/api/': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true
      }
    }
  }
})
