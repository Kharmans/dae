import { ValidSpec } from "../Systems/DAESystem.js";

/**
 * Phase calibration harness (investigation tool, read-only).
 *
 * Wraps each named step of dnd5e's derived-data pipeline, snapshots the actor's system data
 * either side of every step, and attributes each changed path to the step that wrote it. The
 * result is the "write half" of the dependency graph described in
 * Documents/DAE-Phase-Dependency-Graph-Proposal-2026-09-23.md.
 *
 * Nothing here alters effect application; the wrappers are installed for the duration of one
 * prepareData() call and removed in a finally block.
 */

type StepName = string;

interface StepRecord {
  step: StepName;
  order: number;
  changed: string[];
}

export interface CalibrationResult {
  actor: { name: string; id: string; type: string; effects: number };
  /** Error thrown by the instrumented preparation, if any. */
  prepareError?: string | null;
  stepsRun: StepName[];
  /** path -> every step that wrote it, in execution order */
  writers: Record<string, StepName[]>;
  /** path -> the last step that wrote it */
  lastWriter: Record<string, StepName>;
  /** Paths written by more than one step - candidates for unsatisfiable ordering. */
  multiWriter: Record<string, StepName[]>;
  perStep: StepRecord[];
}

/** Steps as invoked by dnd5e v6 actor data models. Statics live on the two field classes. */
const ATTRIBUTE_STEPS = [
  "prepareBaseArmorClass", "prepareBaseEncumbrance", "prepareExhaustionLevel",
  "prepareSpellcastingAbility", "prepareArmorClass", "prepareConcentration",
  "prepareEncumbrance", "prepareInitiative", "prepareMovement", "prepareHitPoints",
  "preparePrice", "prepareRace"
];
const TRAIT_STEPS = ["prepareLanguages", "prepareResistImmune", "prepareSize"];
const PROTO_STEPS = ["prepareAbilities", "prepareSkills", "prepareTools", "prepareCurrency"];

/**
 * Flatten a data model to path -> comparable scalar. Walks own enumerable properties only,
 * stops at non-plain objects (rendering them via a cheap stable form) and guards cycles, since
 * system data holds Proficiency instances, Sets, and a `parent` back-reference.
 */
const SKIP_KEYS = new Set(["parent", "_source", "schema", "document", "actor", "item", "effect"]);

function snapshot(root: any): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new Set<any>();
  const walk = (value: any, path: string, depth: number) => {
    if (depth > 8) return;
    if (value === null || value === undefined) { out[path] = String(value); return; }
    const t = typeof value;
    if (t === "number" || t === "string" || t === "boolean" || t === "bigint") { out[path] = `${t}:${value}`; return; }
    if (t === "function") return;
    if (value instanceof Set) { out[path] = `set:[${[...value].join(",")}]`; return; }
    if (value instanceof Map) { out[path] = `map:${value.size}`; return; }
    if (Array.isArray(value)) {
      out[`${path}.length`] = `number:${value.length}`;
      value.forEach((v, i) => walk(v, `${path}.${i}`, depth + 1));
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    const proto = Object.getPrototypeOf(value);
    const descend = (proto === Object.prototype) || (proto === null)
      || (value instanceof foundry.abstract.DataModel);
    if (!descend) {
      // Proficiency, Roll, etc - record a value-ish summary rather than descending
      try { out[path] = `obj:${value.valueOf?.() ?? value.toString?.() ?? "?"}`; } catch { out[path] = "obj:?"; }
      return;
    }
    /*
     * Derived accessors are defined during preparation and may throw when read between steps
     * (system.attributes.movement.walk is a non-configurable getter that only resolves once
     * prepareMovement has run). A throw here would abort the instrumented preparation and leave
     * the model half-built, so every read is isolated.
     */
    let keys: string[] = [];
    try { keys = Object.keys(value); } catch { return; }
    for (const key of keys) {
      if (SKIP_KEYS.has(key)) continue;
      let child: any;
      try { child = value[key]; }
      catch (err: any) { out[path ? `${path}.${key}` : key] = `threw:${err?.message ?? "?"}`; continue; }
      walk(child, path ? `${path}.${key}` : key, depth + 1);
    }
  };
  try { walk(root, "", 0); } catch (err) { out["<snapshot-failed>"] = String(err); }
  return out;
}

