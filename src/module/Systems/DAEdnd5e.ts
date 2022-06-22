import { daeSpecialDurations, debug, error, i18n, log, warn } from "../../dae";
import { DAEActiveEffectConfig } from "../apps/DAEActiveEffectConfig";
import { applyDaeEffects, DAEfromUuid, daeSystemClass, fetchParams, libWrapper, noDupDamageMacro } from "../dae";
import { cleanArmorWorld, cleanDAEArmorWorld } from "../migration";
import { applyBaseActiveEffects, ValidSpec } from "./DAESystem";

var displayTraits;
var specialTraitsPatched = false;
var d20Roll;
var dice;
// @ts-ignore
const CONFIG: any = globalThis.CONFIG;

export class DAESystemDND5E extends CONFIG.DAE.systemClass {
  traitList;
  languageList;
  conditionList;
  static profInit;
  static toolProfList;
  static armorProfList;
  static weaponProfList;


  public static modifyBaseValues(actorType: string, baseValues: {}, characterSpec: any): void {
    super.modifyBaseValues(actorType, baseValues, characterSpec);
    baseValues["data.attributes.prof"] = 0;
    baseValues["data.details.level"] = 0;
    baseValues["data.attributes.ac.bonus"] = 0;
    baseValues["data.attributes.ac.base"] = 0;
    baseValues["data.attributes.ac.cover"] = 0;
    if (characterSpec.data.bonuses) {
      // data.attributes.prof/data.details.level and data.attributes.hd are all calced in prepareBaseData
      baseValues["data.bonuses.All-Attacks"] = "";
      baseValues["data.bonuses.weapon.attack"] = "";
      baseValues["data.bonuses.spell.attack"] = "";
      baseValues["data.bonuses.All-Damage"] = "";
      baseValues["data.bonuses.weapon.damage"] = "";
      baseValues["data.bonuses.spell.damage"] = "";
      // These are for item action types - works by accident.
      baseValues["data.bonuses.heal.damage"] = "";
      baseValues["data.bonuses.heal.attack"] = "";
      baseValues["data.bonuses.save.damage"] = "";
      baseValues["data.bonuses.check.damage"] = "";
      baseValues["data.bonuses.abil.damage"] = "";
      baseValues["data.bonuses.other.damage"] = "";
      baseValues["data.bonuses.util.damage"] = "";
    }
    // move all the characteer flags to specials so that the can be custom effects only
    let charFlagKeys = (game.system.id === "dnd5e") ? Object.keys(CONFIG.DND5E.characterFlags) : Object.keys(CONFIG.SW5E.characterFlags);
    charFlagKeys.forEach(key => {
      let theKey = `flags.${game.system.id}.${key}`;
      if ([`flags.${game.system.id}.weaponCriticalThreshold`,
      `flags.${game.system.id}.meleeCriticalDamageDice`,
      `flags.${game.system.id}.spellCriticalThreshold`].includes(theKey)) {
        delete baseValues[theKey];
      }
      else baseValues[theKey] = false;
    });
    if (game.modules.get("skill-customization-5e")?.active && game.system.id === "dnd5e") {
      Object.keys(CONFIG.DND5E.skills).forEach(skl => {
        baseValues[`flags.skill-customization-5e.${skl}.skill-bonus`] = "";
      })
    }

    //TODO work out how to evaluate this to a number in prepare data - it looks like this is wrong
    if (characterSpec.data.bonuses) baseValues["data.bonuses.spell.dc"] = 0;
    Object.keys(baseValues).forEach(key => {
      // can't modify many spell details.
      if (key.includes("data.spells")) {
        delete baseValues[key];
      }
      if (key.includes("data.spells") && key.includes("override")) {
        baseValues[key] = 0;
      }
    });

    delete baseValues["data.attributes.init.total"];
    delete baseValues["data.attributes.init.mod"];
    delete baseValues["data.attributes.init.bonus"]
    delete baseValues["flags"];
  }

