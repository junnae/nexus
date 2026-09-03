import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // index.html at project root (Vite convention); public/ holds runtime-fetched
  // static assets (word images, lang/<code>/... data+audio) copied verbatim to dist/.
  base: './', // CRITICAL: relative paths for file:// protocol (Curious Reader offline compliance)
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    outDir: 'dist',
    sourcemap: false, // no .map files in ZIPs
    minify: 'terser',
  },
})
