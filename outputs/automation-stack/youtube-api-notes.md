# YouTube Automation Notes

## Official API Capabilities

YouTube Live Streaming API can create scheduled broadcasts with `liveBroadcasts.insert`.

Required broadcast fields include:

- `snippet.title`
- `snippet.scheduledStartTime`
- `status.privacyStatus`

Useful fields include:

- `snippet.description`
- `snippet.scheduledEndTime`
- `status.selfDeclaredMadeForKids`
- `contentDetails.enableAutoStart`
- `contentDetails.enableAutoStop`

## OAuth Reality

YouTube channel actions require OAuth 2.0 user consent. A Google Cloud service account cannot manage a normal YouTube channel by itself.

## Practical Automation Path

Start with semi-auto:

1. Generate all title/description/thumbnail text automatically.
2. Human clicks schedule in YouTube Studio.
3. After OAuth is ready, script creates scheduled live broadcasts.
4. Keep final review manual to avoid wrong titles or accidental policy issues.

## Source Links

- https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/insert
- https://developers.google.com/youtube/v3/guides/authentication
- https://developers.google.com/youtube/v3/live/getting-started