  public static modifySpecials(actorType: string, specials: {}, characterSpec: any): void {
    super.modifySpecials(actorType, specials, characterSpec);

    //@ts-ignore
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    if (actorType === "vehicle") {
      specials["data.attributes.ac.motionless"] = [0, -1];
      specials["data.attributes.ac.flat"] = [0, -1];
    } else {
      specials["data.attributes.ac.value"] = [0, -1];
      specials["data.attributes.ac.min"] = [0, -1];
    }
    specials["data.attributes.hp.max"] = [0, -1];
    specials["data.attributes.hp.tempmax"] = [0, -1];
    specials["data.attributes.hp.min"] = [0, -1];
    specials["data.attributes.init.total"] = [0, -1];
    specials["data.attributes.init.bonus"] = [0, -1];
    for (let abl of Object.keys(CONFIG.DND5E.abilities)) {
      specials["data.abilities.${abl}.dc"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
    }
    specials["data.attributes.encumbrance.max"] = [0, -1];
    specials["data.traits.di.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.di.value"] = ["", -1];
    specials["data.traits.di.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.dr.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.dr.value"] = ["", -1];
    specials["data.traits.dr.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.dv.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.dv.value"] = ["", -1];
    specials["data.traits.dv.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.ci.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.ci.value"] = ["", -1];
    specials["data.traits.ci.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.traits.size"] = ["", ACTIVE_EFFECT_MODES.OVERRIDE];
    specials["data.spells.pact.level"] = [0, -1];
    specials["flags.dae"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.attributes.movement.all"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.attributes.movement.hover"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
    specials["data.attributes.ac.EC"] = [0, -1];
    specials["data.attributes.ac.AR"] = [0, -1];

    if (characterSpec.data.attributes.hd) specials["data.attributes.hd"] = [0, -1];
    if (characterSpec.data.traits.weaponProf) {
      specials["data.traits.weaponProf.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
      specials["data.traits.weaponProf.value"] = ["", -1];
      specials["data.traits.weaponProf.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    }
    if (characterSpec.data.traits.languages) {
      specials["data.traits.languages.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
      specials["data.traits.languages.value"] = ["", -1];
      specials["data.traits.languages.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    }
    if (characterSpec.data.traits.armorProf) {
      specials["data.traits.armorProf.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
      specials["data.traits.armorProf.value"] = ["", -1];
      specials["data.traits.armorProf.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    }
    if (characterSpec.data.traits.toolProf) {
      specials["data.traits.toolProf.all"] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
      specials["data.traits.toolProf.value"] = ["", -1];
      specials["data.traits.toolProf.custom"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    }
    if (characterSpec.data.resources) {
      specials["data.resources.primary.max"] = [0, -1];
      specials["data.resources.primary.label"] = ["", ACTIVE_EFFECT_MODES.OVERRIDE];
      specials["data.resources.secondary.max"] = [0, -1];
      specials["data.resources.secondary.label"] = ["", ACTIVE_EFFECT_MODES.OVERRIDE];
      specials["data.resources.tertiary.max"] = [0, -1];
      specials["data.resources.tertiary.label"] = ["", ACTIVE_EFFECT_MODES.OVERRIDE];
      specials["data.resources.legact.max"] = [0, -1];
      specials["data.resources.legres.max"] = [0, -1];

      if (game.modules.get("resourcesplus")?.active) {
        for (let res of ["fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]) {
          specials[`data.resources.${res}.max`] = [0, -1];
          specials[`data.resources.${res}.label`] = ["", ACTIVE_EFFECT_MODES.OVERRIDE];
        }
      }
      /*/
      if (game.modules.get("resourcesplus")?.active) {
        const maxResources = Math.min(game.settings.get("resourcesplus", "globalLimit"), game.settings.get("resourcesplus", "localLimit"));
        if (maxResources > 3)  {
          const resourceLabels =  ["fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
          for (let i = 0; i < maxResources - 3; i++) {
          specials[`data.resources.${resourceLabels[i]}.max`] = [0, -1];
          specials[`data.resources.${resourceLabels[i]}.label`] = ["", ACTIVE_EFFECT_MODES.OVERRIDE];
          }
        }
      }
      /*/
    }

    specials[`flags.${game.system.id}.initiativeHalfProf`] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
    specials[`flags.${game.system.id}.DamageBonusMacro`] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials[`flags.${game.system.id}.initiativeDisadv`] = [false, ACTIVE_EFFECT_MODES.CUSTOM];

    if (game.modules.get("tidy5e-sheet")?.active)
      specials["data.details.maxPreparedSpells"] = [0, -1];
    // change movement effects to be after prepareDerivedData
    for (let key of Object.keys(CONFIG.DND5E.movementTypes)) {
      specials[`data.attributes.movement.${key}`] = [0, -1];
    }

    // move all the characteer flags to specials so that the can be custom effects only
    let charFlagKeys = Object.keys(CONFIG.DND5E?.characterFlags ?? {});
    charFlagKeys.forEach(key => {
      let theKey = `flags.${game.system.id}.${key}`;
      if ([`flags.${game.system.id}.weaponCriticalThreshold`,
      `flags.${game.system.id}.powerCriticalThreshold`,
      `flags.${game.system.id}.meleeCriticalDamageDice`,
      `flags.${game.system.id}.spellCriticalThreshold`].includes(theKey)) {
        specials[theKey] = [0, -1];
      }
    });
  }

  public static modifyDerivedSpecs(actorType: string, derivedSpecs: ValidSpec[], characterSpec: any): void {
    super.modifyDerivedSpecs(actorType, derivedSpecs, characterSpec);
    // Do the system specific part
    // 1. abilities add mod and save to each;
    if (characterSpec.data.abilities) Object.keys(characterSpec.data.abilities).forEach(ablKey => {
      let abl = characterSpec.data.abilities[ablKey];
      derivedSpecs.push(new ValidSpec(`data.abilities.${ablKey}.mod`, 0))
      derivedSpecs.push(new ValidSpec(`data.abilities.${ablKey}.save`, 0))
      derivedSpecs.push(new ValidSpec(`data.abilities.${ablKey}.min`, 0))
    })
    // adjust specs for bonuses - these are strings, @fields are looked up but dice are not rolled.

    // Skills add mod, passive and bonus fields
    if (characterSpec.data.skills) Object.keys(characterSpec.data.skills).forEach(sklKey => {
      let skl = characterSpec.data.skills[sklKey];
      derivedSpecs.push(new ValidSpec(`data.skills.${sklKey}.mod`, 0))
      derivedSpecs.push(new ValidSpec(`data.skills.${sklKey}.passive`, 0))
    })
  }

  static modifyValidSpec(spec, validSpec: ValidSpec): ValidSpec {
    //@ts-ignore
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    // TODO move this into a system specfic bit of code.
    if (spec.includes("data.skills") && spec.includes("ability")) {
      validSpec.forcedMode = ACTIVE_EFFECT_MODES.OVERRIDE;
    }

    if (spec.includes("data.bonuses.abilities")) {
      validSpec.forcedMode = -1;
    }
    return validSpec;
  }
  // Any actions to be called on init Hook 
  public static initActions() {
    warn("system is ", game.system)
    dice = game[game.system.id].dice
    if (!dice) error("Dice not defined! Many things won't work")
    else d20Roll = dice?.d20Roll;
    game.settings.register("dae", "displayTraits", {
      scope: "world",
      default: false,
      config: true,
      type: Boolean,
      onChange: fetchParams,
      name: game.i18n.localize("dae.displayTraits.Name"),
      hint: game.i18n.localize("dae.displayTraits.Hint"),
    });

    // We will call this in prepareData
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", applyBaseActiveEffects, "OVERRIDE");
    // Add flags to roll data so they can be referenced in effects
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.getRollData", getRollData, "WRAPPER");
    // Overide prepareData so it can add the extra pass
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.prepareData", prepareData, "WRAPPER");
    // Fix for dnd5e broken determine suppression (does not work for unlinked actors) + support condition immunity
    libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.determineSuppression", determineSuppression, "OVERRIDE");

    // This supplies DAE custom effects - the main game
    Hooks.on("applyActiveEffect", this.daeCustomEffect.bind(this));
  }
  public static setupActions(): void {
  }
  
  public static readyActions(): void {
    // checkArmorDisabled();
    // Modify armor attribution for DAE specific cases
    patchPrepareArmorClassAttribution();

    Hooks.on("dae.settingsChanged", () => {
      patchSpecialTraits();
    });
    patchSpecialTraits();

    if (game.modules.get("midi-qol")?.active) {
      daeSpecialDurations["1Action"] = i18n("dae.1Action");
      daeSpecialDurations["1Spell"] = i18n("dae.1Spell");
      //@ts-ignore
      daeSpecialDurations["1Attack"] = game.i18n.format("dae.1Attack", { type: `${i18n("dae.spell")}/${i18n("dae.weapon")} ${i18n("dae.attack")}` });
      daeSpecialDurations["1Hit"] = game.i18n.format("dae.1Hit", { type: `${i18n("dae.spell")}/${i18n("dae.weapon")}` });
      //    daeSpecialDurations["1Hit"] = i18n("dae.1Hit");
      daeSpecialDurations["1Reaction"] = i18n("dae.1Reaction")
      let attackTypes = ["mwak", "rwak", "msak", "rsak"];
      if (game.system.id === "sw5e") attackTypes = ["mwak", "rwak", "mpak", "rpak"];
      attackTypes.forEach(at => {
        //@ts-ignore
        daeSpecialDurations[`1Attack:${at}`] = `${CONFIG.DND5E.itemActionTypes[at]}: ${game.i18n.format("dae.1Attack", { type: CONFIG.DND5E.itemActionTypes[at] })}`;
        daeSpecialDurations[`1Hit:${at}`] = `${CONFIG.DND5E.itemActionTypes[at]}: ${game.i18n.format("dae.1Hit", { type: CONFIG.DND5E.itemActionTypes[at] })}`;
      })
      daeSpecialDurations["DamageDealt"] = i18n("dae.DamageDealt");
      daeSpecialDurations["isAttacked"] = i18n("dae.isAttacked");
      daeSpecialDurations["isDamaged"] = i18n("dae.isDamaged");
      daeSpecialDurations["zeroHP"] = i18n("dae.ZeroHP");
      daeSpecialDurations["isHit"] = i18n("dae.isHit");
      daeSpecialDurations["isSave"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}`;
      daeSpecialDurations["isSaveSuccess"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}: ${i18n("dae.success")}`;
      daeSpecialDurations["isSaveFailure"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}: ${i18n("dae.failure")}`;
      daeSpecialDurations["isCheck"] = `${i18n("dae.isRollBase")} ${i18n("dae.isCheckDetail")}`;
      daeSpecialDurations["isSkill"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSkillDetail")}`;
      daeSpecialDurations["isMoved"] = i18n("dae.isMoved");
      daeSpecialDurations["longRest"] = i18n("DND5E.LongRest");
      daeSpecialDurations["shortRest"] = i18n("DND5E.ShortRest");
      daeSpecialDurations["newDay"] = `${i18n("DND5E.NewDay")}`;
      Object.keys(CONFIG.DND5E.abilities).forEach(abl => {
        daeSpecialDurations[`isSave.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isSaveDetail")}`;
        daeSpecialDurations[`isSaveSuccess.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isSaveDetail")}: ${i18n("dae.success")}`;
        daeSpecialDurations[`isSaveFailure.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isSaveDetail")}: ${i18n("dae.failure")}`;
        daeSpecialDurations[`isCheck.${abl}`] = `${i18n("dae.isRollBase")} ${CONFIG.DND5E.abilities[abl]} ${i18n("dae.isCheckDetail")}`;
      })
      Object.keys(CONFIG.DND5E.damageTypes).forEach(dt => {
        daeSpecialDurations[`isDamaged.${dt}`] = `${i18n("dae.isDamaged")}: ${CONFIG.DND5E.damageTypes[dt]}`;
      });
      Object.keys(CONFIG.DND5E.skills).forEach(skillId => {
        daeSpecialDurations[`isSkill.${skillId}`] = `${i18n("dae.isRollBase")} ${i18n("dae.isSkillDetail")} ${CONFIG.DND5E.skills[skillId]}`;
      });
    }
    Hooks.on("updateItem", updateItem); // deal with disabling effects for unequipped items
  }

  public static initSystemData() {
    // Setup attack types and expansion change mappings
    this.spellAttacks = ["msak", "rsak"];
    this.weaponAttacks = ["mwak", "rwak"];
    this.attackTypes = this.weaponAttacks.concat(this.spellAttacks);
    this.bonusSelectors = {
      "data.bonuses.All-Attacks": { attacks: this.attackTypes, selector: "attack" },
      "data.bonuses.weapon.attack": { attacks: this.weaponAttacks, selector: "attack" },
      "data.bonuses.spell.attack": { attacks: this.spellAttacks, selector: "attack" },
      "data.bonuses.All-Damage": { attacks: this.attackTypes, selector: "damage" },
      "data.bonuses.weapon.damage": { attacks: this.weaponAttacks, selector: "damage" },
      "data.bonuses.spell.damage": { attacks: this.spellAttacks, selector: "damage" }
    };
    daeSystemClass.daeActionTypeKeys = Object.keys(CONFIG.DND5E.itemActionTypes);
  }

  public static effectDisabled(actor, effect, itemData = null) {
    effect.determineSuppression();
    const disabled = effect.data.disabled || effect.isSuppressed;
    return disabled;
  }

  // For DAE Editor
  public static configureLists(daeConfig: DAEActiveEffectConfig) {
    this.traitList = duplicate(CONFIG.DND5E.damageResistanceTypes);
    this.traitList = mergeObject(this.traitList, CONFIG.DND5E.healingTypes);
    Object.keys(this.traitList).forEach(type => {
      this.traitList[`-${type}`] = `-${CONFIG.DND5E.damageResistanceTypes[type]}`;
    });

    this.languageList = duplicate(CONFIG.DND5E.languages);
    Object.keys(CONFIG.DND5E.languages).forEach(type => {
      this.languageList[`-${type}`] = `-${CONFIG.DND5E.languages[type]}`;
    });

    this.conditionList = duplicate(CONFIG.DND5E.conditionTypes);
    Object.keys(CONFIG.DND5E.conditionTypes).forEach(type => {
      this.conditionList[`-${type}`] = `-${CONFIG.DND5E.conditionTypes[type]}`;
    });
    if (this.profInit) {
      this.toolProfList = this.toolProfList;
      this.armorProfList = this.armorProfList;
      this.weaponProfList = this.weaponProfList;
    } else {
      this.toolProfList = duplicate(CONFIG.DND5E.toolProficiencies);
      Object.keys(CONFIG.DND5E.toolProficiencies).forEach(type => {
        this.toolProfList[`-${type}`] = `-${CONFIG.DND5E.toolProficiencies[type]}`;
      });

      this.armorProfList = duplicate(CONFIG.DND5E.armorProficiencies);
      Object.keys(CONFIG.DND5E.armorProficiencies).forEach(type => {
        this.armorProfList[`-${type}`] = `-${CONFIG.DND5E.armorProficiencies[type]}`;
      });

      this.weaponProfList = duplicate(CONFIG.DND5E.weaponProficiencies);
      Object.keys(CONFIG.DND5E.weaponProficiencies).forEach(type => {
        this.weaponProfList[`-${type}`] = `-${CONFIG.DND5E.weaponProficiencies[type]}`;
      });
    }
  }
  public static getOptionsForSpec(spec) {
    if (spec === "data.traits.languages.value")
      return this.languageList;
    if (spec === "data.traits.ci.value")
      return this.conditionList;
    if (spec === "data.traits.toolProf.value")
      return this.toolProfList;
    if (spec === "data.traits.armorProf.value")
      return this.armorProfList;
    if (spec === "data.traits.weaponProf.value")
      return this.weaponProfList;
    if (["data.traits.di.value", "data.traits.dr.value", "data.traits.dv.value"].includes(spec))
      return this.traitList;
    if (spec.includes("data.skills") && spec.includes("value"))
      return { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" };
    if (spec.includes("data.skills") && spec.includes("ability")) {
      if (game.system.id === "dnd5e")
        return CONFIG.DND5E.abilities;
    }
    if (spec === "data.traits.size") return CONFIG.DND5E?.actorSizes;
    return super.getOptionsForSpec(spec);
  }

  public static async editConfig() {
    if (game.system.id === "dnd5e") {
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
              const item = await pack.getDocument(id);
              list[key] = item.name;
            }
          }
        }
        this.profInit = true;

      } catch (err) {
        this.profInit = false;
      }
    }
  }

  // Special case handling of (expr)dX
  public static attackDamageBonusEval(bonusString, actor) {
    return bonusString;
    if (typeof bonusString === "string") {
      const special = bonusString.match(/\((.+)\)\s*d([0-9]+)(.*)/);
      // const special = bonusString.match(/\(([\s\S]+)\)\s+d([0-9]*)\)([\s\S]+)/);
      if (special && special.length >= 3) {
        try {
          return new Roll(special[1].replace(/ /g, ""), actor.getRollData()).roll().total + "d" + special[2] + (special[3] ?? "");
        }
        catch (err) {
          console?.warn(`DAE eval error for: ${special[1].replace(/ /g, "")} in actor ${actor.name}`, err);
          return bonusString;
        }
      }
    }
    return `${bonusString || ""}`;
  }

  /*
   * do custom effefct applications
   * damage resistance/immunity/vulnerabilities
   * languages
   */
  public static daeCustomEffect(actor, change) {
    const current = getProperty(actor.data, change.key);
    var validValues;
    var value;
    if (typeof change?.key !== "string") return true;
    const damageBonusMacroFlag = `flags.${game.system.id}.DamageBonusMacro`;
    if (change.key === damageBonusMacroFlag) {
      let current = getProperty(actor.data, change.key);
      // includes wont work for macro names that are subsets of other macro names
      if (noDupDamageMacro && current?.split(",").some(macro => macro === change.value)) return true;
      setProperty(actor.data, change.key, current ? `${current},${change.value}` : change.value)
      return true;
    }
    if (change.key.includes(`flags.${game.system.id}`)) {
      //@ts-ignore safeEval
      const value = new Boolean(Roll.safeEval(change.value)); // ["1", "true", 1, true].includes(change.value);
      setProperty(actor.data, change.key, value);
      return true;
    }

    if (change.key.startsWith("data.skills.") && change.key.endsWith(".value")) {
      const currentProf = getProperty(actor.data, change.key) || 0;
      const profValues = { "0.5": 0.5, "1": 1, "2": 2 };
      const upgrade = profValues[change.value]
      if (upgrade === undefined) return;
      let newProf = currentProf + upgrade;
      if (newProf > 1 && newProf < 2) newProf = 1;
      if (newProf > 2) newProf = 2;
      return setProperty(actor.data, change.key, newProf);
    }

    /*
    if (change.key.startsWith("items.")) {
      let originalKey = duplicate(change.key);
      const fields = change.key.split("."); // items.data.contents.index......
      const index = fields[2];
      const itemKey = fields.slice(3).join(".")
      const item = actor.data.items.contents[index];
      let value = getProperty(item, itemKey);
      if (value === undefined) value = change.value;
      else if (value instanceof Array) {
        const newEntry = eval(change.value)
        value = value.concat([newEntry]);
      } else if (typeof value === "string") value = `${value} + ${change.value}`;
      //@ts-ignore
      else if (typeof value === "boolean") value = Roll.safeEval(change.value);
      //@ts-ignore
      else value = Roll.safeEval(value + change.value);
      setProperty(item, itemKey, value)
      return true;
    }
    */
    switch (change.key) {
      case "data.attributes.movement.hover":
        setProperty(actor.data, change.key, change.value ? true : false);
        return true;
      case "data.traits.di.all":
      case "data.traits.dr.all":
      case "data.traits.dv.all":
      case "data.traits.sdi.all":
      case "data.traits.sdr.all":
      case "data.traits.sdv.all":
        const key = change.key.replace(".all", ".value")
        if (game.system.id === "dnd5e")
          setProperty(actor.data, key, Object.keys(CONFIG.DND5E.damageResistanceTypes).filter(k => !["healing", "temphp"].includes(k)));
        else
          setProperty(actor.data, key, Object.keys(CONFIG.DND5E.damageResistanceTypes).filter(k => !["healing", "temphp"].includes(k)));
        return true;
      case "data.traits.di.value":
      case "data.traits.dr.value":
      case "data.traits.dv.value":
      case "data.traits.sdi.value":
      case "data.traits.sdr.value":
      case "data.traits.sdv.value":
        if (game.system.id === "dnd5e")
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.damageResistanceTypes));
        else
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.damageResistanceTypes));
      case "data.traits.di.custom":
      case "data.traits.dr.custom":
      case "data.traits.dv.custom":
      case "data.traits.sdi.custom":
      case "data.traits.sdr.custom":
      case "data.traits.sdv.custom":
      case "data.traits.ci.custom":
      case "data.traits.languages.custom":
      case "data.traits.toolProf.custom":
      case "data.traits.armorProf.custom":
      case "data.traits.weaponProf.custom":
        value = (current ?? "").length > 0 ? current.trim().split(";").map(s => s.trim()) : [];
        const setValue = new Set(value);
        setValue.add(change.value);
        value = Array.from(setValue).join("; ");
        setProperty(actor.data, change.key, value)
        return true;
      case "data.traits.languages.all":
        if (game.system.id === "dnd5e")
          setProperty(actor.data, "data.traits.languages.value", Object.keys(CONFIG.DND5E.languages))
        else
          setProperty(actor.data, "data.traits.languages.value", Object.keys(CONFIG.SW5E.languages))
        return true;
      case "data.traits.languages.value":
        if (game.system.id === "dnd5e")
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.languages));
        else
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.languages));
      case "data.traits.ci.all":
        if (game.system.id === "dnd5e")
          setProperty(actor.data, "data.traits.ci.value", Object.keys(CONFIG.DND5E.conditionTypes))
        else
          setProperty(actor.data, "data.traits.ci.value", Object.keys(CONFIG.SW5E.conditionTypes))
        return true;
      case "data.traits.ci.value":
        if (game.system.id === "dnd5e")
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.conditionTypes))
        else
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.conditionTypes))
      case "data.traits.toolProf.value":
        if (game.system.id === "dnd5e")
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.toolProficiencies))
        else
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.toolProficiencies))
      case "data.traits.toolProf.all":
        if (game.system.id === "dnd5e")
          setProperty(actor.data, "data.traits.toolProf.value", Object.keys(CONFIG.DND5E.toolProficiencies))
        else
          setProperty(actor.data, "data.traits.toolProf.value", Object.keys(CONFIG.SW5E.toolProficiencies))
        return true;
      case "data.traits.armorProf.value":
        if (game.system.id === "dnd5e")
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.armorProficiencies))
        else
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.armorProficiencies))
      case "data.traits.armorProf.all":
        if (game.system.id === "dnd5e")
          setProperty(actor.data, "data.traits.armorProf.value", Object.keys(CONFIG.DND5E.armorProficiencies))
        else
          setProperty(actor.data, "data.traits.armorProf.value", Object.keys(CONFIG.SW5E.armorProficiencies))
        return true;
      case "data.traits.weaponProf.value":
        if (game.system.id === "dnd5e")
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.weaponProficiencies))
        else
          return super.doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.weaponProficiencies))
      case "data.traits.weaponProf.all":
        if (game.system.id === "dnd5e")
          setProperty(actor.data, "data.traits.weaponProf.value", Object.keys(CONFIG.DND5E.weaponProficiencies))
        else
          setProperty(actor.data, "data.traits.weaponProf.value", Object.keys(CONFIG.SW5E.weaponProficiencies))
        return true;
      case "data.bonuses.weapon.damage":
        value = this.attackDamageBonusEval(change.value, actor)
        if (current)
          value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
        this.weaponAttacks.forEach(atType => actor.data.data.bonuses[atType].damage += value);
        return true;
      case "data.bonuses.spell.damage":
        value = this.attackDamageBonusEval(change.value, actor)
        if (current)
          value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
        this.spellAttacks.forEach(atType => actor.data.data.bonuses[atType].damage += value);
        return true;
      case "data.bonuses.mwak.attack":
      case "data.bonuses.mwak.damage":
      case "data.bonuses.rwak.attack":
      case "data.bonuses.rwak.damage":
      case "data.bonuses.msak.attack":
      case "data.bonuses.msak.damage":
      case "data.bonuses.mpak.attack":
      case "data.bonuses.mpak.damage":
      case "data.bonuses.rpak.attack":
      case "data.bonuses.rpak.damage":
      case "data.bonuses.rsak.attack":
      case "data.bonuses.rsak.damage":
      case "data.bonuses.heal.attack":
      case "data.bonuses.heal.damage":
      case "data.bonuses.abilities.save":
      case "data.bonuses.abilities.check":
      case "data.bonuses.abilities.skill":
      case "data.bonuses.power.forceLightDC":
      case "data.bonuses.power.forceDarkDC":
      case "data.bonuses.power.forceUnivDC":
      case "data.bonuses.power.techDC":
        // TODO: remove if fixed in core
        let result = this.attackDamageBonusEval(change.value, actor);
        value = result;
        if (current)
          value = (result.startsWith("+") || result.startsWith("-")) ? result : "+" + result;
        setProperty(actor.data, change.key, (current || "") + value);
        return true;

      case "data.attributes.movement.all":
        const movement = actor.data.data.attributes.movement;
        let op = "";
        if (typeof change.value === "string") {
          change.value = change.value.trim();
          if (["+", "-", "/", "*"].includes(change.value[0])) {
            op = change.value[0];
          }
        }
        for (let key of Object.keys(movement)) {
          if (["units", "hover"].includes(key)) continue;
          let valueString = change.value;
          if (op !== "") {
            //@ts-ignore isNumeric
            if (!movement[key]) continue;
            valueString = `${movement[key]} ${change.value}`;
          }
          try {
            //@ts-ignore
            let result = (new Roll(valueString, actor.getRollData())).evaluate({ async: false }).total
            movement[key] = Math.floor(Math.max(0, result) + 0.5);
          } catch (err) {
            console.warn(`dae | Error evaluating custom movement.all = ${valueString}`, key, err)
          }
        };
        return true;

      //TODO review this for 1.5
      case "data.abilities.str.dc":
      case "data.abilities.dex.dc":
      case "data.abilities.int.dc":
      case "data.abilities.wis.dc":
      case "data.abilities.cha.dc":
      case "data.abilities.con.dc":
      case "data.bonuses.spell.dc":
      case "data.attributes.powerForceLightDC":
      case "data.attributes.powerForceDarkDC":
      case "data.attributes.powerForceUnivDC":
      case "data.attributes.powerTechDC":
        //@ts-ignore
        if (Number.isNumeric(change.value)) {
          value = parseInt(change.value);
        } else {
          try {
            //@ts-ignore
            value = (new Roll(change.value, actor.getRollData())).evaluate({ async: false }).total;
          } catch (err) { };
        }
        if (value !== undefined) {
          setProperty(actor.data, change.key, Number(current) + value);
        } else return;

        // Spellcasting DC
        const ad = actor.data.data;
        const spellcastingAbility = ad.abilities[ad.attributes.spellcasting];
        ad.attributes.spelldc = spellcastingAbility ? spellcastingAbility.dc : 8 + ad.attributes.prof;

        if (actor.items) {
          actor.items.forEach(item => {
            item.getSaveDC();
            item.getAttackToHit();
          });
        };
        return true;

      case "flags.dae":
        let list = change.value.split(" ");
        const flagName = list[0];
        let formula = list.splice(1).join(" ")
        const rollData = actor.getRollData();
        const flagValue = getProperty(rollData.flags, `dae.${flagName}`) || 0;
        // ensure the flag is not undefined when doing the roll, supports flagName @flags.dae.flagName + 1
        setProperty(rollData, `flags.dae.${flagName}`, flagValue);
        //@ts-ignore evaluate TODO work out async
        value = new Roll(formula, rollData).evaluate({ async: false }).total;
        setProperty(actor.data, `flags.dae.${flagName}`, value);
        return true;
    }
  }


}

