import { warn, debug, debugEnabled, error, daeManagesTurnExpiry, PSEUDO_EXPIRIES } from "../dae.js";
import { expireEffects, getApplicableEffects, daeMacro, actionQueue, resolveSpecialDurationExpiryAction, resolveEffectExpiryAction } from "./dae.js";

export let expireRoundEffectsOnCombatEnd: boolean = false;

export function fetchDurationParams() {
  expireRoundEffectsOnCombatEnd = game.settings.get("dae", "expireRoundEffectsOnCombatEnd");
}

// ---- Duration helpers ----

function getExpireTransferEffectUpdate(effect) {
  return {
    "disabled": true,
    "start.time": null,
    "start.round": null,
    "start.turn": null,
    "duration.expired": false
  };
}

// ---- Exported utility functions ----

/**
 * Expire an effect. Transfer effects are disabled instead of deleted (except applied enchantments).
 */
export async function expireEffect(effect, options = {}) {
  if (debugEnabled > 0) warn("Expire effect", effect.uuid, effect);
  if (isTransferEffect(effect)) {
    if (isAppliedEnchantment(effect)) {
      await effect.delete(options);
    } else {
      const update = getExpireTransferEffectUpdate(effect);
      await effect.update(update, options);
    }
  } else {
    if (game.system?.id === "dnd5e") {
      // An effect whose concentration has ended is left to the concentration's removal
      const origin: any = fromUuidSync(effect.origin);
      //@ts-expect-error
      if (origin instanceof ActiveEffect && origin.statuses?.has(CONFIG.specialStatusEffects.CONCENTRATING)) {
        const concentrationDuration = origin.updateDuration();
        // concentration expired: let its removal handle dependents
        // @ts-expect-error v14 duration.secondsRemaining
        if (!((concentrationDuration.secondsRemaining ?? concentrationDuration.remaining) > 0)) return;
      }
    }
    // Respect per-effect expiry mode, falling back to global setting
    if (resolveEffectExpiryAction(effect) === "delete") {
      await effect.delete(options);
    } else {
      /*
       * "Suppress": keep the effect but stop it applying, by disabling it.
       *
       * Not `duration.expired`. dnd5e deletes any effect carrying that flag once the actor has no
       * combatant (ActiveEffect5e._onUpdate), and it does so regardless of
       * CONFIG.ActiveEffect.expiryAction — measured under "update", "delete" and null alike. Using
       * the flag to mean "keep" therefore deletes the very effect the caller asked to keep.
       * `disabled` says the same thing, is what the transfer-effect path above already uses, and is
       * a field the system does not act on.
       */
      await effect.update({ "disabled": true, "duration.expired": false }, options);
    }
  }
}

/**
 * Check if an effect is expired, using v14's native duration calculations.
 */
export function isEffectExpired(effect: any /* ActiveEffect */): boolean {
  if (effect.duration?.expired) return true;
  if (!effect.isTemporary) return false;
  const duration = effect.updateDuration();
  return duration.remaining <= 0 && Number.isFinite(duration.remaining);
}

export function isTransferEffect(effect): boolean {
  return effect.transfer;
}

/**
 * Check if an effect is an applied enchantment (dnd5e specific).
 */
export function isAppliedEnchantment(effect): boolean {
  return effect.isAppliedEnchantment ?? false;
}

/**
 * Check if there's a circular dependency between effects.
 */
function hasCircularDependency(startUuid: string, expiringUuids: Set<string>, maxDepth: number = 10): boolean {
  const visited = new Set<string>();

  function checkDependencyChain(currentUuid: string, depth: number): boolean {
    if (depth > maxDepth) return false;
    if (visited.has(currentUuid)) return false;
    visited.add(currentUuid);

    const effect = fromUuidSync(currentUuid) as ActiveEffect | null;
    if (!effect) return false;

    const dependentOn = foundry.utils.getProperty(effect, "flags.dnd5e.dependentOn") as string | undefined;
    if (!dependentOn) return false;

    if (dependentOn === startUuid) return true;

    if (expiringUuids.has(dependentOn)) {
      return checkDependencyChain(dependentOn, depth + 1);
    }

    return false;
  }

  const startEffect = fromUuidSync(startUuid) as ActiveEffect | null;
  if (!startEffect) return false;

  const startDependentOn = foundry.utils.getProperty(startEffect, "flags.dnd5e.dependentOn") as string | undefined;
  if (!startDependentOn || !expiringUuids.has(startDependentOn)) return false;

  return checkDependencyChain(startDependentOn, 0);
}

