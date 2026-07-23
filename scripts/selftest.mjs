// Contracts for the player-submission path.  node scripts/selftest.mjs
//
// The load-bearing one is the FIRST: queue.mjs decides a DOI is already built by asking whether
// scenarios/<doiScenarioId(doi)>.json exists, while generate.mjs names the file it writes on its
// own. If those two ever disagree, nothing errors -- every queued DOI just looks new forever and
// regenerates on every 15-minute poll, quietly burning API budget. They share doi-id.mjs to make
// that impossible, and this pins the shape generate.mjs actually derives.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    { doi: "https://doi.org/10.1038/nature12352", ts: now - 500 },   // new -> build
    { doi: "not-a-doi", ts: now - 400 },                             // malformed -> skip
    { doi: "10.9999/ancient.1", ts: now - 48 * 3600 * 1000 },        // aged out -> skip
    { doi: "10.1128/AEM.00001-20", ts: now - 200 },                  // new -> build
    { doi: "10.1128/aem.00001-20", ts: now - 100 },                  // same paper -> dedup
    { doi: "10.5555/third.one", ts: now - 50 },                      // over the per-run cap -> next poll
  ] };
  const url = "data:application/json," + encodeURIComponent(JSON.stringify(queue));
  const out = execFileSync("node", [join(here, "queue.mjs")], {
    env: { ...process.env, SCENARIO_QUEUE_URL: url, SCENARIO_MAX_PER_RUN: "2" }, encoding: "utf8",
  }).trim().split("\n").filter(Boolean).map((l) => l.split("\t"));

  assert.deepEqual(out, [
    ["10.1038/nature12352", "doi-10-1038-nature12352"],
    ["10.1128/AEM.00001-20", "doi-10-1128-aem-00001-20"],
  ], "queue must emit oldest-first, deduped, capped, and never re-emit a built scenario");
}

// ---- an absent queue is the normal state of a site nobody has submitted to ------------------------
{
  const out = execFileSync("node", [join(here, "queue.mjs")], {
    env: { ...process.env, SCENARIO_QUEUE_URL: "data:application/json,%7B%22requests%22%3A%5B%5D%7D" },
    encoding: "utf8",
  });
  assert.equal(out.trim(), "", "an empty queue must produce no work and exit 0");
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
