import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const streamId = process.env.STREAM_ID || process.argv[2] || "fra-sen";
const root = resolve(new URL("../..", import.meta.url).pathname);
const upcomingPath = resolve(root, "outputs/youtube-upcoming-broadcasts.json");
const logsDir = resolve(root, "outputs/runtime");
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const overlayUrl = process.env.OVERLAY_URL || "http://127.0.0.1:5174/overlay";
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9333);
const captureFps = Number(process.env.OVERLAY_CAPTURE_FPS || 2);
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function requireEnv() {
  const missing = [
    ["YOUTUBE_CLIENT_ID", clientId],
    ["YOUTUBE_CLIENT_SECRET", clientSecret],
    ["YOUTUBE_REFRESH_TOKEN", refreshToken]
  ].filter(([, value]) => !value);
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.map(([key]) => key).join(", ")}`);
    process.exit(1);
  }
}

async function accessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload, null, 2));
  return payload.access_token;
}

async function youtubeJson(token, url) {
  const response = await fetch(url, {
    headers: { "authorization": `Bearer ${token}` }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload, null, 2));
  return payload;
}

async function getBroadcast(token, broadcastId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
  url.searchParams.set("part", "id,status,contentDetails");
  url.searchParams.set("id", broadcastId);
  const payload = await youtubeJson(token, url);
  const item = payload.items?.[0];
  if (!item) throw new Error(`Broadcast not found: ${broadcastId}`);
  return item;
}

async function getLiveStream(token, liveStreamId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveStreams");
  url.searchParams.set("part", "id,status,cdn");
  url.searchParams.set("id", liveStreamId);
  const payload = await youtubeJson(token, url);
  const item = payload.items?.[0];
  if (!item) throw new Error(`Live stream not found: ${liveStreamId}`);
  return item;
}

function rtmpUrl(stream) {
  const info = stream.cdn?.ingestionInfo;
  if (!info?.ingestionAddress || !info?.streamName) throw new Error("YouTube ingestion details are missing.");
  return `${info.ingestionAddress}/${info.streamName}`;
}

async function waitForChrome() {
  const listUrl = `http://127.0.0.1:${debugPort}/json/list`;
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(listUrl);
      if (response.ok) {
        const tabs = await response.json();
        const tab = tabs.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
        if (tab) return tab;
      }
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Chrome remote debugging did not start in time.");
}

function createCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    if (message.error) item.reject(new Error(JSON.stringify(message.error)));
    else item.resolve(message.result || {});
  });

  function send(method, params = {}) {
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveSend, reject) => pending.set(id, { resolve: resolveSend, reject }));
  }

  return new Promise((resolveSocket, reject) => {
    socket.addEventListener("open", () => resolveSocket({ send, socket }));
    socket.addEventListener("error", () => reject(new Error("Chrome DevTools websocket failed.")));
  });
}

async function main() {
  requireEnv();
  await mkdir(logsDir, { recursive: true });
  const upcoming = JSON.parse(await readFile(upcomingPath, "utf8"));
  const target = (upcoming.matches || []).find((item) => item.id === streamId || item.youtubeBroadcastId === streamId);
  if (!target?.youtubeBroadcastId) throw new Error(`No created YouTube broadcast found for target: ${streamId}`);

  const token = await accessToken();
  const broadcast = await getBroadcast(token, target.youtubeBroadcastId);
  const liveStream = await getLiveStream(token, broadcast.contentDetails?.boundStreamId);
  const outputUrl = rtmpUrl(liveStream);
  const logPath = resolve(logsDir, `youtube-overlay-stream-${target.id}.log`);
  const pidPath = resolve(logsDir, `youtube-overlay-stream-${target.id}.pid`);
  const chromeUserData = resolve(logsDir, `chrome-overlay-${target.id}-${runId}`);
  const logFd = openSync(logPath, "a");

  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeUserData}`,
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=1280,720",
    "--hide-scrollbars",
    overlayUrl
  ], { detached: true, stdio: ["ignore", logFd, logFd] });
  chrome.unref();

  const tab = await waitForChrome();
  const cdp = await createCdp(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });
  await cdp.send("Page.navigate", { url: overlayUrl });
  await new Promise((resolveWait) => setTimeout(resolveWait, 2500));
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", windowsVirtualKeyCode: 32, code: "Space", key: " " });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 32, code: "Space", key: " " });

  const ffmpeg = spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel", "warning",
    "-f", "image2pipe",
    "-framerate", String(captureFps),
    "-i", "pipe:0",
    "-f", "lavfi",
    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-b:v", "2500k",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-pix_fmt", "yuv420p",
    "-g", "60",
    "-r", "30",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-f", "flv",
    outputUrl
  ], { detached: true, stdio: ["pipe", logFd, logFd] });
  ffmpeg.unref();
  closeSync(logFd);

  const intervalMs = Math.max(250, Math.round(1000 / captureFps));
  const capture = async () => {
    try {
      const result = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false
      });
      ffmpeg.stdin.write(Buffer.from(result.data, "base64"));
    } catch {
      // Keep the parent alive unless ffmpeg exits.
    }
  };
  const timer = setInterval(capture, intervalMs);
  ffmpeg.on("exit", () => {
    clearInterval(timer);
    cdp.socket.close();
  });
  await capture();

  await writeFile(pidPath, JSON.stringify({
    ffmpegPid: ffmpeg.pid,
    chromePid: chrome.pid,
    startedAt: new Date().toISOString()
  }, null, 2));
  console.log(JSON.stringify({
    started: true,
    id: target.id,
    match: target.match,
    youtubeBroadcastId: target.youtubeBroadcastId,
    ffmpegPid: ffmpeg.pid,
    chromePid: chrome.pid,
    captureFps,
    overlayUrl,
    streamStatusBefore: liveStream.status?.streamStatus || "unknown",
    healthBefore: liveStream.status?.healthStatus?.status || "unknown",
    logPath,
    pidPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
