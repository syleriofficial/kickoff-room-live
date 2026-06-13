# Google Cloud Run Setup

This project includes a small automation API ready for Cloud Run:

`services/automation-api`

## What It Does

It serves generated stream packages over HTTP:

- titles
- descriptions
- pinned chats
- first-minute scripts
- Shorts ideas
- match metadata
- schedule data
- sponsor/affiliate copy
- Shorts ideas and captions

## Local Test

```bash
npm run generate
npm run check
npm run start:api
```

Then open:

`http://localhost:8080/streams`

Also available:

- `http://localhost:8080/schedule`
- `http://localhost:8080/monetization`
- `http://localhost:8080/shorts`

## Deploy

```bash
gcloud run deploy kickoff-room-live-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## Important

Do not add YouTube OAuth secrets directly to the repo.

When OAuth is added later, store secrets in:

- Google Secret Manager for Cloud Run
- local `.env` for development

Never commit `.env`, refresh tokens, client secrets, or credential JSON files.
