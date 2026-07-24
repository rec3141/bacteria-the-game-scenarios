// Generate a Bacteria! scenario with Claude and validate it against the game schema before writing.
//
//   node scripts/generate.mjs --mode daily
//   node scripts/generate.mjs --mode doi --doi 10.1126/science.1195979
//
// Needs ANTHROPIC_API_KEY in the environment (GitHub Secrets in CI). The generated JSON is validated
// with the SAME validator the game runs; an invalid generation is retried once, then fails the job so a
// bad scenario never lands. Copyright/appropriateness is left to the model's own judgment by design.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateScenario } from "./validator.mjs";
import { buildIndex } from "./build-index.mjs";
import { slug, cleanDoi, DOI_RE } from "./doi-id.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const scenDir = join(repo, "scenarios");
const defaults = JSON.parse(readFileSync(join(here, "defaults.json"), "utf8"));
const MODEL = process.env.SCENARIO_MODEL || "claude-sonnet-5";

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : null; }
const mode = arg("mode") || "daily";
const today = new Date().toISOString().slice(0, 10);

// ---- the schema contract, stated for the model (must match validator.mjs) --------------------------
const ENV_WHITELIST = [
  "day.lengthSec", "day.startHour", "day.latitude", "day.dayOfYear",
  "diel.tempBase", "diel.tempAmp", "diel.tempLag", "diel.foodFloor", "diel.grazeNight", "diel.twilight", "diel.q10", "diel.q10RefC",
  "diel.waterNight.{0,1,2}", "diel.waterDay.{0,1,2}",
  "substrate.count", "substrate.sizeMin", "substrate.sizeMax", "substrate.lifeMin", "substrate.lifeMax",
  "predator.count", "predator.senseRange", "predator.chaseSpeed", "predator.wanderSpeed", "predator.mealEnergy",
  "predator.metabolism", "predator.resistStep", "predator.resistMax", "predator.reproEnergy", "predator.reproCooldown",
  "phage.greenCount", "phage.goldCount", "phage.hostTolerance", "phage.adsorbBase",
  "phage.life.{0,1}", "phage.latent.{0,1}", "phage.burst.{0,1}",
  "cell.startEnergy", "cell.divideThreshold", "enzyme.life", "enzyme.maxRadius", "toxin.life", "toxin.maxRadius", "eps.lifePerLevel", "eps.radius",
];
function schemaSpec() {
  return `Output ONE JSON object, no prose, no markdown fences. It is DATA ONLY — it cannot contain code.
It must satisfy this schema (any unknown key, out-of-range value, or new "verb" makes it INVALID):

{
  "schema": "bacteria-scenario", "version": 1,
  "meta": {
    "title": string<=80, "date": "${today}", "lesson": string<=1200 (an original summary in your own words),
    "citation": string<=300 (optional), "difficulty": "easy"|"normal"|"hard"|"extreme" (optional),
    "realWorldBasis": string<=120 (optional)
  },
  "env": { partial CFG overrides — ONLY these dotted paths, each a NUMBER:
    ${ENV_WHITELIST.join(", ")} },
  "resources": [ up to 3, each { "index": 0|1|2, "label": str, "enzymeLabel": str, "color": "#rrggbb" } ],
      // index 0 = lipid/fat class, 1 = protein, 2 = carbohydrate. Re-skin only; you cannot add a 4th class.
  "particles": { id: { "label": str, "mix": [num,num,num] (>=0, over the 3 classes),
      "shape": "aggregate"|"ellipse"|"shard", "squash": 0.1..1 (ellipse only), "weight": 0..10 } },
      // Particles carry no size of their own: every particle's radius is sampled from
      // substrate.sizeMin/sizeMax in env. Set the size there, once, in PIXELS.
  "actions": { primitive: { "label": str, "color": "#rrggbb", "weight": 0..10 } },
      // primitives are EXACTLY: enzyme0, enzyme1, enzyme2, chemotaxis, antibiotic, eps, crispr, twitching.
      // You may rename/recolor/reweight them (weight 0 removes one) but NEVER invent a new primitive.
      // A "novel enzyme" is delivered by re-skinning enzyme0/1/2 (e.g. alkane hydroxylase on the lipid class).
  "organisms": { "cells": [ { "id": str, "label": str, "color": "#rrggbb",
      "genome": { "enzLvl": [int,int,int] 0..12, "chemoLevel": int, "antibiotic": int, "eps": int, "crispr": bool, "twitching": bool },
      "immigrateWeight": 0..10 } ] },
  "column": {   // OPTIONAL — a stratified water column. Include when depth matters (surface vs deep).
    "enabled": true|false,
    "layers": [ { "depth": num (ascending, >=0), "tempC": -10..50, "salinity": 0..60, "light": 0..1, "nutrient": 0..1 } ],
    "thermocline": { "depth": num, "sharpness": 0..1 }
  }
}

Design goals: a SPECIFIC, real microbial-ecology situation with genuine educational value; a mechanically
distinct feel via env + a re-skinned enzyme; a mini-lesson that teaches the science. Prefer real organisms
and real events. The date field must be exactly "${today}".

PARAMETER GUIDE — what the numbers do (defaults in [brackets]; deviate only with a reason):
- day.lengthSec [240] s/day. day.latitude [45] (use the SITE's real latitude; higher = stronger seasonal light). day.dayOfYear [172] = season. day.startHour [0].
- diel.tempBase [20] = mean water temperature °C (use the site's real temperature). diel.tempAmp [6] = day/night swing. diel.foodFloor [0.3] = night food as a fraction of noon (keep >= 0.2). diel.q10 [2].
- substrate.count [80] = HOW MANY food particles exist. This is the single biggest control on playability. KEEP IT 60-130. Even for a nutrient-poor (oligotrophic) real habitat, do NOT go below ~55. A near-empty sea is not fun and not the goal.
- substrate.sizeMin [20] and substrate.sizeMax [60] = particle radius in SCREEN PIXELS. These are NOT micrometres and NOT real cell dimensions — a playable particle is tens of pixels across, and a bacterium is drawn about 8 pixels wide. Writing a real microbial size here (0.4, 3, 9) produces food too small to see or eat and the level is dead on arrival. Keep sizeMin >= 15 and sizeMax >= 45 unless you have a specific reason, and never let the pair fall below 10/30.
- To convey a nutrient-poor habitat, do NOT shrink the particles and do NOT starve the board. Use diel.foodFloor, substrate.lifeMin/lifeMax (food that vanishes sooner), tougher grazing (predator.count, predator.senseRange), or a founder that must work harder for the dominant resource class.
- predator.count [4] grazers. phage.greenCount [18], phage.goldCount [4]. cell.startEnergy [100], cell.divideThreshold [200] (<= 230).

FEEDING — the founder MUST be able to eat, or the level is dead on arrival:
- There are exactly 3 food classes: index 0 = lipid/fatty, 1 = protein, 2 = carbohydrate — each digested by its own enzyme (enzyme0/enzyme1/enzyme2). A "novel enzyme" is a re-skin of one of these on its class.
- Each particle's "mix" [c0,c1,c2] sets its composition. Whatever class DOMINATES your particles, organisms.cells[0].genome.enzLvl MUST be >= 2 in that class, or the founder starves immediately. Example: 90%-class-0 oil droplets → founder enzLvl [2, x, 1].
- Always keep enzLvl[2] (carbohydrase) >= 1 — it is the universal founding enzyme.
- If you define no particles, the default mixed marine-snow set is used; then a generalist founder (enzLvl ~ [1,1,1]) is safest.

COLUMN scenarios (a stratified water column, column.enabled=true): food particles SINK toward the floor, so set substrate.count on the higher side (90-130) and make sure the founder can eat what's near it. Use a column only when depth genuinely matters (surface vs deep).

CHEMOSYNTHESIS / CHEMOLITHOTROPHY (hydrothermal vents, cold seeps, sulfur/ammonia/nitrite oxidizers, nitrifiers, anammox): these microbes do NOT digest particles — they fix carbon using energy from a dissolved reduced chemical. Use the ENGINE PRIMITIVE, never a re-skinned digestion enzyme (breaking down a particle with "nitrate reductase" is biologically backwards):
- set "chemolithotroph": true inside the genome of the chemosynthetic organism(s);
- set column.enabled=true and add column.chemical: { "peakDepth": 0..1 (fraction of the column where the chemical is richest — a vent floor ~0.9, a redox/oxycline ~0.5), "spread": 0.05..0.3, "strength": 0.6..1, "color": "#rrggbb" }.
A chemolithotroph draws energy from the field at its depth and must stay in the plume — it needs no particle enzyme (keep its enzLvl low, e.g. [0,0,1]).`;
}

