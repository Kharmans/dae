import { requestGMAction, GMAction, applyActiveEffects } from "./GMAction";
import { warn, error, debug, setDebugLevel, daeAlternateStatus } from "../dae";
import { ActiveEffects } from "./apps/ActiveEffects";
import { DAEActiveEffectConfig } from "./apps/DAEActiveEffectConfig";

export let _characterSpec: { data: any, flags: any } = { data: {}, flags: {} }
let templates = {};

export var aboutTimeInstalled = false;
export var timesUpInstalled = false;
export var requireItemTarget = true;
export var playersCanSeeEffects = "view";
export var tokenEffects = false;
export var cubActive;
export var furnaceActive;
export var itemacroActive;
export var calculateArmor;
export var debugEnabled;
export var useAbilitySave;
export var activeConditions;

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
    //@ts-ignore
    if (game.modules.get("gm-notes")?.active) {
      baseValues["flags.gm-notes.notes"] = "";
    }
    //@ts-ignore
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    if (["dnd5e", "sw5e"].includes(game.system.id)) { 
      var specials = {
        //@ts-ignore - come back to this
        "flags.dnd5e.initiativeHalfProf": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "flags.dnd5e.weaponCriticalThreshold": [20, -1],
        "data.attributes.ac.value": [0, -1],
        "data.attributes.ac.min": [0, -1],
        "data.attributes.hp.max": [0, -1],
        "data.attributes.hp.tempmax": [0, -1],
        "data.attributes.hp.min": [0, -1],
        "data.attributes.init.total": [0, -1],
        "data.attributes.hd": [0, -1],
        "data.attributes.prof": [0, ACTIVE_EFFECT_MODES.CUSTOM], 
        // "data.attributes.spelldc": [0, -1], Use bonuses.spell.dc instead
        "data.attributes.encumbrance.max": [0,-1],
        // "data.attributes.spelllevel":  0,
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
        "data.traits.languages.value": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.languages.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.di.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.di.value": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.di.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dr.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dr.value": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dr.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dv.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dv.value": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.dv.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.ci.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.ci.value": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.ci.custom": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.toolProf.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.toolProf.value": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.toolProf.custom": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.armorProf.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.armorProf.value": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.armorProf.custom": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.weaponProf.all": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.weaponProf.value": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "data.traits.weaponProf.custom": [false, ACTIVE_EFFECT_MODES.CUSTOM],
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
        "flags.dae": ["", ACTIVE_EFFECT_MODES.CUSTOM]
      };

      ["mwak", "rwak", "msak", "rsak"].forEach(id => {
        specials[`data.bonuses.${id}.attack`] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
        specials[`data.bonuses.${id}.damage`] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      })
      // move all the characteer flags to specials so that the can be custom effects only
      Object.keys(CONFIG.DND5E.characterFlags).forEach(key=> {
        let theKey = `flags.dnd5e.${key}`;
        if (theKey === "flags.dnd5e.weaponCriticalThreshold") specials[theKey] = [0, -1];
        else specials[theKey] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
        delete baseValues[theKey];
      }); 

      // patch for missing fields

      // needs to be int and in base values since it is used in prepare derived data 
      // to calc ability spell dcs
      //TODO work out how to evaluate this to a number in prepare data
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
    }

    // baseSpecs are all those fields defined in template.json game.system.model and are things the user can directly change
    this.baseSpecs = Object.keys(baseValues).map(spec => {
      let validSpec = new ValidSpec(spec, baseValues[spec], -1);
      if (spec.includes("data.skills") && spec.includes("ability")) {
        validSpec.forcedMode = ACTIVE_EFFECT_MODES.OVERRIDE;
      }
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
  }

  static localizeSpecs() {
    this.allSpecs = this.allSpecs.map(m => {
      m._label = m._label.replace("data.", "").replace("dnd5e.", "").replace(".value", "").split(".").map(str => game.i18n.localize(`dae.${str}`)).join(" ");
      return m
    });
  }
}

// Is the item disalbed?
export function isActive(itemData) {
  // Get the dae flags from the item.
  const daeFlags = itemData.flags?.dae;
  if (!daeFlags) return false;
    let active = daeFlags.alwaysActive 
    || (daeFlags.activeEquipped && itemData.data.equipped)
    || (itemData.data.attuned && itemData.data.equipped)
  return active;
}

