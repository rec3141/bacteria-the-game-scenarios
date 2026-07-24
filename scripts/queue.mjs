// Read the game's public request queue and print the ones we have not built yet.
//
//   node scripts/queue.mjs   -> one "<mode>\t<id>\t<payload>\t<name>" line per pending request
//
// name is LAST because it is the only field that can be empty (anonymous), and bash `read` with a
// tab IFS collapses an empty MIDDLE field — putting it last keeps every other field aligned.
//
// Two kinds of request share the queue: a DOI (payload = the doi) and a terrain designed in the lab
// (payload = base64 of the terrain JSON). The workflow branches on <mode>.
//
// Players submit a paper from inside the game; scenario-request.php on bacteria.cryomics.org
// appends it to a plain JSON file. This script is the other half: a cron workflow polls that
// file and generates whatever is new. Nothing on the web server holds a credential, which is
// the whole point of the arrangement -- it deploys with the rest of the site and there is no
// token to install by hand or rotate.
//
// There is no "mark as done" write-back, because there is nothing to write back WITH. Instead
// dedup is derived: a request is pending exactly when scenarios/<derived id>.json is absent.
// That is idempotent, survives a run dying halfway, and needs no state anywhere.
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DOI_RE, cleanDoi, doiScenarioId } from "./doi-id.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE_URL = process.env.SCENARIO_QUEUE_URL || "https://bacteria.cryomics.org/scenario-queue.json";
// Per-run cap: the real budget control is the daily ceiling scenario-request.php enforces before
// anything reaches the queue. This is just a backstop so one poll cannot spend an afternoon.
const MAX_PER_RUN = Number(process.env.SCENARIO_MAX_PER_RUN || 2);
// A DOI that fails generation stays pending (nothing was written), so it would be retried on
// every poll forever. Age it out after a day: by then it is a paper Crossref cannot resolve, not
// a transient blip, and 96 polls is a fair number of chances.
const MAX_AGE_MS = Number(process.env.SCENARIO_MAX_AGE_MS || 24 * 60 * 60 * 1000);

// This runs every 15 minutes, so an unreachable site must not paint the Actions tab red 96 times a
// day over something nobody can act on -- a missing queue is simply the normal state of a site
// nobody has submitted to yet, and a blip resolves itself by the next poll. A queue we CAN read but
// cannot parse is different: that is a bug in the endpoint, and it should shout.
let res;
try {
  res = await fetch(QUEUE_URL, { headers: { "User-Agent": "bacteria-the-game-scenarios" } });
} catch (e) {
  console.error(`[queue] ${QUEUE_URL} unreachable (${e.message}) — trying again next poll`);
  process.exit(0);
}
if (!res.ok) {
  console.error(`[queue] no readable queue at ${QUEUE_URL} (HTTP ${res.status}) — trying again next poll`);
  process.exit(0);
}
const body = await res.json().catch(() => null);
const requests = body && Array.isArray(body.requests) ? body.requests : null;
if (!requests) { console.error("[queue] queue is not in the expected shape"); process.exit(1); }

const built = new Set(
  existsSync(join(repo, "scenarios"))
    ? readdirSync(join(repo, "scenarios")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
    : []
);

// Papers we have already tried and could not build. Without this a failure is indistinguishable from
// a brand-new request -- nothing was written, so "does the scenario file exist?" says no every time --
// and the poller pays for two model calls every 15 minutes until the entry ages out a day later.
const MAX_ATTEMPTS = Number(process.env.SCENARIO_MAX_ATTEMPTS || 2);
const giveUp = new Set();
try {
  const f = JSON.parse(readFileSync(join(repo, "failures.json"), "utf8"));
  for (const [id, rec] of Object.entries(f.failures || {})) {
    if (rec && Number(rec.attempts) >= MAX_ATTEMPTS) giveUp.add(id);
  }
} catch { /* no failures file yet, or unreadable → nothing to skip */ }

const now = Date.now();
const pending = [];
const seen = new Set();
// Oldest first: a burst of submissions drains in the order people sent them rather than starving
// whoever was early.
for (const r of requests.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
  if (!r || (r.ts && now - r.ts > MAX_AGE_MS)) continue;
  let mode, id, payload;
  if (r.terrain != null) {
    // a terrain designed in the lab. The endpoint validated its shape and assigned the id, which is
    // authoritative — a fresh scenario is invented for it, so there is no content to derive an id from.
    id = typeof r.id === "string" && /^terrain-[a-z0-9]+$/.test(r.id) ? r.id : null;
    if (!id || !Array.isArray(r.terrain) || !r.terrain.length || r.terrain.length > 4) continue;
    mode = "terrain";
    payload = Buffer.from(JSON.stringify(r.terrain), "utf8").toString("base64");   // no tabs/newlines
  } else {
    const doi = cleanDoi(r.doi);
    if (!DOI_RE.test(doi)) continue;                     // the endpoint filters these, but never trust the wire
    id = doiScenarioId(doi);
    mode = "doi";
    payload = doi;
  }
  if (built.has(id) || seen.has(id)) continue;           // already a level, or asked for twice in one queue
  if (giveUp.has(id)) continue;                          // tried enough times; see failures.json
  seen.add(id);
  // The optional credit name the submitter typed. Scrubbed by the endpoint before it ever reached
  // this file and scrubbed again by the scenario validator; this pass only stops a tab from
  // breaking the TSV the workflow reads.
  const name = typeof r.name === "string" ? r.name.replace(/[\t\r\n]+/g, " ").trim().slice(0, 40) : "";
  pending.push({ mode, id, name, payload });
  if (pending.length >= MAX_PER_RUN) break;
}

console.error(`[queue] ${requests.length} request(s) on file, ${pending.length} to build`);
for (const p of pending) console.log(`${p.mode}\t${p.id}\t${p.payload}\t${p.name}`);
