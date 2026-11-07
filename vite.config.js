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
          if (id.includes('node_modules/three/addons')) return 'three-addons';
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('MultiplayerSystem') || id.includes('ChatSystem')) return 'multiplayer';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
        },
      },
    },
    // Asset inline limits: inline small assets to reduce HTTP requests
    assetsInlineLimit: 4096,
    // Warn when chunks exceed this size (in bytes)
    chunkSizeWarningLimit: 1000,
  },
});
