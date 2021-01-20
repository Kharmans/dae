/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your module, or remove it.
 * Author: [your name]
 * Content License: [copyright and-or license] If using an existing system
 * 					you may want to put a (link to a) license or copyright
 * 					notice here (e.g. the OGL).
 * Software License: [your license] Put your desired license here, which
 * 					 determines how others may use and modify your module
 */

// Import TypeScript modules
import { registerSettings } from './module/settings';
import { preloadTemplates } from './module/preloadTemplates';
import { daeSetupActions, doEffects, daeInitActions, ValidSpec, fetchParams} from "./module/dae";
import { daeReadyActions} from "./module/dae";
import { GMAction, GMActionMessage } from './module/GMAction';
import { migrateItem, migrateActorItems, migrateAllActors, removeActorEffects, fixupMonstersCompendium, fixupActors, fixupBonuses, migrateAllItems, migrateActorDAESRD, migrateAllActorsDAESRD, migrateAllNPCDAESRD } from './module/migration';
import { ActiveEffects } from './module/apps/ActiveEffects';
import { patchingSetup, patchingInitSetup, patchSpecialTraits } from './module/patching';
import { DAEActiveEffectConfig } from './module/apps/DAEActiveEffectConfig';
import { teleportToToken, blindToken, restoreVision, setTokenVisibility, setTileVisibility, moveToken, renameToken, getTokenFlag, setTokenFlag, setupDAEMacros, setFlag, unsetFlag, getFlag } from './module/daeMacros';

export let setDebugLevel = (debugText: string) => {
  debugEnabled = {"none": 0, "warn": 1, "debug": 2, "all": 3}[debugText] || 0;
  // 0 = none, warnings = 1, debug = 2, all = 3
  CONFIG.debug.hooks = debugEnabled >= 3;
}
export var debugEnabled;
// 0 = none, warnings = 1, debug = 2, all = 3
export let debug = (...args) => {if (debugEnabled > 1) console.log("DEBUG: dae | ", ...args)};
export let log = (...args) => console.log("dae | ", ...args);
export let warn = (...args) => {if (debugEnabled > 0) console.warn("dae | ", ...args)};
export let error = (...args) => console.error("dae | ", ...args)
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
Hooks.once('ready', async function () {
  if (!["dnd5e", "sw5e"].includes(game.system.id)) return;

  debug("ready setup actions")
  daeReadyActions();
  // setupDAEMacros();
  GMAction.readyActions();
  daeSpecialDurations =  {
    "None": "",
    "1Action": i18n("dae.1Action"),
    "1Attack": i18n("dae.1Attack"),
    "1Hit": i18n("dae.1Hit"),
    "turnStart": i18n("dae.turnStart"),
    "turnEnd": i18n("dae.turnEnd"),
    "isAttacked": i18n("dae.isAttacked"),
    "isDamaged": i18n("dae.isDamaged")
  }
  
  patchSpecialTraits();
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
    migrateItem: migrateItem,
    convertAllItems: migrateAllItems,
    migrateActorItems: migrateActorItems,
    migrateAllItems: migrateAllItems,
    migrateAllActors: migrateAllActors,
    fixupMonstersCompendium: fixupMonstersCompendium,
    fixupActors: fixupActors,
    removeActorEffects: removeActorEffects,
    fixupBonuses: fixupBonuses,
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
    migrateActorDAESRD: migrateActorDAESRD,
    migrateAllActorsDAESRD: migrateAllActorsDAESRD,
    migrateAllNPCDAESRD: migrateAllNPCDAESRD
    
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

export function confirmAction(toCheck: boolean, confirmFunction) {
  if (toCheck) {
    let d = new Dialog({
        // localize this text
        title: i18n("dae.confirm"),
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