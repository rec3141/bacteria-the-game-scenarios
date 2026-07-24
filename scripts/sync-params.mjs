// Derive defaults.json and params.json from the game's own source.
//
//   node scripts/sync-params.mjs            # fetch game.js from GitHub and rewrite both files
//   node scripts/sync-params.mjs --game ../bacteria-the-game/game.js
//   node scripts/sync-params.mjs --check    # fail if the committed files have drifted (CI)
//
// These two files used to be maintained by hand, and drifted exactly as a hand-maintained copy does:
// 17 of defaults.json's 47 values disagreed with the game, including every substrate field. Since
// generate.mjs quotes them to the model as ground truth, it was told particle radii default to 20-60
// when the game uses 30-200 — so a scenario that followed the guide precisely still built a board with
// a fraction of the intended food, and every level was unplayable. Nothing detected it because nothing
// compared the two.
//
// game.js is the single source of truth. Everything here is sliced out of it verbatim:
//   defaults.json — CFG, the real default ocean
//   params.json   — every parameter a scenario may set, with the game's own doc string and bounds
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAME_URL = process.env.GAME_JS_URL ||
  "https://raw.githubusercontent.com/rec3141/bacteria-the-game/main/game.js";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : null; };
const check = process.argv.includes("--check");

const gamePath = arg("game");
const game = gamePath ? readFileSync(gamePath, "utf8")
  : await fetch(GAME_URL).then((r) => { if (!r.ok) throw new Error(`GET game.js ${r.status}`); return r.text(); });

// Brace-match an object literal, skipping strings and comments so a brace inside either cannot end it.
function sliceObject(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`could not find ${marker} in game.js`);
  const open = src.indexOf("{", start);
  let depth = 0, i = open, inLine = false, inBlock = false, quote = null;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; i++; } continue; }
    if (quote) { if (c === "\\") { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(open, i);
}

const CFG = new Function(`return ${sliceObject(game, "const CFG = {")};`)();
const TUNE_DOCS = new Function(`return ${sliceObject(game, "const TUNE_DOCS = {")};`)();

// tuneRule and the deny rules live inside the two blocks that are already extracted verbatim for
// validator.mjs, so pull them from there rather than restating any of it.
const tuneBlock = game.match(/\/\/ TUNE_VALIDATOR_START[\s\S]*?\/\/ TUNE_VALIDATOR_END/)[0];
const scenBlock = game.match(/\/\/ SCENARIO_VALIDATOR_START[\s\S]*?\/\/ SCENARIO_VALIDATOR_END/)[0];
const { tuneRule, scEnvAllowed } = new Function(
  `${tuneBlock}\n${scenBlock}\nreturn { tuneRule, scEnvAllowed };`)();

// The range we advertise is the range someone should AUTHOR within, which is not the same as the
// bound the validator will tolerate. tuneRule's fallback is default*100 — fine as a slider stop,
// useless as advice: it would tell the model substrate.sizeMax may be 20000. Where a parameter has a
// real hand-written rule (latitude -90..90, a count capped at 1000) that rule IS the meaningful
// range, so use it. Otherwise use the decade span the tuning sliders themselves use, default/10 to
// default*10, which is the range a human exploring this knob actually moves it through.
const DECADE = 10;
// "Does this parameter have a real hand-written rule?" is answered by reconstructing tuneRule's
// generic fallback and seeing whether the rule differs. Testing TUNE_EXACT_RULES membership instead
// missed the water-colour channels, which get their 0-255 rule from a regex branch rather than the
// table — and advertising a decade span for an RGB channel would have kept every sea nearly black.
function authoringRange(path, def, rule) {
  const fallbackMax = Math.max(100, Math.abs(Number(def) || 0) * 100);
  if (rule.max !== fallbackMax) return { min: rule.min, max: rule.max };
  const mag = Math.abs(def);
  if (!mag) return { min: rule.min, max: Math.min(rule.max, 10) };   // a default of 0 has no decade
  const lo = Math.max(rule.min, mag / DECADE * Math.sign(def || 1));
  const hi = Math.min(rule.max, mag * DECADE * (def < 0 ? -1 : 1));
  const round = (x) => Number(x.toPrecision(3));
  return def < 0 ? { min: round(hi), max: round(lo) } : { min: round(lo), max: round(hi) };
}

// Same fallback tuneDoc uses for the .0/.1 ends of a range pair.
function docFor(path) {
  if (TUNE_DOCS[path]) return TUNE_DOCS[path];
  const parts = path.split(".");
  const parent = TUNE_DOCS[parts.slice(0, -1).join(".")];
  if (!parent) return "";
  const end = parts[parts.length - 1] === "0" ? "Low end" : "High end";
  return `${parent} (${end} of the range.)`;
}

function leaves(o, prefix = "", out = []) {
  for (const [k, v] of Object.entries(o)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) v.forEach((x, i) => { if (typeof x === "number") out.push([`${path}.${i}`, x]); });
    else if (v && typeof v === "object") leaves(v, path, out);
    else if (typeof v === "number") out.push([path, v]);
  }
  return out;
}

const params = {};
let denied = 0;
for (const [path, def] of leaves(CFG)) {
  if (!scEnvAllowed(path, CFG)) { denied++; continue; }
  const rule = tuneRule(path, def);
  const range = authoringRange(path, def, rule);
  params[path] = {
    default: def,
    doc: docFor(path).replace(/\s+/g, " ").trim(),
    min: range.min,
    max: range.max,
    ...(rule.integer ? { integer: true } : {}),
  };
}

// validator.mjs is derived from the same source, so it is regenerated here too rather than by a
// separate hand-run step. Its header used to say "keep in sync when the schema changes", which is
// exactly the instruction that does not survive contact with a busy week.
const VALIDATOR_HEADER = `// AUTO-GENERATED from bacteria-the-game/game.js — do NOT hand-edit.
// Run: node scripts/sync-params.mjs   (CI checks this with --check)
//
// Self-contained so CI can validate scenarios without the game repo. This is the SAME data-only,
// atomic validator the game runs at load: if the two ever disagree, a scenario CI accepts can still
// be rejected in the browser, and the player silently gets the stock ocean instead.
`;

const files = {
  "scripts/defaults.json": JSON.stringify(CFG, null, 2) + "\n",
  "scripts/params.json": JSON.stringify(
    { schema: "bacteria-scenario-params", version: 1, params }, null, 2) + "\n",
  "scripts/validator.mjs": `${VALIDATOR_HEADER}\n${tuneBlock}\n\n${scenBlock}\n\nexport { validateScenario };\n`,
};

let drift = false;
for (const [rel, content] of Object.entries(files)) {
  const path = join(repo, rel);
  let current = null;
  try { current = readFileSync(path, "utf8"); } catch { /* not written yet */ }
  if (current === content) continue;
  drift = true;
  if (check) console.error(`[sync-params] ${rel} is OUT OF DATE with game.js`);
  else { writeFileSync(path, content); console.log(`[sync-params] wrote ${rel}`); }
}

const undocumented = Object.entries(params).filter(([, p]) => !p.doc).map(([k]) => k);
console.error(`[sync-params] ${Object.keys(params).length} settable parameters, ${denied} denied, ` +
  `${undocumented.length} without a doc string`);
if (undocumented.length) console.error(`[sync-params] undocumented: ${undocumented.join(", ")}`);

if (check && drift) {
  console.error("[sync-params] run `node scripts/sync-params.mjs` and commit the result");
  process.exit(1);
}
if (check) console.error("[sync-params] in sync with game.js");