// Force the model to return a JSON object by making it call a tool (with tool_choice). This guarantees
// structured output regardless of how chatty the model would otherwise be — no prose-parsing, no prefill
// (which claude-sonnet-5 rejects). validateScenario does the real schema enforcement afterwards.
async function modelScenario(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 8000,
      system: "You generate scenarios for a marine-microbiology game. Return the finished scenario by calling the emit_scenario tool with the JSON object as its input.",
      tools: [{ name: "emit_scenario", description: "Emit the finished scenario as a single JSON object matching the schema in the prompt.", input_schema: { type: "object", additionalProperties: true } }],
      tool_choice: { type: "tool", name: "emit_scenario" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const data = await res.json();
  const tool = (data.content || []).find((b) => b.type === "tool_use");
  if (!tool || !tool.input || typeof tool.input !== "object") {
    console.error(`[generate] no scenario tool call. stop_reason=${data.stop_reason}; block types=${(data.content || []).map((b) => b.type).join(",")}`);
    throw new Error("model did not emit a scenario object");
  }
  // The schema/version discriminators are OUR fixed envelope, not the model's to get right — stamp them
  // so a model that fumbles the boilerplate can't fail an otherwise-good scenario.
  return { ...tool.input, schema: "bacteria-scenario", version: 1 };
}
function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}