/**
 * Expire a list of effects, handling dependent effects that should be skipped.
 */
async function expireEffectsSkipDependents(
  effectsToExpire: Array<{ effect: ActiveEffect, reason: string }>,
  expiringUuids: Set<string>,
  logPrefix: string
): Promise<void> {
  const deletionInitiated = new Set<string>();

  for (let { effect, reason } of effectsToExpire) {
    if (deletionInitiated.has(effect.uuid)) {
      if (debugEnabled > 0) warn("deletion already initiated, skipping", effect.name, effect.uuid);
      continue;
    }

    const parentEffects = effect.parent?.effects;
    if (parentEffects && effect.id && !parentEffects.has(effect.id)) {
      if (debugEnabled > 0) warn("effect already deleted, skipping", effect.name, effect.uuid);
      continue;
    }

    const dependentOn = foundry.utils.getProperty(effect, "flags.dnd5e.dependentOn") as string | undefined;
    if (dependentOn && expiringUuids.has(dependentOn)) {
      if (hasCircularDependency(effect.uuid, expiringUuids)) {
        warn("circular dependency detected, deleting to break cycle", effect.name, effect.uuid, "dependentOn:", dependentOn);
        deletionInitiated.add(dependentOn);
      } else {
        if (debugEnabled > 0) warn("skipping dependent effect (dependentOn also expiring)", effect.name, effect.uuid, "dependentOn:", dependentOn);
        continue;
      }
    }

    if (debugEnabled > 0) warn(logPrefix, effect.name, effect.updateDuration(), isTransferEffect(effect), reason);
    deletionInitiated.add(effect.uuid);
    await expireEffect(effect, { "expiry-reason": reason });
  }
}

export function hasDuration(effect) {
  return hasExpiry(effect);
}

export function hasExpiry(effect) {
  const duration = effect?.duration ?? effect;
  const start = effect?.start;
  return !!duration
    && (Number.isFinite(duration.value) || !!duration.expiry)
    && (start?.round != null || start?.turn != null || start?.time != null);
}

// ---- Macro Repeat helpers ----
export function hasMacroRepeat(effectData): boolean {
  return ["startEveryTurn", "endEveryTurn", "startEndEveryTurn",
    "startEveryTurnAny", "endEveryTurnAny", "startEndEveryTurnAny"]
    .includes(effectData.flags?.dae?.macroRepeat);
}

export function getMacroRepeat(effectData): string {
  return effectData.flags?.dae?.macroRepeat;
}

// ---- Macro Repeat processing on turn change ----
export function processMacroRepeats(combat, update, options) {
  const totalTurns = combat.combatants?.contents.length ?? 0;
  let combatantIndex = 0;
  for (let combatant of combat.turns) {
    if (combatant.actor) {
      let actor = combatant.actor;
      const checkTurn = (update.round ?? combat.round) * totalTurns + (update.turn ?? combat.turn ?? 0);
      let lastCheckedTurn = (foundry.utils.getProperty(options, "dae.combat.round") ?? combat.round) * totalTurns
        + (foundry.utils.getProperty(options, "dae.combat.turn") ?? combat.turn);
      const advanced1Turn = lastCheckedTurn + 1 === checkTurn;
      let combatantNextTurn = (update.round ?? combat.round) * totalTurns + combatantIndex;
      if (combatantNextTurn < checkTurn) combatantNextTurn += totalTurns;
      let combatantLastTurn = (foundry.utils.getProperty(options, "dae.combat.round") ?? combat.round) * totalTurns + combatantIndex;

      for (let effect of getApplicableEffects(actor, { includeEnchantments: true })) {
        const macroRepeat = getMacroRepeat(effect);
        switch (macroRepeat) {
          case "startEveryTurn":
          case "startEveryTurnAny":
          case "startEndEveryTurn":
          case "startEndEveryTurnAny":
            if ((checkTurn >= combatantLastTurn && lastCheckedTurn < combatantLastTurn) || checkTurn === combatantNextTurn) {
              if (!(["startEveryTurn", "startEndEveryTurn"].includes(macroRepeat)) || (!effect.disabled && !effect.isSuppressed))
                daeMacro("each", actor, effect, { actor, effectId: effect.id, tokenId: combatant.token?.id, actorUuid: actor.uuid, actorID: actor.id, efData: effect.toObject(), turn: "startTurn" });
            }
            if (["startEveryTurn", "startEveryTurnAny"].includes(macroRepeat)) break;
          case "endEveryTurn":
          case "endEveryTurnAny":
            if ((advanced1Turn && combatantLastTurn + 1 === checkTurn)
              || (!advanced1Turn && combatantLastTurn < checkTurn && combatantLastTurn >= lastCheckedTurn)) {
              if (["endEveryTurn", "startEndEveryTurn"].includes(macroRepeat) && (effect.disabled || effect.isSuppressed)) break;
              daeMacro("each", actor, effect, { actor, effectId: effect.id, tokenId: combatant.token?.id, actorUuid: actor.uuid, actorID: actor.id, efData: effect.toObject(), turn: "endTurn" });
            }
            break;
        }
      }
    }
    combatantIndex += 1;
  }
}

