import { requestGMAction, GMAction, applyActiveEffects } from "./GMAction";
import { warn, error, debug, setDebugLevel, i18n, timelog } from "../dae";
import { ActiveEffects } from "./apps/ActiveEffects";
import { DAEActiveEffectConfig } from "./apps/DAEActiveEffectConfig";
import { procStatusEffects } from "./statusEffects";
import { replaceFormulaData, updatePatches } from "./patching";
import { libWrapper } from "../libs/shim";

export let _characterSpec: { data: any, flags: any } = { data: {}, flags: {} }
let templates = {};

export var aboutTimeInstalled = false;
export var timesUpInstalled = false;
export var requireItemTarget = true;
export var cubActive;
export var furnaceActive;
export var itemacroActive;
export var conditionalVisibilityActive;
export var midiActive;
export var calculateArmor;
export var applyBaseAC;
export var debugEnabled;
export var useAbilitySave;
export var activeConditions;
export var confirmDelete;
export var ehnanceStatusEffects;
export var expireRealTime
export var daeActionTypeKeys;
export var displayTraits;
export var noDupDamageMacro;
export var disableEffects;

let debugLog = true;
let acAffectingArmorTypes = [];

export class ValidSpec {
  static allSpecs: ValidSpec[] = [];
  static allSpecsObj: {} = {};
  public static baseSpecs: ValidSpec[] = [];
  public static derivedSpecsObj: {} = {};
  public static baseSpecsObj: {} = {};
  public static derivedSpecs: ValidSpec[] = [];

  _fieldSpec: string;
  get fieldSpec(): string { return this._fieldSpec };
  set fieldSpec(spec: string) { this._fieldSpec = spec }

  _sampleValue: string | number | boolean | any[];
  get sampleValue(): string | number | boolean | any[] { return this._sampleValue }
  set sampleValue(value: string | number | boolean | any[]) { this._sampleValue = value }

  _label: string;
  get label(): string { return this._label }
  set label(label: string) { this._label = label }

  _forcedMode: number;
  get forcedMode(): number { return this._forcedMode }
  set forcedMode(mode: number) { this._forcedMode = mode }

  constructor(fs: string, sv: string | number | boolean | any[], forcedMode = -1) {
    this._fieldSpec = fs;
    this._sampleValue = sv;
    this._label = fs;
    this._forcedMode = forcedMode;
  }

