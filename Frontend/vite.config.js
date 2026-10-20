// Vite config: registers React plugin for the frontend build.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 650,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'react'

          if (id.includes('@dnd-kit')) return 'dnd'

          if (
            id.includes('node_modules/axios') ||
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/react-hot-toast')
          ) {
            return 'vendor'
          }
        }
      }
    }
  },

  test: {
    environment: 'jsdom',
    globals: true
  },

  server: {
    port: 5173
  }
}))

export default config
