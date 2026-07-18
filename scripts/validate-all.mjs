// Validate every scenario in scenarios/ against the game's data-only schema. Exits non-zero on any
// failure — wired into CI so a malformed (or hallucinated) scenario can never reach the library.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateScenario } from "./validator.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const defaults = JSON.parse(readFileSync(join(here, "defaults.json"), "utf8"));
const dir = join(here, "..", "scenarios");
if (!existsSync(dir)) { console.log("no scenarios/ dir — nothing to validate"); process.exit(0); }
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
let bad = 0;
for (const f of files) {
  let raw; try { raw = JSON.parse(readFileSync(join(dir, f), "utf8")); }
  catch (e) { console.error(`✗ ${f}: not valid JSON — ${e.message}`); bad++; continue; }
  const r = validateScenario(raw, defaults);
  if (r.ok) console.log(`✓ ${f}: ${r.scenario.meta.title}`);
  else { console.error(`✗ ${f}: ${r.reason}`); bad++; }
}
console.log(`\n${files.length - bad}/${files.length} scenarios valid`);
process.exit(bad ? 1 : 0);
