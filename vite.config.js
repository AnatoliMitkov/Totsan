import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'Public',
  server: { 
    port: 5173,
    // Only auto-open in development when not in Docker
    open: process.env.DOCKER ? false : true,
    // Bind to all interfaces so devices on the local network can reach the dev server
    host: true,
    // Optional: strict hostname checking for security in production
    strictPort: process.env.NODE_ENV === 'production',
  }
})
