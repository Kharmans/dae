import type { AnyObject } from "fvtt-types/utils";
import { hasInlineRoll, resolveInlineRolls } from "./inlineRolls.js";
import { safeGetGameSetting } from "../dae.js";

/**
 * "Also raise current HP": a max HP change marked in `flags.dae.raiseCurrentHp` (by change id, or by key where the
 * system's changes have no id) raises current HP by
 * the same amount when it starts applying, once per effect: disabling and enabling again does not grant again, or
 * unequipping and re-equipping an item would heal. When it stops applying, current HP above the new maximum is lost;
 * damage taken meanwhile stands. The amount granted is kept on the actor in `flags.dae.hpGranted`, cleared when the
 * effect or its item is deleted.
 */
const MAX_HP_KEYS = new Set(["system.attributes.hp.tempmax", "system.attributes.hp.max"]);

export function isMaxHpKey(key: string | undefined): boolean {
  return !!key && MAX_HP_KEYS.has(key);
}

export function raisesCurrentHp(effect: ActiveEffect.Implementation, change: { _id?: string | null, key?: string, type?: string }): boolean {
  if (!change.key || !MAX_HP_KEYS.has(change.key) || change.type !== "add") return false;
  const marked = foundry.utils.getProperty(effect, "flags.dae.raiseCurrentHp");
  return Array.isArray(marked) && (marked.includes(change.key) || (!!change._id && marked.includes(change._id)));
}

/** The key of a change's grant in `flags.dae.hpGranted`: its id, or its key without the dots that would nest it. */
export function grantId(effect: ActiveEffect.Implementation, change: { _id?: string | null, key: string }): string {
  return `${effect.id}${change._id || change.key.replace(/\W/g, "")}`;
}

/** The change's amount on this actor, its inline rolls as rolled; 0 unless it is a positive number without dice. */
function amountOf(actor: Actor.Implementation, effect: ActiveEffect.Implementation, change: { key: string, value: unknown }): number {
  let value = String(change.value ?? "");
  if (hasInlineRoll(value)) value = resolveInlineRolls({ key: change.key, value, effect });
  try {
    const roll = Roll.create(Roll.replaceFormulaData(value, actor.getRollData() as AnyObject, { missing: "0", warn: false }));
    if (!roll.isDeterministic) return 0;
    const total = roll.evaluateSync().total ?? 0;
    return total > 0 ? total : 0;
  } catch {
    return 0;
  }
}

export async function applyCurrentHp(
  action: "on" | "off",
  actor: Actor.Implementation,
  effect: ActiveEffect.Implementation,
  changes: readonly { _id?: string | null, key: string, type?: string, value: unknown }[],
  context: AnyObject = {}
): Promise<void> {
  const marked = changes.filter(change => raisesCurrentHp(effect, change));
  // @ts-expect-error no dnd5e-types
  const hp = actor.system.attributes?.hp;
  if (!marked.length || !hp) return;
  const granted = (foundry.utils.getProperty(actor, "flags.dae.hpGranted") ?? {}) as Record<string, number>;
  const maximum: number = hp.effectiveMax ?? hp.max;
  // dnd5e shows current HP clamped to the maximum but stores it unclamped, so work from the stored value.
  const stored: number = actor._source.system.attributes.hp.value;
  let value = stored;
  const updates: Record<string, unknown> = {};
  const deleted = !!(context.effectDeleted || context.itemDeleted);
  for (const change of marked) {
    const id = grantId(effect, change);
    if (action === "on") {
      if (granted[id] !== undefined) continue;
      const amount = amountOf(actor, effect, change);
      if (!amount) continue;
      // Never lowers current HP: a change on a calculated max HP replaces it, possibly with less.
      value = Math.max(value, Math.min(value + amount, maximum));
      updates[`flags.dae.hpGranted.${id}`] = amount;
    } else if (granted[id] !== undefined) {
      value = Math.min(value, maximum);
      if (deleted) updates[`flags.dae.hpGranted.${id}`] = new foundry.data.operators.ForcedDeletion();
    }
  }
  if (value !== stored) updates["system.attributes.hp.value"] = value;
  if (Object.keys(updates).length) await actor.update(updates);
}

/**
 * dnd5e rolls an unlinked NPC token's hit points in its _preCreate (autoRollNPCHP), setting max and current HP to the
 * roll; the copy of the sidebar actor's grants it inherits no longer holds. Called from preCreateToken, which follows
 * _preCreate, so current HP gets the marked changes on top of the roll before the token is created.
 */
export function grantOnRolledPlacement(token: TokenDocument.Implementation, options: AnyObject): void {
  const actor = token.actor;
  // @ts-expect-error no dnd5e-types
  if (token.actorLink || !actor?.system.isNPC || !actor.system.attributes?.hp?.formula?.trim()) return;
  const autoRoll = foundry.utils.getProperty(options, "dnd5e.autoRollNPCHP") ?? safeGetGameSetting("dnd5e", "autoRollNPCHP");
  if (autoRoll === "no") return;
  const rolled = foundry.utils.getProperty(token._source, "delta.system.attributes.hp.value");
  if (typeof rolled !== "number") return;
  let added = 0;
  const granted: Record<string, number> = {};
  for (const effect of actor.allApplicableEffects()) {
    if (!effect.active) continue;
    // @ts-expect-error v14 effect.system.changes
    for (const change of effect.system.changes ?? []) {
      if (!raisesCurrentHp(effect, change)) continue;
      const amount = amountOf(actor, effect, change);
      if (!amount) continue;
      added += amount;
      granted[grantId(effect, change)] = amount;
    }
  }
  if (!added) return;
  token.updateSource({ delta: { system: { attributes: { hp: { value: rolled + added } } }, flags: { dae: { hpGranted: granted } } } });
}
