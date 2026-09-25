import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API and sockets are proxied so the SPA and API share one origin in
// development, which the SameSite=Strict refresh cookie relies on (LLD §4.2).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
