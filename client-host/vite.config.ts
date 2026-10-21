import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// HUD do Mestre: servido em "/host" pelo Host. Em dev, o Vite faz proxy da API e do WebSocket.
export default defineConfig({
  base: '/host/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@mesa/shared': r('../shared/src/index.ts'),
      '@mesa/common': r('../client-common/src/index.ts'),
    },
  },
  server: {
    host: true, // acessível pelos celulares na rede local
    port: 5174,
    fs: { allow: [r('..')] },
    proxy: {
      '/api': 'http://localhost:3333',
      '/socket.io': { target: 'http://localhost:3333', ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
