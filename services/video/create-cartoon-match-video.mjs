import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const presetsPath = resolve(root, "outputs/watchalong-kit/match-presets.js");
const outputDir = resolve(root, "outputs/cartoon-videos");
const runtimeDir = resolve(root, "outputs/runtime/cartoon-frames");
const streamId = process.env.STREAM_ID || process.argv[2] || "usa-aus";
const fps = Number(process.env.CARTOON_VIDEO_FPS || 2);
const duration = Number(process.env.CARTOON_VIDEO_SECONDS || 26);
const voice = process.env.CARTOON_VIDEO_VOICE || "Alex";
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return result;
}

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

function ease(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function between(t, start, end) {
  return ease((t - start) / (end - start));
}

function pointOnPath(t, points) {
  const segment = duration / (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(t / segment));
  const local = ease((t - index * segment) / segment);
  return {
    x: lerp(points[index].x, points[index + 1].x, local),
    y: lerp(points[index].y, points[index + 1].y, local)
  };
}

function wrap(text, max = 38) {
  const rows = [];
  let row = "";
  for (const word of String(text).split(/\s+/)) {
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

function textRows(rows, x, y, size, color = "#ffffff", weight = 900, spacing = 1.14) {
  return rows.map((line, index) => (
    `<text x="${x}" y="${y + index * size * spacing}" fill="${color}" font-family="Arial Black, Arial, sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`
  )).join("\n");
}

function player({ x, y, color, number, scale = 1, flip = 1, keeper = false }) {
  const shirt = keeper ? "#ff5a36" : color;
  const arm = flip > 0 ? "M-24 16 L-54 38" : "M24 16 L54 38";
  const arm2 = flip > 0 ? "M24 16 L48 5" : "M-24 16 L-48 5";
  return `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="62" rx="32" ry="9" fill="#000000" opacity="0.28"/>
    <path d="${arm}" stroke="#f0c8a0" stroke-width="12" stroke-linecap="round"/>
    <path d="${arm2}" stroke="#f0c8a0" stroke-width="12" stroke-linecap="round"/>
    <path d="M-20 72 L-38 112" stroke="#f7f7f7" stroke-width="14" stroke-linecap="round"/>
    <path d="M18 72 L42 108" stroke="#f7f7f7" stroke-width="14" stroke-linecap="round"/>
    <path d="M-34 18 Q0 -5 34 18 L24 76 Q0 92 -24 76 Z" fill="${shirt}" stroke="#ffffff" stroke-width="5"/>
    <circle cx="0" cy="-18" r="28" fill="#f0c8a0" stroke="#ffffff" stroke-width="5"/>
    <path d="M-23 -30 Q0 -55 24 -30" fill="none" stroke="#171717" stroke-width="10" stroke-linecap="round"/>
    <text x="0" y="53" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="28" font-weight="900" text-anchor="middle">${number}</text>
  </g>`;
}

function ball(x, y, pulse) {
  const r = 17 + Math.sin(pulse * 9) * 2;
  return `
  <g transform="translate(${x} ${y})">
    <ellipse cx="2" cy="28" rx="24" ry="7" fill="#000000" opacity="0.34"/>
    <circle cx="0" cy="0" r="${r}" fill="#ffffff" stroke="#101827" stroke-width="4"/>
    <path d="M-10 -4 L0 -13 L11 -4 L7 10 L-8 10 Z" fill="#111827"/>
    <path d="M-16 -11 L-28 -20 M16 -11 L28 -20 M-16 13 L-28 22 M16 13 L28 22" stroke="#111827" stroke-width="4" stroke-linecap="round"/>
  </g>`;
}

function stadium(match) {
  const crowd = Array.from({ length: 78 }, (_, index) => {
    const x = 42 + (index % 39) * 47;
    const y = 76 + Math.floor(index / 39) * 54;
    const color = index % 5 === 0 ? match.homeColor : index % 5 === 1 ? match.awayColor : index % 5 === 2 ? "#ffffff" : index % 5 === 3 ? "#21d4a3" : "#ffbf3f";
    return `<circle cx="${x}" cy="${y}" r="${12 + (index % 3)}" fill="${color}" opacity="0.86"/>`;
  }).join("");
  return `
  <rect width="1920" height="1080" fill="#07101f"/>
  <rect x="0" y="0" width="1920" height="170" fill="#101827"/>
  <rect x="0" y="910" width="1920" height="170" fill="#101827"/>
  <g opacity="0.86">${crowd}</g>
  <g transform="translate(0 910)" opacity="0.72">${crowd}</g>
  <g opacity="0.14" stroke="#ffffff" stroke-width="2">
    ${Array.from({ length: 31 }, (_, i) => `<path d="M${i * 64} 0 V1080"/>`).join("")}
    ${Array.from({ length: 18 }, (_, i) => `<path d="M0 ${i * 64} H1920"/>`).join("")}
  </g>`;
}

function pitch() {
  return `
  <g>
    <rect x="110" y="178" width="1700" height="724" rx="10" fill="#0a513d" stroke="#ffffff" stroke-opacity="0.55" stroke-width="5"/>
    <g opacity="0.22">
      ${Array.from({ length: 10 }, (_, i) => `<rect x="${110 + i * 170}" y="178" width="170" height="724" fill="${i % 2 ? "#21d4a3" : "#ffffff"}" opacity="${i % 2 ? "0.18" : "0.08"}"/>`).join("")}
    </g>
    <path d="M960 178 V902" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4"/>
    <circle cx="960" cy="540" r="118" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4"/>
    <circle cx="960" cy="540" r="8" fill="#ffffff" opacity="0.7"/>
    <rect x="110" y="360" width="184" height="360" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4"/>
    <rect x="1626" y="360" width="184" height="360" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4"/>
    <rect x="110" y="440" width="78" height="200" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4"/>
    <rect x="1732" y="440" width="78" height="200" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4"/>
  </g>`;
}

function actionLabel(t) {
  if (t < 5.5) return "Midfield press breaks the line";
  if (t < 11) return "Wide runner drives into space";
  if (t < 16.5) return "Low cross flashes across goal";
  if (t < 21.5) return "Shot on target, keeper reacts";
  return "Animated recap, join the live room";
}

function frameSvg(match, frameIndex) {
  const t = frameIndex / fps;
  const ballPath = [
    { x: 690, y: 560 },
    { x: 880, y: 486 },
    { x: 1160, y: 395 },
    { x: 1420, y: 498 },
    { x: 1620, y: 535 },
    { x: 1485, y: 655 }
  ];
  const b = pointOnPath(t, ballPath);
  const run1 = between(t, 0, 10);
  const run2 = between(t, 7, 18);
  const shot = between(t, 16, 22);
  const flash = Math.max(0, Math.sin((t - 17.5) * Math.PI * 3)) * (t > 17 && t < 20 ? 1 : 0);
  const clock = `${String(18 + Math.floor(t / 3)).padStart(2, "0")}:${String(Math.floor((t * 11) % 60)).padStart(2, "0")}`;
  const scoreHome = t > 22 ? 1 : 0;
  const ticker = wrap(match.gamePulse, 64).slice(0, 2);
  const subtitle = actionLabel(t);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#09111f"/>
      <stop offset="0.55" stop-color="#111827"/>
      <stop offset="1" stop-color="#07101f"/>
    </linearGradient>
    <radialGradient id="homeGlow" cx="20%" cy="30%" r="60%">
      <stop offset="0" stop-color="${match.homeColor}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${match.homeColor}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="awayGlow" cx="82%" cy="34%" r="60%">
      <stop offset="0" stop-color="${match.awayColor}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${match.awayColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <rect width="1920" height="1080" fill="url(#homeGlow)"/>
  <rect width="1920" height="1080" fill="url(#awayGlow)"/>
  ${stadium(match)}
  ${pitch()}
  <path d="M690 560 C870 485, 1070 430, 1160 395 S1440 460, 1620 535" fill="none" stroke="#ffbf3f" stroke-width="10" stroke-linecap="round" stroke-dasharray="18 18" opacity="0.42"/>
  <path d="M1435 505 L1640 535" stroke="#ffffff" stroke-width="${8 + flash * 12}" opacity="${0.18 + flash * 0.5}" stroke-linecap="round"/>
  ${player({ x: 286, y: 545, color: match.awayColor, number: 1, scale: 0.86, keeper: true })}
  ${player({ x: 1638 + shot * 28, y: 542 + shot * 78, color: match.awayColor, number: 1, scale: 0.9, flip: -1, keeper: true })}
  ${player({ x: 515 + Math.sin(t * 1.5) * 12, y: 438, color: match.homeColor, number: 4, scale: 0.72 })}
  ${player({ x: 620 + run1 * 310, y: 595 - run1 * 118, color: match.homeColor, number: 8, scale: 0.78 })}
  ${player({ x: 840 + run1 * 340, y: 410 + Math.sin(t) * 10, color: match.homeColor, number: 10, scale: 0.82 })}
  ${player({ x: 1180 + run2 * 300, y: 650 - run2 * 105, color: match.homeColor, number: 9, scale: 0.82 })}
  ${player({ x: 780 + Math.sin(t * 1.8) * 18, y: 680, color: match.awayColor, number: 5, scale: 0.76, flip: -1 })}
  ${player({ x: 1040 + run1 * 120, y: 530 + run1 * 70, color: match.awayColor, number: 6, scale: 0.76, flip: -1 })}
  ${player({ x: 1315 + run2 * 120, y: 430 + Math.sin(t * 2) * 16, color: match.awayColor, number: 3, scale: 0.76, flip: -1 })}
  ${player({ x: 1500 + Math.sin(t * 1.2) * 20, y: 720, color: match.awayColor, number: 2, scale: 0.74, flip: -1 })}
  ${ball(b.x, b.y - Math.sin(t * Math.PI * 3) * 13, t)}
  <rect x="48" y="32" width="580" height="94" rx="12" fill="#050814" opacity="0.94" stroke="#ffffff" stroke-opacity="0.16"/>
  <text x="78" y="72" fill="#21d4a3" font-family="Arial Black, Arial, sans-serif" font-size="21" font-weight="900">ANIMATED SIMULATION</text>
  <text x="78" y="108" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="900">${escapeXml(match.homeShort)} ${scoreHome} - 0 ${escapeXml(match.awayShort)}</text>
  <text x="482" y="108" fill="#ffbf3f" font-family="Arial Black, Arial, sans-serif" font-size="32" font-weight="900">${clock}</text>
  <rect x="706" y="32" width="1166" height="94" rx="12" fill="#050814" opacity="0.78" stroke="#ffffff" stroke-opacity="0.16"/>
  <text x="736" y="72" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="26" font-weight="900">${escapeXml(match.home)} vs ${escapeXml(match.away)}</text>
  <text x="736" y="108" fill="#c9d4e8" font-family="Arial, sans-serif" font-size="27" font-weight="800">Original cartoon action. No official footage. No broadcast audio.</text>
  <rect x="48" y="922" width="1824" height="112" rx="14" fill="#050814" opacity="0.9" stroke="#ffffff" stroke-opacity="0.12"/>
  <text x="82" y="974" fill="#ffbf3f" font-family="Arial Black, Arial, sans-serif" font-size="36" font-weight="900">${escapeXml(subtitle)}</text>
  ${textRows(ticker, 82, 1014, 25, "#d8e1f2", 800, 1.05)}
  <text x="1600" y="994" fill="#21d4a3" font-family="Arial Black, Arial, sans-serif" font-size="30" font-weight="900" text-anchor="middle">KICKOFF ROOM LIVE</text>
</svg>
`;
}

function metadata(match) {
  const script = [
    `${match.home} versus ${match.away}, animated match simulation from Kickoff Room Live.`,
    "This is original cartoon action only, with no official footage and no broadcast audio.",
    "Watch the movement: the press opens midfield, the runner attacks the channel, and the low cross creates the chance.",
    `The key battle is ${match.keyBattle}.`,
    "For the real match, open the official broadcast in your country, then join our English live score watchalong."
  ].join(" ");
  return {
    script,
    title: `${match.home} vs ${match.away} Cartoon Match Simulation | No Footage`,
    description: [
      `${match.home} vs ${match.away} original cartoon match simulation.`,
      "",
      "Animated recreation only. No match footage. No broadcast audio.",
      "Made for Kickoff Room Live English watchalong viewers."
    ].join("\n")
  };
}

async function writeFrames(match, frameDir) {
  const frameCount = Math.round(duration * fps);
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  for (let index = 0; index < frameCount; index += 1) {
    const framePath = resolve(frameDir, `frame-${String(index + 1).padStart(5, "0")}.svg`);
    const pngPath = resolve(frameDir, `frame-${String(index + 1).padStart(5, "0")}.png`);
    await writeFile(framePath, frameSvg(match, index));
    run(chromePath, [
      "--headless=new",
      "--disable-gpu",
      `--screenshot=${pngPath}`,
      "--window-size=1920,1080",
      `file://${framePath}`
    ]);
  }
}

await mkdir(outputDir, { recursive: true });
await mkdir(runtimeDir, { recursive: true });

const presets = loadPresets(await readFile(presetsPath, "utf8"));
const match = presets.find((item) => item.id === streamId) || presets[0];
if (!match) throw new Error(`No match preset found for ${streamId}`);

const base = resolve(outputDir, `${match.id}-cartoon-simulation`);
const frameDir = resolve(runtimeDir, match.id);
const voicePath = `${base}.aiff`;
const videoPath = `${base}.mp4`;
const coverPath = `${base}-cover.jpg`;
const metaPath = `${base}.json`;
const meta = metadata(match);

await writeFrames(match, frameDir);
run("say", ["-v", voice, "-r", "170", "-o", voicePath, meta.script]);
await rm(videoPath, { force: true });
run("ffmpeg", [
  "-y",
  "-framerate", String(fps),
  "-i", resolve(frameDir, "frame-%05d.png"),
  "-i", voicePath,
  "-vf", "minterpolate=fps=30:mi_mode=blend,scale=1920:1080,format=yuv420p",
  "-filter:a", "volume=1.12",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "18",
  "-pix_fmt", "yuv420p",
  "-profile:v", "high",
  "-c:a", "aac",
  "-b:a", "160k",
  "-movflags", "+faststart",
  "-shortest",
  videoPath
]);

run("ffmpeg", [
  "-y",
  "-ss", "00:00:12",
  "-i", videoPath,
  "-frames:v", "1",
  "-update", "1",
  coverPath
]);

if (!existsSync(videoPath)) throw new Error(`Missing generated video: ${videoPath}`);

await writeFile(metaPath, `${JSON.stringify({
  id: match.id,
  match: `${match.home} vs ${match.away}`,
  title: meta.title,
  description: meta.description,
  videoPath,
  coverPath,
  voicePath,
  frameSource: frameDir,
  safeUse: "Original cartoon simulation only. Do not represent it as official footage or add broadcast audio."
}, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  id: match.id,
  match: `${match.home} vs ${match.away}`,
  videoPath,
  coverPath,
  metaPath
}, null, 2));
