// Contracts for the player-submission path.  node scripts/selftest.mjs
//
// The load-bearing one is the FIRST: queue.mjs decides a DOI is already built by asking whether
// scenarios/<doiScenarioId(doi)>.json exists, while generate.mjs names the file it writes on its
// own. If those two ever disagree, nothing errors -- every queued DOI just looks new forever and
// regenerates on every 15-minute poll, quietly burning API budget. They share doi-id.mjs to make
// that impossible, and this pins the shape generate.mjs actually derives.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { DOI_RE, cleanDoi, slug, doiScenarioId } from "./doi-id.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");

// ---- generate.mjs must derive ids the same way doi-id.mjs does ----------------------------------
{
  const src = readFileSync(join(here, "generate.mjs"), "utf8");
  assert.match(src, /idHint:\s*`doi-\$\{slug\(p\.doi\)\}`/,
    "generate.mjs must build the DOI id hint as `doi-${slug(cleaned doi)}`");
  assert.match(src, /const id = slug\(idHint\)/,
    "generate.mjs must run the hint through slug() again — doiScenarioId mirrors that second pass");
  assert.match(src, /import \{[^}]*\} from "\.\/doi-id\.mjs"/,
    "generate.mjs must import the shared helper rather than keeping its own copy");
  // and the composition that models those two lines:
  const asGenerateWould = (doi) => slug(`doi-${slug(cleanDoi(doi))}`);
  for (const doi of ["10.1126/science.1261359", "https://doi.org/10.1038/nature12352",
                     "10.1128/AEM.00001-20", `10.1234/${"x".repeat(80)}`]) {
    assert.equal(doiScenarioId(doi), asGenerateWould(doi), `id drift for ${doi}`);
  }
}

// ---- a long DOI must truncate identically on both sides ------------------------------------------
{
  const long = doiScenarioId(`10.1234/${"abcdefghij".repeat(9)}`);
  assert.ok(long.length <= 60, "id must respect the 60-char cap");
  assert.equal(long, doiScenarioId(`10.1234/${"abcdefghij".repeat(9)}`), "id must be deterministic");
}

// ---- DOI normalisation ---------------------------------------------------------------------------
{
  assert.equal(cleanDoi("  https://doi.org/10.1000/xyz  "), "10.1000/xyz");
  assert.equal(cleanDoi("http://dx.doi.org/10.1000/xyz"), "10.1000/xyz");
  assert.equal(doiScenarioId("10.1128/AEM.00001-20"), doiScenarioId("10.1128/aem.00001-20"),
    "DOIs are case-insensitive, so the same paper must not build twice");
  for (const bad of ["not-a-doi", "", "10.1/x", "doi:10.1000/xyz"]) assert.ok(!DOI_RE.test(cleanDoi(bad)), `${bad} must be rejected`);
  assert.ok(DOI_RE.test(cleanDoi("10.1000/xyz")));
}

// ---- queue.mjs filtering, driven through the real script ------------------------------------------
{
  const now = Date.now();
  const queue = { schema: "bacteria-scenario-queue", version: 1, requests: [
    { doi: "10.1126/science.1261359", ts: now - 1000 },              // already in scenarios/ -> skip
    // credited, with a tab and newline in the name — those would split the TSV the workflow reads
    { doi: "https://doi.org/10.1038/nature12352", ts: now - 500, name: "Ada\tLovelace\n" },
    { doi: "not-a-doi", ts: now - 400 },                             // malformed -> skip
    { doi: "10.9999/ancient.1", ts: now - 48 * 3600 * 1000 },        // aged out -> skip
    { doi: "10.1128/AEM.00001-20", ts: now - 200 },                  // new -> build
    { doi: "10.1128/aem.00001-20", ts: now - 100 },                  // same paper -> dedup
    { doi: "10.5555/third.one", ts: now - 50 },                      // over the per-run cap -> next poll
  ] };
  const url = "data:application/json," + encodeURIComponent(JSON.stringify(queue));
  const out = execFileSync("node", [join(here, "queue.mjs")], {
    env: { ...process.env, SCENARIO_QUEUE_URL: url, SCENARIO_MAX_PER_RUN: "2" }, encoding: "utf8",
    // NOT .trim() on the whole output: an anonymous request ends its line with an empty third
    // column, and trimming would silently eat the last row's trailing tab.
  }).split("\n").filter(Boolean).map((l) => l.split("\t"));

  assert.deepEqual(out, [
    // third column is the optional credit; the tab/newline are flattened to spaces so one submitter's
    // name can never shift another row's columns, and an anonymous request emits an empty field
    ["10.1038/nature12352", "doi-10-1038-nature12352", "Ada Lovelace"],
    ["10.1128/AEM.00001-20", "doi-10-1128-aem-00001-20", ""],
  ], "queue must emit oldest-first, deduped, capped, credited, and never re-emit a built scenario");
  for (const row of out) assert.equal(row.length, 3, "every row must have exactly three columns");
}

