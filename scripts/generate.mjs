// Generate a Bacteria! scenario with Claude and validate it against the game schema before writing.
//
//   node scripts/generate.mjs --mode daily
//   node scripts/generate.mjs --mode doi --doi 10.1126/science.1195979
//
// Needs ANTHROPIC_API_KEY in the environment (GitHub Secrets in CI). The generated JSON is validated
// with the SAME validator the game runs; an invalid generation is retried once, then fails the job so a
// bad scenario never lands. Copyright/appropriateness is left to the model's own judgment by design.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateScenario } from "./validator.mjs";

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
  "particles": { id: { "label": str, "mix": [num,num,num] (>=0, over the 3 classes), "rMin": num, "rMax": num,
      "shape": "aggregate"|"ellipse"|"shard", "squash": 0.1..1 (ellipse only), "weight": 0..10 } },
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
distinct feel via env + a re-skinned enzyme; a mini-lesson that teaches the science. Keep numbers physically
plausible. Prefer real organisms and real events. The date field must be exactly "${today}".`;
}

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).map((c) => c.text || "").join("");
}
function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}

// ---- DOI resolution (Crossref metadata + abstract) -------------------------------------------------
function stripJats(s) { return typeof s === "string" ? s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : ""; }
async function resolveDoi(doi) {
  const clean = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  if (!/^10\.\d{4,9}\/\S+$/.test(clean)) throw new Error("that does not look like a DOI");
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, {
    headers: { "User-Agent": "bacteria-the-game-scenarios (mailto:noreply@cryomics.org)" },
  });
  if (!res.ok) throw new Error(`Crossref ${res.status} for ${clean}`);
  const m = (await res.json()).message;
  const year = m.published?.["date-parts"]?.[0]?.[0] || m.created?.["date-parts"]?.[0]?.[0] || "";
  const authors = (m.author || []).slice(0, 3).map((a) => a.family).filter(Boolean).join(", ");
  return {
    doi: clean,
    title: Array.isArray(m.title) ? m.title[0] : m.title || "",
    abstract: stripJats(m.abstract),
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

function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "scenario"; }

async function buildPrompt() {
  const archive = archiveSummary();
  const novelty = archive.length ? `\n\nAlready in the library (make yours DISTINCT from these — different organism, environment, and lesson):\n${archive.join("\n")}` : "";
  if (mode === "doi") {
    const doi = arg("doi");
    if (!doi) throw new Error("--doi required in doi mode");
    const p = await resolveDoi(doi);
    const src = p.abstract ? `Abstract: ${p.abstract}` : "(no abstract available — use the title and your knowledge of the topic)";
    return { prompt: `${schemaSpec()}\n\nBuild a scenario seeded by this scientific paper. Capture its microbial system as a playable level and teach its key finding in the mini-lesson. Use this citation verbatim in meta.citation: "${p.citation}".\n\nTitle: ${p.title}\nJournal: ${p.journal}\nSubjects: ${p.subjects.join(", ")}\n${src}${novelty}`,
      idHint: `doi-${slug(p.doi)}`, citation: p.citation };
  }
  return { prompt: `${schemaSpec()}\n\nInvent today's scenario: pick a real, vivid microbial-ecology situation (a specific event, habitat, or organism) with strong educational value.${novelty}`, idHint: `daily-${today}` };
}

// --mock <file> feeds a canned model response instead of calling the API, so the WHOLE pipeline
// (resolve → prompt → parse → validate → write → index) is exercisable in CI without a paid key.
const mockFile = arg("mock");
async function generateOnce(prompt) {
  const text = mockFile ? readFileSync(mockFile, "utf8") : await callClaude(prompt);
  const raw = extractJson(text);
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
  writeFileSync(join(scenDir, `${id}.json`), JSON.stringify(raw, null, 2) + "\n");

  // update index.json
  const indexPath = join(repo, "index.json");
  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : { schema: "bacteria-scenario-index", version: 1, scenarios: [] };
  index.scenarios = (index.scenarios || []).filter((s) => s.id !== id);
  index.scenarios.push({ id, title: raw.meta.title, date: raw.meta.date, difficulty: raw.meta.difficulty || "normal", realWorldBasis: raw.meta.realWorldBasis || "", file: `scenarios/${id}.json` });
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

  console.log(`✓ wrote scenarios/${id}.json — "${raw.meta.title}"`);
  console.log(`::set-output name=scenario_id::${id}`);
})().catch((e) => { console.error("generate error:", e.message); process.exit(1); });
