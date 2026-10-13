
import { AnyObject } from "fvtt-types/utils";
import { daeSpecialDurations, debug, debugEnabled, error, i18n, i18nFormat, warn } from "../../dae.js";
import { addAutoFields } from "../apps/DAEActiveEffectConfig.js";
import { BaseValuesInner, actionQueue, actorFromUuid, daeApplyActiveEffects, daeApplyChange, daeShouldApplyChange, daeMacro, daeInitMacroActors, effectIsTransfer, enumerateBaseValues, getSelfTarget, getStaticID, libWrapper, localizationMap, midiActive, noDupDamageMacro, pendingInitMacroEffects, processEffectChanges, usesLegacyApplication } from "../dae.js";
import { DAESystem, ValidSpec, wildcardEffects } from "./DAESystem.js";
import { grantOnRolledPlacement } from "../lib/currentHp.js";
import { getEffectItemData, getEffectSource } from "../lib/effectSource.js";

const { SchemaField, ArrayField, ObjectField, BooleanField, NumberField, StringField, SetField } = foundry.data.fields;

export class DAESystemDND5E extends DAESystem {
  static traitList: Record<string, string>;
  static languageList: Record<string, string>;
  static conditionList: Record<string, string>;
  static bypassesList: Record<string, string>;
  static customDamageResistanceList: Record<string, string>;
  static armorClassCalcList: Record<string, string>;
  static toolProfList: Record<string, string>;
  static armorProfList: Record<string, string>;
  static weaponProfList: Record<string, string>;

  public static get systemConfig() {
    return CONFIG.DND5E;
  }