// ---- a paper we cannot build must stop costing money ---------------------------------------------
// Dedup is derived from "does scenarios/<id>.json exist?", which is right for success and wrong for
// failure: nothing gets written, so an unbuildable paper looks brand new on every 15-minute poll and
// costs two model calls each time. failures.json is what makes the poller give up.
{
  const rf = readFileSync(join(here, "record-failure.mjs"), "utf8");
  assert.match(rf, /attempts/, "failures must be counted, not just listed");
  // the stored record carries no timestamp — it would churn the file and the git history on every
  // failure even when nothing meaningful changed (checked on the written shape, not the prose)
  const written = rf.match(/data\.failures\[id\] = \{[^}]*\}/);
  assert.ok(written, "record-failure must write a failure record");
  assert.ok(!/\bts\b|Date\.now/.test(written[0]), "the stored record must not carry a timestamp");

  const q = readFileSync(join(here, "queue.mjs"), "utf8");
  assert.match(q, /giveUp\.has\(id\)/, "the poller must skip papers it has given up on");
  assert.match(q, /SCENARIO_MAX_ATTEMPTS/, "the attempt ceiling must be configurable");

  // publish.sh must carry failures.json across its hard reset, or the record written moments earlier
  // in the same job is thrown away and the poller retries forever anyway
  const pub = readFileSync(join(here, "publish.sh"), "utf8");
  assert.match(pub, /cp failures\.json "\$STASH\/failures\.json"/,
    "publish.sh must preserve failures.json across the reset");
  assert.match(pub, /if \[ -f failures\.json \]; then git add failures\.json; fi/,
    "publish.sh must commit failures.json — and via `if`, since a bare && list aborts under set -e");
  assert.ok(!/^\[ -f failures\.json \] &&/m.test(pub),
    "a bare `[ -f x ] && cmd` statement aborts the whole publish under set -e when x is absent");
}

// ---- an absent queue is the normal state of a site nobody has submitted to ------------------------
{
  const out = execFileSync("node", [join(here, "queue.mjs")], {
    env: { ...process.env, SCENARIO_QUEUE_URL: "data:application/json,%7B%22requests%22%3A%5B%5D%7D" },
    encoding: "utf8",
  });
  assert.equal(out.trim(), "", "an empty queue must produce no work and exit 0");
}

