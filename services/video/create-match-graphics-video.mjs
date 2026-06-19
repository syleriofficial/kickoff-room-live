import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const presetsPath = resolve(root, "outputs/watchalong-kit/match-presets.js");
const outputDir = resolve(root, "outputs/match-videos");
const streamId = process.env.STREAM_ID || process.argv[2] || "usa-aus";
const voice = process.env.GRAPHICS_VIDEO_VOICE || "Alex";
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

function wrap(text, max = 34) {
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

function textRows(rows, x, y, size, color = "#ffffff", weight = 900, spacing = 1.12) {
  return rows.map((line, index) => (
    `<text x="${x}" y="${y + index * size * spacing}" fill="${color}" font-family="Arial Black, Arial, sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`
  )).join("\n");
}

function baseDefs(match) {
  return `
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#050814"/>
      <stop offset="0.48" stop-color="#0d1529"/>
      <stop offset="1" stop-color="#030610"/>
    </linearGradient>
    <radialGradient id="homeGlow" cx="17%" cy="28%" r="58%">
      <stop offset="0" stop-color="${match.homeColor}" stop-opacity="0.58"/>
      <stop offset="1" stop-color="${match.homeColor}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="awayGlow" cx="86%" cy="20%" r="58%">
      <stop offset="0" stop-color="${match.awayColor}" stop-opacity="0.56"/>
      <stop offset="1" stop-color="${match.awayColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
}

function background(match) {
  return `
  ${baseDefs(match)}
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <rect width="1920" height="1080" fill="url(#homeGlow)"/>
  <rect width="1920" height="1080" fill="url(#awayGlow)"/>
  <g opacity="0.09" stroke="#ffffff" stroke-width="2">
    ${Array.from({ length: 31 }, (_, i) => `<path d="M${i * 64} 0 V1080"/>`).join("")}
    ${Array.from({ length: 18 }, (_, i) => `<path d="M0 ${i * 64} H1920"/>`).join("")}
  </g>
  <g opacity="0.16" stroke="#ffffff" stroke-width="4">
    <path d="M-180 980 L740 60"/>
    <path d="M-40 1088 L870 178"/>
    <path d="M1060 1120 L1940 240"/>
    <path d="M1190 1140 L2040 290"/>
  </g>
  <rect x="44" y="44" width="1832" height="992" fill="none" stroke="#ffffff" stroke-opacity="0.12"/>`;
}

function pitch(match, x = 960, y = 170, width = 820, height = 510) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#0d4a3f" stroke="#ffffff" stroke-opacity="0.34" stroke-width="3"/>
    <g opacity="0.22">
      ${Array.from({ length: 7 }, (_, i) => `<rect x="${x + i * width / 7}" y="${y}" width="${width / 7}" height="${height}" fill="${i % 2 ? "#21d4a3" : "#ffffff"}" opacity="${i % 2 ? "0.22" : "0.08"}"/>`).join("")}
    </g>
    <path d="M${cx} ${y} V${y + height}" stroke="#ffffff" stroke-opacity="0.38" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="76" fill="none" stroke="#ffffff" stroke-opacity="0.38" stroke-width="3"/>
    <rect x="${x}" y="${y + height * 0.25}" width="${width * 0.15}" height="${height * 0.5}" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"/>
    <rect x="${x + width * 0.85}" y="${y + height * 0.25}" width="${width * 0.15}" height="${height * 0.5}" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"/>
    <path d="M${x + 150} ${y + 160} C${x + 330} ${y + 125}, ${x + 510} ${y + 120}, ${x + 675} ${y + 170}" stroke="#ffbf3f" stroke-opacity="0.75" stroke-width="8" fill="none"/>
    <path d="M${x + 170} ${y + 340} C${x + 350} ${y + 285}, ${x + 540} ${y + 330}, ${x + 690} ${y + 270}" stroke="#21d4a3" stroke-opacity="0.7" stroke-width="8" fill="none"/>
    ${[
      [x + 210, y + 165, match.homeColor],
      [x + 355, y + 275, match.homeColor],
      [x + 470, y + 190, match.homeColor],
      [x + 620, y + 320, match.awayColor],
      [x + 705, y + 180, match.awayColor],
      [x + 535, y + 285, match.awayColor]
    ].map(([px, py, color]) => `<circle cx="${px}" cy="${py}" r="20" fill="${color}" stroke="#ffffff" stroke-width="6"/>`).join("")}
    <circle cx="${x + 500}" cy="${y + 252}" r="13" fill="#ffffff"/>
  </g>`;
}

function slide(match, index) {
  const home = escapeXml(match.home);
  const away = escapeXml(match.away);
  const battle = wrap(match.keyBattle, 38);
  const pulse = wrap(match.gamePulse, 27);
  const title = `${home} vs ${away}`;
  const kickoff = escapeXml(match.kickoffIst);
  const slides = [
    `
    ${background(match)}
    <rect x="80" y="86" width="246" height="92" fill="#ff3454"/>
    <text x="124" y="150" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="54" font-weight="900">LIVE</text>
    ${textRows(["WORLD CUP", "WATCHALONG"], 80, 320, 118)}
    <rect x="80" y="572" width="910" height="4" fill="#21d4a3"/>
    <rect x="80" y="655" width="36" height="102" fill="${match.homeColor}"/>
    <rect x="80" y="815" width="36" height="102" fill="${match.awayColor}"/>
    ${textRows([home], 144, 738, 82)}
    ${textRows([away], 144, 898, 82)}
    <text x="80" y="998" fill="#ffbf3f" font-family="Arial Black, Arial, sans-serif" font-size="44" font-weight="900">${kickoff}</text>
    <rect x="1180" y="196" width="540" height="540" fill="#ffffff" opacity="0.055" stroke="#ffffff" stroke-opacity="0.18"/>
    <text x="1450" y="350" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" text-anchor="middle">ENGLISH</text>
    <text x="1450" y="430" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" text-anchor="middle">LIVE SCORE</text>
    <text x="1450" y="510" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" text-anchor="middle">REACTIONS</text>
    <text x="1450" y="590" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" text-anchor="middle">+ CHAT</text>
    <rect x="1264" y="650" width="372" height="74" fill="#21d4a3"/>
    <text x="1450" y="702" fill="#06130f" font-family="Arial Black, Arial, sans-serif" font-size="38" font-weight="900" text-anchor="middle">NO FOOTAGE</text>`,
    `
    ${background(match)}
    <text x="80" y="150" fill="#21d4a3" font-family="Arial Black, Arial, sans-serif" font-size="32" font-weight="900">TACTICAL ROOM</text>
    ${textRows(wrap(title, 18).slice(0, 3), 80, 235, 58)}
    ${pitch(match, 900, 172, 820, 560)}
    <rect x="80" y="405" width="650" height="350" fill="#000000" opacity="0.36" stroke="#ffffff" stroke-opacity="0.16"/>
    <text x="120" y="492" fill="#ffbf3f" font-family="Arial Black, Arial, sans-serif" font-size="38" font-weight="900">KEY BATTLE</text>
    ${textRows(battle.slice(0, 4), 120, 570, 46, "#ffffff", 900)}
    <text x="80" y="982" fill="#c9d4e8" font-family="Arial, sans-serif" font-size="34" font-weight="800">Original animated graphics. No official footage. No broadcast audio.</text>`,
    `
    ${background(match)}
    ${pitch(match, 90, 150, 850, 560)}
    <rect x="1040" y="150" width="720" height="560" fill="#000000" opacity="0.38" stroke="#ffffff" stroke-opacity="0.16"/>
    <text x="1090" y="242" fill="#21d4a3" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="900">GAME PULSE</text>
    ${textRows(pulse.slice(0, 5), 1090, 328, 42, "#ffffff", 900)}
    <rect x="1090" y="760" width="520" height="74" fill="#ffbf3f"/>
    <text x="1350" y="812" fill="#06130f" font-family="Arial Black, Arial, sans-serif" font-size="35" font-weight="900" text-anchor="middle">SECOND SCREEN LIVE</text>
    <text x="90" y="978" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="44" font-weight="900">OPEN THE OFFICIAL BROADCAST + JOIN OUR ROOM</text>`,
    `
    ${background(match)}
    <text x="80" y="150" fill="#ffbf3f" font-family="Arial Black, Arial, sans-serif" font-size="46" font-weight="900">CHAT MISSION</text>
    ${textRows(wrap(match.chatMission, 28).slice(0, 4), 80, 265, 82)}
    <rect x="80" y="675" width="880" height="128" fill="#21d4a3"/>
    <text x="520" y="758" fill="#06130f" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" text-anchor="middle">COUNTRY + SCORE PREDICTION</text>
    <rect x="1060" y="205" width="600" height="520" fill="#ffffff" opacity="0.06" stroke="#ffffff" stroke-opacity="0.18"/>
    <text x="1360" y="360" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" text-anchor="middle">${escapeXml(match.homeShort)}</text>
    <text x="1360" y="500" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="80" font-weight="900" text-anchor="middle">VS</text>
    <text x="1360" y="640" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" text-anchor="middle">${escapeXml(match.awayShort)}</text>
    <text x="80" y="978" fill="#c9d4e8" font-family="Arial, sans-serif" font-size="34" font-weight="800">Subscribe for every World Cup watchalong on Kickoff Room Live.</text>`
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  ${slides[index]}
</svg>
`;
}

function metadata(match) {
  const script = [
    `${match.home} versus ${match.away} is the first match in our next watchalong slate.`,
    "This is Kickoff Room Live with original premium graphics, live score, match clock, fan reactions, and English commentary.",
    "There is no match footage and no broadcast audio on this video or the live stream.",
    `The key battle is ${match.keyBattle}.`,
    `Kickoff is ${match.kickoffIst}.`,
    "Open the official broadcast in your country, then join our room before kickoff.",
    "Drop your country and your full time score prediction in live chat."
  ].join(" ");
  return {
    script,
    title: `${match.home} vs ${match.away} Premium Watchalong Graphics | No Footage`,
    description: [
      `${match.home} vs ${match.away} premium no-footage watchalong graphics.`,
      "",
      "Original animated graphics only. No match footage. No broadcast audio.",
      "Join Kickoff Room Live for English live score, reactions, and chat."
    ].join("\n")
  };
}

async function exportPng(svgPath, pngPath) {
  run(chromePath, [
    "--headless=new",
    "--disable-gpu",
    `--screenshot=${pngPath}`,
    "--window-size=1920,1080",
    `file://${svgPath}`
  ]);
}

function ffmpegArgs(slidePaths, voicePath, videoPath) {
  const args = ["-y"];
  for (const path of slidePaths) {
    args.push("-loop", "1", "-t", "7", "-i", path);
  }
  args.push("-i", voicePath);
  const videoChains = slidePaths.map((_, index) => (
    `[${index}:v]scale=1920:1080,setsar=1,zoompan=z='min(zoom+0.00045,1.032)':d=210:s=1920x1080:fps=30,format=yuv420p[v${index}]`
  ));
  const xfade = [
    "[v0][v1]xfade=transition=fade:duration=0.7:offset=6.3[x1]",
    "[x1][v2]xfade=transition=smoothleft:duration=0.7:offset=12.6[x2]",
    "[x2][v3]xfade=transition=fadewhite:duration=0.7:offset=18.9[vout]"
  ];
  args.push(
    "-filter_complex",
    [...videoChains, ...xfade].join(";"),
    "-map", "[vout]",
    "-map", `${slidePaths.length}:a`,
    "-filter:a", "volume=1.15",
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
  );
  return args;
}

await mkdir(outputDir, { recursive: true });

const presets = loadPresets(await readFile(presetsPath, "utf8"));
const match = presets.find((item) => item.id === streamId) || presets[0];
if (!match) throw new Error(`No match preset found for ${streamId}`);

const base = resolve(outputDir, `${match.id}-graphics`);
const meta = metadata(match);
const voicePath = `${base}.aiff`;
const videoPath = `${base}.mp4`;
const metaPath = `${base}.json`;
const slidePaths = [];

run("say", ["-v", voice, "-r", "174", "-o", voicePath, meta.script]);

for (let i = 0; i < 4; i += 1) {
  const svgPath = `${base}-slide-${i + 1}.svg`;
  const pngPath = `${base}-slide-${i + 1}.png`;
  await writeFile(svgPath, slide(match, i));
  await rm(pngPath, { force: true });
  await exportPng(svgPath, pngPath);
  slidePaths.push(pngPath);
}

await rm(videoPath, { force: true });
run("ffmpeg", ffmpegArgs(slidePaths, voicePath, videoPath));

if (!existsSync(videoPath)) throw new Error(`Missing generated video: ${videoPath}`);

await writeFile(metaPath, `${JSON.stringify({
  id: match.id,
  match: `${match.home} vs ${match.away}`,
  title: meta.title,
  description: meta.description,
  videoPath,
  voicePath,
  slides: slidePaths,
  safeUse: "Original graphics only. Do not add match footage or broadcast audio."
}, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  id: match.id,
  match: `${match.home} vs ${match.away}`,
  videoPath,
  metaPath
}, null, 2));