  static createValidMods(characterSpec: {} = game.system.model.Actor.character) {
    _characterSpec["data"] = duplicate(characterSpec);
    let baseValues = flattenObject(_characterSpec);
    // data.attributes.prof/data.details.level and data.attributes.hd are all calced in prepareBaseData
    baseValues["data.attributes.prof"] = [0];
    baseValues["data.details.level"] = [0];
    baseValues["data.attributes.hd"] = 0;

    //@ts-ignore
    if (game.modules.get("gm-notes")?.active) {
      baseValues["flags.gm-notes.notes"] = "";
    }

    if (game.modules.get("skill-customization-5e")?.active && game.system.id === "dnd5e") {
      Object.keys(CONFIG.DND5E.skills).forEach(skl => {
        baseValues[`flags.skill-customization-5e.${skl}.skill-bonus`] = "";
      })
    }

    //@ts-ignore
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    if (["dnd5e", "sw5e"].includes(game.system.id)) {
      var specials = {
        //@ts-ignore - come back to this
        "data.attributes.ac.value": [0, -1],
        "data.attributes.ac.min": [0, -1],
        "data.attributes.hp.max": [0, -1],
        "data.attributes.hp.tempmax": [0, -1],
        "data.attributes.hp.min": [0, -1],
        // This does not work look at CONFIG.Comabt.initiative.formula
        "data.attributes.init.total": [0, -1],
        "data.attributes.init.mod": [0, -1],
        "data.attributes.hd": [0, -1],
        "data.abilities.str.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.abilities.dex.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.abilities.int.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.abilities.wis.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.abilities.cha.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.abilities.con.dc": [0, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.attributes.encumbrance.max": [0, -1],
        // "skills.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "macro.execute": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "macro.itemMacro": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.bonuses.All-Attacks": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.bonuses.weapon.attack": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.bonuses.spell.attack": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.bonuses.All-Damage": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.bonuses.weapon.damage": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.bonuses.spell.damage": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.languages.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.languages.value": ["", -1],
        "data.traits.languages.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.di.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.di.value": ["", -1],
        "data.traits.di.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dr.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dr.value": ["", -1],
        "data.traits.dr.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dv.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dv.value": ["", -1],
        "data.traits.dv.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.ci.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.ci.value": ["", -1],
        "data.traits.ci.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.toolProf.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.toolProf.value": ["", -1],
        "data.traits.toolProf.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.armorProf.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.armorProf.value": ["", -1],
        "data.traits.armorProf.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.weaponProf.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.weaponProf.value": ["", -1],
        "data.traits.weaponProf.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.size": ["", ACTIVE_EFFECT_MODES.OVERRIDE],
        "data.resources.primary.max": [0, -1],
        "data.resources.primary.label": ["", ACTIVE_EFFECT_MODES.OVERRIDE],
        "data.resources.secondary.max": [0, -1],
        "data.resources.secondary.label": ["", ACTIVE_EFFECT_MODES.OVERRIDE],
        "data.resources.tertiary.max": [0, -1],
        "data.resources.tertiary.label": ["", ACTIVE_EFFECT_MODES.OVERRIDE],
        "data.resources.legact.max": [0, -1],
        "data.resources.legres.max": [0, -1],
        "data.spells.pact.level": [0, -1],
        // "flags.midi-qol.forceCritical": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.bonuses.heal.damage": ["", -1],
        "data.bonuses.heal.attack": ["", -1],
        "data.bonuses.save.damage": ["", -1],
        "data.bonuses.abil.damage": ["", -1],

        "flags.dae": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.attributes.movement.all": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.attributes.movement.hover": [0, ACTIVE_EFFECT_MODES.CUSTOM]
      // "CUB": ["", ACTIVE_EFFECT_MODES.CUSTOM]
      };

      specials["macro.CUB"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.ConditionalVisibility"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.ConditionalVisibilityVision"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials[`flags.${game.system.id}.initiativeHalfProf`] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
      specials[`flags.${game.system.id}.DamageBonusMacro`] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials[`flags.${game.system.id}.initiativeDisadv`] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
      ["check", "save", "skill"].forEach(id => {
        specials[`data.bonuses.abilities.${id}`] = ["", -1];
      });

      if (game.system.id === "sw5e") {
        specials["data.attributes.powerForceLightDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
        specials["data.attributes.powerForceDarkDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
        specials["data.attributes.powerForceUnivDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
        specials["data.attributes.powerTechDC"] = [0, ACTIVE_EFFECT_MODES.CUSTOM];
      }
      let attackTypes = ["mwak", "rwak", "msak", "rsak"];
      if (game.system.id === "sw5e") attackTypes = ["mwak", "rwak", "mpak", "rpak"];
      attackTypes.forEach(id => {
        specials[`data.bonuses.${id}.attack`] = ["", -1];
        specials[`data.bonuses.${id}.damage`] = ["", -1];
      })


      // move all the characteer flags to specials so that the can be custom effects only
      let charFlagKeys = (game.system.id === "dnd5e") ? Object.keys(CONFIG.DND5E.characterFlags) : Object.keys(CONFIG.SW5E.characterFlags);
      charFlagKeys.forEach(key => {
        let theKey = `flags.${game.system.id}.${key}`;
        if ([`flags.${game.system.id}.weaponCriticalThreshold`,
        `flags.${game.system.id}.powerCriticalThreshold`,
        `flags.${game.system.id}.meleeCriticalDamageDice`,
        `flags.${game.system.id}.spellCriticalThreshold`].includes(theKey)) {
          specials[theKey] = [0, -1];
          delete baseValues[theKey];
        }
        else baseValues[theKey] = false;
      });

      // delete baseValues["data.attributes.init.value"];
      // patch for missing fields

      // needs to be int and in base values since it is used in prepare derived data 
      // to calc ability spell dcs
      //TODO work out how to evaluate this to a number in prepare data - it looks like this is wrong
      baseValues["data.bonuses.spell.dc"] = 0;
      baseValues["data.spells.pact.override"] = 0;
      Object.keys(baseValues).forEach(key => {
        // can't modify all spell details.
        if (key.includes("data.spells")) {
          delete baseValues[key];
        }
        if (key.includes("data.spells") && key.includes("override")) {
          baseValues[key] = 0;
        }
      });

      Object.keys(specials).forEach(key => {
        delete baseValues[key]
      })
      delete baseValues["data.attributes.init.total"];
      delete baseValues["data.attributes.init.mod"];
      delete baseValues["flags"];
    }

    // baseSpecs are all those fields defined in template.json game.system.model and are things the user can directly change
    this.baseSpecs = Object.keys(baseValues).map(spec => {
      let validSpec = new ValidSpec(spec, baseValues[spec], -1);
      if (spec.includes("data.skills") && spec.includes("ability")) {
        validSpec.forcedMode = ACTIVE_EFFECT_MODES.OVERRIDE;
      }
      if (spec.includes("data.bonuses.abilities")) {
        validSpec.forcedMode = -1;
      }
      if (spec.includes(`flags.${game.system.id}`))
        validSpec.forcedMode = ACTIVE_EFFECT_MODES.CUSTOM;

      this.baseSpecsObj[spec] = validSpec;
      return validSpec;
    });
    //@ts-ignore
    if (game.modules.get("tokenmagic")?.active) {
      specials["macro.tokenMagic"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    }

    // Do the system specific part
    if (["dnd5e", "sw5e"].includes(game.system.id)) {
      // 1. abilities add mod and save to each;
      Object.keys(_characterSpec.data.abilities).forEach(ablKey => {
        let abl = _characterSpec.data.abilities[ablKey];
        this.derivedSpecs.push(new ValidSpec(`data.abilities.${ablKey}.mod`, 0))
        this.derivedSpecs.push(new ValidSpec(`data.abilities.${ablKey}.save`, 0))
        this.derivedSpecs.push(new ValidSpec(`data.abilities.${ablKey}.min`, 0))
      })
      // adjust specs for bonuses - these are strings, @fields are looked up but dice are not rolled.

      // Skills add mod, passive and bonus fields
      Object.keys(_characterSpec.data.skills).forEach(sklKey => {
        let skl = _characterSpec.data.skills[sklKey];
        this.derivedSpecs.push(new ValidSpec(`data.skills.${sklKey}.mod`, 0))
        this.derivedSpecs.push(new ValidSpec(`data.skills.${sklKey}.passive`, 0))
      })

      Object.entries(specials).forEach(special => {
        let validSpec = new ValidSpec(special[0], special[1][0], special[1][1]);
        this.derivedSpecs.push(validSpec);
      })
    }
    this.allSpecs = this.baseSpecs.concat(this.derivedSpecs);
    if (["dnd5e", "sw5e"].includes(game.system.id)) {
      // Special case for armor/hp which can depend on derived attributes - like dexterity mod or constituion mod
      // and initiative bonus depends on advantage on initiative
      this.allSpecs.forEach(m => {
        if (["attributes.hp", "attributes.ac"].includes(m._fieldSpec)) {
          m._sampleValue = 0;
        }
      });
    }
    this.allSpecs.sort((a, b) => { return a._fieldSpec < b._fieldSpec ? -1 : 1 });
    this.baseSpecs.sort((a, b) => { return a._fieldSpec < b._fieldSpec ? -1 : 1 });
    this.derivedSpecs.sort((a, b) => { return a._fieldSpec < b._fieldSpec ? -1 : 1 });
    this.allSpecs.forEach(ms => this.allSpecsObj[ms._fieldSpec] = ms);
    this.baseSpecs.forEach(ms => this.baseSpecsObj[ms._fieldSpec] = ms);
    this.derivedSpecs.forEach(ms => this.derivedSpecsObj[ms._fieldSpec] = ms);
  }

  static localizeSpecs() {
    const fieldStart = `flags.${game.system.id}.`;
    this.allSpecs = this.allSpecs.map(m => {
      m._label = m._label.replace("data.", "").replace(`{game.system.id}.`, "").replace(".value", "").split(".").map(str => game.i18n.localize(`dae.${str}`)).join(" ");
      if (m.fieldSpec.includes(`flags.${game.system.id}`)) {
        const fieldId = m.fieldSpec.replace(fieldStart, "");
        const characterFlags = (game.system.id === "dnd5e") ? CONFIG.DND5E.characterFlags : CONFIG.SW5E.characterFlags;
        const localizedString = i18n(characterFlags[fieldId]?.name) ?? i18n(`dae.${fieldId}`)
        m._label = `Flags ${localizedString}`;
      }
      if (this.derivedSpecsObj[m._fieldSpec]) m._label = `${m._label} (*)`
      return m
    });
  }
}

function effectDisabled(actor, efData, itemData = null) {
  let disabled = efData.disabled;
  const ci = actor.data.data.traits?.ci?.value;
  const statusId = efData.flags?.core?.statusId;
  disabled = disabled || (ci && ci.includes(statusId));
  /* TODO revist emabling/disabling according to condition immunities
  */

  // transfer effects depend on the item to disable/enable (if there is one)
  if (efData.flags?.dae?.transfer || efData.transfer) {
    if (!itemData && efData.origin) { // itemData not passed, see if we have the item
      itemData = DAEfromUuid(efData.origin).document.data;
    }
    // Non eequip items
    let nonEquipItems = ["feat", "spell"];
    if (game.system.id === "sw5e") {
      nonEquipItems = ["archetype", "background", "class", "classfeature", "feat",
        "fightingmastery", "fightingstyle", "lightsaberform", "power", "species"];
    }

    if (itemData && !nonEquipItems.includes(itemData.type)) {
      // item is disabled if it is not equipped
      // OR item is equipped but attunment === requires attunement
      disabled = !itemData.data.equipped || itemData.data.attunement === 1;
    }
  }
  // if not calcullating armor disable armor effects
  if (efData.flags.dae?.armorEffect)
    disabled = disabled || !calculateArmor;
  return disabled;
}

// this function replaces applyActiveEffects in Actor
function applyBaseActiveEffects() {
  applyDaeEffects.bind(this)(ValidSpec.baseSpecsObj, {}, false)
}
/*
 * Replace default appplyAffects to do value lookups
 */
function applyDaeEffects(specList, completedSpecs, allowAllSpecs: boolean) {
  if (disableEffects) return;
  const overrides = {};
  if (!this.effects || this.effects.size === 0) return this.overrides || {};
  // Organize non-disabled effects by their application priority
  const changes = this.effects.reduce((changes, effect) => {
    // e.data.disabled = effectDisabled(this, e.data)
    if (effect.data.disabled) return changes;
    // TODO find a solution for flags.? perhaps just a generic speclist
    return changes.concat(expandEffectChanges(effect.data.changes)
      .filter(c => { return !completedSpecs[c.key] && (allowAllSpecs || specList[c.key] !== undefined) })
      .map(c => {
        c = duplicate(c);
        c.effect = effect;
        c.priority = c.priority ?? (c.mode * 10);
        return c;
      }));
  }, []);
  changes.sort((a, b) => a.priority - b.priority);

  if (changes.length > 0) debug("Applying change ", this.name, changes)
  // Apply all changes
  for (let c of changes) {
    //TODO remove @data sometime
    if (typeof c.value === "string" && c.value.includes("@data.")) {
      console.warn("dae | @data.key is deprecated, use @key instead", c.value)
      c.value = c.value.replace(/@data./g, "@");
    }
    //@ts-ignore
    if (c.mode !==  CONST.ACTIVE_EFFECT_MODES.CUSTOM) {
      if (typeof specList[c.key]?.sampleValue === "number" && typeof c.value === "string" ) {
        debug("appplyDaeEffects: Doing eval of ", c, c.value)
        try { // Roll parser no longer accepts some expressions it used to so we will try and avoid using it
          let value = replaceAtFields(c.value, daeRollData(this));
           //@ts-ignore - this will throw an error if there are roll expressions
            c.value = Roll.safeEval(value)
        } catch (err) { // safeEval failed try a roll
          try {
            console.warn("dae | you are using dice expressions in a numeric field this will be disabled when foundry 0.9 is release")
            //@ts-ignore evaluate - TODO work out how to do this async
            c.value = new Roll(c.value).evaluate({ async: false }).total;
          } catch(err) {
            console.warn("change value calculation failed for", this, c);
            console.warn(err)
          }
        }
      }
    }

    const result = c.effect.apply(this, c);
    if (result !== null) overrides[c.key] = result;
  }

  // Expand the set of final overrides
  this.overrides = mergeObject(this.overrides || {}, expandObject(overrides) || {}, { inplace: true, overwrite: true });
}

function expandEffectChanges(changes) {
  let returnChanges = changes.reduce((list, change) => {
    if (!bonusSelectors[change.key]) {
      list.push(change);
    } else {
      const attacks = bonusSelectors[change.key].attacks;
      const selector = bonusSelectors[change.key].selector;
      attacks.forEach(at => {
        const c = duplicate(change);
        c.key = `data.bonuses.${at}.${selector}`;
        list.push(c);
      });
    }
    return list;
  }, [])
  return returnChanges;
}

/*
 * do custom effefct applications
 * damage resistance/immunity/vulnerabilities
 * languages
 */
function daeCustomEffect(actor, change) {
  const current = getProperty(actor.data, change.key);
  var validValues;
  var value;
  const damageBonusMacroFlag = `flags.${game.system.id}.DamageBonusMacro`;
  if (change.key === damageBonusMacroFlag) {
    let current = getProperty(actor.data, change.key);
    // includes wont work for macro names that are subsets of other macro names
    if (noDupDamageMacro && current?.split(",").some(macro => macro === change.value)) return true;
    setProperty(actor.data, change.key, current ? `${current},${change.value}` : change.value)
    return true;
  }
  if (change.key.includes(`flags.${game.system.id}`)) {
    const value = ["1", "true"].includes(change.value);
    setProperty(actor.data, change.key, value);
    return true;
  }

  switch (change.key) {
    case "data.attributes.movement.hover":
      setProperty(actor.data, change.key, change.value ? true : false);
      return true;
    case "data.traits.di.all":
    case "data.traits.dr.all":
    case "data.traits.dv.all":
      const key = change.key.replace(".all", ".value")
      if (game.system.id === "dnd5e")
        setProperty(actor.data, key, Object.keys(CONFIG.DND5E.damageResistanceTypes))
      else
        setProperty(actor.data, key, Object.keys(CONFIG.SW5E.damageResistanceTypes))
      return true;
    case "data.traits.di.value":
    case "data.traits.dr.value":
    case "data.traits.dv.value":
      if (game.system.id === "dnd5e")
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.damageResistanceTypes));
      else
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.damageResistanceTypes));
    case "data.traits.di.custom":
    case "data.traits.dr.custom":
    case "data.traits.dv.custom":
    case "data.traits.ci.custom":
    case "data.traits.languages.custom":
    case "data.traits.toolProf.custom":
    case "data.traits.armorProf.custom":
    case "data.traits.weaponProf.custom":
      value = current.concat(current.length === 0 ? `${change.value}` : `; ${change.value}`);
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
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.languages));
      else
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.languages));
    case "data.traits.ci.all":
      if (game.system.id === "dnd5e")
        setProperty(actor.data, "data.traits.ci.value", Object.keys(CONFIG.DND5E.conditionTypes))
      else
        setProperty(actor.data, "data.traits.ci.value", Object.keys(CONFIG.SW5E.conditionTypes))
      return true;
    case "data.traits.ci.value":
      if (game.system.id === "dnd5e")
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.conditionTypes))
      else
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.conditionTypes))
    case "data.traits.toolProf.value":
      if (game.system.id === "dnd5e")
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.toolProficiencies))
      else
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.toolProficiencies))
    case "data.traits.toolProf.all":
      if (game.system.id === "dnd5e")
        setProperty(actor.data, "data.traits.toolProf.value", Object.keys(CONFIG.DND5E.toolProficiencies))
      else
        setProperty(actor.data, "data.traits.toolProf.value", Object.keys(CONFIG.SW5E.toolProficiencies))
      return true;
    case "data.traits.armorProf.value":
      if (game.system.id === "dnd5e")
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.armorProficiencies))
      else
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.armorProficiencies))
    case "data.traits.armorProf.all":
      if (game.system.id === "dnd5e")
        setProperty(actor.data, "data.traits.armorProf.value", Object.keys(CONFIG.DND5E.armorProficiencies))
      else
        setProperty(actor.data, "data.traits.armorProf.value", Object.keys(CONFIG.SW5E.armorProficiencies))
      return true;
    case "data.traits.weaponProf.value":
      if (game.system.id === "dnd5e")
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.weaponProficiencies))
      else
        return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.SW5E.weaponProficiencies))
    case "data.traits.weaponProf.all":
      if (game.system.id === "dnd5e")
        setProperty(actor.data, "data.traits.weaponProf.value", Object.keys(CONFIG.DND5E.weaponProficiencies))
      else
        setProperty(actor.data, "data.traits.weaponProf.value", Object.keys(CONFIG.SW5E.weaponProficiencies))
      return true;
    case "data.bonuses.weapon.damage":
      value = attackDamageBonusEval(change.value, actor)
      value = replaceAtFields(value, daeRollData(actor));
      if (current)
        value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
      weaponAttacks.forEach(atType => actor.data.data.bonuses[atType].damage += value);
      return true;
    case "data.bonuses.spell.damage":
      value = attackDamageBonusEval(change.value, actor)
      value = replaceAtFields(value, daeRollData(actor));
      if (current)
        value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
      spellAttacks.forEach(atType => actor.data.data.bonuses[atType].damage += value);
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
      let result = attackDamageBonusEval(change.value, actor);
      value = replaceAtFields(result, daeRollData(actor));
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
          change.value = change.value.slice(1);
        }
      }
      value = Number(change.value);
      Object.keys(movement).forEach(key => {
        if (typeof movement[key] === "number") {
          switch (op) {
            case "+": movement[key] += value; break;
            case "-": movement[key] = Math.max(0, movement[key] - value); break;
            case "/": movement[key] = Math.floor(movement[key] / value); break;
            case "*": movement[key] *= value; break;
            default: movement[key] = value; break;
          }
        }
      })
      return true;
    case "data.abilities.str.dc":
    case "data.abilities.dex.dc":
    case "data.abilities.int.dc":
    case "data.abilities.wis.dc":
    case "data.abilities.cha.dc":
    case "data.abilities.con.dc":
    case "data.attributes.powerForceLightDC":
    case "data.attributes.powerForceDarkDC":
    case "data.attributes.powerForceUnivDC":
    case "data.attributes.powerTechDC":

      //@ts-ignore
      value = Number.isNumeric(change.value) ? parseInt(change.value) : 0;
      if (value) {
        setProperty(actor.data, change.key, current + value);
      }
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
      const rollData = daeRollData(actor);
      const flagValue = getProperty(rollData.flags, `dae.${flagName}`) ?? "";
      // ensure the flag is not undefined when doing the roll, supports flagName @flags.dae.flagName + 1
      setProperty(rollData, `flags.dae.${flagName}`, flagValue);
      //@ts-ignore evaluate TODO work out async
      value = new Roll(formula, rollData).evaluate({ async: false }).total;
      setProperty(actor.data, `flags.dae.${flagName}`, value);
      return true;

    case "data.attributes.ac.value":
      if (change.value === "AutoCalc")  {
        computeAC(actor, change);
      }
      return true;
  }
}

