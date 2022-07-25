import { DAEActiveEffectConfig } from "../apps/DAEActiveEffectConfig";
import { daeSystemClass } from "../dae";
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

  public static async editConfig() {
    if (game.system.id === "sw5e") {
      try {
        const pack = game.packs.get(CONFIG.DND5E.sourcePacks.ITEMS);
        const profs = [
          { type: "tool", list: this.toolProfList },
          { type: "armor", list: this.armorProfList },
          { type: "weapon", list: this.weaponProfList }
        ];
        for (let { type, list } of profs) {
          let choices = CONFIG.DND5E[`${type}Proficiencies`];
          const ids = CONFIG.DND5E[`${type}Ids`];
          if (ids !== undefined) {
            const typeProperty = (type !== "armor") ? `${type}Type` : `armor.type`;
            for (const [key, id] of Object.entries(ids)) {
              const item = game.dnd5e.applications.ProficiencySelector.getBaseItem(id, { indexOnly: true})
              // const item = await pack.getDocument(id);
              list[key] = item.name;
            }
          }
        }
        this.profInit = true;

      } catch (err) {
        console.warn("dae | Could not load weapon/armor/tool proficiencies", err);
        this.profInit = false;
      }
    }
  }
  public static configureLists(daeConfig: DAEActiveEffectConfig) {
    daeSystemClass.traitList = duplicate(CONFIG.SW5E.damageResistanceTypes);
    Object.keys(CONFIG.SW5E.damageResistanceTypes).forEach(type => {
      daeSystemClass.traitList[`-${type}`] = `-${CONFIG.SW5E.damageResistanceTypes[type]}`;
    });

    daeSystemClass.languageList = duplicate(CONFIG.SW5E.languages);
    Object.keys(CONFIG.SW5E.languages).forEach(type => {
      daeSystemClass.languageList[`-${type}`] = `-${CONFIG.SW5E.languages[type]}`;
    });

    daeSystemClass.conditionList = duplicate(CONFIG.SW5E.conditionTypes);
    Object.keys(CONFIG.SW5E.conditionTypes).forEach(type => {
      daeSystemClass.conditionList[`-${type}`] = `-${CONFIG.SW5E.conditionTypes[type]}`;
    });
    if (daeSystemClass.profInit) {
      daeSystemClass.toolProfList = daeSystemClass.toolProfList;
      daeSystemClass.armorProfList = daeSystemClass.armorProfList;
      daeSystemClass.weaponProfList = daeSystemClass.weaponProfList;
    } else {
      daeSystemClass.toolProfList = duplicate(CONFIG.SW5E.toolProficiencies);
      Object.keys(CONFIG.SW5E.toolProficiencies).forEach(type => {
        daeSystemClass.toolProfList[`-${type}`] = `-${CONFIG.SW5E.toolProficiencies[type]}`;
      });

      daeSystemClass.armorProfList = duplicate(CONFIG.SW5E.armorProficiencies);
      Object.keys(CONFIG.SW5E.armorProficiencies).forEach(type => {
        daeSystemClass.armorProfList[`-${type}`] = `-${CONFIG.SW5E.armorProficiencies[type]}`;
      });

      daeSystemClass.weaponProfList = duplicate(CONFIG.SW5E.weaponProficiencies);
      Object.keys(CONFIG.SW5E.weaponProficiencies).forEach(type => {
        daeSystemClass.weaponProfList[`-${type}`] = `-${CONFIG.SW5E.weaponProficiencies[type]}`;
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
    daeSystemClass.daeActionTypeKeys = daeSystemClass.daeActionTypeKeys.concat(Object.keys(CONFIG.SW5E.itemActionTypes));
    daeSystemClass.spellAttacks = daeSystemClass.spellAttacks.concat(["mpak", "rpak"])
  }

  public static initActions() {
    super.initActions();
  }

  // For DAE Config
}
if (!globalThis.daeSystems) globalThis.daeSystems = {};
setProperty(globalThis.daeSystems, "sw5e", DAESystemSW5E);

