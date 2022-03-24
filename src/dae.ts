
// Import TypeScript modules
import { registerSettings } from './module/settings';
import { preloadTemplates } from './module/preloadTemplates';
import { daeSetupActions, doEffects, daeInitActions, fetchParams, daeMacro, DAEfromUuid, DAEfromActorUuid, daeSystemClass } from "./module/dae";
import { daeReadyActions} from "./module/dae";
import { convertDuration, setupSocket } from './module/GMAction';
import { checkLibWrapperVersion, cleanArmorWorld, cleanEffectOrigins, fixDeprecatedChanges, fixDeprecatedChangesActor, fixDeprecatedChangesItem, fixTransferEffects, fixupDDBAC, migrateActorDAESRD, migrateAllActorsDAESRD, migrateAllNPCDAESRD, removeActorArmorEffects, removeActorEffectsArmorEffects, removeAllActorArmorEffects, removeAllItemsArmorEffects, removeAllTokenArmorEffects, removeItemArmorEffects, tobMapper } from './module/migration';
import { ActiveEffects } from './module/apps/ActiveEffects';
import { patchingSetup, patchingInitSetup } from './module/patching';
import { addAutoFields, DAEActiveEffectConfig } from './module/apps/DAEActiveEffectConfig';
import { teleportToToken, blindToken, restoreVision, setTokenVisibility, setTileVisibility, moveToken, renameToken, getTokenFlag, setTokenFlag, setFlag, unsetFlag, getFlag, deleteActiveEffect, createToken } from './module/daeMacros';
import { EditOwnedItemEffectsItemSheet } from './module/editItemEffects/classes/item-sheet';
import { ValidSpec } from './module/Systems/DAESystem';
import { DAESystemDND5E } from './module/Systems/DAEdnd5e';
import { DAESystemSW5E } from './module/Systems/DAEsw5e';

export let setDebugLevel = (debugText: string) => {
  debugEnabled = {"none": 0, "warn": 1, "debug": 2, "all": 3}[debugText] || 0;
  // 0 = none, warnings = 1, debug = 2, all = 3
  if (debugEnabled >= 3) CONFIG.debug.hooks = true;
}
export var debugEnabled;
// 0 = none, warnings = 1, debug = 2, all = 3
export let debug = (...args) => {if (debugEnabled > 1) console.log("DEBUG: dae | ", ...args)};
export let log = (...args) => console.log("dae | ", ...args);
export let warn = (...args) => {if (debugEnabled > 0) console.warn("dae | ", ...args)};
export let error = (...args) => console.error("dae | ", ...args)
export let timelog = (...args) => warn("dae | ", Date.now(), ...args);
export let i18n = key => {
  return game.i18n.localize(key);
};
export let daeAlternateStatus;
export let changesQueue;

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function() {
	// Register custom module settings
  registerSettings();
	debug('Init setup actions');
  daeInitActions();
  patchingInitSetup();
  fetchParams(false);


	// Assign custom classes and constants here
	
	// Preload Handlebars templates
	await preloadTemplates();

  //@ts-ignore Semaphore
  changesQueue = new window.Semaphore(1);
});

export let daeSpecialDurations;
export let  daeMacroRepeats;
Hooks.once('ready', async function () {
  fetchParams();
  debug("ready setup actions")
  daeSpecialDurations = {"None": ""};
  if (game.modules.get("times-up")?.active && isNewerVersion(game.modules.get("times-up").data.version, "0.0.9")) {
    daeSpecialDurations["turnStart"] = i18n("dae.turnStart");
    daeSpecialDurations["turnEnd"] = i18n("dae.turnEnd");
    daeSpecialDurations["turnStartSource"] = i18n("dae.turnStartSource");
    daeSpecialDurations["turnEndSource"] = i18n("dae.turnEndSource");
    daeMacroRepeats= {
      "none": "",
      "startEveryTurn" : i18n("dae.startEveryTurn"),
      "endEveryTurn" : i18n("dae.endEveryTurn")
    };
  }
  daeReadyActions();
  EditOwnedItemEffectsItemSheet.init();
  // setupDAEMacros();
})
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function() {
	// Do anything after initialization but before
  // ready
  debug("setup actions")
	daeSetupActions();
  patchingSetup();
	//@ts-ignore
	window.DAE = {
    ValidSpec,
    doEffects,
    daeMacro: daeMacro,
    ActiveEffects: ActiveEffects,
    DAEActiveEffectConfig: DAEActiveEffectConfig,
    teleportToToken: teleportToToken,
    blindToken: blindToken,
    restoreVision: restoreVision,
    setTokenVisibility: setTokenVisibility,
    setTileVisibility: setTileVisibility,
    moveToken: moveToken,
    renameToken: renameToken,
    getTokenFlag: getTokenFlag,
    setTokenFlag: setTokenFlag,
    setFlag: setFlag,
    unsetFlag: unsetFlag,
    getFlag: getFlag,
    deleteActiveEffect: deleteActiveEffect,
    migrateActorDAESRD: migrateActorDAESRD,
    migrateAllActorsDAESRD: migrateAllActorsDAESRD,
    migrateAllNPCDAESRD: migrateAllNPCDAESRD,
    convertDuration,
    confirmAction,
    DAEfromUuid: DAEfromUuid,
    DAEfromActorUuid: DAEfromActorUuid,
    removeItemArmorEffects: removeItemArmorEffects,
    removeActorEffectsArmorEffects: removeActorEffectsArmorEffects,
    removeActorArmorEffects: removeActorArmorEffects,
    removeAllActorArmorEffects: removeAllActorArmorEffects,
    removeAllTokenArmorEffects: removeAllTokenArmorEffects,
    removeAllItemsArmorEffects: removeAllItemsArmorEffects,
    cleanArmorWorld: cleanArmorWorld,
    addAutoFields: addAutoFields,
    createToken: createToken,
    fixupDDBAC: fixupDDBAC,
    cleanEffectOrigins: cleanEffectOrigins,
    tobMapper: tobMapper,
    fixTransferEffects: fixTransferEffects,
    fixDeprecatedChanges: fixDeprecatedChanges,
    fixDeprecatedChangesActor: fixDeprecatedChangesActor,
    fixDeprecatedChangesItem: fixDeprecatedChangesItem,
    daeSpecialDurations: () => {return daeSpecialDurations}
  }
  setupSocket();
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */

Hooks.once("ready", () => {
  checkLibWrapperVersion();
})

export function confirmAction(toCheck: boolean, confirmFunction, title = i18n("dae.confirm")) {
  if (toCheck) {
    let d = new Dialog({
        // localize this text
        title,
        content: `<p>${i18n("dae.sure")}</p>`,
        buttons: {
            one: {
                icon: '<i class="fas fa-check"></i>',
                label: "Confirm",
                callback: confirmFunction
            },
            two: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel",
                callback: () => { }
            }
        },
        default: "two"
    });
    d.render(true);
  } else return confirmFunction();
}

Hooks.once('libChangelogsReady', function() {
  //@ts-ignore
  const libch = libChangelogs;

})