// ---- Expire round effects when combat ends ----
async function expireRoundEffectsOnEnd(actor, combat) {
  if (!expireRoundEffectsOnCombatEnd) return;

  const effectsToExpire: { effect: ActiveEffect, reason: string }[] = [];
  const expiringUuids = new Set<string>();
  for (let effect of getApplicableEffects(actor, { includeEnchantments: true })) {
    // an expired effect is deleted as its combatant leaves (_onExit); an effect started in another combat stays
    if (effect.duration?.expired) continue;
    const started = effect.start?.combat;
    if (started && (started.id ?? started) !== combat.id) continue;
    const expiry = effect.duration?.expiry;
    // Source/target expiries are removed as their combatant leaves the combat (removeCombatOnlyEffects, or dnd5e 6).
    const turnExpiries = ["roundStart", "roundEnd", "turnStart", "turnEnd"];
    // A duration in time units outlasts the combat. Read the source: with no combat, core prepares round and
    // turn durations as seconds.
    const { units, value } = effect._source.duration ?? {};
    // @ts-expect-error v14 CONST.ACTIVE_EFFECT_TIME_DURATION_UNITS not in fvtt-types yet
    const timed = CONST.ACTIVE_EFFECT_TIME_DURATION_UNITS.includes(units) && Number.isFinite(value);
    if (turnExpiries.includes(expiry) && !timed && !isTransferEffect(effect)) {
      effectsToExpire.push({ effect, reason: "dae:expired:combat-end-rounds" });
      expiringUuids.add(effect.uuid);
    }
  }

  if (effectsToExpire.length > 0) {
    await expireEffectsSkipDependents(effectsToExpire, expiringUuids, "end combat expired effect");
  }
}

// ---- Migrate deprecated special durations to v14 duration.expiry ----
// Both DAE (dnd5e < 6.0, which registers these events and converts them to core turnStart/turnEnd +
// start.combatant itself) and dnd5e 6.0+ (native PSEUDO_EXPIRIES sourceStart/sourceEnd/targetStart/
// targetEnd) understand the same expiry names, so one map serves both. Previously the 6.0+ branch
// mapped source/target → plain turnStart/turnEnd, silently dropping the source/target distinction now
// that dnd5e 6.0 handles these values natively (confirmed in PR #6837).
export function getDeprecatedSpecialDurMap(): Record<string, string> {
  return {
    "turnStart": "targetStart",
    "turnEnd": "targetEnd",
    "turnStartSource": "sourceStart",
    "turnEndSource": "sourceEnd",
    "combatEnd": "combatEnd"
  };
}

/**
 * The expiry event deprecated special durations become, and what stays on the flag. Only one can take
 * duration.expiry. An authored expiry is kept (core's schema gives any numeric duration "turnStart", so only an expiry
 * differing from that counts), and entries it already holds are dropped. combatEnd yields the slot, as it still works
 * as a special duration and source/target entries left on the flag do nothing; on an effect with a duration it never
 * takes it (as its expiry event the effect would end only at the first combat end after the duration).
 * `duration` is source data.
 */