export function replaceAtFields(value, context) {
  if (typeof value !== "string") return value;
  if (!value.includes("@")) return value;
  // Remove @data references
  let result = duplicate(value);
  let re = /@[\w\.]+/g
  for (let match of value.match(re) || []) 
    result = result.replace(match.replace("@data.", "@"), getProperty(context, match.slice(1)))
  return result;
}

// Special case handling of (expr)dX
function attackDamageBonusEval(bonusString, actor) {
  return bonusString;
  if (typeof bonusString === "string") {
    const special = bonusString.match(/\((.+)\)\s*d([0-9]+)(.*)/);
    // const special = bonusString.match(/\(([\s\S]+)\)\s+d([0-9]*)\)([\s\S]+)/);
    if (special && special.length >= 3) {
      try {
        return new Roll(special[1].replace(/ /g, ""), daeRollData(actor)).roll().total + "d" + special[2] + (special[3] ?? "");
      }
      catch (err) {
        console?.warn(`DAE eval error for: ${special[1].replace(/ /g, "")} in actor ${actor.name}`, err);
        return bonusString;
      }
    }
  }
  return `${bonusString || ""}`;
}

function doCustomValue(actor, current, change, validValues) {
  if ((current || []).includes(change.value)) return true;
  if (!validValues.includes(change.value)) return true;
  setProperty(actor.data, change.key, current.concat([change.value]))
  return true;
}

