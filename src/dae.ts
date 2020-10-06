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
import { daeSetupActions, doEffects, daeInitActions, ValidSpec} from "./module/dae";
import { daeReadyActions} from "./module/dae";
import { initSheetTab} from "./module/daeTab"
// import { ItemEffectSelector } from './module/apps/daeSelector';
import { GMAction, GMActionMessage } from './module/GMAction';
import { ActiveEffectChangeEditor } from './module/apps/ActiveEffectChangeEditor';
import { migrateItem, convertAllItems, migrateActorItems, migrateAllActors, removeActorEffects } from './module/migration';
import { ActorEffects } from './module/apps/ActorEffects';

export let setDebugLevel = (debugText: string) => {
  console.error("set debug level ", debugText)
  debugEnabled = {"none": 0, "warn": 1, "debug": 2, "all": 3}[debugText] || 0;
  // 0 = none, warnings = 1, debug = 2, all = 3
  CONFIG.debug.hooks = debugEnabled >= 3;
  console.error("Setting debugLevel to ", debugEnabled)
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
/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function() {
	// Register custom module settings
	registerSettings();
	console.log('dae | Initializing dae');
	daeInitActions();

	// Assign custom classes and constants here
	
	// Preload Handlebars templates
	await preloadTemplates();

	// Register custom sheets (if any)
});

Hooks.once('ready', async function () {
  daeReadyActions();
  GMAction.readyActions();
})
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function() {
	// Do anything after initialization but before
	// ready
	GMAction.initActions();
	daeSetupActions();
	ActiveEffectChangeEditor.setupActions();

	//@ts-ignore
	window.DAE = {
    dataSetup,
    ValidSpec,
    GMActionMessage,
    GMAction,
    doEffects,
    migrateItem: migrateItem,
    convertAllItems: convertAllItems,
    migrateActorItems: migrateActorItems,
    migrateAllActors: migrateAllActors,
    removeActorEffects: removeActorEffects,
    ActorEffects: ActorEffects
	}
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */

// Add any additional hooks if necessary

async function dataSetup() {
  //@ts-ignore
  const EFFECTMODES = ACTIVE_EFFECT_MODES;
  const EXAMPLE_TRANSFERRED_EFFECT = {
    label: "Werewolf Transformation",
    icon: "icons/All-Devin-Night-Tokens/M_Werewolf_02_hi.png",
    changes: [
      {key: "data.abilities.con.value", value: 18, mode: EFFECTMODES.UPGRADE},
      {key: "data.abilities.int.value", value: 6, mode: EFFECTMODES.DOWNGRADE},
      {key: "data.attributes.speed.value", value: "40 ft", mode: EFFECTMODES.OVERRIDE},
      {key: "data.traits.di.custom", value: "floogle", mode: EFFECTMODES.CUSTOM},
      {key: "data.traits.languages.value", value: "all", mode: EFFECTMODES.CUSTOM},
      {key: "data.attributes.ac.value", value: "2", mode: EFFECTMODES.ADD},
      {key: "data.abilities.con.mod", value: "@data.abilities.str.value", mode: EFFECTMODES.UPGRADE}
    ],
    transfer: true,
  };
  
  // This effect will remain in the Owned Item effects array
  const EXAMPLE_NONTRANSFERRED_EFFECT = {
    label: "Bleeding Damage",
    icon: "icons/svg/fear.svg",
    changes: [
      {key: "data.bonuses.mwak.damage", value: "+1d6", mode: EFFECTMODES.ADD},
    ],
    transfer: false
  };
  
  // Create a test item
  const item = await Item.create({
    name: "Lycanthropy",
    type: "weapon",
    flags: {dae: {activeEquipped: true, alwaysActive: false}}
  });
  
  // Assign the effects to the item
  await item.createEmbeddedEntity("ActiveEffect", [EXAMPLE_TRANSFERRED_EFFECT, EXAMPLE_NONTRANSFERRED_EFFECT]);
 
  let actor = game.actors.getName("Luthar");
  // Assign that item to an Actor
  // await actor.createEmbeddedEntity("OwnedItem", item.data);
  

}