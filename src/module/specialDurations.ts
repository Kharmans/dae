import { warn, debug, debugEnabled, error } from "../dae.js";
import { expireEffects, getApplicableEffects, daeMacro, actionQueue, maxShortDuration, safeGetGameSetting, resolveSpecialDurationExpiryAction, resolveEffectExpiryAction } from "./dae.js";

// ---- Duration management settings (populated by fetchDurationParams) ----
export let durationManagementEnabled: boolean = true;
export let enablePassiveEffects: boolean = true;
export let updatePassiveEffects: boolean = true;
export let expireRoundEffectsOnCombatEnd: boolean = false;

export function fetchDurationParams() {
  durationManagementEnabled = game.settings.get("dae", "durationManagementEnabled");
  enablePassiveEffects = game.settings.get("dae", "enablePassiveEffects");
  updatePassiveEffects = game.settings.get("dae", "updatePassiveEffects");
  expireRoundEffectsOnCombatEnd = game.settings.get("dae", "expireRoundEffectsOnCombatEnd");
}

// ---- One-time migration from times-up settings ----
export function migrateTimesUpSettings() {
  // Only migrate if times-up settings exist and we haven't migrated before
  const timesUpEnabled = safeGetGameSetting("times-up", "TimesUpEnabled");
  if (timesUpEnabled === undefined) return; // times-up was never installed

  // Check if we've already migrated
  const migrated = safeGetGameSetting("dae", "timesUpMigrated");
  if (migrated) return;

  try {
    const tuEnabled = safeGetGameSetting("times-up", "TimesUpEnabled");
    if (tuEnabled !== undefined) game.settings.set("dae", "durationManagementEnabled", tuEnabled);

    const tuPassive = safeGetGameSetting("times-up", "EnablePassiveEffects");
    if (tuPassive !== undefined) game.settings.set("dae", "enablePassiveEffects", tuPassive);

    const tuUpdatePassive = safeGetGameSetting("times-up", "UpdatePassiveEffects");
    if (tuUpdatePassive !== undefined) game.settings.set("dae", "updatePassiveEffects", tuUpdatePassive);

    const tuExpireOnEnd = safeGetGameSetting("times-up", "ExpireRoundEffectsOnCombatEnd");
    if (tuExpireOnEnd !== undefined) game.settings.set("dae", "expireRoundEffectsOnCombatEnd", tuExpireOnEnd);

    // Convert MaxRoundsToConvert (rounds) to maxShortDuration (seconds)
    const tuMaxRounds = safeGetGameSetting("times-up", "MaxRoundsToConvert");
    if (tuMaxRounds !== undefined) {
      const seconds = tuMaxRounds * (CONFIG.time?.roundTime ?? 6);
      game.settings.set("dae", "maxShortDuration", seconds);
    }

    // Mark migration complete and re-read the params
    game.settings.set("dae", "timesUpMigrated", true);
    fetchDurationParams();
    console.log("dae | Migrated times-up settings to DAE duration management settings");
  } catch (err) {
    error("Failed to migrate times-up settings", err);
  }
}

// ---- Duration conversion helpers ----

function setDurationRounds(effect, combat, duration?): any {
  duration = duration ?? effect.updateDuration();
  if (duration.units !== "seconds" || (isTransferEffect(effect) && !updatePassiveEffects)) return {};
  if (duration.value > maxShortDuration) return {};
  let update = {};
  let rounds = Math.floor(duration.remaining / CONFIG.time.roundTime);
  update["duration.value"] = rounds > 0 ? rounds : 1;
  update["duration.units"] = rounds > 0 ? "rounds" : "turns";
  update["start.round"] = combat.round;
  update["start.turn"] = combat.turn;
  update["flags.times-up.durationSeconds"] = duration.value;
  if (debugEnabled > 0) warn("set duration rounds", effect.uuid, update, effect.updateDuration());
  return update;
}

function setDurationSeconds(effect): any {
  let update = {};
  let timesUpDurationSeconds = foundry.utils.getProperty(effect, "flags.times-up.durationSeconds");
  if (timesUpDurationSeconds || timesUpDurationSeconds === 0) {
    update = {
      "duration.value": timesUpDurationSeconds,
      "duration.units": "seconds",
      "flags.times-up.durationSeconds": null,
    };
  }
  if (debugEnabled > 0) warn("set duration seconds", effect.uuid, update, effect.updateDuration());
  return update;
}

function getExpireTransferEffectUpdate(effect) {
  const update = setDurationSeconds(effect);
  update["disabled"] = true;
  update["start.time"] = null;
  update["start.round"] = null;
  update["start.turn"] = null;
  update["duration.expired"] = false;
  return update;
}