function doCustomArrayValue(actor, current, change, validValues) {
  if (getType(change.value) === "string" && change.value[0] === "-") {
    const checkValue = change.value.slice(1);
    const currentIndex = (current ?? []).indexOf(checkValue)
    if (currentIndex === -1) return true;
    if (!validValues.includes(checkValue)) return true;
    const returnValue = duplicate(current);
    returnValue.splice(currentIndex, 1)
    setProperty(actor.data, change.key, returnValue);
  } else {
    if ((current ?? []).includes(change.value)) return true;
    if (!validValues.includes(change.value)) return true;
    setProperty(actor.data, change.key, current.concat([change.value]))
  }
  return true;
}

/*
* replace the default actor prepareData
* call applyDaeEffects
* add an additional pass after derivfed data
*/
function prepareData(wrapped) {
  debug("prepare data: before passes", this.name, this.data._source);
  this.overrides = {};
  wrapped();
  if (["dnd5e", "sw5e"].includes(game.system.id)) {
    if (applyBaseAC && this.data.type === "character" && !this.data.flags[game.system.id]?.isPolymorphed) {
      this.data.data.attributes.ac.value = 10 + Number(this.data.data.abilities.dex.mod);
    }
  }
  applyDaeEffects.bind(this)(ValidSpec.derivedSpecsObj, ValidSpec.baseSpecsObj, true);
  //TODO find another way to tdo this
  // this._prepareOwnedItems(this.data.items)
  debug("prepare data: after passes", this.data);
}

async function addTokenMagicChange(actor, change, tokens, tokenMagic) {
  for (let token of tokens) {
    await tokenMagic.addFilters(token, change.value);
  }
}

async function removeTokenMagicChange(actor, change, tokens, tokenMagic) {
  for (let token of tokens) {
    await tokenMagic.deleteFilters(token, change.value);
  }
}

async function removeCVChange(actor, change, tokens, CV) {
  if (change.key === "macro.ConditionalVisibility") {
    if (change.value === "hidden")
      CV?.unHide(tokens);
    else
      CV?.setCondition(tokens, change.value, false);
  } else if (change.key === "macro.ConditionalVisibilityVision") {
    for (let t of tokens) {
      t.setFlag("conditional-visibility", change.value, false)
    }
  }
}

async function addCVChange(actor, change, tokens, CV) {
  if (change.key === "macro.ConditionalVisibility") {
    if (change.value === "hidden")
      CV?.hide(tokens)
    else
      CV?.setCondition(tokens, change.value, true);
  } else if (change.key === "macro.ConditionalVisibilityVision") {
    for (let t of tokens) {
      t.setFlag("conditional-visibility", change.value, true)
    }
  }
}

async function handleAddConcentration(actor, effect, tokens) {
  let concentrationLabel = game.cub?.active ? game.settings.get("combat-utility-belt", "concentratorConditionName") : "Concentrating";
  const isConcentration = effect.label === concentrationLabel;
  if (!isConcentration) return false;
}

async function handleRemoveConcentration(effect, tokens) {
  // TODO fix this to be localised
  let actor = effect.parent;
  let concentrationLabel = game.cub?.active ? game.settings.get("combat-utility-belt", "concentratorConditionName") : "Concentrating";
  let isConcentration = effect.data.label === concentrationLabel;

  if (!isConcentration) return false;
  const concentrationData = getProperty(actor.data.flags, "midi-qol.concentration-data");
  if (!concentrationData) return;
  try {
    await actor.unsetFlag("midi-qol", "concentration-data")
    concentrationData.templates.forEach(templateUuid => DAEfromUuid(templateUuid).delete());
    requestGMAction(GMAction.actions.deleteEffects, { targets: concentrationData.targets, origin: concentrationData.uuid });
  } catch (err) {
    console.warn("dae | error deleteing effects: ", err)
  }
}

export async function preCreateActiveEffect(activeEffect, effectData, options, userId) {
  const parent = activeEffect.parent;
  //@ts-ignore documentClass TODO
  if (!parent || !(parent instanceof CONFIG.Actor.documentClass)) return;
  const theEffects = Array.isArray(effectData) ? effectData : [effectData];
  const token = parent.isToken ? parent.token : parent.getActiveTokens()[0];
  //@ts-ignore
  const checkConcentration = (window.MidiQOL?.configSettings()?.concentrationAutomation)

  //@ts-ignore
  const CV = window.ConditionalVisibility;
  //@ts-ignore
  const tokenMagic = window.TokenMagic;

  let update = async () => {
    warn("add active effect actions", parent, effectData)
    for (let effect of theEffects) {
      if (token) {
        if (effect.changes) {
          for (let change of effect.changes) {
            if (CV) addCVChange(parent, change, [token], CV); //TODO check disabled
            if (cubActive && change.key === "macro.CUB") await game.cub.addCondition(change.value, [token]);
            if (tokenMagic && change.key === "macro.tokenMagic") await addTokenMagicChange(parent, change, [token], tokenMagic); //TODO check disabled
          }
        }
        if (checkConcentration) await handleAddConcentration(parent, effect, [token]);
      }
    };
    //TODO clean this up eventually
    await daeMacro("on", parent, theEffects, {});
  };
  Hooks.once("createActiveEffect", update);
  return true;
}

