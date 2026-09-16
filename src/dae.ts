
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
export let timelog = (...args: any[]) => warn("dae | ", Date.now(), ...args);
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

  // Register custom expiry events:
  // - "updateWorldTime" (Time Elapsed): expire purely on duration, not combat events
  // @ts-expect-error v14 CONFIG.ActiveEffect.expiryEvents not in fvtt-types yet
  CONFIG.ActiveEffect.expiryEvents.updateWorldTime = "dae.expiryEvent.updateWorldTime";

  // Register lib-wrapper patches for isExpiryEvent and _prepareDuration
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

    // Per-effect expiry mode: wrap registry.refresh() to intercept via pre-hooks.
    // modifyBatch fires preDelete/preUpdate hooks (via dryRun pass), so we set a flag
    // during refresh and use pre-hooks to redirect effects whose flags.dae.expiryMode
    // differs from the global CONFIG.ActiveEffect.expiryAction.
    // @ts-expect-error v14 ActiveEffect.registry not in fvtt-types yet
    const registry: { refresh: Function } = foundry.documents.ActiveEffect.registry;
    const origRefresh = registry.refresh;
    const expiryRedirects: { effect: ActiveEffect.Implementation, targetAction: "delete" | "update" }[] = [];
    let registryRefreshActive = false;
    let registryRefreshEvent = "";

    function expiryReason(event: string, effect: ActiveEffect.Implementation): string {
      const expiry = (effect.duration as any)?.expiry as string | undefined;
      return `duration-expired:${expiry ?? event}`;
    }

    registry.refresh = async function(event, context) {
      registryRefreshActive = true;
      registryRefreshEvent = event;
      expiryRedirects.length = 0;
      try {
        await origRefresh.call(this, event, context);
      } catch (err) {
        console.error("dae | registry.refresh", err);
      } finally {
        registryRefreshActive = false;
        registryRefreshEvent = "";
      }
      // Process any redirected operations (effects whose per-effect mode differs from global)
      for (const { effect, targetAction } of expiryRedirects) {
        const reason: any = { "expiry-reason": expiryReason(event, effect) };
        if (targetAction === "delete") await effect.delete(reason);
        // Suppress by disabling; see expireEffect for why duration.expired cannot mean "keep".
        // @ts-expect-error v14 duration.expired not in fvtt-types yet
        else await effect.update({ "disabled": true, "duration.expired": false }, reason);
      }
      expiryRedirects.length = 0;
    };

    // Intercept registry expiry: inject expiry-reason into options for core duration expiry,
    // and redirect effects whose per-effect expiryMode differs from the global setting.
    Hooks.on("preDeleteActiveEffect", (effect: ActiveEffect.Implementation, options: any) => {
      if (!registryRefreshActive) return true;
      if (!options["expiry-reason"]) options["expiry-reason"] = expiryReason(registryRefreshEvent, effect);
      const mode = effect.getFlag("dae", "expiryMode") as string | undefined;
      if (mode === "suppress") {
        expiryRedirects.push({ effect, targetAction: "update" });
        return false;
      }
      return true;
    });

    // Intercept registry expiry: inject expiry-reason into options for core duration expiry,
    // and redirect effects whose per-effect expiryMode differs from the global setting.
    Hooks.on("preUpdateActiveEffect", (effect: ActiveEffect.Implementation, update: any, options: any) => {
      if (!registryRefreshActive) return true;
      if (!foundry.utils.hasProperty(update, "duration.expired")) return true;
      if (!options["expiry-reason"]) options["expiry-reason"] = expiryReason(registryRefreshEvent, effect);
      const mode = effect.getFlag("dae", "expiryMode") as string | undefined;
      if (mode === "delete") {
        expiryRedirects.push({ effect, targetAction: "delete" });
        return false;
      }
      return true;
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
