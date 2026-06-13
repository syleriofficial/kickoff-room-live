import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const streamId = process.env.STREAM_ID || process.argv[2] || "bra-mar";
const dryRun = process.env.YOUTUBE_DRY_RUN !== "false";
const privacyStatus = process.env.YOUTUBE_PRIVACY_STATUS || "private";
const scheduledStartTime = process.env.YOUTUBE_SCHEDULED_START_TIME;
const root = resolve(new URL("../..", import.meta.url).pathname);
const streamsPath = resolve(root, "outputs/generated-stream-pack/streams.json");

function requireEnv() {
  if (dryRun) return;
  const missing = [
    ["YOUTUBE_CLIENT_ID", clientId],
    ["YOUTUBE_CLIENT_SECRET", clientSecret],
    ["YOUTUBE_REFRESH_TOKEN", refreshToken],
    ["YOUTUBE_SCHEDULED_START_TIME", scheduledStartTime]
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
  if (!response.ok) {
    throw new Error(JSON.stringify(payload, null, 2));
  }
  return payload.access_token;
}

async function createBroadcast(token, body) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
  url.searchParams.set("part", "snippet,status,contentDetails");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload, null, 2));
  }
  return payload;
}

const streams = JSON.parse(await readFile(streamsPath, "utf8"));
const stream = streams.find((item) => item.id === streamId);

if (!stream) {
  console.error(`Unknown stream id: ${streamId}`);
  process.exit(1);
}

const body = {
  snippet: {
    title: stream.youtubeTitle,
    description: stream.description,
    scheduledStartTime: scheduledStartTime || "SET_YOUTUBE_SCHEDULED_START_TIME"
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

if (dryRun) {
  console.log("Dry run only. Set YOUTUBE_DRY_RUN=false and required env vars to create the broadcast.");
  console.log(JSON.stringify({ streamId, request: body }, null, 2));
  process.exit(0);
}

requireEnv();

try {
  const token = await accessToken();
  const result = await createBroadcast(token, body);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
