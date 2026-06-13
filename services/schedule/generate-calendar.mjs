import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(new URL("../..", import.meta.url).pathname);
const presetsPath = resolve(root, "outputs/watchalong-kit/match-presets.js");
const outputDir = resolve(root, "outputs/schedule");

function loadPresets(source) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.MATCH_PRESETS || [];
}

function icsDate(iso) {
  return iso.replaceAll("-", "").replaceAll(":", "").replace(".000", "");
}

function escapeIcs(text) {
  return String(text)
    .replaceAll("\\", "\\\\")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
    .replaceAll("\n", "\\n");
}

function event(match) {
  const start = new Date(match.goLiveUtc);
  const end = new Date(new Date(match.kickoffUtc).getTime() + 2.5 * 60 * 60 * 1000);
  const title = `Go live: ${match.home} vs ${match.away}`;
  const description = [
    "Kickoff Room Live watchalong.",
    "Format: English no-footage live score, reactions, AI voice prompts, and chat polls.",
    `Kickoff: ${match.kickoffIst}`,
    `Key battle: ${match.keyBattle}`,
    "Reminder: no match footage, no broadcast audio."
  ].join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:kickoff-room-${match.id}@kickoff-room-live`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start.toISOString())}`,
    `DTEND:${icsDate(end.toISOString())}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(title)}`,
    "END:VALARM",
    "END:VEVENT"
  ].join("\n");
}

function calendar(matches) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kickoff Room Live//Watchalong Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...matches.map(event),
    "END:VCALENDAR"
  ].join("\n");
}

function markdown(matches) {
  return `# Live Schedule

Import \`live-calendar.ics\` into Google Calendar, Apple Calendar, or Outlook.

| Match | Go Live UTC | Kickoff UTC | Kickoff IST | Key Battle |
|---|---:|---:|---|---|
${matches.map((match) => `| ${match.home} vs ${match.away} | ${match.goLiveUtc} | ${match.kickoffUtc} | ${match.kickoffIst} | ${match.keyBattle} |`).join("\n")}
`;
}

const source = await readFile(presetsPath, "utf8");
const matches = loadPresets(source);

const schedule = matches.map((match) => ({
  id: match.id,
  match: `${match.home} vs ${match.away}`,
  goLiveUtc: match.goLiveUtc,
  kickoffUtc: match.kickoffUtc,
  kickoffIst: match.kickoffIst,
  title: `${match.home} vs ${match.away} LIVE WATCHALONG | World Cup 2026 | English Live Score & Reactions | No Footage`,
  keyBattle: match.keyBattle,
  chatMission: match.chatMission
}));

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "live-calendar.ics"), `${calendar(matches)}\n`);
await writeFile(resolve(outputDir, "live-schedule.md"), markdown(matches));
await writeFile(resolve(outputDir, "live-schedule.json"), `${JSON.stringify(schedule, null, 2)}\n`);

console.log(`Generated schedule files in ${outputDir}`);
