import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /<repo>/; dev and preview stay at /.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/med-school-planner/' : '/',
  server: { port: 5173 },
}));
