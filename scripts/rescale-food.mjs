// Put a playable amount of food back on scenarios whose particle sizes were written in micrometres.
//
//   node scripts/rescale-food.mjs [--write]
//
// substrate.sizeMin/sizeMax are RADII IN SCREEN PIXELS (default 20-60; a bacterium is about 8px
// across). The model was writing real microbial dimensions instead -- Prochlorococcus at 0.15-0.4,
// SAR11 at 0.4-1, marine snow at 3-9 -- which are correct numbers in the wrong unit, and left boards
// with 0.02%-3% of the default food. Nothing could survive.
//
// Note this touches env only. Particle rMin/rMax look like the size control and are not: makeSubstrate
// takes every radius from powerLawSize() (CFG.substrate.sizeMin/sizeMax/sizeExp) and reads only
// mix/shape/squash off the particle spec.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const D = JSON.parse(readFileSync(join(repo, "scripts/defaults.json"), "utf8")).substrate;
const SIZE_EXP = 1.6;      // CFG.substrate.sizeExp — not settable by a scenario
const MIN_COUNT = 55;      // the prompt's own floor, which several scenarios ignored
const write = process.argv.includes("--write");

// env may be written dotted ("substrate.sizeMin") or nested ({substrate:{sizeMin}}). The validator
// walks both, so anything reasoning about a scenario has to as well -- reading only one form silently
// returns undefined and quietly reports the default.
const envGet = (env, path) => {
  if (!env) return undefined;
  if (env[path] !== undefined) return env[path];
  return path.split(".").reduce((o, k) => (o && typeof o === "object") ? o[k] : undefined, env);
};
const envSet = (env, path, v) => {
  if (env[path] !== undefined) { env[path] = v; return; }
  const parts = path.split(".");
  let o = env;
  for (let i = 0; i < parts.length - 1; i++) { if (typeof o[parts[i]] !== "object" || !o[parts[i]]) o[parts[i]] = {}; o = o[parts[i]]; }
  if (typeof o === "object" && o !== env) o[parts[parts.length - 1]] = v; else env[path] = v;
};

// Mean squared radius under the Junge spectrum powerLawSize() samples (PDF proportional to R^-p).
// Food on the board scales with count * E[R^2], and E[R^2] is homogeneous of degree 2 in the radii --
// which is what makes a single linear factor able to hit a target exactly.
function eR2(a, b, p) {
  const num = (Math.pow(b, 3 - p) - Math.pow(a, 3 - p)) / (3 - p);
  const den = (Math.pow(b, 1 - p) - Math.pow(a, 1 - p)) / (1 - p);
  return num / den;
}
const target = eR2(D.sizeMin, D.sizeMax, SIZE_EXP) * D.count;

const rows = [];
for (const f of readdirSync(join(repo, "scenarios")).filter((x) => x.endsWith(".json")).sort()) {
  const path = join(repo, "scenarios", f);
  const sc = JSON.parse(readFileSync(path, "utf8"));
  if (!sc.env) continue;
  const a0 = envGet(sc.env, "substrate.sizeMin") ?? D.sizeMin;
  const b0 = envGet(sc.env, "substrate.sizeMax") ?? D.sizeMax;
  const c0 = envGet(sc.env, "substrate.count") ?? D.count;
  const before = eR2(a0, b0, SIZE_EXP) * c0 / target;
  if (before >= 0.5) { rows.push([f, c0, `${a0}-${b0}`, `${Math.round(before * 100)}%`, "", "", "left alone"]); continue; }

  // Raise a starved count to the floor first, then solve for the one radius factor that lands the
  // board on the default food mass. Relative spread is preserved: a scenario that wanted a narrow
  // size range still gets one.
  const c1 = Math.max(c0, MIN_COUNT);
  const k = Math.sqrt(target / (eR2(a0, b0, SIZE_EXP) * c1));
  const a1 = Math.max(4, Math.round(a0 * k));
  const b1 = Math.max(a1 + 4, Math.round(b0 * k));
  const after = eR2(a1, b1, SIZE_EXP) * c1 / target;

  if (write) {
    envSet(sc.env, "substrate.sizeMin", a1);
    envSet(sc.env, "substrate.sizeMax", b1);
    if (c1 !== c0) envSet(sc.env, "substrate.count", c1);
    writeFileSync(path, JSON.stringify(sc, null, 2) + "\n");
  }
  rows.push([f, c0, `${a0}-${b0}`, `${(before * 100).toFixed(before < 1 ? 2 : 0)}%`, c1, `${a1}-${b1}`, `${Math.round(after * 100)}%`]);
}

console.log("scenario".padEnd(32), "cnt".padStart(4), "size".padStart(9), "food".padStart(7), "  ->", "cnt".padStart(4), "size".padStart(8), "food".padStart(6));
for (const r of rows) {
  console.log(r[0].replace(".json", "").padEnd(32), String(r[1]).padStart(4), r[2].padStart(9), r[3].padStart(7),
    "  ->", String(r[4]).padStart(4), String(r[5]).padStart(8), String(r[6]).padStart(6));
}
console.log(write ? "\nwritten" : "\n(dry run — pass --write to apply)");
