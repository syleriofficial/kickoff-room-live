import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const upcomingPath = resolve(root, "outputs/youtube-upcoming-broadcasts.json");
const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const streamId = process.env.STREAM_ID || process.argv[2] || "";
const leadSeconds = Math.max(0, Number(process.env.GO_LIVE_LEAD_SECONDS || 300));
const port = Number(process.env.PORT || 5174);
const commentaryAudioPath = process.env.COMMENTARY_AUDIO_PATH || "outputs/runtime/live-commentary.aiff";
const transitionToLive = process.env.YOUTUBE_TRANSITION_LIVE !== "false";
const autoWait = process.env.GO_LIVE_WAIT !== "false";
const children = new Set();

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

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function spawnManaged(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit"
  });
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}

function stopChildren() {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // Already gone.
    }
  }
}

process.on("SIGINT", () => {
  stopChildren();
  process.exit(130);
});

process.on("SIGTERM", () => {
  stopChildren();
  process.exit(143);
});

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

async function youtubeJson(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload, null, 2));
  return payload;
}

async function getStreamStatus(token, boundStreamId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveStreams");
  url.searchParams.set("part", "id,status");
  url.searchParams.set("id", boundStreamId);
  const payload = await youtubeJson(token, url);
  return payload.items?.[0]?.status || {};
}

async function getBroadcast(token, broadcastId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
  url.searchParams.set("part", "id,status,contentDetails,snippet");
  url.searchParams.set("id", broadcastId);
  const payload = await youtubeJson(token, url);
  const item = payload.items?.[0];
  if (!item) throw new Error(`Broadcast not found: ${broadcastId}`);
  return item;
}

async function transition(token, broadcastId, status) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts/transition");
  url.searchParams.set("part", "id,status");
  url.searchParams.set("id", broadcastId);
  url.searchParams.set("broadcastStatus", status);
  return youtubeJson(token, url, {
    method: "POST"
  });
}

async function selectTarget() {
  const upcoming = JSON.parse(await readFile(upcomingPath, "utf8"));
  const matches = upcoming.matches || [];
  if (streamId) {
    const target = matches.find((item) => item.id === streamId || item.youtubeBroadcastId === streamId);
    if (!target) throw new Error(`No upcoming broadcast found for ${streamId}`);
    return target;
  }
  const now = Date.now();
  const target = matches
    .filter((item) => new Date(item.goLiveUtc).getTime() + 3 * 60 * 60 * 1000 > now)
    .sort((a, b) => new Date(a.goLiveUtc) - new Date(b.goLiveUtc))[0];
  if (!target) throw new Error("No upcoming broadcast found.");
  return target;
}

async function waitUntilLead(target) {
  const startAt = new Date(target.goLiveUtc).getTime() - leadSeconds * 1000;
  const waitMs = startAt - Date.now();
  if (!autoWait || waitMs <= 0) return;
  console.log(JSON.stringify({
    waiting: true,
    id: target.id,
    match: target.match,
    startAt: new Date(startAt).toISOString(),
    waitMinutes: Math.round(waitMs / 60000)
  }, null, 2));
  await sleep(waitMs);
}

async function waitForIngest(token, boundStreamId) {
  for (let i = 1; i <= 36; i += 1) {
    const status = await getStreamStatus(token, boundStreamId);
    console.log(JSON.stringify({
      ingestAttempt: i,
      streamStatus: status.streamStatus || "unknown",
      health: status.healthStatus?.status || "unknown",
      issues: status.healthStatus?.configurationIssues || []
    }, null, 2));
    if (status.streamStatus === "active") return status;
    await sleep(5000);
  }
  throw new Error("YouTube ingest did not become active in time.");
}

requireEnv();

try {
  const target = await selectTarget();
  await waitUntilLead(target);

  console.log(`Starting local tools server for ${target.match}`);
  spawnManaged("npm", ["run", "start:tools"], { PORT: String(port) });
  await sleep(2500);

  console.log(`Starting overlay encoder for ${target.match}`);
  const encoder = spawnManaged("npm", ["run", "youtube:start-overlay-stream"], {
    STREAM_ID: target.id,
    OVERLAY_CAPTURE_FPS: process.env.OVERLAY_CAPTURE_FPS || "2",
    OVERLAY_URL: process.env.OVERLAY_URL || `http://127.0.0.1:${port}/overlay`,
    COMMENTARY_AUDIO_PATH: commentaryAudioPath
  });
  await sleep(10000);

  const token = await accessToken();
  const broadcast = await getBroadcast(token, target.youtubeBroadcastId);
  const boundStreamId = broadcast.contentDetails?.boundStreamId;
  if (!boundStreamId) throw new Error("Broadcast has no bound stream id.");
  await waitForIngest(token, boundStreamId);

  if (transitionToLive && broadcast.status?.lifeCycleStatus !== "live") {
    const result = await transition(token, target.youtubeBroadcastId, "live");
    console.log(JSON.stringify({
      transitioned: true,
      id: target.id,
      youtubeBroadcastId: target.youtubeBroadcastId,
      lifeCycleStatus: result.status?.lifeCycleStatus || ""
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      transitioned: false,
      reason: transitionToLive ? "already live" : "disabled",
      id: target.id,
      youtubeBroadcastId: target.youtubeBroadcastId
    }, null, 2));
  }

  await new Promise((resolveExit) => encoder.on("exit", resolveExit));
  stopChildren();
} catch (error) {
  console.error(error.message);
  stopChildren();
  process.exit(1);
}
