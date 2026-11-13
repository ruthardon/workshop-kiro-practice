import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Falla con un mensaje claro si el puerto está ocupado en lugar de saltar a otro.
    strictPort: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
