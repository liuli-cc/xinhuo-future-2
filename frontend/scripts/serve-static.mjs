import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";

const root = resolve("out");
const port = Number(process.env.PORT || 3000);
const mime = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2",
};

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
  });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Xinhuo static preview: http://127.0.0.1:${port}\n`);
});
