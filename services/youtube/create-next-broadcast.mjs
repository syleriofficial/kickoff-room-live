import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("../..", import.meta.url).pathname);
const schedulePath = resolve(root, "outputs/schedule/live-schedule.json");
const dryRun = process.env.YOUTUBE_DRY_RUN !== "false";

function nextStream(schedule) {
  const now = Date.now();
  return schedule
    .filter((item) => new Date(item.goLiveUtc).getTime() > now)
    .sort((a, b) => new Date(a.goLiveUtc) - new Date(b.goLiveUtc))[0];
}

const schedule = JSON.parse(await readFile(schedulePath, "utf8"));
const stream = nextStream(schedule);

if (!stream) {
  console.error("No upcoming stream found in outputs/schedule/live-schedule.json");
  process.exit(1);
}

console.log(JSON.stringify({
  selected: stream.id,
  match: stream.match,
  goLiveUtc: stream.goLiveUtc,
  kickoffIst: stream.kickoffIst,
  dryRun
}, null, 2));

const result = spawnSync(
  process.execPath,
  ["services/youtube/create-broadcast.mjs", stream.id],
  {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      YOUTUBE_SCHEDULED_START_TIME: stream.goLiveUtc,
      YOUTUBE_PRIVACY_STATUS: process.env.YOUTUBE_PRIVACY_STATUS || "private",
      YOUTUBE_DRY_RUN: dryRun ? "true" : "false"
    }
  }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status || 0);
