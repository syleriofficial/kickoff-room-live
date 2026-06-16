import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const envPath = resolve(root, ".env");
const presetsPath = resolve(root, "outputs/watchalong-kit/match-presets.js");
const endpoint = "https://v3.football.api-sports.io";

export async function loadLocalEnv() {
  try {
    const raw = await readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env is optional for dry local pages.
  }
}

export async function loadPresets() {
  const raw = await readFile(presetsPath, "utf8");
  const fn = new Function("window", `${raw}; return window.MATCH_PRESETS || [];`);
  return fn({});
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamMatches(apiTeam, presetTeam, presetShort) {
  const api = normalize(apiTeam?.name);
  const wanted = normalize(presetTeam);
  const short = normalize(presetShort);
  return api === wanted || api.includes(wanted) || wanted.includes(api) || api === short;
}

function pickFixture(fixtures, preset) {
  return fixtures.find((item) => {
    const teams = item.teams || {};
    const homeOk = teamMatches(teams.home, preset.home, preset.homeShort);
    const awayOk = teamMatches(teams.away, preset.away, preset.awayShort);
    const reversedHomeOk = teamMatches(teams.home, preset.away, preset.awayShort);
    const reversedAwayOk = teamMatches(teams.away, preset.home, preset.homeShort);
    return (homeOk && awayOk) || (reversedHomeOk && reversedAwayOk);
  });
}

function eventLine(event, fixture) {
  const minute = event.time?.elapsed ? `${event.time.elapsed}'` : "Live";
  const team = event.team?.name || "Match";
  const player = event.player?.name ? ` - ${event.player.name}` : "";
  if (event.type === "Goal") return `${minute}: Goal for ${team}${player}.`;
  if (event.type === "Card") return `${minute}: ${event.detail || "Card"} for ${team}${player}.`;
  if (event.type === "subst") return `${minute}: Substitution for ${team}.`;
  return `${minute}: ${event.type || "Update"} for ${team}${player}.`;
}

async function apiFootball(path, params = {}) {
  const key = process.env.API_FOOTBALL_KEY || process.env.APISPORTS_KEY;
  if (!key) {
    return {
      ok: false,
      keyMissing: true,
      message: "Add API_FOOTBALL_KEY to .env to enable automated live scores."
    };
  }

  const url = new URL(`${endpoint}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(name, value);
  }

  const response = await fetch(url, {
    headers: { "x-apisports-key": key }
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.token || payload.errors?.requests) {
    return {
      ok: false,
      status: response.status,
      message: "API-Football returned an error.",
      errors: payload.errors || payload
    };
  }
  return { ok: true, payload };
}

export async function getLiveScore(presetId) {
  await loadLocalEnv();
  const presets = await loadPresets();
  const preset = presets.find((item) => item.id === presetId) || presets[0];
  if (!preset) return { ok: false, message: "No match preset found." };

  const live = await apiFootball("/fixtures", { live: "all" });
  if (!live.ok) return { ...live, preset };

  const fixtures = live.payload.response || [];
  const fixture = pickFixture(fixtures, preset);
  if (!fixture) {
    return {
      ok: true,
      live: false,
      preset,
      checkedAt: new Date().toISOString(),
      message: `${preset.home} vs ${preset.away} is not in API-Football live fixtures yet. Use manual score until kickoff/live feed appears.`
    };
  }

  const eventsResult = await apiFootball("/fixtures/events", { fixture: fixture.fixture?.id });
  const events = eventsResult.ok ? eventsResult.payload.response || [] : [];
  const lastEvent = events.at(-1);
  const goals = fixture.goals || {};
  const teams = fixture.teams || {};
  const homeIsPresetHome = teamMatches(teams.home, preset.home, preset.homeShort);
  const homeScore = homeIsPresetHome ? goals.home : goals.away;
  const awayScore = homeIsPresetHome ? goals.away : goals.home;
  const elapsed = fixture.fixture?.status?.elapsed;

  return {
    ok: true,
    live: true,
    preset,
    checkedAt: new Date().toISOString(),
    fixtureId: fixture.fixture?.id,
    status: fixture.fixture?.status?.short || fixture.fixture?.status?.long || "LIVE",
    elapsed,
    homeScore: Number(homeScore || 0),
    awayScore: Number(awayScore || 0),
    events: events.slice(-5).map((event) => ({
      minute: event.time?.elapsed || null,
      type: event.type,
      detail: event.detail,
      team: event.team?.name || "",
      player: event.player?.name || "",
      line: eventLine(event, fixture)
    })),
    commentaryLine: lastEvent
      ? eventLine(lastEvent, fixture)
      : `Live score: ${preset.home} ${Number(homeScore || 0)}, ${preset.away} ${Number(awayScore || 0)}.`
  };
}
