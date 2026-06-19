import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { createServer } from "node:http";
import { getLiveScore } from "../score/api-football.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const port = Number(process.env.PORT || 5173);
const runtimeDir = resolve(root, "outputs/runtime");
const liveStatePath = resolve(runtimeDir, "live-state.json");
const liveScorePollMs = Number(process.env.LIVE_SCORE_POLL_MS || 60000);

const aliases = new Map([
  ["/", "index.html"],
  ["/ops", "outputs/live-ops.html"],
  ["/rehearsal", "outputs/go-live-rehearsal.html"],
  ["/obs-setup", "outputs/obs-scene-setup.html"],
  ["/revenue", "outputs/revenue-ops.html"],
  ["/shorts-studio", "outputs/shorts-studio.html"],
  ["/channel-ops", "outputs/channel-ops.html"],
  ["/reminders", "outputs/reminder-ops.html"],
  ["/marathon", "outputs/marathon-ops.html"],
  ["/metrics", "outputs/metrics-ops.html"],
  ["/thumbnail-studio", "outputs/thumbnail-studio.html"],
  ["/animated-recap", "outputs/animated-recap-template.html"],
  ["/youtube-ops", "outputs/youtube-ops.html"],
  ["/studio-review", "outputs/studio-review.html"],
  ["/dashboard", "outputs/watchalong-kit/dashboard.html"],
  ["/readiness", "outputs/watchalong-kit/readiness.html"],
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

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function getLiveState() {
  try {
    const payload = JSON.parse(await readFile(liveStatePath, "utf8"));
    const ageMs = Date.now() - new Date(payload.updatedAt || 0).getTime();
    if (ageMs < liveScorePollMs) return payload;

    const presetId = payload.state?.presetId || "fra-sen";
    const live = await getLiveScore(presetId);
    if (!live.ok || !live.live) {
      const apiLimited = Boolean(live.errors?.requests);
      const stale = {
        ...payload,
        ok: true,
        updatedAt: new Date().toISOString(),
        state: {
          ...payload.state,
          dataStatus: live.ok ? "waiting" : "limited",
          dataMessage: apiLimited
            ? "Last verified score - live API limit reached"
            : live.message || "Live score temporarily unavailable",
          speakLine: apiLimited
            ? "Live score API limit reached. We are keeping the last verified score on screen."
            : payload.state?.speakLine,
          speakNonce: apiLimited ? Date.now() : payload.state?.speakNonce
        }
      };
      await mkdir(runtimeDir, { recursive: true });
      await writeFile(liveStatePath, JSON.stringify(stale, null, 2));
      return stale;
    }
    const preset = live.preset;
    const state = {
      ...payload.state,
      presetId: preset.id,
      home: preset.home,
      away: preset.away,
      homeShort: preset.homeShort,
      awayShort: preset.awayShort,
      homeColor: preset.homeColor,
      awayColor: preset.awayColor,
      topic: preset.topic,
      keyBattle: preset.keyBattle,
      gamePulse: preset.gamePulse,
      chatMission: preset.chatMission,
      pollHome: preset.pollHome,
      pollAway: preset.pollAway,
      homeScore: Number(live.homeScore || 0),
      awayScore: Number(live.awayScore || 0),
      seconds: Number(live.elapsed || 0) * 60,
      dataStatus: "live",
      dataMessage: `Verified live score at ${new Date(live.checkedAt || Date.now()).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST`,
      speakLine: live.commentaryLine || `Live score: ${preset.home} ${Number(live.homeScore || 0)}, ${preset.away} ${Number(live.awayScore || 0)}.`,
      speakNonce: Date.now()
    };
    const fresh = {
      ok: true,
      updatedAt: new Date().toISOString(),
      state
    };
    await mkdir(runtimeDir, { recursive: true });
    await writeFile(liveStatePath, JSON.stringify(fresh, null, 2));
    return fresh;
  } catch {
    return { ok: true, state: null, updatedAt: null };
  }
}

async function serve(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, service: "kickoff-room-live-tools", port }, null, 2));
    return;
  }

  if (url.pathname === "/obs") {
    redirect(res, "/overlay");
    return;
  }

  if (url.pathname === "/api/live-score") {
    const presetId = url.searchParams.get("presetId") || "fra-sen";
    const payload = await getLiveScore(presetId);
    json(res, payload.ok ? 200 : 503, payload);
    return;
  }

  if (url.pathname === "/api/live-state") {
    if (req.method === "GET") {
      json(res, 200, await getLiveState());
      return;
    }
    if (req.method === "POST") {
      const body = JSON.parse(await readBody(req) || "{}");
      const payload = {
        ok: true,
        updatedAt: new Date().toISOString(),
        state: body
      };
      await mkdir(runtimeDir, { recursive: true });
      await writeFile(liveStatePath, JSON.stringify(payload, null, 2));
      json(res, 200, payload);
      return;
    }
    json(res, 405, { ok: false, error: "Method not allowed" });
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
  console.log(`Readiness: http://127.0.0.1:${port}/readiness`);
  console.log(`OBS overlay: http://127.0.0.1:${port}/overlay`);
  console.log(`Producer control: http://127.0.0.1:${port}/control`);
  console.log(`Trailer: http://127.0.0.1:${port}/trailer`);
});
