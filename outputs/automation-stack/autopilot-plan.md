# Football Watchalong Autopilot Plan

## What Will Be Automated

- Match schedule import
- YouTube live title and description generation
- OBS overlay match switching
- Scoreboard data file updates
- Thumbnail generation template
- Stream checklist
- Post-match Shorts idea list
- Telegram/WhatsApp reminder text
- Sponsor/affiliate description blocks

## What Cannot Be Fully Automated Safely

- Showing match footage or broadcast audio
- Human commentary/personality
- Google/YouTube login consent
- First-time YouTube live enablement
- Monetization approval
- Copyright claim handling

## Stack

- GitHub: stores code, overlay, configs, and automation history
- Google Cloud Run: runs automation backend
- Cloud Scheduler: triggers jobs before every match
- Firestore: stores matches, stream status, templates, affiliate links
- YouTube Data API: creates scheduled livestreams after OAuth approval
- OBS: streams your camera, mic, and overlay
- YouTube Studio: final manual safety check before going live

## Money Flow

1. Schedule all matches.
2. Generate live pages early.
3. Push Shorts after every match.
4. Add affiliate links in descriptions.
5. Build community link in pinned chat.
6. Pitch sponsors after 7-10 streams.

## First Automation Milestone

Build a small dashboard with:

- next match
- copy YouTube title
- copy description
- open overlay
- switch match preset
- generate pinned chat
- generate Shorts titles

This gets us 80% of automation without waiting for Google API approval.
