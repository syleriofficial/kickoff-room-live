import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const root = resolve(new URL("../..", import.meta.url).pathname);
const streamsPath = resolve(root, "outputs/generated-stream-pack/streams.json");
const upcomingPath = resolve(root, "outputs/youtube-upcoming-broadcasts.json");
const outputPath = resolve(root, "outputs/youtube-review-report.json");

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

async function listVideos(token, videoIds) {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "id,snippet,status,liveStreamingDetails");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("maxResults", "50");
  const payload = await youtubeJson(token, url);
  return payload.items || [];
}

function thumbnailReady(thumbnails = {}) {
  return Boolean(thumbnails.maxres || thumbnails.standard || thumbnails.high);
}

function reviewItem(match, stream, video) {
  const snippet = video?.snippet || {};
  const status = video?.status || {};
  const live = video?.liveStreamingDetails || {};
  const checks = {
    exists: Boolean(video),
    private: status.privacyStatus === "private",
    titleExact: snippet.title === stream.youtubeTitle,
    noFootageTitle: (snippet.title || "").toLowerCase().includes("no footage"),
    noFootageDescription: (snippet.description || "").toLowerCase().includes("no match footage"),
    noBroadcastAudioDescription: (snippet.description || "").toLowerCase().includes("no broadcast audio"),
    thumbnailReady: thumbnailReady(snippet.thumbnails),
    scheduledStartTime: live.scheduledStartTime === match.goLiveUtc,
    notMadeForKids: status.madeForKids === false || status.selfDeclaredMadeForKids === false
  };
  const ready = Object.values(checks).every(Boolean);
  return {
    id: match.id,
    match: match.match,
    youtubeBroadcastId: match.youtubeBroadcastId,
    studioUrl: match.studioUrl,
    watchUrl: match.watchUrl,
    privacyStatus: status.privacyStatus || "",
    lifeCycleStatus: match.lifeCycleStatus || "",
    scheduledStartTime: live.scheduledStartTime || "",
    thumbnailKeys: Object.keys(snippet.thumbnails || {}),
    checks,
    ready
  };
}

requireEnv();

try {
  const [streams, upcoming, token] = await Promise.all([
    readFile(streamsPath, "utf8").then(JSON.parse),
    readFile(upcomingPath, "utf8").then(JSON.parse),
    accessToken()
  ]);

  const streamById = new Map(streams.map((stream) => [stream.id, stream]));
  const foundMatches = (upcoming.matches || []).filter((item) => item.status === "found" && item.youtubeBroadcastId);
  const videos = await listVideos(token, foundMatches.map((item) => item.youtubeBroadcastId));
  const videoById = new Map(videos.map((video) => [video.id, video]));
  const reviews = foundMatches.map((match) => reviewItem(
    match,
    streamById.get(match.id) || {},
    videoById.get(match.youtubeBroadcastId)
  ));
  const readyCount = reviews.filter((item) => item.ready).length;
  const report = {
    generatedAt: new Date().toISOString(),
    expectedCount: (upcoming.matches || []).length,
    foundCount: foundMatches.length,
    readyCount,
    needsReviewCount: reviews.length - readyCount,
    allReadyForManualPublicReview: reviews.length > 0 && readyCount === reviews.length,
    reviews
  };

  await mkdir(resolve(root, "outputs"), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.error(`Wrote ${outputPath}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
