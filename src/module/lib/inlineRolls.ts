import type { AnyMutableObject, AnyObject } from "fvtt-types/utils";
import { ValidSpec } from "../Systems/DAESystem.js";
import { cannotRollDice, wrapBareDice } from "./diceValues.js";

/**
 * Inline rolls in change values: `[[expr]]` is rolled once and posted to chat, `[[[expr]]]` is rolled without
 * posting. `[[/command ...]]` is not a roll and is left alone.
 *
 * An effect created on an actor has the totals written into its values. A transfer effect keeps its formulas:
 * the totals go in `flags.dae.inlineRolls` and are substituted when the actor is prepared, so the item rolls
 * afresh on each actor it lands on.
 */
const INLINE_RE = /[\[]{2,3}(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;

export interface InlineRollRecord { key: string; value: string; totals: number[] }

export function hasInlineRoll(value: unknown): value is string {
  return typeof value === "string" && value.includes("[[") && [...value.matchAll(INLINE_RE)].some(m => !m[1]);
}

/**
 * A change value made ready to roll when its effect reaches an actor: `dae.roll(expr)`, and bare dice in a field
 * worked out without dice when the actor is prepared (see cannotRollDice), become silent inline rolls.
 */
export function convertChangeValue(change: { key?: string, type?: string, value?: unknown }, where: string): unknown {
  const value = convertDaeRoll(change.value, where);
  if (typeof value !== "string" || change.type === "custom" || !change.key) return value;
  return cannotRollDice(ValidSpec.actorSpecs?.union?.allSpecsObj?.[change.key]?.fieldType) ? wrapBareDice(value).value : value;
}

/** Deprecated `dae.roll(expr)` becomes a silent inline roll, `[[[expr]]]`. */
export function convertDaeRoll(value: unknown, where: string): unknown {
  if (typeof value !== "string" || !value.includes("dae.roll(")) return value;
  let out = "", from = 0;
  for (let start = value.indexOf("dae.roll("); start >= 0; start = value.indexOf("dae.roll(", from)) {
    let depth = 0, end = start + "dae.roll".length;
    for (; end < value.length; end++) {
      if (value[end] === "(") depth++;
      else if (value[end] === ")" && --depth === 0) break;
    }
    if (end >= value.length) break;
    out += `${value.slice(from, start)}[[[${value.slice(start + "dae.roll(".length, end)}]]]`;
    from = end + 1;
  }
  out += value.slice(from);
  foundry.utils.logCompatibilityWarning(`dae | dae.roll(...) is deprecated, use [[...]] or [[[...]]] to roll without a chat message (${where})`,
    { once: true, stack: false });
  return out;
}

async function rollOne(expression: string, actor: Actor.Implementation, effectName: string, silent: boolean): Promise<number> {
  try {
    expression = expression.replaceAll("@data.", "@");
    const roll = await new Roll(expression, actor?.getRollData() as AnyObject).evaluate();
    if (!silent) await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${effectName} ${expression}` });
    return roll.total ?? 0;
  } catch (err) {
    console.warn(`dae | inline roll ${expression} on ${effectName} failed`, err);
    return 0;
  }
}

async function rollTotals(value: string, actor: Actor.Implementation, effectName: string): Promise<number[]> {
  const totals: number[] = [];
  for (const match of value.matchAll(INLINE_RE)) {
    if (!match[1]) totals.push(await rollOne(match[2], actor, effectName, match[0].startsWith("[[[")));
  }
  return totals;
}

export function substituteInline(value: string, totals: number[]): string {
  let index = 0;
  return value.replace(INLINE_RE, (whole, command) => command ? whole : String(totals[index++] ?? 0));
}

/** Roll a value's inline rolls and write the totals in. */
export async function rollInline(value: string, actor: Actor.Implementation, effectName: string): Promise<string> {
  return substituteInline(value, await rollTotals(value, actor, effectName));
}

/**
 * Roll a transfer effect's inline rolls into `flags.dae.inlineRolls` (on source data, in place). With `keep`, a
 * stored total whose change is unchanged is reused. Returns whether the data changed.
 */
export async function rollEffectSource(effect: AnyMutableObject, actor: Actor.Implementation, keep: boolean): Promise<boolean> {
  const changes: AnyMutableObject[] = (effect.system as AnyMutableObject)?.changes as AnyMutableObject[] ?? [];
  let changed = false;
  for (const change of changes) {
    const value = convertChangeValue(change, `${effect.name}`);
    if (value !== change.value) { change.value = value; changed = true; }
  }
  const previous: InlineRollRecord[] = foundry.utils.getProperty(effect, "flags.dae.inlineRolls") as InlineRollRecord[] ?? [];
  const records: InlineRollRecord[] = [];
  for (const change of changes) {
    if (!hasInlineRoll(change.value)) continue;
    const key = change.key as string;
    const stored = keep ? previous.find(r => r.key === key && r.value === change.value && !records.includes(r)) : undefined;
    records.push(stored ?? { key, value: change.value, totals: await rollTotals(change.value, actor, `${effect.name}`) });
  }
  if (!records.length && !previous.length) return changed;
  foundry.utils.setProperty(effect, "flags.dae.inlineRolls", records);
  return true;
}

/** Roll the transfer effects of an item being created on (or with) an actor. */
export async function rollItemSource(item: Item.Implementation, actor: Actor.Implementation, keep: boolean): Promise<AnyMutableObject[] | undefined> {
  const effects = foundry.utils.deepClone((item._source as AnyMutableObject).effects as AnyMutableObject[] ?? []);
  let changed = false;
  for (const effect of effects) {
    if (effect.transfer && await rollEffectSource(effect, actor, keep)) changed = true;
  }
  return changed ? effects : undefined;
}

const warnedMissing = new Set<string>();

/** A transfer effect's change value with its stored totals in place of its inline rolls; 0 for a missing one. */
export function resolveInlineRolls(change: { key: string, value: string, effect?: ActiveEffect.Implementation }): string {
  const records = change.effect?.flags?.dae?.inlineRolls as InlineRollRecord[] | undefined;
  const record = records?.find(r => r.key === change.key && r.value === change.value);
  if (!record) {
    const id = `${change.effect?.uuid}|${change.key}|${change.value}`;
    if (!warnedMissing.has(id)) {
      warnedMissing.add(id);
      console.warn(`dae | ${change.effect?.name} (${change.effect?.uuid}) ${change.key} "${change.value}" has not been rolled - using 0`);
    }
  }
  return substituteInline(change.value, record?.totals ?? []);
}