function diff(before: Record<string, string>, after: Record<string, string>): string[] {
  const changed: string[] = [];
  for (const [k, v] of Object.entries(after)) if (before[k] !== v) changed.push(k);
  for (const k of Object.keys(before)) if (!(k in after)) changed.push(`${k} (removed)`);
  return changed.sort();
}

/** Install a recording wrapper over one function-valued property, returning an undo. */
function instrument(host: any, key: string, stepLabel: StepName, record: (step: StepName, fn: () => void) => void): (() => void) | null {
  const original = host?.[key];
  if (typeof original !== "function") return null;
  host[key] = function (this: any, ...args: any[]) {
    let result: any;
    record(stepLabel, () => { result = original.apply(this, args); });
    return result;
  };
  return () => { host[key] = original; };
}

/**
 * Run one instrumented preparation of `actor` and report which step wrote which path.
 * The actor is not modified: it is reset() afterwards, restoring a clean prepared state.
 */
export function calibrateActor(actor: any): CalibrationResult {
  const dm: any = (globalThis as any).dnd5e?.dataModels?.actor;
  if (!dm) throw new Error("dae | phase calibration requires dnd5e.dataModels.actor");

  const perStep: StepRecord[] = [];
  const undo: Array<() => void> = [];
  let order = 0;
  let active = false;
  let prepareError: string | null = null;

  const record = (step: StepName, run: () => void) => {
    if (!active) { run(); return; }               // only record the target actor's preparation
    const before = snapshot(actor.system);
    run();
    const after = snapshot(actor.system);
    perStep.push({ step, order: order++, changed: diff(before, after) });
  };

  try {
    for (const key of ATTRIBUTE_STEPS) {
      const u = instrument(dm.AttributesFields, key, key, record); if (u) undo.push(u);
    }
    for (const key of TRAIT_STEPS) {
      const u = instrument(dm.TraitsFields, key, key, record); if (u) undo.push(u);
    }
    for (const key of PROTO_STEPS) {
      // Defined on whichever template in the chain declares it; patch every distinct owner once.
      const owners = [dm.CommonTemplate?.prototype, dm.CreatureTemplate?.prototype]
        .filter(p => p && Object.prototype.hasOwnProperty.call(p, key));
      for (const owner of owners) { const u = instrument(owner, key, key, record); if (u) undo.push(u); }
    }
    active = true;
    /*
     * reset(), not prepareData(). dnd5e's MovementField._shim defines the v6->v7 movement
     * compatibility accessors with Object.defineProperty and no `configurable: true`, so a second
     * prepareBaseData() on the same model instance throws "Cannot redefine property: walk".
     * reset() re-initialises the model from source first, which is the only way to drive a clean
     * second preparation of an already-prepared actor.
     */
    try { actor.reset(); }
    catch (e: any) { prepareError = e?.message ?? String(e); }
  } finally {
    active = false;
    for (const u of undo.reverse()) u();
    // Restore the actor to a cleanly prepared state whatever happened above.
    try { actor.reset(); } catch (e) { console.warn("dae | calibration: re-preparation failed", e); }
  }

  const writers: Record<string, StepName[]> = {};
  for (const rec of perStep) {
    for (const path of rec.changed) (writers[path] ??= []).push(rec.step);
  }
  const lastWriter: Record<string, StepName> = {};
  const multiWriter: Record<string, StepName[]> = {};
  for (const [path, steps] of Object.entries(writers)) {
    lastWriter[path] = steps[steps.length - 1];
    if (new Set(steps).size > 1) multiWriter[path] = steps;
  }

  return {
    actor: { name: actor.name, id: actor.id, type: actor.type, effects: [...actor.allApplicableEffects()].length },
    prepareError,
    stepsRun: perStep.map(r => r.step),
    writers, lastWriter, multiWriter, perStep
  };
}

