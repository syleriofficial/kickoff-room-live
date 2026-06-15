#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

osascript <<OSA
tell application "Terminal"
  activate
  set retryTab to do script "printf '\\\\033]0;Kickoff Room YouTube Retry\\\\007'; cd $(printf "%q" "$ROOT_DIR") && ./scripts/run-youtube-wait-create-upcoming.sh"
  delay 1
  set custom title of retryTab to "Kickoff Room YouTube Retry"
end tell
OSA

echo "Opened Terminal retry worker for Kickoff Room Live."