function noStartSet(effect) {
  const duration = effect.duration;
  const start = effect.start;
  if (duration.units === "seconds" && duration.value != null && start?.time == null) return true;
  if (start?.round == null && start?.turn == null) return true;
  return false;
}

function getUnexpireEffectUpdate(effect, combat, duration?) {
  let effectActor = getEffectActor(effect);
  let isInCombat = combat && combat.combatants.find(c => c.actor === effectActor) !== undefined;
  let update = {};

  if (isTransferEffect(effect) && isEffectExpired(effect) || noStartSet(effect)) {
    update["start.round"] = combat ? combat.round : game.combat?.round;
    update["start.turn"] = combat ? combat.turn : game.combat?.turn;
    update["start.time"] = game.time?.worldTime;
    update["duration.expired"] = false;
  }
  duration = duration ?? effect.updateDuration();
  const durationSeconds = duration.units === "seconds" ? duration.value : null;
  if (isInCombat && (durationSeconds ?? maxShortDuration + 1) <= maxShortDuration) {
    if (!isTransferEffect(effect) || updatePassiveEffects) {
      update = foundry.utils.mergeObject(update, setDurationRounds(effect, combat, duration));
      update["disabled"] = false;
    }
    if (debugEnabled > 0) warn("unexpire effect", effect.uuid, update, effect.updateDuration(), isTransferEffect(effect));
  }
  return update;
}

function getEffectActor(effect) {
  let actor = effect.parent;
  if (effect.parent instanceof Item) actor = actor.parent;
  return actor;
}

async function setEffectsExpiryToRounds(actor, combat) {
  for (let effect of getApplicableEffects(actor, { includeEnchantments: true })) {
    effect.updateDuration();
    if (effect.disabled || effect.duration.units !== "seconds") continue;
    let update = {};
    if (isTransferEffect(effect) && updatePassiveEffects && (effect.duration.value ?? (maxShortDuration + 1)) <= maxShortDuration) {
      if (debugEnabled > 0) warn("update effect setting expiry rounds", effect.uuid, effect.updateDuration(), isTransferEffect(effect));
      update = setDurationRounds(effect, combat);
      if (!foundry.utils.isEmpty(update)) await effect.update(update);
    } else if (!isTransferEffect(effect) && (effect.duration.value ?? (maxShortDuration + 1)) <= maxShortDuration) {
      if (debugEnabled > 0) warn("update effect setting expiry rounds", effect.uuid, effect.updateDuration(), isTransferEffect(effect));
      update = setDurationRounds(effect, combat);
      if (!foundry.utils.isEmpty(update)) await effect.update(update);
    }
  }
  // Set start values for effects with round/turn durations that are missing start.round
  for (let effect of getApplicableEffects(actor, { includeEnchantments: true })) {
    if (effect.disabled) continue;
    if (["rounds", "turns"].includes(effect.duration.units) && effect.start?.round == null) {
      if (debugEnabled > 0) warn("update effect setting start round/turn", effect.uuid, effect.updateDuration());
      await effect.update({
        "start.round": combat.round,
        "start.turn": combat.turn
      });
    }
  }
}

async function setEffectsExpiryToSeconds(actor, combat?) {
  for (let effect of getApplicableEffects(actor, { includeEnchantments: true })) {
    let update = {};
    const duration = effect.updateDuration();
    if (!["rounds", "turns"].includes(duration.units)) continue;
    if (isTransferEffect(effect)) {
      let update = setDurationSeconds(effect);
      if (debugEnabled > 0) warn("update effect setting expiry seconds", effect.uuid, effect.updateDuration(), isTransferEffect(effect));
      if (!foundry.utils.isEmpty(update)) await effect.update(update);
    } else if (!effect.transfer) {
      let seconds = Math.floor(Math.max(Math.floor(effect.duration.remaining), 0) * CONFIG.time.roundTime);
      if (Number.isNaN(seconds) && combat) {
        const effectValue = effect.duration.units === "rounds" ? effect.duration.value : 0;
        seconds = Math.max(Math.floor(((effect.start?.round ?? 0) + effectValue - combat.round) * CONFIG.time.roundTime), 0);
      }
      update = setDurationSeconds(effect);
      update["duration.value"] = seconds;
      update["duration.units"] = "seconds";
      if (seconds <= 0) update["disabled"] = true;
      else {
        update["start.time"] = game.time?.worldTime;
      }
      if (debugEnabled > 0) warn("update effect setting expiry seconds", effect.uuid, effect.updateDuration(), isTransferEffect(effect));
      await effect.update(update);
    }
  }
}

// ---- Exported utility functions ----

/**
 * Expire an effect. Transfer effects are disabled instead of deleted (except applied enchantments).
 */
