# Bacteria! scenario library

Modular, **data-only** JSON scenarios for [Bacteria!](https://bacteria.cryomics.org). The game fetches
these at load time and validates every one against its schema before applying — an invalid scenario
falls back to the default ocean. See issue rec3141/bacteria-the-game#28.

- `index.json` — manifest of available scenarios.
- `scenarios/*.json` — one scenario per file (schema `bacteria-scenario`, version 1).

Scenarios set whitelisted environment/organism parameters and cosmetic re-skins only. They cannot
introduce code or a new game verb. Daily and DOI-seeded scenarios are generated here (see the workflow
in `.github/workflows/`) and committed via PR.

Play one: `https://bacteria.cryomics.org/?scenario=<id>` (e.g. `?scenario=deepwater-horizon`).
