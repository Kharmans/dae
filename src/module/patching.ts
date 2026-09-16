import { MODULE_ID } from "../dae.js";

/**
 * Register lib-wrapper patches for ActiveEffect prototype methods.
 * Called during init after custom expiry events are registered.
 */
export function registerActiveEffectPatches(): void {
  const libWrapper = globalThis.libWrapper;

  // Patch isExpiryEvent:
  // 1. "updateWorldTime" expiry: expire whenever duration runs out, regardless of event
  // 2. Event-only effects (no duration value): don't let time advance satisfy combat expiry
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype.isExpiryEvent",
    function isExpiryEventWrapper(this: ActiveEffect, wrapped: Function, event: string, context: any) {
      // @ts-expect-error v14 duration.expiry not in fvtt-types yet
      const expiry: string | undefined = this.duration.expiry;
      if (expiry === "updateWorldTime") return true;
      // @ts-expect-error v14 _source.duration.value not in fvtt-types yet
      if (event === "updateWorldTime" && !Number.isFinite(this._source.duration.value)) return false;
      return wrapped(event, context);
    }, "MIXED");

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