export async function preDeleteActiveEffect(effect, ...args) {
  //@ts-ignore documentClass
  if (!(effect.parent instanceof CONFIG.Actor.documentClass)) return;
  const actor = effect.parent;
  const token = actor.isToken ? actor.token : actor.getActiveTokens()[0];
  //@ts-ignore
  //  const checkConcentration = (cubActive && window.MidiQOL?.configSettings()?.concentrationAutomation) 
  //@ts-ignore
  const checkConcentration = window.MidiQOL?.configSettings()?.concentrationAutomation;

  //@ts-ignore
  const CV = window.ConditionalVisibility;
  //@ts-ignore
  const tokenMagic = window.TokenMagic;

  let update = async (effect, options, user) => {
    const actor = effect.parent;
    if (token && effect.changes) {
      for (let change of effect.data.changes) {
        if (cubActive && change.key === "macro.CUB") await game.cub.removeCondition(change.value, [token], { warn: false });
        if (tokenMagic && change.key === "macro.tokenMagic") await removeTokenMagicChange(actor, change, [token], tokenMagic)
        if (CV) await removeCVChange(actor, change, [token], CV);
      }
    }
    if (checkConcentration) await handleRemoveConcentration(effect, [token]);
    // TODO clean this up eventually
    await daeMacro("off", actor, effect.data, {});
  }
  Hooks.once("deleteActiveEffect", update)
  return true;
}


function preUpdateActiveEffect(activeEffect, changes, options, userCalendarSpec) {
  const parent = activeEffect.parent;
  //@ts-ignore documentClass TODO
  if (!parent || !(parent instanceof CONFIG.Actor.documentClass)) return;
  const token = parent.isToken ? parent.token : parent.getActiveTokens()[0];
  //@ts-ignore
  const checkConcentration = (window.MidiQOL?.configSettings()?.concentrationAutomation)
  //@ts-ignore
  const CV = window.ConditionalVisibility;
  //@ts-ignore
  const tokenMagic = window.TokenMagic;
  const oldDisabled = activeEffect.data.disabled;

  let update = async (newEffect, changes) => {
    // Just deal with equipped etc
    warn("add active effect actions", parent, changes)
    if (token) {
      if (newEffect.disabled) {
        for (let change of newEffect.data.changes) {
          if (CV) removeCVChange(parent, change, [token], CV);
          if (cubActive && change.key === "macro.CUB") await game.cub.removeCondition(change.value, [token]);
          if (tokenMagic && change.key === "macro.tokenMagic") await removeTokenMagicChange(parent, change, [token], tokenMagic);
        }
      } else {
        for (let change of newEffect.data.changes) {
          if (CV) addCVChange(parent, change, [token], CV);
          if (cubActive && change.key === "macro.CUB") await game.cub.addCondition(change.value, [token]);
          if (tokenMagic && change.key === "macro.tokenMagic") await addTokenMagicChange(parent, change, [token], tokenMagic);
        }
      }
    };
  }
  if (oldDisabled !== changes.disabled) Hooks.once("updateActiveEffect", update);
  return true;
}

export async function getSelfTarget(actor) {
  if (actor.token) return actor.token;
  const speaker = ChatMessage.getSpeaker({ actor })
  if (speaker.token) return canvas.tokens.get(speaker.token);
  //@ts-ignore TokenDocument
  new TokenDocument({}, { actor });
}

export async function daeMacro(action: string, actor, effects, lastArgOptions = {}) {
  //  if (actor.__proto__.constructor.name === CONFIG.Item.entityClass.name) return;
  let result;
  if (!Array.isArray(effects)) effects = [effects];
  // Work out what itemdata should be

  warn("Dae macro ", action, actor, effects, lastArgOptions)
  for (let effectData of effects) {
    if (!effectData.changes) continue;
    for (let change of effectData.changes) {
      try {
        if (!["macro.execute", "macro.itemMacro"].includes(change.key)) continue;
        let lastArg = mergeObject(lastArgOptions, {
          //@ts-ignore - undefined fields
          effectId: effectData._id,
          origin: effectData.origin,
          efData: effectData,
          actorId: actor.id,
          actorUuid: actor.uuid,
          tokenId: actor.token ? actor.token.id : (await getSelfTarget(actor))?.id,
          tokenUuid: actor.token ? actor.token.uuid : (await getSelfTarget(actor))?.uuid,
        }, { overwrite: false, insertKeys: true, insertValues: true, inplace: false });
        //@ts-ignore 
        const theChange = await evalArgs({ itemData: null, effectData, context: daeRollData(actor), actor, change, doRolls: true })
        let args = [];
        if (typeof theChange.value === "string") {
          tokenizer.tokenize(theChange.value, (token) => args.push(token));
        } else args = change.value;
        if (theChange.key === "macro.execute" || theChange.key.includes("macro.itemMacro")) {
            const macro = await getMacro({key: change.key, name: args[0]}, null, effectData);
            if (!macro) {
              //TODO localize this
              if (action !== "off") {
                ui.notifications.warn(`macro.execute/macro.itemMacro | No macro ${theChange.value[0]} found`)
                error(`macro.execute/macro.itemMacro | No macro ${theChange.value[0]} found`);
                continue;
              }
            }

            // insert item data
          if (furnaceActive) {
              if (theChange.key === "macro.execute")
                //@ts-ignore
                result = await macro.execute(action, ...args.slice(1), lastArg)
              else
                //@ts-ignore
                result = await macro.execute(action, ...args, lastArg)
            } else {
              console.warn("Furnace not active - so no macro arguments supported");
              //@ts-ignore
              result = macro.execute({ actor });
            }
          }
        } catch (err) {
          console.warn(err);
        }
    };
  }
}

function daeRollData(actor) {
  let rollData = actor.getRollData();
  rollData.flags = actor.data.flags;
  return rollData;
}

export async function evalArgs({ effectData = null, itemData = null, context, actor, change, spellLevel = 0, damageTotal = 0, doRolls = false, critical = false, fumble = false, whisper = false, itemCardId = null }) {
  // change so that this is item.data, rather than item.
  if (itemData) setProperty(effectData.flags, "dae.itemData", itemData);
  if (typeof change.value !== 'string')
    return change; // nothing to do
  const returnChange = duplicate(change);
  const contextToUse = context;
  contextToUse.scene = canvas.scene.id;
  contextToUse.token = ChatMessage.getSpeaker({ actor }).token;
  contextToUse["target"] = "@target";
  context["targetUuid"] = "@targetUuid"
  contextToUse["itemData"] = "@itemData";
  // what to do for item
  contextToUse.spellLevel = spellLevel;
  contextToUse["item.level"] = spellLevel;
  contextToUse.damage = damageTotal;
  contextToUse.itemCardId = itemCardId;
  contextToUse.unique = randomID();
  contextToUse.actor = actor.id;
  contextToUse.actorUuid = actor.uuid;
  contextToUse.critical = critical;
  contextToUse.fumble = fumble;
  contextToUse.whisper = whisper;
  contextToUse.change = JSON.stringify(change.toJSON);;
  contextToUse.itemId = itemData?.id ? itemData._id : "undefineed";
  // TODO work out item uuid
  returnChange.value = replaceAtFields(returnChange.value, contextToUse);
  switch (change.key) {
    case "macro.itemMacro":
    case "macro.execute": // for macros we want to tokeniz the arguments
      break;
    case "macro.CUB":
    case "macro.ConditionalVisibility":
    case "macro.ConditionalVisibilityVision":
    case "macro.tokenMagic":
      break;
    default:
      if (doRolls && typeof ValidSpec.allSpecsObj[change.key]?.sampleValue === "number") {
        //@ts-ignore evaluate
        returnChange.value = new Roll(returnChange.value, context).evaluate({ async: false }).total;
      };
      break;
  };
  debug("evalargs: change is ", returnChange);
  return returnChange;
}

