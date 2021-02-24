import { requestGMAction, GMAction, applyActiveEffects } from "./GMAction";
import { warn, error, debug, setDebugLevel, daeAlternateStatus, i18n, timelog } from "../dae";
import { ActiveEffects } from "./apps/ActiveEffects";
import { DAEActiveEffectConfig } from "./apps/DAEActiveEffectConfig";
import { procStatusEffects } from "./statusEffects";
import { updatePatches } from "./patching";

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
  get forcedMode(): number {return this._forcedMode}
  set forcedMode(mode: number) {this._forcedMode = mode}

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
    baseValues["data.detaila.hd"] = 0;

    //@ts-ignore
    if (game.modules.get("gm-notes")?.active) {
      baseValues["flags.gm-notes.notes"] = "";
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
        "data.attributes.encumbrance.max": [0,-1],
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
        "data.spells.pact.level": [0,-1],
        // "flags.midi-qol.forceCritical": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.bonuses.heal.damage": ["", -1],
        "data.bonuses.heal.attack": ["", -1],
        "data.bonuses.save.damage": ["", -1],
        "data.bonuses.abil.damage": ["", -1],

        "flags.dae": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.attributes.movement.all": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        // "CUB": ["", ACTIVE_EFFECT_MODES.CUSTOM]
      };

      specials["macro.CUB"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.ConditionalVisibility"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.ConditionalVisibilityVision"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials[`flags.${game.system.id}.initiativeHalfProf`] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
      specials[`flags.${game.system.id}.DamageBonusMacro`] = ["", ACTIVE_EFFECT_MODES.CUSTOM];

      ["check", "save", "skill"].forEach(id => {
        specials[`data.bonuses.abilities.${id}`] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      });

      let attackTypes = ["mwak", "rwak", "msak", "rsak"];
      if (game.system.id === "sw5e") attackTypes = ["mwak", "rwak", "mpak", "rpak"];

      attackTypes.forEach(id => {
        specials[`data.bonuses.${id}.attack`] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
        specials[`data.bonuses.${id}.damage`] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      })

      // move all the characteer flags to specials so that the can be custom effects only
      Object.keys(CONFIG.DND5E.characterFlags).forEach(key=> {
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
      Object.keys(baseValues).forEach(key=> {
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
      delete baseValues["data.attributes.init.bonus"];
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
        validSpec.forcedMode = ACTIVE_EFFECT_MODES.CUSTOM;
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
        if (["attributes.hp", "attributes.ac"] .includes(m._fieldSpec)) {
          m._sampleValue = 0;
        }
      });
    }
    this.allSpecs.sort((a,b) => {return a._fieldSpec < b._fieldSpec ? -1 : 1});
    this.baseSpecs.sort((a,b) => {return a._fieldSpec < b._fieldSpec ? -1 : 1});
    this.derivedSpecs.sort((a,b) => {return a._fieldSpec < b._fieldSpec ? -1 : 1});
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
        const localizedString = i18n(CONFIG.DND5E.characterFlags[fieldId]?.name) ?? i18n(`dae.${fieldId}`)
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
  disabled  = disabled || (ci && ci.includes(statusId));
  /* TODO revist this 
  const alternate = statusId && daeAlternateStatus[statusId];
  disabled  = disabled || (ci && ci.includes(alternate));
  */

  // transfer effects depend on the item to disable/enable (if there is one)
  if (efData.flags?.dae?.transfer) {
    if (!itemData && efData.origin) { // itemData not passed, see if we have the item
      let [actorType, actorId, itemType, itemId] = efData.origin.split(".");
      itemData = itemId && actor.items.get(itemId);
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

var oldPrepareData;
var oldApply;

// this function replaces applyActiveEffects in Actor
function applyBaseActiveEffects() {
  applyDaeEffects.bind(this)(ValidSpec.baseSpecsObj, {}, false)
}
/*
 * Replace default appplyAffects to do value lookups
 */
function applyDaeEffects(specList, completedSpecs, allowAllSpecs: boolean) {
  const overrides = {};
  if (!this.effects || this.effects.size === 0)  return this.overrides || {};
  // Organize non-disabled effects by their application priority
  const changes = this.effects.reduce((changes, effect) => {
    // e.data.disabled = effectDisabled(this, e.data)
    if ( effect.data.disabled ) return changes;
    // TODO find a solution for flags.? perhaps just a generic speclist
    return changes.concat(expandEffectChanges(effect.data.changes)
      .filter(c => {return !completedSpecs[c.key] && (allowAllSpecs || specList[c.key] !== undefined)})
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
  for ( let c of changes ) {
    if (typeof specList[c.key]?.sampleValue === "number" && typeof c.value === "string") {
      const rollData = daeRollData(this);
      debug("appplyDaeEffects: Doing eval of ", c, c.value)
      try {
        c.value = new Roll(c.value, rollData).roll().total;
      } catch (err) {
        console.warn("change value calculation failed for", this, c);
        console.warn(err)
      };
    }

    const result = c.effect.apply(this, c);
    if ( result !== null ) overrides[c.key] = result;
  }

  // Expand the set of final overrides
  this.overrides = mergeObject(this.overrides || {}, expandObject(overrides) || {}, {inplace: true, overwrite: true});
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
    setProperty(actor.data, change.key, current ? `${current},${change.value}`: change.value)
    return true;
  }
  if (change.key.includes(`flags.${game.system.id}`)) {
    const value = ["1", "true"].includes(change.value);
    setProperty(actor.data, change.key, value);
    return true;
  }

  switch(change.key) {
    case "data.traits.di.all":
    case "data.traits.dr.all":
    case "data.traits.dv.all":
      const key = change.key.replace(".all", ".value")
      setProperty(actor.data, key, Object.keys(CONFIG.DND5E.damageResistanceTypes))
      return true;
    case "data.traits.di.value":
    case "data.traits.dr.value":
    case "data.traits.dv.value":
      return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.damageResistanceTypes));
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
      setProperty(actor.data, "data.traits.languages.value", Object.keys(CONFIG.DND5E.languages))
      return true;
    case "data.traits.languages.value":
      return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.languages));
    case "data.traits.ci.all":
      setProperty(actor.data, "data.traits.ci.value", Object.keys(CONFIG.DND5E.conditionTypes))
      return true;
    case "data.traits.ci.value":
      return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.conditionTypes))
    case "data.traits.toolProf.value":
      return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.toolProficiencies))
    case "data.traits.toolProf.all":
      setProperty(actor.data, "data.traits.toolProf.value", Object.keys(CONFIG.DND5E.toolProficiencies))
      return true;
    case "data.traits.armorProf.value":
      return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.armorProficiencies))
    case "data.traits.armorProf.all":
      setProperty(actor.data, "data.traits.armorProf.value", Object.keys(CONFIG.DND5E.armorProficiencies))
      return true;
    case "data.traits.weaponProf.value": 
      return doCustomArrayValue(actor, current, change, Object.keys(CONFIG.DND5E.weaponProficiencies))
    case "data.traits.weaponProf.all":
      setProperty(actor.data, "data.traits.weaponProf.value", Object.keys(CONFIG.DND5E.weaponProficiencies))
      return true;
    case "data.bonuses.weapon.damage":
      value = attackDamageBonusEval(change.value, actor)
      value = replaceAtFields(value, actor);
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
      weaponAttacks.forEach(atType => actor.data.data.bonuses[atType].damage += value);
      return true;
    case "data.bonuses.spell.damage":
      value = attackDamageBonusEval(change.value, actor)
      value = replaceAtFields(value, actor);
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
      // TODO: remove if fixed in core
      let result = attackDamageBonusEval(change.value, actor);
      result = replaceAtFields(result, actor);
      value = (result.startsWith("+") || result.startsWith("-")) ? result : "+" + result;
      setProperty(actor.data, change.key, (current || "") + value);
      return true;

    case "data.attributes.movement.all":
      const movement = actor.data.data.attributes.movement;
      let op = "";
      if (typeof change.value === "string") {
        change.value = change.value.trim();
        if (["+","-","/", "*"].includes(change.value[0])) {
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
      //@ts-ignore
      value = Number.isNumeric(change.value) ? parseInt(change.value) : 0;
      if (value) {
        setProperty(actor.data, change.key, current + value);
      }
      if (actor.items) {
        actor.items.forEach(item => {
          item.getSaveDC();
          item.getAttackToHit();
        });
      };
      return true;

    case "flags.dae": 
      let list = change.value.split(" ");
      let flagName = list[0];
      value = new Roll(list.splice(1).join(" "), daeRollData(actor)).roll().total
      setProperty(actor.data, `flags.dae.${flagName}`, value);
      setProperty(actor.data.data, `flags.dae.${flagName}`, value);
      return true;
    }
}

