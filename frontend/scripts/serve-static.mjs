import { createReadStream, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { extname, join, normalize, relative, resolve } from "node:path";

const root = resolve("out");
const port = Number(process.env.PORT || 3000);
const upstream = process.env.API_UPSTREAM ? new URL(process.env.API_UPSTREAM) : null;
if (upstream && (!['http:', 'https:'].includes(upstream.protocol) || upstream.username || upstream.password)) {
  throw new Error("API_UPSTREAM must be an HTTP(S) origin without credentials");
}
const mime = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2",
  ".wasm": "application/wasm", ".mjs": "text/javascript; charset=utf-8",
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};

function proxyApi(request, response) {
  if (!upstream) {
    response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "预览接口尚未启动" }));
    return;
  }
  const target = new URL(request.url, upstream);
  // Only the configured upstream receives API requests, including path-like URLs.
  target.protocol = upstream.protocol;
  target.host = upstream.host;
  const headers = { ...request.headers, host: upstream.host };
  delete headers.connection;
  delete headers['proxy-authorization'];
  const outgoing = (upstream.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
    method: request.method, headers,
  }, incoming => {
    const forwarded = { ...incoming.headers };
    delete forwarded.connection;
    response.writeHead(incoming.statusCode || 502, forwarded);
    incoming.pipe(response);
    incoming.on('error', () => response.destroy());
  });
  outgoing.setTimeout(120_000, () => outgoing.destroy(new Error('Upstream timeout')));
  outgoing.on('error', () => {
    if (response.headersSent) return response.destroy();
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: '服务暂时不可用，请稍后重试' }));
  });
  let bytes = 0;
  request.on('data', chunk => {
    bytes += chunk.length;
    if (bytes > 16 * 1024 * 1024) {
      response.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: '文件过大' }));
      outgoing.destroy();
      request.destroy();
    }
  });
  request.on('aborted', () => outgoing.destroy());
  response.on('close', () => { if (!response.writableEnded) outgoing.destroy(); });
  request.pipe(outgoing);
}

function resolvePage(rawUrl) {
  const pathname = decodeURIComponent(new URL(rawUrl, "http://localhost").pathname);
  const safe = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[/\\]+/, "");
  const candidates = safe
    ? [join(root, safe), join(root, `${safe}.html`), join(root, safe, "index.html")]
    : [join(root, "index.html")];
  return candidates.find(candidate => {
    const pathFromRoot = relative(root, candidate);
    if (pathFromRoot.startsWith("..") || pathFromRoot.startsWith("/") || pathFromRoot.startsWith("\\")) return false;
    return (() => {
    try { return statSync(candidate).isFile(); } catch { return false; }
    })();
  });
}

createServer((request, response) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  if (pathname.startsWith('/api/') || pathname === '/health/ready') {
    return proxyApi(request, response);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end();
  }
  let file;
  try { file = resolvePage(request.url || "/"); } catch { file = undefined; }
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
    return;
  }
  response.writeHead(200, {
    "Content-Type": mime[extname(file).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": file.includes('/_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (request.method === 'HEAD') return response.end();
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Xinhuo static preview: http://127.0.0.1:${port}\n`);
});
