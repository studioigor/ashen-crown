import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ashen-crown/',
  server: { port: 5173, open: false },
  build: {
    target: 'es2020',
    outDir: 'docs',
  },
});
