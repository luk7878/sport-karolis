import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.avif':'image/avif', '.woff2':'font/woff2', '.pdf':'application/pdf' };
const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, {Allow:'GET, HEAD'}).end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  let file = resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end('Forbidden'); return; }
  try {
    let info = await stat(file);
    if (info.isDirectory()) { if (!pathname.endsWith('/')) { res.writeHead(301,{Location:pathname+'/'+new URL(req.url || '/', 'http://localhost').search}).end(); return; } file=resolve(file,'index.html'); info=await stat(file); }
    if (!info.isFile()) throw new Error('Not a file');
    const body = req.method === 'HEAD' ? null : await readFile(file);
    const cache = file.includes(sep+'assets'+sep) ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, {'Content-Type':mime[extname(file).toLowerCase()] || 'application/octet-stream','Content-Length':info.size,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':cache});
    res.end(body);
  } catch { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Not found'); }
});
const port=Number(process.env.PORT || 4173);
server.listen(port,'0.0.0.0',()=>console.log(`LETS listening on port ${port}`));
