import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const outputDir = resolve(root, "outputs/thumbnails");
const streamsPath = resolve(root, "outputs/generated-stream-pack/streams.json");
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[char]);
}

function glow(hex, opacity) {
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
}

function svgFor(stream) {
  const home = escapeXml(stream.home);
  const away = escapeXml(stream.away);
  const kickoff = escapeXml(stream.kickoffIst.replace(", Wednesday June 17", ""));
  const battle = escapeXml(stream.keyBattle);
  const homeColor = stream.homeColor;
  const awayColor = stream.awayColor;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="0.55" stop-color="#111827"/>
      <stop offset="1" stop-color="#050914"/>
    </linearGradient>
    <radialGradient id="homeGlow" cx="24%" cy="28%" r="42%">
      <stop offset="0" stop-color="${glow(homeColor, 0.72)}"/>
      <stop offset="1" stop-color="${glow(homeColor, 0)}"/>
    </radialGradient>
    <radialGradient id="awayGlow" cx="84%" cy="22%" r="42%">
      <stop offset="0" stop-color="${glow(awayColor, 0.72)}"/>
      <stop offset="1" stop-color="${glow(awayColor, 0)}"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect width="1280" height="720" fill="url(#homeGlow)"/>
  <rect width="1280" height="720" fill="url(#awayGlow)"/>
  <g opacity="0.18">
    <path d="M-140 650 L530 -20" stroke="#ffffff" stroke-width="3"/>
    <path d="M-90 720 L610 20" stroke="#ffffff" stroke-width="3"/>
    <path d="M780 760 L1360 180" stroke="#ffffff" stroke-width="3"/>
    <path d="M720 700 L1280 140" stroke="#ffffff" stroke-width="3"/>
  </g>
  <rect x="54" y="52" width="164" height="58" fill="#ff3454"/>
  <text x="82" y="93" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="900">LIVE</text>
  <text x="54" y="186" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="88" font-weight="900">WORLD CUP</text>
  <text x="54" y="280" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="88" font-weight="900">WATCHALONG</text>
  <rect x="54" y="326" width="700" height="2" fill="#8fe7c8" opacity="0.72"/>
  <g font-family="Arial Black, Arial, sans-serif" font-size="58" font-weight="900">
    <rect x="54" y="386" width="26" height="62" fill="${homeColor}"/>
    <text x="104" y="438" fill="#ffffff">${home}</text>
    <rect x="54" y="472" width="26" height="62" fill="${awayColor}"/>
    <text x="104" y="524" fill="#ffffff">${away}</text>
  </g>
  <rect x="836" y="92" width="336" height="408" fill="#ffffff" opacity="0.07" stroke="#ffffff" stroke-opacity="0.22" stroke-width="3"/>
  <text x="1004" y="184" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="35" font-weight="900" text-anchor="middle">ENGLISH</text>
  <text x="1004" y="234" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="35" font-weight="900" text-anchor="middle">LIVE SCORE</text>
  <text x="1004" y="284" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="35" font-weight="900" text-anchor="middle">REACTIONS</text>
  <text x="1004" y="334" fill="#ffffff" font-family="Arial Black, Arial, sans-serif" font-size="35" font-weight="900" text-anchor="middle">+ CHAT</text>
  <rect x="870" y="382" width="268" height="54" fill="#1f8f6e"/>
  <text x="1004" y="420" fill="#06130f" font-family="Arial Black, Arial, sans-serif" font-size="27" font-weight="900" text-anchor="middle">NO FOOTAGE</text>
  <text x="54" y="624" fill="#ffcf66" font-family="Arial Black, Arial, sans-serif" font-size="35" font-weight="900">${kickoff}</text>
  <text x="54" y="668" fill="#aeb9d0" font-family="Arial, sans-serif" font-size="25" font-weight="700">${battle}</text>
</svg>
`;
}

async function exportPng(svgPath, pngPath) {
  const result = spawnSync(chromePath, [
    "--headless=new",
    "--disable-gpu",
    `--screenshot=${pngPath}`,
    "--window-size=1280,720",
    `file://${svgPath}`
  ], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`.trim());
  }

  if (!existsSync(pngPath)) {
    throw new Error(`Chrome did not produce ${pngPath}`);
  }
}

const streams = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(streamsPath, "utf8")));
await mkdir(outputDir, { recursive: true });

const thumbnails = [];
for (const stream of streams) {
  const svgPath = resolve(outputDir, `${stream.id}.svg`);
  const pngPath = resolve(outputDir, `${stream.id}.png`);
  await writeFile(svgPath, svgFor(stream));
  await rm(pngPath, { force: true });
  await exportPng(svgPath, pngPath);
  thumbnails.push({
    id: stream.id,
    match: `${stream.home} vs ${stream.away}`,
    svgPath: `outputs/thumbnails/${stream.id}.svg`,
    pngPath: `outputs/thumbnails/${stream.id}.png`
  });
}

await writeFile(resolve(outputDir, "thumbnails.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  thumbnails
}, null, 2)}\n`);

console.log(JSON.stringify({ count: thumbnails.length, thumbnails }, null, 2));
