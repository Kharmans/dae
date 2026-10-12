import { warn, debug, debugEnabled, error } from "../dae.js";
import { expireEffects, getActorEffects, daeMacro, actionQueue, resolveEffectExpiryAction } from "./dae.js";

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
      // Don't expire effects whose concentration origin is still active
      const origin: any = fromUuidSync(effect.origin);
      //@ts-expect-error
      if (origin instanceof ActiveEffect && origin.statuses?.has(CONFIG.specialStatusEffects.CONCENTRATING)) {
        const concentrationDuration = origin.updateDuration();
        const hasRemaining =
          // @ts-expect-error v14 duration.units
          (effect.duration.units === concentrationDuration.units && concentrationDuration.remaining > 0) ||
          // @ts-expect-error v14 duration.units
          (["rounds", "turns"].includes(effect.duration.units) && concentrationDuration.units === "seconds" && concentrationDuration.remaining >= CONFIG.time.roundTime) ||
          // @ts-expect-error v14 duration.units
          (effect.duration.units === "seconds" && ["rounds", "turns"].includes(concentrationDuration.units) && concentrationDuration.remaining >= 1);
        if (!hasRemaining) return; // concentration expired, let concentration removal handle dependents
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
  return duration
    && (duration.value != null && duration.units && duration.units !== "none")
    && (start?.round != null || start?.turn != null || start?.time != null);
}

// ---- Macro Repeat helpers ----
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

      for (let effect of getActorEffects(actor, { includeEnchantments: true })) {
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
async function expireRoundEffectsOnEnd(actor) {
  if (!expireRoundEffectsOnCombatEnd) return;

  const effectsToExpire: { effect: ActiveEffect, reason: string }[] = [];
  const expiringUuids = new Set<string>();
  for (let effect of getActorEffects(actor, { includeEnchantments: true })) {
    const expiry = effect.duration?.expiry;
    const turnExpiries = ["roundStart", "roundEnd", "turnStart", "turnEnd"];
    // A duration in time units outlasts the combat (dnd5e gives these Turn Start in combat). Read the source:
    // with no combat, core prepares round and turn durations as seconds.
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

function migrateDeprecatedSpecialDurations(effectData: any): void {
  const update: Record<string, any> = {};

  // Migrate old special duration flags to expiry events
  const deprecatedSpecialDurMap = getDeprecatedSpecialDurMap();
  let specialDurs: string[] = effectData.flags?.dae?.specialDuration;
  if (specialDurs && Array.isArray(specialDurs)) {
    const deprecated = specialDurs.filter(sd => sd in deprecatedSpecialDurMap);
    if (deprecated.length > 0) {
      // Only one can become duration.expiry; the rest stay on the flag rather than being dropped.
      // duration.expiry defaults to "turnStart" for any numeric duration (core schema), so only an
      // expiry differing from that default counts as authored — see migrateEffectData.
      const defaultExpiry = typeof effectData.duration?.value === "number" ? "turnStart" : null;
      const authoredExpiry = !!effectData.duration?.expiry && effectData.duration.expiry !== defaultExpiry;
      const remaining = [...specialDurs];
      if (!authoredExpiry) {
        const first = deprecated[0];
        update["duration.expiry"] = deprecatedSpecialDurMap[first];
        remaining.splice(remaining.indexOf(first), 1);
        if (debugEnabled > 0) warn("Migrating deprecated special duration on effect creation", effectData.name, first, "→", deprecatedSpecialDurMap[first]);
      }
      if (remaining.length !== specialDurs.length) update["flags.dae.specialDuration"] = remaining;
    }
  }

  if (Object.keys(update).length > 0) effectData.updateSource(update);
}

// ---- Combat End expiry (special duration) ----
export function preDeleteCombatHook(combat: Combat.Implementation, options: Combat.Database.PreDeleteOptions, user: string) {
  if (user !== game.user?.id) return;
  for (let combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;
    /*
     * dnd5e 6 deletes an effect with a combat pseudo-expiry (targetStart and the like) itself as its
     * combatant leaves the combat (Combat5e#_onExit). Expiring it here as well raced that and threw
     * "does not exist" — midi's reaction marker carries both targetStart and combatEnd.
     */
    const systemRemoves = (ef: any) => {
      if (!ef.specialDuration) return false;
      const start = ef.start?.combat;
      return !start || start === combat || start === combat.id || start?.id === combat.id;
    };
    const effects = getActorEffects(actor, { includeEnchantments: true })
      .filter(ef => ef.flags?.dae?.specialDuration?.includes("combatEnd") && !systemRemoves(ef));
    actionQueue.add(expireEffects, actor, effects, { "expiry-reason": "combat-end" });
  }
}

// ---- Join Combat expiry (special duration) ----
export function preCreateCombatantHook(combatant: Combatant.Implementation, data: Combatant.CreateData, options: Combatant.Database.PreCreateOptions, user: string) {
  const actor = combatant.actor;
  if (!actor) return;
  const effects = getActorEffects(actor, { includeEnchantments: true })
    .filter(ef => ef.flags?.dae?.specialDuration?.includes("joinCombat"));
  actionQueue.add(expireEffects, actor, effects, { "expiry-reason": "join-combat" });
}

// ---- Hook registration ----

// @ts-expect-error v14 game.users.activeGM not in fvtt-types yet
function isResponsibleGM(): boolean { return game.users.activeGM?.isSelf; }

export function setupSpecialDurationHooks() {
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

  Hooks.on("preUpdateActiveEffect", (effect, update, options, user) => {
    if (!isTransferEffect(effect)) return true;
    const durationToUse = effect.updateDuration();
    if (update.duration) {
      // @ts-expect-error v14 duration.value
      if (update.duration.value !== undefined) durationToUse.value = update.duration.value;
      // @ts-expect-error v14 duration.units
      if (update.duration.units !== undefined) durationToUse.units = update.duration.units;
    }
    if (!hasExpiry(effect)) return true;
    if (debugEnabled > 1) debug("Update active effect", effect.uuid, update, effect.updateDuration(), isTransferEffect(effect));
    //@ts-expect-error v14 duration.expired not in fvtt-types yet
    const isExpired = effect.duration?.expired || effect.start?.time == null;
    if (!isExpired) return true;
    /*
     * No unexpire branch: re-enabling must not stamp a `start` on a transfer effect.
     *
     * A transfer effect lives on the item, so it is the definition rather than an applied copy. Giving
     * it a start makes it `isExpiryTrackable`, and core then expires it — deleting the definition off
     * the item (dnd5e's `_onUpdate` resolves `this.parent` to the Item, so its combat guard can never
     * hold). dnd5e's model is that a durationed effect is applied from an activity as a non-transfer
     * copy on the actor, which is safe to delete; transfer effects stay passive.
     */
    if (update.disabled ?? effect.disabled === true) {
      if (debugEnabled > 0) warn("expiring effect", effect.uuid, effect.updateDuration(), isTransferEffect(effect));
      foundry.utils.mergeObject(update, getExpireTransferEffectUpdate(effect), { inplace: true });
    }
    if (debugEnabled > 0) warn("update effect", effect.uuid, update, effect.updateDuration(), isTransferEffect(effect));
    return true;
  });

  Hooks.on("deleteCombatant", async (combatant) => {
    if (!isResponsibleGM() || !combatant.actor) return;
    await expireRoundEffectsOnEnd(combatant.actor);
  });

  Hooks.on("deleteCombat", async (combat) => {
    if (!isResponsibleGM()) return;
    for (let combatant of combat.combatants) {
      if (!combatant.actor) continue;
      await expireRoundEffectsOnEnd(combatant.actor);
    }
  });
}