function getRollData(wrapped) {
  const data = wrapped();
  data.flags = this.data.flags;
  return data;
}

async function preparePassiveSkills() {
  const skills = this.data.data.skills;
  if (!skills) return;
  for (let skillId of Object.keys(skills)) {
    const skill = this.data.data.skills[skillId];
    const abilityId = skill.ability;
    const advdisadv = procAdvantageSkill(this, abilityId, skillId);
    skill.passive = skill.passive + 5 * advdisadv;
  }
}

function prepareData(wrapped) {
  debug("prepare data: before passes", this.name, this.data._source);
  this.overrides = {};
  wrapped();
  const hasHeavy = this.items.find(i => i.data.data.equipped && i.data.data.stealth) !== undefined;
  if (hasHeavy) setProperty(this.data, "flags.midi-qol.disadvantage.skill.ste", true);
  applyDaeEffects.bind(this)(ValidSpec.specs[this.type].derivedSpecsObj, ValidSpec.specs[this.type].baseSpecsObj, true);
  preparePassiveSkills.bind(this)();
  //TODO find another way to tdo this
  // this._prepareOwnedItems(this.data.items)
  debug("prepare data: after passes", this.data);
}

function procAdvantageSkill(actor, abilityId, skillId): number {
  const midiFlags = actor.data.flags["midi-qol"] ?? {};
  const advantage = midiFlags.advantage ?? {};
  const disadvantage = midiFlags.disadvantage ?? {};
  let withAdvantage = advantage.all ?? false;
  let withDisadvantage = disadvantage.all ?? false;

  if (advantage.ability) {
    withAdvantage = withAdvantage || advantage.ability.all || advantage.ability.check?.all;
  }
  if (advantage.ability?.check) {
    withAdvantage = withAdvantage || advantage.ability.check[abilityId];
  }
  if (advantage.skill) {
    withAdvantage = withAdvantage || advantage.skill.all || advantage.skill[skillId];
  }


  if (disadvantage.ability) {
    withDisadvantage = withDisadvantage || disadvantage.all || disadvantage.ability.all || disadvantage.ability.check?.all;
  }
  if (disadvantage.ability?.check) {
    withDisadvantage = withDisadvantage || disadvantage.ability.check[abilityId];
  }
  if (disadvantage.skill) {
    withDisadvantage = withDisadvantage || disadvantage.skill.all || disadvantage.skill[skillId];
  }
  if ((withAdvantage && withDisadvantage) || (!withAdvantage && !withDisadvantage)) return 0;
  else if (withAdvantage) return 1;
  else return -1;
}