function effectDisabled(actor, efData, itemData = null) {
  let disabled = efData.disabled;
  const ci = actor.data.data.traits?.ci?.value;
  const statusId = efData.flags?.core?.statusId;
  disabled  = disabled || (ci && ci.includes(statusId));
  const alternate = statusId && daeAlternateStatus[statusId];
  disabled  = disabled || (ci && ci.includes(alternate));

  // transfer effects with an origin will override default enable/disable
  if (efData.origin && efData.flags?.dae?.transfer) {
    if (!itemData) {
      let [actorType, actorId, itemType, itemId] = efData.origin.split(".");
      itemData = itemId && actor.items.get(itemId);
    }
    // for transfer effects this take priority over disabled setting
    if (itemData) {
        return !isActive(itemData);
    }
   }
  // if not calcullating armor disable armor effects
  if (efData.flags.dae?.armorEffect)
    disabled = disabled || !calculateArmor;
  return disabled;
}

var oldPrepareData;
/*
 * Replace default appplyAffects to do value lookups
 */
function applyDaeEffects(specList) {
  const overrides = {};
  if (this.effects.size === 0)  return this.overrides;
  const rollData = daeRollData(this);
  // Organize non-disabled effects by their application priority
  const changes = this.effects.reduce((changes, e) => {
    // e.data.disabled = effectDisabled(this, e.data)
    if ( e.data.disabled ) return changes;
    // TODO find a solution for flags.? perhaps just a generic speclist
    return changes.concat(e.data.changes
      .filter(c => {return specList[c.key] !== undefined})
      .map(c => {
        c = duplicate(c);
        if (typeof specList[c.key].sampleValue === "number" && typeof c.value === "string") {
          debug("appplyDaeEffects: Doing eval of ", c, c.value)
          try {
            c.value = new Roll(c.value, rollData).roll().total;
          } catch (err) {
            console.warn("change value calculation failed for", this, c);
            console.warn(err)
          };
        }
        c.effect = e;
        c.priority = c.priority ?? (c.mode * 10);
        return c;
      }));
  }, []);

  changes.sort((a, b) => a.priority - b.priority);

  if (changes.length > 0) debug("Applying change ", this.name, changes)

  // Apply all changes
  for ( let change of changes ) {
    const result = change.effect.apply(this, change);
    if ( result !== null ) overrides[change.key] = result;
  }

  // Expand the set of final overrides
  this.overrides = mergeObject(this.overrides || {}, expandObject(overrides) || {}, {inplace: true, overwrite: true});
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
  if (change.key.includes("flags.dnd5e")) {
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
      return doCustomValue(actor, current, change, Object.keys(CONFIG.DND5E.damageResistanceTypes));
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
      return doCustomValue(actor, current, change, Object.keys(CONFIG.DND5E.languages));
    case "data.traits.ci.all":
      setProperty(actor.data, "data.traits.ci.value", Object.keys(CONFIG.DND5E.conditionTypes))
      return true;
    case "data.traits.ci.value":
      return doCustomValue(actor, current, change, Object.keys(CONFIG.DND5E.conditionTypes))
    case "data.traits.toolProf.value":
      return doCustomValue(actor, current, change, Object.keys(CONFIG.DND5E.toolProficiencies))
    case "data.traits.toolProf.all":
      setProperty(actor.data, "data.traits.toolProf.value", Object.keys(CONFIG.DND5E.toolProficiencies))
      return true;
    case "data.traits.armorProf.value":
      return doCustomValue(actor, current, change, Object.keys(CONFIG.DND5E.armorProficiencies))
    case "data.traits.armorProf.all":
      setProperty(actor.data, "data.traits.armorProf.value", Object.keys(CONFIG.DND5E.armorProficiencies))
      return true;
    case "data.traits.weaponProf.value":
      return doCustomValue(actor, current, change, Object.keys(CONFIG.DND5E.weaponProficiencies))
    case "data.traits.weaponProf.all":
      setProperty(actor.data, "data.traits.weaponProf.value", Object.keys(CONFIG.DND5E.weaponProficiencies))
      return true;
    case "data.bonuses.All-Attacks":
      value = attackDamageBonusEval(change.value, actor)
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
      ["mwak", "rwak", "msak", "rsak"].forEach(atType => actor.data.data.bonuses[atType].attack += value);
      return true;
    case "data.bonuses.spell.attack":
      value = attackDamageBonusEval(change.value, actor)
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
      ["msak", "rsak"].forEach(atType => actor.data.data.bonuses[atType].attack += value);
      return true;
    case "data.bonuses.weapon.attacks":
      value = attackDamageBonusEval(change.value, actor)
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
      ["mwak", "rwak"].forEach(atType => actor.data.data.bonuses[atType].attack += value);
      return true;
    case "data.bonuses.All-Damage":
      value = attackDamageBonusEval(change.value, actor)
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
      ["mwak", "rwak", "msak", "rsak"].forEach(atType => actor.data.data.bonuses[atType].damage += value);
      return true;
    case "data.bonuses.weapon.damage":
      value = attackDamageBonusEval(change.value, actor)
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
      ["mwak", "rwak"].forEach(atType => actor.data.data.bonuses[atType].damage += value);
      return true;
    case "data.bonuses.spell.damage":
      value = attackDamageBonusEval(change.value, actor)
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? value : "+" + value;
      ["msak", "rsak"].forEach(atType => actor.data.data.bonuses[atType].damage += value);
      return true;
    case "data.bonuses.mwak.attack":
    case "data.bonuses.mwak.damage":
    case "data.bonuses.rwak.attack":
    case "data.bonuses.rwak.damage":
    case "data.bonuses.msak.attack":
    case "data.bonuses.msak.damage":
    case "data.bonuses.rsak.attack":
    case "data.bonuses.rsak.damage":
    case "data.bonuses.abilities.save":
    case "data.bonuses.abilities.check":
    case "data.bonuses.abilities.skill":

      // TODO: remove if fixed in core
      const result = attackDamageBonusEval(change.value, actor)
      value = (result.startsWith("+") || result.startsWith("-")) ? result : "+" + result;
      setProperty(actor.data, change.key, current + value);
      return true;

    case "data.attributes.prof":
      // update data.attributes.prof
      //@ts-ignore
      if (!Number.isNumeric(change.value)) {
        ui.notifications.warn("Changes to proficiency must be numeric");
        return true;
      }
      const actorData = actor.data;
      const data = actorData.data;
      value = parseInt(change.value);
      data.attributes.prof += value;

      // update ability mods/saves if proficient
      //@ts-ignore
      const dcBonus = Number.isNumeric(data.bonuses.spell.dc) ? parseInt(data.bonuses.spell.dc) : 0;
      for (let [id, abl] of Object.entries(data.abilities)) {
        //@ts-ignore
        abl.prof += (abl.proficient || 0) * value;
        //@ts-ignore
        abl.save += (abl.proficient || 0) * value;
        //@ts-ignore
        abl.dc += value;
      }
      // update spell dcs
      actor._computeSpellcastingDC(actor.data);
      const bonuses = getProperty(data, "bonuses.abilities") || {};
      if (actor.data.type === "vehicle") return true;

      // update skills if proficient
      const flags = actorData.flags.dnd5e || {};
      const feats = CONFIG.DND5E.characterFlags;
      const athlete = flags.remarkableAthlete;
      const joat = flags.jackOfAllTrades;
      let round = Math.floor;
      let add = 0.5;
      for (let [id, skl] of Object.entries(data.skills)) {
        //@ts-ignore
        let sklValue = parseFloat(skl.value || 0);
          // Apply Remarkable Athlete or Jack of all Trades
        let multi = sklValue;
        //@ts-ignore
        if ( athlete && (sklValue === 0) && feats.remarkableAthlete.abilities.includes(skl.ability) ) {
          multi = 0.5;
          round = Math.ceil;
          add = 0.5;
        }
        if ( joat && (sklValue === 0 ) ) multi = 0.5;
        // Compute updated skill value
        //@ts-ignore
        skl.total = round(skl.total + multi * value + add);
        //@ts-ignore
        skl.prof =  round(skl.prof + multi * value + add);
        // Compute passive bonus
        //@ts-ignore
        skl.passive = round(skl.passive + multi * value + add);
      }
      return true;
    case "flags.dae": 
      let list = change.value.split(" ");
      setProperty(actor.data, `flags.dae.${list[0]}`, list.splice(1).join(" "));
      return true;
    }
}

