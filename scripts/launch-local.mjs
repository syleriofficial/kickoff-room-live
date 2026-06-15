import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const port = Number(process.env.PORT || 5173);

function run(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("close", (code) => resolvePromise({ code, output: output.trim() }));
  });
}

async function nextMatch() {
  const raw = await readFile(resolve(root, "outputs/schedule/live-schedule.json"), "utf8");
  const schedule = JSON.parse(raw);
  const now = Date.now();
  return schedule
    .filter((item) => new Date(item.goLiveUtc).getTime() > now)
    .sort((a, b) => new Date(a.goLiveUtc) - new Date(b.goLiveUtc))[0];
}

console.log("Kickoff Room Live local launch");
console.log("");

const preflight = await run("npm", ["run", "preflight"]);
console.log(preflight.output);
console.log("");

if (preflight.code !== 0) {
  console.error("Preflight failed. Fix the issues above before launching.");
  process.exit(preflight.code);
}

const next = await nextMatch();
if (next) {
  console.log(`Next match: ${next.match}`);
  console.log(`Go live UTC: ${next.goLiveUtc}`);
  console.log(`Kickoff: ${next.kickoffIst}`);
} else {
  console.log("No upcoming match found in the schedule.");
}

console.log("");
console.log("Local URLs:");
console.log(`Live ops:       http://127.0.0.1:${port}/ops`);
console.log(`Rehearsal:      http://127.0.0.1:${port}/rehearsal`);
console.log(`OBS setup:      http://127.0.0.1:${port}/obs-setup`);
console.log(`Revenue ops:    http://127.0.0.1:${port}/revenue`);
console.log(`Dashboard:      http://127.0.0.1:${port}/dashboard`);
console.log(`Readiness:      http://127.0.0.1:${port}/readiness`);
console.log(`OBS overlay:    http://127.0.0.1:${port}/overlay`);
console.log(`Producer panel: http://127.0.0.1:${port}/control`);
console.log(`Trailer:        http://127.0.0.1:${port}/trailer`);
console.log(`Short preview:  http://127.0.0.1:${port}/shorts/ger-cur/preview`);
console.log("");
console.log("Manual still needed:");
console.log("- Upload avatar in YouTube Studio Branding");
console.log("- Set YouTube upload defaults");
console.log("- Wait until YouTube Live verification is fully active");
console.log("");
console.log("Starting tools server. Press Ctrl+C to stop.");
console.log("");

const server = spawn("npm", ["run", "start:tools"], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit"
});

server.on("close", (code) => process.exit(code || 0));
