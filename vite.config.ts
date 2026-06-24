import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { resolveViteServerOptions } from './server/devServerConfig';

export default defineConfig(() => {
  const server = resolveViteServerOptions();

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR can be disabled with DISABLE_HMR for scripted or resource-constrained local runs.
      ...server,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('motion')) return 'vendor-motion';
            if (id.includes('d3')) return 'vendor-d3';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return 'vendor';
          },
        },
      },
    },
  };
});
