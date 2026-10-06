import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { vercelApiDevPlugin } from './vite-plugin-api-dev';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Expõe variáveis do .env para os handlers da pasta api/ em desenvolvimento.
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      watch: {
        ignored: ['**/node_modules.onedrive.bak/**', '**/node_modules/**'],
      },
      fs: {
        deny: ['**/node_modules.onedrive.bak/**'],
      },
    },
    optimizeDeps: {
      // Evita o Vite escanear HTML dentro de backups OneDrive em node_modules*.
      entries: ['index.html'],
    },
    plugins: [react(), vercelApiDevPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
