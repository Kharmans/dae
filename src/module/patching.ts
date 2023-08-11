import { itemacroActive, libWrapper, replaceFormulaData } from "./dae";
//@ts-ignore
import { debug, log, error, warn, } from "../dae";

export function patchingInitSetup() {
  return;
}

export function initPatching() {
}

export function setupPatching() {
  // patchAbilitySave(); removed in 0.8.74
  log("Patching Roll.replaceFormulaData");
  libWrapper.register("dae", "Roll.replaceFormulaData", replaceFormulaData, "MIXED");
  log("Patching ActiveEffect.isTemporary");
  libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.isTemporary", isTemporary, "WRAPPER")
};
function isTemporary(wrapped) {
  //@ts-ignore
  // if (this.parent instanceof CONFIG.Actor.documentClass && this.data.flags?.dae?.transfer) return false;
  this._prepareDuration();
  return wrapped() || this.flags?.dae?.showIcon;
}
