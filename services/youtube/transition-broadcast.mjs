const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const broadcastId = process.env.YOUTUBE_BROADCAST_ID || process.argv[2] || "";
const status = process.env.YOUTUBE_BROADCAST_STATUS || process.argv[3] || "live";

function requireEnv() {
  const missing = [
    ["YOUTUBE_CLIENT_ID", clientId],
    ["YOUTUBE_CLIENT_SECRET", clientSecret],
    ["YOUTUBE_REFRESH_TOKEN", refreshToken],
    ["YOUTUBE_BROADCAST_ID", broadcastId]
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

async function transition(token) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts/transition");
  url.searchParams.set("part", "id,status");
  url.searchParams.set("id", broadcastId);
  url.searchParams.set("broadcastStatus", status);
  const response = await fetch(url, {
    method: "POST",
    headers: { "authorization": `Bearer ${token}` }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload, null, 2));
  return payload;
}

requireEnv();

try {
  const token = await accessToken();
  const result = await transition(token);
  console.log(JSON.stringify({
    id: result.id,
    requestedStatus: status,
    lifeCycleStatus: result.status?.lifeCycleStatus || ""
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