function attackDamageBonusEval(bonusString, actor) {
  if (typeof bonusString === "string") {
    const special = bonusString.match(/\((.*)\)d([0-9]*)/);
    if (special && special.length === 3) {
      try {
          return new Roll(special[1], daeRollData(actor)).roll().total + "d" + special[2];
      }
      catch (err) {
          console.warn(`DAE eval error for: ${special[1]} in actor ${actor.name}`);
          return bonusString;
      }
    }
  }
  return `${bonusString}`;
}

function doCustomValue(actor, current, change, validValues) {
  if (current.includes(change.value)) return true;
  if (!validValues.includes(change.value)) return true;
  setProperty(actor.data, change.key, current.concat([change.value]))
  return true;
}

/*
* replace the default actor prepareData
* call applyDaeEffects
* add an additional pass after derivfed data
*/
function prepareData() {
  this.data = duplicate(this._data);
  debug("prepare data: before passes", this.name, this.data);

  // Add a default AC for characters
  if (!this.data.img) this.data.img = CONST.DEFAULT_TOKEN;
  if ( !this.data.name ) this.data.name = "New " + this.entity;
  this.prepareBaseData();
  this.prepareEmbeddedEntities();
  applyDaeEffects.bind(this)(ValidSpec.baseSpecsObj, false);
  this.prepareDerivedData();
  if (["dnd5e", "sw5e"].includes(game.system.id)) {
    if (calculateArmor && this.data.type === "character" && game) {
      this.data.data.attributes.ac.value = 10 + Number(this.data.data.abilities.dex.mod);
    }
  }

  applyDaeEffects.bind(this)(ValidSpec.derivedSpecsObj,);
  debug("prepare data: after passes", this.data);
}