// ---- DOI resolution — metadata from Crossref, abstract from whichever source has it ----------------
// The abstract is what keeps the lesson HONEST: without it the model writes from memory and invents
// paper-specific claims. Crossref often lacks abstracts, so we cascade to Europe PMC and Semantic
// Scholar (both carry abstracts for most life-science papers) before giving up.
function stripJats(s) { return typeof s === "string" ? s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : ""; }
async function tryJson(url, headers) {
  try { const r = await fetch(url, { headers }); return r.ok ? await r.json() : null; } catch { return null; }
}
async function fetchAbstract(doi) {
  const epmc = await tryJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&resultType=core&format=json`);
  const a1 = epmc?.resultList?.result?.[0]?.abstractText;
  if (a1) return { text: stripJats(a1), source: "Europe PMC" };
  const s2 = await tryJson(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=abstract`);
  if (s2?.abstract) return { text: stripJats(s2.abstract), source: "Semantic Scholar" };
  return { text: "", source: "" };
}
async function resolveDoi(doi) {
  const clean = cleanDoi(doi);
  if (!DOI_RE.test(clean)) throw new Error("that does not look like a DOI");
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, {
    headers: { "User-Agent": "bacteria-the-game-scenarios (mailto:noreply@cryomics.org)" },
  });
  if (!res.ok) throw new Error(`Crossref ${res.status} for ${clean}`);
  const m = (await res.json()).message;
  const year = m.published?.["date-parts"]?.[0]?.[0] || m.created?.["date-parts"]?.[0]?.[0] || "";
  const authors = (m.author || []).slice(0, 3).map((a) => a.family).filter(Boolean).join(", ");
  let abstract = stripJats(m.abstract), absSource = abstract ? "Crossref" : "";
  if (!abstract) { const f = await fetchAbstract(clean); abstract = f.text; absSource = f.source; }
  return {
    doi: clean, abstract, absSource,
    title: Array.isArray(m.title) ? m.title[0] : m.title || "",
    journal: Array.isArray(m["container-title"]) ? m["container-title"][0] : "",
    subjects: m.subject || [],
    citation: `${authors}${authors ? " " : ""}(${year}). ${Array.isArray(m.title) ? m.title[0] : ""}. doi:${clean}`.trim(),
  };
}

