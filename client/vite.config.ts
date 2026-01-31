import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    
    plugins: [react()],
    server: {
        host: true,
        allowedHosts: ['retro.twibox.fr', 'localhost'],
        proxy: {
            '/socket.io': {
                target: 'http://retrospective-server-1:3001',
                ws: true,
                changeOrigin: true
            },
            '/api': {
                target: 'http://retrospective-server-1:3001',
                changeOrigin: true
            }
        }
    }
})
