import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // ngrok serves the app from a random *.ngrok-free.app host; Vite blocks
    // unknown Host headers by default.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    // Keeps the whole app on ONE origin: the browser calls /api on the tunnel,
    // Vite forwards it to the backend server-side, so backend CORS never sees
    // a cross-origin request.
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
})
