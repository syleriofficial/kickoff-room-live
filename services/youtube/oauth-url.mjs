const clientId = process.env.YOUTUBE_CLIENT_ID;
const redirectUri = process.env.YOUTUBE_REDIRECT_URI || "http://localhost:8080/oauth2callback";

if (!clientId) {
  console.error("Missing YOUTUBE_CLIENT_ID. Put it in local .env or export it in your shell.");
  process.exit(1);
}

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

console.log(url.toString());