export async function expireEffect(effect, options = {}) {
  if (!durationManagementEnabled) return;
  if (debugEnabled > 0) warn("Expire effect", effect.uuid, effect);
  if (isTransferEffect(effect)) {
    if (isAppliedEnchantment(effect)) {
      await effect.delete(options);
    } else {
      const update = getExpireTransferEffectUpdate(effect);
      await effect.update(update);
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
      await effect.update({ "duration.expired": true }, options);
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
  let _isTransferEffect = effect.transfer;
  if (CONFIG.ActiveEffect.legacyTransferral) _isTransferEffect = foundry.utils.getProperty(effect, "flags.dae.transfer") || foundry.utils.getProperty(effect, "flags.times-up.isPassive");
  return _isTransferEffect;
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
async function expireRoundEffectsOnEnd(actor) {
  if (!durationManagementEnabled || !expireRoundEffectsOnCombatEnd) return;

  const effectsToExpire: { effect: ActiveEffect, reason: string }[] = [];
  const expiringUuids = new Set<string>();
  for (let effect of getApplicableEffects(actor, { includeEnchantments: true })) {
    const expiry = effect.duration?.expiry;
    if (["roundStart", "roundEnd", "turnStart", "turnEnd"].includes(expiry) && !isTransferEffect(effect)) {
      effectsToExpire.push({ effect, reason: "dae:expired:combat-end-rounds" });
      expiringUuids.add(effect.uuid);
    }
  }

  if (effectsToExpire.length > 0) {
    await expireEffectsSkipDependents(effectsToExpire, expiringUuids, "end combat expired effect");
  }
}

// ---- Migrate deprecated special durations to v14 duration.expiry ----
const deprecatedSpecialDurMap: Record<string, { expiry: string, combatActor: "source" | "target" | null }> = {
  "turnStart": { expiry: "turnStart", combatActor: "target" },
  "turnEnd": { expiry: "turnEnd", combatActor: "target" },
  "turnStartSource": { expiry: "turnStart", combatActor: "source" },
  "turnEndSource": { expiry: "turnEnd", combatActor: "source" },
  "combatEnd": { expiry: "combatEnd", combatActor: null }
};

function migrateDeprecatedSpecialDurations(effectData: any): void {
  let specialDurs: string[] = effectData.flags?.dae?.specialDuration;
  if (!specialDurs || !Array.isArray(specialDurs)) return;
  const deprecated = specialDurs.filter(sd => sd in deprecatedSpecialDurMap);
  if (deprecated.length === 0) return;
  const migration = deprecatedSpecialDurMap[deprecated[0]];
  const remaining = specialDurs.filter(sd => !(sd in deprecatedSpecialDurMap));
  const update: Record<string, any> = {
    "flags.dae.specialDuration": remaining,
    "duration.expiry": migration.expiry
  };
  if (migration.combatActor) {
    update["flags.dae.combatActorOverride"] = migration.combatActor;
  }
  if (debugEnabled > 0) warn("Migrating deprecated special durations on effect creation", effectData.name, deprecated, "→", migration.expiry);
  effectData.updateSource(update);
}

// ---- Combat End expiry (special duration) ----
export function preDeleteCombatHook(combat: Combat.Implementation, options: Combat.Database.PreDeleteOptions, user: string) {
  if (user !== game.user?.id) return;
  for (let combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;
    const effects = getApplicableEffects(actor, { includeEnchantments: true })
      .filter(ef => ef.flags?.dae?.specialDuration?.includes("combatEnd"));
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

// ---- Hook registration ----
export function setupSpecialDurationHooks() {
  // --- Existing DAE hooks ---
  Hooks.on("preDeleteCombat", preDeleteCombatHook);
  Hooks.on("preCreateCombatant", preCreateCombatantHook);

  Hooks.on("preUpdateCombat", (combat, update, options, user) => {
    foundry.utils.setProperty(options, "dae.combat.round", combat.round);
    foundry.utils.setProperty(options, "dae.combat.turn", combat.turn);
    return true;
  });

  Hooks.on("updateCombat", async (combat, update, options, user) => {
    //@ts-expect-error
    if (!game.users.activeGM?.isSelf) return;
    if (update.round === undefined && update.turn === undefined) return;
    if (debugEnabled > 1) debug("updateCombat (macro repeats)", combat, update, options);
    processMacroRepeats(combat, update, options);
  });

  // --- Duration management hooks (formerly times-up) ---

  Hooks.on("preCreateActiveEffect", (effectData, options, user) => {
    try {
      // Migrate deprecated special durations to v14 duration.expiry on effect creation
      migrateDeprecatedSpecialDurations(effectData);

      if (!durationManagementEnabled) return true;

      const parent = effectData.parent;
      if (parent instanceof Item) {
        if (!isAppliedEnchantment(effectData)) return true;
      } else if (!(parent instanceof Actor)) return true;
      const actor = parent instanceof Item ? parent.parent : parent;
      if (!(actor instanceof Actor)) return true;

      const combat = game.combat;
      const inCombat = combat?.started && combat.getCombatantsByActor(actor).length > 0;

      if (inCombat) {
        // Convert short seconds-based durations to rounds
        // @ts-expect-error v14 duration.units/value
        if (effectData.duration?.units === "seconds" && effectData.duration.value != null && effectData.duration.value <= maxShortDuration) {
          // @ts-expect-error v14 duration.value
          const seconds = effectData.duration.value;
          const rounds = Math.floor(seconds / CONFIG.time.roundTime);

          effectData.updateSource({
            "duration.value": rounds > 0 ? rounds : 1,
            "duration.units": rounds > 0 ? "rounds" : "turns",
            "flags.times-up.durationSeconds": seconds
          } as any);
        }
        // Set start values for round/turn effects missing start.round
        // @ts-expect-error v14 duration.units and effect.start
        if (["rounds", "turns"].includes(effectData.duration?.units) && effectData.start?.round == null) {
          if (debugEnabled > 0) warn("preCreateActiveEffect setting start round/turn for round/turn effect", effectData.uuid);
          effectData.updateSource({
            "start.round": combat.round,
            "start.turn": combat.turn
          } as any);
        }
      }

      // Set start.time for seconds-based effects missing it
      // @ts-expect-error v14 duration.units/value and effect.start
      if (effectData.duration?.units === "seconds" && effectData.duration.value != null && effectData.start?.time == null) {
        effectData.updateSource({
          "start.time": game.time?.worldTime
        } as any);
      }
    } catch (err) {
      error("preCreateActiveEffect error", err);
    } finally {
      return true;
    }
  });

  Hooks.on("preUpdateActiveEffect", (effect, update, options, user) => {
    if (!durationManagementEnabled || !enablePassiveEffects || !isTransferEffect(effect)) return true;
    const durationToUse = effect.updateDuration();
    if (update.duration) {
      // @ts-expect-error v14 duration.value
      if (update.duration.value !== undefined) durationToUse.value = update.duration.value;
      // @ts-expect-error v14 duration.units
      if (update.duration.units !== undefined) durationToUse.units = update.duration.units;
    }
    if (hasExpiry(effect)) {
      if (debugEnabled > 1) debug("Update active effect", effect.uuid, update, effect.updateDuration(), isTransferEffect(effect));
      //@ts-expect-error v14 duration.expired not in fvtt-types yet
      const isExpired = effect.duration?.expired || effect.start?.time == null;
      if (!isExpired) return true;
      if (update.disabled === false) {
        if (debugEnabled > 0) warn("resetting duration", effect.uuid, durationToUse, isTransferEffect(effect));
        const unexpireUpdate = getUnexpireEffectUpdate(effect, game.combat, durationToUse);
        update = foundry.utils.mergeObject(update, unexpireUpdate, { inplace: true });
      } else if (update.disabled ?? effect.disabled === true) {
        if (debugEnabled > 0) warn("expiring effect", effect.uuid, effect.updateDuration(), isTransferEffect(effect));
        const expireUpdate = getExpireTransferEffectUpdate(effect);
        update = foundry.utils.mergeObject(update, expireUpdate, { inplace: true });
      }
    }
    if (debugEnabled > 0) warn("update effect", effect.uuid, update, effect.updateDuration(), isTransferEffect(effect));
    return true;
  });

  Hooks.on("combatStart", (combat: Combat, updateData: any) => {
    if (!durationManagementEnabled) return;
    //@ts-expect-error
    if (!game.users.activeGM?.isSelf) return;
    for (let combatant of combat.combatants) {
      if (combatant.actor) setEffectsExpiryToRounds(combatant.actor, combat);
    }
  });

  Hooks.on("createCombatant", (combatant, options, user) => {
    if (!durationManagementEnabled) return;
    //@ts-expect-error
    if (!game.users.activeGM?.isSelf) return;
    if (combatant.actor) setEffectsExpiryToRounds(combatant.actor, combatant.combat);
  });

  Hooks.on("deleteCombatant", async (combatant, options, user) => {
    if (!durationManagementEnabled) return;
    //@ts-expect-error
    if (!game.users.activeGM?.isSelf) return;
    if (!combatant.actor) return;
    await expireRoundEffectsOnEnd(combatant.actor);
    await setEffectsExpiryToSeconds(combatant.actor);
  });

  Hooks.on("deleteCombat", async (combat, options, user) => {
    if (!durationManagementEnabled) return;
    //@ts-expect-error
    if (!game.users.activeGM?.isSelf) return;

    for (let combatant of combat.combatants) {
      if (!combatant.actor) continue;
      await expireRoundEffectsOnEnd(combatant.actor);
      if (combatant.actor) setEffectsExpiryToSeconds(combatant.actor, combat);
    }
  });
}
