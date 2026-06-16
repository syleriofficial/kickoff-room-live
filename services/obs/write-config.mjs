import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const broadcastId = process.env.YOUTUBE_BROADCAST_ID || "gDlGyxhLDtk";
const overlayUrl = process.env.OVERLAY_URL || "http://127.0.0.1:5174/overlay";
const profileName = process.env.OBS_PROFILE || "Kickoff Room Live";
const collectionName = process.env.OBS_COLLECTION || "Kickoff Room Live";
const obsRoot = join(homedir(), "Library/Application Support/obs-studio");

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

async function getStreamInfo(token) {
  const broadcastUrl = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
  broadcastUrl.searchParams.set("part", "id,contentDetails");
  broadcastUrl.searchParams.set("id", broadcastId);
  const broadcast = (await youtubeJson(token, broadcastUrl)).items?.[0];
  if (!broadcast?.contentDetails?.boundStreamId) throw new Error(`No bound stream found for ${broadcastId}`);

  const streamUrl = new URL("https://www.googleapis.com/youtube/v3/liveStreams");
  streamUrl.searchParams.set("part", "id,cdn");
  streamUrl.searchParams.set("id", broadcast.contentDetails.boundStreamId);
  const stream = (await youtubeJson(token, streamUrl)).items?.[0];
  const info = stream?.cdn?.ingestionInfo;
  if (!info?.ingestionAddress || !info?.streamName) throw new Error("YouTube ingestion info missing.");
  return {
    server: info.ingestionAddress,
    key: info.streamName
  };
}

function ini(values) {
  return Object.entries(values)
    .map(([section, pairs]) => [
      `[${section}]`,
      ...Object.entries(pairs).map(([key, value]) => `${key}=${value}`)
    ].join("\n"))
    .join("\n\n");
}

function sceneCollection() {
  const sceneUuid = randomUUID();
  const browserUuid = randomUUID();
  return {
    name: collectionName,
    current_scene: "Live Overlay",
    current_program_scene: "Live Overlay",
    scene_order: [{ name: "Live Overlay" }],
    sources: [
      {
        name: "Live Overlay",
        uuid: sceneUuid,
        id: "scene",
        versioned_id: "scene",
        settings: {
          id_counter: 1,
          items: [
            {
              align: 5,
              bounds: { x: 1280, y: 720 },
              bounds_align: 0,
              bounds_type: 2,
              crop_bottom: 0,
              crop_left: 0,
              crop_right: 0,
              crop_top: 0,
              group_item_backup: false,
              id: 1,
              locked: false,
              name: "Kickoff Overlay",
              pos: { x: 0, y: 0 },
              private_settings: {},
              rot: 0,
              scale: { x: 1, y: 1 },
              scale_filter: "disable",
              source_uuid: browserUuid,
              visible: true
            }
          ]
        },
        mixers: 0,
        sync: 0,
        flags: 0,
        volume: 1,
        balance: 0,
        enabled: true,
        muted: false,
        "push-to-mute": false,
        "push-to-mute-delay": 0,
        "push-to-talk": false,
        "push-to-talk-delay": 0,
        hotkeys: {},
        deinterlace_mode: 0,
        deinterlace_field_order: 0,
        monitoring_type: 0
      },
      {
        name: "Kickoff Overlay",
        uuid: browserUuid,
        id: "browser_source",
        versioned_id: "browser_source",
        settings: {
          url: overlayUrl,
          width: 1280,
          height: 720,
          fps: 30,
          css: "body { background-color: rgba(0, 0, 0, 1); margin: 0px; overflow: hidden; }",
          reroute_audio: false,
          restart_when_active: true,
          shutdown: false,
          webkit_framerate: 30
        },
        mixers: 0,
        sync: 0,
        flags: 0,
        volume: 1,
        balance: 0,
        enabled: true,
        muted: false,
        "push-to-mute": false,
        "push-to-mute-delay": 0,
        "push-to-talk": false,
        "push-to-talk-delay": 0,
        hotkeys: {},
        deinterlace_mode: 0,
        deinterlace_field_order: 0,
        monitoring_type: 0
      }
    ]
  };
}

async function main() {
  requireEnv();
  const token = await accessToken();
  const stream = await getStreamInfo(token);

  const profileDir = join(obsRoot, "basic/profiles", profileName);
  const scenesDir = join(obsRoot, "basic/scenes");
  await mkdir(profileDir, { recursive: true });
  await mkdir(scenesDir, { recursive: true });

  await writeFile(join(profileDir, "basic.ini"), `${ini({
    General: { Name: profileName },
    Video: {
      BaseCX: 1280,
      BaseCY: 720,
      OutputCX: 1280,
      OutputCY: 720,
      FPSCommon: 30,
      ScaleType: "bicubic",
      ColorFormat: "NV12",
      ColorSpace: 709,
      ColorRange: "Partial"
    },
    Output: { Mode: "Simple" },
    SimpleOutput: {
      VBitrate: 2500,
      ABitrate: 128,
      UseAdvanced: false,
      EnforceBitrate: true,
      StreamEncoder: "x264"
    },
    AdvOut: {
      TrackIndex: 1,
      RecType: "Standard",
      Encoder: "obs_x264"
    }
  })}\n`);

  await writeFile(join(profileDir, "service.json"), JSON.stringify({
    type: "rtmp_common",
    settings: {
      service: "YouTube - RTMPS",
      server: stream.server,
      key: stream.key,
      bwtest: false
    }
  }, null, 2));

  await writeFile(join(scenesDir, `${collectionName}.json`), JSON.stringify(sceneCollection(), null, 2));
  await writeFile(join(obsRoot, "global.ini"), `${ini({
    Basic: {
      Profile: profileName,
      ProfileDir: profileName,
      SceneCollection: collectionName,
      SceneCollectionFile: collectionName
    }
  })}\n`);

  console.log(JSON.stringify({
    ok: true,
    profileName,
    collectionName,
    overlayUrl,
    wrote: [
      join(profileDir, "basic.ini"),
      join(profileDir, "service.json"),
      join(scenesDir, `${collectionName}.json`),
      join(obsRoot, "global.ini")
    ],
    streamKeyWritten: true
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
