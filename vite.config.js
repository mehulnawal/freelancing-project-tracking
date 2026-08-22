import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Freelance Business Manager',
        short_name: 'Freelance Manager',
        description: 'Private freelance business management system.',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
      },
    }),
  ],
})