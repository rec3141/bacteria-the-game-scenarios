// AUTO-GENERATED from bacteria-the-game/game.js (TUNE_VALIDATOR + SCENARIO_VALIDATOR blocks).
// Self-contained so CI can validate scenarios without the game repo. Keep in sync when the schema changes.
// Exports validateScenario(raw, defaults) — the SAME data-only, atomic validator the game runs at load.
//
// Regenerate by slicing those two blocks out of game.js verbatim. Do not hand-edit: this file and the
// game must agree exactly, or a scenario that CI accepts can still be rejected in the browser (and the
// player silently gets the stock ocean instead).

// TUNE_VALIDATOR_START — pure production validator, executed directly by the Node fixture test.
  const TUNE_EXACT_RULES = {
    "grid.cs": { min: 1, max: 64, integer: true },
    "day.lengthSec": { min: 1, max: 86400 },
    "day.startHour": { min: 0, max: 23 },
    "day.latitude": { min: -90, max: 90 },
    "day.dayOfYear": { min: 1, max: 365, integer: true },
    "diel.tempBase": { min: -10, max: 50 },
    "diel.tempLag": { min: 0, max: 1 },
    "diel.foodFloor": { min: 0, max: 1 },
    "diel.twilight": { min: 0, max: 1 },
    "diel.goldTint": { min: 0, max: 1 },
    "diel.q10RefC": { min: -50, max: 60 },
    "phage.adsorbBase": { min: 0, max: 1 },
    "phage.superinfDecay": { min: 0, max: 1 },
    "phage.seedRatio": { min: 0, max: 1 },
    "cell.driftOnUpgrade": { min: 0, max: 1, integer: true },
    "cell.driftGainChance": { min: 0, max: 1 },
    "cell.twitchSpeedScale": { min: 0, max: 1 },
    "touch.autoEnzyme": { min: 0, max: 1, integer: true },
    "predator.cystEatChance": { min: 0, max: 1 },
    "predator.resistStep": { min: 0, max: 1 },
    "predator.resistMax": { min: 0, max: 1 },
    "predator.cystMealFactor": { min: 0, max: 1 },
    "substrate.grainStrength": { min: 0, max: 2 },
    "substrate.grainFloor": { min: 0, max: 1 },
    "substrate.grainRim": { min: 0, max: 4 },
    "cell.maxCells": { min: 1, max: 200000, integer: true },
    "predator.safetyMax": { min: 1, max: 2000, integer: true },
    "phage.maxCount": { min: 1, max: 10000, integer: true },
    "eps.maxCount": { min: 0, max: 2000, integer: true },
    "nutrient.maxCount": { min: 1, max: 10000, integer: true },
    "substrate.count": { min: 0, max: 1000, integer: true },
  };
  const TUNE_INTEGER_PATHS = new Set([
    "cell.startUpgrades", "substrate.minPerRes", "cycle.reseedBacteria", "cycle.reseedProtists",
    "cycle.preyFloor", "predator.count", "predator.minCount", "predator.immigrateCap",
    "predator.immigrateMax", "predator.killMotes", "phage.greenCount", "phage.seedBatch",
    "phage.greenFloor", "phage.goldCount", "phage.goldCountTouch", "phage.hostTolerance",
    "phage.seedPerCell", "phage.seedRoundsMax", "phage.greenFloorMax",
    "phage.burst.0", "phage.burst.1", "phage.maxLoad", "phage.burstPerLoad", "toxin.crossDist", "eps.maxCount",
  ]);
  const TUNE_POSITIVE_PATHS = new Set([
    "cell.radius", "cell.baseHalf", "cell.maxHalf", "cell.dragRate", "cell.cystDragRate",
    "cell.maxSpeed", "cell.runMin", "cell.runMax", "cell.tumbleDur", "cell.enzymeCooldown.0",
    "cell.enzymeCooldown.1", "cell.invulnTime", "cell.fedLinger", "cell.touchLatchSecs",
    "cell.touchRunSecs", "touch.autoEnzymeEvery", "substrate.bloomEvery",
    "substrate.sizeMin", "substrate.sizeMax", "substrate.lifeMin", "substrate.lifeMax",
    "substrate.dissolveTime", "enzyme.life", "enzyme.maxRadius", "enzyme.growTime", "toxin.life",
    "toxin.maxRadius", "toxin.growTime", "nutrient.life", "nutrient.radius", "cycle.preyEvery",
    "eps.lifePerLevel", "eps.radius", "eps.growTime", "eps.cooldown.0", "eps.cooldown.1", "eps.threatRange",
    "cycle.turboSecs", "cycle.turboMaxSecs", "predator.radius", "predator.satiatedTime",
    "predator.maturity", "predator.reproCooldown", "predator.immigrateEvery", "predator.respawnFloor",
    "phage.radius", "phage.life.0", "phage.life.1", "phage.latent.0", "phage.latent.1",
    "phage.greenSeed.0", "phage.greenSeed.1", "phage.goldLife.0", "phage.goldLife.1",
    "phage.twitchAdsorbMult", "touch.zoom", "diel.q10",
  ]);
  const TUNE_ORDERED_RANGES = [
    ["cell.baseHalf", "cell.maxHalf"], ["cell.runMin", "cell.runMax"],
    ["cell.enzymeCooldown.0", "cell.enzymeCooldown.1"], ["substrate.sizeMin", "substrate.sizeMax"],
    ["substrate.lifeMin", "substrate.lifeMax"], ["substrate.driftMin", "substrate.driftMax"],
    ["phage.life.0", "phage.life.1"], ["phage.burst.0", "phage.burst.1"],
    ["phage.latent.0", "phage.latent.1"], ["phage.greenSeed.0", "phage.greenSeed.1"],
    ["phage.goldLife.0", "phage.goldLife.1"], ["cycle.turboSecs", "cycle.turboMaxSecs"],
    ["eps.cooldown.0", "eps.cooldown.1"],
  ];
  const TUNE_RELATIONS = [
    ["cell.startEnergy", "cell.maxEnergy", "start energy cannot exceed max energy"],
    ["cell.divideThreshold", "cell.maxEnergy", "division threshold cannot exceed max energy"],
    ["cell.cystBelow", "cell.cystWake", "cyst wake energy must exceed the encyst threshold", true],
    ["predator.count", "predator.safetyMax", "protist count cannot exceed its safety cap"],
    ["predator.minCount", "predator.safetyMax", "protist minimum cannot exceed its safety cap"],
    ["predator.minCount", "predator.immigrateCap", "protist minimum cannot exceed its immigration cap"],
    ["predator.immigrateCap", "predator.safetyMax", "protist immigration cap cannot exceed its safety cap"],
    ["phage.greenCount", "phage.maxCount", "green-phage count cannot exceed the phage cap"],
    ["phage.greenFloor", "phage.maxCount", "green-phage floor cannot exceed the phage cap"],
    ["phage.greenFloorMax", "phage.maxCount", "the abundance-scaled phage floor cap cannot exceed the phage cap"],
    ["phage.goldCount", "phage.maxCount", "gold-phage count cannot exceed the phage cap"],
    ["phage.goldCountTouch", "phage.maxCount", "touch gold-phage count cannot exceed the phage cap"],
  ];
  function tuneValidatorLeaves(object, path = []) {
    const out = [];
    if (!object || typeof object !== "object") return out;
    for (const key of Object.keys(object)) {
      const value = object[key], next = [...path, key];
      if (typeof value === "number") out.push({ path: next, value });
      else if (value && typeof value === "object") out.push(...tuneValidatorLeaves(value, next));
    }
    return out;
  }
  function tuneValidatorGet(object, dotted) {
    return dotted.split(".").reduce((value, key) => value == null ? undefined : value[key], object);
  }
  function tuneRule(path, defaultValue) {
    const key = Array.isArray(path) ? path.join(".") : path;
    if (TUNE_EXACT_RULES[key]) return TUNE_EXACT_RULES[key];
    if (/^diel\.water(?:Night|Day)\.[0-2]$/.test(key)) return { min: 0, max: 255 };
    return {
      min: TUNE_POSITIVE_PATHS.has(key) ? 0.001 : 0,
      max: Math.max(100, Math.abs(Number(defaultValue) || 0) * 100),
      integer: TUNE_INTEGER_PATHS.has(key),
    };
  }
  function validateTuningConfig(candidate, defaults) {
    const errors = [];
    for (const leaf of tuneValidatorLeaves(candidate)) {
      const key = leaf.path.join("."), def = tuneValidatorGet(defaults, key), rule = tuneRule(key, def);
      if (!Number.isFinite(leaf.value)) { errors.push(`${key} must be finite`); continue; }
      if (leaf.value < rule.min || leaf.value > rule.max)
        errors.push(`${key} must be between ${rule.min} and ${rule.max}`);
      else if (rule.integer && !Number.isInteger(leaf.value)) errors.push(`${key} must be an integer`);
    }
    for (const [lowKey, highKey] of TUNE_ORDERED_RANGES) {
      const low = tuneValidatorGet(candidate, lowKey), high = tuneValidatorGet(candidate, highKey);
      if (Number.isFinite(low) && Number.isFinite(high) && low > high)
        errors.push(`${lowKey} must not exceed ${highKey}`);
    }
    for (const [lowKey, highKey, message, strict] of TUNE_RELATIONS) {
      const low = tuneValidatorGet(candidate, lowKey), high = tuneValidatorGet(candidate, highKey);
      if (Number.isFinite(low) && Number.isFinite(high) && (strict ? low >= high : low > high)) errors.push(message);
    }
    return errors;
  }
  // TUNE_VALIDATOR_END

