import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const dryRun = process.env.YOUTUBE_DRY_RUN !== "false";
const root = resolve(new URL("../..", import.meta.url).pathname);
const reportPath = resolve(root, "outputs/youtube-upcoming-broadcasts.json");

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

async function uploadThumbnail(token, videoId, filePath) {
  const bytes = await readFile(filePath);
  const url = new URL("https://www.googleapis.com/upload/youtube/v3/thumbnails/set");
  url.searchParams.set("videoId", videoId);
  url.searchParams.set("uploadType", "media");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "image/png",
      "content-length": String(bytes.byteLength)
    },
    body: bytes
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload, null, 2));
  return payload;
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
const targets = report.matches
  .filter((item) => item.status === "found" && item.youtubeBroadcastId)
  .map((item) => ({
    id: item.id,
    match: item.match,
    youtubeBroadcastId: item.youtubeBroadcastId,
    thumbnailPath: resolve(root, "outputs/thumbnails", `${item.id}.png`)
  }));

if (!targets.length) {
  console.error("No created YouTube broadcasts found. Run npm run youtube:list-upcoming first.");
  process.exit(1);
}

if (dryRun) {
  console.log(JSON.stringify({ dryRun, count: targets.length, targets }, null, 2));
  process.exit(0);
}

requireEnv();

try {
  const token = await accessToken();
  const results = [];
  for (const target of targets) {
    const uploaded = await uploadThumbnail(token, target.youtubeBroadcastId, target.thumbnailPath);
    results.push({
      id: target.id,
      match: target.match,
      youtubeBroadcastId: target.youtubeBroadcastId,
      status: "uploaded",
      thumbnailPath: target.thumbnailPath,
      responseKind: uploaded.kind || ""
    });
  }
  console.log(JSON.stringify({ dryRun, results }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
