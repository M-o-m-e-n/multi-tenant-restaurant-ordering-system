import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API and sockets are proxied so the SPA and API share one origin in
// development, which the SameSite=Strict refresh cookie relies on (LLD §4.2).
// API_TARGET lets a second stack (the E2E run) proxy to its own API port;
// `vite preview` inherits this proxy.
const api = process.env.API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': api,
      '/health': api,
      '/socket.io': { target: api, ws: true },
    },
  },
});
