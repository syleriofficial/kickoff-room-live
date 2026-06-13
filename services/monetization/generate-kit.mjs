import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const streamsPath = resolve(root, "outputs/generated-stream-pack/streams.json");
const outputDir = resolve(root, "outputs/monetization-kit");

function affiliateBlock() {
  return `Support the stream:

- Football gear: ADD_AFFILIATE_LINK
- Streaming setup: ADD_AFFILIATE_LINK
- Fan merch: ADD_AFFILIATE_LINK

Disclosure: Some links may be affiliate links. If you buy through them, the channel may earn a small commission at no extra cost to you.`;
}

function rateCard() {
  return `# Sponsor Rate Card

Start low while the channel is new. Increase only after consistent viewers and Shorts views.

## Launch Pricing

- Pinned chat mention: $5-$15 per match
- Lower-third sponsor mention: $10-$25 per match
- 30-second live read: $15-$50 per match
- Shorts sponsor caption: $10-$30 per Short
- Bundle: 3 matches + 3 Shorts for $50-$120

## What Sponsors Get

- English no-footage football watchalong audience
- Live score and reaction viewers
- Match-specific pinned chat or description placement
- Optional post-match Shorts caption

## Safe Sponsor Categories

- football merchandise sellers
- sports accessories
- gaming accessories
- creator tools
- snacks and beverages
- local cafes or screening venues

Avoid betting sponsors until legal and platform policy checks are complete.`;
}

function pitch() {
  return `Subject: World Cup watchalong promo slot

Hi,

I run Kickoff Room Live, an English no-footage football watchalong channel covering World Cup matches with live score, AI commentary prompts, chat polls, and fan reactions.

I can promote your product/page during live streams and Shorts through:

- pinned chat placement
- stream description placement
- lower-third sponsor mention
- short live read
- post-match Shorts caption

Would you like a low-cost promo slot for upcoming World Cup matches?

Best,
Kickoff Room Live`;
}

function matchSponsorCopy(stream) {
  return {
    id: stream.id,
    match: `${stream.home} vs ${stream.away}`,
    pinnedSponsor: `Sponsor slot available for ${stream.home} vs ${stream.away}. DM/contact to promote football gear, fan merch, snacks, or creator tools.`,
    liveRead: `Quick sponsor note: today's ${stream.home} vs ${stream.away} watchalong sponsor helps keep Kickoff Room Live running. Check the link in the description and support the stream.`,
    descriptionBlock: `${affiliateBlock()}\n\nSponsor this match: contact Kickoff Room Live for pinned chat, lower-third, and Shorts promo slots.`
  };
}

function markdown(streams) {
  const matchBlocks = streams.map((stream) => {
    const copy = matchSponsorCopy(stream);
    return `## ${copy.match}

### Pinned Sponsor

\`\`\`text
${copy.pinnedSponsor}
\`\`\`

### Live Read

\`\`\`text
${copy.liveRead}
\`\`\`

### Description Block

\`\`\`text
${copy.descriptionBlock}
\`\`\`
`;
  }).join("\n");

  return `# Monetization Kit

## Affiliate Block

\`\`\`text
${affiliateBlock()}
\`\`\`

${rateCard()}

## Sponsor Pitch

\`\`\`text
${pitch()}
\`\`\`

# Match Sponsor Copy

${matchBlocks}`;
}

const streams = JSON.parse(await readFile(streamsPath, "utf8"));
const kit = {
  affiliateBlock: affiliateBlock(),
  sponsorPitch: pitch(),
  rateCard: rateCard(),
  matches: streams.map(matchSponsorCopy)
};

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "monetization-kit.json"), `${JSON.stringify(kit, null, 2)}\n`);
await writeFile(resolve(outputDir, "monetization-kit.md"), markdown(streams));

console.log(`Generated monetization kit in ${outputDir}`);
