
// Import TypeScript modules
import { registerSettings } from './module/settings.js';
import { preloadTemplates } from './module/preloadTemplates.js';
import { daeSetupActions, daeInitActions, fetchParams } from "./module/dae.js";
import { daeReadyActions } from "./module/dae.js";
import { setupSocket } from './module/GMAction.js';
import { checkLibWrapperVersion } from './module/migration.js';
import { setupPatching, initPatching } from './module/patching.js';
import API from './module/API/api.js';

export const ArrayField = foundry.data.fields.ArrayField;
export const ObjectField = foundry.data.fields.ObjectField
export const BooleanField = foundry.data.fields.BooleanField;
export const NumberField = foundry.data.fields.NumberField;
export const StringField = foundry.data.fields.StringField;
export const SchemaField = foundry.data.fields.SchemaField;

export let setDebugLevel = (debugText: string) => {
  debugEnabled = { "none": 0, "warn": 1, "debug": 2, "all": 3 }[debugText] || 0;
  // 0 = none, warnings = 1, debug = 2, all = 3
  if (debugEnabled >= 3) CONFIG.debug.hooks = true;
}
export var debugEnabled;
// 0 = none, warnings = 1, debug = 2, all = 3
export let debug = (...args) => { if (debugEnabled > 1) console.log("DEBUG: dae | ", ...args) };
export let log = (...args) => console.log("dae | ", ...args);
export let warn = (...args) => { if (debugEnabled > 0) console.warn("dae | ", ...args) };
export let error = (...args) => console.error("dae | ", ...args)
export let timelog = (...args) => warn("dae | ", Date.now(), ...args);
export function i18n(key: string) {
  return game.i18n?.localize(key) ?? key;
};
export function i18nFormat(key: string, data) {
  return game.i18n?.format(key, data) ?? key;
}
export let daeAlternateStatus;
export var gameSystemCompatible = "maybe"; // no, yes, partial, maybe
export var daeUntestedSystems: boolean;
export const MODULE_ID = "dae";
/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function () {
  // CONFIG.ActiveEffect.legacyTransferral = false;
  debug('Init setup actions');

  const daeFlags = game.modules?.get("dae")?.flags ?? {};
  const systemDaeFlag = game.system?.flags?.daeCompatible;
  // @ts-expect-error
  if (daeFlags.compatible?.includes(game.system?.id) || systemDaeFlag === true) gameSystemCompatible = "yes";
  // @ts-expect-error
  else if (daeFlags.incompatible?.includes(game.system?.id) || systemDaeFlag === false) gameSystemCompatible = "no";

  if (gameSystemCompatible === "no") {
    console.error(`DAE is not compatible with ${game.system?.title} module disabled`)
  } else {
    registerSettings();
    daeUntestedSystems = game.settings.get("dae", "DAEUntestedSystems") === true;
    if (gameSystemCompatible === "yes" || daeUntestedSystems) {
      if (gameSystemCompatible === "maybe") console.warn(`DAE compatibility warning for ${game.system?.title} is not tested with DAE`);
      daeInitActions();
      initPatching();
      fetchParams();

      // Preload Handlebars templates
      await preloadTemplates();
    }
  };
});

