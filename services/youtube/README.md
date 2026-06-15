# YouTube OAuth Automation

These scripts are local helpers for YouTube Data API automation.

Do not commit secrets. Use local `.env` or shell exports only.

## Required Local Env

```bash
export YOUTUBE_CLIENT_ID="..."
export YOUTUBE_CLIENT_SECRET="..."
export YOUTUBE_REDIRECT_URI="http://localhost:8080/oauth2callback"
```

## Step 1: Generate Consent URL

Easiest one-command local flow:

```bash
node services/youtube/local-oauth.mjs
```

Open the printed URL, approve access, and return to the terminal. The helper prints `YOUTUBE_REFRESH_TOKEN` and does not save it to the repo.

Manual flow:

```bash
node services/youtube/oauth-url.mjs
```

Open the printed URL in your browser, approve access, and copy the `code` from the redirect URL.

## Step 2: Exchange Code For Refresh Token

```bash
YOUTUBE_AUTH_CODE="PASTE_CODE_HERE" node services/youtube/exchange-token.mjs
```

Save the printed `YOUTUBE_REFRESH_TOKEN` in local `.env` only.

## Step 3: Dry-Run Broadcast Payload

```bash
node services/youtube/create-broadcast.mjs fra-sen
```

This does not call YouTube by default.

## Create Next Scheduled Broadcast

Dry-run next upcoming stream from `outputs/schedule/live-schedule.json`:

```bash
npm run youtube:create-next
```

Check whether YouTube Live API read access is available yet:

```bash
npm run youtube:live-status
```

If create still returns `livePermissionBlocked`, wait until the YouTube Studio live activation countdown finishes. YouTube can allow Live Control Room read access before scheduled broadcast creation is unlocked.

Create the next broadcast as private after live verification is active:

```bash
YOUTUBE_DRY_RUN=false npm run youtube:create-next
```

Create all upcoming private broadcasts from the generated schedule:

```bash
npm run youtube:create-upcoming
YOUTUBE_DRY_RUN=false npm run youtube:create-upcoming
```

The batch helper checks existing upcoming broadcasts and skips exact title/time duplicates before creating missing streams.

Wait and retry until YouTube unlocks scheduled broadcast creation for all upcoming streams:

```bash
YOUTUBE_RETRY_ATTEMPTS=180 YOUTUBE_RETRY_INTERVAL_SECONDS=300 npm run youtube:wait-create-upcoming
```

Local Terminal launcher that loads `.env` and keeps retrying:

```bash
./scripts/run-youtube-wait-create-upcoming.sh
```

Open a separate macOS Terminal window for the retry worker:

```bash
./scripts/open-youtube-retry-terminal.sh
```

macOS LaunchAgent installer. Use this only if launchd has permission to access the project folder:

```bash
./scripts/install-youtube-retry-launchagent.sh
```

Stop and remove the LaunchAgent:

```bash
./scripts/uninstall-youtube-retry-launchagent.sh
```

Wait and retry for only the next stream:

```bash
YOUTUBE_RETRY_ATTEMPTS=24 YOUTUBE_RETRY_INTERVAL_SECONDS=300 npm run youtube:wait-create-next
```

The retry helpers only keep retrying for YouTube live activation errors: `livePermissionBlocked` and `liveStreamingNotEnabled`.

## Step 4: Create Scheduled Broadcast

Use an ISO timestamp:

```bash
export YOUTUBE_REFRESH_TOKEN="..."
export YOUTUBE_SCHEDULED_START_TIME="2026-06-13T22:00:00Z"
export YOUTUBE_PRIVACY_STATUS="private"
YOUTUBE_DRY_RUN=false node services/youtube/create-broadcast.mjs fra-sen
```

Recommended: create as `private` first, review in YouTube Studio, then switch to public/scheduled manually.

## Safety

- Keep titles/descriptions clear that this is a no-footage watchalong.
- Do not upload or stream copyrighted match footage.
- Do not stream broadcast audio.
- Never commit refresh tokens, client secrets, or OAuth credential JSON.
