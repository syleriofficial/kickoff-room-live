import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const streamsPath = resolve(root, "outputs/generated-stream-pack/streams.json");
const outputDir = resolve(root, "outputs/shorts-kit");

function ideas(stream) {
  const match = `${stream.home} vs ${stream.away}`;
  return [
    {
      type: "full-time",
      title: `${match}: Full-Time Reaction in 30 Seconds`,
      hook: `The biggest story from ${match} was clear.`,
      caption: `${match} full-time reaction. No footage, just fan analysis and match reaction.`,
      shotList: ["score graphic", "one big turning point", "player of the match", "next match CTA"]
    },
    {
      type: "turning-point",
      title: `The Moment ${match} Changed`,
      hook: `This was the moment the match shifted.`,
      caption: `The key turning point from ${match}, explained fast.`,
      shotList: ["timer graphic", "momentum meter", "one-sentence explanation", "chat question"]
    },
    {
      type: "key-battle",
      title: `Why ${stream.keyBattle} Mattered`,
      hook: `This matchup decided more than people expected.`,
      caption: `${stream.keyBattle} was one of the biggest tactical stories in ${match}.`,
      shotList: ["key battle text", "team colors", "tactical note", "subscribe CTA"]
    },
    {
      type: "prediction",
      title: `Chat Predicted This ${match} Moment`,
      hook: `The live chat saw this coming.`,
      caption: `Live chat predictions during ${match}. Join the next no-footage watchalong.`,
      shotList: ["chat prompt", "prediction graphic", "result/reaction", "next live CTA"]
    },
    {
      type: "best-player",
      title: `Best Player So Far: ${match}`,
      hook: `One player stood above the rest.`,
      caption: `Quick player-of-the-match debate from ${match}. Comment your pick.`,
      shotList: ["player role text", "stat/momentum graphic", "why they mattered", "comment prompt"]
    }
  ];
}

function hashtags(stream) {
  const home = stream.home.replace(/\s+/g, "");
  const away = stream.away.replace(/\s+/g, "");
  return [
    "#WorldCup2026",
    "#FootballShorts",
    "#LiveReaction",
    "#Watchalong",
    `#${home}`,
    `#${away}`,
    "#NoFootage"
  ];
}

function markdown(items) {
  return `# Shorts Kit

Use these after every live stream. Record or clip only original graphics, your overlay, your AI/human commentary, and your own reactions. Do not use match footage or broadcast audio.

${items.map((item) => `## ${item.match}

Hashtags: ${item.hashtags.join(" ")}

${item.ideas.map((idea, index) => `### ${index + 1}. ${idea.title}

- Type: ${idea.type}
- Hook: ${idea.hook}
- Caption: ${idea.caption}
- Shot list: ${idea.shotList.join(" -> ")}
`).join("\n")}
`).join("\n")}`;
}

const streams = JSON.parse(await readFile(streamsPath, "utf8"));
const items = streams.map((stream) => ({
  id: stream.id,
  match: `${stream.home} vs ${stream.away}`,
  hashtags: hashtags(stream),
  ideas: ideas(stream)
}));

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "shorts-kit.json"), `${JSON.stringify(items, null, 2)}\n`);
await writeFile(resolve(outputDir, "shorts-kit.md"), markdown(items));

console.log(`Generated Shorts kit in ${outputDir}`);
