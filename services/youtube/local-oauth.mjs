import { createServer } from "node:http";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const host = process.env.YOUTUBE_OAUTH_HOST || "127.0.0.1";
const port = Number(process.env.YOUTUBE_OAUTH_PORT || 8080);
const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `http://localhost:${port}/oauth2callback`;

if (!clientId || !clientSecret) {
  console.error("Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET.");
  console.error("Export them locally first. Never commit them.");
  process.exit(1);
}

function consentUrl() {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", [
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.force-ssl"
  ].join(" "));
  return url.toString();
}

async function exchangeCode(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload, null, 2));
  }
  return payload;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname !== "/oauth2callback") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("Kickoff Room Live OAuth helper is running. Open the consent URL in the terminal.\n");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end(`OAuth error: ${error}\n`);
    console.error(`OAuth error: ${error}`);
    server.close();
    return;
  }

  if (!code) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Missing OAuth code.\n");
    return;
  }

  try {
    const payload = await exchangeCode(code);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<h1>OAuth complete</h1><p>You can close this tab and return to the terminal.</p>");

    console.log("\nOAuth complete. Copy this into your local .env only:");
    if (payload.refresh_token) {
      console.log(`YOUTUBE_REFRESH_TOKEN=${payload.refresh_token}`);
    } else {
      console.log("No refresh token returned. Re-run with prompt=consent or remove the app from Google account access and try again.");
    }
    console.log("\nToken summary:");
    console.log(JSON.stringify({
      token_type: payload.token_type,
      expires_in: payload.expires_in,
      scope: payload.scope,
      refresh_token: payload.refresh_token ? "REDACTED_PRESENT" : "MISSING",
      access_token: payload.access_token ? "REDACTED_PRESENT" : "MISSING"
    }, null, 2));
  } catch (exchangeError) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Token exchange failed. Check terminal output.\n");
    console.error(exchangeError.message);
  } finally {
    server.close();
  }
});

server.listen(port, host, () => {
  console.log(`OAuth callback server listening on http://${host}:${port}`);
  console.log("\nOpen this URL in your browser:\n");
  console.log(consentUrl());
  console.log("\nAfter approval, the browser will redirect back here and the refresh token will print in this terminal.");
});
