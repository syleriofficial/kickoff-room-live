import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getLiveScore } from "./api-football.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const runtimeDir = resolve(root, "outputs/runtime");
const liveStatePath = resolve(runtimeDir, "live-state.json");
const streamId = process.env.STREAM_ID || process.argv[2] || "fra-sen";
const intervalMs = Math.max(5000, Number(process.env.SCORE_SYNC_SECONDS || 20) * 1000);

function stateFromLive(live, lastState = {}) {
  const preset = live.preset;
  const commentaryLine = live.commentaryLine || `Live score: ${preset.home} ${live.homeScore || 0}, ${preset.away} ${live.awayScore || 0}.`;
  return {
    ...lastState,
    presetId: preset.id,
    home: preset.home,
    away: preset.away,
    homeShort: preset.homeShort,
    awayShort: preset.awayShort,
    homeColor: preset.homeColor,
    awayColor: preset.awayColor,
    topic: preset.topic,
    keyBattle: preset.keyBattle,
    gamePulse: preset.gamePulse,
    chatMission: preset.chatMission,
    pollHome: preset.pollHome,
    pollAway: preset.pollAway,
    homeScore: Number(live.homeScore || 0),
    awayScore: Number(live.awayScore || 0),
    seconds: Number(live.elapsed || 0) * 60,
    hype: Number(lastState.hype || 70),
    momentumHome: Number(lastState.momentumHome || 50),
    momentumAway: Number(lastState.momentumAway || 50),
    shotsHome: Number(lastState.shotsHome || 0),
    shotsAway: Number(lastState.shotsAway || 0),
    possessionHome: Number(lastState.possessionHome || 50),
    possessionAway: Number(lastState.possessionAway || 50),
    speakLine: commentaryLine,
    speakNonce: Date.now()
  };
}

async function writeState(state) {
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(liveStatePath, JSON.stringify({
    ok: true,
    updatedAt: new Date().toISOString(),
    state
  }, null, 2));
}

let lastState = {};

async function tick() {
  const live = await getLiveScore(streamId);
  if (!live.ok || !live.live) {
    console.log(JSON.stringify({
      ok: live.ok,
      live: live.live || false,
      message: live.message || "Live feed unavailable"
    }));
    return;
  }
  lastState = stateFromLive(live, lastState);
  await writeState(lastState);
  console.log(JSON.stringify({
    ok: true,
    id: streamId,
    status: live.status,
    elapsed: live.elapsed,
    score: `${lastState.home} ${lastState.homeScore}-${lastState.awayScore} ${lastState.away}`,
    commentaryLine: lastState.speakLine
  }));
}

await tick();
setInterval(() => {
  tick().catch((error) => console.error(error.message));
}, intervalMs);
