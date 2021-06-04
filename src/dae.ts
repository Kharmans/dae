
// Import TypeScript modules
import { registerSettings } from './module/settings';
import { preloadTemplates } from './module/preloadTemplates';
import { daeSetupActions, doEffects, daeInitActions, ValidSpec, fetchParams, daeMacro, DAEfromUuid, DAEfromActorUuid} from "./module/dae";
import { daeReadyActions} from "./module/dae";
import { convertDuration, GMAction, GMActionMessage } from './module/GMAction';
import { cleanArmorWorld, migrateActorDAESRD, migrateAllActorsDAESRD, migrateAllNPCDAESRD, removeActorArmorEffects, removeActorEffectsArmorEffects, removeAllActorArmorEffects, removeAllItemsArmorEffects, removeAllTokenArmorEffects, removeItemArmorEffects } from './module/migration';
import { ActiveEffects } from './module/apps/ActiveEffects';
import { patchingSetup, patchingInitSetup, patchSpecialTraits, patchGetInitiativeFormula } from './module/patching';
import { DAEActiveEffectConfig } from './module/apps/DAEActiveEffectConfig';
import { teleportToToken, blindToken, restoreVision, setTokenVisibility, setTileVisibility, moveToken, renameToken, getTokenFlag, setTokenFlag, setFlag, unsetFlag, getFlag, deleteActiveEffect } from './module/daeMacros';

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
/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function() {

	// Register custom module settings
  registerSettings();
  fetchParams();
	debug('Init setup actions');
  daeInitActions();
  patchingInitSetup();

	// Assign custom classes and constants here
	
	// Preload Handlebars templates
	await preloadTemplates();

	// Register custom sheets (if any)
});

export let daeSpecialDurations;
export let  daeMacroRepeats;
Hooks.once('ready', async function () {
  if (!["dnd5e", "sw5e"].includes(game.system.id)) return;

  debug("ready setup actions")
  daeReadyActions();
  // setupDAEMacros();
  GMAction.readyActions();
  daeSpecialDurations = {"None": ""};
  if (game.modules.get("times-up")?.active && isNewerVersion(game.modules.get("times-up").data.version, "0.0.9")) {
    daeSpecialDurations["turnStart"] = i18n("dae.turnStart");
    daeSpecialDurations["turnEnd"] = i18n("dae.turnEnd");
    daeMacroRepeats= {
      "none": "",
      "startEveryTurn" : i18n("dae.startEveryTurn"),
      "endEveryTurn" : i18n("dae.endEveryTurn")
    };
  }
  if (game.modules.get("midi-qol")?.active) {
    daeSpecialDurations["1Action"] = i18n("dae.1Action");
    daeSpecialDurations["1Attack"] = i18n("dae.1Attack");
    let attackTypes = ["mwak", "rwak", "msak", "rsak"];
    if (game.system.id === "sw5e") attackTypes = ["mwak", "rwak", "mpak", "rpak"];
    attackTypes.forEach(at => {
      daeSpecialDurations[`1Attack:${at}`] = `${CONFIG.DND5E.itemActionTypes[at]}: ${i18n("dae.1Attack")}`;
    })
    daeSpecialDurations["1Hit"] = i18n("dae.1Hit");
    daeSpecialDurations["DamageDealt"] = i18n("dae.DamageDealt");
    daeSpecialDurations["isAttacked"] = i18n("dae.isAttacked");
    daeSpecialDurations["isDamaged"] = i18n("dae.isDamaged");
    daeSpecialDurations["isSave"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}`;
    daeSpecialDurations["isSaveSuccess"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}: ${i18n("dae.success")}`;
    daeSpecialDurations["isSaveFailure"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}: ${i18n("dae.failure")}`;
    daeSpecialDurations["isCheck"] = `${i18n("dae.isRollBase")} ${i18n("dae.isCheckDetail")}`;
    daeSpecialDurations["isSkill"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSkillDetail")}`;
    Object.keys(CONFIG.DND5E.abilities).forEach(abl => {
      daeSpecialDurations[`isSave.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isSaveDetail")}`;
      daeSpecialDurations[`isCheck.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isCheckDetail")}`;
    })
    Object.keys(CONFIG.DND5E.damageTypes).forEach(dt=> {
      daeSpecialDurations[`isDamaged.${dt}`] = `${i18n("dae.isDamaged")}: ${CONFIG.DND5E.damageTypes[dt]}`;
    });
    Object.keys(CONFIG.DND5E.skills).forEach(skillId=> {
      daeSpecialDurations[`isSkill.${skillId}`] = `${i18n("dae.isRollBase")} ${i18n("dae.isSkillDetail")} ${CONFIG.DND5E.skills[skillId]}`;
    });
  }

  patchSpecialTraits();
  patchGetInitiativeFormula();
})
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function() {
  if (!["dnd5e", "sw5e"].includes(game.system.id)) return;
	// Do anything after initialization but before
  // ready
  debug("setup actions")
	GMAction.initActions();
	daeSetupActions();
  patchingSetup();
	//@ts-ignore
	window.DAE = {
    ValidSpec,
    GMActionMessage,
    GMAction,
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
    cleanArmorWorld: cleanArmorWorld
  }
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */

Hooks.once("ready", () => {
  if (!["dnd5e", "sw5e"].includes(game.system.id)) return;
  if (!game.modules.get("lib-wrapper")?.active && game.user.isGM)
    ui.notifications.warn("The 'Dynamic effects using Active Effects' module recommends to install and activate the 'libWrapper' module.");
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
};