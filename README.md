# Kickoff Room Live

English no-footage football watchalong system for YouTube.

This project contains:

- Website launcher for GitHub Pages
- OBS overlay for live watchalongs
- Producer control panel
- Command center for stream copy and checklist
- Stream package generator
- Cloud Run automation API scaffold
- YouTube OAuth automation scaffold
- Telegram reminder automation scaffold
- Monetization kit generator
- Calendar schedule generator
- Shorts kit generator
- Preflight checker
- GitHub Actions checks
- GitHub Pages deploy workflow
- Cloud Run deploy config
- Local OBS/tools server
- Match presets
- YouTube channel setup kit
- Google Cloud / YouTube API automation plan

## Important Rules

- Do not show match footage.
- Do not play broadcast audio.
- Do not commit secrets.
- Use original graphics, scoreboards, commentary lines, and chat prompts.

## Folders

- `index.html`: launcher for all tools when hosted on GitHub Pages
- `tools/generate-stream-pack.mjs`: creates stream titles, descriptions, pinned chats, scripts, Shorts ideas, JSON, Markdown, and CSV
- `tools/preflight/check.mjs`: checks project readiness before stream/deploy
- `services/automation-api`: Cloud Run-ready API for stream packages
- `services/local-tools-server`: local server for OBS/browser tool URLs
- `services/youtube`: OAuth helpers and scheduled live dry-run/create script
- `services/telegram`: Telegram reminder dry-run/send helper
- `services/monetization`: sponsor, affiliate, and rate-card generator
- `services/schedule`: calendar and go-live schedule generator
- `services/shorts`: match-specific Shorts title, caption, hashtag, and shot-list generator
- `.github/workflows/stream-pack.yml`: checks scripts and verifies generated stream packs
- `.github/workflows/pages.yml`: deploys the static launcher to GitHub Pages
- `cloudbuild.yaml`: builds and deploys the automation API to Cloud Run
- `DEPLOYMENT.md`: Google Cloud deploy steps
- `outputs/generated-stream-pack`: generated schedule and copy files
- `outputs/watchalong-kit`: OBS overlay, producer panel, thumbnails, match presets
- `outputs/youtube-channel-kit`: channel name, about text, avatar, banner, launch plan, completion checklist
- `outputs/automation-stack`: GitHub, Google Cloud, and YouTube API automation plan

## OBS Start

Open:

`index.html`

Use it as the launcher for dashboard, overlay, producer controls, and templates.

Open:

`outputs/watchalong-kit/dashboard.html`

Use it before every stream to copy the title, description, pinned chat, and Shorts ideas.

Open:

`outputs/watchalong-kit/overlay.html`

Add it to OBS as a Browser Source at `1920 x 1080`.

Open:

`outputs/watchalong-kit/control.html`

Use it as the producer panel to change match, score, timer, hype, stats, and talking points.

## YouTube Channel

Recommended channel:

`Kickoff Room Live`

Handle:

`@KickoffRoomLive`

Use the setup guide:

`outputs/youtube-channel-kit/channel-setup.md`

## Automation

Start with semi-auto, then connect OAuth:

`outputs/automation-stack/autopilot-plan.md`

Never paste API keys, client secrets, or refresh tokens into chat or GitHub.

## Generate Stream Pack

```bash
node tools/generate-stream-pack.mjs
```

## Local Automation API

```bash
npm run generate
npm run check
npm run start:api
```

## Local OBS Tools Server

```bash
npm run start:tools
```

Open:

`http://127.0.0.1:5173/dashboard`

Live ops control room:

`http://127.0.0.1:5173/ops`

Go-live rehearsal:

`http://127.0.0.1:5173/rehearsal`

OBS scene setup:

`http://127.0.0.1:5173/obs-setup`

Revenue ops:

`http://127.0.0.1:5173/revenue`

Shorts studio:

`http://127.0.0.1:5173/shorts-studio`

Channel ops:

`http://127.0.0.1:5173/channel-ops`

Reminder ops:

`http://127.0.0.1:5173/reminders`

Marathon ops:

`http://127.0.0.1:5173/marathon`

Metrics ops:

`http://127.0.0.1:5173/metrics`

Thumbnail studio:

`http://127.0.0.1:5173/thumbnail-studio`

YouTube ops:

`http://127.0.0.1:5173/youtube-ops`

Readiness checklist:

`http://127.0.0.1:5173/readiness`

OBS overlay:

`http://127.0.0.1:5173/overlay`

## API-Football Live Score

Add your API-Football key to `.env`:

```bash
API_FOOTBALL_KEY=your_key_here
```

Then restart the local tools server and open Producer Control:

`http://127.0.0.1:5173/control`

Use `Fetch API Score` to pull the matching live fixture from API-Football. Use `Auto Sync On` only after the match appears as live. If the API has no live fixture yet, keep manual score control active from the official broadcast or a trusted live-score page.

Quick terminal check:

```bash
STREAM_ID=fra-sen npm run score:live
```

## YouTube Automation

Start with a safe dry run:

```bash
npm run youtube:create-dry-run -- fra-sen
```

Create the next upcoming private scheduled live after YouTube Live is enabled:

```bash
YOUTUBE_DRY_RUN=false npm run youtube:create-next
```

OAuth setup is documented in:

`services/youtube/README.md`

One-command local OAuth helper:

```bash
npm run youtube:oauth
```

## Telegram Reminder

Dry-run message:

```bash
npm run telegram:dry-run -- fra-sen
```

## Monetization Kit

```bash
npm run monetize
```

## Live Calendar

```bash
npm run schedule
```

## Shorts Kit

```bash
npm run shorts
```

## Preflight

Run before a stream or deploy:

```bash
npm run preflight
```

## One-Command Local Launch

```bash
npm run launch
```

This runs preflight, prints the next match and OBS URLs, then starts the local tools server.