export function daeCheckMacro(...args) {
  // conisder toggling according to item isactive
}

export function daeCreateActiveEffectActions(actor, effects) {
  daeMacro(true, actor, effects);
  daeTokenMagic(true, actor, effects);
}

export function daeDeleteActiveEffectActions(actor, effects) {
  if (actor.__proto__.constructor.name !== CONFIG.Actor.entityClass.name) return;
  if (!Array.isArray(effects)) effects = [effects];
  effects.forEach(effect => {
    if (!effect.transfer) return;
  })
  daeMacro(false, actor, effects);
  daeTokenMagic(false, actor, effects)
}

async function daeMacro(enable, actor, effects) {
  if (actor.__proto__.constructor.name === CONFIG.Item.entityClass.name) return;
  debug("dae macro ", enable, actor, effects)
  if (!Array.isArray(effects)) effects = [effects];
  effects.forEach(async effect=>  {
    let item = (effect.origin && await fromUuid(effect.origin)) || null;
    effect.changes?.forEach(async change => {
      if (!["macro.execute", "macro.itemMacro"].includes(change.key)) return;
      if (typeof change.value === "string") { //args have not been evaled yet
        let rollData = daeRollData(actor)
        change.value = evalArgs.bind(item)(rollData, actor, change, 0, 0)
      }
      if (change.key === "macro.execute") {
        const macro = game.macros.getName(change.value[0]);
        if (!macro) {
          console.error(`No macro ${change.value[0]} found`);
          //TODO localize this
          ui.notifications.warn(`No macro ${change.value[0]} found`)
        }
        if (furnaceActive) {
          //@ts-ignore
          await macro.execute(enable ? "on" : "off", ...duplicate(change.value).splice(1))
        } else {
          console.warn("Furnace not active - so no macro arguments supported");
          await macro.execute();
        }
      } else if (change.key === "macro.itemMacro") {
        let macroCommand = change.value[0]; // this is populated in evalArgs
        // macroCommand = `ChatMessage.create({content: "Item macro for ${itemData.name} called"})\n` + macroCommand;
        if (!macroCommand) {
          macroCommand = `ChatMessage.create({content: "No Item Macro for ${item?.name}"})`;
          return;
        }
        let macro =  await CONFIG.Macro.entityClass.create({
          name: "DAE-Item-Macro",
          type: "script",
          img: null,
          command: macroCommand,
          flags: { "dnd5e.itemMacro": true }
        }, { displaySheet: false, temporary: true });
        if (furnaceActive) {
          await macro.execute(enable ? "on" : "off", ...duplicate(change.value).splice(1));
        } else {
          console.warn("Furnace not active - so no macro arguments supported")
          await macro.execute();
        }
      }
    });
  })
  return true;
}

