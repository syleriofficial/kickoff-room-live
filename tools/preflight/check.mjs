import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("../..", import.meta.url).pathname);

const requiredFiles = [
  "index.html",
  "README.md",
  ".gitignore",
  "outputs/watchalong-kit/dashboard.html",
  "outputs/watchalong-kit/control.html",
  "outputs/watchalong-kit/overlay.html",
  "outputs/watchalong-kit/thumbnail.html",
  "outputs/watchalong-kit/config.js",
  "outputs/watchalong-kit/match-presets.js",
  "outputs/watchalong-kit/script.js",
  "outputs/generated-stream-pack/streams.json",
  "outputs/generated-stream-pack/streams.md",
  "outputs/generated-stream-pack/streams.csv",
  "outputs/monetization-kit/monetization-kit.json",
  "outputs/monetization-kit/monetization-kit.md",
  "outputs/schedule/live-calendar.ics",
  "outputs/schedule/live-schedule.json",
  "outputs/schedule/live-schedule.md",
  "outputs/shorts-kit/shorts-kit.json",
  "outputs/shorts-kit/shorts-kit.md",
  "outputs/shorts-kit/README.md",
  "services/automation-api/server.mjs",
  "services/youtube/create-broadcast.mjs",
  "services/telegram/send-reminder.mjs",
  "services/monetization/generate-kit.mjs",
  "services/shorts/generate-shorts.mjs"
];

const secretPatterns = [
  /YOUTUBE_REFRESH_TOKEN\s*=\s*[A-Za-z0-9/_-]{40,}/i,
  /YOUTUBE_CLIENT_SECRET\s*=\s*GOCSPX-[A-Za-z0-9_-]{20,}/i,
  /TELEGRAM_BOT_TOKEN\s*=\s*\d+:[A-Za-z0-9_-]+/i,
  /AIza[0-9A-Za-z_-]{35}/,
  /ghp_[0-9A-Za-z_]{30,}/,
  /-----BEGIN PRIVATE KEY-----/
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe"
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim()
  };
}

async function exists(file) {
  try {
    await access(resolve(root, file), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function checkRequiredFiles() {
  const missing = [];
  for (const file of requiredFiles) {
    if (!(await exists(file))) missing.push(file);
  }
  return {
    name: "required files",
    ok: missing.length === 0,
    detail: missing.length ? `Missing: ${missing.join(", ")}` : `${requiredFiles.length} files present`
  };
}

async function checkStreams() {
  const raw = await readFile(resolve(root, "outputs/generated-stream-pack/streams.json"), "utf8");
  const streams = JSON.parse(raw);
  const ids = streams.map((stream) => stream.id);
  const bad = streams.filter((stream) => !stream.youtubeTitle || !stream.description || !stream.pinnedChat);
  return {
    name: "stream packages",
    ok: streams.length >= 1 && bad.length === 0,
    detail: `${streams.length} streams: ${ids.join(", ")}`
  };
}

async function checkMonetization() {
  const raw = await readFile(resolve(root, "outputs/monetization-kit/monetization-kit.json"), "utf8");
  const kit = JSON.parse(raw);
  const ok = Boolean(kit.affiliateBlock && kit.sponsorPitch && kit.rateCard && kit.matches?.length);
  return {
    name: "monetization kit",
    ok,
    detail: ok ? `${kit.matches.length} match sponsor packages` : "missing required monetization fields"
  };
}

async function checkSecretLeaks() {
  const files = run("git", ["ls-files"]);
  if (!files.ok) {
    return { name: "secret scan", ok: false, detail: files.output };
  }
  const tracked = files.output
    .split("\n")
    .filter(Boolean)
    .filter((file) => file !== "tools/preflight/check.mjs");
  const findings = [];
  for (const file of tracked) {
    const path = resolve(root, file);
    let text = "";
    try {
      text = await readFile(path, "utf8");
    } catch {
      continue;
    }
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) findings.push(file);
    }
  }
  return {
    name: "secret scan",
    ok: findings.length === 0,
    detail: findings.length ? `Potential secrets in: ${[...new Set(findings)].join(", ")}` : "no obvious committed secrets"
  };
}

async function checkCommands() {
  const checks = [
    ["npm", ["run", "check"]],
    ["npm", ["run", "youtube:create-dry-run", "--", "bra-mar"]],
    ["npm", ["run", "telegram:dry-run", "--", "bra-mar"]]
  ];
  const failures = [];
  for (const [cmd, args] of checks) {
    const result = run(cmd, args);
    if (!result.ok) failures.push(`${cmd} ${args.join(" ")}\n${result.output}`);
  }
  return {
    name: "dry-run commands",
    ok: failures.length === 0,
    detail: failures.length ? failures.join("\n\n") : `${checks.length} commands passed`
  };
}

const checks = [
  await checkRequiredFiles(),
  await checkStreams(),
  await checkMonetization(),
  await checkSecretLeaks(),
  await checkCommands()
];

let failed = false;
for (const check of checks) {
  const icon = check.ok ? "PASS" : "FAIL";
  console.log(`${icon} ${check.name}: ${check.detail}`);
  if (!check.ok) failed = true;
}

if (failed) process.exit(1);

console.log("\nPreflight complete. Project is ready for the next live setup step.");