function archiveSummary() {
  if (!existsSync(scenDir)) return [];
  return readdirSync(scenDir).filter((f) => f.endsWith(".json")).map((f) => {
    try { const s = JSON.parse(readFileSync(join(scenDir, f), "utf8")); return `- ${s.meta?.title} (${s.meta?.realWorldBasis || ""})`; }
    catch { return null; }
  }).filter(Boolean);
}

async function buildPrompt() {
  const archive = archiveSummary();
  const novelty = archive.length ? `\n\nAlready in the library (make yours DISTINCT from these — different organism, environment, and lesson):\n${archive.join("\n")}` : "";
  if (mode === "doi") {
    const doi = arg("doi");
    if (!doi) throw new Error("--doi required in doi mode");
    const p = await resolveDoi(doi);
    console.log(`[generate] resolved ${p.doi} — abstract source: ${p.absSource || "NONE"}`);
    const grounding = p.abstract
      ? `Abstract (source: ${p.absSource}):\n${p.abstract}\n\nGround the mini-lesson STRICTLY in this abstract and title. Do NOT state any specific figure, sample count, location, organism, mechanism, or finding that is not present in the abstract above — no invented specifics. It is fine to add general, well-established textbook background about the habitat/organism type.`
      : `No abstract could be retrieved for this paper. Therefore keep the mini-lesson GENERAL: describe the habitat/organism type at a textbook level and do NOT attribute any specific claim, number, or finding to this paper. Do not fabricate details you cannot verify.`;
    return { prompt: `${schemaSpec()}\n\nBuild a scenario seeded by this scientific paper. Capture its microbial system as a playable level and teach its topic in the mini-lesson. Use this citation verbatim in meta.citation: "${p.citation}".\n\nTitle: ${p.title}\nJournal: ${p.journal}\nSubjects: ${p.subjects.join(", ")}\n${grounding}${novelty}`,
      idHint: `doi-${slug(p.doi)}`, citation: p.citation };
  }
  return { prompt: `${schemaSpec()}\n\nInvent today's scenario: pick a real, vivid microbial-ecology situation (a specific event, habitat, or organism) with strong educational value.${novelty}`, idHint: `daily-${today}` };
}

// --mock <file> feeds a canned model response instead of calling the API, so the WHOLE pipeline
// (resolve → prompt → parse → validate → write → index) is exercisable in CI without a paid key.
const mockFile = arg("mock");
async function generateOnce(prompt) {
  // mock mode reads a canned text reply (for hermetic CI); live mode gets a parsed object via tool use.
  const raw = mockFile ? extractJson(readFileSync(mockFile, "utf8")) : await modelScenario(prompt);
  const result = validateScenario(raw, defaults);
  return { raw, result };
}

(async () => {
  if (!mockFile && !process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set"); process.exit(2); }
  const { prompt, idHint } = await buildPrompt();
  let { raw, result } = await generateOnce(prompt);
  if (!result.ok) {
    console.warn("first attempt invalid:", result.reason, "— retrying once");
    ({ raw, result } = await generateOnce(`${prompt}\n\nYour previous attempt was REJECTED: ${result.reason}. Fix exactly that and output the corrected JSON only.`));
  }
  if (!result.ok) { console.error("generation failed validation twice:", result.reason); process.exit(1); }

  if (!existsSync(scenDir)) mkdirSync(scenDir, { recursive: true });
  const id = slug(idHint);
  // Credit is OURS to stamp, never the model's to invent: it comes from the person who submitted the
  // paper, and it is stamped after validation passed so it cannot be what makes a scenario fail. The
  // hard sanitising happens in the endpoint that collected it and again in the game's validator.
  const credit = (arg("credit") || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40);
  if (credit) { raw.meta = { ...raw.meta, submittedBy: credit }; }
  writeFileSync(join(scenDir, `${id}.json`), JSON.stringify(raw, null, 2) + "\n");
  buildIndex(repo);   // rebuild index.json from the files on disk — never accumulates stale/duplicate rows

  console.log(`✓ wrote scenarios/${id}.json — "${raw.meta.title}"`);
  if (process.env.GITHUB_OUTPUT) { try { appendFileSync(process.env.GITHUB_OUTPUT, `scenario_id=${id}\n`); } catch {} }
})().catch((e) => { console.error("generate error:", e.message); process.exit(1); });
