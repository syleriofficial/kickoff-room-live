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
- GitHub Actions checks
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
- `services/automation-api`: Cloud Run-ready API for stream packages
- `services/youtube`: OAuth helpers and scheduled live dry-run/create script
- `.github/workflows/stream-pack.yml`: checks scripts and verifies generated stream packs
- `outputs/generated-stream-pack`: generated schedule and copy files
- `outputs/watchalong-kit`: OBS overlay, producer panel, thumbnails, match presets
- `outputs/youtube-channel-kit`: channel name, about text, avatar, banner, launch plan
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

## YouTube Automation

Start with a safe dry run:

```bash
npm run youtube:create-dry-run -- bra-mar
```

OAuth setup is documented in:

`services/youtube/README.md`

One-command local OAuth helper:

```bash
npm run youtube:oauth
```
