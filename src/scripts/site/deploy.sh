#!/usr/bin/env bash
# Deploy the format docs site (ask A3) to the Cloudflare Worker `wildshard-format` (src/site/wrangler.jsonc), which
# serves format.wildshard.io. Like www.wildshard.io's deploy.sh: it builds HEAD from a clean `git archive` (nobody's
# half-finished files ship), then uploads the static output with wrangler. Locally wrangler's own login is the
# credential; CLOUDFLARE_API_TOKEN works too.
#
#   bash src/scripts/site/deploy.sh                 # commit first: it ships HEAD, not the working tree
#   bash src/scripts/site/deploy.sh --build-only    # build HEAD's export into src/site/dist and stop
#
# wrangler is not a dependency of this repo (package.json changes wait for Jake): it uses `wrangler` on PATH, else
# `npx wrangler@$WRANGLER_VERSION`.
set -euo pipefail

repo="$(git rev-parse --show-toplevel)"
cd "$repo"
sha="$(git rev-parse HEAD)"
dirty="$(git status --porcelain -- docs src/site src/scripts/site | grep -v '^??' || true)"
if [ -n "$dirty" ]; then
  echo "site-deploy: uncommitted edits; HEAD (${sha:0:12}) ships without them:" >&2
  echo "$dirty" >&2
fi

mkdir -p "$repo/tmp"
work="$(mktemp -d "$repo/tmp/site-deploy.XXXXXX")"
trap 'rm -rf "$work"' EXIT
git archive HEAD | tar -x -C "$work"

echo "site-deploy: building ${sha:0:12}"
SITE_BUILD_SHA="$sha" node "$work/src/scripts/site/build.mjs" --out "$work/src/site/dist"

if [ "${1:-}" = "--build-only" ]; then
  rm -rf "$repo/src/site/dist" && cp -R "$work/src/site/dist" "$repo/src/site/dist"
  echo "site-deploy: built ${sha:0:12} into src/site/dist (no upload)"
  exit 0
fi

echo "site-deploy: uploading"
if command -v wrangler >/dev/null 2>&1; then
  wrangler deploy --config "$work/src/site/wrangler.jsonc"
else
  npx --yes "wrangler@${WRANGLER_VERSION:-4.162.0}" deploy --config "$work/src/site/wrangler.jsonc"
fi

live="${SITE_LIVE:-https://format.wildshard.io}"
# Retry, uncached: the edge can serve the preceding version for a moment after the upload.
build=""
for _ in {1..12}; do
  build="$(curl -fsS -H 'Cache-Control: no-cache' "$live/version.json?t=$(date +%s)" | sed -E 's/.*"build":"([^"]+)".*/\1/' || true)"
  case "$build" in "$sha") echo "site-deploy: live at $live (build ${sha:0:12})"; exit 0 ;; esac
  sleep 5
done
echo "site-deploy: $live reports build ${build:-none}, not ${sha:0:12}" >&2
exit 1
