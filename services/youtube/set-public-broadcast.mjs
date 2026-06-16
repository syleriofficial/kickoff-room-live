import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const streamId = process.env.STREAM_ID || process.argv[2] || "";
const dryRun = process.env.YOUTUBE_DRY_RUN !== "false";
const confirmPublic = process.env.YOUTUBE_CONFIRM_PUBLIC === "true";
const root = resolve(new URL("../..", import.meta.url).pathname);
const upcomingPath = resolve(root, "outputs/youtube-upcoming-broadcasts.json");

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

async function youtubeJson(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/json",
      ...options.headers
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload, null, 2));
  return payload;
}

async function getBroadcast(token, broadcastId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
  url.searchParams.set("part", "snippet,status,contentDetails");
  url.searchParams.set("id", broadcastId);
  const payload = await youtubeJson(token, url);
  const item = payload.items?.[0];
  if (!item) throw new Error(`Broadcast not found: ${broadcastId}`);
  return item;
}

async function updateBroadcast(token, body) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
  url.searchParams.set("part", "snippet,status,contentDetails");
  return youtubeJson(token, url, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

function updateBody(current) {
  return {
    id: current.id,
    snippet: {
      title: current.snippet?.title || "",
      description: current.snippet?.description || "",
      scheduledStartTime: current.snippet?.scheduledStartTime
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false
    },
    contentDetails: {
      enableAutoStart: current.contentDetails?.enableAutoStart ?? false,
      enableAutoStop: current.contentDetails?.enableAutoStop ?? false,
      enableDvr: current.contentDetails?.enableDvr ?? true
    }
  };
}

const upcoming = JSON.parse(await readFile(upcomingPath, "utf8"));
const target = (upcoming.matches || []).find((item) => item.id === streamId || item.youtubeBroadcastId === streamId);

if (!streamId) {
  console.error("Missing target. Pass STREAM_ID=fra-sen or a YouTube broadcast ID.");
  process.exit(1);
}

if (!target?.youtubeBroadcastId) {
  console.error(`No created YouTube broadcast found for target: ${streamId}`);
  process.exit(1);
}

requireEnv();

try {
  const token = await accessToken();
  const current = await getBroadcast(token, target.youtubeBroadcastId);
  const body = updateBody(current);
  const plan = {
    dryRun,
    confirmPublic,
    id: target.id,
    match: target.match,
    youtubeBroadcastId: target.youtubeBroadcastId,
    fromPrivacyStatus: current.status?.privacyStatus || "",
    toPrivacyStatus: "public",
    studioUrl: target.studioUrl,
    watchUrl: target.watchUrl,
    scheduledStartTime: body.snippet.scheduledStartTime
  };

  if (dryRun || !confirmPublic) {
    console.log("Dry run only. To actually set public, use YOUTUBE_DRY_RUN=false YOUTUBE_CONFIRM_PUBLIC=true.");
    console.log(JSON.stringify(plan, null, 2));
    process.exit(0);
  }

  const result = await updateBroadcast(token, body);
  console.log(JSON.stringify({
    ...plan,
    status: "updated",
    resultPrivacyStatus: result.status?.privacyStatus || ""
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
