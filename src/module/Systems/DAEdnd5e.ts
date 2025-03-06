
import { ArrayField, BooleanField, NumberField, ObjectField, SchemaField, StringField, daeSpecialDurations, debug, debugEnabled, error, i18n, i18nFormat, warn } from "../../dae.js";
import { addAutoFields, DAEActiveEffectConfig, isEnchantment } from "../apps/DAEActiveEffectConfig.js";
import { actionQueue, actorFromUuid, addEffectChange, applyDaeEffects, atlActive, daeSystemClass, effectIsTransfer, enumerateBaseValues, getSelfTarget, getStaticID, geti18nOptions, libWrapper, noDupDamageMacro, removeEffectChange } from "../dae.js";
import { DAESystem, ValidSpec, wildcardEffects } from "./DAESystem.js";

var d20Roll;
var dice;

//@ts-expect-error
const CONFIG: any = globalThis.CONFIG;

export class DAESystemDND5E extends CONFIG.DAE.systemClass {
  traitList;
  languageList;
  conditionList;
  bypassesList;
  customDamageResistanceList;
  armorClassCalcList;
  static profInit;
  static toolProfList;
  static armorProfList;
  static weaponProfList;

  public static get systemConfig() {
    //@ts-expect-error
    return game.system.config;
  }

