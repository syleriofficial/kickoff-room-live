import { spawnSync } from "node:child_process";

const attempts = Math.max(1, Number(process.env.YOUTUBE_RETRY_ATTEMPTS || 180));
const intervalSeconds = Math.max(30, Number(process.env.YOUTUBE_RETRY_INTERVAL_SECONDS || 300));
const shouldNotify = process.env.YOUTUBE_NOTIFY !== "false";
const retryableReasons = new Set(["livePermissionBlocked", "liveStreamingNotEnabled"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reasonFrom(output) {
  for (const reason of retryableReasons) {
    if (output.includes(reason)) return reason;
  }
  return "";
}

function runCreateUpcoming() {
  return spawnSync(process.execPath, ["services/youtube/create-upcoming-broadcasts.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      YOUTUBE_DRY_RUN: "false"
    }
  });
}

function runReadiness() {
  return spawnSync(process.execPath, ["services/youtube/readiness-summary.mjs"], {
    encoding: "utf8",
    env: process.env
  });
}

function notify(title, message) {
  if (!shouldNotify || process.platform !== "darwin") return;
  spawnSync("osascript", [
    "-e",
    `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`
  ], { encoding: "utf8" });
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] YouTube create-upcoming attempt ${attempt}/${attempts}`);

  const result = runCreateUpcoming();
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status === 0) {
    console.log("YouTube upcoming broadcasts created or skipped successfully.");
    const readiness = runReadiness();
    if (readiness.stdout) process.stdout.write(readiness.stdout);
    if (readiness.stderr) process.stderr.write(readiness.stderr);
    notify("Kickoff Room Live", "YouTube upcoming broadcasts are ready to review.");
    process.exit(0);
  }

  const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
  const reason = reasonFrom(combinedOutput);
  if (!reason) {
    console.error("Stopping because the failure does not look like the live activation wait.");
    process.exit(result.status || 1);
  }

  if (attempt === attempts) {
    console.error(`Still blocked by ${reason} after ${attempts} attempts.`);
    notify("Kickoff Room Live", `YouTube retry stopped: still blocked by ${reason}.`);
    process.exit(2);
  }

  console.log(`Still blocked by ${reason}. Retrying in ${intervalSeconds} seconds.`);
  await sleep(intervalSeconds * 1000);
}
