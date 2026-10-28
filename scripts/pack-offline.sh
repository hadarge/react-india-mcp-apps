#!/usr/bin/env bash
# Facilitator only, the day before, on good wifi.
# Builds a USB-ready folder: the repo + an npm cache that covers macOS, Windows and Linux,
# each on x64 and arm64, so attendees can `npm ci --offline` with no internet.
#
#   bash scripts/pack-offline.sh /Volumes/USB/react-india-mcp-apps
#
# On an attendee laptop:
#   cp -R /Volumes/USB/react-india-mcp-apps ~/ && cd ~/react-india-mcp-apps
#   npm ci --offline --cache ./.npm-cache
# Windows (PowerShell):
#   robocopy E:\react-india-mcp-apps $HOME\react-india-mcp-apps /E ; cd $HOME\react-india-mcp-apps
#   npm ci --offline --cache ./.npm-cache
set -euo pipefail
OUT="${1:?usage: pack-offline.sh <output-dir>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$OUT"
rsync -a --exclude node_modules --exclude .dist --exclude .backups --exclude .e2e --exclude .dev-port "$ROOT/" "$OUT/"
CACHE="$OUT/.npm-cache"
TMP="$(mktemp -d)"
cp "$ROOT/package.json" "$ROOT/package-lock.json" "$TMP/"
for target in "darwin arm64" "darwin x64" "win32 x64" "win32 arm64" "linux x64" "linux arm64"; do
  set -- $target
  echo "prefetching for $1-$2 ..."
  (cd "$TMP" && rm -rf node_modules && npm ci --cache "$CACHE" --os="$1" --cpu="$2" --ignore-scripts --no-audit --no-fund >/dev/null)
done
rm -rf "$TMP"
du -sh "$CACHE"
echo "Done. Test it: cd $OUT && npm ci --offline --cache ./.npm-cache && npm run doctor"
