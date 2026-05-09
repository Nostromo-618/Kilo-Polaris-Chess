import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.argv[2]) || 3000;
const host = "127.0.0.1";
const root = resolve(process.argv[3] || process.cwd());

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const safePath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const requested = resolve(join(root, safePath));
  if (!requested.startsWith(root)) return null;
  try {
    const stat = statSync(requested);
    return stat.isDirectory() ? join(requested, "index.html") : requested;
  } catch {
    return null;
  }
}

const server = createServer((req, res) => {
  const filePath = resolveRequestPath(req.url || "/");
  if (!filePath) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const type = MIME_TYPES[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, {
    "content-type": type,
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  const script = fileURLToPath(import.meta.url);
  console.log(`Static server ${script} listening on http://${host}:${port}`);
});