export function migratedSpecialDurations(duration: { value?: number | null, expiry?: string | null } | undefined, specialDurs: string[]): { expiry: string, remaining: string[] } | null {
  const map = getDeprecatedSpecialDurMap();
  const hasValue = typeof duration?.value === "number";
  const authored: string | null = duration?.expiry && duration.expiry !== (hasValue ? "turnStart" : null) ? duration.expiry : null;
  // (combatEnd on an effect with a duration is not the same as that expiry: it stays)
  let remaining = specialDurs.filter(sd => !(authored && map[sd] === authored && !(hasValue && sd === "combatEnd")));
  let expiry = authored;
  if (!authored) {
    const first = remaining.find(sd => sd in map && sd !== "combatEnd") ?? (hasValue ? undefined : remaining.find(sd => sd === "combatEnd"));
    if (first) {
      expiry = map[first];
      remaining = remaining.filter(sd => sd !== first);
    }
  }
  if (!expiry || (expiry === authored && remaining.length === specialDurs.length)) return null;
  return { expiry, remaining };
}

function migrateDeprecatedSpecialDurations(effectData: any): void {
  const specialDurs = effectData.flags?.dae?.specialDuration;
  if (!Array.isArray(specialDurs)) return;
  // the pending document is prepared: an unset duration reads Infinity
  const migrated = migratedSpecialDurations(effectData._source?.duration ?? effectData.duration, specialDurs);
  if (!migrated) return;
  if (debugEnabled > 0) warn("Migrating deprecated special duration on effect creation", effectData.name, "→", migrated.expiry);
  effectData.updateSource({ "duration.expiry": migrated.expiry, "flags.dae.specialDuration": migrated.remaining });
}

// ---- Combat End expiry (special duration) ----
export function preDeleteCombatHook(combat: Combat.Implementation, options: Combat.Database.PreDeleteOptions, user: string) {
  if (user !== game.user?.id) return;
  for (let combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;
    // Source/target expiries from this combat are removed as their combatant leaves it; expiring them here too
    // raced that and threw "does not exist" (midi's reaction marker carries both targetStart and combatEnd).
    const effects = getApplicableEffects(actor, { includeEnchantments: true })
      .filter(ef => ef.flags?.dae?.specialDuration?.includes("combatEnd") && !ef.duration?.expired && !isCombatOnlyEffect(ef, combat));
    actionQueue.add(expireEffects, actor, effects, { "expiry-reason": "combat-end" });
  }
}

// ---- Join Combat expiry (special duration) ----
export function preCreateCombatantHook(combatant: Combatant.Implementation, data: Combatant.CreateData, options: Combatant.Database.PreCreateOptions, user: string) {
  const actor = combatant.actor;
  if (!actor) return;
  const effects = getApplicableEffects(actor, { includeEnchantments: true })
    .filter(ef => ef.flags?.dae?.specialDuration?.includes("joinCombat"));
  actionQueue.add(expireEffects, actor, effects, { "expiry-reason": "join-combat" });
}

// ---- dnd5e 6 behaviour on dnd5e 5.x ----

/** A source/target expiry belonging to `combat` (or to none), which ends when its combatant leaves it. */
function isCombatOnlyEffect(effect, combat: Combat.Implementation): boolean {
  if (!PSEUDO_EXPIRIES.has(effect.duration?.expiry)) return false;
  const start = effect.start?.combat;
  return !start || start === combat || start === combat.id || start?.id === combat.id;
}

/**
 * Deleted with the effect it depends on (dnd5e's dependents registry), as dnd5e 6 assumes of any dependent. An
 * applied effect also depends on its activity when not concentrating (applyActiveEffects), which nothing deletes.
 */
function dependsOnEffect(effect): boolean {
  const parent = fromUuidSync(effect.getFlag("dnd5e", "dependentOn") ?? "", { strict: false });
  return parent instanceof ActiveEffect;
}

/**
 * As dnd5e 6's Combat5e#_onExit: a combatant leaving the combat (or the combat ending) loses its expired effects
 * and its source/target expiry effects from that combat. Dependents go with their parent; item effects only if
 * applied enchantments.
 */
