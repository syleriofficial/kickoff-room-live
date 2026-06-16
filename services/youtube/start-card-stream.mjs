import { spawn, spawnSync } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const streamId = process.env.STREAM_ID || process.argv[2] || "fra-sen";
const root = resolve(new URL("../..", import.meta.url).pathname);
const upcomingPath = resolve(root, "outputs/youtube-upcoming-broadcasts.json");
const thumbnailPath = resolve(root, `outputs/thumbnails/${streamId}.png`);
const logsDir = resolve(root, "outputs/runtime");

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
  url.searchParams.set("part", "id,snippet,status,contentDetails");
  url.searchParams.set("id", broadcastId);
  const payload = await youtubeJson(token, url);
  const item = payload.items?.[0];
  if (!item) throw new Error(`Broadcast not found: ${broadcastId}`);
  return item;
}

async function getLiveStream(token, liveStreamId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveStreams");
  url.searchParams.set("part", "id,snippet,status,cdn");
  url.searchParams.set("id", liveStreamId);
  const payload = await youtubeJson(token, url);
  const item = payload.items?.[0];
  if (!item) throw new Error(`Live stream not found: ${liveStreamId}`);
  return item;
}

function rtmpUrl(stream) {
  const info = stream.cdn?.ingestionInfo;
  if (!info?.ingestionAddress || !info?.streamName) {
    throw new Error("YouTube ingestion address or stream key is missing.");
  }
  return `${info.ingestionAddress}/${info.streamName}`;
}

async function main() {
  requireEnv();
  const upcoming = JSON.parse(await readFile(upcomingPath, "utf8"));
  const target = (upcoming.matches || []).find((item) => item.id === streamId || item.youtubeBroadcastId === streamId);
  if (!target?.youtubeBroadcastId) throw new Error(`No created YouTube broadcast found for target: ${streamId}`);

  const token = await accessToken();
  const broadcast = await getBroadcast(token, target.youtubeBroadcastId);
  const boundStreamId = broadcast.contentDetails?.boundStreamId;
  if (!boundStreamId) throw new Error(`Broadcast has no bound YouTube live stream: ${target.youtubeBroadcastId}`);
  const liveStream = await getLiveStream(token, boundStreamId);
  await mkdir(logsDir, { recursive: true });

  const logPath = resolve(logsDir, `youtube-card-stream-${target.id}.log`);
  const pidPath = resolve(logsDir, `youtube-card-stream-${target.id}.pid`);
  const loopPath = resolve(logsDir, `${target.id}-card-loop.mp4`);
  const outputUrl = rtmpUrl(liveStream);
  const logFd = openSync(logPath, "a");
  await writeFile(logPath, `Preparing card stream for ${target.match} at ${new Date().toISOString()}.\n`, { flag: "a" });

  const build = spawnSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel", "warning",
    "-loop", "1",
    "-framerate", "30",
    "-i", thumbnailPath,
    "-f", "lavfi",
    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t", process.env.STREAM_CARD_SECONDS || "600",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "stillimage",
    "-b:v", "2500k",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-pix_fmt", "yuv420p",
    "-g", "60",
    "-r", "30",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-shortest",
    loopPath
  ], { stdio: ["ignore", logFd, logFd] });

  if (build.status !== 0) {
    closeSync(logFd);
    throw new Error(`ffmpeg failed to build card loop. See ${logPath}`);
  }

  const args = [
    "-hide_banner",
    "-loglevel", "warning",
    "-re",
    "-stream_loop", "-1",
    "-i", loopPath,
    "-c", "copy",
    "-f", "flv",
    outputUrl
  ];

  const child = spawn("ffmpeg", args, {
    detached: true,
    stdio: ["ignore", logFd, logFd]
  });
  child.unref();
  closeSync(logFd);
  await writeFile(pidPath, `${child.pid}\n`);
  await writeFile(logPath, `Started card stream for ${target.match} at ${new Date().toISOString()}.\n`, { flag: "a" });

  console.log(JSON.stringify({
    started: true,
    id: target.id,
    match: target.match,
    youtubeBroadcastId: target.youtubeBroadcastId,
    pid: child.pid,
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
