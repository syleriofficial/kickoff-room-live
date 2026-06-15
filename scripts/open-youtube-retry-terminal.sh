#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

osascript <<OSA
tell application "Terminal"
  activate
  do script "cd $(printf "%q" "$ROOT_DIR") && ./scripts/run-youtube-wait-create-upcoming.sh"
end tell
OSA

echo "Opened Terminal retry worker for Kickoff Room Live."