export async function removeCombatOnlyEffects(combat: Combat.Implementation, combatant: Combatant.Implementation) {
  const actor = combatant.actor;
  if (!actor) return;
  const remove = ef => !dependsOnEffect(ef) && (ef.duration?.expired || isCombatOnlyEffect(ef, combat));
  const idsOf = effects => effects.map(ef => ef.id).filter((id): id is string => !!id);
  const ids = idsOf(actor.effects.filter(remove));
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  for (const item of actor.items) {
    const itemIds = idsOf(item.effects.filter(ef => remove(ef) && isAppliedEnchantment(ef)));
    if (itemIds.length) await item.deleteEmbeddedDocuments("ActiveEffect", itemIds);
  }
}

/**
 * As dnd5e 6's ActiveEffect5e#_onUpdate: an effect marked expired (Mark Expired) is deleted at once unless its
 * actor is in the combat it expired in; removeCombatOnlyEffects deletes the rest as the combatant leaves.
 * Unlike dnd5e, an item's own (non-enchantment) effect is never deleted.
 */
function deleteExpiredOutOfCombat(effect, changed) {
  // @ts-expect-error v14 game.users.activeGM not in fvtt-types yet
  if (!game.users.activeGM?.isSelf || !foundry.utils.getProperty(changed, "duration.expired")) return;
  if (dependsOnEffect(effect)) return;
  const enchantment = isAppliedEnchantment(effect);
  if (effect.parent instanceof Item && !enchantment) return;
  const actor = enchantment ? effect.parent?.parent : effect.parent;
  // its own combat, if that is gone the actor is out of it
  const combat = effect._source.start?.combat ? effect.start?.combat : game.combat;
  if (!combat?.getCombatantsByActor(actor).length) effect.delete();
}

/**
 * As dnd5e 6's ActiveEffect5e#_preCreate: an effect created in a running combat with a duration in rounds or
 * time units and no expiry event ends at a turn start (of whoever is acting), not as the round turns over.
 */
export function defaultInCombatExpiry(effect) {
  const { expiry, units, value } = effect._source.duration ?? {};
  if (expiry || !Number.isFinite(value) || units === "turns") return;
  const actor = effect.isAppliedEnchantment ? effect.parent?.parent : effect.parent;
  if (!(actor instanceof Actor) || !effect.start?.combat?.started) return;
  effect.updateSource({ "duration.expiry": "turnStart" });
}

// ---- Hook registration ----

// @ts-expect-error v14 game.users.activeGM not in fvtt-types yet
function isResponsibleGM(): boolean { return game.users.activeGM?.isSelf; }

export function setupSpecialDurationHooks() {
  if (daeManagesTurnExpiry) Hooks.on("updateActiveEffect", deleteExpiredOutOfCombat);
  Hooks.on("preDeleteCombat", preDeleteCombatHook);
  Hooks.on("preCreateCombatant", preCreateCombatantHook);

  Hooks.on("preUpdateCombat", (combat, update, options, user) => {
    foundry.utils.setProperty(options, "dae.combat.round", combat.round);
    foundry.utils.setProperty(options, "dae.combat.turn", combat.turn);
    return true;
  });

  Hooks.on("updateCombat", async (combat, update, options, user) => {
    // @ts-expect-error v14 game.users.activeGM not in fvtt-types yet
    if (!game.users.activeGM?.isSelf) return;
    if (update.round === undefined && update.turn === undefined) return;
    if (debugEnabled > 1) debug("updateCombat (macro repeats)", combat, update, options);
    processMacroRepeats(combat, update, options);
  });

  // --- Duration management hooks (formerly times-up) ---

  Hooks.on("preCreateActiveEffect", (effectData, options, user) => {
    try {
      migrateDeprecatedSpecialDurations(effectData);
    } catch (err) {
      error("preCreateActiveEffect error", err);
    } finally {
      return true;
    }
  });

  Hooks.on("deleteCombatant", async (combatant) => {
    if (!isResponsibleGM() || !combatant.actor) return;
    await expireRoundEffectsOnEnd(combatant.actor, combatant.combat);
  });

  Hooks.on("deleteCombat", async (combat) => {
    if (!isResponsibleGM()) return;
    for (let combatant of combat.combatants) {
      if (!combatant.actor) continue;
      await expireRoundEffectsOnEnd(combatant.actor, combat);
    }
  });
}
