// Remember that a DOI failed to generate, so the poller stops paying to retry it forever.
//
//   node scripts/record-failure.mjs <doi> <id> [reason]
//
// Dedup in queue.mjs is derived from "does scenarios/<id>.json exist?", which is exactly right for
// success and exactly wrong for failure: nothing is written, so the request stays pending and is
// retried on every 15-minute poll until it ages out a day later. Each retry costs two model calls
// (the attempt plus generate.mjs's one retry), so a single unbuildable paper burns ~190 calls before
// it goes quiet. This file is the missing half of that dedup.
//
// It is committed to the repo rather than written back to the game's queue on purpose: the whole
// design keeps the web server credential-free, so the repo is the only place CI can record state.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cleanDoi } from "./doi-id.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(repo, "failures.json");

const doi = cleanDoi(process.argv[2]);
const id = String(process.argv[3] || "").trim();
const reason = String(process.argv[4] || "").replace(/\s+/g, " ").trim().slice(0, 200);
if (!doi || !id) { console.error("usage: record-failure.mjs <doi> <id> [reason]"); process.exit(2); }

let data = { schema: "bacteria-scenario-failures", version: 1, failures: {} };
if (existsSync(FILE)) {
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8"));
    if (parsed && typeof parsed.failures === "object" && parsed.failures) data = parsed;
  } catch { /* unreadable → start fresh rather than wedge the poller */ }
}

const prev = data.failures[id];
const attempts = (prev && Number.isInteger(prev.attempts) ? prev.attempts : 0) + 1;
// No timestamp: Date.now() would churn the file (and the git history) on every single failure even
// when nothing meaningful changed. The attempt count is the only thing the poller reads.
data.failures[id] = { doi, attempts, reason };

writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`[failure] ${id} attempt ${attempts}: ${reason || "(no reason given)"}`);
