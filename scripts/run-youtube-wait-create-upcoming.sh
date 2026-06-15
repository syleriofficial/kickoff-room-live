#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
source .env
set +a

export YOUTUBE_RETRY_ATTEMPTS="${YOUTUBE_RETRY_ATTEMPTS:-180}"
export YOUTUBE_RETRY_INTERVAL_SECONDS="${YOUTUBE_RETRY_INTERVAL_SECONDS:-300}"

printf '\033]0;Kickoff Room YouTube Retry\007'
exec node services/youtube/wait-create-upcoming-broadcasts.mjs
