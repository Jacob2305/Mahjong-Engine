import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Temporary: verifies the JS/JSX compiles without loading postcss.config.js,
// which cannot be read in this OneDrive-backed node_modules.
export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } },
  build: { outDir: 'dist-verify', emptyOutDir: true },
});