/**
 * Collapse sibling ids (ability/skill/tool keys, array indices) to wildcards so a step's write set
 * is readable: 66 `abilities.<id>.*` paths become a handful of `abilities.*.mod` style rows.
 */
export function collapsePaths(paths: string[]): Record<string, number> {
  const cfg: any = (CONFIG as any).DND5E ?? {};
  const sets: Record<string, Set<string>> = {
    abilities: new Set(Object.keys(cfg.abilities ?? {})),
    skills: new Set(Object.keys(cfg.skills ?? {})),
    tools: new Set(Object.keys(cfg.tools ?? {}))
  };
  const out: Record<string, number> = {};
  for (const path of paths) {
    const parts = path.split(".");
    const globbed = parts.map((seg, i) => {
      if (/^\d+$/.test(seg)) return "#";
      const parent = parts[i - 1];
      if (parent && sets[parent]?.has(seg)) return "*";
      return seg;
    }).join(".");
    out[globbed] = (out[globbed] ?? 0) + 1;
  }
  return out;
}

export interface MisphaseRow {
  key: string;
  specPhase: string;
  writtenBy: StepName[];
  verdict: string;
}

/**
 * Cross-reference the observed write-map against DAE's declared ValidSpec phases.
 *
 * - a spec marked "initial" whose key is written by a derived step is overwritten after we set it
 * - a spec marked "final" is only correct when nothing downstream consumes the value; a key written
 *   before the final step is flagged as a candidate for a mid-pipeline phase
 */
export function misphaseReport(result: CalibrationResult): { rows: MisphaseRow[]; summary: Record<string, number> } {
  const specs = ValidSpec.actorSpecs?.["union"]?.allSpecsObj ?? {};
  const lastStep = result.stepsRun[result.stepsRun.length - 1];
  const rows: MisphaseRow[] = [];
  const summary: Record<string, number> = { specs: 0, derived: 0, overwritten: 0, midPipeline: 0, pureInput: 0 };

  for (const [key, spec] of Object.entries(specs) as [string, any][]) {
    summary.specs++;
    const path = key.startsWith("system.") ? key.slice(7) : null;
    const writtenBy = path ? result.writers[path] : undefined;
    if (!writtenBy) { summary.pureInput++; continue; }
    summary.derived++;
    const phase = spec.phase ?? "initial";
    let verdict = "ok";
    if (phase === "initial") { verdict = "OVERWRITTEN - written by derived data after initial"; summary.overwritten++; }
    else if (phase === "final" && writtenBy[writtenBy.length - 1] !== lastStep) {
      verdict = "candidate for mid-pipeline phase"; summary.midPipeline++;
    }
    if (verdict !== "ok") rows.push({ key, specPhase: phase, writtenBy, verdict });
  }
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return { rows, summary };
}

/**
 * Calibrate one actor per type (or the supplied actors) and return a compact report.
 * Read-only; intended to be called from the console or a macro.
 */
export function calibratePhases(actors?: any[]): any {
  const chosen = actors?.length ? actors : ["character", "npc", "vehicle", "group"]
    .map(t => (game as any).actors?.find((a: any) => a.type === t))
    .filter(a => a);
  const results: Record<string, any> = {};
  for (const actor of chosen) {
    try {
      const result = calibrateActor(actor);
      const report = misphaseReport(result);
      results[actor.type] = {
        actor: result.actor,
        stepsRun: result.stepsRun,
        pathsWritten: Object.keys(result.writers).length,
        multiWriterCount: Object.keys(result.multiWriter).length,
        multiWriter: result.multiWriter,
        lastWriter: result.lastWriter,
        perStepGlobs: Object.fromEntries(result.perStep.map(st => [st.step, collapsePaths(st.changed)])),
        perStepPaths: Object.fromEntries(result.perStep.map(st => [st.step, st.changed])),
        misphase: report
      };
    } catch (err: any) {
      results[actor.type] = { error: err?.message ?? String(err) };
    }
  }
  return results;
}
