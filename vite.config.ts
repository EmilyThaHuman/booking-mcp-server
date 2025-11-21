import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: './',
  build: {
    outDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'booking-search-results': resolve(__dirname, 'src/components/booking-search-results.html'),
        'preview': resolve(__dirname, 'src/dev/preview.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.html')) {
            return '[name][extname]';
          }
          return '[name]-[hash][extname]';
        }
      }
    }
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: resolve(__dirname, 'src')
      },
      // Intercept use-widget-props imports and redirect to mock in dev mode
      {
        find: /^(.*)\/hooks\/use-widget-props$/,
        replacement: resolve(__dirname, 'src/hooks/use-widget-props.mock.ts')
      }
    ]
  },
  server: {
    port: 5173,
    open: '/src/dev/preview.html',
  }
});