// ---- the model must be shown the whole parameter surface, with meaning and bounds -----------------
// A 45-path list with no descriptions is why every generated level was the same ocean with a different
// title: the model could only meaningfully move the dozen knobs it had been told about, and the other
// 150 — protist behaviour, the phage lifecycle, the colour of the water — were unreachable and
// unexplained. game.js documents all of them for its tuning panel.
{
  const params = JSON.parse(readFileSync(join(repo, "scripts/params.json"), "utf8")).params;
  const n = Object.keys(params).length;
  assert.ok(n > 120, `expected the full parameter surface, got ${n}`);
  for (const [path, p] of Object.entries(params)) {
    assert.ok(p.doc && p.doc.length > 5, `${path} has no doc string — the model cannot use what it cannot read`);
    assert.ok(Number.isFinite(p.min) && Number.isFinite(p.max) && p.min <= p.max, `${path} has no usable range`);
    assert.ok(p.default >= p.min && p.default <= p.max, `${path}: default ${p.default} is outside its own range`);
  }
  // the expressive ones that used to be unreachable
  for (const path of ["diel.waterNight.0", "diel.waterDay.2", "predator.chaseSpeed", "phage.burst.1",
                      "cell.uptake", "enzyme.maxRadius", "cycle.preyFloor"]) {
    assert.ok(params[path], `${path} must be offered to the model`);
  }
  // and the ones that must never be
  for (const path of ["cell.maxCells", "phage.maxCount", "predator.safetyMax", "grid.cs",
                      "touchSpeedScale", "demo.foodScale", "column.enabled"]) {
    assert.ok(!params[path], `${path} is a ceiling or a device knob and must not be settable by a scenario`);
  }

  const gen = readFileSync(join(here, "generate.mjs"), "utf8");
  assert.match(gen, /MOVE 20-30 PARAMETERS/, "the brief must ask for a real redesign, not a re-skin");
  // a feature the generator cannot see may as well not exist
  assert.match(gen, /"terrain": \[/, "the terrain schema must be shown to the model");
  assert.match(gen, /TERRAIN \(column scenarios only\)/, "terrain needs design guidance, not just a schema");
  assert.match(gen, /PARAM_GROUPS\(\)/, "the full table must actually be rendered into the prompt");
  assert.ok(!/const ENV_WHITELIST = \[/.test(gen),
    "the hand-kept whitelist must be gone — params.json is generated from game.js");
}

// ---- the library must actually exercise terrain ---------------------------------------------------
// Terrain is the one feature with no other coverage in play: the validator can accept it and the
// generator can describe it while no level anywhere is built with it, and nobody would notice until
// someone went looking. Keep at least one real scenario using it, top and bottom both represented.
{
  const dir = join(repo, "scenarios");
  const withTerrain = readdirSync(dir).filter((f) => f.endsWith(".json"))
    .map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8"))])
    .filter(([, s]) => Array.isArray(s.terrain) && s.terrain.length);
  assert.ok(withTerrain.length, "at least one scenario must use terrain, or the feature ships untested");
  const anchors = new Set(withTerrain.flatMap(([, s]) => s.terrain.map((t) => t.at)));
  assert.ok(anchors.has("top") && anchors.has("bottom"),
    "cover both a ceiling and a floor — they are placed by different arithmetic");
  const porous = withTerrain.flatMap(([, s]) => s.terrain).some((t) => t.porosity > 0);
  assert.ok(porous, "cover porosity too: a solid slab exercises none of the pore generation");
  // and terrain only builds in column mode, so a scenario carrying it without a column is inert
  for (const [f, s] of withTerrain) {
    assert.ok(s.column && s.column.enabled === true,
      `${f} declares terrain but is not a column scenario — terrain would never be built`);
  }
}

// ---- publish.sh must not have regrown a PR step ---------------------------------------------------
{
  const pub = readFileSync(join(here, "publish.sh"), "utf8");
  assert.ok(!/gh pr create/.test(pub), "publishing must not open a PR");
  assert.match(pub, /build-index\.mjs/, "publish must rederive index.json rather than merge it");
  for (const wf of ["daily.yml", "doi.yml", "queue.yml"]) {
    const y = readFileSync(join(repo, ".github/workflows", wf), "utf8");
    assert.ok(!/gh pr create/.test(y), `${wf} must publish directly, not via a PR that can go stale`);
    assert.match(y, /group: publish-scenarios/, `${wf} must share the publish concurrency group`);
    // No workflow may route players through GitHub. The in-game form is the submission path precisely
    // so that nobody needs an account; an `issues:` trigger would quietly reintroduce that demand.
    assert.ok(!/^\s{2}issues:/m.test(y), `${wf} must not accept submissions via GitHub issues`);
  }
}

console.log("✓ selftest: id derivation, DOI normalisation, queue filtering, direct-publish contracts");
