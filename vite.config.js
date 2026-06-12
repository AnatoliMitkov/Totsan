import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'Public',
  server: { 
    port: 5173,
    // Only auto-open in development when not in Docker
    open: process.env.DOCKER ? false : true,
    // Host binding: set to '0.0.0.0' in Docker for external access, 'localhost' for local dev
    host: process.env.DOCKER ? '0.0.0.0' : 'localhost',
    // Optional: strict hostname checking for security in production
    strictPort: process.env.NODE_ENV === 'production',
  }
})
