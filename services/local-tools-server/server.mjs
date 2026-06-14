import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { createServer } from "node:http";

const root = resolve(new URL("../..", import.meta.url).pathname);
const port = Number(process.env.PORT || 5173);

const aliases = new Map([
  ["/", "index.html"],
  ["/dashboard", "outputs/watchalong-kit/dashboard.html"],
  ["/control", "outputs/watchalong-kit/control.html"],
  ["/overlay", "outputs/watchalong-kit/overlay.html"],
  ["/thumbnail", "outputs/watchalong-kit/thumbnail.html"],
  ["/trailer", "outputs/channel-trailer/trailer.html"],
  ["/shorts/ger-cur/preview", "outputs/shorts-recording/ger-cur/short-preview.html"],
  ["/shorts/ger-cur/key-battle", "outputs/shorts-recording/ger-cur/short-key-battle.html"],
  ["/shorts/ger-cur/explainer", "outputs/shorts-recording/ger-cur/short-explainer.html"]
]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".aiff": "audio/aiff",
  ".ics": "text/calendar; charset=utf-8",
  ".csv": "text/csv; charset=utf-8"
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const alias = aliases.get(clean);
  const relative = alias || clean.replace(/^\/+/, "");
  const full = resolve(root, relative);
  if (!full.startsWith(root)) return null;
  return full;
}

function notFound(res) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found\n");
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

async function serve(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, service: "kickoff-room-live-tools", port }, null, 2));
    return;
  }

  if (url.pathname === "/obs") {
    redirect(res, "/overlay");
    return;
  }

  const file = safePath(url.pathname);
  if (!file) {
    notFound(res);
    return;
  }

  try {
    const info = await stat(file);
    if (!info.isFile()) {
      notFound(res);
      return;
    }
  } catch {
    notFound(res);
    return;
  }

  res.writeHead(200, {
    "content-type": types[extname(file)] || "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  serve(req, res).catch((error) => {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error.message }, null, 2));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Kickoff Room tools server running at http://127.0.0.1:${port}`);
  console.log(`Dashboard: http://127.0.0.1:${port}/dashboard`);
  console.log(`OBS overlay: http://127.0.0.1:${port}/overlay`);
  console.log(`Producer control: http://127.0.0.1:${port}/control`);
  console.log(`Trailer: http://127.0.0.1:${port}/trailer`);
});
