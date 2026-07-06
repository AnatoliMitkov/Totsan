import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const remoteDevHostFile = path.resolve('outputs/remote-dev/current-host.txt')
const remoteDevHost = process.env.VITE_REMOTE_DEV_HOST || (
  fs.existsSync(remoteDevHostFile)
    ? fs.readFileSync(remoteDevHostFile, 'utf8').trim()
    : ''
)
const isRemoteDev = Boolean(remoteDevHost)

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
    allowedHosts: isRemoteDev ? [remoteDevHost] : undefined,
    hmr: isRemoteDev
      ? {
          protocol: 'wss',
          host: remoteDevHost,
          clientPort: 443,
        }
      : undefined,
  }
})