function replaceAtFields(value, actor) {
  if (typeof value !== "string") return value;
  if (!value.includes("@")) return value;
  let fields = [];
  let rollData;
  tokenizer.tokenize(value, (token) => {
    if (typeof token === "string" && token.startsWith("@")) {
      rollData = rollData || daeRollData(actor);
      const existing = getProperty(rollData, token.slice(1));
      fields.push(existing ?? token)
      fields.push()
    } else 
      fields.push(token)
  })
  return fields.join("");
}
// Special case handling of (expr)dX
function attackDamageBonusEval(bonusString, actor) {
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
function prepareData() {
  debug("prepare data: before passes", this.name, this._data);

  oldPrepareData.bind(this)();
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
  const isConcentration = effect.label === game.settings.get("combat-utility-belt", "concentratorConditionName");
  if (!isConcentration) return false;
}
async function handleRemoveConcentration(actor, effect, tokens) {
  const isConcentration = effect.label === game.settings.get("combat-utility-belt", "concentratorConditionName");
  if (!isConcentration) return false;
  const concentrationData = getProperty(actor.data.flags, "midi-qol.concentration-data");
  if (!concentrationData) return;
  if (concentrationData.templates) {
    await canvas.templates.deleteMany(concentrationData.templates);
  }
  requestGMAction(GMAction.actions.deleteEffects, {targets: concentrationData.targets, origin: concentrationData.uuid});
  await actor.unsetFlag("midi-qol", "concentration-data")
}

export async function daeCreateActiveEffectActions(actor, effects) {
  if (actor.__proto__.constructor.name !== CONFIG.Actor.entityClass.name) return;
  const theEffects = Array.isArray(effects) ? effects : [effects];
  const token = actor.isToken ? actor.token : actor.getActiveTokens()[0];
  //@ts-ignore
  const checkConcentration = (cubActive && window.MidiQOL?.configSettings?.concentrationAutomation) 

  //@ts-ignore
  const CV = window.ConditionalVisibility;
  //@ts-ignore
  const tokenMagic = window.TokenMagic;

  //if (tokens[0].actor.isToken) hook = "dae.createActiveEffect";
  let update = async () => {
    warn("add active effect actions", actor, effects)
    for (let effect of theEffects) {
      if (token) {
        if (effect.changes) {
          for (let change of effect.changes) {
            if (CV) addCVChange(actor, change, [token], CV);
            if (cubActive && change.key === "macro.CUB") await game.cub.addCondition(change.value, [token]); 
            if (tokenMagic && change.key === "macro.tokenMagic") await addTokenMagicChange(actor, change, [token], tokenMagic);
          }
        }
        if (cubActive && checkConcentration) await handleAddConcentration(actor, effect, [token]);
      }
    }; 
    //TODO clean this up eventually
    daeMacro("on", actor, theEffects, {});
  };

  let hook = "createActiveEffect";
  // because of the fiddle for tokens this is called in the update vs preUpdate for tokens
  if (actor.isToken && game.user.isGM)
    await update();
  else  Hooks.once(hook, update);
  return true;
}

export async function daeDeleteActiveEffectActions(actor, effects) {
  if (actor.__proto__.constructor.name !== CONFIG.Actor.entityClass.name) return;
  const theEffects = Array.isArray(effects) ? effects : [effects];
  const token = actor.isToken ? actor.token : actor.getActiveTokens()[0];
  //@ts-ignore
  const checkConcentration = (cubActive && window.MidiQOL?.configSettings?.concentrationAutomation) 
  //@ts-ignore
  const CV = window.ConditionalVisibility;
  //@ts-ignore
  const tokenMagic = window.TokenMagic;

  let update = async () => {
    warn("delete active effect actions", actor, effects)
    for (let effect of theEffects) {
      if (token) {
        if (effect.changes) {
          for (let change of effect.changes) {
            if (cubActive && change.key === "macro.CUB") await game.cub.removeCondition(change.value, [token], {warn: false}); 
            if (tokenMagic && change.key === "macro.tokenMagic") await removeTokenMagicChange(actor, change, [token], tokenMagic)
            if (CV) await removeCVChange(actor, change, [token], CV);
          }
        }
        if (checkConcentration) await handleRemoveConcentration(actor, effect, [token]);
      }
    }
    // TODO clean this up eventually
    daeMacro("off", actor, theEffects, {});
  }

  let hook = "deleteActiveEffect";
  // if (tokens[0].actor.isToken) hook = "dae.deleteActiveEffect";
  if (actor.isToken && game.user.isGM)
    await update()
  else Hooks.once(hook, update);
  return true;
}


function daeUpdateActiveEffectActions(...args) {
  //consider toggling according to isactive

}

export async function getSelfTarget(actor) {
  if (actor.token) return actor.token;
  const speaker = ChatMessage.getSpeaker({actor})
  if (speaker.token) return canvas.tokens.get(speaker.token);
  //@ts-ignore
  return Token.fromActor(actor);
}
 
export async function daeMacro(action: string, actor, effects, lastArgOptions = {}) {
//  if (actor.__proto__.constructor.name === CONFIG.Item.entityClass.name) return;
  let result;
  if (!Array.isArray(effects)) effects = [effects];
  // Work out what itemdata should be

  warn("Dae macro ", action, actor, effects, lastArgOptions)
  for (let effect of effects) {
    // let item = (effect.origin && await fromUuid(effect.origin)) || null;
    if (!effect.changes) continue;
    for (let change of effect.changes) {
      try {
        if (!["macro.execute", "macro.itemMacro"].includes(change.key)) continue;
        let lastArg = mergeObject(lastArgOptions, {
          //@ts-ignore - undefined fields
            effectId: effect._id,
            origin: effect.origin,
            efData: effect,
            actorId: actor.id,
            tokenId: actor.token ? actor.token.id : (await getSelfTarget(actor))?.id
        }, {overwrite: false, insertKeys:true, insertValues: true, inplace: false});
        //@ts-ignore 
        if (!lastArgOptions?.tokenId) // avoid a gratuitous getSpeaker if not required
          var tokenId = ChatMessage.getSpeaker({actor}).token
        let rollData = daeRollData(actor);
        //@ts-ignore
        const theChange = await evalArgs({itemData: null, effectData: effect, context: rollData, actor, change, doRolls: true})
        if (theChange.key === "macro.execute") {
          const macro = game.macros.getName(theChange.value[0]);
          if (!macro) {
            //TODO localize this
            if (action !== "off") {
              ui.notifications.warn(`macro.execute | No macro ${theChange.value[0]} found`)
              error(`macro.execute | No macro ${theChange.value[0]} found`);
              continue;
            }
          }
          if (furnaceActive) {
            //@ts-ignore
            result = await macro.execute(action, ...(duplicate(theChange.value.slice(1))), lastArg)
          } else {
            console.warn("Furnace not active - so no macro arguments supported");
            result = await macro.execute();
          }
        } else if (theChange.key === "macro.itemMacro") {
          let macroCommand = getProperty(effect.flags, "dae.macroCommand"); // this is populated in evalArgs
          if (!macroCommand) continue;
          let macro =  await CONFIG.Macro.entityClass.create({
            name: "DAE-Item-Macro",
            type: "script",
            img: null,
            command: macroCommand,
            // TODO see if this should change.
            flags: { "dnd5e.itemMacro": true }
          }, { displaySheet: false, temporary: true });
          if (furnaceActive) {
            result = await macro.execute(action, ...duplicate(theChange.value), lastArg);
          } else {
            console.warn("Furnace not active - so no macro arguments supported")
            result = await macro.execute();
          }
          /*
          if (action === "on") await game.cub.addCondition(condition, [canvas.tokens.get(effect.flags.dae.token)])
          else if (action === "off") await game.cub.removeCondition(condition, [canvas.tokens.get(effect.flags.dae.token)])
          */
        }
      } catch(err) {
        console.warn(err);
      }
    };
  }
  return result;
}

function daeRollData(actor) {
  let rollData = actor.getRollData();
  rollData.data = rollData;
  rollData.flags = actor.data.flags;
  return rollData;
}

async function evalArgs({effectData = null, itemData = null, context, actor, change, spellLevel = 0, damageTotal = 0, doRolls = false, critical = false, fumble = false, whisper = false, itemCardId = null}) {
  // change so that this is item.data, rather than item.
  if (itemData) setProperty(effectData.flags, "dae.itemData", itemData);
  if (typeof change.value === 'number')
    return change; // nothing to do
  //@ts-ignore
  let filteredChanges = [];
  //@ts-ignore effects not defined
  let fields = [];
  let value;
  if (change.key === "macro.tokenMagic") return change;
  const argsAlreadyEval = Array.isArray(change.value)
  if (change.key === "macro.itemMacro") {
    if (!itemData) itemData = getProperty(effectData.flags, "dae.itemData")
    let macroCommand = getProperty(effectData.flags, "dae.itemData.flags.itemacro.macro.data.command");
    if (!macroCommand && !itemData) { // we never got an item do a last ditch attempt
      // TODO check if the actor is a token and if so find the item on the token instead
      warn("eval args: fetching item from effectData/origin ", effectData.origin)
      itemData = await fromUuid(effectData.origin); 
      //@ts-ignore
      macroCommand = itemData?.flags.itemacro?.macro.data.command;
      if (effectData) setProperty(effectData.flags, "dae.itemData", itemData);
    }
    if (!macroCommand) {
      macroCommand = `if (!args || args[0] === "on") {ui.notifications.warn("macro.itemMacro | No macro found for item ${itemData?.name}");}`;
      error(`No macro found for item ${itemData?.name}`);
    }
    if (effectData) setProperty(effectData.flags, "dae.macroCommand", macroCommand)
  }

  if (argsAlreadyEval) {
    // already an array so no tokenizing
    fields = change.value;
    // We have already done evalArgs
  }/*  else if (typeof change.value === "string" && change.value.indexOf("@") === -1) {
    fields = [change.value];
  } */ else {
    // the normal args case do the lookups.
    tokenizer.tokenize(change.value, (token) => fields.push(token))
  }
  switch (change.key) {
    case "macro.itemMacro":
    case "macro.execute":
      fields = fields.map(f => {
        if (typeof f === "string" && f.startsWith("@@")) return f.slice(1);
        if (f === "@scene") return canvas.scene.id;
        else if (f === "@token") return ChatMessage.getSpeaker({actor}).token;
        else if (f === "@item") return effectData.flags.dae?.itemData;
        else if (f === "@spellLevel") return spellLevel;
        else if (f === "@item.level") return spellLevel;
        else if (f === "@damage") return damageTotal;
        else if (f === "@target") return "@target";
        else if (f === "@itemCardId") return itemCardId;
        else if (f === "@unique") return randomID();
        else if (f === "@actor") {
          console.warn("dae | @actor is deprecated please consider an alternative argument to get the data");
          return duplicate(actor.data);
        } else if (f === "@critical") return critical;
        else if (f === "@fumble") return fumble;
        else if (f === "@whisper") return whisper;
        else if (f === "@change") return change;
        else if (typeof f === "string" && f.startsWith("@")) {
          return getProperty(context, f.slice(1))
        } 
        else return f;
      });

      value = fields;
      break;
    default: 
      fields = fields.map(f => {
        if (f === "@scene") return canvas.scene.id;
        else if (f === "@token") return ChatMessage.getSpeaker({actor}).token;
        else if (f === "@item") effectData.flags.dae?.itemData;
        else if (f === "@spellLevel") return spellLevel;
        else if (f === "@item.level") return spellLevel;
        else if (f === "@damage") return damageTotal;
        else if (f === "@target") return "<not-defined>"
        else if (f === "@unique") return randomID();
        else if (f === "@actor") {
          console.warn("dae | @actor is deprecated please consider an alternative argument to get the data");
          return duplicate(actor.data);
        } else if (f === "@critical") return critical;
        else if (f === "@fumble") return fumble;
        else if (doRolls && typeof f === "string" && f.startsWith("@")) {
          return getProperty(context, f.slice(1))
        }
        else return f;
      });
      change.value = fields.join(" ");
      // context.actor = actor.data;
      if (doRolls && typeof ValidSpec.allSpecsObj[change.key]?.sampleValue === "number") {
        value = new Roll(change.value, context).roll().total
      } else value = change.value;
      break;
  };
  debug("evalargs: change is ", change);

  change.value = value;
  return change;
}

/*
 * appply non-transfer effects to target tokens - provided for backwards compat
 */
export function doEffects(item, activate, targets = undefined, 
    { whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false}) {
  applyNonTransferEffects.bind(item)(activate, targets, {whisper, spellLevel, damageTotal, itemCardId, critical, fumble })
}

// Apply non-transfer effects to targets.
// macro arguments are evaluated in the context of the actor applying to the targets
// @target is left unevaluated.
// request is passed to a GM client if the token is not owned
export function applyNonTransferEffects(activate, targets, {whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false, tokenId: tokenId }) {
  if (!targets) return;
  let appliedEffects = duplicate(this.data.effects.filter(aeData => aeData.transfer === false))
  if (appliedEffects.length === 0) return;
  const rollData = daeRollData(this.actor); //TODO if not caster eval move to evalArgs call
  appliedEffects.map(activeEffectData => {
    activeEffectData.changes.map(async change => {
      let doRolls = (["macro.execute", "macro.itemMacro"].includes(change.key))
      // eval args before calling GMAction so macro arguments are evaled in the casting context.
      // Any @fields for macros are looked up in actor context and left unchanged otherwise
      let returnValue =  await evalArgs({itemData: this.data, effectData: activeEffectData, context: rollData, actor: this.actor, change, spellLevel, damageTotal, doRolls, critical, fumble, itemCardId, whisper})
      return returnValue;
    })
    activeEffectData.origin = this.uuid;
    activeEffectData.duration.startTime = game.time.worldTime;
    activeEffectData.transfer = false;
    // disabled is no longer set, use the definition of the active effect since this is always fixable.
    // activeEffectData.disabled = false;
    return activeEffectData;
  });
  
  // Split up targets according to whether they are owned on not. Owned targets have effects applied locally, only unowned are passed ot the GM
  const targetList = Array.from(targets);
  //@ts-ignore
  let ownedTargets = targetList.filter(t=>t.actor?.permission === 3).map(t=> typeof t === "string" ? t : t.id);
  //@ts-ignore
  let unOwnedTargets = targetList.filter(t=>t.actor?.permission !== 3).map(t=> typeof t === "string" ? t : t.id);;
  debug("apply non-transfer effects: About to call gmaction ", activate, appliedEffects, targets, ownedTargets, unOwnedTargets)
  requestGMAction(GMAction.actions.applyActiveEffects, {activate, activeEffects: appliedEffects, targets: unOwnedTargets, itemDuration: this.data.data.duration, itemCardId})
  applyActiveEffects(activate, ownedTargets, appliedEffects, this.data.data.duration, itemCardId)
}

// Update the actor active effects when editing an owned item
function ownedItemUpdate(actor, ownedItem, updates) {
  const updatedItem = mergeObject(ownedItem, updates, {overwrite: true, inplace:false});
  Hooks.once("updateOwnedItem", async () => {
    if (updates.effects) {
      let additions = updatedItem.effects; 
      additions = additions.filter(ef=>ef.transfer) || [];
      debug("additions post filter are ", updates.effects, additions)
      const itemUuid = actor.items.get(ownedItem._id).uuid;
      let deletions = actor.effects.filter(aef => {
        const isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
        return isTransfer && (aef.data.origin === itemUuid);
      })
      deletions = deletions.map(ef => ef.id || ef._id);
      const origin = `Actor.${actor.id}.OwnedItem.${updates._id}`
      additions.forEach(efData => {
        efData.disabled = effectDisabled(actor, efData, updatedItem)
        efData.origin = origin;
      });
      debug("owneditemupdate ", additions, deletions);
      //TODO: change this so we can do an updateEmbeddedEntitty.
      // It does require matching the active effect ids to the source item
      if (deletions.length > 0) {
        await actor.deleteEmbeddedEntity("ActiveEffect", deletions).then(() => {
          if (additions.length > 0) actor.createEmbeddedEntity("ActiveEffect", additions);
        });
      } else if (additions.length > 0) {
        await actor.createEmbeddedEntity("ActiveEffect", additions);
      }
    } else {
      const origin = `Actor.${actor.id}.OwnedItem.${updates._id}`;
      let effects = actor.effects.filter(aef => {
        let isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
        return (aef.data.origin === origin) && isTransfer;
      }).map(aef => {
        const data = duplicate(aef.data);
        data.disabled = effectDisabled(actor, aef.data, updatedItem);
        return data;
      })
      if (effects.length > 0) await actor.updateEmbeddedEntity("ActiveEffect", effects);
    }
  });
  return true;
}
export function updateArmorEffect(actor, itemData, updateData, ...args) {
  if (updateData.data?.armor) {
    // Armor value has been changed so recrreate owned item and actor effects
    let theEffects = duplicate(itemData.effects?.filter(efData => !efData.flags?.dae?.armorEffect)) || [];
    let existingEffect = duplicate(itemData.effects?.find(efData => efData.flags?.dae?.armorEffect) || {});
    const origin = `Actor.${actor.id}.OwnedItem.${itemData._id}`;
    // const origin = actor.items.get(itemData._id)
    let armorEffect = generateArmorEffect(itemData, origin, mergeObject(itemData.data.armor, updateData.data.armor, {overwrite: true}));
    let newEffect = mergeObject(existingEffect, armorEffect, {overwrite: true, inplace:true, insertKeys: true, insertValues: true});
    if (!newEffect.duration) newEffect.duration = {startTime: game.time.worldTime}
    theEffects.push(newEffect);
    updateData.effects = theEffects;
    // Since this runs in the preUpdateOwneditem chain just modifyiing the update data is enough
  }
  return true;
}

export function ownedItemCreate(actor, itemData) {
  // create armor effects if required
  createArmorEffect(actor, itemData);

  // set the disabled/enabled flag
  for (let i = 0; i < itemData.effects?.length || 0; i++) {
    itemData.effects[i].origin = `Actor.${actor.id}.OwnedItem.${itemData._id}`;
    itemData.effects[i].disabled = effectDisabled(actor, itemData.effects[i], itemData);
  };
  return true;
}

export function createArmorEffect(actor, itemData) {
  if (!itemData.effects && itemData.data.effects) itemData = itemData.data;
  if (!calculateArmor || itemData.type !== "equipment") return true;
  // armor created on actor, screae armor effect.
  const origin = `Actor.${actor.id}.OwnedItem.${itemData._id}`;
  // const origin = actor.items.get(itemData._id).uuid;
  itemData.effects = itemData.effects?.filter(efData => !efData.flags.dae?.armorEffect) || [];
  switch(itemData.data.armor?.type) {
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
  switch(armorData.type) {
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
      return armorEffectFromFormula(`{@abilities.dex.mod,2}kl + ${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, itemData, origin);
      case "heavy":
      //@ts-ignore
      return armorEffectFromFormula(`${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, itemData, origin);
    default:
      return null;
      break;
  }
}

function armorEffectFromFormula(formula, mode, itemData, origin) {
  let label = `AC${itemData.data.armor.type === "shield" ? "+" : "="}${itemData.data.armor.value}`;
  if ("light" === itemData.data.armor?.type) label += "+dex.mod";
  if ("medium" === itemData.data.armor?.type) label += "+dex.mod|2";

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
    flags: {dae: {transfer: true, armorEffect: true}}
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

function daeApply(actor, change) {
  if (change.key.startsWith("items")) {
    let originalKey = duplicate(change.key);
    const fields = change.key.split(".");
    const name = fields[1];
    let indices;
    if (daeActionTypeKeys.includes(name)) {
      const items = actor.data.items.map((iData, index) => iData.data.actionType === name ? index : -1)
      indices = items.filter(index => index !== -1)
    } else {
      const items = actor.data.items.filter(i=>i.actionType === name);
      indices = [actor.data.items.findIndex(i=>i.name === name)];
    }
    for (let index of indices) {
      fields[1] = index;
      if (fields[1] !== -1) {
        change.key = fields.join(".");
        var rval = oldApply.bind(this)(actor, change)
      }
    }
    change.key = originalKey;
    return rval;
  }
  return oldApply.bind(this)(actor, change)
}

var spellAttacks, weaponAttacks, attackTypes, bonusSelectors;

export function daeInitActions() {
  // Setup attack types and expansion change mappings
  spellAttacks = ["msak", "rsak"]
  weaponAttacks = ["mwak", "rwak"];
  if (game.system.id === "sw5e") spellAttacks = ["mpak", "rpak"];
  attackTypes = weaponAttacks.concat(spellAttacks);
  bonusSelectors = {
    "data.bonuses.All-Attacks": {attacks: attackTypes, selector: "attack"},
    "data.bonuses.weapon.attack": {attacks: weaponAttacks, selector: "attack"},
    "data.bonuses.spell.attack": {attacks: spellAttacks, selector: "attack"},
    "data.bonuses.All-Damage": {attacks: attackTypes, selector: "damage"},
    "data.bonuses.weapon.damage": {attacks: weaponAttacks, selector: "damage"},
    "data.bonuses.spell.damage":  {attacks: spellAttacks, selector: "damage"}
  }
  if (["dnd5e", "sw5e"].includes(game.system.id)) {
    acAffectingArmorTypes = ["light", "medium", "heavy", "bonus", "natural", "shield"];
  }
  ValidSpec.createValidMods();

  // We will call this in prepareData
  oldPrepareData = CONFIG.Actor.entityClass.prototype.prepareData;
  CONFIG.Actor.entityClass.prototype.prepareData = prepareData;

  oldApply = CONFIG.ActiveEffect.entityClass.prototype.apply;
  CONFIG.ActiveEffect.entityClass.prototype.apply = daeApply;
  // replace the default applyActiveEffects with the dae one so that prepareData will call us
  // Adds some extra field maniuplations and supports lookups
  //@ts-ignore
  CONFIG.Actor.entityClass.prototype.applyActiveEffects = applyBaseActiveEffects;

  daeActionTypeKeys =  Object.keys(CONFIG.DND5E.itemActionTypes)
  // This supplies DAE custom effects
  Hooks.on("applyActiveEffect", daeCustomEffect); 
  // Updating an owned item - first update any actor effects
  Hooks.on("preUpdateOwnedItem", updateArmorEffect)
  // If updating effects recreate actor effects for updated item.
  // Toggle equip active as well
  Hooks.on("preUpdateOwnedItem", ownedItemUpdate);

  // Do any create effects, .e.g. enabled/disaabled, armor
  Hooks.on("preCreateOwnedItem", ownedItemCreate)

  // macros are called on active effect creationg and deletion
  Hooks.on("preCreateActiveEffect", daeCreateActiveEffectActions);
  Hooks.on("preDeleteActiveEffect", daeDeleteActiveEffectActions)
  // Hooks.on("preUpdateOwnedItem", daeUpdateActiveEffectActions) //consider on/off for enable/disable

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
  furnaceActive = game.modules.get("furnace")?.active;
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
  ehnanceStatusEffects = game.settings.get("dae", "ehnanceStatusEffects");
  procStatusEffects(ehnanceStatusEffects);
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
