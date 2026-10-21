
// Import TypeScript modules
import { registerSettings } from './module/settings.js';
import { preloadTemplates } from './module/preloadTemplates.js';
import { registerActiveEffectPatches } from './module/patching.js';
import { daeSetupActions, daeInitActions, fetchParams } from "./module/dae.js";
import { daeReadyActions } from "./module/dae.js";
import { shouldAutoMigrate, migrateWorld as runMigration } from "./module/migration.js";
import { setupSocket } from './module/GMAction.js';
import API from './module/API/api.js';
import { addAutoFields, BooleanFormulaField } from './module/apps/DAEActiveEffectConfig.js';

export let debugEnabled: number;
export let setDebugLevel = (debugText: string) => {
  debugEnabled = { "none": 0, "warn": 1, "debug": 2, "all": 3 }[debugText] || 0;
  // 0 = none, warnings = 1, debug = 2, all = 3
  if (debugEnabled >= 3) CONFIG.debug.hooks = true;
}
// 0 = none, warnings = 1, debug = 2, all = 3
export let debug = (...args: any[]) => { if (debugEnabled > 1) console.log("DEBUG: dae | ", ...args) };
export let log = (...args: any[]) => console.log("dae | ", ...args);
export let warn = (...args: any[]) => { if (debugEnabled > 0) console.warn("dae | ", ...args) };
export let error = (...args: any[]) => console.error("dae | ", ...args)
export function i18n(key: string) {
  return game.i18n?.localize(key) ?? key;
};
export function i18nFormat(key: string, data) {
  return game.i18n?.format(key, data) ?? key;
}
export const MODULE_ID = "dae";
/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', () => {
  debug('Init setup actions');

  registerActiveEffectPatches();

  registerSettings();
  daeInitActions();
  fetchParams();

  // Preload Handlebars templates - async but no use awaiting
  preloadTemplates();
  // Fire during init so modules can register typed auto-fields before initializeDocuments()
  // (which runs between init and setup and prepares actors).
  // addAutoFields only pushes to an array and has no game-state dependencies.
  const FormulaField = globalThis.dnd5e?.dataModels?.fields?.FormulaField;
  Hooks.callAll("dae.addAutoFields", addAutoFields, {
    BooleanFormulaField,
    FormulaField,
    NumberField: foundry.data.fields.NumberField,
    StringField: foundry.data.fields.StringField,
  });
});

