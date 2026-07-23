// How a DOI becomes a scenario id. Shared so the queue poller and the generator cannot drift:
// queue.mjs decides "have we already built this one?" purely by checking whether the id exists in
// scenarios/, so if its idea of the id differed from the one generate.mjs writes by even one
// character, every queued DOI would look new forever and regenerate on every poll.
export const DOI_RE = /^10\.\d{4,9}\/\S+$/;

// Accept what people actually paste: a bare DOI, a doi.org URL, with stray whitespace.
export function cleanDoi(doi) {
  return String(doi || "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
}

export function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "scenario";
}

// The outer slug() is not redundant: generate.mjs runs the id hint through slug() a second time
// before writing the file, and that pass re-applies the 60-char cap to the "doi-" prefix as well.
// A long DOI therefore truncates, and this must truncate identically.
export function doiScenarioId(doi) { return slug(`doi-${slug(cleanDoi(doi))}`); }
