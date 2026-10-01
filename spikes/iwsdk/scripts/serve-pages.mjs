// Mimics GitHub Pages: static files under a project subpath, gzip, no SPA rewrites.
// Usage: node scripts/serve-pages.mjs <dir> [port] [basePath]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const [dir = 'dist', port = '4173', base = '/WhereShadowsWander/'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(base)) { res.writeHead(404).end('not under base'); return; }
  let p = normalize(join(dir, url.pathname.slice(base.length)));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); } catch { res.writeHead(404).end(); console.log('404', url.pathname); return; }
  const body = await readFile(p);
  const gz = /gzip/.test(req.headers['accept-encoding'] ?? '');
  res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
  res.end(gz ? gzipSync(body) : body);
}).listen(Number(port), () => console.log(`serving ${dir} at http://localhost:${port}${base}`));
