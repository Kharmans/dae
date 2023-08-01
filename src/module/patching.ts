import { itemacroActive, libWrapper, replaceFormulaData } from "./dae";
//@ts-ignore
import { debug, log, error, warn, } from "../dae";

export function patchingInitSetup() {
  return;
}

/* just in case it is needed
* Added a new setting "Patch CE Custom Effects" which will correct the anomolous behaviour of duplictaed effects sometimes have a startTime/startRound/startTurn set which means they will not be updated when applied to an Actor. It can be enabled/disabled from the DAE settings tab.
  - This will fix newly created/duplicated custom effects, but not existing ones which have an embedded startTime/round/turn in them - you can either edit your custom effects or run this macro which will do them all (as a GM) just once.
  ```js
  if (game.dfreds?.effects 
    && game.settings.get("dfreds-convenient-effects", "customEffectsItemId")) {
     const CEItem = game.items.get(game.settings.get("dfreds-convenient-effects", "customEffectsItemId"))
        changedEffects = Array(...CEItem.effects).map(effect => {
            let changedEffect = effect.toObject();
            changedEffect.duration.startTime = null;
            changedEffect.duration.startTurn = null;
            changedEffect.duration.startRound = null;
            return changedEffect;
        })
    await CEItem.updateEmbeddedDocuments("ActiveEffect", changedEffects);
}
  ```
  */
export function initPatching() {
  return; // disabled for now
  if (game.settings.get("dae", "patchCustom")) {
    if (game.dfreds?.statusEffects?._effectsHelper.createActiveEffect) {
      console.warn("dae | patching Convenient Effects createActiveEffect")
      libWrapper.register("dae", "game.dfreds.statusEffects._effectsHelper.constructor.prototype.createActiveEffect", fixedCreateActiveEffect, "WRAPPER");
    };
  }
}

export function setupPatching() {
  // patchAbilitySave(); removed in 0.8.74
  log("Patching Roll.replaceFormulaData");
  libWrapper.register("dae", "Roll.replaceFormulaData", replaceFormulaData, "MIXED");
  log("Patching ActiveEffect.isTemporary");
  libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.isTemporary", isTemporary, "WRAPPER")
};

function fixedCreateActiveEffect(wrapped, data: any) {
  const effect = wrapped(data);
  effect.duration.startTime = null;
  effect.duration.startRound = null;
  effect.duration.startTurn = null;
  effect.updateSource({ "duration": effect.duration });
  return effect;
}
function isTemporary(wrapped) {
  //@ts-ignore
  // if (this.parent instanceof CONFIG.Actor.documentClass && this.data.flags?.dae?.transfer) return false;
  this._prepareDuration();
  return wrapped() || this.flags?.dae?.showIcon;
}
