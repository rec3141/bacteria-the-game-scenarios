#!/usr/bin/env bash
# Commit freshly generated scenarios straight to main.
#
#   scripts/publish.sh "<commit subject>" <scenario-id> [<scenario-id> ...]
#
# There is deliberately no PR step. A PR bought nothing the pipeline does not already
# enforce -- validate-all.mjs runs the SAME validator the game runs, so a bad scenario
# fails the job before this script is ever reached -- and it cost plenty:
#
#   * every PR rewrote index.json, which build-index.mjs regenerates WHOLESALE, so any
#     two open at once conflicted by construction and a missed merge day stranded them;
#   * generate.mjs builds its novelty prompt from archiveSummary(), which reads the
#     COMMITTED scenarios/ only -- so each day the bot went blind to whatever was still
#     sitting in an unmerged PR, and duly generated the same lesson twice (PRs #9/#10
#     were both Winogradsky sulfur columns).
#
# The merge-conflict problem is structural, so this script sidesteps merging entirely
# rather than trying to resolve it. index.json is DERIVED: instead of rebasing our copy
# onto someone else's, we hard-reset to the current main, drop the generated scenario
# files back on top, and rebuild the index from whatever files then exist. Two runs
# racing (the daily cron and a queued DOI, say) can interleave in any order and still
# converge on an index that mirrors scenarios/ exactly.
set -euo pipefail
cd "$(dirname "$0")/.."

SUBJECT="${1:?commit subject required}"
shift
# Zero ids is legitimate: recording a generation failure updates only failures.json.
if [ "$#" -eq 0 ] && ! [ -f failures.json ]; then
  echo "publish: nothing to publish"; exit 0
fi

# Hold the generated files outside the work tree: `git reset --hard` below would revert
# any that overwrote a tracked file (a same-day daily re-run, a regenerated DOI).
STASH="$(mktemp -d)"
trap 'rm -rf "$STASH"' EXIT
for id in "$@"; do
  [ -f "scenarios/$id.json" ] || { echo "publish: scenarios/$id.json does not exist"; exit 1; }
  cp "scenarios/$id.json" "$STASH/$id.json"
done
# failures.json records which papers we have stopped paying to retry. It is ordinary tracked state,
# so the reset below would throw away an update recorded moments ago in this same job.
# `if`, not `[ -f x ] && cp`: under `set -e` a bare && list whose test fails IS a failed command,
# and would abort the publish on the perfectly normal day when no failure has ever been recorded.
if [ -f failures.json ]; then cp failures.json "$STASH/failures.json"; fi

git config user.name "scenario-bot"
git config user.email "scenario-bot@users.noreply.github.com"

# Up to 5 attempts: another workflow can land a commit between our fetch and our push,
# and the loop simply replays onto the newer main. Nothing to merge, so it cannot wedge.
for attempt in 1 2 3 4 5; do
  git fetch origin main
  git reset --hard origin/main

  for id in "$@"; do cp "$STASH/$id.json" "scenarios/$id.json"; done
  if [ -f "$STASH/failures.json" ]; then cp "$STASH/failures.json" failures.json; fi
  node scripts/build-index.mjs

  git add scenarios index.json
  if [ -f failures.json ]; then git add failures.json; fi
  if git diff --cached --quiet; then
    echo "publish: main already holds these scenarios verbatim, nothing to commit"
    exit 0
  fi
  git commit -m "$SUBJECT"

  if git push origin HEAD:main; then
    echo "publish: pushed ${*:-failure record} to main"
    exit 0
  fi
  echo "publish: push rejected (attempt $attempt) -- main moved, replaying onto it"
  sleep $((attempt * 3))
done

echo "publish: could not push after 5 attempts" >&2
exit 1
