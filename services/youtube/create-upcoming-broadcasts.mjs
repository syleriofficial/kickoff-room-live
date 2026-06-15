import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const dryRun = process.env.YOUTUBE_DRY_RUN !== "false";
const privacyStatus = process.env.YOUTUBE_PRIVACY_STATUS || "private";
const limit = Math.max(1, Number(process.env.YOUTUBE_CREATE_LIMIT || 20));
const root = resolve(new URL("../..", import.meta.url).pathname);
const schedulePath = resolve(root, "outputs/schedule/live-schedule.json");
const streamsPath = resolve(root, "outputs/generated-stream-pack/streams.json");

function requireEnv() {
  if (dryRun) return;
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

async function listUpcomingBroadcasts(token) {
  const found = [];
  let pageToken = "";

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
    url.searchParams.set("part", "id,snippet,status");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const payload = await youtubeJson(token, url);
    found.push(...(payload.items || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return found.filter((item) => {
    const scheduledAt = item.snippet?.scheduledStartTime;
    return scheduledAt && new Date(scheduledAt).getTime() > Date.now();
  });
}

function requestBody(stream, scheduledStartTime) {
  return {
    snippet: {
      title: stream.youtubeTitle,
      description: stream.description,
      scheduledStartTime
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false
    },
    contentDetails: {
      enableAutoStart: false,
      enableAutoStop: false,
      enableDvr: true
    }
  };
}

function alreadyScheduled(existing, stream, scheduledStartTime) {
  return existing.find((item) => (
    item.snippet?.title === stream.youtubeTitle &&
    item.snippet?.scheduledStartTime === scheduledStartTime
  ));
}

async function createBroadcast(token, body) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
  url.searchParams.set("part", "snippet,status,contentDetails");
  return youtubeJson(token, url, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

const schedule = JSON.parse(await readFile(schedulePath, "utf8"));
const streams = JSON.parse(await readFile(streamsPath, "utf8"));
const streamById = new Map(streams.map((stream) => [stream.id, stream]));
const upcoming = schedule
  .filter((item) => new Date(item.goLiveUtc).getTime() > Date.now())
  .sort((a, b) => new Date(a.goLiveUtc) - new Date(b.goLiveUtc))
  .slice(0, limit);

if (!upcoming.length) {
  console.error("No upcoming streams found in outputs/schedule/live-schedule.json");
  process.exit(1);
}

const plan = upcoming.map((item) => {
  const stream = streamById.get(item.id);
  if (!stream) throw new Error(`Missing stream package for schedule id: ${item.id}`);
  return {
    id: item.id,
    match: item.match,
    goLiveUtc: item.goLiveUtc,
    kickoffIst: item.kickoffIst,
    request: requestBody(stream, item.goLiveUtc)
  };
});

if (dryRun) {
  console.log("Dry run only. Set YOUTUBE_DRY_RUN=false to create missing upcoming broadcasts.");
  console.log(JSON.stringify({ dryRun, count: plan.length, broadcasts: plan }, null, 2));
  process.exit(0);
}

requireEnv();

try {
  const token = await accessToken();
  const existing = await listUpcomingBroadcasts(token);
  const results = [];

  for (const item of plan) {
    const duplicate = alreadyScheduled(existing, { youtubeTitle: item.request.snippet.title }, item.goLiveUtc);
    if (duplicate) {
      results.push({
        id: item.id,
        match: item.match,
        status: "skipped_existing",
        youtubeBroadcastId: duplicate.id,
        scheduledStartTime: item.goLiveUtc
      });
      continue;
    }

    const created = await createBroadcast(token, item.request);
    existing.push(created);
    results.push({
      id: item.id,
      match: item.match,
      status: "created",
      youtubeBroadcastId: created.id,
      scheduledStartTime: item.goLiveUtc
    });
  }

  console.log(JSON.stringify({ dryRun, privacyStatus, results }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
