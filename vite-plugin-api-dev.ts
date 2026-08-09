import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as esbuild from 'esbuild';
import type { Plugin } from 'vite';

type VercelRes = ServerResponse & {
  status: (code: number) => VercelRes;
  json: (data: unknown) => VercelRes;
  send: (data: unknown) => VercelRes;
};

const cacheDir = path.join(os.tmpdir(), 'barber-booking-api-dev');
const buildCache = new Map<string, { mtimeMs: number; url: string }>();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function wrapResponse(res: ServerResponse): VercelRes {
  const vercelRes = res as VercelRes;

  vercelRes.status = (code: number) => {
    res.statusCode = code;
    return vercelRes;
  };

  vercelRes.json = (data: unknown) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(data));
    return vercelRes;
  };

  vercelRes.send = (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      return vercelRes.json(data);
    }
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    res.end(data == null ? '' : String(data));
    return vercelRes;
  };

  return vercelRes;
}

async function loadHandler(absEntry: string, rel: string) {
  const stat = fs.statSync(absEntry);
  const cached = buildCache.get(absEntry);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    const mod = await import(cached.url);
    return mod.default;
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const outfile = path.join(cacheDir, `${rel.replace(/[\\/]/g, '_')}.mjs`);

  await esbuild.build({
    entryPoints: [absEntry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    logLevel: 'silent',
  });

  const url = `${pathToFileURL(outfile).href}?t=${stat.mtimeMs}`;
  buildCache.set(absEntry, { mtimeMs: stat.mtimeMs, url });
  const mod = await import(url);
  return mod.default;
}

/**
 * Serve arquivos da pasta api/ no Vite (equivalente local ao vercel dev para /api/*).
 * Empacota com esbuild em %TEMP% para evitar lentidão/travamentos do OneDrive no SSR do Vite.
 */
export function vercelApiDevPlugin(): Plugin {
  return {
    name: 'vercel-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url || '/';
          const url = new URL(rawUrl, 'http://localhost');
          if (!url.pathname.startsWith('/api/')) {
            next();
            return;
          }

          const rel = url.pathname.replace(/^\//, '');
          if (rel.includes('_lib')) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: 'Not found' }));
            return;
          }

          const abs = path.resolve(server.config.root, `${rel}.ts`);
          if (!fs.existsSync(abs)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: `API não encontrada: /${rel}` }));
            return;
          }

          const rawBody = await readBody(req);
          let body: unknown = rawBody;
          const contentType = String(req.headers['content-type'] || '');
          if (contentType.includes('application/json')) {
            if (!rawBody) {
              body = {};
            } else {
              try {
                body = JSON.parse(rawBody);
              } catch {
                body = rawBody;
              }
            }
          }

          const vercelReq = req as IncomingMessage & {
            body?: unknown;
            query?: Record<string, string>;
          };
          vercelReq.body = body;
          vercelReq.query = Object.fromEntries(url.searchParams.entries());

          const handler = await loadHandler(abs, rel);
          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: 'Handler da API inválido' }));
            return;
          }

          await handler(vercelReq, wrapResponse(res));

          if (!res.writableEnded && !res.headersSent) {
            res.statusCode = 204;
            res.end();
          }
        } catch (err: any) {
          console.error('[api-dev]', err);
          const msg = String(err?.message || 'Erro na API local');
          const oneDriveHint = /cloud operation was unsuccessful|UNKNOWN: unknown error, read/i.test(msg)
            ? ' Arquivos da pasta api/ não estão disponíveis localmente no OneDrive. Clique com o botão direito na pasta do projeto → “Sempre manter neste dispositivo” e reinicie o npm run dev.'
            : '';
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: `${msg}${oneDriveHint}` }));
          }
        }
      });
    },
  };
}
