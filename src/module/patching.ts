import { MODULE_ID, i18nFormat } from "../dae.js";

/** dnd5e 6 ActiveEffect5e.PSEUDO_EXPIRIES. */
const PSEUDO_EXPIRIES = new Set(["sourceStart", "sourceEnd", "targetStart", "targetEnd"]);

/**
 * Register lib-wrapper patches for ActiveEffect prototype methods.
 * Called during init.
 */
export function registerActiveEffectPatches(): void {
  const libWrapper = globalThis.libWrapper;

  // Patch isExpiryEvent:
  // 1. "updateWorldTime" (the retired Elapsed Time expiry) on effects that still store it: treated as no
  //    expiry event, which core satisfies with any event. New effects have it mapped to null on creation.
  // 2. Turn Start/End whose combatant has left the combat: core waits for that combatant's turn, which
  //    never comes, so expire at any turn edge after the creation round, as dnd5e does for source/target.
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype.isExpiryEvent",
    function isExpiryEventWrapper(this: ActiveEffect, wrapped: Function, event: string, context: any) {
      // @ts-expect-error v14 duration.expiry not in fvtt-types yet
      const expiry: string | undefined = this.duration.expiry;
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

  /*
   * dnd5e 6 gives its source/target expiries no duration ("the next such turn"): it clears the value on create and
   * update, and its sheet hides the duration fields, all through expirySupportsDuration. Keep the duration, as on
   * dnd5e 5.x, so "3 rounds, then the start of the target's turn" can be set; with none it is still the next turn.
   */
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.expirySupportsDuration",
    function expirySupportsDurationWrapper(wrapped: Function, expiry: string) {
      return PSEUDO_EXPIRIES.has(expiry) || wrapped(expiry);
    }, "MIXED");

  // While such a duration runs, show it rather than dnd5e's event-only label and marker.
  const counting = (effect: ActiveEffect): boolean => {
    // @ts-expect-error v14 duration.expiry not in fvtt-types yet
    if (!PSEUDO_EXPIRIES.has(effect.duration?.expiry)) return false;
    // @ts-expect-error v14 duration.value not in fvtt-types yet
    if (!Number.isFinite(effect._source.duration?.value)) return false;
    // @ts-expect-error v14 duration.remaining not in fvtt-types yet
    return effect.duration.remaining > 0;
  };
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype._prepareDuration",
    function prepareDurationWrapper(this: ActiveEffect, wrapped: Function, duration: object, context: object) {
      const result = wrapped(duration, context);
      if (!counting(this)) return result;
      // @ts-expect-error v14 _prepareDuration(duration, context) not in fvtt-types yet
      const core = foundry.documents.ActiveEffect.prototype._prepareDuration.call(this, foundry.utils.deepClone(this._source.duration), context);
      result.label = i18nFormat("dae.expiryThen", { duration: core.label, event: result.label });
      return result;
    }, "WRAPPER");
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype.getSpecialDurationParts",
    function getSpecialDurationPartsWrapper(this: ActiveEffect, wrapped: Function) {
      return counting(this) ? null : wrapped();
    }, "MIXED");
}
