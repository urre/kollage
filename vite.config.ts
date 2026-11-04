import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the repo at /kollage/, not at the domain root. Set in
  // dev too, so a path only works here if it works in production.
  base: '/kollage/',
  // 5173 is usually taken by another project on this machine.
  server: { port: 5180 },
})