  public static getItemSpecs() {
    // const { AppliedEffectField } = globalThis.dnd5e.dataModels.activity.AppliedEffectField;

    // Setup Item Specs
    let itemSpecs = enumerateBaseValues(CONFIG.Item.dataModels);
    const activitySpecsRaw = enumerateBaseValues(globalThis.dnd5e.dataModels.activity, false);
    const activitySpecs: BaseValuesInner = {};
    for (let k of Object.keys(activitySpecsRaw).filter(i => !i.endsWith("ActivityData"))) {
      delete activitySpecsRaw[k];
    };
    const overrideSuffixes = [
      ".ability",
      ".activation.type",
      ".duration.units",
      ".range.units",
      ".target.template.type",
      ".target.template.units",
      ".target.affects.type",
      ".attack.type.value",
      ".attack.type.classification",
      // TODO: THIS
      // ".dc.calculation",
      ".healing.scaling.mode",
      // ".damage.onSave",
      // ".summon.mode",
      "[transform].settings.preset"
    ]
    for (let rawActivityKey of Object.keys(activitySpecsRaw)) {
      const activityKey = rawActivityKey.replace("ActivityData", "").toLocaleLowerCase();
      let activityLabel = i18n(`DND5E.${activityKey.toUpperCase()}.Title.one`);
      if (activityLabel.startsWith("DND5E.")) activityLabel = i18n(`DND5E.${activityKey.toUpperCase()}.Title`);
      for (let rawKey of Object.keys(activitySpecsRaw[rawActivityKey])) {
        const key = rawKey.replace("system.", "");
        if (["_id", "type"].includes(key)) continue;
        activitySpecs[`activities[${activityKey}].${key}`] = activitySpecsRaw[rawActivityKey][rawKey];
        // activitySpecs[`activities[${activityKey}].${key}`][0].label = `${activityLabel} ${i18n("DND5E.ACTIVITY.Title.other")} ${key}`;
        localizationMap[`activities[${activityKey}].${key}`] ??= {
          name: i18n(`dae.genericSuffixes.${key}.name`),
          description: i18n(`dae.genericSuffixes.${key}.description`)
        };
        // Force override only for single-value enum fields. Never force it on a SetField (e.g.
        // activities[save].save.ability is a Set of abilities) — those should allow all modes.
        if (overrideSuffixes.some(k => key.endsWith(k)) && !(activitySpecs[`activities[${activityKey}].${key}`][0] instanceof SetField))
          activitySpecs[`activities[${activityKey}].${key}`][1] = "override";
      }
      if (game.modules.get("midi-qol")?.active) {
        activitySpecs[`activities[${activityKey}].useConditionText`] = [new StringField({ label: i18n("midi-qol.FIELDS.useConditionText.hint") }), ""];
        activitySpecs[`activities[${activityKey}].effectConditionText`] = [new StringField({ label: i18n("midi-qol.FIELDS.effectConditionText.hint") }), ""];
        activitySpecs[`activities[${activityKey}].macroData.name`] = [new StringField({ label: "Macro Name" }), ""];
        activitySpecs[`activities[${activityKey}].macroData.command`] = [new StringField({ label: "Macro Command" }), ""];
        activitySpecs[`activities[${activityKey}].midiProperties.ignoreTraits`] = [new ArrayField(new StringField(), { label: "Ignore Traits" }), ""];
        activitySpecs[`activities[${activityKey}].midiProperties.triggeredActivityId`] = [new StringField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.triggeredActivityId.hint") }), ""];
        activitySpecs[`activities[${activityKey}].midiProperties.triggeredActivityConditionText`] = [new StringField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.triggeredActivityConditionText.hint") }), ""];
        activitySpecs[`activities[${activityKey}].midiProperties.triggeredActivityTargets`] = [new StringField({ label: "Triggered Activity Targets" }), "override"];
        activitySpecs[`activities[${activityKey}].midiProperties.triggeredActivityRollAs`] = [new StringField({ label: "Triggered Activity Roll As" }), "override"];
        activitySpecs[`activities[${activityKey}].midiProperties.forceDialog`] = [new BooleanField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.forceDialog.hint") }), ""];
        activitySpecs[`activities[${activityKey}].midiProperties.confirmTargets`] = [new StringField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.confirmTargets.hint") }), ""];
        activitySpecs[`activities[${activityKey}].midiProperties.automationOnly`] = [new BooleanField({ label: i18n("midi-qol.SHARED.FIELDS.midiProperties.automationOnly.hint") }), ""];
        activitySpecs[`activities[${activityKey}].midiProperties.otherActivityCompatible`] = [new BooleanField({ label: "midi-qol.SHARED.FIELDS.midiProperties.otherActivityCompatible.hint" }), ""];
      }

      if (game.modules.get("midi-qol")?.active) {
        activitySpecs["activities[attack].attackMode"] = [new StringField({ label: "Attack Mode" }), ""];
      }
      delete activitySpecs[`activities[${activityKey}].effects`];// = [new ObjectField(), -1];
    }
    for (let itemKey of Object.keys(itemSpecs)) {
      itemSpecs[itemKey] = foundry.utils.mergeObject(itemSpecs[itemKey], activitySpecs, { insertValues: true, insertKeys: true, inplace: false, overwrite: false });
    }

    const allSpecs: ItemSpecs = {};
    let unionSpecs: BaseValuesInner = {};
    try {
      for (let k of ["weapon", /*"spell", "feat",*/ "consumable", "equipment", "loot", /*"class",*/ "tool", /*"vehicle",*/ "container"]) {
        unionSpecs = foundry.utils.mergeObject(unionSpecs, itemSpecs[k], { insertValues: true, insertKeys: true, inplace: false, overwrite: false });
      }
      itemSpecs["union"] = unionSpecs;
    }
    catch (err) {
      console.error("Error in getItemSpecs | building union specs", err);
    }

    // union first - it is the universal fallback, so a failure in any single item type must not take it out
    for (let k of ["union", ...Object.keys(itemSpecs).filter(key => key !== "union")]) {
      try {
        const theSpecs = foundry.utils.flattenObject(itemSpecs[k]) as BaseValuesInner;
        theSpecs["name"] = [new StringField({ label: "Name" }), ""];
        theSpecs["img"] = [new StringField({ label: "Image" }), ""];
        theSpecs["flags.dae.macro.name"] = [new StringField({ label: "Macro Name" }), ""];
        theSpecs["flags.dae.macro.command"] = [new StringField({ label: "Macro Command" }), ""];
        theSpecs["flags.dae.macro.img"] = [new StringField({ label: "Macro Img" }), ""];
        theSpecs["flags.dae.macro.type"] = [new StringField({ label: "Macro Data" }), ""];
        theSpecs["flags.dae.macro.scope"] = [new StringField({ label: "Macro Scope" }), ""];
        if (game.modules.get("midi-qol")?.active && ["union", "spell", "feat", "consumable", "equipment", "spell", "weapon"].includes(k)) {
          for (let [s, label] of [
            ["itemCondition", "midi-qol.ItemActivationCondition.Name"],
            ["reactionCondition", "midi-qol.ReactionActivationCondition.Name"],
            ["otherCondition", "midi-qol.OtherActivationCondition.Name"],
            ["effectCondition", "midi-qol.EffectActivationCondition.Name"]]) {
            theSpecs[`flags.midi-qol.${s}`] = [new StringField({ label: i18n(label) }), ""];
          }
        }

        // Add some not-in-datamodel keys
        theSpecs["system.damageBonus"] = [new StringField(), ""];

        // Add some legacy keys that still work.
        // NOTE: Must keep an eye on the system and ensure this stays up to date
        theSpecs["system.ability"] = [new StringField(), "override"];
        theSpecs["system.attack.bonus"] = [new StringField(), ""];
        theSpecs["system.attack.flat"] = [new StringField(), ""];
        theSpecs["system.damage.bonus"] = [new StringField(), ""];
        theSpecs["system.damage.parts"] = [new StringField(), ""];
        // Damage types is a Set of damage types — allow all modes (add/-remove/subtract/override),
        // like the actor damage-type traits, rather than forcing override.
        theSpecs["system.damage.types"] = [new SetField(new StringField()), ""];

        // Remove some keys that shouldn't be there
        Object.keys(theSpecs).filter(k => k.includes("[consumptiontargetdata]")).forEach(k => delete theSpecs[k]);

        const finalSpecs: Record<string, ValidSpec> = {};

        for (let k1 of Object.keys(theSpecs)) {
          finalSpecs[k1] = new ValidSpec(k1, theSpecs[k1][0], theSpecs[k1][1], theSpecs[k1][0].label, theSpecs[k1][0].hint/*, theSpecs[k1][3] */);
        }

        for (let k1 of Object.keys(finalSpecs)) {
          switch (k1) {
            case "system.duration.units": finalSpecs[k1].options = { "": "", ...this.systemConfig.timePeriods }; break;
            case "system.target.type": finalSpecs[k1].options = { "": "", ...this.systemConfig.targetTypes }; break;
            case "system.actionType": finalSpecs[k1].options = { "": "", ...this.systemConfig.itemActionTypes }; break;
            case "system.uses.per": finalSpecs[k1].options = { "": "", ...this.systemConfig.limitedUsePeriods }; break;
            case "system.consume.type": finalSpecs[k1].options = { "": "", ...this.systemConfig.abilityConsumptionTypes }; break;
            case "system.attunement": finalSpecs[k1].options = { "": "", ...this.systemConfig.attunementTypes }; break;
          }
        }

        // Mark postDerived item specs with "final" phase (applied after prepareDerivedData)
        const postDerivedKeys = [
          "name", "system.magicalBonus", "system.formula",
          "flags.midi-qol.itemCondition", "flags.midi-qol.reactionCondition",
          "flags.midi-qol.otherCondition", "flags.midi-qol.effectCondition",
        ];
        for (const dk of postDerivedKeys) {
          if (finalSpecs[dk]) finalSpecs[dk].phase = "final";
        }

        allSpecs[k] = {
          allSpecsObj: finalSpecs,
          allSpecs: Object.values(finalSpecs).filter(s => s !== undefined).sort((a, b) => a.fieldSpec.toLocaleLowerCase() < b.fieldSpec.toLocaleLowerCase() ? -1 : 1),
        }
      }
      catch (err) {
        console.error(`Error in getItemSpecs | building specs for item type ${k}`, err);
      }
    }
    return allSpecs;
  }

  public static modifyBaseValues(actorType: string, baseValues: BaseValuesInner = {}, characterSpec: any): void {
    if (debugEnabled > 0) warn("modifyBaseValues", actorType, baseValues, characterSpec);
    //@ts-expect-error no dnd5e-types
    const dataModels: any = game.system.dataModels;
    const MappingField = dataModels.fields.MappingField;
    const actorDataModel = this.getActorDataModelFields(actorType);
    if (!actorDataModel) {
      console.warn("Could not find data model for actor type", actorType);
      return;
    }

    // TODO (Michael) once dnd5e-types in, ensure mapping field properly typed
    function processMappingField(key: string, mappingField: any) {
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
          // Clone the model so each entry has its own DataField instance with a per-entry label.
          // initialKeys[fieldKey] is either an i18n key string (e.g. CONFIG.DND5E.senses) or a config
          // object with .label (e.g. CONFIG.DND5E.abilities). Falling back to the model's existing label.
          const entryConfig = fields[fieldKey];
          const label = (typeof entryConfig === "string")
            ? entryConfig
            : (entryConfig?.label ?? mappingField.model.options?.label);
          const cloned = new mappingField.model.constructor({
            ...mappingField.model.options,
            ...(label ? { label } : {})
          });
          baseValues[`${key}.${fieldKey}`] = [cloned, ""];
        }
      }
    }
    function processSchemaField(key: string, schemaField: foundry.data.fields.SchemaField<any>) {
      const fields = schemaField.fields;
      for (let fieldKey of Object.keys(fields)) {
        if (fields[fieldKey] instanceof SchemaField) {
          processSchemaField(`${key}.${fieldKey}`, fields[fieldKey]);
        }
        else if (fields[fieldKey] instanceof MappingField) {
          processMappingField(`${key}.${fieldKey}`, fields[fieldKey]);
        } else {
          if (fieldKey.includes("favorites")) return; //TODO see above
          // let initial = fields[fieldKey].initial ?? 0;;
          // if (typeof fields[fieldKey].initial === "function") { initial = fields[fieldKey].initial() ?? ""; }
          // baseValues[`${key}.${fieldKey}`] = [initial, ""];
          baseValues[`${key}.${fieldKey}`] = [fields[fieldKey], ""];
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
        baseValues[`system.${key}`] = [modelField, ""];
      } else console.error("Unexpected field ", key, modelField)
    }
    // Generate all repeated `system.abilities` fields
    for (const [key, { label: ability }] of Object.entries(this.systemConfig.abilities)) {
      const genericPrefix = `system.abilities.${key}.`
      const genericKeys = Object.keys(baseValues).filter(k => k.startsWith(genericPrefix));
      for (const genericKey of genericKeys) {
        const innerPrefix = `dae.SystemAbilities.fieldData.${genericKey.slice(genericPrefix.length)}`;
        localizationMap[genericKey] ??= {
          name: i18nFormat(`${innerPrefix}.name`, { ability }),
          description: i18nFormat(`${innerPrefix}.description`, { ability })
        };
        if (localizationMap[genericKey].name === `${innerPrefix}.name`) delete localizationMap[genericKey].name;
        if (localizationMap[genericKey].description === `${innerPrefix}.description`) delete localizationMap[genericKey].description;
      }
    }
    // Generate all repeated `system.skills` fields
    for (const [key, { label: skill }] of Object.entries(this.systemConfig.skills)) {
      const genericPrefix = `system.skills.${key}.`
      const genericKeys = Object.keys(baseValues).filter(k => k.startsWith(genericPrefix));
      for (const genericKey of genericKeys) {
        const innerPrefix = `dae.SystemSkills.fieldData.${genericKey.slice(genericPrefix.length)}`;
        localizationMap[genericKey] ??= {
          name: i18nFormat(`${innerPrefix}.name`, { skill }),
          description: i18nFormat(`${innerPrefix}.description`, { skill })
        };
        if (localizationMap[genericKey].name === `${innerPrefix}.name`) delete localizationMap[genericKey].name;
        if (localizationMap[genericKey].description === `${innerPrefix}.description`) delete localizationMap[genericKey].description;
      }
    }
    // Generate all repeated midi `system.traits.da` and system `dm` fields
    if (midiActive) {
      for (const [key, { label: damage }] of Object.entries(this.systemConfig.damageTypes as Record<string, { label: string }>).concat(Object.entries(this.systemConfig.healingTypes))) {
        const absorptionKey = `system.traits.da.${key}`;
        localizationMap[absorptionKey] ??= {
          name: i18nFormat('dae.SystemTraits.fieldData.da.name', { damage }),
          description: i18nFormat('dae.SystemTraits.fieldData.da.description', { damage })
        };
        const modKey = `system.traits.dm.amount.${key}`;
        localizationMap[modKey] ??= {
          name: i18nFormat('dae.SystemTraits.fieldData.dm.amount.name', { damage }),
          description: i18nFormat('dae.SystemTraits.fieldData.dm.amount.description', { damage })
        }
      }
    }
    if (!baseValues["system.attributes.prof"]) baseValues["system.attributes.prof"] = [new NumberField(), ""];
    if (!baseValues["system.details.level"]) baseValues["system.details.level"] = [new NumberField(), ""];
    if (!baseValues["system.attributes.ac.bonus"]) baseValues["system.attributes.ac.bonus"] = [new StringField(), ""];
    // if (!baseValues["system.attributes.ac.base"])    baseValues["system.attributes.ac.base"]       = [new NumberField({ initial: 10 }), ""];
    if (!baseValues["system.attributes.ac.armor"]) baseValues["system.attributes.ac.armor"] = [new NumberField(), ""];
    if (!baseValues["system.attributes.ac.shield"]) baseValues["system.attributes.ac.shield"] = [new NumberField(), ""];
    if (!baseValues["system.attributes.ac.cover"]) baseValues["system.attributes.ac.cover"] = [new NumberField(), ""];
    if (!baseValues["system.attributes.ac.min"]) baseValues["system.attributes.ac.min"] = [new NumberField(), ""];
    // system.attributes.prof/system.details.level and system.attributes.hd are all calced in prepareBaseData
    if (!baseValues["system.bonuses.All-Attacks"]) baseValues["system.bonuses.All-Attacks"] = [new StringField(), ""];
    if (!baseValues["system.bonuses.weapon.attack"]) baseValues["system.bonuses.weapon.attack"] = [new StringField(), ""];
    if (!baseValues["system.bonuses.spell.attack"]) baseValues["system.bonuses.spell.attack"] = [new StringField(), ""];
    if (!baseValues["system.bonuses.All-Damage"]) baseValues["system.bonuses.All-Damage"] = [new StringField(), ""];
    if (!baseValues["system.bonuses.weapon.damage"]) baseValues["system.bonuses.weapon.damage"] = [new StringField(), ""];
    if (!baseValues["system.bonuses.spell.damage"]) baseValues["system.bonuses.spell.damage"] = [new StringField(), ""];
    if (!baseValues["system.bonuses.spell.all.damage"]) baseValues["system.bonuses.spell.all.damage"] = [new StringField(), ""];
    // These are for item action types - works by accident.
    if (!baseValues["system.bonuses.heal.damage"]) baseValues["system.bonuses.heal.damage"] = [new StringField(), ""];
    if (!baseValues["system.bonuses.save.damage"]) baseValues["system.bonuses.save.damage"] = [new StringField(), ""];
    if (!baseValues["system.bonuses.check.damage"]) {
      // Only through midi can check activities deal damage
      if (midiActive) baseValues["system.bonuses.check.damage"] = [new StringField(), ""];
    }
    // Don't do anything with system.attributes.hp.max - it will be set by parsing the actor schema
    if (!baseValues["system.attributes.hd.max"] && actorType === "npc") baseValues["system.attributes.hd.max"] = [new NumberField(), ""];
    const actorModelSchemaFields = this.getActorDataModelFields(actorType);
    delete baseValues["system.traits.toolProf.value"];
    delete baseValues["system.traits.toolProf.custom"];
    delete baseValues["system.traits.toolProf.all"];
    if (this.systemConfig.toolProficiencies && foundry.utils.getProperty(actorModelSchemaFields, "tools")) {
      const toolProfList = foundry.utils.duplicate(this.systemConfig.toolProficiencies);
      const ids = this.systemConfig.tools;
      if (ids !== undefined) {
        for (const key of Object.keys(ids)) {
          // const item = await pack.getDocument(id);
          toolProfList[key] = key;
        }
      }
      for (let key of Object.keys(toolProfList)) {
        baseValues[`system.tools.${key}.prof`] = [new NumberField(), "override"];
        baseValues[`system.tools.${key}.ability`] = [new StringField(), "override"];
        baseValues[`system.tools.${key}.bonuses.check`] = [new StringField(), ""];
      }
      for (let vehicleKey of Object.keys(this.systemConfig.vehicleTypes)) {
        baseValues[`system.tools.${vehicleKey}.value`] = [new NumberField(), "override"];
      }
    }
    // move all the character flags to specials so that the can be custom effects only
    let charFlagKeys = Object.keys(this.systemConfig.characterFlags);
    charFlagKeys.forEach(key => {
      let theKey = `flags.${game.system.id}.${key}`;
      if ([
        `flags.${game.system.id}.weaponCriticalThreshold`,
        `flags.${game.system.id}.meleeCriticalDamageDice`,
        `flags.${game.system.id}.spellCriticalThreshold`
      ].includes(theKey)) {
        delete baseValues[theKey];
      }
      else if (this.systemConfig.characterFlags[key].type === Boolean) baseValues[theKey] = [new BooleanField(), ""];
      else if (this.systemConfig.characterFlags[key].type === Number) baseValues[theKey] = [new NumberField(), ""];
      else if (this.systemConfig.characterFlags[key].type === String) baseValues[theKey] = [new StringField(), ""];
    });
    delete baseValues[`flags.${game.system.id}.weaponCriticalThreshold`];
    delete baseValues[`flags.${game.system.id}.powerCriticalThreshold`];
    delete baseValues[`flags.${game.system.id}.meleeCriticalDamageDice`];
    delete baseValues[`flags.${game.system.id}.spellCriticalThreshold`];
    Object.keys(baseValues).forEach(key => {
      // can't modify many spell details.
      if (key.includes("system.spells")) {
        delete baseValues[key];
      }
    });
    if (foundry.utils.getProperty(actorModelSchemaFields, "spells")) {
      for (let spellSpec of (foundry.utils.getProperty(actorModelSchemaFields, "spells.initialKeys") as string[] ?? []))
        baseValues[`system.spells.${spellSpec}.override`] = [new NumberField(), ""];
    }


    // removed - required so that init.bonus can work (prepareInitiative called after derived effects
    // delete baseValues["system.attributes.init.total"];
    delete baseValues["system.attributes.init.mod"];
    // delete baseValues["system.attributes.init.bonus"];
    // leaving this in base values works because prepareInitiative is called after application of derived effects
    delete baseValues["flags"];

    // Misc non-working things that should be deleted
    delete baseValues["system.attributes.exhaustion"];
    delete baseValues["system.attributes.inspiration"];

    // Misc things to add/correct
    baseValues["system.attributes.ac.calc"] = [new StringField(), "override"];
    baseValues["system.attributes.movement.units"] = [new StringField(), "override"];
    baseValues["system.attributes.senses.units"] = [new StringField(), "override"];
    baseValues["system.attributes.spellcasting"] = [new StringField(), "override"];
    if (actorType === "npc") {
      baseValues["system.details.type.swarm"] = [new StringField(), "override"];
      baseValues["system.details.type.value"] = [new StringField(), "override"];
    }

    baseValues["system.traits.ci.all"] = [new BooleanField(), "custom"];
    if (!baseValues["system.traits.ci.value"]) baseValues["system.traits.ci.value"] = [new StringField(), ""];
    baseValues["system.traits.ci.custom"] = [new StringField(), "custom"];

    if (baseValues["system.traits.weaponProf.value"]) {
      baseValues["system.traits.weaponProf.all"] = [new BooleanField(), "custom"];
      baseValues["system.traits.weaponProf.custom"] = [new StringField(), "custom"];
    }
    if (baseValues["system.traits.armorProf.value"]) {
      baseValues["system.traits.armorProf.all"] = [new BooleanField(), "custom"];
      baseValues["system.traits.armorProf.custom"] = [new StringField(), "custom"];
      baseValues["system.attributes.hp.tempmax"] = [new NumberField(), ""];
    }
    // dnd5e 6 declares these as FormulaFields; only supply them where the system does not.
    for (const kind of ["bonuses", "multipliers"]) for (const stage of ["encumbered", "heavilyEncumbered", "maximum", "overall"]) {
      baseValues[`system.attributes.encumbrance.${kind}.${stage}`] ??= [new StringField(), ""];
    }
    baseValues["system.traits.size"] = [new StringField(), "override"];
    if (this.systemConfig.languages) {
      baseValues["system.traits.languages.all"] = [new BooleanField(), ""];
    }
    // A dummy spec "system" is being created and must be removed to avoid errors
    if (baseValues.system) delete baseValues.system;
  }

  public static modifySpecials(actorType: string, specials: BaseValuesInner, characterSpec: any): void {
    super.modifySpecials(actorType, specials, characterSpec);
    const actorModelSchemaFields = this.getActorDataModelFields(actorType);
    if (actorType === "vehicle") {
      specials["system.attributes.ac.motionless"] = [new NumberField(), ""];
      /*
       * Applied before derived data, unlike every other special.
       *
       * dnd5e computes AC *from* ac.flat when the calculation is "flat", and it does that during
       * prepareDerivedData — so a value delivered afterwards arrives too late and the AC is computed
       * from nothing. Measured on a character: an effect setting calc=flat and flat=17 produced an
       * AC of 0, while the same values written straight to the actor produced 17.
       *
       * That reached characters at all because the union spec list is flattened across actor types
       * with the last writer winning, and `daeShouldApplyChange` consults the union whatever the
       * actor is — so this vehicles-only special governed everybody.
       */
      specials["system.attributes.ac.flat"] = [new NumberField(), "", "initial"];
    } else {
      specials["system.attributes.ac.value"] = [new NumberField(), ""];
    }
    specials["macro.activityMacro"] = [new StringField(), "custom"];
    specials["system.traits.di.all"] = [new BooleanField(), "custom"];
    specials["system.traits.di.value"] = [new StringField(), ""];
    specials["system.traits.di.custom"] = [new StringField(), "custom"];
    specials["system.traits.di.bypasses"] = [new StringField(), "custom"];
    specials["system.traits.dr.all"] = [new BooleanField(), "custom"];
    specials["system.traits.dr.value"] = [new StringField(), ""];
    specials["system.traits.dr.custom"] = [new StringField(), "custom"];
    specials["system.traits.dr.bypasses"] = [new StringField(), "custom"];
    specials["system.traits.dv.all"] = [new BooleanField(), "custom"];
    specials["system.traits.dv.value"] = [new StringField(), ""];
    specials["system.traits.dv.custom"] = [new StringField(), "custom"];
    specials["system.traits.dv.bypasses"] = [new StringField(), "custom"];
    if (midiActive) specials["system.traits.da.bypasses"] = [new StringField(), "custom"];

    specials["system.spells.pact.level"] = [new NumberField(), ""];
    specials["flags.dae"] = [new StringField(), "custom"];

    specials["system.attributes.movement.all"] = [new StringField(), "custom"];
    specials["system.attributes.movement.hover"] = [new BooleanField(), "custom"];

    if (midiActive) {
      specials["system.attributes.ac.EC"] = [new NumberField(), ""];
      specials["system.attributes.ac.AR"] = [new NumberField(), ""];
    }

    if (foundry.utils.getProperty(actorModelSchemaFields, "resources")) {
      specials["system.resources.primary.max"] = [new NumberField(), ""];
      specials["system.resources.primary.label"] = [new StringField(), ""];
      specials["system.resources.secondary.max"] = [new NumberField(), ""];
      specials["system.resources.secondary.label"] = [new StringField(), ""];
      specials["system.resources.tertiary.max"] = [new NumberField(), ""];
      specials["system.resources.tertiary.label"] = [new StringField(), ""];
      specials["system.resources.legact.max"] = [new NumberField(), ""];
      specials["system.resources.legres.max"] = [new NumberField(), ""];

      if (game.modules.get("resourcesplus")?.active) {
        for (let res of ["fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]) {
          specials[`system.resources.${res}.max`] = [new NumberField(), ""];
          specials[`system.resources.${res}.label`] = [new StringField(), ""];
        }
      }
    }
    if (foundry.utils.getProperty(actorModelSchemaFields, "spells")) {
      for (let spellSpec of (foundry.utils.getProperty(actorModelSchemaFields, "spells.initialKeys") as string[] ?? []))
        specials[`system.spells.${spellSpec}.max`] = [new NumberField(), ""];
    }

    if (["character", "npc"].includes(actorType)) {
      if (game.settings.get("dnd5e", "honorScore")) {
        specials[`system.abilities.hon.mod`] = [new NumberField(), ""];
        // specials[`system.abilities.hon.save`] = [new NumberField(), ""]; // No longer a thing
        // specials[`system.abilities.hon.min`] = [new NumberField(), ""]; There is no min attribute yet
        specials[`system.abilities.hon.max`] = [new NumberField(), ""];
      }
      if (game.settings.get("dnd5e", "sanityScore")) {
        specials[`system.abilities.san.mod`] = [new NumberField(), ""];
        // specials[`system.abilities.san.save`] = [new NumberField(), ""]; // No longer a thing
        // specials[`system.abilities.san.min`] = [new NumberField(), ""]; There is no min attribute yet
        specials[`system.abilities.san.max`] = [new NumberField(), ""];
      }
    }

    if (game.modules.get("tidy5e-sheet")?.active)
      specials["system.details.maxPreparedSpells"] = [new NumberField(), ""];

    // move all the character flags to specials so that they can be custom effects only
    let charFlagKeys = Object.keys(this.systemConfig.characterFlags);
    charFlagKeys.forEach(key => {
      let theKey = `flags.${game.system.id}.${key}`;
      if ([`flags.${game.system.id}.weaponCriticalThreshold`,
      `flags.${game.system.id}.powerCriticalThreshold`,
      `flags.${game.system.id}.meleeCriticalDamageDice`,
      `flags.${game.system.id}.spellCriticalThreshold`].includes(theKey)) {
        specials[theKey] = [new NumberField(), ""];
      }
    });
    // Do the system specific part
    // 1. abilities add mod and save to each;
    if (this.systemConfig.abilities && foundry.utils.getProperty(actorModelSchemaFields, "abilities")) Object.keys(this.systemConfig.abilities).forEach(ablKey => {
      specials[`system.abilities.${ablKey}.mod`] = [new NumberField(), ""];
      specials[`system.abilities.${ablKey}.max`] = [new NumberField(), ""];
    })
  }

  static modifyValidSpec(spec: string, validSpec: ValidSpec): ValidSpec {
    if ((spec.includes("system.skills") || spec.includes("system.attributes.concentration")) && spec.includes("ability")) {
      validSpec.forcedMode = "override";
    }
    // dnd5e 6.0 renamed system.bonuses.abilities.* to system.rolls.ability.*; ValidSpecs are
    // generated from the live schema, so only the new spelling can occur here.
    if (spec.includes("system.rolls.ability")) {
      validSpec.forcedMode = "";
    }
    return validSpec;
  }

  // Any actions to be called on init Hook 
  public static initActions() {
    this.getRollDataWrapper = getRollData;
    this.fieldMappings["StatusEffect"] = "macro.StatusEffect";
    this.fieldMappings["system.traits.di.all"] = { key: "system.traits.di.value", value: "ALL", mode: "add" };
    this.fieldMappings["system.traits.dr.all"] = { key: "system.traits.dr.value", value: "ALL", mode: "add" };
    this.fieldMappings["system.traits.dv.all"] = { key: "system.traits.dv.value", value: "ALL", mode: "add" };

    Hooks.callAll("dae.addFieldMappings", this.fieldMappings);
    warn("system is ", game.system)
    if (game.modules.get("dnd5e-custom-skills")?.active) {
      wildcardEffects.push(/system\.skills\..*\.value/);
      wildcardEffects.push(/system\.skills\..*\.ability/);
      wildcardEffects.push(/system\.skills\..*\.bonuses/);
    }
    wildcardEffects.push(/system\.abilities\..*\.value/);
    wildcardEffects.push(/system\.scale\..*\.value/);

    // WRAPPER on applyActiveEffects — DAE extends core + dnd5e effect application.
    // Core+dnd5e handle: phase validation, change collection, sorting, applyChange, overrides.
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", daeApplyActiveEffects, "WRAPPER");
    // MIXED on shouldApplyChange — collect each change in its ValidSpec phase, so phase-corrected
    // changes take part in core's priority sort instead of being applied after it.
    libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.shouldApplyChange", daeShouldApplyChange, "MIXED");
    // WRAPPER on ActiveEffect.applyChange — handles per-change DAE transformations:
    // field mappings, dae.eval, OverTime suffix, stacks.
    libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.applyChange", daeApplyChange, "MIXED");
    // WRAPPER on prepareData for DAE-specific pre/post work
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.prepareData", prepareData, "WRAPPER");
    // support other things that can suppress an effect, like condition immunity
    libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.isSuppressed", isSuppressed, "WRAPPER");
    // @item, @spellLevel etc. for effects DAE applied the dnd5e 6 way, resolved when the target is prepared
    libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.getReplacementData", getReplacementData, "WRAPPER");
    // Old bonus paths dnd5e 6 moved but does not alias (see movedBonusAliases)
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.prepareBaseData", prepareBaseDataBonusAliases, "WRAPPER");
    // This supplies DAE custom effects - the main game
    // @ts-expect-error our custom stuff in the changes makes types mad
    Hooks.on("applyActiveEffect", this.daeCustomEffect.bind(this));
    // done here as it references some .system data
    Hooks.on("preUpdateItem", preUpdateItemHook);
    Hooks.on("preCreateToken", (token: TokenDocument.Implementation, _data: unknown, options: AnyObject) => grantOnRolledPlacement(token, options));
    this.configureLists();
    const hookName = game.modules.get("babel")?.active ? "babel.ready" : "ready";
    Hooks.once(hookName, () => { this.configureLists(); });
    if (this.systemConfig.conditionEffects && this.systemConfig.conditionEffects["halfHealth"] && game.settings.get("dae", "DAEAddHalfHealthEffect")) {
      this.systemConfig.conditionEffects["halfHealth"].add("halfHealthEffect");
      Hooks.once(hookName, () => {
        CONFIG.statusEffects.push({
          id: "halfHealthEffect",
          _id: getStaticID("halfHealthEffect"),
          name: i18n("dae.halfHealthEffectLabel"),
          img: "modules/dae/icons/half-health.webp",
          flags: { dnd5e: { halfHealth: true } }
        });
      })
    }

    // enchantments don't seem to get their world time set when applied to an item
    Hooks.on("preCreateActiveEffect", (candidate: ActiveEffect, data: any, options: any, user: string) => {
      //@ts-expect-error no dnd5e types
      if (candidate.isAppliedEnchantment && candidate.duration.value != null && candidate.duration.units && candidate.duration.units !== "none") {
        // @ts-expect-error v14 effect.start and duration.units
        if (candidate.start?.time == null && candidate.duration.units === "seconds")
          // @ts-expect-error v14 effect.start
          candidate.updateSource({ start: { time: game.time.worldTime ?? 0 } });
        // @ts-expect-error v14 effect.start
        else if (!Number.isNumeric(candidate.start?.round) && !Number.isNumeric(candidate.start?.turn) && game.combat) {
          // @ts-expect-error v14 effect.start
          candidate.updateSource({ start: { round: game.combat?.round, turn: game.combat?.turn } });
        }
      }
      return true;
    });
    // Item.applyActiveEffects — dnd5e's native implementation handles enchantment effects.
    // DAE's applyChange WRAPPER handles UUID unmapping for Item targets.
  }


  public static setupActions(): void {
  }

  // No preCreateActiveEffect override: dnd5e creates rider conditions itself on effect creation
  // (ActiveEffect5e._onCreateOperation), so DAE calling createRiderConditions only duplicated the
  // work — via an API deprecated in dnd5e 6.0 — and did so without dnd5e's `active` gate.

  public static readyActions(): void {
    // checkArmorDisabled();
    // Modify armor attribution for DAE specific cases
    patchPrepareArmorClassAttribution();
    // token.detectionModes is id-keyed in v14 and is an active-effect targetable key, so these
    // are native paths; no ATL translation involved. Tops up modes registered after the specs were built.
    {
      const detectionModes: Set<string> = new Set();
      Object.keys(CONFIG.Canvas.detectionModes).forEach(dm => {
        if (CONFIG.Canvas.detectionModes[dm].tokenConfig) {
          detectionModes.add(`token.detectionModes.${dm}.range`);
          detectionModes.add(`token.detectionModes.${dm}.enabled`);
        }
      });
      if (game.modules.get("vision-5e")?.active) {
        Object.keys(CONFIG.Canvas.visionModes).forEach(vm => {
          if (CONFIG.Canvas.visionModes[vm].tokenConfig) {
            detectionModes.add(`token.detectionModes.${vm}.range`);
            detectionModes.add(`token.detectionModes.${vm}.enabled`);
          }
        });
      }
      addAutoFields(Array.from(detectionModes));
    }
    Hooks.callAll("dae.addSpecialDurations", daeSpecialDurations)
      // midi-qol registers its own special durations via the dae.addSpecialDurations hook above.
      // DAE only defines system-agnostic entries; the dnd5e/midi ones belong to whoever implements them.
    // Rely on suppression Hooks.on("updateItem", updateItem); // deal with disabling effects for unequipped items
  }

  public static initSystemData() {
    // Setup attack types and expansion change mappings
    this.spellAttacks = ["msak", "rsak"];
    this.weaponAttacks = ["mwak", "rwak"];
    this.attackTypes = this.weaponAttacks.concat(this.spellAttacks);
    /*
     * dnd5e 6.0 moved attack/damage bonuses out of `system.bonuses.<type>.<attack|damage>` and into
     * `system.rolls.<attack|damage>.<type>.bonus`. Expand straight to the new paths: the old ones
     * only still work through the system's `_applyChangeShim` deprecation layer, and these selector
     * keys are DAE's own, so nothing upstream would rewrite them once that layer goes.
     */
    const rollBonus = (selector: string) => (at: string) => `system.rolls.${selector}.${at}.bonus`;
    this.bonusSelectors = {
      "system.bonuses.All-Attacks": { attacks: this.attackTypes, selector: "attack", replaceList: ["system.rolls.attack.bonus"], deprecatedFor: "system.rolls.attack.bonus" },
      "system.bonuses.weapon.attack": { attacks: this.weaponAttacks, selector: "attack", replaceList: this.weaponAttacks.map(rollBonus("attack")), deprecatedFor: "system.rolls.attack.weapon.bonus" },
      "system.bonuses.spell.attack": { attacks: this.spellAttacks, selector: "attack", replaceList: this.spellAttacks.map(rollBonus("attack")), deprecatedFor: "system.rolls.attack.spell.bonus" },
      "system.bonuses.All-Damage": { attacks: this.attackTypes, selector: "damage", replaceList: this.attackTypes.map(rollBonus("damage")), deprecatedFor: "system.rolls.damage.all.bonus" },
      "system.bonuses.weapon.damage": { attacks: this.weaponAttacks, selector: "damage", replaceList: this.weaponAttacks.map(rollBonus("damage")), deprecatedFor: "system.rolls.damage.weapon.bonus" },
      "system.bonuses.spell.damage": { attacks: this.spellAttacks, selector: "damage", replaceList: this.spellAttacks.map(rollBonus("damage")), deprecatedFor: "system.rolls.damage.spell.bonus" },
      // New-form selectors in the system.rolls namespace. The legacy system.bonuses.* forms above
      // stay as aliases so existing content keeps working. There is no "all attacks" entry here:
      // dnd5e combines `rolls.attack` into every attack roll, so that native key already is one.
      // Damage has no such global, so `rolls.damage.all.bonus` stays a DAE expansion.
      "system.rolls.attack.weapon.bonus": { attacks: this.weaponAttacks, selector: "attack", replaceList: this.weaponAttacks.map(rollBonus("attack")) },
      "system.rolls.attack.spell.bonus": { attacks: this.spellAttacks, selector: "attack", replaceList: this.spellAttacks.map(rollBonus("attack")) },
      "system.rolls.damage.all.bonus": { attacks: this.attackTypes, selector: "damage", replaceList: this.attackTypes.map(rollBonus("damage")) },
      "system.rolls.damage.weapon.bonus": { attacks: this.weaponAttacks, selector: "damage", replaceList: this.weaponAttacks.map(rollBonus("damage")) },
      "system.rolls.damage.spell.bonus": { attacks: this.spellAttacks, selector: "damage", replaceList: this.spellAttacks.map(rollBonus("damage")) },
    };
    /*
     * No entries here for the per-type renames (system.bonuses.<type>.<attack|damage>,
     * system.bonuses.abilities.<x>, movement/senses/init/death/concentration, system.rarity).
     * dnd5e's own ActiveEffect5e.SHIM_FIELDS remaps all of them before DAE sees the change -
     * verified 2026-09-24 by removing candidate entries at runtime and re-applying a legacy key.
     * Duplicating that table here would diverge the day the system edits its own.
     */
    this.daeActionTypeKeys = Object.keys(this.systemConfig.itemActionTypes);
  }

  public static enumerateLanguages(systemLanguages: Record<string, { label?: string, children?: Record<string, Record<string, unknown>> }>): any {
    const languages = { "ALL": "All" };
    Object.entries(systemLanguages).forEach(([key, language]) => {
      if (typeof language === "string") {
        languages[key] = i18n(language);
      } else if (language.label) {
        languages[key] = language.label;
      }
      if (language.children) {
        const subLanguages = this.enumerateLanguages(language.children);
        Object.keys(subLanguages).forEach(subLang => {
          languages[subLang] = subLanguages[subLang];
        });
      }
    });
    return languages;
  }
  // For DAE Editor
  public static configureLists() {
    // Start with "ALL" option at the top if the trait defines labels.all (dnd5e 5.3+)
    const allLabel = (this.systemConfig as any).traits?.dr?.labels?.all;
    this.traitList = {};
    if (allLabel) {
      this.traitList["ALL"] = i18n(allLabel);
      this.traitList["-ALL"] = `- ${i18n(allLabel)}`;
    }
    Object.assign(this.traitList, Object.fromEntries(Object.entries(this.systemConfig.damageTypes).map(([key, { label }]) => [[key, label], [`-${key}`, `- ${label}`]]).flat(1)));
    for (const [key, { label }] of Object.entries(this.systemConfig.healingTypes)) {
      this.traitList[key] = label;
      this.traitList[`-${key}`] = `- ${label}`;
    }

    this.bypassesList = Object.entries(this.systemConfig.itemProperties)
      .filter(([key, value]) => value.isPhysical)
      .reduce((acc, [key, value]) => {
        acc[key] = value.label;
        return acc;
      }, {});

    this.languageList = this.enumerateLanguages(this.systemConfig.languages);

    this.armorClassCalcList = {};
    for (let acCalc in this.systemConfig.armorClasses) {
      this.armorClassCalcList[acCalc] = this.systemConfig.armorClasses[acCalc].label
    }

    this.conditionList = {};
    for (const [type, { name }] of Object.entries(this.systemConfig.conditionTypes)) {
      this.conditionList[type] = name;
      this.conditionList[`-${type}`] = `- ${name}`;
    }

    this.toolProfList = foundry.utils.duplicate(this.systemConfig.toolProficiencies);
    for (const [type, label] of Object.entries(this.toolProfList)) {
      this.toolProfList[`-${type}`] = `- ${label}`;
    }

    this.armorProfList = foundry.utils.duplicate(this.systemConfig.armorProficiencies);
    for (const [type, label] of Object.entries(this.armorProfList)) {
      this.armorProfList[`-${type}`] = `- ${label}`;
    }

    this.weaponProfList = foundry.utils.duplicate(this.systemConfig.weaponProficiencies);
    for (const [type, label] of Object.entries(this.weaponProfList)) {
      this.weaponProfList[`-${type}`] = `- ${label}`;
    }
  }

  public static getOptionsForSpec(spec?: ActiveEffect.ChangeData): Record<string, string> | undefined {
    const abilitiesList = Object.keys(this.systemConfig.abilities).reduce((obj: {}, key: string) => { obj[key] = this.systemConfig.abilities[key].label; return obj }, {});
    if (!spec?.key) return undefined;
    if (spec.key === "system.traits.languages.value")
      return this.languageList;
    if (spec.key === "system.traits.ci.value")
      return this.conditionList;

    // TODO: Maybe don't force these (| Add | 1 is perfectly valid here)
    if (spec.key.match(/system.tools..*prof/))
      return { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" };
    if (spec.key.match(/system.abilities..*proficient/))
      return { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" };
    if (spec.key.includes("system.skills") && spec.key.includes("value"))
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
      "system.traits.ida.value", "system.traits.idm.value"].includes(spec.key))
      return this.traitList;
    if (["system.traits.di.custom", "system.traits.dr.custom", "system.traits.dv.custom", "system.traits.da.custom"].includes(spec.key)) {
      return this.systemConfig.customDamageResistanceTypes ?? {};
    }
    if (spec.key === "system.attributes.ac.calc") {
      return this.armorClassCalcList;
    }
    if (["system.traits.dm.bypasses", "system.traits.di.bypasses", "system.traits.dr.bypasses", "system.traits.dv.bypasses", "system.traits.da.bypasses"].includes(spec.key))
      return this.bypassesList;
    if (spec.key.includes("system.skills") && spec.key.includes("ability")) {
      return abilitiesList;
    }
    if (spec.key === "system.traits.size") {
      return Object.keys(this.systemConfig?.actorSizes).reduce((sizes, size) => {
        sizes[size] = this.systemConfig.actorSizes[size].label;
        return sizes;
      }, {});
    }
    function extractLabels(orig: Record<string, { label: string }>) {
      return Object.fromEntries(Object.entries(orig).map(([key, { label }]) => [key, i18n(label)]));
    }
    if (["system.attributes.movement.units", "system.attributes.senses.units"].includes(spec.key)) {
      return extractLabels(this.systemConfig.movementUnits);
    }
    if (spec.key === "system.attributes.spellcasting") {
      return abilitiesList;
    }
    if (spec.key === "system.details.type.swarm") {
      return Object.keys(this.systemConfig?.actorSizes).reduce((sizes, size) => {
        sizes[size] = this.systemConfig.actorSizes[size].label;
        return sizes;
      }, { '': '' });
    }
    if (spec.key === "system.details.type.value") {
      return extractLabels(this.systemConfig.creatureTypes);
    }
    // Enchant stuff
    if (spec.key === "system.ability") {
      return abilitiesList;
    }
    if (spec.key.includes("activities") && spec.key.endsWith(".ability")) {
      const abilitiesList = Object.keys(this.systemConfig.abilities).reduce((obj: {}, key: string) => { obj[key] = this.systemConfig.abilities[key].label; return obj }, { "": `item default` });
      return abilitiesList;
    }

    if (["system.damage.types", "system.damage.base.types"].includes(spec.key) || (spec.key.includes("activities") && spec.key.endsWith("damage.types"))) {
      return this.traitList;
    }
    if (spec.key.endsWith(".activation.type")) {
      return extractLabels(this.systemConfig.activityActivationTypes);
    }
    if (spec.key.endsWith(".duration.units")) {
      return extractLabels(this.systemConfig.timeUnits);
    }
    if (spec.key.endsWith(".range.units")) {
      return extractLabels(this.systemConfig.distanceUnits);
    }
    if (spec.key.endsWith(".target.template.type")) {
      return extractLabels(this.systemConfig.areaTargetTypes);
    }
    if (spec.key.endsWith(".target.template.units")) {
      return extractLabels(this.systemConfig.movementUnits);
    }
    if (spec.key.endsWith(".target.affects.type")) {
      return extractLabels(this.systemConfig.individualTargetTypes);
    }
    if (spec.key.endsWith(".attack.type.value")) {
      return extractLabels(this.systemConfig.attackTypes);
    }
    if (spec.key.endsWith(".attack.type.classification")) {
      return extractLabels(this.systemConfig.attackClassifications);
    }
    if (spec.key.endsWith(".healing.scaling.mode")) {
      return extractLabels(this.systemConfig.damageScalingModes);
    }
    if (spec.key.endsWith("[transform].settings.preset")) {
      return extractLabels(this.systemConfig.transformation.presets)
    }
    if (spec.key.endsWith("triggeredActivityTargets") && globalThis.MidiQOL) {
      return globalThis.MidiQOL.midiPropertiesOptions.triggeredActivityTargetOptions;
    }
    if (spec.key.endsWith("triggeredActivityRollAs") && globalThis.MidiQOL) {
      return globalThis.MidiQOL.midiPropertiesOptions.triggeredActivityRollAsOptions;
    }

    // TODO: dc.calculation
    // TODO: damage.onSave
    // TODO: summon.mode
    return super.getOptionsForSpec(spec);
  }

  public static async editConfig() {
    try {
      const profs = [
        { type: "tool", list: this.toolProfList },
        { type: "armor", list: this.armorProfList },
        { type: "weapon", list: this.weaponProfList }
      ];
      for (let { type, list } of profs) {
        if (type === "tool") {
          for (const [key, { id }] of Object.entries(this.systemConfig[`${type}s`] as Record<string, { ability: string, id: string }>)) {
            //@ts-expect-error no dnd5e-types
            const item = game.system.documents.Trait.getBaseItem(id, { indexOnly: true })
            list[key] = item.name;
          }
        } else {
          const ids = this.systemConfig[`${type}Ids`];
          if (ids !== undefined) {
            for (const [key, id] of Object.entries(ids)) {
              //@ts-expect-error no dnd5e-types
              const item = game.system.documents.Trait.getBaseItem(id, { indexOnly: true })
              list[key] = item.name;
            }
          }
        }
      }
    } catch (err) {
      console.error("dae | getItemSpecs trait lookup", err);
    }
  }

  /*
   * do custom effect applications
   * damage resistance/immunity/vulnerabilities
   * languages
   */
  public static daeCustomEffect(
    actor: Actor.Implementation,
    change: ActiveEffect.ChangeData & { count?: number, effect: ActiveEffect.Implementation },
    current: any,
    delta: unknown,
    changes: unknown
  ) {
    if (!super.daeCustomEffect(actor, change)) return;
    // const current = foundry.utils.getProperty(actor, change.key);
    let value: string | number | string[] | undefined;
    if (typeof change?.key !== "string") return true;
    const damageBonusMacroFlag = `flags.${game.system.id}.DamageBonusMacro`;
    if (change.key === damageBonusMacroFlag) {
      let macroRef = change.value;
      const macroItem = getActorItemForEffect(change.effect);
      const activityUuid = getEffectSource(change.effect).activityUuid;
      if (change.value === "ItemMacro") { // rewrite the ItemMacro if there is an origin
        macroRef = `ItemMacro.${macroItem?.uuid}`;
      } else if (change.value === "ActivityMacro" && activityUuid?.includes("Activity.")) {
        macroRef = `ActivityMacro.${activityUuid}`;
      } else if (change.value === "ActivityMacro") {
        macroRef = `ActivityMacro.${macroItem?.uuid}`;
      }
      const current = foundry.utils.getProperty(actor, change.key);
      // includes wont work for macro names that are subsets of other macro names
      if (noDupDamageMacro && (current as string)?.split(",").some(macro => macro === macroRef)) return true;
      foundry.utils.setProperty(actor, change.key, current ? `${current},${macroRef}` : macroRef)
      return true;
    }
    const flagId = change.key.split(".").pop()!;
    const charFlag = change.key.includes(`flags.${game.system.id}`) ? this.systemConfig.characterFlags[flagId] : undefined;
    if (charFlag) {
      if (charFlag.type !== String) {
        const type = charFlag.type ?? Boolean;
        const rollData = actor.getRollData();
        const flagValue = foundry.utils.getProperty(rollData, change.key) || 0;
        // ensure the flag is not undefined when doing the roll, supports flagName @flags.dae.flagName + 1
        foundry.utils.setProperty(rollData, change.key, flagValue);
        let value = this.safeEval(this.safeEvalExpression(change.value, rollData), rollData);
        if (type === Boolean) foundry.utils.setProperty(actor, change.key, value ? true : false);
        else foundry.utils.setProperty(actor, change.key, value);
      }
      return true;
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
      // dnd5e 6 keeps these bonuses at abilities.<id>.<save|check>.roll.bonus; the old path is a read-only alias.
      const key = change.key.replace(/bonuses\.(save|check)$/, "$1.roll.bonus");
      const existing = foundry.utils.getProperty(actor, key);
      value = change.value;
      if (existing) value = existing + ((change.value.startsWith("+") || change.value.startsWith("-")) ? change.value : "+" + change.value);
      return foundry.utils.setProperty(actor, key, value)
    }

    if (change.key.startsWith("system.tools")) {
      // @ts-expect-error no dnd5e-types
      current = actor.system.tools;
      // @ts-expect-error no dnd5e-types
      const newTool = () => ({ ...actor.system.schema.fields.tools.element.getInitialValue({}), value: 1 });
      if (change.key === "system.tools.all") {
        for (let prof in this.systemConfig.tools) {
          if (current[prof]) continue;
          current[prof] = newTool();
        }
        return true;
      }
      const [_1, _2, tool, key] = change.key.split(".");
      current[tool] = foundry.utils.mergeObject(newTool(), current[tool] ?? {})
      if (key === "prof") {
        value = Number(change.value);
        current[tool].value = value;
      }
      if (key === "ability") {
        current[tool].ability = change.value;
      }
      if (key === "bonus") {
        foundry.utils.setProperty(current[tool], "roll.bonus", change.value);
      }
      return true;
    }

    switch (change.key) {
      case "system.attributes.movement.hover":
        foundry.utils.setProperty(actor, change.key, typeof change.value === "string"
          ? !["", "false", "0"].includes(change.value.trim().toLowerCase()) : !!change.value);
        return true;
      case "system.traits.di.all": case "system.traits.dr.all": case "system.traits.da.all":
      case "system.traits.dv.all": case "system.traits.sdi.all": case "system.traits.sdr.all":
      case "system.traits.sdv.all":
        foundry.utils.setProperty(actor, change.key.replace(".all", ".value"), new Set(["ALL"]));
        return true;
      case "system.traits.di.value": case "system.traits.dr.value": case "system.traits.dv.value":
      case "system.traits.da.value": case "system.traits.sdi.value": case "system.traits.sdr.value":
      case "system.traits.sdv.value": case "system.traits.idi.value": case "system.traits.idr.value":
      case "system.traits.idv.value": case "system.traits.ida.value": case "system.traits.idm.value":
        return super.doCustomArrayValue(actor, current, change, Object.keys(this.systemConfig.damageTypes));
      case "system.traits.di.bypasses":
      case "system.traits.dr.bypasses":
      case "system.traits.dv.bypasses":
      case "system.traits.da.bypasses":
      case "system.traits.dm.bypasses":
        const validKeys: string[] = Object.keys(this.systemConfig.itemProperties)
          .filter(key => this.systemConfig.itemProperties[key].isPhysical)
        return super.doCustomArrayValue(actor, current, change, validKeys);
      case "system.traits.da.custom": case "system.traits.di.custom": case "system.traits.dr.custom":
      case "system.traits.dv.custom": case "system.traits.sdi.custom": case "system.traits.sdr.custom":
      case "system.traits.sdv.custom": case "system.traits.ci.custom":
      case "system.traits.languages.custom": case "system.traits.armorProf.custom":
      case "system.traits.weaponProf.custom":
        value = (current ?? "").length > 0 ? (current as string).trim().split(";").map(s => s.trim()) : [];
        const traitSet = new Set(value);
        if (!traitSet.has(change.value)) {
          traitSet.add(change.value);
          foundry.utils.setProperty(actor, change.key, Array.from(traitSet).join("; "));
        }
        return true;
      case "system.traits.languages.all":
        // @ts-expect-error no dnd5e-types
        if (actor.system.traits.languages.value instanceof Set)
          foundry.utils.setProperty(actor, "system.traits.languages.value", new Set(Object.keys(DAESystemDND5E.enumerateLanguages(this.systemConfig.languages))))
        else
          foundry.utils.setProperty(actor, "system.traits.languages.value", Object.keys(DAESystemDND5E.enumerateLanguages(this.systemConfig.languages)))
        return true;
      case "system.traits.languages.value":
        return super.doCustomArrayValue(actor, current, change, Object.keys(this.languageList));
      case "system.traits.ci.all":
        // @ts-expect-error no dnd5e-types
        if (actor.system.traits.ci.value instanceof Set)
          foundry.utils.setProperty(actor, "system.traits.ci.value", new Set(Object.keys(this.systemConfig.conditionTypes)))
        else
          foundry.utils.setProperty(actor, "system.traits.ci.value", Object.keys(this.systemConfig.conditionTypes))
        return true;
      case "system.traits.ci.value":
        return super.doCustomArrayValue(actor, current, change, Object.keys(this.systemConfig.conditionTypes))
      case "system.traits.armorProf.value":
        return super.doCustomArrayValue(actor, current, change, undefined)
      case "system.traits.armorProf.all":
      case "system.traits.weaponProf.all": {
        const traitKey = change.key.replace(".all", "");
        const profList = change.key.includes("armorProf") ? this.armorProfList : this.weaponProfList;
        const traitValue = foundry.utils.getProperty(actor, `${traitKey}.value`);
        if (traitValue) {
          const allKeys = Object.keys(profList).filter(k => !k.startsWith("-"));
          foundry.utils.setProperty(actor, `${traitKey}.value`, traitValue instanceof Set ? new Set(allKeys) : allKeys);
        }
        return true;
      }
      case "system.traits.weaponProf.value":
        return super.doCustomArrayValue(actor, current, change, undefined)
      case "system.bonuses.weapon.damage":
      case "system.bonuses.spell.damage":
        value = change.value;
        if (current)
          value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
        const attacks = change.key === "system.bonuses.weapon.damage" ? this.weaponAttacks : this.spellAttacks;
        // @ts-expect-error no dnd5e-types
        attacks.forEach(atType => actor.system.bonuses[atType].damage += value);
        return true;
      case "system.bonuses.mwak.attack":
      case "system.bonuses.mwak.damage":
      case "system.bonuses.rwak.attack":
      case "system.bonuses.rwak.damage":
      case "system.bonuses.msak.attack":
      case "system.bonuses.msak.damage":
      case "system.bonuses.rsak.attack":
      case "system.bonuses.rsak.damage":
      case "system.bonuses.heal.attack":
      case "system.bonuses.heal.damage":
      case "system.bonuses.abilities.save":
      case "system.bonuses.abilities.check":
      case "system.bonuses.abilities.skill":
        value = change.value;
        if (current)
          value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
        foundry.utils.setProperty(actor, change.key, (current || "") + value);
        return true;

      case "system.attributes.movement.all":
        // @ts-expect-error no dnd5e-types
        const movement = actor.system.attributes.movement;
        let op = "";
        if (typeof change.value === "string") {
          change.value = change.value.trim();
          if (["+", "-", "/", "*"].includes(change.value[0])) {
            op = change.value[0];
          }
        }
        for (let key of Object.keys(movement)) {
          if (typeof movement[key] !== "number") continue;
          if (["units", "hover"].includes(key)) continue;
          let valueString = change.value;
          if (op !== "") {
            if (!movement[key]) continue;
            valueString = `${movement[key]} ${change.value}`;
          }
          try {
            const roll = new Roll(valueString, actor.getRollData());
            let result: number;
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
      case "flags.dae":
        let list = change.value.split(" ");
        const flagName = list[0];
        let formula = list.splice(1).join(" ")
        const rollData = actor.getRollData();
        // @ts-expect-error no dnd5e-types
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
}
// v14: core calls applyActiveEffects("initial") in prepareEmbeddedDocuments
// and applyActiveEffects("final") after prepareDerivedData. DAE WRAPPERs on
// applyActiveEffects and ActiveEffect.applyChange handle phase correction,
// field mappings, bonusSelector expansion, dae.eval, stacks, etc.

function prepareData(this: Actor.Implementation, wrapped) {
  const initMacrosOnLoad = game.settings.get("dae", "initMacrosOnLoad");
  if (!ValidSpec.actorSpecs) {
    ValidSpec.createValidMods();
  }

  try {
    // Ensure trait Sets exist before effects try to ADD to them
    // @ts-expect-error no dnd5e-types
    if (this.system.traits) {
      for (let key of ["da", "ida", "idr", "idv", "idi", "idm"]) {
        // @ts-expect-error no dnd5e-types
        if (!(this.system.traits[key]?.value instanceof Set)) {
          // @ts-expect-error no dnd5e-types
          this.system.traits[key] = { value: new Set(), bypasses: new Set(), custom: '' };
        }
      }
    }

    foundry.utils.setProperty(this, "flags.dae.onUpdateTarget", this._source.flags?.dae?.onUpdateTarget);

    // Core v14 prepareData handles:
    //   - specialStatuses snapshot + token notification
    //   - _clearData() (statuses.clear, overrides={}, _completedActiveEffectPhases.clear)
    //   - prepareEmbeddedDocuments → applyActiveEffects("initial") [DAE override]
    //   - prepareDerivedData
    //   - applyActiveEffects("final") [DAE override]
    wrapped();

    // @ts-expect-error no dnd5e-types
    const hasHeavy = this.items.some(i => i.system.equipped && i.system.properties.has("stealthDisadvantage"));
    if (hasHeavy) foundry.utils.setProperty(this, "flags.midi-qol.disadvantage.skill.ste", true);

    // Allow for changes made by effects
    preparePassiveSkills.bind(this)();

    if (debugEnabled > 1) debug("prepare data: after passes", this);

    // Filter immune conditions from actor.statuses (in-memory Set).
    // Document-level cleanup (static-id status documents) handled by reconcileActorStatuses.
    // @ts-expect-error no dnd5e-types
    const conditionImmunities = this.system.traits?.ci?.value;
    if (conditionImmunities) {
      for (const condition of conditionImmunities) this.statuses.delete(condition);
    }

    // On first prepareData, fire "init" for macro effects so hooks can re-initialize after world load
    if (initMacrosOnLoad && !daeInitMacroActors.has(this.uuid)) {
      daeInitMacroActors.add(this.uuid);
      const initEffects: ActiveEffect.Implementation[] = [];
      for (const ef of this.allApplicableEffects()) {
        // @ts-expect-error v14 system.changes
        const hasMacro = ef.system.changes.some(c => c.key.startsWith("macro.itemMacro") || c.key.startsWith("macro.activityMacro") || c.key.startsWith("macro.execute"));
        if (ef.disabled || ef.isSuppressed) continue;
        // @ts-expect-error applicableType
        if (ef.applicableType !== "Actor") continue;
        if (hasMacro) initEffects.push(ef);
      }
      for (const effect of initEffects) {
        if (game.ready)
          actionQueue.add(daeMacro, "init", this, effect, { effectUuid: effect.uuid });
        else
          pendingInitMacroEffects.push({ effectUuid: effect.uuid, actorUuid: this.uuid });
      }
    }
  } catch (err) {
    console.error("Could not prepare data ", this.name, err);
  }
}

// v14: getTargetType removed — v14's getFieldForProperty + field.applyChange() handles field resolution natively

function getRollData(this: Actor.Implementation, wrapped, ...args) {
  const data = wrapped(...args);
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
        const actor = actorFromUuid((data.actorUuid as string) ?? "");
        const token = getSelfTarget(actor);
        // If the return is a tokenDocument then we have no token on the scene
        if (token instanceof foundry.canvas.placeables.Token) data._token = token;
      }
      return data._token;
    },
    set(token) { data._token = token; }
  });

  if (!data.tokenUuid) Object.defineProperty(data, "tokenUuid", {
    get() { // During initialisation getSelfTarget will return a token document not a token
      if (data._tokenUuid) return data._tokenUuid;
      if (data.token instanceof foundry.canvas.placeables.Token)
        return data.token?.document.uuid ?? "undefined";
      else return (data.token as any)?.uuid ?? "undefined"
    },
    set(uuid) {
      data._tokenUuid = uuid;
    }
  });
  if (!data.tokenId) Object.defineProperty(data, "tokenId", {
    get() { return data._tokenId ?? (data.token as any)?.id ?? "undefined" },
    set(tokenId) { data._tokenId = tokenId }
  });
  return data;
}

async function preparePassiveSkills(this: Actor.Implementation) {
  // @ts-expect-error no dnd5e-types
  const skills = this.system.skills;
  if (!skills) return;
  for (let skillId of Object.keys(skills)) {
    // @ts-expect-error no dnd5e-types
    const skill = this.system.skills[skillId];
    const abilityId = skill.ability;
    const advdisadv = procAdvantageSkill(this, abilityId, skillId);
    skill.passive = skill.passive + 5 * advdisadv;
  }
}


function procAdvantageSkill(actor: Actor.Implementation, abilityId: string, skillId: string): number {
  const midiFlags = actor.flags["midi-qol"] ?? {};
  const advantage = midiFlags.advantage ?? {};
  const disadvantage = midiFlags.disadvantage ?? {};
  let withAdvantage = advantage.all ?? false;
  let withDisadvantage = disadvantage.all ?? false;

  if (advantage.ability) {
    withAdvantage = withAdvantage || !!advantage.ability.all || !!advantage.ability.check?.all;
  }
  if (advantage.ability?.check) {
    withAdvantage = withAdvantage || advantage.ability.check[abilityId];
  }
  if (advantage.skill) {
    withAdvantage = withAdvantage || advantage.skill.all || advantage.skill[skillId];
  }

  if (disadvantage.ability) {
    withDisadvantage = withDisadvantage || !!disadvantage.ability.all || !!disadvantage.ability.check?.all;
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


async function _prepareActorArmorClassAttribution(this: Actor.Implementation, wrapped, data: { title: string }) {
  let attributionHtml = await wrapped(data);
  const attributions: { label: string, type: string, value: string }[] = [];
  for (let effect of this.appliedEffects) {
    // @ts-expect-error v14 system.changes
    for (let change of effect.system.changes) {
      if (change.key === "system.attributes.ac.value" && !effect.disabled && !effect.isSuppressed) {
        attributions.push({
          label: `${effect.name} (dae)`,
          type: change.type,
          value: change.value
        })
      }
    }
  }
  if (attributions.length > 0) {
    //@ts-expect-error no dnd5e-types
    const extraHtml: string = await new game.system.applications.PropertyAttribution(this, attributions, "attributes.ac", { title: "" }).renderTooltip();
    attributionHtml = attributionHtml = attributionHtml.replace(/<tr class="total">([\s\S]+?)<\/tbody>/, "</tbody>");
    attributionHtml += extraHtml;
  }
  return attributionHtml;
}

function patchPrepareArmorClassAttribution() {
  libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype._prepareArmorClassAttribution", _prepareActorArmorClassAttribution, "WRAPPER");
}

export function getActorItemForEffect(effect: ActiveEffect.Implementation): Item.Implementation | undefined {
  if (effect.parent instanceof CONFIG.Item.documentClass && effect.parent.isEmbedded) return effect.parent;
  if (!effect.origin) return undefined;
  const parts = effect.origin?.split(".") ?? [];
  // e.g. `Actor.JUMlDngw2lHCQ1Bl.Item.Ra2Z1ujre76weR0i`
  const [parentType, parentId, documentType, documentId] = parts;
  let item: Item.Implementation | undefined;
  // Case 1: effect is a linked or sidebar actor - only if the actor ids match
  // During preparation effect.parent.id is undefined so we need to check for that
  if (parentType === "Actor" && documentType === "Item" && (!effect.parent?.id || parentId === effect.parent.id)) {
    item = (effect.parent as Actor.Implementation)?.items.get(documentId);
  }
  // Case 2: effect is a synthetic actor on the scene - only if the token ids match
  else if (parentType === "Scene") {
    // e.g. `Scene.Ja8H26CItQOgMwAe.Token.XrkeZ1McpGkudBjA.Actor.o5nHP4ijq6K2OLJB.Item.fI8m07LnyCCdsSpn`
    const [_scene, _sceneId, _token, tokenId, _actor, _actorId, syntheticItem, syntheticItemId] = parts;
    if ((tokenId === (effect.parent as Actor.Implementation)?.token?.id) && (syntheticItem === "Item"))
      item = (effect.parent as Actor.Implementation).items.get(syntheticItemId);
  }
  // Case 3: effect is a compendium item - only if the item id is present on the actor
  if (parentType === "Compendium") {
    let matches = effect.origin.match(/Compendium\.(.+)\.(.+?)Item\.(.+)/);
    if (matches && matches[3]) item = (effect.parent as Actor.Implementation)?.items.get(matches[3]);
  }
  return item;
}


/**
 * dnd5e gives an effect on an item `@item` and `@scaling` when it is prepared, but nothing to an effect applied to an
 * actor, so a reference an effect applied the dnd5e 6 way leaves for its target (`@item.level`,
 * `@activity.save.dc.value`, `@spellLevel`, ...) would resolve to 0. Supply them from what DAE recorded at application: the source item as cast and its activity
 * (read live, and only their prepared data - calling getRollData here would re-prepare during preparation), falling
 * back to the copies stored on the effect when the item can no longer be found.
 */
/**
 * Stop-gap for a gap in dnd5e 6's compatibility layer. dnd5e keeps the bonus paths it moved readable, with a
 * deprecation warning, by defining a getter on each old path's parent object (CommonTemplate#shimBonusData). It skips
 * a path whose parent no longer exists, and `bonuses.mwak/rwak/msak/rsak` and `bonuses.abilities` were removed, so
 * `@bonuses.mwak.damage` and the like resolve to nothing. Supply those, as dnd5e does, until dnd5e does itself.
 */
const MOVED_BONUS_PATHS: [string, string][] = [
  ["bonuses.mwak.attack", "rolls.attack.mwak.bonus"],
  ["bonuses.mwak.damage", "rolls.damage.mwak.bonus"],
  ["bonuses.rwak.attack", "rolls.attack.rwak.bonus"],
  ["bonuses.rwak.damage", "rolls.damage.rwak.bonus"],
  ["bonuses.msak.attack", "rolls.attack.msak.bonus"],
  ["bonuses.msak.damage", "rolls.damage.msak.bonus"],
  ["bonuses.rsak.attack", "rolls.attack.rsak.bonus"],
  ["bonuses.rsak.damage", "rolls.damage.rsak.bonus"],
  ["bonuses.abilities.check", "rolls.ability.check.bonus"],
  ["bonuses.abilities.save", "rolls.ability.save.bonus"],
  ["bonuses.abilities.skill", "rolls.ability.skill.bonus"]
];

function movedBonusAliases(system: AnyObject) {
  if (!system?.bonuses || typeof system.bonuses !== "object" || !system.rolls) return;
  for (const [original, updated] of MOVED_BONUS_PATHS) {
    const [, group, key] = original.split(".");
    // Hidden, as dnd5e's own aliases are, so listing roll data does not show them.
    if (!Object.prototype.hasOwnProperty.call(system.bonuses, group)) {
      Object.defineProperty(system.bonuses, group, { value: {}, enumerable: false, configurable: true, writable: true });
    }
    const container = system.bonuses[group];
    if (Object.prototype.hasOwnProperty.call(container, key)) continue;
    Object.defineProperty(container, key, {
      configurable: true,
      get: () => {
        foundry.utils.logCompatibilityWarning(`${original} has moved to "${updated}".`, {
          since: "DnD5e 6.0", until: "DnD5e 7.0", once: true
        });
        return foundry.utils.getProperty(system, updated) ?? "";
      }
    });
  }
}

function prepareBaseDataBonusAliases(this: Actor.Implementation, wrapped: Function, ...args: unknown[]) {
  const result = wrapped(...args);
  movedBonusAliases(this.system as AnyObject);
  return result;
}

/**
 * A dnd5e-mode applied effect's application references, for its target's preparation: the item and activity (live,
 * else from the card's snapshot or an older effect's copy), the spell level and scaling (flags.dnd5e), the card, the
 * caster and the workflow values. Reads data only: preparation must not prepare another document.
 */
function getReplacementData(this: ActiveEffect.Implementation, wrapped, baseData: AnyObject) {
  const data = wrapped(baseData);
  const application = this.flags?.dae?.applicationData;
  if (!application || !(this.parent instanceof Actor) || usesLegacyApplication(this)) return data;
  // @ts-expect-error v14 effect.system.changes
  if (!this.system?.changes?.some(change => typeof change.value === "string" && change.value.includes("@"))) return data;
  const effectSource = getEffectSource(this);
  const live = fromUuidSync(effectSource.itemUuid ?? "", { strict: false });
  const itemData = live instanceof Item ? live : getEffectItemData(this);
  // @ts-expect-error no dnd5e-types
  const spellLevel: number | undefined = this.flags.dnd5e?.spellLevel ?? application.spellLevel;
  // @ts-expect-error no dnd5e-types
  const scalingValue: number = this.flags.dnd5e?.scaling ?? application.scaling ?? 0;
  const item = itemData
    // @ts-expect-error no dnd5e-types
    ? { ...itemData.system, flags: itemData.flags, name: itemData.name, level: spellLevel ?? itemData.system?.level }
    : undefined;
  // @ts-expect-error no dnd5e-types
  const scaling = new dnd5e.documents.Scaling(scalingValue);
  const activityId = effectSource.activityUuid?.split(".").pop() ?? application.activityId;
  // @ts-expect-error no dnd5e-types
  const activity = (live instanceof Item ? live.system.activities?.get(activityId) : undefined)
    // @ts-expect-error no dnd5e-types
    ?? application.activity ?? (activityId ? itemData?.system?.activities?.[activityId] : undefined);
  return {
    ...data, ...application, item, activity, spellLevel, itemLevel: spellLevel, scaling,
    itemCardUuid: effectSource.messageUuid ?? application.itemCardUuid ?? null,
    actorUuid: effectSource.actorUuid ?? application.actorUuid ?? null
  };
}

function isSuppressed(this: ActiveEffect.Implementation, wrapped): boolean {
  let isSuppressed = wrapped();
  if (isSuppressed) return true;

  // Core's _prepareTimeBasedDuration clears duration.expired in-memory when remainingSeconds > 0,
  // which prevents special duration expiry (e.g. isAttacked) from working on effects that still
  // have time remaining. Check the raw DB value (_source) which is not overwritten by preparation.
  // @ts-expect-error expired not in fvtt-types _source schema
  if (this._source?.duration?.expired) return true;

  // If not on an actor, don't care to do more
  let actor: Actor.Implementation | undefined | null;
  if (this.parent instanceof Actor) actor = this.parent;
  else if (this.parent instanceof Item) actor = this.parent.parent;
  if (!actor) return isSuppressed;

  // Check if actor incapacitated if effect should be suppressed for that
  if (globalThis.MidiQOL && this.flags?.dae?.disableIncapacitated) {
    isSuppressed ||= globalThis.MidiQOL.checkIncapacitated(actor);
  }

  // This is only relevant if legacyTransfer is true (not so for dnd5e) or legacy effects exist on the actor i.e. having hung around since before legacyTransfer got set to false in dnd
  // In the olden days transfer effects were created on the actor with dae setting a flag to indicate they are transfer effects

  if (this.parent instanceof Actor && effectIsTransfer(this)) {
    const item = getActorItemForEffect(this);
    // @ts-expect-error no dnd5e-types
    if (item) isSuppressed ||= item.areEffectsSuppressed;
  }

  // @ts-expect-error no dnd5e-types
  const ciTraits = actor.system.traits?.ci;
  // Suppress status conditions that the actor is immune to
  if (ciTraits) {
    const customStats: string[] = (ciTraits.custom as string)?.split(';').map(s => s.trim().toLocaleLowerCase());
    const ci = new Set([...(ciTraits.value ?? []), ...(customStats ?? [])]);
    const statusId = (this.name ?? "no effect").toLocaleLowerCase();
    isSuppressed ||= ci.has(statusId);
  }
  return isSuppressed;
}

function preUpdateItemHook(
  candidateItem: Item.Implementation,
  updates: Item.UpdateData,
  context: Item.Database.UpdateOperation,
  userId: string
) {
  if (!candidateItem.isOwned) return true;
  if (game.user?.id !== userId) return true;
  const actor: Actor.Implementation | Item.Implementation | null = candidateItem.parent;
  if (!(actor instanceof Actor)) return true;
  // @ts-expect-error no dnd5e-types
  if (updates.system?.equipped === undefined && updates.system?.attunement === undefined && updates.system?.attuned === undefined) return true;
  try {
    // @ts-expect-error no dnd5e-types
    const wasSuppressed = candidateItem.areEffectsSuppressed;
    const updatedItem = candidateItem.clone({
      // @ts-expect-error no dnd5e-types
      "system.equipped": updates.system?.equipped ?? candidateItem.system.equipped,
      // @ts-expect-error no dnd5e-types
      "system.attunement": updates.system?.attunement ?? candidateItem.system.attunement,
      // @ts-expect-error no dnd5e-types
      "system.attuned": updates.system?.attuned ?? candidateItem.system.attuned
    });
    // @ts-expect-error no dnd5e-types
    const isSuppressed = updatedItem.areEffectsSuppressed;
    if (wasSuppressed === isSuppressed) return true;
    const tokens = actor.getActiveTokens();
    const action = isSuppressed ? "off" : "on";
    if (candidateItem.isOwned && candidateItem.parent instanceof CONFIG.Actor.documentClass) {
      for (let effect of candidateItem.effects) {
        if (!effectIsTransfer(effect)) continue;
        const actor = candidateItem.parent;
        // @ts-expect-error v14 system.changes
        actionQueue.add(processEffectChanges, action, actor, tokens, effect, candidateItem, effect.system.changes, context);
      }
    }
    // For non-legacy transferral we need to update the actor effects
    for (let effect of actor.effects) {
      if (!effectIsTransfer(effect) || effect.origin !== candidateItem.uuid) continue;
      // @ts-expect-error v14 system.changes
      actionQueue.add(processEffectChanges, action, actor, tokens, effect, candidateItem, effect.system.changes, context);
    }
  } catch (err) {
    console.error("dae | preItemUpdate", err)
  } finally {
    return true;
  }
}


type ItemSpecs = Record<string, {
  allSpecsObj: Record<string, ValidSpec>;
  allSpecs: ValidSpec[];
}>;
