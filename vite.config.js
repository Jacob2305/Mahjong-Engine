import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset paths relative so the built dist/ works when
// dropped onto Netlify (or opened from any subpath).
export default defineConfig({
  plugins: [react()],
  base: './',
  // onnxruntime-web loads its own WebAssembly; pre-bundling it breaks that.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
