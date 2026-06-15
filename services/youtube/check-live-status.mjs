const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

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

async function checkLiveAccess(token) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
  url.searchParams.set("part", "id,status,snippet");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "1");

  const response = await fetch(url, {
    headers: { "authorization": `Bearer ${token}` }
  });
  const payload = await response.json();
  return { ok: response.ok, status: response.status, payload };
}

function reason(payload) {
  return payload?.error?.errors?.[0]?.reason || payload?.error?.status || "unknown";
}

requireEnv();

try {
  const token = await accessToken();
  const result = await checkLiveAccess(token);

  if (result.ok) {
    console.log(JSON.stringify({
      liveReadApiReady: true,
      createAccessStillDependsOnStudioWait: true,
      message: "YouTube Live read API is available. If broadcast creation returns livePermissionBlocked, wait until the YouTube Studio live activation countdown finishes.",
      upcomingBroadcastsVisible: result.payload.items?.length || 0
    }, null, 2));
    process.exit(0);
  }

  const errorReason = reason(result.payload);
  console.log(JSON.stringify({
    liveReadApiReady: false,
    status: result.status,
    reason: errorReason,
    message: errorReason === "liveStreamingNotEnabled"
      ? "YouTube still has the channel in the live streaming activation wait window."
      : "YouTube Live API is not ready yet. Check the error reason."
  }, null, 2));
  process.exit(2);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