export async function getMacro({key, name}, itemData, effectData) {
  if (key === "macro.execute") {
    // the first argument conatins the macro name
    return  game.macros.getName(name);
  } else if (key.startsWith("macro.itemMacro")) {
    // Get the macro command for the macro TODO look at using an item name as well?

    // 1. Try and get item dat to look for the command in.
    if (!itemData) itemData = getProperty(effectData.flags, "dae.itemData")
    let macroCommand = getProperty(effectData.flags, "dae.itemData.flags.itemacro.macro.data.command");

    // Could not get the macro from the itemData or we had not Itemdata
    if (!macroCommand && !itemData) { // we never got an item do a last ditch attempt
      warn("eval args: fetching item from effectData/origin ", effectData.origin)
      itemData = DAEfromActorUuid(effectData?.origin); // Try and get it from the effectData
      //@ts-ignore
      macroCommand = itemData?.flags.itemacro?.macro.data.command;
      if (effectData) setProperty(effectData.flags, "dae.itemData", itemData);
    }
    if (!macroCommand) {
      macroCommand = `if (!args || args[0] === "on") {ui.notifications.warn("macro.itemMacro | No macro found for item ${itemData?.name}");}`;
      error(`No macro found for item ${itemData?.name}`);
    }
    if (effectData) setProperty(effectData.flags, "dae.macroCommand", macroCommand);
    return CONFIG.Macro.documentClass.create({
      name: "DAE-Item-Macro",
      type: "script",
      img: null,
      command: macroCommand,
      // TODO see if this should change.
      flags: { "dnd5e.itemMacro": true }
    }, { displaySheet: false, temporary: true });
  }
}
/*
 * appply non-transfer effects to target tokens - provided for backwards compat
 */
export async function doEffects(item, activate, targets = undefined,
  { whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false }) {
  return applyNonTransferEffects.bind(item)(activate, targets, { whisper, spellLevel, damageTotal, itemCardId, critical, fumble })
}

// Apply non-transfer effects to targets.
// macro arguments are evaluated in the context of the actor applying to the targets
// @target is left unevaluated.
// request is passed to a GM client if the token is not owned
export async function applyNonTransferEffects(activate, targets, { whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false, tokenId: tokenId }) {
  if (!targets) return;
  let appliedEffects = duplicate(this.data.effects.filter(ae => ae.data.transfer === false))
  if (appliedEffects.length === 0) return;
  const rollData = daeRollData(this.actor); //TODO if not caster eval move to evalArgs call
  // appliedEffects.map(activeEffectData => {
  for (let [aeIndex, activeEffectData] of appliedEffects.entries()) {
    for (let [changeIndex, change] of activeEffectData.changes.entries()) {
      //activeEffectData.changes.map(async change => {
      let doRolls = (["macro.execute", "macro.itemMacro"].includes(change.key));
      // eval args before calling GMAction so macro arguments are evaled in the casting context.
      // Any @fields for macros are looked up in actor context and left unchanged otherwise
      let newChange = await evalArgs({ itemData: this.data, effectData: activeEffectData, context: rollData, actor: this.actor, change, spellLevel, damageTotal, doRolls, critical, fumble, itemCardId, whisper })
      activeEffectData.origin = this.uuid;
      activeEffectData.duration.startTime = game.time.worldTime;
      activeEffectData.transfer = false;
      activeEffectData.changes[changeIndex] = newChange;
      // disabled is no longer set, use the definition of the active effect since this is always fixable.
      // activeEffectData.disabled = false;
    };
  }

  // Split up targets according to whether they are owned on not. Owned targets have effects applied locally, only unowned are passed ot the GM
  const targetList = Array.from(targets);
  //@ts-ignore
  let ownedTargets = targetList.filter(t => t.actor?.permission === 3).map(t => typeof t === "string" ? t : t.document.uuid);
  //@ts-ignore
  let unOwnedTargets = targetList.filter(t => t.actor?.permission !== 3).map(t => typeof t === "string" ? t : t.document.uuid);;
  debug("apply non-transfer effects: About to call gmaction ", activate, appliedEffects, targets, ownedTargets, unOwnedTargets)
  requestGMAction(GMAction.actions.applyActiveEffects, { activate, activeEffects: appliedEffects, targets: unOwnedTargets, itemDuration: this.data.data.duration, itemCardId })
  applyActiveEffects(activate, ownedTargets, appliedEffects, this.data.data.duration, itemCardId)
}

// Update the actor active effects when editing an owned item
function preUpdateItem(candidate, updates, options, user) {
  if (!candidate.isOwned) return true;
  Hooks.once("updateItem", async () => {
    if (updates.data?.armor && candidate.data.data.armor?.type && calculateArmor) { // TODO find out why SRD items have an armor value
      let updatedActorEffectData = updateArmorEffect(candidate, updates);
      const origin = candidate.uuid; // `Actor.${item.actor.id}.Item.${updates._id}`;
      if (updatedActorEffectData.length > 0) {
        await candidate.parent.updateEmbeddedDocuments("ActiveEffect", updatedActorEffectData);
      }
    } else if (updates.effects) { // item effects have changed - update transferred effects
      const itemUuid = candidate.uuid;
      // delete all actor effects for the given item
      let deletions = [];
      for (let aef of candidate.parent.effects) { // remove all transferred effects for the item
        const isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
        if (isTransfer && (aef.data.origin === itemUuid)) deletions.push(aef.id);
      };
      // Now get all the itemm transfer effects
      let additions = candidate.effects.filter(aef => {
        const isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
        return isTransfer;
      });

      additions = additions.map(ef => ef.toJSON());
      additions.forEach(efData => {
        efData.origin = itemUuid;
        efData.disabled = effectDisabled(candidate.parent, efData, candidate.data);
      });
      if (deletions.length > 0) {
        await candidate.parent.deleteEmbeddedDocuments("ActiveEffect", deletions).then(() => {
          if (additions.length > 0) candidate.parent.createEmbeddedDocuments("ActiveEffect", additions);
        });
      } else if (additions.length > 0) {
        await candidate.parent.createEmbeddedDocuments("ActiveEffect", additions);
      }
    } else if (updates.data?.attunement !== undefined || updates.data?.attuned !== undefined || updates.data?.equipped !== undefined) {
      const existingEffectsData = candidate.parent.effects
        ?.filter(ef => ef.data.flags?.dae?.transfer && ef.data.origin === candidate.uuid)
        ?.map(ef => duplicate(ef.data));
      if (existingEffectsData.length === 0) return;
      let effectsChanged = false;
      existingEffectsData.forEach(efData => {
        const newDisabled = effectDisabled(candidate.parent, efData, candidate.data)
        if (efData.disabled !== newDisabled) {
          efData.disabled = effectDisabled(candidate.parent, efData, candidate.data);
          effectsChanged = true;
          efData = { "_id": efData._id, "disabled": newDisabled };
        }
      })
      if (effectsChanged) await candidate.parent.updateEmbeddedDocuments("ActiveEffect", existingEffectsData);
    }
  });
  return true;
}

