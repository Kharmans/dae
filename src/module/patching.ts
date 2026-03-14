import { libWrapper, replaceFormulaData } from "./dae.js";
import { log } from "../dae.js";

export function initPatching() {
  log("Patching Roll.replaceFormulaData");
  libWrapper.register("dae", "Roll.replaceFormulaData", replaceFormulaData, "MIXED");
}

export function setupPatching() {
}
