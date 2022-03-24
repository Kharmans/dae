import { DAEActiveEffectConfig } from "../apps/DAEActiveEffectConfig";
import { DAESystemDND5E } from "./DAEdnd5e";
import { DAESystem, ValidSpec } from "./DAESystem";

//@ts-ignore
const CONFIG: any = globalThis.CONFIG;
export class DAESystemSW5E extends DAESystemDND5E {


  public static modifyBaseValues(actorType: string, baseValues: {}, characterSpec: any): void {
    super.modifyBaseValues(actorType, baseValues, characterSpec);
    let charFlagKeys = Object.keys(CONFIG.SW5E.characterFlags);
    charFlagKeys.forEach(key => {
      let theKey = `flags.sw5e.${key}`;
      if ([`flags.sw5e.weaponCriticalThreshold`,
      `flags.sw5e.powerCriticalThreshold`,
      `flags.sw5e.meleeCriticalDamageDice`,
      `flags.dnd5e.spellCriticalThreshold`].includes(theKey)) {
        delete baseValues[theKey];
      }
    });
  }

  public static modifySpecials(actorType: string, specials: {}, characterSpec: any): void {
    super.modifySpecials(actorType, specials, characterSpec);
    //@ts-ignore
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    specials["data.traits.sdi.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.sdi.value"] = ["", -1];
    specials["data.traits.sdi.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.sdr.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.sdr.value"] = ["", -1];
    specials["data.traits.sdr.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.sdv.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.sdv.value"] = ["", -1];
    specials["data.traits.sdv.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.attributes.powerForceLightDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.attributes.powerForceDarkDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.attributes.powerForceUnivDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.attributes.powerTechDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];

    // move all the characteer flags to specials so that the can be custom effects only
    let charFlagKeys = Object.keys(CONFIG.SW5E.characterFlags);
    charFlagKeys.forEach(key => {
      let theKey = `flags.sw5e.${key}`;
      if ([`flags.sw5e.weaponCriticalThreshold`,
      `flags.sw5e.powerCriticalThreshold`,
      `flags.sw5e.meleeCriticalDamageDice`,
      `flags.sw5e.spellCriticalThreshold`].includes(theKey)) {
        specials[theKey] = [0, -1];
      }
    });
  }

  public static configureLists(daeConfig: DAEActiveEffectConfig) {
    super.traitList = duplicate(CONFIG.SW5E.damageResistanceTypes);
    Object.keys(CONFIG.SW5E.damageResistanceTypes).forEach(type => {
      super.traitList[`-${type}`] = `-${CONFIG.SW5E.damageResistanceTypes[type]}`;
    });

    super.languageList = duplicate(CONFIG.SW5E.languages);
    Object.keys(CONFIG.SW5E.languages).forEach(type => {
      super.languageList[`-${type}`] = `-${CONFIG.SW5E.languages[type]}`;
    });

    super.conditionList = duplicate(CONFIG.SW5E.conditionTypes);
    Object.keys(CONFIG.SW5E.conditionTypes).forEach(type => {
      super.conditionList[`-${type}`] = `-${CONFIG.SW5E.conditionTypes[type]}`;
    });
    if (super.profInit) {
      super.toolProfList = super.toolProfList;
      super.armorProfList = super.armorProfList;
      super.weaponProfList = super.weaponProfList;
    } else {
      super.toolProfList = duplicate(CONFIG.SW5E.toolProficiencies);
      Object.keys(CONFIG.SW5E.toolProficiencies).forEach(type => {
        super.toolProfList[`-${type}`] = `-${CONFIG.SW5E.toolProficiencies[type]}`;
      });

      super.armorProfList = duplicate(CONFIG.SW5E.armorProficiencies);
      Object.keys(CONFIG.SW5E.armorProficiencies).forEach(type => {
        super.armorProfList[`-${type}`] = `-${CONFIG.SW5E.armorProficiencies[type]}`;
      });

      super.weaponProfList = duplicate(CONFIG.SW5E.weaponProficiencies);
      Object.keys(CONFIG.SW5E.weaponProficiencies).forEach(type => {
        super.weaponProfList[`-${type}`] = `-${CONFIG.SW5E.weaponProficiencies[type]}`;
      });
    }
  }

  public static getOptionsForSpec(spec: string): {} {
    if (spec.includes("data.skills") && spec.includes("ability")) 
        return CONFIG.SW5E.abilities;
    return super.getOptionsForSpec(spec);
  }
  public static initSystemData() {
    super.initSystemData();
    super.daeActionTypeKeys = super.ActionTypeKeys.concat(Object.keys(CONFIG.SW5E.itemActionTypes));
    super.spellAttacks = super.spellAttacks.concat(["mpak", "rpak"])
  }

  public static initActions() {
    super.initActions();
  }

  // For DAE Config
}
if (!globalThis.daeSystems) globalThis.daeSystems = {};
setProperty(globalThis.daeSystems, "sw5e", DAESystemSW5E);