function _prepareArmorClassAttribution(wrapped, data) {
  const attributions = wrapped(data);
  if (!this.object.data.effects) return attributions;
  for (let effect of this.object.data.effects) {
    for (let change of effect.data.changes) {
      //@ts-ignore .isNumeric - core does not look at ac.value or non-numeric ac.bonus
      if ((change.key === "data.attributes.ac.value" || change.key === "data.attributes.ac.bonus" && !Number.isNumeric(change.value)) && !effect.data.disabled && !effect.isSuppressed) {
        attributions.push({
          label: `${effect.data.label} (dae)`,
          mode: change.mode,
          value: change.value
        })
      }
    }
  }
  return attributions;
}

function patchPrepareArmorClassAttribution() {
  if (game.system.id === "dnd5e") {
    libWrapper.register("dae", "CONFIG.Actor.sheetClasses.character['dnd5e.ActorSheet5eCharacter'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
    libWrapper.register("dae", "CONFIG.Actor.sheetClasses.npc['dnd5e.ActorSheet5eNPC'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
    libWrapper.register("dae", "CONFIG.Actor.sheetClasses.vehicle['dnd5e.ActorSheet5eVehicle'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
  } else if (game.system.id === "sw5e") {
    libWrapper.register("dae", "CONFIG.Actor.sheetClasses.character['sw5e.ActorSheet5eCharacter'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
    libWrapper.register("dae", "CONFIG.Actor.sheetClasses.npc['sw5e.ActorSheet5eNPC'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
    libWrapper.register("dae", "CONFIG.Actor.sheetClasses.vehicle['sw5e.ActorSheet5eVehicle'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
  }
}

// Patch for actor-flags app to display settings including active effects
function patchSpecialTraits() {
  displayTraits = game.settings.get("dae", "displayTraits");
  //@ts-ignore
  if ("dnd5e" === game.system.id || "sw5e" === game.system.id) {
    log(`Patching game.${game.system.id}.applications.ActorSheetFlags.prototype._updateObject (override=${displayTraits})`);
    log(`Patching game.${game.system.id}.applications.ActorSheetFlags.prototype._getFlags (override=${displayTraits})`);
    log(`Patching game.${game.system.id}.applications.ActorSheetFlags.prototype._getBonuses (override=${displayTraits})`);
    if (!displayTraits) {
      if (specialTraitsPatched) {
        libWrapper.unregister("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._updateObject`);
        libWrapper.unregister("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getFlags`);
        libWrapper.unregister("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getBonuses`);
      }
    } else {
      if (!specialTraitsPatched) {
        libWrapper.register("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._updateObject`, _updateObject, "OVERRIDE");
        libWrapper.register("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getFlags`, _getFlags[game.system.id], "OVERRIDE");
        libWrapper.register("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getBonuses`, _getBonuses[game.system.id], "OVERRIDE");
      }
    }
    specialTraitsPatched = displayTraits;
  }
}

const _getBonuses = { "dnd5e": _getBonusesdnd5e, "sw5e": _getBonusessw5e };
const _getFlags = { "dnd5e": _getFlagsdnd5e, "sw5e": _getFlagssw5e };

function _getFlagsdnd5e() {
  const flags = {};
  const baseData = this.document.data;
  for (let [k, v] of Object.entries(CONFIG.DND5E.characterFlags)) {
    //@ts-ignore
    if (!flags.hasOwnProperty(v.section)) flags[v.section] = {};
    let flag = duplicate(v);
    //@ts-ignore
    flag.type = v.type.name;
    //@ts-ignore
    flag.isCheckbox = v.type === Boolean;
    //@ts-ignore
    flag.isSelect = v.hasOwnProperty('choices');
    //@ts-ignore
    flag.value = getProperty(baseData.flags, `dnd5e.${k}`);
    //@ts-ignore
    flags[v.section][`flags.dnd5e.${k}`] = flag;
  }
  return flags;
}

function _getFlagssw5e() {
  const flags = {};
  const baseData = this.document.data;
  for (let [k, v] of Object.entries(CONFIG.DND5E.characterFlags)) {
    //@ts-ignore
    if (!flags.hasOwnProperty(v.section)) flags[v.section] = {};
    let flag = duplicate(v);
    //@ts-ignore
    flag.type = v.type.name;
    //@ts-ignore
    flag.isCheckbox = v.type === Boolean;
    //@ts-ignore
    flag.isSelect = v.hasOwnProperty('choices');
    //@ts-ignore
    flag.value = getProperty(baseData.flags, `sw5e.${k}`);
    //@ts-ignore
    flags[v.section][`flags.sw5e.${k}`] = flag;
  }
  return flags;
}

function _getBonusesdnd5e() {
  const bonuses = [
    { name: "data.bonuses.mwak.attack", label: "DND5E.BonusMWAttack" },
    { name: "data.bonuses.mwak.damage", label: "DND5E.BonusMWDamage" },
    { name: "data.bonuses.rwak.attack", label: "DND5E.BonusRWAttack" },
    { name: "data.bonuses.rwak.damage", label: "DND5E.BonusRWDamage" },
    { name: "data.bonuses.msak.attack", label: "DND5E.BonusMSAttack" },
    { name: "data.bonuses.msak.damage", label: "DND5E.BonusMSDamage" },
    { name: "data.bonuses.rsak.attack", label: "DND5E.BonusRSAttack" },
    { name: "data.bonuses.rsak.damage", label: "DND5E.BonusRSDamage" },
    { name: "data.bonuses.abilities.check", label: "DND5E.BonusAbilityCheck" },
    { name: "data.bonuses.abilities.save", label: "DND5E.BonusAbilitySave" },
    { name: "data.bonuses.abilities.skill", label: "DND5E.BonusAbilitySkill" },
    { name: "data.bonuses.spell.dc", label: "DND5E.BonusSpellDC" }
  ];
  for (let b of bonuses) {
    //@ts-ignore
    b.value = getProperty(this.object.data, b.name) || "";
  }
  return bonuses;
}

function _getBonusessw5e() {
  const bonuses = [
    { name: "data.bonuses.mwak.attack", label: "SW5E.BonusMWAttack" },
    { name: "data.bonuses.mwak.damage", label: "SW5E.BonusMWDamage" },
    { name: "data.bonuses.rwak.attack", label: "SW5E.BonusRWAttack" },
    { name: "data.bonuses.rwak.damage", label: "SW5E.BonusRWDamage" },
    { name: "data.bonuses.mpak.attack", label: "SW5E.BonusMPAttack" },
    { name: "data.bonuses.mpak.damage", label: "SW5E.BonusMPDamage" },
    { name: "data.bonuses.rpak.attack", label: "SW5E.BonusRPAttack" },
    { name: "data.bonuses.rpak.damage", label: "SW5E.BonusRPDamage" },
    { name: "data.bonuses.abilities.check", label: "SW5E.BonusAbilityCheck" },
    { name: "data.bonuses.abilities.save", label: "SW5E.BonusAbilitySave" },
    { name: "data.bonuses.abilities.skill", label: "SW5E.BonusAbilitySkill" },
    { name: "data.bonuses.spell.dc", label: "SW5E.BonusPowerlDC" }
  ];
  for (let b of bonuses) {
    //@ts-ignore
    b.value = getProperty(this.object.data, b.name) || "";
  }
  return bonuses;
}

async function _updateObject(event, formData) {
  const actor = this.object;
  let updateData = expandObject(formData);

  // Unset any flags which are "false"
  let unset = false;
  const flags = updateData.flags[game.system.id];
  for (let [k, v] of Object.entries(flags)) {
    //@ts-ignore
    if ([undefined, null, "", false, 0].includes(v)) {
      delete flags[k];
      if (hasProperty(actor.data.flags, `${game.system.id}.${k}`)) {
        unset = true;
        flags[`-=${k}`] = null;
      }
    }
  }

  // Clear any bonuses which are whitespace only
  for (let b of Object.values(updateData.data.bonuses)) {
    for (let [k, v] of Object.entries(b)) {
      b[k] = v.trim();
    }
  }

  // Diff the data against any applied overrides and apply
  await actor.update(diffObject(actor.overrides || {}, updateData), { diff: false });
}

// Update the actor active effects when editing an owned item
// TODO change this to on update item
function updateItem(candidate, updates, options, user) {
  if (!candidate.isOwned) return true;
  if (user !== game.user.id) return true;
  if (updates.data?.attunement !== undefined || updates.data?.equipped !== undefined) { // item effects have changed - update transferred effects
    toggleDisabledEffect(candidate, updates);
  }
  return true;
}

async function toggleDisabledEffect(item, updates: any) {
  const equipped = updates.data?.equipped ?? item.data.data?.equipped;
  const attuned = (updates.data?.attunement ?? item.data.data?.attunement) !== 1; // CONFIG>DND5E.attunementTypes.REQUIRED

  const disabled = !equipped || !attuned;
  let updateEffectsData = [];
  let wasChanged = false;
  for (let aef of item.parent.effects) { // remove all transferred effects for the item
    const isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
    if (isTransfer && aef.data.origin === item.uuid) {
      wasChanged = true;
      aef.data.disabled = disabled;
    }
    updateEffectsData.push(aef.data);
  };
  if (wasChanged) item.parent.updateEmbeddedDocuments("ActiveEffect", updateEffectsData)
}

function checkArmorDisabled() {
  if (
    game.system.id === "dnd5e"
    && isNewerVersion(game.system.data.version, "1.3.9")
    && game.settings.get("dae", "ArmorDisabled") < 1) {
    let d = new Dialog({
      // localize this text
      title: i18n("dae.confirm"),
      content: `<h2>You have updated to DND 1.4.x</h2><p>DND 1.4.x auto calculates AC</p><p> Auto calculation in DAE will be disabled</p>`,
      buttons: {
        one: {
          icon: '<i class="fas fa-cross"></i>',
          label: "Disable DAE AC",
          callback: async () => {
            await cleanArmorWorld();
            await cleanDAEArmorWorld();
            game.settings.set("dae", "ArmorDisabled", 1)
          }
        },
      },
      default: "one"
    });
    d.render(true);
  }
}

function determineSuppression() {
  this.isSuppressed = false;
  if (this.data.disabled || (this.parent.documentName !== "Actor")) return;
  if (this.data.origin) {
    const originParts = this.data.origin.split(".");
    if (originParts[originParts.length - 2] === "Item") {
      const item = this.parent.items.get(originParts[originParts.length - 1]);
      if (item)
        this.isSuppressed = item.areEffectsSuppressed;
    }
  }
  if (this.parent) {
    const ci = this.parent.data.data.traits?.ci?.value;
    const statusId = (this.data.label ?? "no effect").toLocaleLowerCase();
    const ciSuppressed = (ci?.length && ci.some(c => statusId == c));
    this.data.disabled = Boolean(ciSuppressed);
  }
}

if (!globalThis.daeSystems) globalThis.daeSystems = {};
setProperty(globalThis.daeSystems, "dnd5e", DAESystemDND5E);