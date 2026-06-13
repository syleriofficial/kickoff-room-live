import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const port = Number(process.env.PORT || 8080);
const root = resolve(new URL("../..", import.meta.url).pathname);
const streamsPath = resolve(root, "outputs/generated-stream-pack/streams.json");

function json(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  res.end(`${body}\n`);
}

function text(res, status, body) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  res.end(body);
}

async function streams() {
  return JSON.parse(await readFile(streamsPath, "utf8"));
}

function scoreMatch(item) {
  const lower = `${item.id} ${item.home} ${item.away}`.toLowerCase();
  return lower;
}

function publicStream(item) {
  return {
    id: item.id,
    match: `${item.home} vs ${item.away}`,
    home: item.home,
    away: item.away,
    kickoffIst: item.kickoffIst,
    title: item.youtubeTitle,
    description: item.description,
    pinnedChat: item.pinnedChat,
    firstMinuteScript: item.firstMinuteScript,
    shortsIdeas: item.shortsIdeas,
    topic: item.topic,
    keyBattle: item.keyBattle,
    gamePulse: item.gamePulse,
    chatMission: item.chatMission
  };
}

async function handle(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    res.end();
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  if (path === "/" || path === "/health") {
    json(res, 200, {
      ok: true,
      service: "kickoff-room-live-automation-api",
      routes: ["/streams", "/next", "/stream/:id", "/search?q=term"]
    });
    return;
  }

  const items = await streams();

  if (path === "/streams") {
    json(res, 200, { count: items.length, streams: items.map(publicStream) });
    return;
  }

  if (path === "/next") {
    json(res, 200, publicStream(items[0]));
    return;
  }

  if (path.startsWith("/stream/")) {
    const id = decodeURIComponent(path.replace("/stream/", ""));
    const item = items.find((stream) => stream.id === id);
    if (!item) {
      json(res, 404, { error: "Stream not found", id });
      return;
    }
    json(res, 200, publicStream(item));
    return;
  }

  if (path === "/search") {
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    if (!query) {
      json(res, 400, { error: "Missing q query parameter" });
      return;
    }
    const results = items.filter((item) => scoreMatch(item).includes(query)).map(publicStream);
    json(res, 200, { query, count: results.length, streams: results });
    return;
  }

  text(res, 404, "Not found\n");
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    json(res, 500, { error: "Internal server error", detail: error.message });
  });
});

server.listen(port, () => {
  console.log(`Automation API listening on ${port}`);
});
