
// Import TypeScript modules
import { registerSettings } from './module/settings';
import { preloadTemplates } from './module/preloadTemplates';
import { daeSetupActions, doEffects, daeInitActions, fetchParams, daeMacro, DAEfromUuid, DAEfromActorUuid, daeSystemClass, actionQueue } from "./module/dae";
import { daeReadyActions } from "./module/dae";
import { convertDuration, setupSocket } from './module/GMAction';
import { checkLibWrapperVersion, cleanArmorWorld, cleanEffectOrigins, fixDeprecatedChanges, fixDeprecatedChangesActor, fixDeprecatedChangesItem, fixTransferEffects, fixupDDBAC, migrateActorDAESRD, migrateAllActorsDAESRD, migrateAllNPCDAESRD, removeActorArmorEffects, removeActorEffectsArmorEffects, removeAllActorArmorEffects, removeAllItemsArmorEffects, removeAllTokenArmorEffects, removeItemArmorEffects, tobMapper } from './module/migration';
import { ActiveEffects } from './module/apps/ActiveEffects';
import { patchingSetup, patchingInitSetup } from './module/patching';
import { addAutoFields, DAEActiveEffectConfig } from './module/apps/DAEActiveEffectConfig';
import { teleportToToken, blindToken, restoreVision, setTokenVisibility, setTileVisibility, moveToken, renameToken, getTokenFlag, setTokenFlag, setFlag, unsetFlag, getFlag, deleteActiveEffect, createToken, teleportToken } from './module/daeMacros';
import { EditOwnedItemEffectsItemSheet } from './module/editItemEffects/classes/item-sheet';
import { ValidSpec } from './module/Systems/DAESystem';
import { DAESystemDND5E } from './module/Systems/DAEdnd5e';
import { DAESystemSW5E } from './module/Systems/DAEsw5e';

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
export let i18n = key => {
  return game.i18n.localize(key);
};
export let daeAlternateStatus;
export let changesQueue;
export var gameSystemCompatible = "maybe"; // no, yes, partial, maybe

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function () {
  const daeFlags = game.modules.get("dae").data.flags;

  if (daeFlags.compatible?.includes(game.system.id)) gameSystemCompatible = "yes";
  else if (daeFlags.incompatible?.includes(game.system.id)) gameSystemCompatible = "no";
  else if (daeFlags.partial?.includes(game.system.id)) gameSystemCompatible = "parital";

  if (gameSystemCompatible === "no") {
    console.error(`DAE is not compatible with ${game.system.data.title} module disabled`)
  } else {
    if (gameSystemCompatible !== "yes") console.warn(`DAE compatibility with ${game.system.data.title} ${gameSystemCompatible}`)
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
  };
});

export var daeSpecialDurations;
export var daeMacroRepeats;
Hooks.once('ready', async function () {
  if (gameSystemCompatible !== "no") {
    if ("maybe" === gameSystemCompatible) {
      if (game.user.isGM) ui.notifications.warn(`DAE is has not been tested with ${game.system.data.title}. Disable DAE if there are problems`);
    } else if ("partial" === gameSystemCompatible) {
      if (game.user.isGM) ui.notifications.warn(`DAE is partially compatible with ${game.system.data.title}. Disable DAE if there are problems`);
    }
    checkLibWrapperVersion();
    fetchParams();
    debug("ready setup actions")
    daeSpecialDurations = { "None": "" };
    if (game.modules.get("times-up")?.active && isNewerVersion(game.modules.get("times-up").data.version, "0.0.9")) {
      daeSpecialDurations["turnStart"] = i18n("dae.turnStart");
      daeSpecialDurations["turnEnd"] = i18n("dae.turnEnd");
      daeSpecialDurations["turnStartSource"] = i18n("dae.turnStartSource");
      daeSpecialDurations["turnEndSource"] = i18n("dae.turnEndSource");
      daeMacroRepeats = {
        "none": "",
        "startEveryTurn": i18n("dae.startEveryTurn"),
        "endEveryTurn": i18n("dae.endEveryTurn")
      };
    }
    daeReadyActions();
    EditOwnedItemEffectsItemSheet.init();
    // setupDAEMacros();
  } else {
    ui.notifications.error(`DAE is not compatible with ${game.system.id} - module disabled`);
  }
})
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function () {
  if (gameSystemCompatible !== "no") {
    // Do anything after initialization but before
    // ready
    debug("setup actions")
    daeSetupActions();
    patchingSetup();
    //@ts-ignore
    window.DAE = {
      ActiveEffects: ActiveEffects,
      addAutoFields: addAutoFields,
      blindToken: blindToken,
      cleanArmorWorld: cleanArmorWorld,
      cleanEffectOrigins: cleanEffectOrigins,
      confirmAction,
      convertDuration,
      createToken: createToken,
      DAEActiveEffectConfig: DAEActiveEffectConfig,
      DAEfromActorUuid: DAEfromActorUuid,
      DAEfromUuid: DAEfromUuid,
      daeMacro: daeMacro,
      daeSpecialDurations: () => { return daeSpecialDurations },
      deleteActiveEffect: deleteActiveEffect,
      doEffects,
      fixDeprecatedChanges: fixDeprecatedChanges,
      fixDeprecatedChangesActor: fixDeprecatedChangesActor,
      fixDeprecatedChangesItem: fixDeprecatedChangesItem,
      fixTransferEffects: fixTransferEffects,
      fixupDDBAC: fixupDDBAC,
      getFlag: getFlag,
      getTokenFlag: getTokenFlag,
      migrateActorDAESRD: migrateActorDAESRD,
      migrateAllActorsDAESRD: migrateAllActorsDAESRD,
      migrateAllNPCDAESRD: migrateAllNPCDAESRD,
      moveToken: moveToken,
      removeActorArmorEffects: removeActorArmorEffects,
      removeActorEffectsArmorEffects: removeActorEffectsArmorEffects,
      removeAllActorArmorEffects: removeAllActorArmorEffects,
      removeAllItemsArmorEffects: removeAllItemsArmorEffects,
      removeAllTokenArmorEffects: removeAllTokenArmorEffects,
      removeItemArmorEffects: removeItemArmorEffects,
      renameToken: renameToken,
      restoreVision: restoreVision,
      setFlag: setFlag,
      setTileVisibility: setTileVisibility,
      setTokenFlag: setTokenFlag,
      setTokenVisibility: setTokenVisibility,
      teleportToken: teleportToken,
      teleportToToken: teleportToToken,
      tobMapper: tobMapper,
      unsetFlag: unsetFlag,
      ValidSpec,
      actionQueue: actionQueue

    }
    setupSocket();
    Hooks.callAll("DAE.setupComplete");
  }
});

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

Hooks.once('libChangelogsReady', function () {
  //@ts-ignore
  const libch = libChangelogs;

})