function daeCheckTokenMagic(...args) {
  //consider toggling according to isactive

}

function daeTokenMagic(enable, actor, effects) {
  // TODO lookup enabled from the item.isActive
  if (actor.__proto__.constructor.name !== CONFIG.Actor.entityClass.name) return;
  debug("dae token magic ", actor, effects, enable)
  if (!Array.isArray(effects)) effects = [effects];
  effects.forEach(effect=> {
    effect.changes?.forEach(change=> {
      if (change.key === "macro.tokenMagic") {
        let tokens = [actor.token];
        if (!actor.token) tokens = actor.getActiveTokens();
        //@ts-ignore
        let tokenMagic = window.TokenMagic;
        tokens.forEach(token => {
          if (tokenMagic && token && enable) {
            tokenMagic.addFilters(token, change.value);
          } else if (tokenMagic && token && !enable) {
            tokenMagic.deleteFilters(token, change.value)
          }
        });
      }
    })
  })
}

function daeRollData(actor) {
  let rollData = actor.getRollData();
  rollData.data = rollData;
  rollData.flags = actor.flags;
  return rollData;
}

function evalArgs(context, actor, change, spellLevel: number, damageTotal: number, options) {
  //@ts-ignore
  let filteredChanges = [];
  //@ts-ignore effects not defined
  let fields = [];
  let value;
  switch (change.key) {
    case "macro.itemMacro":
    case "macro.execute":
      tokenizer.tokenize(change.value, (token) => fields.push(token))
      fields = fields.map(f => {
        if (f === "@scene") return canvas.scene.id;
        else if (f === "@token") return ChatMessage.getSpeaker().token;
        else if (f === "@item") return this.data;
        else if (f === "@spellLevel") return spellLevel;
        else if (f === "@item.level") return spellLevel;
        else if (f === "@damage") return damageTotal;
        else if (f === "@target") return "@target";
        else if (f === "@itemCardId") return options.itemCardId;
        else if (f === "@unique") return randomID();
        else if (f === "@actor") return actor.data;
        else if (f === "@critical") return options.critical;
        else if (f === "@fumble") return options.fumble;
        else if (f === "@whisper") return options.whisper;
        else if (typeof f === "string" && f.startsWith("@")) {
          return getProperty(context, f.slice(1))
        }
        else return f;
      });
      if (change.key === "macro.itemMacro") {
        let macroCommand = this?.data?.flags?.itemacro?.macro?.data.command || 'console.warn("No macro defined for item")';
        value = [macroCommand].concat(fields)
      } else value = fields;
      break;
    default:
      tokenizer.tokenize(`${change.value}`, (token) => fields.push(token));
      fields = fields.map(f => {
        if (f === "@scene") return canvas.scene.id;
        else if (f === "@token") return ChatMessage.getSpeaker().token;
        else if (f === "@item") return this.id;
        else if (f === "@spellLevel") return spellLevel;
        else if (f === "@item.level") return spellLevel;
        else if (f === "@damage") return damageTotal;
        else if (f === "@target") return "<not-defined>"
        else if (f === "@unique") return randomID();
        else if (f=== "@actor") return actor.id;
        else if (typeof f === "string" && f.startsWith("@")) {
          return getProperty(context, f.slice(1))
        }
        else return f;
      });
      change.value = fields.join("");
      // context.actor = actor.data;
      if (typeof ValidSpec.allSpecsObj[change.key]?.sampleValue === "number") {
        value = new Roll(change.value, context).roll().total
      }
      else value = change.value;          
      break;
  };
  debug("evalargs: change is ", change);
  return value;
}

/*
 * appply non-transfer effects to target tokens - provided for backwards compat
 */
export function doEffects(item, activate, targets = undefined, 
    { whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false }) {
  applyNonTransferEffects.bind(item)(activate, targets, {whisper, spellLevel, damageTotal, itemCardId, critical, fumble })
}

