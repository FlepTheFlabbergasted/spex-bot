#!/bin/bash
set -a
source .env
set +a

gcloud builds submit --tag gcr.io/spexbot-457610/spexbot-457610-image --project=spexbot-457610

gcloud run deploy spexbot-457610-cloud-run-service \
  --project=spexbot-457610 \
  --image gcr.io/spexbot-457610/spexbot-457610-image \
  --platform managed \
  --region europe-west3 \
  --allow-unauthenticated \
  --set-env-vars "APP_ID=$APP_ID,DISCORD_TOKEN=$DISCORD_TOKEN,PUBLIC_KEY=$PUBLIC_KEY"