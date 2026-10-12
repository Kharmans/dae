import { MODULE_ID, PSEUDO_EXPIRIES, daeManagesTurnExpiry } from "../dae.js";
import { actorFromUuid } from "./dae.js";
import { removeCombatOnlyEffects } from "./specialDurations.js";

/**
 * Port of dnd5e 6.0 ActiveEffect5e#isExpiryEvent for the source/target pseudo-expiries.
 * Used only for dnd5e < 6.0; 6.0+ implements these natively.
 */
function pseudoExpiryEvent(this: ActiveEffect, special: string, event: string, context: any): boolean {
  // Mirrors ActiveEffect#actor, which fvtt-types does not expose
  const effectActor = !this.isEmbedded ? null
    : this.parent instanceof Actor ? this.parent
      : this.parent instanceof Item ? this.parent.parent
        : null;

  // Out of combat, any time advancement expires the effect
  if ((event === "updateWorldTime") && !effectActor?.inCombat) return true;

  const isStart = special.endsWith("Start");
  if (event !== (isStart ? "turnStart" : "turnEnd")) return false;

  // @ts-expect-error v14 start schema not in fvtt-types yet
  const start = this.start;
  if (!start?.combat) return true;
  const combat = context?.combat ?? game.combat;
  if (combat !== start.combat) return false;

  // Affected actor for "target", originating actor for "source"; re-derived, not stored
  const origin = special.startsWith("target")
    ? effectActor
    : (this.origin ? actorFromUuid(this.origin) : null);
  const [combatant] = combat.getCombatantsByActor(origin ?? "");
  if (!combatant) return start.round < context?.round;

  const originTurn = isStart
    ? (combat.combatant === combatant)
    : (combat.previous.combatantId === combatant.id);
  if (!originTurn) return false;

  // Skip the turn the effect was applied on
  return (start.round !== context?.round) || (start.turn !== context?.turn);
}

/**
 * Register lib-wrapper patches for ActiveEffect prototype methods.
 * Called during init after custom expiry events are registered.
 */
export function registerActiveEffectPatches(): void {
  const libWrapper = globalThis.libWrapper;

  // Patch isExpiryEvent:
  // 1. source/target pseudo-expiries: evaluated as dnd5e 6.0 does (pre-6.0 only)
  // 2. "updateWorldTime" expiry: expire whenever duration runs out, regardless of event
  // 3. Turn Start/End whose combatant has left the combat: core waits for that combatant's turn, which
  //    never comes, so expire at any turn edge after the creation round, as dnd5e does for source/target.
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype.isExpiryEvent",
    function isExpiryEventWrapper(this: ActiveEffect, wrapped: Function, event: string, context: any) {
      // @ts-expect-error v14 duration.expiry not in fvtt-types yet
      const expiry: string | undefined = this.duration.expiry;
      if (daeManagesTurnExpiry && expiry && PSEUDO_EXPIRIES.has(expiry)) {
        return pseudoExpiryEvent.call(this, expiry, event, context);
      }
      if (expiry === "updateWorldTime") return true;
      if ((expiry === "turnStart" || expiry === "turnEnd") && event === expiry) {
        // @ts-expect-error v14 start schema not in fvtt-types yet
        const start = this.start;
        const combat = context?.combat ?? game.combat;
        if (combat?.started && start?.combat && combat === start.combat && !combat.combatants.get(start.combatant))
          return start.round < (context?.round ?? combat.round);
      }
      return wrapped(event, context);
    }, "MIXED");

  // dnd5e 6 removes a combatant's source/target expiry effects as it leaves the combat (Combat5e#_onExit);
  // dnd5e 5.x does not override _onExit, so DAE does the same where it manages those expiries.
  if (daeManagesTurnExpiry) {
    libWrapper.register(MODULE_ID, "CONFIG.Combat.documentClass.prototype._onExit",
      async function onExitWrapper(this: Combat.Implementation, wrapped: Function, combatant: Combatant.Implementation) {
        await wrapped(combatant);
        await removeCombatOnlyEffects(this, combatant);
      }, "WRAPPER");
  }

  // Patch _prepareDuration for one case only: "updateWorldTime" + a turn-based duration. Core's
  // formula counts turns relative to the start combatant's position (only turns at or after
  // startTurn in each round), which is right for turnStart/turnEnd expiry but wrong for "time
  // elapsed", where every turn should count.
  //
  // The event-only case this used to handle as well (no duration value, expiry set) is now handled
  // upstream: dnd5e/core prepare such an effect with value, remaining and seconds all Infinity, which
  // is exactly what the old early-return synthesised — and returning early skipped dnd5e's own
  // _prepareDuration, losing its expiry labels.
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype._prepareDuration",
    function prepareDurationWrapper(this: ActiveEffect, wrapped: Function, duration: any, context: any) {
      duration ??= this.duration;
      const result = wrapped(duration, context);

      // Fix "updateWorldTime" + turn-based duration: override remaining with total-turns-elapsed
      if ((duration.expiry === "updateWorldTime" || (this._source?.duration as any)?.expiry === "updateWorldTime")
        && duration.units === "turns" && Number.isFinite(duration.value)) {
        // @ts-expect-error v14 start schema not in fvtt-types yet
        const combat = game.combats?.get(this.start?.combat?.id) ?? game.combat;
        if (combat?.started && combat.turns.length) {
          // @ts-expect-error v14 start schema not in fvtt-types yet
          const startRound = this.start?.round ?? combat.round;
          // @ts-expect-error v14 start schema not in fvtt-types yet
          const startTurn = this.start?.turn ?? combat.turn;
          const currentRound = context?.round ?? combat.round;
          const currentTurn = context?.turn ?? combat.turn;
          const totalElapsed = (currentRound - startRound) * combat.turns.length + (currentTurn - startTurn);
          const remaining = duration.value - totalElapsed;
          // @ts-expect-error v14 pluralRules not in fvtt-types yet
          const pluralRule: string = game.i18n?.pluralRules?.select(Math.abs(remaining)) ?? "other";
          const locKey = remaining >= 0 ? "EFFECT.DURATION.TURNS" : "EFFECT.DURATION.TURNS_AGO";
          Object.assign(result, { remaining, label: game.i18n?.format(`${locKey}.${pluralRule}`, { turns: String(Math.abs(remaining)) }) ?? `${remaining} turns` });
        }
      }

      return result;
    }, "MIXED");
}