function computeAC(actor, change) {
  const baseAC = actor.data.data.attributes.ac.value;
  let bestArmorAC = 0;
  let armorLabel = "";
  let bestShieldAC = 0;
  let shieldLabel = "";
  let newAC;
  for (let item of actor.items) {
    if (item.type !== "equipment" || !item.data.data.equipped) continue;
    if (!item.data.data.armor) continue;
    const armorData = item.data.data.armor;
    switch (armorData.type) {
      case "shield":
        if (armorData.value > bestShieldAC) {
          bestShieldAC = armorData.value;
          shieldLabel = item.label;
        }
        break;
      case "natural":
        newAC = armorData.value + Math.min(armorData.dex ?? 99, actor.data.data.abilities.dex.mod);
        if (armorData.value > bestArmorAC) {
          bestArmorAC = newAC;
          armorLabel = item.label
        }
        break;
      case "light":
        newAC = armorData.value + Math.min(armorData.dex ?? 99, actor.data.data.abilities.dex.mod);
        if (armorData.value > bestArmorAC) {
          bestArmorAC = newAC;
          armorLabel = item.label
        }
        break;
      case "medium":
        newAC = armorData.value + Math.min(armorData.dex ?? 2, actor.data.data.abilities.dex.mod);
        if (armorData.value > bestArmorAC) {
          bestArmorAC = newAC;
          armorLabel = item.label
        }
        break;
      case "heavy":
        newAC = armorData.value + Math.min(armorData.dex ?? 0, actor.data.data.abilities.dex.mod);
        if (armorData.value > bestArmorAC) {
          bestArmorAC = newAC;
          armorLabel = item.label
        }
        break
      default:
        break;
    }
  }
  if (bestArmorAC > actor.data.data.attributes.ac.value) {
    actor.data.data.attributes.ac.value = bestArmorAC;
  }
  actor.data.data.attributes.ac.value += bestShieldAC;
  return true;
}
export function updateArmorEffect(candidate, updates) {
  let itemData = candidate.data;
  // Armor value has been changed so recrreate owned item and actor effects
  const origin = candidate.uuid;
  let existingEffect = candidate.parent.effects?.find(ef => ef.data.flags?.dae?.armorEffect && ef.data.origin === origin);
  if (!existingEffect) return [];
  let armorEffectData = generateArmorEffect(itemData, origin, mergeObject(itemData.data.armor, updates.data.armor, { overwrite: true }));
  //@ts-ignore _id
  armorEffectData._id = existingEffect.id;
  //@ts-ignore disabled
  armorEffectData.disabled = effectDisabled(candidate.parent, armorEffectData, candidate.data);
  return [armorEffectData];
  return [];
}

export function preCreateItem(candidate, data, options, user) {
  if (!candidate.isOwned) return;
  // create armor effects if required - this in in the preCreate hook so udpating the candidate is enough
  if (calculateArmor) createArmorEffect(candidate, data);
  data.effects.forEach(efData => {
    if (efData.transfer) {
      setProperty(efData, "flags.dae.transfer", true)
      efData.disabled = effectDisabled(candidate.parent, efData, candidate.data);
      //setProperty(efData, "duration.startTime", 0);
    }
  })
  //TODO check this.
  delete candidate.data.effects;
  candidate.data.update({ "effects": data.effects });
  return true;
}

export function createArmorEffect(item, itemData) {
  if (itemData.type !== "equipment") return true;
  // armor created on actor, screae armor effect.
  const origin = item.uuid; //`Actor.${actor.id}.Item.${itemData._id}`;
  // const origin = actor.items.get(itemData._id).uuid;
  itemData.effects = itemData.effects?.filter(efData => !efData.flags.dae?.armorEffect) || [];
  if (calculateArmor) switch (itemData.data.armor?.type) {
    case "natural":
      //@ts-ignore
      itemData.effects.push(generateArmorEffect(itemData, origin, itemData.data.armor));
      break;
    case "shield":
    case "light":
    case "medium":
    case "heavy":
      itemData.effects.push(generateArmorEffect(itemData, origin, itemData.data.armor));
      break;
    default:
      break;
  }
  return true;
}

