import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const presetsPath = resolve(root, "outputs/watchalong-kit/match-presets.js");
const outputDir = resolve(root, "outputs/generated-stream-pack");

function loadPresets(source) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.MATCH_PRESETS || [];
}

function title(match) {
  return `${match.home} vs ${match.away} LIVE WATCHALONG | World Cup 2026 | English Live Score & Reactions | No Footage`;
}

function description(match) {
  return `Live English watchalong for ${match.home} vs ${match.away} at the World Cup 2026.

This stream has no match footage and no broadcast audio. Open the official broadcast in your country and use this as your second-screen live score, English AI commentary, reactions, chat polls, and match discussion.

Chat questions:
- Where are you watching from?
- Score prediction?
- First scorer?
- Player of the match?

Subscribe for every World Cup watchalong.

Disclaimer: No match footage or broadcast audio is shown on this stream.`;
}

function pinned(match) {
  return `No match footage or broadcast audio here. Open the official broadcast and sync with our timer. Drop your country + ${match.home} vs ${match.away} score prediction.`;
}

function firstMinute(match) {
  return `Welcome to Kickoff Room Live. This is an English no-footage watchalong for ${match.home} vs ${match.away}. Open the official broadcast in your country and use this stream as your second screen. Drop your country and score prediction in chat. Today's key battle is ${match.keyBattle}.`;
}

function shorts(match) {
  return [
    `${match.home} vs ${match.away}: full-time reaction in 30 seconds`,
    `The moment ${match.home} vs ${match.away} changed`,
    `Best player so far in ${match.home} vs ${match.away}`,
    `Why the key battle was ${match.keyBattle}`,
    `Chat predicted this ${match.home} vs ${match.away} moment`
  ];
}

function makeMarkdown(items) {
  return `# Generated Stream Pack

Generated from \`outputs/watchalong-kit/match-presets.js\`.

${items.map((item) => `## ${item.home} vs ${item.away}

Kickoff: **${item.kickoffIst}**

### YouTube Title

\`\`\`text
${item.youtubeTitle}
\`\`\`

### Description

\`\`\`text
${item.description}
\`\`\`

### Pinned Chat

\`\`\`text
${item.pinnedChat}
\`\`\`

### First Minute Script

\`\`\`text
${item.firstMinuteScript}
\`\`\`

### Shorts Ideas

${item.shortsIdeas.map((idea) => `- ${idea}`).join("\n")}
`).join("\n")}`;
}

function makeCsv(items) {
  const rows = [["match", "kickoff_ist", "title", "pinned_chat"]];
  for (const item of items) {
    rows.push([
      `${item.home} vs ${item.away}`,
      item.kickoffIst,
      item.youtubeTitle,
      item.pinnedChat
    ]);
  }
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

const source = await readFile(presetsPath, "utf8");
const presets = loadPresets(source);
const items = presets.map((match) => ({
  ...match,
  youtubeTitle: title(match),
  description: description(match),
  pinnedChat: pinned(match),
  firstMinuteScript: firstMinute(match),
  shortsIdeas: shorts(match)
}));

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "streams.json"), `${JSON.stringify(items, null, 2)}\n`);
await writeFile(resolve(outputDir, "streams.md"), makeMarkdown(items));
await writeFile(resolve(outputDir, "streams.csv"), `${makeCsv(items)}\n`);

console.log(`Generated ${items.length} stream packages in ${outputDir}`);
