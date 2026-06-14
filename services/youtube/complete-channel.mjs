import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const dryRun = process.env.YOUTUBE_DRY_RUN === "true";
const root = resolve(new URL("../..", import.meta.url).pathname);
const bannerPath = resolve(root, "outputs/youtube-channel-kit/png-assets/banner-2560x1440.png");

const channelDescription = `Kickoff Room Live is a global English football watchalong channel.

We cover major football matches with live score, match timer, English commentary prompts, tactical talking points, fan chat, polls, and post-match Shorts.

No match footage. No broadcast audio. Open the official broadcast in your country and use this channel as your second-screen football room.

Subscribe and join before kickoff.`;

const keywords = [
  "football watchalong",
  "live football reaction",
  "world cup watchalong",
  "english football commentary",
  "no footage watchalong",
  "live score football",
  "football live chat",
  "football shorts",
  "global football fans"
].join(",");

const playlists = [
  {
    title: "World Cup 2026 Watchalongs",
    description: "English no-footage live watchalongs for World Cup 2026 matches."
  },
  {
    title: "Football Live Reactions",
    description: "Live football reactions, match pulse, and fan chat moments."
  },
  {
    title: "Matchday Shorts",
    description: "Short-form football reactions, predictions, and matchday clips."
  },
  {
    title: "Full-Time Verdicts",
    description: "Fast full-time verdicts after major football matches."
  },
  {
    title: "Tactical Quick Takes",
    description: "Quick tactical talking points and key battle breakdowns."
  }
];

if (!clientId || !clientSecret || !refreshToken) {
  console.error("Missing YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, or YOUTUBE_REFRESH_TOKEN.");
  process.exit(1);
}

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload, null, 2));
  }
  return payload;
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

async function ownedChannel(token) {
  const payload = await api("channels?part=id,snippet,brandingSettings&mine=true", { token });
  const channel = payload.items?.[0];
  if (!channel) throw new Error("No channel found for this OAuth account.");
  return channel;
}

async function updateBranding(token, channel) {
  const brandingSettings = channel.brandingSettings || {};
  const currentChannel = brandingSettings.channel || {};
  const body = {
    id: channel.id,
    brandingSettings: {
      ...brandingSettings,
      channel: {
        ...currentChannel,
        title: "Kickoff Room Live",
        description: channelDescription,
        keywords,
        defaultLanguage: "en",
        country: "US"
      }
    }
  };
  if (dryRun) return { dryRun: true, request: body };
  return api("channels?part=brandingSettings", { method: "PUT", token, body });
}

async function uploadBanner(token) {
  const bytes = await readFile(bannerPath);
  if (dryRun) return { dryRun: true, url: "DRY_RUN_BANNER_URL" };
  const response = await fetch("https://www.googleapis.com/upload/youtube/v3/channelBanners/insert", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "image/png"
    },
    body: bytes
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload, null, 2));
  }
  return payload;
}

async function setBanner(token, channel, bannerUrl) {
  const brandingSettings = channel.brandingSettings || {};
  const currentChannel = brandingSettings.channel || {};
  const currentImage = brandingSettings.image || {};
  const body = {
    id: channel.id,
    brandingSettings: {
      ...brandingSettings,
      channel: {
        ...currentChannel,
        title: "Kickoff Room Live",
        description: channelDescription,
        keywords,
        defaultLanguage: "en",
        country: "US"
      },
      image: {
        ...currentImage,
        bannerExternalUrl: bannerUrl
      }
    }
  };
  if (dryRun) return { dryRun: true, request: body };
  return api("channels?part=brandingSettings", { method: "PUT", token, body });
}

async function existingPlaylists(token) {
  const payload = await api("playlists?part=snippet&mine=true&maxResults=50", { token });
  return new Set((payload.items || []).map((item) => item.snippet?.title).filter(Boolean));
}

async function createPlaylist(token, playlist) {
  const body = {
    snippet: {
      title: playlist.title,
      description: playlist.description
    },
    status: {
      privacyStatus: "public"
    }
  };
  if (dryRun) return { dryRun: true, request: body };
  return api("playlists?part=snippet,status", { method: "POST", token, body });
}

try {
  const token = await accessToken();
  const channel = await ownedChannel(token);
  const existing = await existingPlaylists(token);
  const branding = await updateBranding(token, channel);
  const bannerUpload = await uploadBanner(token);
  const banner = await setBanner(token, channel, bannerUpload.url);
  const created = [];
  const skipped = [];

  for (const playlist of playlists) {
    if (existing.has(playlist.title)) {
      skipped.push(playlist.title);
      continue;
    }
    const result = await createPlaylist(token, playlist);
    created.push({ title: playlist.title, id: result.id || "DRY_RUN" });
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    channel: {
      id: channel.id,
      currentTitle: channel.snippet?.title,
      targetTitle: "Kickoff Room Live"
    },
    brandingUpdated: Boolean(branding),
    bannerUpdated: Boolean(banner),
    playlistsCreated: created,
    playlistsSkipped: skipped,
    manualStillNeeded: [
      "Upload avatar PNG in YouTube Studio Branding",
      "Set upload defaults in YouTube Studio Settings"
    ]
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