export function generateArmorEffect(itemData, origin, armorData) {
  switch (armorData.type) {
    case "shield":
      //@ts-ignore
      let ae = armorEffectFromFormula(`${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.ADD, itemData, origin);
      ae.changes.forEach(c => c.priority = 7)
      return ae;
    case "natural":
      //@ts-ignore
      return armorEffectFromFormula(`@abilities.dex.mod + ${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, itemData, origin);
    case "light":
      //@ts-ignore
      return armorEffectFromFormula(`{@abilities.dex.mod, ${armorData.dex || 99}}kl + ${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, itemData, origin);
    case "medium":
      //@ts-ignore
      return armorEffectFromFormula(`{@abilities.dex.mod,${armorData.dex || 2}}kl + ${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, itemData, origin);
    case "heavy":
      //@ts-ignore
      return armorEffectFromFormula(`{@abilities.dex.mod,${armorData.dex || 0}}kl + ${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, itemData, origin);
    default:
      return null;
      break;
  }
}

function armorEffectFromFormula(formula, mode, itemData, origin) {
  let label = `AC${itemData.data.armor.type === "shield" ? "+" : "="}${itemData.data.armor.value}`;
  if ("light" === itemData.data.armor?.type) label += `+min(dex.mod, ${itemData.data.armor?.dex || "unlimited"})`;
  if ("medium" === itemData.data.armor?.type) label += `+min(dex.mod, ${itemData.data.armor?.dex || "2"})`;
  if ("heavy" === itemData.data.armor?.type) label += `+min(dex.mod, ${itemData.data.armor?.dex || "0"})`;

  return {
    label,
    icon: itemData.img,
    changes: [
      {
        key: "data.attributes.ac.value",
        value: formula,
        mode,
        priority: 4
      },
    ],
    transfer: true,
    origin,
    flags: { dae: { transfer: true, armorEffect: true } }
  };
}

export function daeReadyActions() {
  ValidSpec.localizeSpecs();
  // initSheetTab();
  //@ts-ignore
  aboutTimeInstalled = game.modules.get("about-time")?.active;
  timesUpInstalled = game.modules.get("times-up")?.active;
}

export function localDeleteFilters(tokenId: string, filterName: string) {
  //@ts-ignore
  let tokenMagic = window.TokenMagic;
  let token = canvas.tokens.get(tokenId);
  tokenMagic.deleteFilters(token, filterName);
}

export var tokenizer;

function daeApply(wrapped, actor, change) {
  //TODO revisit this for item changes, requires setProperty(map, "index", value) to work.
  if (change.key.startsWith("items") && false) {
    let originalKey = duplicate(change.key);
    const fields = change.key.split(".");
    const name = fields[1];
    let indices;
    if (daeActionTypeKeys.includes(name)) {
      const items = actor.items.contents.map((item, index) => item.data.data.actionType === name ? index : -1)
      indices = items.filter(index => index !== -1)
    } else {
      indices = [actor.items.contents.findIndex(i => i.name === name)];
    }
    if (indices.length > 0) {
      for (let index of indices) {
        fields[1] = `contents.${index}.data`;
        if (fields[1] !== -1) {
          change.key = fields.join(".");
          var rval = wrapped(actor, change)
        }
      }
      change.key = originalKey;
      return rval;
    }
  }
  return wrapped(actor, change)
}

var spellAttacks, weaponAttacks, attackTypes, bonusSelectors;

function getRollData(wrapped) {
  const data = wrapped();
  data.flags = this.data.flags;
  return data;
}

export function daeInitActions() {
  // Setup attack types and expansion change mappings
  spellAttacks = ["msak", "rsak"]
  weaponAttacks = ["mwak", "rwak"];
  if (game.system.id === "sw5e") spellAttacks = ["mpak", "rpak"];
  attackTypes = weaponAttacks.concat(spellAttacks);
  bonusSelectors = {
    "data.bonuses.All-Attacks": { attacks: attackTypes, selector: "attack" },
    "data.bonuses.weapon.attack": { attacks: weaponAttacks, selector: "attack" },
    "data.bonuses.spell.attack": { attacks: spellAttacks, selector: "attack" },
    "data.bonuses.All-Damage": { attacks: attackTypes, selector: "damage" },
    "data.bonuses.weapon.damage": { attacks: weaponAttacks, selector: "damage" },
    "data.bonuses.spell.damage": { attacks: spellAttacks, selector: "damage" }
  }
  if (["dnd5e", "sw5e"].includes(game.system.id)) {
    acAffectingArmorTypes = ["light", "medium", "heavy", "bonus", "natural", "shield"];
  }
  ValidSpec.createValidMods();

  // We will call this in prepareData
  libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.prepareData", prepareData, "WRAPPER");

  libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.getRollData", getRollData, "WRAPPER");

  libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.apply", daeApply, "WRAPPER");

  libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", applyBaseActiveEffects, "OVERRIDE");

  if (game.system.id === "dnd5e")
    daeActionTypeKeys = Object.keys(CONFIG.DND5E.itemActionTypes)
  else
    daeActionTypeKeys = Object.keys(CONFIG.SW5E.itemActionTypes)
  // This supplies DAE custom effects
  Hooks.on("applyActiveEffect", daeCustomEffect);
  // If updating effects recreate actor effects for updated item.
  // Toggle equip active as well
  Hooks.on("preUpdateItem", preUpdateItem);
  Hooks.on("preCreateItem", preCreateItem)


  // macros are called on active effect creationg and deletion
  Hooks.on("preCreateActiveEffect", preCreateActiveEffect);
  Hooks.on("preDeleteActiveEffect", preDeleteActiveEffect);
  Hooks.on("preUpdateActiveEffect", preUpdateActiveEffect); //consider on/off for enable/disable

  // Add the active effects title bar actions
  Hooks.on('renderActorSheet', initActorSheetHook);
  Hooks.on('renderItemSheet', initItemSheetHook);

  //@ts-ignore
  tokenizer = new DETokenizeThis({
    shouldTokenize: ['(', ')', ',', '*', '/', '%', '+', '=', '!=', '!', '<', '> ', '<=', '>=', '^']
  });
}

function initActorSheetHook(app, html, data) {
  let title = game.i18n.localize('dae.ActiveEffectName');
  let openBtn = $(`<a class="open-actor-effect" title="${title}"><i class="fas fa-clipboard"></i>${title}</a>`);
  openBtn.click(ev => {
    new ActiveEffects(app.entity, {}).render(true);
  });
  html.closest('.app').find('.open-actor-effect').remove();
  let titleElement = html.closest('.app').find('.window-title');
  if (!app._minimized) openBtn.insertAfter(titleElement);
}

function initItemSheetHook(app, html, data) {
  // if (app.entity.isOwned) return;
  let title = game.i18n.localize('dae.ActiveEffectName');
  let openBtn = $(`<a class="open-item-effect" title="${title}"><i class="fas fa-clipboard"></i>${title}</a>`);
  openBtn.click(ev => {
    new ActiveEffects(app.entity, {}).render(true);
  });
  html.closest('.app').find('.open-item-effect').remove();
  let titleElement = html.closest('.app').find('.window-title');
  openBtn.insertAfter(titleElement);
}

export function daeSetupActions() {
  //@ts-ignore
  cubActive = game.modules.get("combat-utility-belt")?.active;
  //@ts-ignore
  debug("Combat utility belt active ", cubActive, " and cub version is ", game.modules.get("combat-utility-belt")?.data.version)

  //@ts-ignore
  if (cubActive && !isNewerVersion(game.modules.get("combat-utility-belt")?.data.version, "1.1.2")) {
    ui.notifications.warn("Combat Utility Belt needs to be version 1.1.3 or later - conditions disabled");
    console.warn("Combat Utility Belt needs to be version 1.1.3 or later - conditions disabled");
    cubActive = false;
  } else if (cubActive) {
    debug("dae | Combat Utility Belt active and conditions enabled");
  }
  //@ts-ignore
  itemacroActive = game.modules.get("itemacro")?.active;
  furnaceActive = game.modules.get("furnace")?.active || game.modules.get("advanced-macros")?.active;
  conditionalVisibilityActive = game.modules.get("conditional-visibility")?.active;
  midiActive = game.modules.get("midi-qol")?.active;
}

export function fetchParams() {
  requireItemTarget = game.settings.get("dae", "requireItemTarget");
  calculateArmor = game.settings.get("dae", "calculateArmor");
  applyBaseAC = game.settings.get("dae", "applyBaseAC");
  debugEnabled = setDebugLevel(game.settings.get("dae", "ZZDebug"));
  useAbilitySave = game.settings.get("dae", "useAbilitySave")
  confirmDelete = game.settings.get("dae", "confirmDelete")
  noDupDamageMacro = game.settings.get("dae", "noDupDamageMacro");
  disableEffects = game.settings.get("dae", "disableEffects")
  /* TODO decide what to do about enhancing status effects or not
  ehnanceStatusEffects = game.settings.get("dae", "ehnanceStatusEffects");
  procStatusEffects(ehnanceStatusEffects);
  */
  let useDAESheet = game.settings.get("dae", "useDAESheet");
  if (useDAESheet) {
    CONFIG.ActiveEffect.sheetClass = DAEActiveEffectConfig;
  } else {
    CONFIG.ActiveEffect.sheetClass = ActiveEffectConfig;
  }
  expireRealTime = game.settings.get("dae", "expireRealTime");
  displayTraits = game.settings.get("dae", "displayTraits");
  updatePatches();
}

export function DAEfromUuid(uuid) {
  let parts = uuid.split(".");
  let doc;


  const [docName, docId] = parts.slice(0, 2);
  parts = parts.slice(2);
  const collection = CONFIG[docName].collection.instance;
  doc = collection.get(docId);

  // Embedded Documents
  while (parts.length > 1) {
    const [embeddedName, embeddedId] = parts.slice(0, 2);
    doc = doc.getEmbeddedDocument(embeddedName, embeddedId);
    parts = parts.slice(2);
  }
  return doc || null;
}

export function DAEfromActorUuid(uuid) {
  let parts = uuid.split(".");
  let doc = DAEfromUuid(uuid);
  if (doc instanceof CONFIG.Token.documentClass) doc = doc.actor;
  return doc || null;
}
