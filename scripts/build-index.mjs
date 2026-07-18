// Rebuild index.json as a clean mirror of scenarios/ — the FILE is the source of truth, so merges can
// never leave stale or duplicate entries (the id is the filename; the title is read from the file's meta).
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export function buildIndex(repo) {
  const scenDir = join(repo, "scenarios");
  const scenarios = [];
  if (existsSync(scenDir)) {
    for (const f of readdirSync(scenDir).filter((x) => x.endsWith(".json")).sort()) {
      let s; try { s = JSON.parse(readFileSync(join(scenDir, f), "utf8")); } catch { continue; }
      const m = s.meta || {};
      scenarios.push({
        id: f.replace(/\.json$/, ""), title: m.title || f.replace(/\.json$/, ""),
        date: m.date || "", difficulty: m.difficulty || "normal",
        realWorldBasis: m.realWorldBasis || "", file: `scenarios/${f}`,
      });
    }
  }
  const index = { schema: "bacteria-scenario-index", version: 1, scenarios };
  writeFileSync(join(repo, "index.json"), JSON.stringify(index, null, 2) + "\n");
  return scenarios.length;
}

// CLI: node scripts/build-index.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
  console.log(`rebuilt index.json with ${buildIndex(repo)} scenarios`);
}
