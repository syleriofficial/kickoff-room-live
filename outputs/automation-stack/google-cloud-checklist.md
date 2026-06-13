# Google Cloud Checklist

## Create Project

1. Go to Google Cloud Console.
2. Create project: `kickoff-room-live`.
3. Enable billing only when needed.
4. Enable APIs:
   - YouTube Data API v3
   - Cloud Run
   - Cloud Scheduler
   - Firestore
   - Secret Manager

## YouTube API Notes

The YouTube Data API uses OAuth 2.0 for private channel actions. Service accounts do not work for YouTube channel management. You must approve access from the YouTube channel owner account.

For creating live broadcasts, the API supports `liveBroadcasts.insert`, with title, scheduled start time, privacy status, description, and related broadcast details.

## Secrets Needed

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `AFFILIATE_BLOCK`
- `TELEGRAM_BOT_TOKEN` optional
- `TELEGRAM_CHAT_ID` optional

## Cloud Jobs

- `daily-match-import`: updates match list every morning
- `pre-match-generator`: creates title, description, pinned chat, thumbnail text
- `stream-reminder`: sends Telegram/WhatsApp copy text
- `post-match-shorts`: generates Shorts titles and captions

## Safety Rules

- Never upload copyrighted match footage.
- Never stream broadcast audio.
- Keep all titles as watchalong/reactions/no footage.
- Keep descriptions clear that viewers need the official broadcast.
