import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3090',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        login: path.resolve(__dirname, 'login.html'),
        viewer: path.resolve(__dirname, 'viewer.html'),
        view: path.resolve(__dirname, 'view.html'),
      }
    }
  }
});