// Apply non-transfer effects to targets.
// macro arguments are evaluated in the context of the actor applying to the targets
// @target is left unevaluated.
// request is passed to a GM client
export function applyNonTransferEffects(activate, targets, {whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false }) {
  if (!targets) return;
  let appliedEffects = duplicate(this.data.effects.filter(aeData => aeData.transfer === false))
  if (appliedEffects.length === 0) return;
  const rollData = daeRollData(this.actor)
  appliedEffects.forEach(activeEffectData => {
    activeEffectData.changes.forEach(change => {
      // eval args before calling GMAction so values are taken from the casting etc actor.
      change.value = evalArgs.bind(this)(rollData, this.actor, change, spellLevel, damageTotal, {critical, fumble, itemCardId, whisper})
    })
    activeEffectData.origin = this.uuid;
    activeEffectData.duration.startTime = game.time.worldTime;
    activeEffectData.transfer = false;
    activeEffectData.disabled = false;
    //@ts-ignore - targets is set of targets (i.e. game.user.targets)
  });
  
  // Split up targets according to whether they are owned on not. Owned targets have effects applied locally, only unowned are passed ot the GM
  const targetList = Array.from(targets);
  //@ts-ignore
  let ownedTargets = targetList.filter(t=>t.actor?.permission === 3).map(t=> typeof t === "string" ? t : t.id);
  //@ts-ignore
  let unOwnedTargets = targetList.filter(t=>t.actor?.permission !== 3).map(t=> typeof t === "string" ? t : t.id);;
  debug("About to call gmaction ", activate, appliedEffects, targets, ownedTargets, unOwnedTargets)
  requestGMAction(GMAction.actions.applyActiveEffects, {activate, activeEffects: appliedEffects, targets: unOwnedTargets, itemDuration: this.data.data.duration, itemCardId})
  applyActiveEffects(activate, ownedTargets, appliedEffects, this.data.data.duration, itemCardId)
}