// SCENARIO_VALIDATOR_START — pure, data-only validator for #28 scenario JSON. Executed directly by a
  // Node test (it needs only the TUNE_VALIDATOR block above it). A scenario is UNTRUSTED content: it may
  // set environment/organism parameters but can never introduce code or a new game verb. Validation is
  // ATOMIC — any violation rejects the whole scenario and the caller falls back to the stock ocean.
  //
  // env overrides are restricted to this whitelist (a subset of the tuning paths). Hard safety caps
  // (maxCount / safetyMax / maxCells / nutrient.maxCount) and cosmetic device knobs are deliberately
  // absent, so a scenario cannot raise a ceiling or reach into the touch UI. Setting anything off-list
  // rejects rather than being silently dropped — an off-list path is a hallucination signal.
  const SCENARIO_ENV_WHITELIST = new Set([
    "day.lengthSec", "day.startHour", "day.latitude", "day.dayOfYear",
    "diel.tempBase", "diel.tempAmp", "diel.tempLag", "diel.foodFloor", "diel.grazeNight",
    "diel.twilight", "diel.q10", "diel.q10RefC",
    "substrate.count", "substrate.sizeMin", "substrate.sizeMax", "substrate.lifeMin", "substrate.lifeMax",
    "predator.count", "predator.senseRange", "predator.chaseSpeed", "predator.wanderSpeed",
    "predator.mealEnergy", "predator.metabolism", "predator.resistStep", "predator.resistMax",
    "predator.reproEnergy", "predator.reproCooldown",
    "phage.greenCount", "phage.goldCount", "phage.hostTolerance", "phage.adsorbBase",
    "phage.life.0", "phage.life.1", "phage.latent.0", "phage.latent.1", "phage.burst.0", "phage.burst.1",
    "cell.startEnergy", "cell.divideThreshold", "enzyme.life", "enzyme.maxRadius",
    "toxin.life", "toxin.maxRadius", "eps.lifePerLevel", "eps.radius",
  ]);
  const SCENARIO_PRIMITIVES = new Set(["enzyme0", "enzyme1", "enzyme2", "chemotaxis", "antibiotic", "eps", "crispr", "twitching"]);
  const SCENARIO_SHAPES = new Set(["aggregate", "ellipse", "shard"]);
  const SCENARIO_DIFFICULTY = new Set(["easy", "normal", "hard", "extreme"]);
  const SCENARIO_GENE_MAX = 12; // upper bound for authored genome levels (well above the natural tier ceiling)
  // Least food a scenario may leave on the board, as a fraction of the default ocean's. 0.5 is below
  // every hand-authored level (the thinnest is 69%) and far above the 0.02%-3% the generator produced
  // when it wrote particle sizes in micrometres.
  const SCENARIO_MIN_FOOD = 0.5;
  function scEnvAllowed(path) { return SCENARIO_ENV_WHITELIST.has(path) || /^diel\.water(?:Night|Day)\.[0-2]$/.test(path); }
  function scStr(v, max) {
    if (typeof v !== "string") return null;
    const clean = v.replace(/[\u0000-\u001f<>]/g, "");
    return clean.length > max ? clean.slice(0, max) : clean;
  }
  const scColor = (v) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : null;
  const scClone = (v) => JSON.parse(JSON.stringify(v));
  function scDeepSet(root, dotted, value) { const p = dotted.split("."); let o = root; for (let i = 0; i < p.length - 1; i++) o = o[p[i]] || (o[p[i]] = {}); o[p[p.length - 1]] = value; }
  // Every TERMINAL leaf of an override tree (unlike tuneValidatorLeaves, which skips non-numbers) — so a
  // string/boolean where a number belongs is caught and rejected rather than silently ignored.
  function scEnvLeaves(obj, path, out) {
    for (const k of Object.keys(obj)) {
      const v = obj[k], p = path ? path + "." + k : k;
      if (v && typeof v === "object") scEnvLeaves(v, p, out); else out.push([p, v]);
    }
    return out;
  }
  const scReject = (reason) => ({ ok: false, reason });
  // Reject any object carrying a key outside `allowed` — an unexpected field is a hallucination signal,
  // never silently ignored.
  function scOnlyKeys(obj, allowed, where) {
    for (const k of Object.keys(obj)) if (!allowed.has(k)) return `unknown ${where} field "${k}"`;
    return null;
  }
  // Clamp a scenario-supplied number into its tuning rule (integers rounded). Returns null if not finite.
  function scClampToRule(path, v) {
    if (!Number.isFinite(v)) return null;
    const rule = tuneRule(path, v);
    let out = Math.max(rule.min, Math.min(rule.max, v));
    if (rule.integer) out = Math.round(out);
    return out;
  }
  function validateScenario(raw, defaults) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return scReject("scenario is not an object");
    if (raw.schema !== "bacteria-scenario") return scReject("wrong schema tag");
    if (raw.version !== 1) return scReject("unsupported schema version");
    const topErr = scOnlyKeys(raw, new Set(["schema", "version", "meta", "env", "resources", "particles", "actions", "organisms", "column"]), "top-level");
    if (topErr) return scReject(topErr);

    // ---- meta (required) ----
    const m = raw.meta;
    if (!m || typeof m !== "object") return scReject("missing meta");
    const metaErr = scOnlyKeys(m, new Set(["title", "date", "lesson", "citation", "difficulty", "realWorldBasis", "authorNote", "submittedBy"]), "meta");
    if (metaErr) return scReject(metaErr);
    const title = scStr(m.title, 80), lesson = scStr(m.lesson, 1200);
    if (!title) return scReject("meta.title required");
    if (!lesson) return scReject("meta.lesson required");
    if (typeof m.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) return scReject("meta.date must be YYYY-MM-DD");
    if (m.difficulty != null && !SCENARIO_DIFFICULTY.has(m.difficulty)) return scReject("meta.difficulty invalid");
    const meta = { title, date: m.date, lesson,
      citation: scStr(m.citation, 300) || "", difficulty: m.difficulty || "normal",
      realWorldBasis: scStr(m.realWorldBasis, 120) || "", authorNote: scStr(m.authorNote, 300) || "",
      // Credit for the player whose paper this was. A name typed by a stranger, so it goes through
      // scStr like everything else — control characters and angle brackets stripped, length capped.
      submittedBy: scStr(m.submittedBy, 40) || "" };

    // ---- env → CFG candidate (clamped, then validateTuningConfig has the final word) ----
    const cfg = scClone(defaults);
    if (raw.env != null) {
      if (typeof raw.env !== "object" || Array.isArray(raw.env)) return scReject("env must be an object");
      for (const [key, value] of scEnvLeaves(raw.env, "", [])) {
        if (!scEnvAllowed(key)) return scReject(`env path "${key}" is not settable by a scenario`);
        if (typeof value !== "number" || !Number.isFinite(value)) return scReject(`env.${key} must be a finite number`);
        scDeepSet(cfg, key, scClampToRule(key, value));
      }
    }
    const cfgErrors = validateTuningConfig(cfg, defaults);
    if (cfgErrors.length) return scReject("env violates tuning rules: " + cfgErrors[0]);

    // A scenario must leave enough food on the board to be survivable. Author-supplied sizes are
    // RADII IN SCREEN PIXELS (default 20-60), and generated scenarios kept setting them to real
    // microbial dimensions instead — 3-9, or 0.4-1.2 — which is correct biology in the wrong unit and
    // left boards with under 3% of the default food. Nothing could eat, so the level was unplayable.
    //
    // This is a floor applied to SCENARIOS ONLY, deliberately not a tuning rule: the tuning panel is
    // for deliberate experiments and must stay free to explore a starved sea. And it is a clamp rather
    // than a rejection because the whole scenario is atomic — rejecting would throw away a good lesson
    // over one mis-scaled number, and fall back to the stock ocean with no explanation.
    const foodMass = (a, b, p, n) => {
      // mean squared radius under the Junge spectrum powerLawSize() samples (PDF ∝ R^-p), times count
      const num = (Math.pow(b, 3 - p) - Math.pow(a, 3 - p)) / (3 - p);
      const den = (Math.pow(b, 1 - p) - Math.pow(a, 1 - p)) / (1 - p);
      return (num / den) * n;
    };
    {
      const S = cfg.substrate, dS = defaults.substrate, p = S.sizeExp != null ? S.sizeExp : 1.6;
      const want = foodMass(dS.sizeMin, dS.sizeMax, p, dS.count) * SCENARIO_MIN_FOOD;
      const have = foodMass(S.sizeMin, S.sizeMax, p, S.count);
      if (Number.isFinite(have) && have > 0 && have < want) {
        // scale the radii, not the count: a scenario's particle count is usually a deliberate
        // statement about productivity, whereas the sizes here are simply in the wrong unit
        const k = Math.sqrt(want / have);
        S.sizeMin = scClampToRule("substrate.sizeMin", S.sizeMin * k);
        S.sizeMax = scClampToRule("substrate.sizeMax", S.sizeMax * k);
      }
    }

    // ---- resources: cosmetic re-skin of the 3 fixed classes, by index ----
    const resources = [];
    if (raw.resources != null) {
      if (!Array.isArray(raw.resources) || raw.resources.length > 3) return scReject("resources must be an array of at most 3");
      const seen = new Set();
      for (const r of raw.resources) {
        if (!r || typeof r !== "object") return scReject("resource entry must be an object");
        const rErr = scOnlyKeys(r, new Set(["index", "label", "enzymeLabel", "color"]), "resource");
        if (rErr) return scReject(rErr);
        if (!Number.isInteger(r.index) || r.index < 0 || r.index > 2) return scReject("resource.index must be 0..2");
        if (seen.has(r.index)) return scReject("duplicate resource.index");
        seen.add(r.index);
        const color = r.color == null ? null : scColor(r.color);
        if (r.color != null && !color) return scReject("resource.color must be #rrggbb");
        resources.push({ index: r.index, label: scStr(r.label, 40) || "", enzymeLabel: scStr(r.enzymeLabel, 40) || "", color });
      }
    }

    // ---- actions: re-weight/re-skin the FIXED primitive pool (no new verbs) ----
    const actions = {};
    if (raw.actions != null) {
      if (typeof raw.actions !== "object" || Array.isArray(raw.actions)) return scReject("actions must be an object");
      let anyPositive = false;
      for (const key of Object.keys(raw.actions)) {
        if (!SCENARIO_PRIMITIVES.has(key)) return scReject(`unknown action primitive "${key}"`);
        const a = raw.actions[key];
        if (!a || typeof a !== "object") return scReject("action entry must be an object");
        const aErr = scOnlyKeys(a, new Set(["label", "color", "weight"]), "action");
        if (aErr) return scReject(aErr);
        let weight = 1;
        if (a.weight != null) { if (!Number.isFinite(a.weight) || a.weight < 0 || a.weight > 10) return scReject("action.weight must be 0..10"); weight = a.weight; }
        if (weight > 0) anyPositive = true;
        const color = a.color == null ? null : scColor(a.color);
        if (a.color != null && !color) return scReject("action.color must be #rrggbb");
        actions[key] = { label: scStr(a.label, 40) || "", color, weight };
      }
      if (Object.keys(actions).length && !anyPositive) return scReject("at least one action must have a positive weight");
    }

    // ---- particles: scenario substrate types built from the 3 fixed classes ----
    const particles = {};
    if (raw.particles != null) {
      if (typeof raw.particles !== "object" || Array.isArray(raw.particles)) return scReject("particles must be an object");
      for (const id of Object.keys(raw.particles)) {
        const p = raw.particles[id];
        if (!p || typeof p !== "object") return scReject("particle entry must be an object");
        const pErr = scOnlyKeys(p, new Set(["label", "mix", "rMin", "rMax", "shape", "squash", "weight"]), "particle");
        if (pErr) return scReject(pErr);
        if (!Array.isArray(p.mix) || p.mix.length !== 3) return scReject("particle.mix must have length 3");
        let sum = 0; for (const x of p.mix) { if (!Number.isFinite(x) || x < 0) return scReject("particle.mix entries must be >= 0"); sum += x; }
        if (sum <= 0) return scReject("particle.mix cannot be all zero");
        const mix = p.mix.map((x) => x / sum);
        if (p.shape != null && !SCENARIO_SHAPES.has(p.shape)) return scReject("particle.shape invalid");
        const rMin = scClampToRule("substrate.sizeMin", Number.isFinite(p.rMin) ? p.rMin : defaults.substrate.sizeMin);
        const rMax = scClampToRule("substrate.sizeMax", Number.isFinite(p.rMax) ? p.rMax : defaults.substrate.sizeMax);
        if (rMin == null || rMax == null || rMin > rMax) return scReject("particle rMin/rMax invalid");
        let weight = 1;
        if (p.weight != null) { if (!Number.isFinite(p.weight) || p.weight < 0 || p.weight > 10) return scReject("particle.weight must be 0..10"); weight = p.weight; }
        let squash = null;
        if (p.squash != null) { if (!Number.isFinite(p.squash) || p.squash < 0.1 || p.squash > 1) return scReject("particle.squash must be 0.1..1"); squash = p.squash; }
        particles[scStr(id, 40) || "p"] = { label: scStr(p.label, 40) || "", mix, rMin, rMax, shape: p.shape || "aggregate", squash, weight };
      }
    }

    // ---- organisms.cells: immigrant/founder genome bundles (data only; genome fields are the exact
    //      mutable fields the engine already carries — no new field can be smuggled in) ----
    const organisms = { cells: [] };
    if (raw.organisms != null) {
      if (typeof raw.organisms !== "object" || Array.isArray(raw.organisms)) return scReject("organisms must be an object");
      // v1 applies cells + blooms (immigrant/founder genome bundles). Grazer/phage tuning is done through
      // env.predator.* / env.phage.* (already whitelisted), so a dedicated grazers/phages block is not yet
      // a thing — reject it rather than accept-and-ignore, which would be a silent lie to the author.
      const oErr = scOnlyKeys(raw.organisms, new Set(["cells", "blooms"]), "organisms");
      if (oErr) return scReject(oErr);
      const cellList = [].concat(raw.organisms.cells || [], (raw.organisms.blooms || []).map((b) => Object.assign({ bloom: true }, b)));
      const ids = new Set();
      for (const c of cellList) {
        if (!c || typeof c !== "object") return scReject("organism cell must be an object");
        const cErr = scOnlyKeys(c, new Set(["id", "label", "color", "genome", "immigrateWeight", "bloom"]), "organism cell");
        if (cErr) return scReject(cErr);
        const id = scStr(c.id, 40);
        if (!id || ids.has(id)) return scReject("organism cell id missing or duplicated");
        ids.add(id);
        const g = c.genome || {};
        const gErr = scOnlyKeys(g, new Set(["enzLvl", "chemoLevel", "antibiotic", "eps", "crispr", "twitching", "chemolithotroph"]), "genome");
        if (gErr) return scReject(gErr);
        const enz = g.enzLvl;
        if (!Array.isArray(enz) || enz.length !== 3) return scReject("genome.enzLvl must have length 3");
        const gi = (v) => Number.isInteger(v) && v >= 0 && v <= SCENARIO_GENE_MAX;
        for (const e of enz) if (!gi(e)) return scReject("genome.enzLvl entries out of range");
        for (const k of ["chemoLevel", "antibiotic", "eps"]) if (g[k] != null && !gi(g[k])) return scReject(`genome.${k} out of range`);
        let iw = 1;
        if (c.immigrateWeight != null) { if (!Number.isFinite(c.immigrateWeight) || c.immigrateWeight < 0 || c.immigrateWeight > 10) return scReject("immigrateWeight must be 0..10"); iw = c.immigrateWeight; }
        const color = c.color == null ? null : scColor(c.color);
        if (c.color != null && !color) return scReject("organism cell color must be #rrggbb");
        organisms.cells.push({ id, label: scStr(c.label, 40) || "", color,
          genome: { enzLvl: [enz[0], enz[1], enz[2]], chemoLevel: g.chemoLevel|0, antibiotic: g.antibiotic|0,
            eps: g.eps|0, crispr: g.crispr === true, twitching: g.twitching === true, chemolithotroph: g.chemolithotroph === true },
          immigrateWeight: iw, bloom: c.bloom === true });
      }
    }

    // ---- column: #30 vertical placeholder — validated so a malformed block still triggers the whole-
    //      scenario fallback, but NOT applied in v1 (enabled must be false until #30 turns it on) ----
    let column = null;
    if (raw.column != null) {
      const col = raw.column;
      if (!col || typeof col !== "object") return scReject("column must be an object");
      const colErr = scOnlyKeys(col, new Set(["enabled", "layers", "thermocline", "chemical"]), "column");
      if (colErr) return scReject(colErr);
      if (col.enabled != null && typeof col.enabled !== "boolean") return scReject("column.enabled must be boolean");
      // optional chemical-energy field for chemolithotroph scenarios
      if (col.chemical != null) {
        const cf = col.chemical;
        if (!cf || typeof cf !== "object") return scReject("column.chemical must be an object");
        const cfErr = scOnlyKeys(cf, new Set(["peakDepth", "spread", "strength", "color"]), "column.chemical");
        if (cfErr) return scReject(cfErr);
        const band = (v, lo, hi, name) => v == null || (Number.isFinite(v) && v >= lo && v <= hi) ? null : `column.chemical ${name} out of range`;
        for (const chk of [band(cf.peakDepth, 0, 1, "peakDepth"), band(cf.spread, 0.01, 1, "spread"), band(cf.strength, 0, 1, "strength")]) if (chk) return scReject(chk);
        if (cf.color != null && !scColor(cf.color)) return scReject("column.chemical.color must be #rrggbb");
      }
      if (col.layers != null) {
        if (!Array.isArray(col.layers) || !col.layers.length) return scReject("column.layers must be a non-empty array");
        let prevDepth = -Infinity;
        for (const L of col.layers) {
          if (!L || typeof L !== "object") return scReject("column layer must be an object");
          const lErr = scOnlyKeys(L, new Set(["depth", "tempC", "salinity", "light", "nutrient"]), "column layer");
          if (lErr) return scReject(lErr);
          if (!Number.isFinite(L.depth) || L.depth < 0 || L.depth <= prevDepth) return scReject("column layer depths must be ascending and >= 0");
          prevDepth = L.depth;
          const band = (v, lo, hi, name) => v == null || (Number.isFinite(v) && v >= lo && v <= hi) ? null : `column layer ${name} out of range`;
          for (const chk of [band(L.tempC, -10, 50, "tempC"), band(L.salinity, 0, 60, "salinity"), band(L.light, 0, 1, "light"), band(L.nutrient, 0, 1, "nutrient")]) if (chk) return scReject(chk);
        }
      }
      column = scClone(col); column.enabled = col.enabled === true;
    }

    return { ok: true, scenario: { meta, cfg, resources, particles, actions, organisms, column } };
  }
  // SCENARIO_VALIDATOR_END

export { validateScenario };
