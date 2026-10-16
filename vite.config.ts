import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// One id per build. The app compares it with dist/version.json to notice a newer deploy.
const BUILD = process.env.GITHUB_SHA ?? String(Date.now());

function buildVersion(): Plugin {
  return {
    name: 'build-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
    },
  };
}

// Relays SIS Course Search API calls for local use: SIS doesn't accept requests
// from web pages, so the browser calls /sis-api/... on the local server instead.
const sisProxy = {
  '/sis-api': { target: 'https://sis.jhu.edu', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/sis-api/, '/api') },
};

// GitHub Pages serves the site from /<repo>/; dev and preview stay at /.
export default defineConfig(({ command }) => ({
  plugins: [react(), buildVersion()],
  base: command === 'build' ? '/med-school-planner/' : '/',
  define: { __BUILD__: JSON.stringify(BUILD) },
  server: { port: 5173, proxy: sisProxy },
}));