// Update the actor active effects when editing an owned item
function ownedItemUpdate(actor, ownedItem, updates) {
  const newData = mergeObject(ownedItem, updates, {overwrite: true});
  if (updates.effects) {
    let additions = mergeObject(ownedItem.effects, updates.effects, {overwrite: true, inplace: false});
    additions = additions.filter(ef=>ef.transfer) || [];
    debug("additions post filter are ", updates.effects, additions)
    let origin = actor.items.get(ownedItem._id).uuid;
    let deletions = actor.effects.filter(aef => {
      let isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
      return isTransfer && (aef.data.origin === origin);
    });
    deletions = deletions.map(ef => ef.id || ef._id);
    origin = `Actor.${actor.id}.OwnedItem.${updates._id}`
    additions.forEach(efData => {
      efData.disabled = effectDisabled(actor, efData, ownedItem)
      efData.origin = origin;
    });
    
    debug("owneditemupdate ", additions, deletions);
    //TODO: change this so we can do an updateEmbeddedEntitty.
    // It does require matching the active effect ids to the source item
    actor.deleteEmbeddedEntity("ActiveEffect", deletions).then(() => 
      actor.createEmbeddedEntity("ActiveEffect", additions));
  } else {
    origin = `Actor.${actor.id}.OwnedItem.${updates._id}`;
    let effects = actor.effects.filter(aef => {
      let isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
      return (aef.data.origin === origin) && isTransfer;
    }).map(aef => {
      const data = duplicate(aef.data);
      data.disabled = effectDisabled(actor, aef.data, ownedItem);
      return data;
    })
    actor.updateEmbeddedEntity("ActiveEffect", effects);
  }
  return true;
}
export function updateArmorEffect(actor, itemData, updateData, ...args) {
  if (updateData.data?.armor) {
    // Armor value has been changed so recrreate owned item and actor effects
    let theEffects = duplicate(itemData.effects.filter(efData => !efData.flags.dae?.armorEffect));
    let existingEffect = duplicate(itemData.effects.find(efData => efData.flags.dae?.armorEffect));
    const origin = `Actor.${actor.id}.OwnedItem.${itemData._id}`;
    // const origin = actor.items.get(itemData._id)
    let armorEffect = generateArmorEffect(itemData, origin, mergeObject(itemData.data.armor, updateData.data.armor, {overwrite: true}));
    let newEffect = mergeObject(existingEffect, armorEffect, {overwrite: true, inplace:true});
    theEffects.push(newEffect);
    updateData.effects = theEffects;
    // Since this runs in the preUpdateOwneditem chain just modifyiing the update data is enough
  }
  return true;
}
export function createArmorEffect(actor, itemData) {
  if (!itemData.effects && itemData.data.effects) itemData = itemData.data;
  if (!calculateArmor || itemData.type !== "equipment") return true;
  // armor created on actor, screae armor effect.
  const origin = `Actor.${actor.id}.OwnedItem.${itemData._id}`;
  // const origin = actor.items.get(itemData._id).uuid;
  itemData.effects = itemData.effects.filter(efData => !efData.flags.dae?.armorEffect);
  switch(itemData.data.armor.type) {
    case "natural":
      setProperty(itemData, "flags.dae.alwaysActive", true);
      //@ts-ignore
      itemData.effects.push(generateArmorEffect(itemData, origin, itemData.data.armor));
      break;
    case "shield":
    case "light":
    case "medium":
    case "heavy":
      setProperty(itemData, "flags.dae.activeEquipped", true);
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
      return armorEffectFromFormula(`(@abilities.dex.mod > ${armorData.dex || 99} ? ${armorData.dex || 99} : @abilities.dex.mod)+ ${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, itemData, origin);
    case "medium":
      //@ts-ignore
      return armorEffectFromFormula(`(@abilities.dex.mod > ${armorData.dex || 2} ? ${armorData.dex || 2} : @abilities.dex.mod)+ ${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, itemData, origin);
      case "heavy":
      //@ts-ignore
      return armorEffectFromFormula(`${armorData.value}`, CONST.ACTIVE_EFFECT_MODES.OVERRIDE, itemData, origin);
    default:
      return null;
      break;
  }
}

function armorEffectFromFormula(formula, mode, itemData, origin) {
  return {
    label: itemData.name,
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

export function daeInitActions() {
  if (["dnd5e", "sw5e"].includes(game.system.id)) {
    acAffectingArmorTypes = ["light", "medium", "heavy", "bonus", "natural", "shield"];
  }
  ValidSpec.createValidMods();

  oldPrepareData = CONFIG.Actor.entityClass.prototype.prepareData;
  CONFIG.Actor.entityClass.prototype.prepareData = prepareData;
  Hooks.on("applyActiveEffect", daeCustomEffect); // apply DAE custom effects
  // Updating an owned item - first update any actor effects
  Hooks.on("preUpdateOwnedItem", updateArmorEffect)
  // If updating effects recreate actor effects for updated item.
  Hooks.on("preUpdateOwnedItem", ownedItemUpdate);
  Hooks.on("preCreateOwnedItem", createArmorEffect)

  // macros are called on active effect creationg and deletion
  Hooks.on("preCreateActiveEffect", daeCreateActiveEffectActions);
  Hooks.on("preDeleteActiveEffect", daeDeleteActiveEffectActions)
  // Hooks.on("preUpdateOwnedItem", daeCheckMacro) //consider on/off for enable/disable

  // Hooks.on("preUpdateOwnedItem", daeCheckTokenMagic) // consider apply/unapply for enable/disable
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
  openBtn.insertAfter(titleElement); 
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

  furnaceActive = game.modules.get("furnace")?.active
}

export function fetchParams() {
  requireItemTarget = game.settings.get("dae", "requireItemTarget");
  playersCanSeeEffects = game.settings.get("dae", "playersCanSeeEffects");
  tokenEffects = game.settings.get("dae", "tokenEffects");
  calculateArmor = game.settings.get("dae", "calculateArmor");
  debugEnabled = setDebugLevel(game.settings.get("dae", "ZZDebug"));
  useAbilitySave = game.settings.get("dae", "useAbilitySave")
  let useDAESheet = game.settings.get("dae", "useDAESheet");
  if (useDAESheet) {
    CONFIG.ActiveEffect.sheetClass = DAEActiveEffectConfig;
  } else {
    CONFIG.ActiveEffect.sheetClass = ActiveEffectConfig;
  }
}