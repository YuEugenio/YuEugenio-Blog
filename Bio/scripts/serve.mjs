import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = process.argv.includes('--dist') ? resolve(project, 'dist') : project;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.vert': 'text/plain', '.frag': 'text/plain', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 5173);
createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') pathname = '/index.html';
    if (root === project && pathname.startsWith('/assets/')) pathname = '/public' + pathname;
    if (pathname !== '/index.html' && !pathname.startsWith('/src/') && !pathname.startsWith(root === project ? '/public/assets/' : '/assets/')) {
      response.writeHead(404).end('Not found'); return;
    }
    const path = resolve(root, '.' + pathname);
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(await readFile(path));
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`BioYu ready: http://localhost:${port}`));
