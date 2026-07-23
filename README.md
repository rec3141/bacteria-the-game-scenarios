# Bacteria! scenario library

Modular, **data-only** JSON scenarios for [Bacteria!](https://bacteria.cryomics.org). The game fetches
these at load time and validates every one against its schema before applying — an invalid scenario
falls back to the default ocean. See issue rec3141/bacteria-the-game#28.

- `scenarios/*.json` — one scenario per file (schema `bacteria-scenario`, version 1). **The source of truth.**
- `index.json` — **derived.** A mirror of `scenarios/`, rebuilt by `scripts/build-index.mjs` on every write.
  Never hand-edit it and never resolve a merge conflict in it; regenerate it instead.

Scenarios set whitelisted environment/organism parameters and cosmetic re-skins only. They cannot
introduce code or a new game verb.

Play one: `https://bacteria.cryomics.org/?scenario=<id>` (e.g. `?scenario=deepwater-horizon`).

## How scenarios get here

Everything commits **straight to `main`** — there is no PR to merge. `scripts/validate-all.mjs` is the
gate, and it runs the very same validator the game runs, so a scenario that would not load cannot land.
A PR step on top of that was pure downside: every PR rewrote the whole derived `index.json`, so any two
open at once conflicted by construction, and while they sat unmerged `generate.mjs` could not see them
(its novelty prompt reads committed files only) and rewrote the same lesson on later days.

| Workflow | Trigger | Source |
| --- | --- | --- |
| `daily.yml` | cron, 12:17 UTC | Claude invents a fresh microbial-ecology situation |
| `queue.yml` | cron, every 15 min | DOIs players submitted **from inside the game** |
| `doi.yml` | manual / `repository_dispatch` | one specific paper, on demand |

All three publish through `scripts/publish.sh`, which sidesteps merging rather than trying to survive
it: reset to current `main`, drop the generated files on top, rebuild the index from whatever files
then exist, push, and replay on rejection. Concurrent runs converge no matter how they interleave.

### Player submissions need no GitHub account

A player pastes a DOI in the game. `scenario-request.php` on bacteria.cryomics.org validates and
rate-limits it, then appends it to a public `scenario-queue.json`. `queue.yml` polls that file and
builds whatever it has not built yet — dedup is derived from whether `scenarios/<id>.json` exists,
so there is no "mark as done" write-back and therefore **no GitHub credential on the web server**.
The site deploys with its ordinary `deploy.sh`; there is no token to install or rotate.

## Working on this repo

    npm test        # id-derivation, DOI normalisation, queue filtering, direct-publish contracts
    npm run validate
    npm run queue   # what the poller would build right now

`scripts/doi-id.mjs` is shared by the queue poller and the generator on purpose: they must derive the
same id from a DOI or dedup silently fails open and every queued paper regenerates on every poll.
