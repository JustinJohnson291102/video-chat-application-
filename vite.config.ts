import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://your-backend-url.com', // **✅ Backend API URL replace karo**
        changeOrigin: true,
        secure: true,
      },
    },
    strictPort: true,
    host: '0.0.0.0', // **✅ Mobile access ensure karega**
    https: true, // **✅ Ensure HTTPS requests**
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false, // **✅ Disable sourcemaps for better performance**
  },
});
