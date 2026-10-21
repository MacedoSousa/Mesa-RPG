import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Cliente do Jogador: servido em "/" pelo Host. Em dev, o Vite faz proxy da API e do WebSocket.
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@mesa/shared': r('../shared/src/index.ts'),
      '@mesa/common': r('../client-common/src/index.ts'),
      // Código 3D (three.js) só é carregado quando a tela precisa
      '@mesa/3d': r('../client-common/src/hero3d'),
    },
  },
  server: {
    host: true, // acessível pelos celulares na rede local
    port: 5173,
    fs: { allow: [r('..')] },
    proxy: {
      '/api': 'http://localhost:3333',
      '/socket.io': { target: 'http://localhost:3333', ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
