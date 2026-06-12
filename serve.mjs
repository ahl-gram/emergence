import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT) || 4173;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".map": "application/json",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const rel = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const path = normalize(join(root, rel));
    if (!path.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch (err) {
    if (err?.code === "ENOENT" || err?.code === "EISDIR") {
      res.writeHead(404).end("not found");
    } else {
      console.error(err);
      res.writeHead(500).end("server error");
    }
  }
});

server.listen(port, () => {
  console.log(`Emergence running at http://localhost:${port}`);
});
