# Automation API

Small dependency-free Node service for Google Cloud Run.

## Local Run

From the project root:

```bash
npm run generate
npm run start:api
```

Open:

- `http://localhost:8080/health`
- `http://localhost:8080/streams`
- `http://localhost:8080/next`
- `http://localhost:8080/stream/esp-cpv`
- `http://localhost:8080/schedule`
- `http://localhost:8080/monetization`
- `http://localhost:8080/shorts`
- `http://localhost:8080/shorts/esp-cpv`
- `http://localhost:8080/search?q=brazil`

## Cloud Run Deploy

After installing and logging into `gcloud`:

```bash
gcloud run deploy kickoff-room-live-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## Routes

- `/health`: service status
- `/streams`: all generated stream packages
- `/next`: first stream package in the generated list
- `/stream/:id`: one stream package by preset id
- `/schedule`: go-live schedule data
- `/monetization`: sponsor and affiliate copy data
- `/shorts`: all Shorts packages
- `/shorts/:id`: one Shorts package by preset id
- `/search?q=term`: simple match search

## Future Jobs

This API is the base for:

- YouTube scheduled live creation
- Telegram reminders
- affiliate block injection
- automatic title and description updates
- post-match Shorts package generation
