import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const presetsPath = resolve(root, "outputs/watchalong-kit/match-presets.js");
const outputDir = resolve(root, "outputs/shorts-upload");
const streamId = process.env.STREAM_ID || process.argv[2] || "eng-cro";
const voice = process.env.SHORTS_VOICE || "Samantha";
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function loadPresets(source) {
  const fn = new Function("window", `${source}; return window.MATCH_PRESETS || [];`);
  return fn({});
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[char]);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed\n${result.stdout}\n${result.stderr}`.trim());
  }
  return result;
}

function metadata(match) {
  const title = `${match.home} vs ${match.away} is coming.`;
  const script = [
    `${match.home} versus ${match.away} is coming up tonight.`,
    "Join Kickoff Room Live for an English no footage watchalong.",
    "We bring live score, match pulse, fan reactions, and chat predictions.",
    `Key battle: ${match.keyBattle}.`,
    "Open the official broadcast, then join our live room before kickoff."
  ].join(" ");
  const caption = [
    `${match.home} vs ${match.away} preview.`,
    "No match footage. No broadcast audio.",
    "Join the English live score watchalong on Kickoff Room Live.",
    "#WorldCup2026 #FootballShorts #Watchalong #LiveReaction #NoFootage"
  ].join("\n");
  return { title, script, caption };
}

function lines(text, max = 28) {
  const words = String(text).split(/\s+/);
  const rows = [];
  let row = "";
  for (const word of words) {
    if (`${row} ${word}`.trim().length > max && row) {
      rows.push(row);
      row = word;
    } else {
      row = `${row} ${word}`.trim();
    }
  }
  if (row) rows.push(row);
  return rows;
}

function textBlock(rows, x, y, size, color = "#ffffff", weight = 900, spacing = 1.12) {
  return rows.map((row, index) => (
    `<text x="${x}" y="${y + index * size * spacing}" fill="${color}" font-family="Arial Black, Arial, sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(row)}</text>`
  )).join("\n");
}

function svgFor(match) {
  const battleRows = lines(match.keyBattle, 30);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#0b1020"/>
      <stop offset="0.58" stop-color="#111827"/>
      <stop offset="1" stop-color="#050914"/>
    </linearGradient>
    <radialGradient id="home" cx="12%" cy="18%" r="64%">
      <stop offset="0" stop-color="${match.homeColor}" stop-opacity="0.66"/>
      <stop offset="1" stop-color="${match.homeColor}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="away" cx="92%" cy="8%" r="70%">
      <stop offset="0" stop-color="${match.awayColor}" stop-opacity="0.62"/>
      <stop offset="1" stop-color="${match.awayColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect width="1080" height="1920" fill="url(#home)"/>
  <rect width="1080" height="1920" fill="url(#away)"/>
  <g opacity="0.16" stroke="#ffffff" stroke-width="4">
    <path d="M-260 1450 L770 420"/>
    <path d="M-160 1610 L900 550"/>
    <path d="M360 2020 L1240 1140"/>
    <path d="M530 1940 L1320 1150"/>
  </g>
  <rect x="72" y="94" width="240" height="92" fill="#ff3454"/>
  <text x="116" y="158" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="54" font-weight="900">LIVE</text>
  ${textBlock(["WORLD CUP", "WATCHALONG"], 72, 330, 102)}
  <rect x="72" y="555" width="816" height="4" fill="#8fe7c8" opacity="0.72"/>
  <rect x="72" y="660" width="32" height="96" fill="${match.homeColor}"/>
  <rect x="72" y="815" width="32" height="96" fill="${match.awayColor}"/>
  ${textBlock([match.home], 130, 735, 76)}
  ${textBlock([match.away], 130, 890, 76)}
  <text x="72" y="1050" fill="#ffcf66" font-family="Arial Black, Arial, sans-serif" font-size="52" font-weight="900">${escapeXml(match.kickoffIst)}</text>
  <rect x="72" y="1155" width="690" height="118" fill="#21d4a3"/>
  <text x="110" y="1230" fill="#06130f" font-family="Arial Black, Arial, sans-serif" font-size="42" font-weight="900">NO FOOTAGE / NO BROADCAST AUDIO</text>
  ${textBlock(["ENGLISH LIVE SCORE", "REACTIONS + CHAT"], 72, 1395, 60)}
  <rect x="72" y="1540" width="890" height="218" fill="#000000" opacity="0.34"/>
  <text x="110" y="1605" fill="#ffcf66" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="900">KEY BATTLE</text>
  ${textBlock(battleRows.slice(0, 3), 110, 1665, 38, "#d8e1f2", 800)}
  <text x="72" y="1844" fill="#ffcf66" font-family="Arial Black, Arial, sans-serif" font-size="42" font-weight="900">SUBSCRIBE: KICKOFF ROOM LIVE</text>
</svg>
`;
}

function exportPng(svgPath, pngPath) {
  run(chromePath, [
    "--headless=new",
    "--disable-gpu",
    `--screenshot=${pngPath}`,
    "--window-size=1080,1920",
    `file://${svgPath}`
  ]);
}

await mkdir(outputDir, { recursive: true });

const presets = loadPresets(await readFile(presetsPath, "utf8"));
const match = presets.find((item) => item.id === streamId) || presets[0];
if (!match) throw new Error("No match preset found.");

const meta = metadata(match);
const base = resolve(outputDir, `${match.id}-preview`);
const voicePath = `${base}.aiff`;
const svgPath = `${base}.svg`;
const pngPath = `${base}.png`;
const videoPath = `${base}.mp4`;
const metaPath = `${base}.json`;

run("say", ["-v", voice, "-o", voicePath, meta.script]);
await writeFile(svgPath, svgFor(match));
exportPng(svgPath, pngPath);

run("ffmpeg", [
  "-y",
  "-loop", "1",
  "-framerate", "30",
  "-i", pngPath,
  "-i", voicePath,
  "-filter:a", "volume=1.15",
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-profile:v", "high",
  "-movflags", "+faststart",
  "-c:a", "aac",
  "-b:a", "160k",
  "-shortest",
  videoPath
]);

if (!existsSync(videoPath)) throw new Error(`Missing generated video: ${videoPath}`);

await writeFile(metaPath, `${JSON.stringify({
  id: match.id,
  match: `${match.home} vs ${match.away}`,
  title: `${match.home} vs ${match.away} LIVE Watchalong Preview #Shorts`,
  description: meta.caption,
  tags: ["World Cup 2026", "football shorts", "watchalong", "live reaction", "no footage"],
  videoPath,
  svgPath,
  pngPath,
  voicePath
}, null, 2)}\n`);

console.log(JSON.stringify({ ok: true, videoPath, metaPath }, null, 2));
