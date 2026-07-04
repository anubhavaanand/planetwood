import { defineConfig } from 'vite';

export default defineConfig({
  base: '/planetwood/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('MultiplayerSystem') || id.includes('ChatSystem')) return 'multiplayer';
        },
      },
    },
  },
});
