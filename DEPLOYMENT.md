# Deployment

This repo can deploy the automation API to Google Cloud Run.

## One-Time Google Cloud Setup

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create kickoff-room-live \
  --repository-format=docker \
  --location=us-central1 \
  --description="Kickoff Room Live containers"
```

## Deploy With Cloud Build

```bash
gcloud builds submit --config cloudbuild.yaml
```

Cloud Build will:

1. Build `services/automation-api/Dockerfile`
2. Push the image to Artifact Registry
3. Deploy `kickoff-room-live-api` to Cloud Run

## Manual Deploy Alternative

```bash
gcloud run deploy kickoff-room-live-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## After Deploy

Open:

```text
https://YOUR_CLOUD_RUN_URL/health
https://YOUR_CLOUD_RUN_URL/streams
https://YOUR_CLOUD_RUN_URL/schedule
https://YOUR_CLOUD_RUN_URL/monetization
```

## Secrets

The current API serves generated public stream data and does not require secrets.

When YouTube OAuth/Telegram sending moves to Cloud Run, store secrets in Google Secret Manager, not in GitHub:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