  public static getItemSpecs() {
    // Setup Item Specs
    //@ts-expect-error
    const FormulaField = game.system.dataModels.fields.FormulaField;
    //@ts-expect-error
    const gameConfig = game.system.config;
    let itemSpecs = enumerateBaseValues(CONFIG.Item.dataModels);
    const activitySpecsRaw = enumerateBaseValues(globalThis.dnd5e.dataModels.activity, false);
    const activitySpecs: any = {};
    for (let k of ["CopnsumptionError", "AppliedEffectField", "ConsumptionTargetField"]) {
      delete activitySpecsRaw[k];

    };
    for (let rawActivityKey of Object.keys(activitySpecsRaw)) {
      const activityKey = rawActivityKey.replace("ActivityData", "").toLocaleLowerCase();
      let activityLabel = i18n(`DND5E.${activityKey.toUpperCase()}.Title.one`);
      if (activityLabel.startsWith("DND5E.")) activityLabel = i18n(`DND5E.${activityKey.toUpperCase()}.Title`);
      for (let rawKey of Object.keys(activitySpecsRaw[rawActivityKey])) {
        const key = rawKey.replace("system.", "");
        if (["_id", "type"].includes(key)) continue;
        activitySpecs[`activities[${activityKey}].${key}`] = activitySpecsRaw[rawActivityKey][rawKey];
        activitySpecs[`activities[${activityKey}].${key}`][0].label = `${activityLabel} ${i18n("DND5E.ACTIVITY.Title.one")} ${key}`;
      }
      if (game.modules?.get("midi-qol")?.active) {
        activitySpecs[`activities[${activityKey}].useConditionText`] = [new StringField({ label: i18n("midi-qol.FIELDS.useConditionText.hint") }), -1];
        activitySpecs[`activities[${activityKey}].effectConditionText`] = [new StringField({ label: i18n("midi-qol.FIELDS.effectConditionText.hint") }), -1];
        activitySpecs[`activities[${activityKey}].macroData.name`] = [new StringField({ label: "Macro Name" }), -1];
        activitySpecs[`activities[${activityKey}].macroData.command`] = [new StringField({ label: "Macro Command" }), -1];
        activitySpecs[`activities[${activityKey}].midiProperties.ignoreTraits`] = [new ArrayField(new StringField(), { label: "Ignore Traits" }), -1];
        activitySpecs[`activities[${activityKey}].midiProperties.triggeredActivityId`] = [new StringField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.triggeredActivityId.hint") }), -1];
        activitySpecs[`activities[${activityKey}].midiProperties.triggeredActivityConditionText`] = [new StringField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.triggeredActivityConditionText.hint") }), -1];
        // activitySpecs[`activities[${activityKey}].midiProperties.triggeredActivityTargets`] = [new StringField({ label: "Triggered Activity Targets" }), -1];
        // activitySpecs[`activities[${activityKey}].midiProperties.triggeredActivityRollAs`] = [new StringField({ label: "Triggered Activity Roll As" }), -1];
        activitySpecs[`activities[${activityKey}].midiProperties.forceDialog`] = [new BooleanField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.forceDialog.hint") }), -1];
        activitySpecs[`activities[${activityKey}].midiProperties.confirmTargets`] = [new StringField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.confirmTargets.hint") }), -1]; activitySpecs[`activities[${activityKey}].midiProperties.automationOnly`] = [new BooleanField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.automationOnly.hint") }), -1];
        // activitySpecs[`activities[${activityKey}].midiProperties.otherActivityCompatible`] = [new BooleanField({ label: "midi-qol.SHARED.FIELDS.midiProperties.otherActivityCompatible.hint" }), -1];
      }

      if (game.modules?.get("midi-qol")?.active) {
        activitySpecs["activities[attack].attackMode"] = [new StringField({ label: "Attack Mode" }), -1];
      }
    }

    for (let itemKey of Object.keys(itemSpecs)) {
      itemSpecs[itemKey] = foundry.utils.mergeObject(itemSpecs[itemKey], activitySpecs, { insertValues: true, insertKeys: true, inplace: false, overwrite: false });
    }

    const allSpecs = {};
    let unionSpecs = {};
    try {
      for (let k of ["weapon", /*"spell", "feat",*/ "consumable", "equipment", "loot", /*"class",*/ "tool", /*"vehicle",*/ "container"]) {
        unionSpecs = foundry.utils.mergeObject(unionSpecs, itemSpecs[k], { insertValues: true, insertKeys: true, inplace: false, overwrite: false });
      }
      itemSpecs["union"] = unionSpecs;

      for (let k of Object.keys(itemSpecs)) {
        let theSpecs = itemSpecs[k]
        theSpecs = foundry.utils.flattenObject(theSpecs);
        theSpecs["name"] = [new StringField({ label: "Name" }), -1];
        theSpecs["img"] = [new StringField({ label: "Image" }), -1];
        theSpecs["flags.dae.macro.name"] = [new StringField({ label: "Macro Name" }), -1];
        theSpecs["flags.dae.macro.command"] = [new StringField({ label: "Macro Command" }), -1];
        theSpecs["flags.dae.macro.img"] = [new StringField({ label: "Macro Img" }), -1];
        theSpecs["flags.dae.macro.type"] = [new StringField({ label: "Macro Data" }), -1];
        theSpecs["flags.dae.macro.scope"] = [new StringField({ label: "Macro Scope" }), -1];
        if (game.modules?.get("midi-qol")?.active && ["union", "spell", "feat", "consumable", "equipment", "spell", "weapon"].includes(k)) {
          for (let [s, label] of [
            ["itemCondition", "midi-qol.ItemActivationCondition.Name"],
            ["reactionCondition", "midi-qol.ReactionActivationCondition.Name"],
            ["otherCondition", "midi-qol.OtherActivationCondition.Name"],
            ["effectCondition", "midi-qol.EffectActivationCondition.Name"]]) {
            theSpecs[`flags.midi-qol.${s}`] = [new StringField({ label: i18n(label) }), -1];
          }
          for (let s of ["autoFailFriendly", "autoSaveFriendly", "critOther", "ida", "idi", "idv", "idr", "ignoreTotalCover", "magicDam", "magicEffect", "noConcentrationEffect", "offHandWeapon", "toggleEffect"]) {
            theSpecs[`flags.midiProperties.${s}`] = [new BooleanField({ label: i18n(gameConfig.midiProperties?.[s] ?? s) }), -1];
          }

          theSpecs["flags.midiProperties.bonusSaveDamage"] = [new StringField({ label: i18n(gameConfig.midiProperties?.["bonusSaveDamage"] ?? "Bonus Damage Save") }), -1];
          theSpecs["flags.midiProperties.otherSaveDamage"] = [new StringField({ label: i18n(gameConfig.midiProperties?.["otherSaveDamage"] ?? "Other Damage Save") }), -1];
          theSpecs["flags.midiProperties.saveDamage"] = [new StringField({ label: i18n(gameConfig.midiProperties?.["saveDamage"] ?? "Base Damage Save") }), -1];
          theSpecs["flags.midiProperties.confirmTargets"] = [new StringField({ label: i18n(gameConfig.midiProperties?.["confirmTargets"] ?? "Confirm Targets") }), -1];
        }

        for (let k1 of Object.keys(theSpecs)) {
          theSpecs[k1] = new ValidSpec(k1, theSpecs[k1][0], theSpecs[k1][1], theSpecs[k1][0].label, theSpecs[k1][3]);
        }

        for (let k1 of Object.keys(theSpecs)) {
          switch (k1) {
            case "system.duration.units": theSpecs[k1].options = { "": null, ...gameConfig.timePeriods }; break;
            case "system.target.type": theSpecs[k1].options = { "": null, ...gameConfig.targetTypes }; break;
            case "system.actionType": theSpecs[k1].options = { "": null, ...gameConfig.itemActionTypes }; break;
            case "system.uses.per": theSpecs[k1].options = { "": null, ...gameConfig.limitedUsePeriods }; break;
            case "system.consume.type": theSpecs[k1].options = { "": null, ...gameConfig.abilityConsumptionTypes }; break;
            case "system.attunement": theSpecs[k1].options = { "": "", ...gameConfig.attunementTypes }; break;
            case "flags.midiProperties.bonusSaveDamage": theSpecs[k1].options = geti18nOptions("SaveDamageOptions", "midi-qol"); break;
            case "flags.midiProperties.otherSaveDamage": theSpecs[k1].options = geti18nOptions("SaveDamageOptions", "midi-qol"); break;
            case "flags.midiProperties.saveDamage": theSpecs[k1].options = geti18nOptions("SaveDamageOptions", "midi-qol"); break;
            case "flags.midiProperties.confirmTargets": theSpecs[k1].options = geti18nOptions("ConfirmTargetOptions", "midi-qol"); break;
          }
        }


        const derivedSpecsObj = {
          "name": theSpecs["name"],
          "system.magicalBonus": theSpecs["system.magicalBonus"],
          "system.formula": theSpecs["system.formula"],
          "flags.midi-qol.itemCondition": theSpecs["flags.midi-qol.itemCondition"],
          "flags.midi-qol.reactionCondition": theSpecs["flags.midi-qol.reactionCondition"],
          "flags.midi-qol.otherCondition": theSpecs["flags.midi-qol.otherCondition"],
          "flags.midi-qol.effectCondition": theSpecs["flags.midi-qol.effectCondition"],
          "flags.midiProperties.bonusSaveDamage": theSpecs["flags.midiProperties.bonusSaveDamage"],
          "flags.midiProperties.confirmTargets": theSpecs["flags.midiProperties.confirmTargets"],
          "flags.midiProperties.otherSaveDamage": theSpecs["flags.midiProperties.otherSaveDamage"],
          "flags.midiProperties.saveDamage": theSpecs["flags.midiProperties.saveDamage"],
        };
        for (let s of ["autoFailFriendly", "autoSaveFriendly", "critOther", "ida", "idi", "idv", "idr", "ignoreTotalCover", "magicDam", "magicEffect", "noConcentrationEffect", "offHandWeapon", "toggleEffect"]) {
          derivedSpecsObj[`flags.midiProperties.${s}`] = theSpecs[`flags.midiProperties.${s}`];
        }

        const baseSpecsObj = {};
        for (let k1 of Object.keys(theSpecs)) {
          if (!derivedSpecsObj[k1]) baseSpecsObj[k1] = theSpecs[k1];
        }
        allSpecs[k] = {
          allSpecsObj: theSpecs,
          baseSpecsObj,
          derivedSpecsObj,
          allSpecs: Object.keys(theSpecs).map(k => theSpecs[k]).sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 }),
          baseSpecs: Object.keys(baseSpecsObj).map(k => baseSpecsObj[k]).sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 }),
          derivedSpecs: Object.keys(derivedSpecsObj).map(k => derivedSpecsObj[k]).sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 }),
          allSpecKeys: Object.keys(theSpecs).sort(),
          baseSpecKeys: Object.keys(baseSpecsObj).sort(),
          derivedSpecKeys: Object.keys(derivedSpecsObj).sort()
        }
      }
      allSpecs["union"].excludeKeys = [
        "system.currency.cp",
        "system.currency.sp",
        "system.currency.ep",
        "system.currency.gp",
        "system.currency.pp",
        "system.currency.weight",
      ]
    }
    catch (err) {
      console.error("Error in getItemSpecs", err);
    }
    return allSpecs;
  }

  public static modifyBaseValues(actorType: string, baseValues: {}, characterSpec: any): void {
    super.modifyBaseValues(actorType, baseValues, characterSpec);
    if (debugEnabled > 0) warn("modifyBaseValues", actorType, baseValues, characterSpec);
    const modes = CONST.ACTIVE_EFFECT_MODES;
    let schema: any;

    //@ts-expect-error
    const FormulaField = game.system.dataModels.fields.FormulaField;
    //@ts-expect-error
    const dataModels: any = game.system.dataModels;
    const MappingField = dataModels.fields.MappingField;
    const actorDataModel = this.getActorDataModelFields(actorType);
    if (!actorDataModel) {
      console.warn("Could not find data model for actor type", actorType);
      return;
    }


    function processMappingField(key, mappingField) {
      const fields = mappingField.initialKeys;
      if (!fields) return;
      for (let fieldKey of Object.keys(fields)) {
        if (mappingField.model instanceof SchemaField) {
          processSchemaField(`${key}.${fieldKey}`, mappingField.model);
        } else if (mappingField.model instanceof MappingField) {
          processMappingField(`${key}.${fieldKey}`, mappingField.model);
        } else {
          // TODO come back and see how favorites might be supported.
          if (fieldKey.includes("favorites")) return;
          let initial = fields[fieldKey].initial ?? 0;;
          //          if (typeof fields[fieldKey].initial === "function") { initial = fields[fieldKey].initial() ?? ""; }
          //          baseValues[`${key}.${fieldKey}`] = [initial, -1];
          baseValues[`${key}.${fieldKey}`] = [fields[fieldKey], -1];
          // console.error(`final field is ${key}.${fieldKey}`, mappingField.model);
        }
      }
    }
    function processSchemaField(key, schemaField) {
      const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
      const fields = schemaField.fields;
      for (let fieldKey of Object.keys(fields)) {
        if (fields[fieldKey] instanceof SchemaField) {
          processSchemaField(`${key}.${fieldKey}`, fields[fieldKey]);
        }
        else if (fields[fieldKey] instanceof MappingField) {
          processMappingField(`${key}.${fieldKey}`, fields[fieldKey]);
        } else {
          if (fieldKey.includes("favorites")) return; //TODO see above
          //          let initial = fields[fieldKey].initial ?? 0;;
          //          if (typeof fields[fieldKey].initial === "function") { initial = fields[fieldKey].initial() ?? ""; }
          //          baseValues[`${key}.${fieldKey}`] = [initial, -1];
          baseValues[`${key}.${fieldKey}`] = [fields[fieldKey], -1];
          // console.error(`final field is ${key}.${fieldKey}`, fields[fieldKey])
        }
      }
    }
    for (let key of Object.keys(actorDataModel)) {
      const modelField = actorDataModel[key]
      if (modelField instanceof SchemaField) {
        processSchemaField(`system.${key}`, modelField);
      } else if (modelField instanceof MappingField) {
        processMappingField(`system.${key}`, modelField);
      } else if ([ArrayField, ObjectField, BooleanField, NumberField, StringField].some(fieldType => modelField instanceof fieldType)) {
        baseValues[`system.${key}`] = [modelField.iniital, -1];
      } else console.error("Unexpected field ", key, modelField)
    }
    //@ts-expect-error
    const GameSystemConfig = game.system.config;
    if (!baseValues["system.attributes.prof"]) baseValues["system.attributes.prof"] = [new NumberField(), -1];
    if (!baseValues["system.details.level"]) baseValues["system.details.level"] = [new NumberField(), -1];
    if (!baseValues["system.attributes.ac.bonus"]) baseValues["system.attributes.ac.bonus"] = [new StringField(), -1];
    if (!baseValues["system.attributes.ac.base"]) baseValues["system.attributes.ac.base"] = [new NumberField({ initial: 10 }), -1];
    if (!baseValues["system.attributes.ac.armor"]) baseValues["system.attributes.ac.armor"] = [new NumberField(), -1];
    if (!baseValues["system.attributes.ac.shield"]) baseValues["system.attributes.ac.shield"] = [new NumberField(), -1];
    if (!baseValues["system.attributes.ac.cover"]) baseValues["system.attributes.ac.cover"] = [new NumberField(), -1];
    if (!baseValues["system.attributes.ac.min"]) baseValues["system.attributes.ac.min"] = [new NumberField(), -1];
    if (!baseValues["system.attributes.ac.calc"]) baseValues["system.attributes.ac.calc"] = [new StringField(), modes.OVERRIDE];
    // system.attributes.prof/system.details.level and system.attributes.hd are all calced in prepareBaseData
    if (!baseValues["system.bonuses.All-Attacks"]) baseValues["system.bonuses.All-Attacks"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.weapon.attack"]) baseValues["system.bonuses.weapon.attack"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.spell.attack"]) baseValues["system.bonuses.spell.attack"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.All-Damage"]) baseValues["system.bonuses.All-Damage"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.weapon.damage"]) baseValues["system.bonuses.weapon.damage"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.spell.damage"]) baseValues["system.bonuses.spell.damage"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.spell.all.damage"]) baseValues["system.bonuses.spell.all.damage"] = [new StringField(), -1];
    // These are for item action types - works by accident.
    if (!baseValues["system.bonuses.heal.damage"]) baseValues["system.bonuses.heal.damage"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.heal.attack"]) baseValues["system.bonuses.heal.attack"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.save.damage"]) baseValues["system.bonuses.save.damage"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.check.damage"]) baseValues["system.bonuses.check.damage"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.abil.damage"]) baseValues["system.bonuses.abil.damage"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.other.damage"]) baseValues["system.bonuses.other.damage"] = [new StringField(), -1];
    if (!baseValues["system.bonuses.util.damage"]) baseValues["system.bonuses.util.damage"] = [new StringField(), -1];
    baseValues["system.attributes.hp.bonuses.overall"] = [new StringField(), -1];
    baseValues["system.attributes.hp.bonuses.level"] = [new StringField(), -1];
    // Don't do anything with system.attributes.hp.max - it will be set by parsing the actor schema
    if (!baseValues["system.attributes.hd.max"]) baseValues["system.attributes.hd.max"] = [new NumberField(), -1];
    const actorModelSchemaFields = this.getActorDataModelFields(actorType);
    delete baseValues["system.traits.toolProf.value"];
    delete baseValues["system.traits.toolProf.custom"];
    delete baseValues["system.traits.toolProf.all"];
    if (daeSystemClass.systemConfig.toolProficiencies && foundry.utils.getProperty(actorModelSchemaFields, "tools")) {
      const toolProfList = foundry.utils.duplicate(daeSystemClass.systemConfig.toolProficiencies);
      const ids = daeSystemClass.systemConfig[`toolIds`];
      if (ids !== undefined) {
        for (const [key, id] of Object.entries(ids)) {
          // const item = await pack.getDocument(id);
          toolProfList[key] = key;
        }
      }
      for (let key of Object.keys(toolProfList)) {
        baseValues[`system.tools.${key}.prof`] = [new NumberField(), CONST.ACTIVE_EFFECT_MODES.CUSTOM];
        baseValues[`system.tools.${key}.ability`] = [new StringField(), CONST.ACTIVE_EFFECT_MODES.OVERRIDE];
        baseValues[`system.tools.${key}.bonuses.check`] = [new StringField(), -1];
      }
      for (let vehicleKey of Object.keys(CONFIG.DND5E.vehicleTypes)) {
        baseValues[`system.tools.${vehicleKey}.value`] = [new NumberField(), CONST.ACTIVE_EFFECT_MODES.OVERRIDE];
      }
    }
    // move all the character flags to specials so that the can be custom effects only
    let charFlagKeys = Object.keys(daeSystemClass.systemConfig.characterFlags);
    charFlagKeys.forEach(key => {
      let theKey = `flags.${game.system?.id}.${key}`;
      if ([`flags.${game.system?.id}.weaponCriticalThreshold`,
      `flags.${game.system?.id}.meleeCriticalDamageDice`,
      `flags.${game.system?.id}.spellCriticalThreshold`].includes(theKey)) {
        delete baseValues[theKey];
      } else if (daeSystemClass.systemConfig.characterFlags[key].type === Boolean) baseValues[theKey] = false;
      else if (daeSystemClass.systemConfig.characterFlags[key].type === Number) baseValues[theKey] = 0;
      else if (daeSystemClass.systemConfig.characterFlags[key].type === String) baseValues[theKey] = "";
    });
    if (game.modules?.get("skill-customization-5e")?.active && game.system?.id === "dnd5e") {
      Object.keys(daeSystemClass.systemConfig.skills).forEach(skl => {
        baseValues[`flags.skill-customization-5e.${skl}.skill-bonus`] = "";
      })
    }
    delete baseValues[`flags.${game.system?.id}.weaponCriticalThreshold`];
    delete baseValues[`flags.${game.system?.id}.powerCriticalThreshold`];
    delete baseValues[`flags.${game.system?.id}.meleeCriticalDamageDice`];
    delete baseValues[`flags.${game.system?.id}.spellCriticalThreshold`];
    Object.keys(baseValues).forEach(key => {
      // can't modify many spell details.
      if (key.includes("system.spells")) {
        delete baseValues[key];
      }
    });
    if (foundry.utils.getProperty(actorModelSchemaFields, "spells")) {
      for (let spellSpec of (foundry.utils.getProperty(actorModelSchemaFields, "spells.initialKeys") ?? []))
        baseValues[`system.spells.${spellSpec}.override`] = [new NumberField(), -1];
    }


    // removed - required so that init.bonus can work (prepareInitiative called after derived effects
    // delete baseValues["system.attributes.init.total"];
    delete baseValues["system.attributes.init.mod"];
    // delete baseValues["system.attributes.init.bonus"];
    // leaving this in base values works because prepareInitiative is called after application of derived effects
    delete baseValues["flags"];

    baseValues["system.traits.ci.all"] = [new BooleanField(), modes.CUSTOM];
    if (!baseValues["system.traits.ci.value"]) baseValues["system.traits.ci.value"] = [new StringField(), -1];
    baseValues["system.traits.ci.custom"] = [new StringField(), modes.CUSTOM];

    if (baseValues["system.traits.weaponProf.value"]) {
      baseValues["system.traits.weaponProf.all"] = [new BooleanField(), modes.CUSTOM];
      //      baseValues["system.traits.weaponProf.value"] = [[], -1];
      baseValues["system.traits.weaponProf.custom"] = [new StringField(), modes.CUSTOM];
    }
    if (baseValues["system.traits.armorProf.value"]) {
      baseValues["system.traits.armorProf.all"] = [new BooleanField(), modes.CUSTOM];
      //      baseValues["system.traits.armorProf.value"] = [new StringField(), -1];
      baseValues["system.traits.armorProf.custom"] = [new StringField(), modes.CUSTOM];
      baseValues["system.attributes.hp.tempmax"] = [new NumberField(), -1];
    }
    baseValues["system.attributes.encumbrance.bonuses.encumbered"] = [new StringField(), -1];
    baseValues["system.attributes.encumbrance.bonuses.heavilyEncumbered"] = [new StringField(), -1];
    baseValues["system.attributes.encumbrance.bonuses.maximum"] = [new StringField(), -1];
    baseValues["system.attributes.encumbrance.bonuses.overall"] = [new StringField(), -1];
    baseValues["system.attributes.encumbrance.multipliers.encumbered"] = [new StringField(), -1];
    baseValues["system.attributes.encumbrance.multipliers.heavilyEncumbered"] = [new StringField(), -1];
    baseValues["system.attributes.encumbrance.multipliers.maximum"] = [new StringField(), -1];
    baseValues["system.attributes.encumbrance.multipliers.overall"] = [new StringField(), -1];
    baseValues["system.traits.size"] = [new StringField(), CONST.ACTIVE_EFFECT_MODES.OVERRIDE];
    if (GameSystemConfig.languages) {
      baseValues["system.traits.languages.all"] = [new BooleanField(), -1];
    }

  }

  public static modifySpecials(actorType: string, specials: {}, characterSpec: any): void {
    super.modifySpecials(actorType, specials, characterSpec);
    const actorModelSchemaFields = this.getActorDataModelFields(actorType);
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    //@ts-expect-error
    const GameSystemConfig = game.system.config;
    if (actorType === "vehicle") {
      specials["system.attributes.ac.motionless"] = [new NumberField(), -1];
      specials["system.attributes.ac.flat"] = [new NumberField(), -1];
    } else {
      specials["system.attributes.ac.value"] = [new NumberField(), -1];
    }
    specials["macro.activityMacro"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.di.all"] = [new BooleanField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.di.value"] = [new StringField(), -1];
    specials["system.traits.di.custom"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.di.bypasses"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.dr.all"] = [new BooleanField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.dr.value"] = [new StringField(), -1];
    specials["system.traits.dr.custom"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.dr.bypasses"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.dv.all"] = [new BooleanField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.dv.value"] = [new StringField(), -1];
    specials["system.traits.dv.custom"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.dv.bypasses"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.traits.da.bypasses"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];

    specials["system.spells.pact.level"] = [new NumberField(), -1];
    specials["flags.dae"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];

    specials["system.attributes.movement.all"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.attributes.movement.hover"] = [new NumberField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["system.attributes.ac.EC"] = [new NumberField(), -1];
    specials["system.attributes.ac.AR"] = [new NumberField(), -1];

    if (foundry.utils.getProperty(actorModelSchemaFields, "resources")) {
      specials["system.resources.primary.max"] = [new NumberField(), -1];
      specials["system.resources.primary.label"] = [new StringField(), -1];
      specials["system.resources.secondary.max"] = [new NumberField(), -1];
      specials["system.resources.secondary.label"] = [new StringField(), -1];
      specials["system.resources.tertiary.max"] = [new NumberField(), -1];
      specials["system.resources.tertiary.label"] = [new StringField(), -1];
      specials["system.resources.legact.max"] = [new NumberField(), -1];
      specials["system.resources.legres.max"] = [new NumberField(), -1];

      if (game.modules?.get("resourcesplus")?.active) {
        for (let res of ["fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]) {
          specials[`system.resources.${res}.max`] = [new NumberField(), -1];
          specials[`system.resources.${res}.label`] = [new StringField(), -1];
        }
      }
    }
    if (foundry.utils.getProperty(actorModelSchemaFields, "spells")) {
      for (let spellSpec of (foundry.utils.getProperty(actorModelSchemaFields, "spells.initialKeys") ?? []))
        specials[`system.spells.${spellSpec}.max`] = [new NumberField(), -1];
    }

    if (["character", "npc"].includes(actorType) && game.system?.id === "dnd5e") {
      // @ts-expect-error
      if (game.settings?.get("dnd5e", "honorScore")) {
      }
      // @ts-expect-error
      if (game.settings?.get("dnd5e", "sanityScore")) {
        specials["system.abilities.san.value"] = [new NumberField(), -1];
      }
    }

    // specials[`flags.${game.system?.id}.initiativeHalfProf`] = [new BooleanField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials[`flags.${game.system?.id}.initiativeDisadv`] = [new BooleanField(), ACTIVE_EFFECT_MODES.CUSTOM];

    if (game.modules?.get("tidy5e-sheet")?.active)
      specials["system.details.maxPreparedSpells"] = [new NumberField(), -1];
    // change movement effects to be after prepareDerivedData
    if (foundry.utils.getProperty(actorModelSchemaFields, "attributes.fields.movement")) {
      for (let key of Object.keys(daeSystemClass.systemConfig.movementTypes)) {
        specials[`system.attributes.movement.${key}`] = [new NumberField(), -1];
      }
    }

    // move all the characteer flags to specials so that they can be custom effects only
    let charFlagKeys = Object.keys(daeSystemClass.systemConfig?.characterFlags ?? {});
    charFlagKeys.forEach(key => {
      let theKey = `flags.${game.system?.id}.${key}`;
      if ([`flags.${game.system?.id}.weaponCriticalThreshold`,
      `flags.${game.system?.id}.powerCriticalThreshold`,
      `flags.${game.system?.id}.meleeCriticalDamageDice`,
      `flags.${game.system?.id}.spellCriticalThreshold`].includes(theKey)) {
        specials[theKey] = [new NumberField(), -1];
      }
    });
    // Do the system specific part
    // 1. abilities add mod and save to each;
    if (daeSystemClass.systemConfig.abilities && foundry.utils.getProperty(actorModelSchemaFields, "abilities")) Object.keys(daeSystemClass.systemConfig.abilities).forEach(ablKey => {
      specials[`system.abilities.${ablKey}.mod`] = [new NumberField(), -1];
      specials[`system.abilities.${ablKey}.save`] = [new NumberField(), -1];
      // specials[`system.abilities.${ablKey}.min`] = [new NumberField(), -1]; There is no min attribute yet
      specials[`system.abilities.${ablKey}.max`] = [new NumberField(), -1];
    })
  }

  public static modifyDerivedSpecs(actorType: string, derivedSpecs: ValidSpec[], characterSpec: any): void {
    super.modifyDerivedSpecs(actorType, derivedSpecs, characterSpec);
    const actorModelSchemaFields = DAESystem.getActorDataModelFields(actorType);
    //@ts-expect-error
    const systemVersion = game.system.version;
  }

  static modifyValidSpec(spec, validSpec: ValidSpec): ValidSpec {
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    if (spec.includes("system.skills") && spec.includes("ability")) {
      validSpec.forcedMode = ACTIVE_EFFECT_MODES.OVERRIDE;
    }
    if (spec.includes("system.bonuses.abilities")) {
      validSpec.forcedMode = -1;
    }
    return validSpec;
  }

  // Any actions to be called on init Hook 
  public static initActions() {
    //@ts-expect-error  - renabled for some cases
    if (game.release.generation >= 12) {
      this.fieldMappings["StatusEffect"] = "macro.StatusEffect";
    }
    Hooks.callAll("dae.addFieldMappings", this.fieldMappings);
    warn("system is ", game.system)
    if (game.modules?.get("dnd5e-custom-skills")?.active) {
      wildcardEffects.push(/system\.skills\..*\.value/);
      wildcardEffects.push(/system\.skills\..*\.ability/);
      wildcardEffects.push(/system\.skills\..*\.bonuses/);
    }
    wildcardEffects.push(/system\.abilities\..*\.value/);
    wildcardEffects.push(/system\.scale\..*\.value/);
    //@ts-expect-error
    dice = game.system.dice;
    if (!dice) error("game.system.dice not defined! Many things won't work");
    else d20Roll = dice?.d20Roll;

    libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.apply", daeApply, "WRAPPER");
    // We will call this in prepareData
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", applyBaseEffects, "OVERRIDE");
    // Overide prepareData so it can add the extra pass
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.prepareData", prepareData, "WRAPPER");
    // support other things that can suppress an effect, like condition immunity
    libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.determineSuppression", determineSuppression, "OVERRIDE");
    // This supplies DAE custom effects - the main game
    Hooks.on("applyActiveEffect", this.daeCustomEffect.bind(this));
    // done here as it references some .system data
    Hooks.on("preUpdateItem", preUpdateItemHook);
    this.configureLists(null);
    Hooks.once("babel.ready", () => { this.configureLists(null); });
    //@ts-expect-error
    const GameSystemConfig = game.system.config;
    // @ts-expect-error
    if (GameSystemConfig.conditionEffects && GameSystemConfig.conditionEffects["halfHealth"] && game.settings?.get("dae", "DAEAddHalfHealthEffect")) {
      GameSystemConfig.conditionEffects["halfHealth"].add("halfHealthEffect");
      CONFIG.statusEffects.push({
        id: "halfHealthEffect",
        _id: getStaticID("halfHealthEffect"),
        name: i18n("dae.halfHealthEffectLabel"),
        img: "modules/dae/icons/half-health.webp",
        flags: { dnd5e: { halfHealth: true } }
      });
    }

    // enchantments don't seem to get their world time set when applied to an item
    Hooks.on("preCreateActiveEffect", (candidate: ActiveEffect, data: any, options: any, user: string) => {
      //@ts-expect-error no dnd5e types
      if (candidate.isAppliedEnchantment && (candidate.duration.seconds || candidate.duration.rounds || candidate.duration.turns)) {
        if (!candidate.duration.startTime && candidate.duration.seconds)
          candidate.updateSource({ duration: { startTime: game.time?.worldTime ?? 0 } });
        else if (!Number.isNumeric(candidate.duration.startRound) && !Number.isNumeric(candidate.duration.startTurn) && game.combat) {
          candidate.updateSource({ duration: { startRound: game.combat?.round, startTurn: game.combat?.turn } });
        }
      }
      return true;
    });
    libWrapper.register("dae", "CONFIG.Item.documentClass.prototype.applyActiveEffects", _baseItemApplyEffects, "OVERRIDE");
  }


  public static setupActions(): void {
  }

  public static readyActions(): void {
    // checkArmorDisabled();
    // Modify armor attribution for DAE specific cases
    patchPrepareArmorClassAttribution();
    if (atlActive) {
      const atlFields = Object.keys(CONFIG.Canvas.detectionModes).map(dm => `ATL.detectionModes.${dm}.range`);
      addAutoFields(atlFields);
    }
    Hooks.callAll("dae.addSpecialDurations", daeSpecialDurations)
    if (game.modules?.get("midi-qol")?.active) {
      daeSpecialDurations["1Action"] = i18n("dae.1Action");
      daeSpecialDurations["Bonus Action"] = i18n("dae.Bonus Action");
      daeSpecialDurations["Reaction"] = i18n("dae.Reaction");
      daeSpecialDurations["Turn Action"] = i18n("dae.Turn Action");
      daeSpecialDurations["1Spell"] = i18n("dae.1Spell");
      daeSpecialDurations["1Attack"] = i18nFormat("dae.1Attack", { type: `${i18n("dae.spell")}/${i18n("dae.weapon")} ${i18n("dae.attack")}` });
      daeSpecialDurations["1Hit"] = i18nFormat("dae.1Hit", { type: `${i18n("dae.spell")}/${i18n("dae.weapon")}` });
      daeSpecialDurations["1Critical"] = i18n("dae.1Critical");
      daeSpecialDurations["1Fumble"] = i18n("dae.1Fumble");
      //    daeSpecialDurations["1Hit"] = i18n("dae.1Hit");
      daeSpecialDurations["1Reaction"] = i18n("dae.1Reaction")
      let attackTypes = ["mwak", "rwak", "msak", "rsak"];
      if (game.system?.id === "sw5e") attackTypes = ["mwak", "rwak", "mpak", "rpak"];
      attackTypes.forEach(at => {
        daeSpecialDurations[`1Attack:${at}`] = `${daeSystemClass.systemConfig.itemActionTypes[at]}: ${i18nFormat("dae.1Attack", { type: daeSystemClass.systemConfig.itemActionTypes[at] })}`;
        daeSpecialDurations[`1Hit:${at}`] = `${daeSystemClass.systemConfig.itemActionTypes[at]}: ${i18nFormat("dae.1Hit", { type: daeSystemClass.systemConfig.itemActionTypes[at] })}`;
      })
      daeSpecialDurations["DamageDealt"] = i18n("dae.DamageDealt");
      daeSpecialDurations["isAttacked"] = i18n("dae.isAttacked");
      daeSpecialDurations["isDamaged"] = i18n("dae.isDamaged");
      daeSpecialDurations["isHealed"] = i18n("dae.isHealed");
      daeSpecialDurations["zeroHP"] = i18n("dae.ZeroHP");
      daeSpecialDurations["isHit"] = i18n("dae.isHit");
      daeSpecialDurations["isHitCritical"] = i18n("dae.isHitCritical");
      daeSpecialDurations["isSave"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}`;
      daeSpecialDurations["isSaveSuccess"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}: ${i18n("dae.success")}`;
      daeSpecialDurations["isSaveFailure"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSaveDetail")}: ${i18n("dae.failure")}`;
      daeSpecialDurations["isConcentrationSave"] = i18n("dae.isConcentrationSave");
      daeSpecialDurations["isConcentrationSaveFail"] = `${i18n("dae.isConcentrationSave")}: ${i18n("dae.failure")}`;
      daeSpecialDurations["isConcentrationSaveSuccess"] = `${i18n("dae.isConcentrationSave")}: ${i18n("dae.success")}`;
      daeSpecialDurations["isCheck"] = `${i18n("dae.isRollBase")} ${i18n("dae.isCheckDetail")}`;
      daeSpecialDurations["isSkill"] = `${i18n("dae.isRollBase")} ${i18n("dae.isSkillDetail")}`;
      daeSpecialDurations["isInitiative"] = `${i18n("dae.isRollBase")} ${i18n("dae.isInitiativeDetail")}`;

      daeSpecialDurations["isMoved"] = i18n("dae.isMoved");
      daeSpecialDurations["longRest"] = i18n("DND5E.REST.Long.Label");
      daeSpecialDurations["shortRest"] = i18n("DND5E.REST.Short.Label");
      daeSpecialDurations["newDay"] = `${i18n("DND5E.REST.NewDay.Label")}`;
      Object.keys(daeSystemClass.systemConfig.abilities).forEach(abl => {
        let ablString = daeSystemClass.systemConfig.abilities[abl].label
        daeSpecialDurations[`isSave.${abl}`] = `${i18n("dae.isRollBase")} ${ablString} ${i18n("dae.isSaveDetail")}`;
        daeSpecialDurations[`isSaveSuccess.${abl}`] = `${i18n("dae.isRollBase")} ${ablString} ${i18n("dae.isSaveDetail")}: ${i18n("dae.success")}`;
        daeSpecialDurations[`isSaveFailure.${abl}`] = `${i18n("dae.isRollBase")} ${ablString} ${i18n("dae.isSaveDetail")}: ${i18n("dae.failure")}`;
        daeSpecialDurations[`isCheck.${abl}`] = `${i18n("dae.isRollBase")} ${ablString} ${i18n("dae.isCheckDetail")}`;
      })
      Object.keys(daeSystemClass.systemConfig.damageTypes).forEach(key => {
        daeSpecialDurations[`isDamaged.${key}`] = `${i18n("dae.isDamaged")}: ${daeSystemClass.systemConfig.damageTypes[key].label}`;
      });

      daeSpecialDurations[`isDamaged.healing`] = `${i18n("dae.isDamaged")}: ${daeSystemClass.systemConfig.healingTypes["healing"].label}`;
      Object.keys(daeSystemClass.systemConfig.skills).forEach(skillId => {
        daeSpecialDurations[`isSkill.${skillId}`] = `${i18n("dae.isRollBase")} ${i18n("dae.isSkillDetail")} ${daeSystemClass.systemConfig.skills[skillId].label}`;
      });
    }
    // Rely on suppression Hooks.on("updateItem", updateItem); // deal with disabling effects for unequipped items
  }

  public static initSystemData() {
    // Setup attack types and expansion change mappings
    this.spellAttacks = ["msak", "rsak"];
    this.weaponAttacks = ["mwak", "rwak"];
    this.attackTypes = this.weaponAttacks.concat(this.spellAttacks);
    this.bonusSelectors = {
      "system.bonuses.All-Attacks": { attacks: this.attackTypes, selector: "attack" },
      "system.bonuses.weapon.attack": { attacks: this.weaponAttacks, selector: "attack" },
      "system.bonuses.spell.attack": { attacks: this.spellAttacks, selector: "attack" },
      "system.bonuses.All-Damage": { attacks: this.attackTypes, selector: "damage" },
      "system.bonuses.weapon.damage": { attacks: this.weaponAttacks, selector: "damage" },
      "system.bonuses.spell.damage": { attacks: this.spellAttacks, selector: "damage" },
    };
    daeSystemClass.daeActionTypeKeys = Object.keys(daeSystemClass.systemConfig.itemActionTypes);
    /*
    daeSystemClass.systemConfig.characterFlags["DamageBonusMacro"] = {
      type: String,
      name: "Damage Bonus Macro",
      hint: "Macro to use for damage bonus",
      section: "Midi QOL"
    };
    // daeSystemClass.systemConfig.characterFlags["initiativeHalfProficiency"] = {
    //   type: Boolean,
    //   name: "Half Proficiency for Initiative",
    //   hint: "add 1/2 proficiency to initiative",
    //   section: "Midi QOL"
    // };
    daeSystemClass.systemConfig.characterFlags["initiativeDisadv"] = {
      type: Boolean,
      name: "Disadvantage on Initiative",
      hint: "Disadvantage on Initiative",
      section: "Midi QOL"
    };
    */
  }

  public static effectDisabled(actor, effect, itemData = null) {
    effect.determineSuppression();
    const disabled = effect.disabled || effect.isSuppressed;
    return disabled;
  }

  public static enumerateLanguages(systemLanguages: any): any {
    const languages = {"ALL": "All"};
    Object.keys(systemLanguages).forEach(lang => {
      if (typeof systemLanguages[lang] === "string") {
        languages[lang] = i18n(systemLanguages[lang]);
      }
      if (systemLanguages[lang].label) {
        languages[`${lang}`] = `${systemLanguages[lang].label}`;
      }
      if (systemLanguages[lang].children) {
        const subLanguages = this.enumerateLanguages(systemLanguages[lang].children);
        Object.keys(subLanguages).forEach(subLang => {
          languages[subLang] = subLanguages[subLang];
        })
      }
    });
    return languages;
  }
  // For DAE Editor
  public static configureLists(daeConfig: DAEActiveEffectConfig | null) {
    //@ts-expect-error
    const systemVersion = game.system.version;
    const damageTypes = [...Object.values(daeSystemClass.systemConfig.damageTypes), ...Object.values(daeSystemClass.systemConfig.healingTypes)];

    this.traitList = Object.keys(daeSystemClass.systemConfig.damageTypes).reduce((obj: {}, key: string) => { obj[key] = daeSystemClass.systemConfig.damageTypes[key].label; return obj }, {})
    Object.keys(daeSystemClass.systemConfig.healingTypes).reduce((obj: {}, key: string) => { obj[key] = daeSystemClass.systemConfig.healingTypes[key].label; return obj }, this.traitList)
    Object.keys(this.traitList).forEach(type => {
      this.traitList[`-${type}`] = `- ${i18n(this.traitList[type])}`;
    });

    this.bypassesList = Object.entries(daeSystemClass.systemConfig.itemProperties)
      .filter(([key, value]) => daeSystemClass.systemConfig.itemProperties[key].isPhysical)
      .reduce((acc, [key, value]) => {
        //@ts-expect-error .label
        acc[key] = value.label
        return acc;
      }, {});

    this.languageList = foundry.utils.duplicate(daeSystemClass.systemConfig.languages);
    Object.keys(daeSystemClass.systemConfig.languages).forEach(type => {
      this.languageList = this.enumerateLanguages(daeSystemClass.systemConfig.languages);
    });

    this.armorClassCalcList = {};
    for (let acCalc in daeSystemClass.systemConfig.armorClasses) {
      this.armorClassCalcList[acCalc] = daeSystemClass.systemConfig.armorClasses[acCalc].label
    }

    this.conditionList = {};
    Object.keys(daeSystemClass.systemConfig.conditionTypes).forEach(ct => {
      this.conditionList[ct] = daeSystemClass.systemConfig.conditionTypes[ct].label;
      this.conditionList[`-${ct}`] = `- ${daeSystemClass.systemConfig.conditionTypes[ct].label}`;
    });

    this.toolProfList = foundry.utils.duplicate(daeSystemClass.systemConfig.toolProficiencies);
    Object.keys(daeSystemClass.systemConfig.toolProficiencies).forEach(type => {
      this.toolProfList[`-${type}`] = `- ${daeSystemClass.systemConfig.toolProficiencies[type]}`;
    });

    this.armorProfList = foundry.utils.duplicate(daeSystemClass.systemConfig.armorProficiencies);
    Object.keys(daeSystemClass.systemConfig.armorProficiencies).forEach(type => {
      this.armorProfList[`-${type}`] = `- ${daeSystemClass.systemConfig.armorProficiencies[type]}`;
    });

    this.weaponProfList = foundry.utils.duplicate(daeSystemClass.systemConfig.weaponProficiencies);
    Object.keys(daeSystemClass.systemConfig.weaponProficiencies).forEach(type => {
      this.weaponProfList[`-${type}`] = `- ${daeSystemClass.systemConfig.weaponProficiencies[type]}`;
    });
  }

  public static getOptionsForSpec(spec: any): any {
    const abilitiesList = Object.keys(daeSystemClass.systemConfig.abilities).reduce((obj: {}, key: string) => { obj[key] = daeSystemClass.systemConfig.abilities[key].label; return obj }, {});
    if (!spec?.key) return undefined;
    if (spec.key === "system.traits.languages.value")
      return this.languageList;
    if (spec.key === "system.traits.ci.value")
      return this.conditionList;
    if (spec.key.match(/system.tools..*prof/))
      return { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" };
    if (spec.key.match(/system.abilities..*proficient/))
      return { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" };
    if (spec.key.match(/system.tools..*ability/))
      return abilitiesList;
    if (spec.key === "system.traits.armorProf.value")
      return this.armorProfList;
    if (spec.key === "system.traits.weaponProf.value")
      return this.weaponProfList;
    if (["system.traits.di.value", "system.traits.dr.value", "system.traits.dv.value",
      "system.traits.da.value",
      "system.traits.idi.value", "system.traits.idr.value", "system.traits.idv.value",
      "system.traits.ida.value"].includes(spec.key))
      return this.traitList;
    if (["system.traits.di.custom", "system.traits.dr.custom", "system.traits.dv.custom", "system.traits.da.custom"].includes(spec.key)) {
      return daeSystemClass.systemConfig.customDamageResistanceTypes ?? {};
    }
    if (spec.key === "system.attributes.ac.calc") {
      return this.armorClassCalcList;
    }
    if (["system.traits.dm.bypasses", "system.traits.di.bypasses", "system.traits.dr.bypasses", "system.traits.dv.bypasses", "system.traits.da.bypasses"].includes(spec.key))
      return this.bypassesList;
    if (spec.key.includes("system.skills") && spec.key.includes("value"))
      return { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" };
    if (spec.key.includes("system.skills") && spec.key.includes("ability")) {
      if (game.system?.id === "dnd5e")
        return abilitiesList;
    }
    if (spec.key === "system.traits.size") {
      return Object.keys(daeSystemClass.systemConfig?.actorSizes).reduce((sizes, size) => {
        sizes[size] = daeSystemClass.systemConfig.actorSizes[size].label;
        return sizes;
      }, {});
    }
    return super.getOptionsForSpec(spec);
  }

  public static async editConfig() {
    if (game.system?.id === "dnd5e") {
      try {
        const pack = game.packs?.get(daeSystemClass.systemConfig.sourcePacks.ITEMS);
        const profs = [
          { type: "tool", list: this.toolProfList },
          { type: "armor", list: this.armorProfList },
          { type: "weapon", list: this.weaponProfList }
        ];
        for (let { type, list } of profs) {
          let choices = daeSystemClass.systemConfig[`${type}Proficiencies`];
          const ids = daeSystemClass.systemConfig[`${type}Ids`];
          if (ids !== undefined) {
            const typeProperty = (type !== "armor") ? `${type}Type` : `armor.type`;
            for (const [key, id] of Object.entries(ids)) {
              //@ts-expect-error .documents
              const item = game.system.documents.Trait.getBaseItem(id, { indexOnly: true })
              // const item = await pack.getDocument(id);
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
  }

  /*
   * do custom effefct applications
   * damage resistance/immunity/vulnerabilities
   * languages
   */
  public static daeCustomEffect(actor, change, current, delta, changes) {
    if (!super.daeCustomEffect(actor, change)) return;
    const systemConfig = daeSystemClass.systemConfig;
    // const current = foundry.utils.getProperty(actor, change.key);
    var validValues;
    var value;
    if (typeof change?.key !== "string") return true;
    const damageBonusMacroFlag = `flags.${game.system?.id}.DamageBonusMacro`;
    if (change.key === damageBonusMacroFlag) {
      let macroRef = change.value;
      const macroItem = getActorItemForEffect(change.effect);
      if (change.value === "ItemMacro") { // rewrite the ItemMacro if there is an origin
        macroRef = `ItemMacro.${macroItem.uuid}`;
      } else if (change.value === "ActivityMacro" && change.effect.activity?.includes("Activity.")) {
        macroRef = `ActivityMacro.${change.effect.activity}`;
      } else if (change.value === "ActivityMacro") {
        macroRef = `ActivityMacro.${macroItem.uuid}`;
      }
      const current = foundry.utils.getProperty(actor, change.key);
      // includes wont work for macro names that are subsets of other macro names
      if (noDupDamageMacro && current?.split(",").some(macro => macro === macroRef)) return true;
      foundry.utils.setProperty(actor, change.key, current ? `${current},${macroRef}` : macroRef)
      return true;
    }
    if (change.key.includes(`flags.${game.system?.id}`) && daeSystemClass.systemConfig.characterFlags[change.key.split(".").pop()]) {
      if (change.key.includes(`flags.${game.system?.id}`) && daeSystemClass.systemConfig.characterFlags[change.key.split(".").pop()]?.type !== String) {
        const type = daeSystemClass.systemConfig.characterFlags[change.key.split(".").pop()]?.type ?? Boolean;
        const rollData = actor.getRollData();
        const flagValue = foundry.utils.getProperty(rollData, change.key) || 0;
        // ensure the flag is not undefined when doing the roll, supports flagName @flags.dae.flagName + 1
        foundry.utils.setProperty(rollData, change.key, flagValue);
        let value = this.safeEval(this.safeEvalExpression(change.value, rollData), rollData);
        if (type === Boolean) foundry.utils.setProperty(actor, change.key, value ? true : false);
        else foundry.utils.setProperty(actor, change.key, value);
        return true;
      }

      if (change.key.includes(`flags.${game.system?.id}`) && daeSystemClass.systemConfig.characterFlags[change.key.split(".").pop()]?.type !== Boolean) {
        return true;
      }
    }
    if (change.key.startsWith("system.skills.") && change.key.endsWith(".value")) {
      const currentProf = foundry.utils.getProperty(actor, change.key) || 0;
      const profValues = { "0.5": 0.5, "1": 1, "2": 2 };
      const upgrade = profValues[change.value]
      if (upgrade === undefined) return;
      let newProf = Number(currentProf) + upgrade;
      if (newProf > 1 && newProf < 2) newProf = 1;
      if (newProf > 2) newProf = 2;
      return foundry.utils.setProperty(actor, change.key, newProf);
    }

    if (change.key.startsWith("system.abilities") && (change.key.endsWith("bonuses.save") || change.key.endsWith("bonuses.check"))) {
      value = change.value;
      if (!current) return foundry.utils.setProperty(actor, change.key, value)
      value = current + ((change.value.startsWith("+") || change.value.startsWith("-")) ? change.value : "+" + change.value);
      return foundry.utils.setProperty(actor, change.key, value)
    }

    if (change.key.startsWith("system.tools")) {
      current = actor.system.tools;
      if (change.key === "system.tools.all") {
        for (let prof in this.toolProfList) {
          if (current[prof]) continue;
          current[prof] = { value: 1, ability: "int", bonuses: { check: "" } }
        }
        return true;
      }
      const [_1, _2, tool, key] = change.key.split(".");
      current[tool] = foundry.utils.mergeObject({ value: 1, ability: "int", bonuses: { check: "" } }, current[tool] ?? {})
      if (key === "prof") {
        value = Number(change.value);
        current[tool].value = value;
      }
      if (key === "ability") {
        current[tool].ability = change.value;
      }
      if (key === "bonus") {
        foundry.utils.setProperty(current[tool], "bonuses.check", change.value);
      }
      return true;
    }

    switch (change.key) {
      case "system.attributes.movement.hover":
        foundry.utils.setProperty(actor, change.key, change.value ? true : false);
        return true;
      case "system.traits.di.all":
      case "system.traits.dr.all":
      case "system.traits.da.all":
      case "system.traits.dv.all":
      case "system.traits.sdi.all":
      case "system.traits.sdr.all":
      case "system.traits.sdv.all":
        const key = change.key.replace(".all", ".value")
        foundry.utils.setProperty(actor, key, new Set(Object.keys(systemConfig.damageTypes).filter(k => !["healing", "temphp"].includes(k))));
        return true;
      case "system.traits.di.value":
      case "system.traits.dr.value":
      case "system.traits.dv.value":
      case "system.traits.da.value":
      case "system.traits.sdi.value":
      case "system.traits.sdr.value":
      case "system.traits.sdv.value":
      case "system.traits.idi.value":
      case "system.traits.idr.value":
      case "system.traits.idv.value":
      case "system.traits.ida.value":
        return super.doCustomArrayValue(actor, current, change, Object.keys(systemConfig.damageTypes));
      case "system.traits.di.bypasses":
      case "system.traits.dr.bypasses":
      case "system.traits.dv.bypasses":
      case "system.traits.da.bypasses":
      case "system.traits.dm.bypasses":
        const validKeys: string[] = Object.keys(daeSystemClass.systemConfig.itemProperties)
          .filter(key => daeSystemClass.systemConfig.itemProperties[key].isPhysical)
        return super.doCustomArrayValue(actor, current, change, validKeys);
      case "system.traits.da.custom":
      case "system.traits.di.custom":
      case "system.traits.dr.custom":
      case "system.traits.dv.custom":
      case "system.traits.sdi.custom":
      case "system.traits.sdr.custom":
      case "system.traits.sdv.custom":
      case "system.traits.ci.custom":
        value = (current ?? "").length > 0 ? current.trim().split(";").map(s => s.trim()) : [];
        const traitSet = new Set(value);
        traitSet.add(change.value);
        value = Array.from(traitSet).join("; ");
        foundry.utils.setProperty(actor, change.key, value)
        return true;
      case "system.traits.languages.custom":
      case "system.traits.armorProf.custom":
      case "system.traits.weaponProf.custom":
        value = (current ?? "").length > 0 ? current.trim().split(";").map(s => s.trim()) : [];
        const setValue = new Set(value);
        setValue.add(change.value);
        value = Array.from(setValue).join("; ");
        foundry.utils.setProperty(actor, change.key, value)
        return true;
      case "system.traits.languages.all":
        if (actor.system.traits.languages.value instanceof Set)
          foundry.utils.setProperty(actor, "system.traits.languages.value", new Set(Object.keys(DAESystemDND5E.enumerateLanguages(daeSystemClass.systemConfig.languages))))
        else
          foundry.utils.setProperty(actor, "system.traits.languages.value", Object.keys(systemConfig.languages))
        return true;
      case "system.traits.languages.value":
        return super.doCustomArrayValue(actor, current, change, Object.keys(this.languageList));
      case "system.traits.ci.all":
        if (actor.system.traits.ci.value instanceof Set)
          foundry.utils.setProperty(actor, "system.traits.ci.value", new Set(Object.keys(systemConfig.conditionTypes)))
        else
          foundry.utils.setProperty(actor, "system.traits.ci.value", Object.keys(systemConfig.conditionTypes))
        return true;
      case "system.traits.ci.value":
        return super.doCustomArrayValue(actor, current, change, Object.keys(systemConfig.conditionTypes))
      case "system.traits.armorProf.value":
        return super.doCustomArrayValue(actor, current, change, undefined)
      case "system.traits.armorProf.all":
        if (actor.system.traits.armorProf?.value) {
          if (actor.system.traits.armorProf?.value instanceof Set)
            foundry.utils.setProperty(actor, "system.traits.armorProf.value", new Set(Object.keys(this.armorProfList).filter(k => !k.startsWith("-"))));
          else
            foundry.utils.setProperty(actor, "system.traits.armorProf.value", Object.keys(this.armorProfList).filter(k => !k.startsWith("-")));
        }
        return true;

      case "system.traits.weaponProf.value": // TODO v10 armor and weapon proiciencies
        return super.doCustomArrayValue(actor, current, change, undefined)
      case "system.traits.weaponProf.all":
        if (actor.system.traits.weaponProf?.value) {
          if (actor.system.traits.weaponProf.value instanceof Set)
            foundry.utils.setProperty(actor, "system.traits.weaponProf.value", new Set(Object.keys(this.weaponProfList).filter(k => !k.startsWith("-"))));
          else
            foundry.utils.setProperty(actor, "system.traits.weaponProf.value", Object.keys(this.weaponProfList).filter(k => !k.startsWith("-")));
        }
        return true;
      case "system.bonuses.weapon.damage":
        value = this.attackDamageBonusEval(change.value, actor)
        if (current)
          value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
        this.weaponAttacks.forEach(atType => actor.system.bonuses[atType].damage += value);
        return true;
      case "system.bonuses.spell.damage":
        value = this.attackDamageBonusEval(change.value, actor)
        if (current)
          value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
        this.spellAttacks.forEach(atType => actor.system.bonuses[atType].damage += value);
        return true;
      case "system.bonuses.mwak.attack":
      case "system.bonuses.mwak.damage":
      case "system.bonuses.rwak.attack":
      case "system.bonuses.rwak.damage":
      case "system.bonuses.msak.attack":
      case "system.bonuses.msak.damage":
      case "system.bonuses.mpak.attack":
      case "system.bonuses.mpak.damage":
      case "system.bonuses.rpak.attack":
      case "system.bonuses.rpak.damage":
      case "system.bonuses.rsak.attack":
      case "system.bonuses.rsak.damage":
      case "system.bonuses.heal.attack":
      case "system.bonuses.heal.damage":
      case "system.bonuses.abilities.save":
      case "system.bonuses.abilities.check":
      case "system.bonuses.abilities.skill":
      case "system.bonuses.power.forceLightDC":
      case "system.bonuses.power.forceDarkDC":
      case "system.bonuses.power.forceUnivDC":
      case "system.bonuses.power.techDC":
        // TODO: remove if fixed in core
        let result = this.attackDamageBonusEval(change.value, actor);
        value = result;
        if (current)
          value = (result.startsWith("+") || result.startsWith("-")) ? result : "+" + result;
        foundry.utils.setProperty(actor, change.key, (current || "") + value);
        return true;

      case "system.attributes.movement.all":
        const movement = actor.system.attributes.movement;
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
            if (!movement[key]) continue;
            valueString = `${movement[key]} ${change.value}`;
          }
          try {
            const roll = new Roll(valueString, actor.getRollData());
            let result;
            if (!roll.isDeterministic) {
              error(`Error evaluating system.attributes.movement.all = ${valueString}. Roll is not deterministic for ${actor.name} ${actor.uuid} dice terms ignored`)
            }
            result = roll.evaluateSync({ strict: false }).total;
            movement[key] = Math.floor(Math.max(0, result) + 0.5);
          } catch (err) {
            console.warn(`dae | Error evaluating custom movement.all = ${valueString}`, key, err)
          }
        };
        return true;
      case "system.attributes.powerForceLightDC":
      case "system.attributes.powerForceDarkDC":
      case "system.attributes.powerForceUnivDC":
      case "system.attributes.powerTechDC":
        if (Number.isNumeric(change.value)) {
          value = parseInt(change.value);
        } else {
          try {
            const roll = new Roll(change.value, actor.getRollData());
            if (!roll.isDeterministic) {
              error(`Error evaluating ${change.key} = ${change.value}`, `Roll is not deterministic for ${actor.name} dice terms ignored`)
            }
            value = roll.evaluateSync({ strict: false }).total;
          } catch (err) { };
        }
        if (value !== undefined) {
          foundry.utils.setProperty(actor, change.key, Number(current) + value);
        } else return;

        return true;

      case "flags.dae":
        let list = change.value.split(" ");
        const flagName = list[0];
        let formula = list.splice(1).join(" ")
        const rollData = actor.getRollData();
        const flagValue = foundry.utils.getProperty(rollData.flags, `dae.${flagName}`) || 0;
        // ensure the flag is not undefined when doing the roll, supports flagName @flags.dae.flagName + 1
        foundry.utils.setProperty(rollData, `flags.dae.${flagName}`, flagValue);
        let roll = new Roll(formula, rollData);
        if (!roll.isDeterministic) {
          error(`dae | Error evaluating flags.dae.${flagName} = ${formula}. Roll is not deterministic for ${actor.name} ${actor.uuid} dice terms ignored`)
        }
        value = roll.evaluateSync({ strict: false }).total;
        foundry.utils.setProperty(actor, `flags.dae.${flagName}`, value);
        return true;
    }
  }
  static getRollDataFunc() {
    return getRollData;
  }
}
// this function replaces applyActiveEffects in Actor
function applyBaseEffects() {
  if (this._prepareScaleValues) this._prepareScaleValues();
  if (this.system?.prepareEmbeddedData instanceof Function) this.system.prepareEmbeddedData();

  // The Active Effects do not have access to their parent at preparation time, so we wait until this stage to

  // Handle traits.ci specially
  // CI disable other effects so need to be processed before other effects
  const traitsCI = {};
  traitsCI["system.traits.ci.all"] = ValidSpec.actorSpecs[this.type].allSpecsObj["system.traits.ci.all"];
  traitsCI["system.traits.ci.value"] = ValidSpec.actorSpecs[this.type].allSpecsObj["system.traits.ci.value"];
  applyDaeEffects.bind(this)({ specList: traitsCI, excludeSpecs: {}, allowAllSpecs: false, wildCardsInclude: [], wildCardsExclude: [], doStatusEffects: false });
  applyDaeEffects.bind(this)({ specList: ValidSpec.actorSpecs[this.type].baseSpecsObj, excludeSpecs: ValidSpec.actorSpecs[this.type].derivedSpecsObj, allowAllSpecs: true, wildCardsInclude: wildcardEffects, wildCardsExclude: [], doStatusEffects: true });
}

function prepareData(wrapped) {
  //@ts-expect-error
  const systemVersion = game.system.version;
  if (!ValidSpec.actorSpecs) {
    ValidSpec.createValidMods();
  }

  try {
    this.statuses ??= new Set();
    // Identify which special statuses had been active
    const specialStatuses = new Map();
    for (const statusId of Object.values(CONFIG.specialStatusEffects)) {
      specialStatuses.set(statusId, this.statuses.has(statusId));
    }
    this.statuses.clear(); // need to do this here since core foundry does this in applyActiveEffects, but we do multiple calls to applyEffects
    if (this.system.traits) {
      for (let key of ["da", "ida", "idr", "idv", "idi"]) {
        if (!(this.system.traits[key]?.value instanceof Set)) {
          this.system.traits[key] = { value: new Set(), bypasses: new Set(), custom: '' };
        }
      }
    }

    foundry.utils.setProperty(this, "flags.dae.onUpdateTarget", foundry.utils.getProperty(this._source, "flags.dae.onUpdateTarget"));

    this.overrides = {};
    // Call the original prepare data - with foundry's apply effects replaced by dae's
    wrapped();
    const hasHeavy = this.items.some(i => i.system.equipped && i.system.properties.has("stealthDisadvantage"));
    if (hasHeavy) foundry.utils.setProperty(this, "flags.midi-qol.disadvantage.skill.ste", true);
    // Extra pass of applying effects after prepare data has run to support referencing derived data
    applyDaeEffects.bind(this)({ specList: ValidSpec.actorSpecs[this.type].derivedSpecsObj, excludeSpecs: {}, allowAllSpecs: false, wildCardsInclude: [], wildCardsExclude: wildcardEffects, doStatusEffects: true });

    // Allow for changes made by effects
    preparePassiveSkills.bind(this)();
    const globalBonuses = this.system.bonuses?.abilities ?? {};
    const rollData = this.getRollData();
    const checkBonus = simplifyBonus(globalBonuses?.check, rollData);
    if (this._prepareInitiative && this.system?.attributes)
      this._prepareInitiative(rollData, checkBonus);
    // Apply special statuses that changed to active tokens
    let tokens;
    for (const [statusId, wasActive] of specialStatuses) {
      const isActive = this.statuses.has(statusId) && !this.system.traits?.ci.value.has(statusId);
      if (isActive === wasActive) continue;
      if (!tokens) tokens = this.getActiveTokens();
      for (const token of tokens) token._onApplyStatusEffect(statusId, isActive);
    }
    if (debugEnabled > 1) debug("prepare data: after passes", this);

    // Apply effects to items - moved after the rest of actor prepare data instead of default dnd5e behaviour
    for (let item of this.items) {
      _itemApplyActiveEffects.bind(item)();
    }

    const conditionImmunities = this.system.traits?.ci?.value;
    if (conditionImmunities) {
      for (const condition of conditionImmunities) this.statuses.delete(condition);
    }
  } catch (err) {
    console.error("Could not prepare data ", this.name, err);
  }
}
const getTargetType = field => {
  // @ts-expect-error
  const FormulaField = game.system?.dataModels.fields.FormulaField;
  const ActiveEffect5eFormulaFields: Set<string> = CONFIG.ActiveEffect.documentClass.FORMULA_FIELDS
  if ((field instanceof FormulaField) || ActiveEffect5eFormulaFields.has(field)) return "formula";
  else if (field instanceof foundry.data.fields.ArrayField) return "Array";
  else if (field instanceof foundry.data.fields.ObjectField) return "Object";
  else if (field instanceof foundry.data.fields.BooleanField) return "boolean";
  else if (field instanceof foundry.data.fields.NumberField) return "number";
  else if (field instanceof foundry.data.fields.StringField) return "string";
};

function _baseItemApplyEffects() {
  // It seems that this is called with embedded preparation when first initialising and also when cloning.
  // Since we can't tell if it will later get called from prepareData the best we can do is apply all effects now
  return doItemApplyEffects.bind(this)(undefined, undefined, {});

  if (this.isOwned)
    return doItemApplyEffects.bind(this)(undefined, [...ValidSpec.itemSpecs["union"].derivedSpecKeys, ...ValidSpec.itemSpecs["union"].excludeKeys], {});
  else // item is a sidebar.compendium item so don't ignore anything
    return doItemApplyEffects.bind(this)(undefined, undefined, {});
}
function _itemApplyActiveEffects() {
  // since baseItemApplyEffects will apply all effects we can't do it gain here
  return;
  return doItemApplyEffects.bind(this)(ValidSpec.itemSpecs["union"].derivedSpecKeys, ValidSpec.itemSpecs["union"].excludeKeys, this.overrides ?? {});
}

function doItemApplyEffects(includeKeys: string[] | undefined, excludeKeys: string[] | undefined, overrides: any) {
  if (this.actor?._embeddedPreparation) { // embedded preparation means this is only called once after actor preparation - so allow all effects to be applied 
    includeKeys = undefined;
    excludeKeys = undefined;
  }
  // Organize non-disabled changes by their application priority
  let changes: any[] = [];

  for (const effect of this.allApplicableEffects()) {
    if (!effect.active) continue;
    let possibleChanges = effect.changes;
    if (includeKeys) possibleChanges = possibleChanges.filter(c => includeKeys.includes(c.key));
    if (excludeKeys) possibleChanges = possibleChanges.filter(c => !excludeKeys.includes(c.key));
    changes.push(...possibleChanges.map(change => {
      let field = change.key.startsWith("system.")
        ? this.system.schema.getField(change.key.slice(7))
        : this.schema.getField(change.key);
      const targetType = getTargetType(field);
      const c = foundry.utils.deepClone(change);
      if (typeof c.value === "string") {
        const rollData = this.getRollData();

        rollData.mod = rollData.abilities?.[this.abilityMod]?.mod ?? 0;
        if (targetType !== "formula" && targetType !== "string")
          c.value = c.value.replaceAll("##", "@"); // can't defer this evaluation
        const unmapped = ["UUID", "uuid"];
        for (let unmap of unmapped) {
          c.value = c.value.replaceAll(`@${unmap}`, `##${unmap}`);
        }
        if (!["Array", "Object", "formula", undefined].includes(targetType)) {
          let expressionpre = Roll.replaceFormulaData(c.value, rollData, { missing: "0" });
          const expression = daeSystemClass.safeEvalExpression(expressionpre, rollData);
          let result = expression.replaceAll("##", "@");
          if (targetType && ["boolean", "number"].includes(targetType)) {
            result = daeSystemClass.safeEval(expression, rollData, expression) ?? expression;
          }
          c.value = typeof result === "string" ? result : JSON.stringify(result);
        }
      }
      c.effect = effect;
      c.priority ??= c.mode * 10;
      return c;
    }));
  }
  
  changes.sort((a, b) => a.priority - b.priority);

  // Apply all changes
  for (const change of changes) {
    if (!change.key) continue;
    const changes = change.effect.apply(this, change);
    Object.assign(overrides, changes);
  }
  // Expand the set of final overrides
  this.overrides = foundry.utils.expandObject(overrides);
}

function getRollData(wrapped, ...args) {
  // Can only have one getRollData wrapper so need call the parent one by hand
  const data = DAESystem.getRollDataFunc().bind(this)(wrapped, ...args);
  if (!data.flags) {
    data.flags = { ...this.flags };
  }
  data.effects = this.appliedEffects;
  data.actorId = this.id;
  data.actorUuid = this.uuid;
  data.statusesSet = this.statuses; //dnd5e now sets rollData.statuses to be an object indicating the count.
  // TODO see what config can be safely added without breaking item/actor sheets. data.config = CONFIG.DND5E;

  if (!data.token) Object.defineProperty(data, "token", {
    get() {
      if (!data._token) {
        const actor = actorFromUuid(data.actorUuid ?? "");
        const token = getSelfTarget(actor);
        // If the return is a tokenDocument then we have no token on the scene
        if (token instanceof Token) data._token = token;
      }
      return data._token;
    },
    set(token) { data._token = token; }
  });

  if (!data.tokenUuid) Object.defineProperty(data, "tokenUuid", {
    get() { // During initialisation getSelfTarget will return a token document not a token
      if (data._tokenUuid) return data._tokenUuid;
      if (data.token instanceof Token)
        return data.token?.document.uuid ?? "undefined";
      else return data.token?.uuid ?? "undefined"
    },
    set(uuid) {
      data._tokenUuid = uuid;
    }
  });
  if (!data.tokenId) Object.defineProperty(data, "tokenId", {
    get() { return data._tokenId ?? data.token?.id ?? "undefined" },
    set(tokenId) { data._tokenId = tokenId }
  });
  return data;
}

async function preparePassiveSkills() {
  const skills = this.system.skills;
  if (!skills) return;
  for (let skillId of Object.keys(skills)) {
    const skill = this.system.skills[skillId];
    const abilityId = skill.ability;
    const advdisadv = procAdvantageSkill(this, abilityId, skillId);
    skill.passive = skill.passive + 5 * advdisadv;
  }
}


function simplifyBonus(bonus, data = {}) {
  if (!bonus) return 0;
  if (Number.isNumeric(bonus)) return Number(bonus);
  try {
    const roll = new Roll(bonus, data);
    return roll.isDeterministic ? Roll.safeEval(roll.formula) : 0;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

function procAdvantageSkill(actor, abilityId, skillId): number {
  const midiFlags = actor.flags["midi-qol"] ?? {};
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


// This is broken
async function _prepareActorArmorClassAttribution(wrapped, data) {
  let attributionHtml = await wrapped(data);
  const attributions: any[] = [];
  if (this.object?.effects) {
    for (let effect of this.appliedEffects) {
      for (let change of effect.changes) {
        if ((change.key === "system.attributes.ac.value" || change.key === "system.attributes.ac.bonus" && !Number.isNumeric(change.value)) && !effect.disabled && !effect.isSuppressed) {
          attributions.push({
            label: `${effect.name} (dae)`,
            mode: change.mode,
            value: change.value
          })
        }
      }
    }
  }
  if (attributions.length > 0) {
    //@ts-expect-error
    const extraHtml = new game.system.application.PopertyAttribution(this, attributions, "attributions.ac", { title: "" }).renderTooltip();
    attributionHtml += extraHtml;
  }
  return attributionHtml;
}

function _prepareArmorClassAttribution(wrapped, data) {
  const attributions = wrapped(data);
  if (this.object?.effects) {
    for (let effect of this.object.effects) {
      for (let change of effect.changes) {
        if ((change.key === "system.attributes.ac.value" || change.key === "system.attributes.ac.bonus" && !Number.isNumeric(change.value)) && !effect.disabled && !effect.isSuppressed) {
          attributions.push({
            label: `${effect.name} (dae)`,
            mode: change.mode,
            value: change.value
          })
        }
      }
    }
  }
  return attributions;
}

function patchPrepareArmorClassAttribution() {
  //@ts-expect-error
  const systemVersion = game.system.version;
  if (game.system?.id === "dnd5e") {
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype._prepareArmorClassAttribution", _prepareActorArmorClassAttribution, "WRAPPER");
  } else if (game.system?.id === "sw5e") {
    libWrapper.register("dae", "CONFIG.Actor.sheetClasses.character['sw5e.ActorSheet5eCharacter'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
    libWrapper.register("dae", "CONFIG.Actor.sheetClasses.npc['sw5e.ActorSheet5eNPC'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
    libWrapper.register("dae", "CONFIG.Actor.sheetClasses.vehicle['sw5e.ActorSheet5eVehicle'].cls.prototype._prepareArmorClassAttribution", _prepareArmorClassAttribution, "WRAPPER");
  }
}

export function getActorItemForEffect(effect: any /* ActiveEffect */) {
  if (effect.parent instanceof CONFIG.Item.documentClass && effect.parent.isEmbedded) return effect.parent;
  if (!effect.origin) return undefined;
  const parts = effect.origin?.split(".") ?? [];
  const [parentType, parentId, documentType, documentId] = parts;
  let item;
  // Case 1: effect is a linked or sidebar actor - only if the actor ids match
  // During preparation effect.parent.id is undefined so we need to check for that
  if (parentType === "Actor" && documentType === "Item" && (!effect.parent.id || parentId === effect.parent.id)) {
    item = effect.parent.items.get(documentId);
  }
  // Case 2: effect is a synthetic actor on the scene - only if the token ids match
  else if (parentType === "Scene") {
    const itemUuid = effect.origin.replace(/\.ActiveEffect\..*$/, "");
    const [parentType, parentId, tokeyType, tokenId, syntheticActor, y, syntheticItem, syntheticItemId] = parts;
    if ((tokenId === effect.parent.token?.id) && (syntheticItem === "Item"))
      item = effect.parent.items.get(syntheticItemId);
  }
  // Case 3: effect is a compendium item - only if the item id is present on the actor
  if (parentType === "Compendium") {
    let matches = effect.origin.match(/Compendium\.(.+)\.(.+?)Item\.(.+)/);
    if (matches && matches[3]) item = effect.parent.items.get(matches[3]);
  }
  return item;
}

function determineSuppression() {
  this.isSuppressed = false;
  // if (this.disabled) return; dnd5e does not do this check
  if (isEnchantment(this)) return;

  // DND5e currently does not work with unlinked tokens and suppression determination so this is overtide
  // TODO make this a WRAPPER when dnd5e fixes the unlinked token bug

  let actor;
  if (this.parent instanceof CONFIG.Actor.documentClass) actor = this.parent;
  else if (this.parent instanceof CONFIG.Item.documentClass) actor = this.parent.parent;
  if (!actor) return;

  if (globalThis.MidiQOL && foundry.utils.getProperty(this, "flags.dae.disableIncapacitated")) {
    // if (actor) this.isSuppressed = actor.statuses.has("incapacitated");
    if (actor) this.isSuppressed = globalThis.MidiQOL.checkIncapacitated(actor);
  }

  if (this.parent instanceof CONFIG.Item.documentClass && effectIsTransfer(this)) {
    // If the parent of the effect is an item then supressed is based on the item
    this.isSuppressed = this.isSuppressed || this.parent.areEffectsSuppressed;
    return;
  }
  //TODO revisit when dnd5e is fixed
  // This is an actor effect and it's a transfer effect
  if (this.parent instanceof CONFIG.Actor.documentClass && effectIsTransfer(this)) {
    const item = getActorItemForEffect(this);
    if (item) this.isSuppressed = this.isSuppressed || item.areEffectsSuppressed;
  }

  if (this.parent?.system.traits) {
    let customStats: Array<string> = this.parent.system.traits.ci?.custom?.split(';').map(s => s.trim().toLocaleLowerCase());
    const ci = new Set([...(this.parent.system.traits?.ci?.value ?? []), ...customStats]);
    const statusId = foundry.utils.duplicate(this.name ?? "no effect").toLocaleLowerCase();
    const capStatusId = foundry.utils.duplicate(statusId).replace(statusId[0], statusId[0].toUpperCase())
    const ciSuppressed = ci?.has(statusId) || ci?.has(`Convenient Effect: ${capStatusId}`);
    if (Boolean(ciSuppressed)) {
      this.isSuppressed = true;
      this.disabled = true;
    }
  }
}

function preUpdateItemHook(candidateItem, updates, context, user) {
  if (!candidateItem.isOwned) return true;
  if (game.user?.id !== user) return true;
  const actor: Actor = candidateItem.parent;
  if (!(actor instanceof Actor)) return true;
  if (updates.system?.equipped === undefined && updates.system?.attunement === undefined && updates.system?.attuned === undefined) return true;
  try {
    const wasSuppressed = candidateItem.areEffectsSuppressed;
    const updatedItem = candidateItem.clone({
      "system.equipped": updates.system?.equipped ?? candidateItem.system.equipped,
      "system.attunement": updates.system?.attunement ?? candidateItem.system.attunement,
      "system.attuned": updates.system?.attuned ?? candidateItem.system.attuned
    });
    const isSuppressed = updatedItem.areEffectsSuppressed;
    if (wasSuppressed === isSuppressed) return true;
    const tokens = actor.getActiveTokens();
    const token = tokens[0];
    if (CONFIG.ActiveEffect.legacyTransferral === false && candidateItem.isOwned && candidateItem.parent instanceof CONFIG.Actor.documentClass) {
      for (let effect of candidateItem.effects) {
        if (!effectIsTransfer(effect)) continue;
        const actor = candidateItem.parent;
        for (let change of effect.changes) {
          if (isSuppressed) {
            removeEffectChange(actor, tokens, effect, candidateItem, change, context);
          } else {
            addEffectChange(actor, tokens, effect, candidateItem, change, context);
          }
        }
      }
    }
    // For non-legacy transferral we need to update the actor effects
    for (let effect of actor.effects) {
      if (!effectIsTransfer(effect) || effect.origin !== candidateItem.uuid) continue;
      for (let change of effect.changes) {
        if (isSuppressed) removeEffectChange(actor, tokens, effect, candidateItem, change, context);
        else addEffectChange(actor, tokens, effect, candidateItem, change, context);
      }
      /*
      // Toggle macro.XX effects
      if (effect.changes.some(change => change.key.startsWith("macro.execute") || change.key.startsWith("macro.itemMacro") || change.key.startsWith("macro.actorUpdate")))
        foundry.utils.setProperty(effect, "flags.dae.itemUuid", candidateItem.uuid);
      */
      warn("action queue add suppressed ", actionQueue._queue.length)
    }
  } catch (err) {
    console.warn("dae | preItemUpdate ", err)
  } finally {
    return true;
  }
}

if (!globalThis.daeSystems) globalThis.daeSystems = {};
foundry.utils.setProperty(globalThis.daeSystems, "dnd5e", DAESystemDND5E);

async function _onDropActiveEffect(event, data) {
  const effect = await ActiveEffect.implementation.fromDropData(data);
  if (!this.item.isOwner || !effect) return false;
  if ((this.item.uuid === effect.parent?.uuid) || (this.item.uuid === effect.origin)) return false;
  return CONFIG.ActiveEffect.documentClass.create({
    ...effect.toObject(),
    origin: this.item.uuid
  }, { parent: this.item });
}

function daeApply(wrapped, actor, change) {
  try {
    const { key, value } = change;
    let originalReturn = wrapped(actor, change);
    // Intercept the dnd5e behaviour for custom mode flags.dnd5e boolean flags.
    if (change.mode !== 0 || !change.key.startsWith("flags.dnd5e.")) return originalReturn;
    const data = daeSystemClass.systemConfig.characterFlags[key.replace("flags.dnd5e.", "")];
    if (data?.type !== Boolean) return originalReturn;
    // Need to avoid the dnd5e behaviour of "0" evaluating to true and forcing the change.value to a boolean
    change.value = value; // restore the original change value since dnd5e will have forced it to boolean.
    // ActiveEffect.apply will bypass the dnd5e apply
    return ActiveEffect.prototype.apply.bind(this)(actor, change);
  } catch (err) {
    console.error("dae | daeApply ", err, change, actor)
    throw err;
  }
}