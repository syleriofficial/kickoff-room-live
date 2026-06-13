const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const redirectUri = process.env.YOUTUBE_REDIRECT_URI || "http://localhost:8080/oauth2callback";
const code = process.env.YOUTUBE_AUTH_CODE || process.argv[2];

if (!clientId || !clientSecret || !code) {
  console.error("Missing YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, or auth code.");
  console.error("Usage: YOUTUBE_AUTH_CODE=... node services/youtube/exchange-token.mjs");
  process.exit(1);
}

const body = new URLSearchParams({
  client_id: clientId,
  client_secret: clientSecret,
  code,
  grant_type: "authorization_code",
  redirect_uri: redirectUri
});

const response = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body
});

const payload = await response.json();

if (!response.ok) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log("Copy YOUTUBE_REFRESH_TOKEN into your local .env only. Do not commit it.");
console.log(JSON.stringify({
  token_type: payload.token_type,
  expires_in: payload.expires_in,
  scope: payload.scope,
  refresh_token: payload.refresh_token ? "REDACTED_PRESENT" : "MISSING",
  access_token: payload.access_token ? "REDACTED_PRESENT" : "MISSING"
}, null, 2));

if (payload.refresh_token) {
  console.log(`\nYOUTUBE_REFRESH_TOKEN=${payload.refresh_token}`);
}
