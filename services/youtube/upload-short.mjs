import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const dryRun = process.env.YOUTUBE_DRY_RUN !== "false";
const privacyStatus = process.env.YOUTUBE_SHORT_PRIVACY || "public";
const root = resolve(new URL("../..", import.meta.url).pathname);
const metaPath = resolve(root, process.env.SHORT_META || process.argv[2] || "outputs/shorts-upload/eng-cro-preview.json");

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

function metadataBody(meta) {
  return {
    snippet: {
      title: meta.title,
      description: meta.description,
      tags: meta.tags || [],
      categoryId: "17"
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false
    }
  };
}

function multipartBody(metadata, videoBytes) {
  const boundary = `kickoff_room_${Date.now()}`;
  const head = Buffer.from([
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: video/mp4",
    ""
  ].join("\r\n"));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    boundary,
    body: Buffer.concat([head, Buffer.from("\r\n"), videoBytes, tail])
  };
}

requireEnv();

try {
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  const videoPath = meta.videoPath;
  const videoInfo = await stat(videoPath);
  const body = metadataBody(meta);

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun,
      privacyStatus,
      metaPath,
      videoPath,
      videoBytes: videoInfo.size,
      request: body
    }, null, 2));
    process.exit(0);
  }

  const token = await accessToken();
  const videoBytes = await readFile(videoPath);
  const multipart = multipartBody(body, videoBytes);
  const url = new URL("https://www.googleapis.com/upload/youtube/v3/videos");
  url.searchParams.set("part", "snippet,status");
  url.searchParams.set("uploadType", "multipart");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": `multipart/related; boundary=${multipart.boundary}`,
      "content-length": String(multipart.body.length)
    },
    body: multipart.body
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload, null, 2));

  console.log(JSON.stringify({
    dryRun,
    privacyStatus,
    videoId: payload.id,
    watchUrl: `https://www.youtube.com/watch?v=${payload.id}`,
    studioUrl: `https://studio.youtube.com/video/${payload.id}/edit`,
    title: payload.snippet?.title || meta.title
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
