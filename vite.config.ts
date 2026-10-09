import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { vercelApiDevPlugin } from './vite-plugin-api-dev';

export default defineConfig(({ mode }) => {
  let env: Record<string, string> = {};
  try {
    env = loadEnv(mode, '.', '');
  } catch (err) {
    console.warn('[vite] loadEnv falhou (OneDrive/arquivo bloqueado?). Seguindo sem .env local.', err);
  }

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
    plugins: [
      react(),
      vercelApiDevPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        includeAssets: ['icone-dourado.png', 'pwa/apple-touch-icon.png'],
        manifest: {
          id: '/admin',
          name: 'Studio Riquelme — Painel Admin',
          short_name: 'SR Admin',
          description: 'Painel administrativo do Studio Riquelme',
          lang: 'pt-BR',
          dir: 'ltr',
          start_url: '/admin',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#0b0b0b',
          theme_color: '#0b0b0b',
          categories: ['business', 'productivity'],
          icons: [
            {
              src: '/pwa/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
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
