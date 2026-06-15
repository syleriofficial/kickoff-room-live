import { spawnSync } from "node:child_process";

const attempts = Math.max(1, Number(process.env.YOUTUBE_RETRY_ATTEMPTS || 12));
const intervalSeconds = Math.max(30, Number(process.env.YOUTUBE_RETRY_INTERVAL_SECONDS || 300));
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

function runCreateNext() {
  return spawnSync(process.execPath, ["services/youtube/create-next-broadcast.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      YOUTUBE_DRY_RUN: "false"
    }
  });
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] YouTube create attempt ${attempt}/${attempts}`);

  const result = runCreateNext();
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status === 0) {
    console.log("YouTube broadcast created successfully.");
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
    process.exit(2);
  }

  console.log(`Still blocked by ${reason}. Retrying in ${intervalSeconds} seconds.`);
  await sleep(intervalSeconds * 1000);
}
