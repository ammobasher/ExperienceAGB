import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const securityHeaders = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; worker-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function contained(root, file) {
  const path = relative(root, file);
  return !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`);
}

export function createPreviewHost({ root = resolve('dist'), base = '/' } = {}) {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error('Base must be a slash-delimited URL path.');
  return createServer(async (request, response) => {
    for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
    const fail = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      fail(405, 'Method not allowed');
      return;
    }
    let path;
    try {
      path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      fail(400, 'Invalid URL');
      return;
    }
    if (!path.startsWith(base) || path.includes('\\') || path.includes('\0')) {
      fail(404, 'Not found');
      return;
    }
    const file = resolve(root, path.slice(base.length) || 'index.html');
    if (!contained(root, file)) {
      fail(404, 'Not found');
      return;
    }
    try {
      const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);
      if (!contained(realRoot, realFile) || !(await stat(realFile)).isFile()) {
        fail(404, 'Not found');
        return;
      }
      const content = await readFile(realFile);
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(realFile)] ?? 'application/octet-stream',
        'Content-Length': content.length,
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') fail(404, 'Not found');
      else {
        console.error('Static host could not serve an asset.');
        fail(500, 'Asset unavailable');
      }
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.AGB_HOST_PORT ?? 5182);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid AGB_HOST_PORT.');
  const base = process.env.AGB_HOST_BASE ?? '/';
  const server = createPreviewHost({ base });
  server.on('error', () => {
    console.error('Static host failed to start.');
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`Preview host: http://127.0.0.1:${port}${base}`));
}
