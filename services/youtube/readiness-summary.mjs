import { spawnSync } from "node:child_process";

const unlockAt = new Date(process.env.YOUTUBE_LIVE_UNLOCK_AT || "2026-06-16T08:13:00Z");

function runNodeScript(script) {
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: process.env
  });
  return {
    ok: result.status === 0,
    status: result.status || 0,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function parseJson(output) {
  const trimmed = output.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

function compactMatches(matches = []) {
  return matches.map((item) => ({
    id: item.id,
    match: item.match,
    status: item.status,
    youtubeBroadcastId: item.youtubeBroadcastId,
    privacyStatus: item.privacyStatus,
    goLiveUtc: item.goLiveUtc,
    kickoffIst: item.kickoffIst
  }));
}

function unlockStatus(now = new Date()) {
  const diffMs = unlockAt.getTime() - now.getTime();
  const absMinutes = Math.ceil(Math.abs(diffMs) / 60000);
  return {
    unlockTargetUtc: unlockAt.toISOString(),
    unlockTargetIst: "16 June 2026, 1:43 PM IST",
    unlockWindowStatus: diffMs > 0 ? "before_target" : "after_target",
    minutesToUnlockTarget: diffMs > 0 ? absMinutes : 0,
    minutesSinceUnlockTarget: diffMs <= 0 ? absMinutes : 0
  };
}

const statusRun = runNodeScript("services/youtube/check-live-status.mjs");
const listRun = runNodeScript("services/youtube/list-upcoming-broadcasts.mjs");

let liveStatus = {};
let upcoming = {};

try {
  liveStatus = parseJson(statusRun.stdout);
} catch {
  liveStatus = {
    parseError: true,
    stdout: statusRun.stdout.trim(),
    stderr: statusRun.stderr.trim()
  };
}

try {
  upcoming = parseJson(listRun.stdout);
} catch {
  upcoming = {
    parseError: true,
    stdout: listRun.stdout.trim(),
    stderr: listRun.stderr.trim()
  };
}

const readyCount = Number(upcoming.readyCount || 0);
const expectedCount = Number(upcoming.expectedCount || 0);
const missingCount = Number(upcoming.missingCount || 0);
const allPrivate = (upcoming.matches || [])
  .filter((item) => item.status === "found")
  .every((item) => item.privacyStatus === "private");

const summary = {
  generatedAt: new Date().toISOString(),
  ...unlockStatus(),
  liveReadApiReady: Boolean(liveStatus.liveReadApiReady),
  createAccessStillDependsOnStudioWait: Boolean(liveStatus.createAccessStillDependsOnStudioWait),
  expectedCount,
  readyCount,
  missingCount,
  allExpectedBroadcastsReady: expectedCount > 0 && readyCount === expectedCount,
  allReadyBroadcastsPrivate: readyCount > 0 && allPrivate,
  nextAction: missingCount > 0
    ? "Keep the YouTube retry Terminal running until missingCount becomes 0."
    : "Open YouTube Studio and review each private scheduled live before making anything public.",
  matches: compactMatches(upcoming.matches)
};

console.log(JSON.stringify(summary, null, 2));

if (!statusRun.ok || !listRun.ok) {
  process.exit(1);
}
