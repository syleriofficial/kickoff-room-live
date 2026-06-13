# Telegram Reminder Automation

Use this to send live reminders to a Telegram group/channel.

Default mode is dry-run, so it prints the message without sending.

## Dry Run

```bash
npm run telegram:dry-run -- bra-mar
```

## Real Send

Export secrets locally:

```bash
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_CHAT_ID="..."
export YOUTUBE_STREAM_URL="https://youtube.com/live/..."
TELEGRAM_DRY_RUN=false node services/telegram/send-reminder.mjs bra-mar
```

## Message Includes

- match name
- kickoff time
- no-footage format
- live score/timer benefits
- YouTube stream URL
- chat prompt

## Safety

Never commit Telegram bot tokens or chat IDs. Keep them in local `.env` or Google Secret Manager later.
