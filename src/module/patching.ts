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
  /*
   * A new round advances world time with the combat update, and that refresh computes durations for the new round
   * before core fires the old round's turnEnd/roundEnd, which don't recompute: a 1-round effect ending at Round End, or
   * at a Turn End on the round's last turn, ended a round early (core's elapsed time counts the new round's seconds).
   * A duration in rounds started in this combat still has time left while rounds remain at the round that is ending.
   * Turns have no time equivalent, so they are counted right.
   */
  const remainsAtEnd = (effect: ActiveEffect, event: string, context: { combat?: Combat.Implementation, round?: number } | undefined): boolean => {
    if (event !== "turnEnd" && event !== "roundEnd") return false;
    // @ts-expect-error v14 duration.value/units not in fvtt-types yet
    const { value, units } = effect._source.duration ?? {};
    // @ts-expect-error v14 start schema not in fvtt-types yet
    const start = effect.start;
    const combat = context?.combat;
    if (units !== "rounds" || !Number.isFinite(value) || context?.round == null || !combat || start?.round == null) return false;
    if (start.combat !== combat && start.combat?.id !== combat.id) return false;
    // core's extra time: world time since the effect started, in rounds, beyond the rounds this combat has counted (time
    // advanced by hand). combat.round is already the new round, so the new round's seconds are covered and count nothing.
    const roundTime = CONFIG.time.roundTime;
    const extra = roundTime && start.time != null
      ? Math.max(0, Math.floor((game.time.worldTime - start.time) / roundTime) - (combat.round - 1))
      : 0;
    return value - (context.round - start.round) - extra > 0;
  };
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype.isExpiryEvent",
    function isExpiryEventWrapper(this: ActiveEffect, wrapped: Function, event: string, context: any) {
      if (remainsAtEnd(this, event, context)) return false;
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

  // A source/target expiry without a duration of its own keeps dnd5e's event-only label ("Your Turn Start") in the
  // effect lists and tooltip, which the override above would hide (dnd5e shows them only when it doesn't support one).
  // @ts-expect-error v14 duration.expiry not in fvtt-types yet
  const eventOnly = (effect: ActiveEffect): boolean => PSEUDO_EXPIRIES.has(effect.duration?.expiry) && !Number.isFinite(effect._source.duration?.value);
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype.getDurationParts",
    function getDurationPartsWrapper(this: ActiveEffect, wrapped: Function, ...args: unknown[]) {
      // @ts-expect-error v14 duration.label not in fvtt-types yet
      return eventOnly(this) ? [this.duration.label] : wrapped(...args);
    }, "MIXED");
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype.getSheetContext",
    async function getSheetContextWrapper(this: ActiveEffect, wrapped: Function, ...args: unknown[]) {
      const context = await wrapped(...args);
      if (eventOnly(this)) context.showDuration = true;
      return context;
    }, "WRAPPER");
  // as dnd5e's richTooltip, with the event label shown
  libWrapper.register(MODULE_ID, "CONFIG.ActiveEffect.documentClass.prototype.richTooltip",
    async function richTooltipWrapper(this: ActiveEffect, wrapped: Function, enrichmentOptions = {}) {
      if (!eventOnly(this)) return wrapped(enrichmentOptions);
      // @ts-expect-error no dnd5e types
      const context = await this.getPreviewContext(enrichmentOptions);
      // @ts-expect-error v14 duration.label not in fvtt-types yet
      context.durationParts = [this.duration.label];
      context.showDuration = true;
      return {
        content: await foundry.applications.handlebars.renderTemplate("systems/dnd5e/templates/effects/parts/effect-tooltip.hbs", context),
        classes: ["dnd5e2", "dnd5e-tooltip", "effect-tooltip", "document-tooltip"]
      };
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