export var daeSpecialDurations;
export var daeMacroRepeats;
Hooks.once('ready', async function () {
  if (gameSystemCompatible !== "no" && (gameSystemCompatible === "yes" || daeUntestedSystems)) {
    if ("maybe" === gameSystemCompatible) {
      if (game.user?.isGM) ui.notifications?.warn(`DAE is has not been tested with ${game.system?.title}. Disable DAE if there are problems`);
    }
    checkLibWrapperVersion();
    fetchParams();
    debug("ready setup actions")
    daeSpecialDurations = { "None": "" };
    if (game.modules?.get("times-up")?.active && foundry.utils.isNewerVersion(game.modules?.get("times-up")?.version ?? "0", "0.0.9")) {
      daeSpecialDurations["turnStart"] = i18n("dae.turnStart");
      daeSpecialDurations["turnEnd"] = i18n("dae.turnEnd");
      daeSpecialDurations["turnStartSource"] = i18n("dae.turnStartSource");
      daeSpecialDurations["turnEndSource"] = i18n("dae.turnEndSource");
      daeSpecialDurations["combatEnd"] = i18n("COMBAT.End");
      daeSpecialDurations["joinCombat"] = i18n("COMBAT.CombatantCreate");
      daeMacroRepeats = {
        "none": "",
        "startEveryTurn": i18n("dae.startEveryTurn"),
        "endEveryTurn": i18n("dae.endEveryTurn"),
        "startEndEveryTurn": i18n("dae.startEndEveryTurn"),
        "startEveryTurnAny": i18n("dae.startEveryTurnAny"),
        "endEveryTurnAny": i18n("dae.endEveryTurnAny"),
        "startEndEveryTurnAny": i18n("dae.startEndEveryTurnAny")
      };
    }
    daeReadyActions();
    createDAEMacros();
  } else if (gameSystemCompatible === "maybe" && !daeUntestedSystems) {
    ui.notifications?.error(`DAE is not certified compatible with ${game.system?.id} - enable Untested Systems in DAE settings to enable`);
   } else {
    ui.notifications?.error(`DAE is not compatible with ${game.system?.id} - module disabled`);
  }
})
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function () {
  if (gameSystemCompatible === "no" || (gameSystemCompatible === "maybe" && !daeUntestedSystems)) {
    ui.notifications?.warn(`DAE disabled for ${game.system?.title} - to enable choose Allow Untested Systems from the DAE settings`)
  } else {
    // Do anything after initialization but before ready
    debug("setup actions")
    daeSetupActions();
    setupPatching();

    // Set API
    const data:any = game.modules?.get("dae");
    data.api = API;
    // @ts-expect-error types doesn't know
    globalThis.DAE = game.modules?.get("dae")?.api;

    setupSocket();
    Hooks.callAll("DAE.setupComplete");
  }
});

export async function confirmAction(toCheck: boolean, confirmFunction, title = i18n("dae.confirm")) {
  if (toCheck || await foundry.applications.api.DialogV2.confirm({
    window: {title},
    content: `<p>${i18n("dae.sure")}</p>`,
    rejectClose: false
  })) {
    return confirmFunction();
  }
}


// Revisit to find out how to set execute as GM
const DAEMacros = [
  {
    name: "DAE: Clear Scene DAE Passive Effects",
    checkVersion: true,
    version: "11.2.1",
    commandText: `await game.modules?.get("dae").api.removeScenePassiveEffects()`
  },
  {
    name: "DAE: Clear All Actors DAE Passive Effects",
    checkVersion: true,
    version: "11.2.1",
    commandText: `await game.modules?.get("dae").api.removeActorsPassiveEffects()`
  },
  {
    name: "DAE: Clear All Compendium DAE Passive Effects",
    checkVersion: true,
    version: "11.2.1",
    commandText: `await game.modules?.get("dae").api.removeCompendiaPassiveEffects()`
  },
  {
    name: "DAE: Clear All Scenes DAE Passive Effects",
    checkVersion: true,
    version: "11.2.1",
    commandText: `await game.modules?.get("dae").api.removeAllScenesPassiveEffects()`
  },
  {
    name: "DAE: Create Sample DAEConditionalEffects",
    checkVersion: true,
    version: "11.3.41",
    commandText: `itemData = await foundry.utils.fetchJsonWithTimeout('modules/dae/data/DAEConditionalEffects.json');
        CONFIG.Item.documentClass.create([itemData]);`
    }
];

export async function createDAEMacros() {
  if (game.user?.isGM) {
    const daeVersion = "11.2.0";
    for (let macroSpec of DAEMacros) {
      try {
        let existingMacros = game.macros?.filter(m => m.name === macroSpec.name) ?? [];
        if (existingMacros.length > 0) {
          for (let macro of existingMacros) {
            if (macroSpec.checkVersion
              && !foundry.utils.isNewerVersion(macroSpec.version, (macro.flags["dae-version"] ?? "0.0.0")))
              continue; // already up to date
            await macro.update({
              command: macroSpec.commandText,
              // @ts-expect-error
              "flags.dae-version": macroSpec.version
            });
          }
        } else {
          const macroData = {
            _id: null,
            name: macroSpec.name,
            type: "script",
            author: game.user.id,
            img: 'icons/svg/dice-target.svg',
            scope: 'global',
            command: macroSpec.commandText,
            folder: null,
            sort: 0,
            permission: {
              default: 1,
            },
            flags: { "dae-version": macroSpec.version ?? daeVersion }
          };
          // @ts-expect-error types silliness
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
