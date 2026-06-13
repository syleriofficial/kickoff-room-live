# Kickoff Room Live

English no-footage football watchalong system for YouTube.

This project contains:

- OBS overlay for live watchalongs
- Producer control panel
- Match presets
- YouTube channel setup kit
- Google Cloud / YouTube API automation plan

## Important Rules

- Do not show match footage.
- Do not play broadcast audio.
- Do not commit secrets.
- Use original graphics, scoreboards, commentary lines, and chat prompts.

## Folders

- `outputs/watchalong-kit`: OBS overlay, producer panel, thumbnails, match presets
- `outputs/youtube-channel-kit`: channel name, about text, avatar, banner, launch plan
- `outputs/automation-stack`: GitHub, Google Cloud, and YouTube API automation plan

## OBS Start

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
