import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const root = resolve(new URL("../..", import.meta.url).pathname);
const schedulePath = resolve(root, "outputs/schedule/live-schedule.json");
const streamsPath = resolve(root, "outputs/generated-stream-pack/streams.json");
const outputPath = resolve(root, "outputs/youtube-upcoming-broadcasts.json");

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

async function listUpcomingBroadcasts(token) {
  const found = [];
  let pageToken = "";

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
    url.searchParams.set("part", "id,snippet,status,contentDetails");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const payload = await youtubeJson(token, url);
    found.push(...(payload.items || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return found
    .filter((item) => {
      const scheduledAt = item.snippet?.scheduledStartTime;
      return scheduledAt && new Date(scheduledAt).getTime() > Date.now();
    })
    .sort((a, b) => new Date(a.snippet.scheduledStartTime) - new Date(b.snippet.scheduledStartTime));
}

function compactBroadcast(item) {
  return {
    youtubeBroadcastId: item.id,
    watchUrl: `https://www.youtube.com/watch?v=${item.id}`,
    studioUrl: `https://studio.youtube.com/video/${item.id}/livestreaming`,
    title: item.snippet?.title || "",
    scheduledStartTime: item.snippet?.scheduledStartTime || "",
    privacyStatus: item.status?.privacyStatus || "",
    lifeCycleStatus: item.status?.lifeCycleStatus || "",
    recordingStatus: item.status?.recordingStatus || "",
    enableDvr: item.contentDetails?.enableDvr ?? null,
    enableAutoStart: item.contentDetails?.enableAutoStart ?? null,
    enableAutoStop: item.contentDetails?.enableAutoStop ?? null
  };
}

function expectedBroadcasts(schedule, streams) {
  const streamById = new Map(streams.map((stream) => [stream.id, stream]));
  return schedule
    .filter((item) => new Date(item.goLiveUtc).getTime() > Date.now())
    .sort((a, b) => new Date(a.goLiveUtc) - new Date(b.goLiveUtc))
    .map((item) => {
      const stream = streamById.get(item.id);
      return {
        id: item.id,
        match: item.match,
        goLiveUtc: item.goLiveUtc,
        kickoffIst: item.kickoffIst,
        expectedTitle: stream?.youtubeTitle || ""
      };
    });
}

function compareExpected(expected, broadcasts) {
  return expected.map((item) => {
    const match = broadcasts.find((broadcast) => (
      broadcast.title === item.expectedTitle &&
      broadcast.scheduledStartTime === item.goLiveUtc
    ));
    return {
      ...item,
      status: match ? "found" : "missing",
      youtubeBroadcastId: match?.youtubeBroadcastId || "",
      watchUrl: match?.watchUrl || "",
      studioUrl: match?.studioUrl || "",
      privacyStatus: match?.privacyStatus || "",
      lifeCycleStatus: match?.lifeCycleStatus || ""
    };
  });
}

requireEnv();

try {
  const [schedule, streams, token] = await Promise.all([
    readFile(schedulePath, "utf8").then(JSON.parse),
    readFile(streamsPath, "utf8").then(JSON.parse),
    accessToken()
  ]);
  const broadcasts = (await listUpcomingBroadcasts(token)).map(compactBroadcast);
  const expected = expectedBroadcasts(schedule, streams);
  const matches = compareExpected(expected, broadcasts);
  const report = {
    generatedAt: new Date().toISOString(),
    expectedCount: expected.length,
    youtubeUpcomingCount: broadcasts.length,
    readyCount: matches.filter((item) => item.status === "found").length,
    missingCount: matches.filter((item) => item.status === "missing").length,
    matches,
    broadcasts
  };

  await mkdir(resolve(root, "outputs"), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.error(`Wrote ${outputPath}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