export let daeSpecialDurations: Record<string, string>;
export let daeMacroRepeats: Record<string, string>;
Hooks.once('ready', () => {
  {
    fetchParams();
    debug("ready setup actions")
    daeSpecialDurations = { "None": "" };
    // turnStart, turnEnd, turnStartSource, turnEndSource, combatEnd removed —
    // now handled by v14 core duration.expiry + DAE source/target expiry events
    daeSpecialDurations["joinCombat"] = i18n("dae.joinCombat");
    daeMacroRepeats = {
      "none": "",
      "startEveryTurn": i18n("dae.startEveryTurn"),
      "endEveryTurn": i18n("dae.endEveryTurn"),
      "startEndEveryTurn": i18n("dae.startEndEveryTurn"),
      "startEveryTurnAny": i18n("dae.startEveryTurnAny"),
      "endEveryTurnAny": i18n("dae.endEveryTurnAny"),
      "startEndEveryTurnAny": i18n("dae.startEndEveryTurnAny")
    };
    // Apply the core expiry action override from DAE settings
    const coreExpiryAction = game.settings.get("dae", "coreExpiryAction");
    // @ts-expect-error v14 CONFIG.ActiveEffect.expiryAction not in fvtt-types yet
    CONFIG.ActiveEffect.expiryAction = coreExpiryAction === "none" ? null : coreExpiryAction;

    /*
     * Per-effect expiry mode (flags.dae.expiryMode) over core's Effect Expiry Action. Core takes an expired effect out of
     * the registry, then (on the active GM) marks it expired or deletes it in one batch. Each refresh keeps the effects
     * registered when it started: one no longer registered is being expired by that refresh, and only those are
     * redirected, so overlapping refreshes and unrelated deletes or updates pass untouched.
     */
    // @ts-expect-error v14 ActiveEffect.registry not in fvtt-types yet
    const registry: { refresh: Function, has(effect: ActiveEffect.Implementation): boolean } & Iterable<ActiveEffect.Implementation> = foundry.documents.ActiveEffect.registry;
    const origRefresh = registry.refresh;
    type Refresh = { event: string, before: Set<ActiveEffect.Implementation>, redirects: Map<ActiveEffect.Implementation, "delete" | "update"> };
    const refreshes: Refresh[] = [];
    const expiringIn = (effect: ActiveEffect.Implementation): Refresh | undefined =>
      registry.has(effect) ? undefined : refreshes.find(r => r.before.has(effect));
    const modeAction = (effect: ActiveEffect.Implementation): "delete" | "update" | undefined => {
      const mode = effect.getFlag("dae", "expiryMode") as string | undefined;
      return mode === "delete" ? "delete" : mode === "suppress" ? "update" : undefined;
    };

    function expiryReason(event: string, effect: ActiveEffect.Implementation): string {
      const expiry = (effect.duration as any)?.expiry as string | undefined;
      return `duration-expired:${expiry ?? event}`;
    }

    registry.refresh = async function(event, context) {
      const refresh: Refresh = { event, before: new Set(this), redirects: new Map() };
      refreshes.push(refresh);
      try {
        await origRefresh.call(this, event, context);
      } catch (err) {
        console.error("dae | registry.refresh", err);
      } finally {
        refreshes.splice(refreshes.indexOf(refresh), 1);
      }
      // Do Nothing: core leaves an expired effect alone, so its own mode is the only action
      // @ts-expect-error v14 CONFIG.ActiveEffect.expiryAction / game.users.activeGM not in fvtt-types yet
      if (!CONFIG.ActiveEffect.expiryAction && game.users.activeGM?.isSelf) {
        for (const effect of refresh.before) {
          const action = !this.has(effect) && modeAction(effect);
          if (action) refresh.redirects.set(effect, action);
        }
      }
      for (const [effect, action] of refresh.redirects) {
        // gone meanwhile (its actor or token too)
        if (!fromUuidSync(effect.uuid, { strict: false }) || !effect.parent?.effects.has(effect.id!)) continue;
        const reason: any = { "expiry-reason": expiryReason(event, effect) };
        if (action === "delete") await effect.delete(reason);
        // Suppress by disabling; see expireEffect for why duration.expired cannot mean "keep".
        // @ts-expect-error v14 duration.expired not in fvtt-types yet
        else await effect.update({ "disabled": true, "duration.expired": false }, reason);
      }
    };

    // Core deleting an expired effect (Delete): an effect set to Suppress is disabled instead
    Hooks.on("preDeleteActiveEffect", (effect: ActiveEffect.Implementation, options: any) => {
      const refresh = expiringIn(effect);
      if (!refresh) return true;
      if (!options["expiry-reason"]) options["expiry-reason"] = expiryReason(refresh.event, effect);
      if (modeAction(effect) !== "update") return true;
      // a dependent going with the effect it depends on (concentration ending) is deleted, not suppressed
      const parentEffect = fromUuidSync(foundry.utils.getProperty(effect, "flags.dnd5e.dependentOn") as string ?? "", { strict: false });
      if (parentEffect instanceof ActiveEffect && (!parentEffect.parent?.effects.has(parentEffect.id!) || expiringIn(parentEffect as ActiveEffect.Implementation))) return true;
      refresh.redirects.set(effect, "update");
      return false;
    });

    // Core marking an expired effect (Mark Expired): an effect set to Delete or Suppress gets that instead
    Hooks.on("preUpdateActiveEffect", (effect: ActiveEffect.Implementation, update: any, options: any) => {
      if (foundry.utils.getProperty(update, "duration.expired") !== true) return true;
      const refresh = expiringIn(effect);
      if (!refresh) return true;
      if (!options["expiry-reason"]) options["expiry-reason"] = expiryReason(refresh.event, effect);
      const action = modeAction(effect);
      if (!action) return true;
      refresh.redirects.set(effect, action);
      return false;
    });

    daeReadyActions();
    createDAEMacros();
    if (shouldAutoMigrate()) runMigration();
  }
  Hooks.callAll("dae.ready", API);
})
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', () => {
  {
    // Do anything after initialization but before ready
    debug("setup actions")
    daeSetupActions();

    // Set API
    const data: any = game.modules.get("dae");
    data.api = API;
    globalThis.DAE = API;

    Hooks.on("macro-autocomplete.ready", ({ tree, objectToCompletions, mergeCompletions, rebuildSignatureMap }) => {
      if (!tree.DAE) {
        tree.DAE = { type: "object", detail: "object", info: "DAE's API" };
      }
      // objectToCompletions walks the runtime object; mergeCompletions overlays type enrichment
      mergeCompletions(tree.DAE, objectToCompletions(API, 3));
      rebuildSignatureMap();
    });
    setupSocket();
    Hooks.callAll("dae.setupComplete", API);
  }
});


// Revisit to find out how to set execute as GM
const DAEMacros = [
  {
    name: "DAE: Create Sample DAEConditionalEffects",
    checkVersion: true,
    version: "14.0.5",
    commandText: `const itemData = await foundry.utils.fetchJsonWithTimeout('modules/dae/data/DAEConditionalEffects.json');
        await CONFIG.Item.documentClass.create([itemData]);`
  }
];

// TODO (Michael) Is this necessary? If so, is this the ideal way of doing this?
// I'm open to suggestions
export async function createDAEMacros() {
  if (game.user?.isGM) {
    const daeVersion = "11.2.0";
    for (let macroSpec of DAEMacros) {
      try {
        let existingMacros = game.macros?.filter(m => m.name === macroSpec.name) ?? [];
        if (existingMacros.length > 0) {
          for (let macro of existingMacros) {
            if (macroSpec.checkVersion
              && !foundry.utils.isNewerVersion(macroSpec.version, (macro.flags?.dae?.version ?? "0.0.0")))
              continue; // already up to date
            await macro.update({
              command: macroSpec.commandText,
              flags: {
                dae: {
                  version: macroSpec.version
                }
              }
            });
          }
        } else {
          const macroData: Macro.CreateData = {
            _id: null,
            name: macroSpec.name,
            type: "script",
            author: game.user.id,
            img: 'icons/svg/dice-target.svg',
            scope: 'global',
            command: macroSpec.commandText,
            folder: null,
            sort: 0,
            flags: {
              dae: {
                version: macroSpec.version ?? daeVersion
              }
            }
          };
          await Macro.createDocuments([macroData]);
          log(`Macro ${macroData.name} created`);
        }
      } catch (err) {
        const message = `createDAEMacros | failed to create macro ${macroSpec.name}`
        error(err, message);
      }
    }
  }
}
