import { requestGMAction, GMAction } from "./GMAction";
import { warn, error, debug, setDebugLevel } from "../dae";
import { removeActiveEffectsToken } from "./daeMacros";
import { initSheetTab } from "./daeTab";
import { Framebuffer, TARGETS } from "pixi.js";
import { ActorEffects } from "./apps/ActorEffects";

export let _characterSpec: { data: any, flags: any } = { data: {}, flags: {} }
let templates = {};

export var aboutTimeInstalled = false;
export var requireItemTarget = true;
export var playersCanSeeEffects = "view";
export var tokenEffects = false;
export var cubActive;
export var itemacroActive;
export var calculateArmor;
export var debugEnabled;
export var useAbilitySave;

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
    if (game.system.id === "dnd5e") { 
      var specials = {
        //@ts-ignore - come back to this
        "flags.dnd5e.initiativeHalfProf": [false, ACTIVE_EFFECT_MODES.OVERRIDE],
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
        "macro..tokenMagic": ["", ACTIVE_EFFECT_MODES.CUSTOM],
        "data.bonuses.All-Attacks": ["", ACTIVE_EFFECT_MODES.CUSTOM],
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
        "flags.dnd5e.conditions": [false, ACTIVE_EFFECT_MODES.CUSTOM],
        "flags.dnd5e.forceCritical": [false, ACTIVE_EFFECT_MODES.CUSTOM]
      }
      // move all the characteer flags to specials so that the can be custom effects only
      Object.keys(CONFIG.DND5E.characterFlags).forEach(key=> {
        let theKey = `flags.dnd5e.${key}`;
        if (key === "flags.dnd5E.weaponCriticalThreshold") specials[theKey] = [0, -1];
        else specials[theKey] = [false, ACTIVE_EFFECT_MODES.CUSTOM];
        delete baseValues[theKey];
      }); 

      // patch for missing fields
      baseValues["data.bonuses.heal.damage"] = "";
      baseValues["data.bonuses.heal.attack"] = "";
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
    }

    // baseSpecs are all those fields defined in template.json game.system.model and are things the user can directly change
    this.baseSpecs = Object.keys(baseValues).map(spec => {
      let validSpec = new ValidSpec(spec, baseValues[spec], -1);
        this.baseSpecsObj[spec] = validSpec;
        return validSpec;
    });
    //@ts-ignore
    if (game.modules.get("tokenmagic")?.active) {
      specials["macro.tokenMagic"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    }

    // Do the system specific part
    if (game.system.id === "dnd5e") {
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
      if (game.system.id === "dnd5e") {
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
export function isDisabled(itemData) {
  // Get the dae flags from the item.
  const daeFlags = itemData.flags?.dae;
  if (!daeFlags) return true;
    let active = daeFlags.alwaysActive 
    || (daeFlags.activeEquipped && itemData.data.equipped)
    || (itemData.data.attuned && itemData.data.equipped)
  debug("is disabled returning ", !active, daeFlags);
  return !active;
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
    let id = e.data.origin?.match(/Actor.*Item\.(.*)/);
    var item;
    if (id?.length === 2) {
      item = e.parent.items.get(id[1]);
    } else item = null;
    // override default disabled behaviour to use item settings to toggle
    e.data.disabled = (item && isDisabled(item.data) && e.data.flags?.dae?.transfer !== false) || false;
    debug("item disabled ", e.data.disabled, item, item && isDisabled(item.data), e.data.flags?.dae?.transfer);
    if ( e.data.disabled ) return changes;
    return changes.concat(e.data.changes
      .filter(c => {return specList[c.key] !== undefined})
      .map(c => {
        c = duplicate(c);
        if (typeof specList[c.key].sampleValue === "number" && typeof c.value === "string") {
          debug("appplyDaeEffects: Doing eval of ", c, c.value)
          try {
            c.value = new Roll(c.value, rollData).roll().total;
          } catch (err) {
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
 * do custom effect applications
 * damage resistance/immunity/vulnerabilities
 * languages
 */
function daeCustomEffect(actor, change) {
  const current = getProperty(actor.data, change.key);
  var validValues;
  var value;
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
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? change.value : "+" + change.value;
      ["mwak", "rwak", "msak", "rsak"].forEach(atType => actor.data.data.bonuses[atType].attack += value);
      return true;
    case "data.bonuses.weapon.damage":
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? change.value : "+" + change.value;
      ["mwak", "rwak"].forEach(atType => actor.data.data.bonuses[atType].damage += value);
      return true;
    case "data.bonuses.spell.damage":
      value = (change.value.startsWith("+") || change.value.startsWith("-")) ? change.value : "+" + change.value;
      ["msak", "rsak"].forEach(atType => actor.data.data.bonuses[atType].damage += value);
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
  }
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
  debug("prepare data: before passes", this.name, this.data)
  if (!this.data.img) this.data.img = CONST.DEFAULT_TOKEN;
  if ( !this.data.name ) this.data.name = "New " + this.entity;
  this.prepareBaseData();
  this.prepareEmbeddedEntities();
  applyDaeEffects.bind(this)(ValidSpec.baseSpecsObj);
  this.prepareDerivedData();
  applyDaeEffects.bind(this)(ValidSpec.derivedSpecsObj);
  debug("prepare data: after passes", this.data);
  warn("prepare data: after passes", this.data)
}

export function scheduleEffectRemoval(actor, effects) {
  //Look at effect curations and schedule effect removal after duration espires.
  
}
export function daeCheckMacro(...args) {
  // conisder toggling according to item isactive
}

export function daeOnMacro(actor, effects) {
  debug("daeOnMacro",actor, effects)
  return daeMacro(true, actor, effects)
}
export function daeOffMacro(actor, effects) {
  debug("daeOffMacro",actor, effects)
  return daeMacro(false, actor, effects)
}
async function daeMacro(enable, actor, effects) {
  if (actor.__proto__.constructor.name === CONFIG.Item.entityClass.name) return;
  debug("dae macro ", enable, actor, effects)
  if (!Array.isArray(effects)) effects = [effects];
  effects.forEach(effect=> {
    effect.changes?.forEach(async change => {
      if (!["macro.execute", "macro.itemMacro"].includes(change.key)) return;
      if (typeof change.value === "string") { //args have not been evaled yet
        let rollData = daeRollData(actor)
        let id = effect.origin?.match(/Actor.*Item\.(.*)/);
        if (id?.length === 2) {
          const item = actor.items.get(id[1]);
          change.value = evalArgs.bind(item)(rollData, actor, change, 0, 0)
        }
      }
      if (change.key === "macro.execute") {
        const macro = game.macros.getName(change.value[0]);
        //@ts-ignore
        await macro.execute(enable ? "on" : "off", ...duplicate(change.value).splice(1))
      } else if (change.key === "macro.itemMacro") {
        let macroCommand = change.value[0]; // this is populated in evalArgs
        // macroCommand = `ChatMessage.create({content: "Item macro for ${itemData.name} called"})\n` + macroCommand;
        if (!macroCommand) {
          macroCommand = `ChatMessage.create({content: "No Item Macro for ${this.name}"})`;
          return;
        }
        let macro =  await CONFIG.Macro.entityClass.create({
          name: "DAE-Item-Macro",
          type: "script",
          img: null,
          command: macroCommand,
          flags: { "dnd5e.itemMacro": true }
        }, { displaySheet: false, temporary: true });
        await macro.execute(enable ? "on" : "off", ...duplicate(change.value).splice(1));
      }
    });
  })
  return true;
}

function daeCheckTokenMagic(...args) {
  //consider toggling according to isactive
}

export function daeOnTokenMagic(actor, effect) {
  // TODO: Check item active to see whether enable or disable
  daeTokenMagic(true, actor, effect)
};
export function daeOffTokenMagic(actor, effects) {daeTokenMagic(false, actor, effects)}
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

function evalArgs(context, actor, change, spellLevel: number, damageTotal: number) {
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
        else if (f === "@target") return "@target"
        else if (f === "@unique") return randomID();
        else if (f=== "@actor") return actor.data;
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
      if (typeof ValidSpec[change.key]?.sampleValue === "number")
        value = new Roll(change.value, context).roll().total
      else value = change.value;          
      break;
  };
  debug("evalargs: change is ", change);
  return value;
}

/*
 * appply non-transfer effects to target tokens - provided for backwards compat
 */
export function doEffects(item, activate, targets = undefined, { whisper = false, spellLevel = 0, damageTotal = null }) {
  applyNonTransferEffects.bind(item)(activate, targets, {whisper, spellLevel, damageTotal })
}

// Apply non-transfer effects to targets.
// macro arguments are evaluated in the context of the actor applying to the targets
// @target is left unevaluated.
// request is passed to a GM client
export function applyNonTransferEffects(activate, targets, {whisper = false, spellLevel = 0, damageTotal = null }) {
  if (!targets) return;
  let appliedEffects = duplicate(this.data.effects.filter(aeData => aeData.transfer === false))
  if (appliedEffects.length === 0) return;
  const rollData = daeRollData(this.actor)
  appliedEffects.forEach(activeEffectData => {
    activeEffectData.changes.forEach(change => {
      // eval args before calling GMAction so values are taken from the casting etc actor.
      change.value = evalArgs.bind(this)(rollData, this.actor, change, spellLevel, damageTotal)
    })
    activeEffectData.origin = `Actor.${this.actor.id}.OwnedItem.${this.id}`;
    activeEffectData.duration.startTime = game.time.worldTime;
    mergeObject(activeEffectData.duration, mapDuration(this), {overwrite: true, inplace: true});
    activeEffectData.transfer = false;
    activeEffectData.disabled = false;
    //@ts-ignore - targets is set of targets (i.e. game.user.targets)
    targets = Array.from(targets).map(t=>typeof t === "string" ? t : t.id);
  });
  debug("About to call gmaction ", activate, appliedEffects, targets)
  requestGMAction(GMAction.actions.applyActiveEffects, {activate, activeEffects: appliedEffects, targets})
}

// Update the actor active effects when editing an owned item
function ownedItemUpdate(actor, ownedItem, updates) {
  let additions = mergeObject(ownedItem.effects, updates.effects, {overwrite: true});
  additions = additions.filter(ef=>ef.transfer) || [];
  debug("additions post filter are ", additions)
  let origin = `Actor.${actor.id}.OwnedItem.${ownedItem._id}`;
  let deletions = actor.effects.filter(aef => {
    let isTransfer = aef.data.flags?.dae?.transfer || aef.data.transfer === undefined;
    return isTransfer && (aef.data.origin === origin);
  });
  deletions = deletions.map(ef => ef.id || ef._id);
  origin = `Actor.${actor.id}.OwnedItem.${updates._id}`
  additions.forEach(efData => efData.origin = origin);
  debug("owneditemupdate ", additions, deletions)
  Hooks.once("updateOwnedItem", () => {
    actor.deleteEmbeddedEntity("ActiveEffect", deletions)
    actor.createEmbeddedEntity("ActiveEffect", additions)
  })
  return true;
}

export function createArmorEffect(actor, itemData) {
  if (!calculateArmor || itemData.type !== "equipment") return true;
  switch(itemData.data.armor.type) {
    case "shield":
      const SHIELD_EFFECT = {
        label: itemData.name,
        icon: itemData.img,
        changes: [
          {
            key: "data.attributes.ac.value", 
            value: itemData.data.armor.value, 
            //@ts-ignore
            mode: CONST.ACTIVE_EFFECT_MODES.ADD, 
            priority: 15
          },
        ],
        transfer: true,
        origin: `Actor.${actor.id}.OwnedItem.${itemData._id}`,
        flags: {dae: {transfer: true}}
      };
      itemData.effects.push(SHIELD_EFFECT)
      break
    case "natural":
      setProperty(itemData, "flags.dae.alwaysActive", true);
    case "light":
    case "medium":
    case "heavy":
      setProperty(itemData, "flags.dae.activeEquipped", true);
      let dexMax = itemData.data.armor.dex ?? 99;
      var ARMOR_EFFECT = {
        label: itemData.name,
        icon: itemData.img,
        changes: [
          {
            key: "data.attributes.ac.value",
            value: `(${dexMax} < @abilities.dex.mod ? ${dexMax} : @abilities.dex.mod) + ` + itemData.data.armor.value, 
            //@ts-ignore
            mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, 
            priority: 5
          },
        ],
        transfer: true,
        origin: `Actor.${actor.id}.OwnedItem.${itemData._id}`,
        flags: {dae: {transfer: true}}
      };
      itemData.effects.push(ARMOR_EFFECT);
      break;
    default:
      break;
  }
  return true;
}

export function daeReadyActions() {
  ValidSpec.localizeSpecs();
  initSheetTab();

  //@ts-ignore
  aboutTimeInstalled = game.modules.get("about-time")?.active;
}

export function localDeleteFilters(tokenId: string, filterName: string) {
  //@ts-ignore
  let tokenMagic = window.TokenMagic;
  let token = canvas.tokens.get(tokenId);
  tokenMagic.deleteFilters(token, filterName);
}

export var tokenizer;

export function daeInitActions() {
  if (game.system.id === "dnd5e") {
    acAffectingArmorTypes = ["light", "medium", "heavy", "bonus", "natural", "shield"];
  }
  fetchParams();
  ValidSpec.createValidMods();

  oldPrepareData = CONFIG.Actor.entityClass.prototype.prepareData;
  CONFIG.Actor.entityClass.prototype.prepareData = prepareData;
  Hooks.on("applyActiveEffect", daeCustomEffect); // apply DAE custom effects
  Hooks.on("preUpdateOwnedItem", ownedItemUpdate)
  Hooks.on("preCreateOwnedItem", createArmorEffect)

  // macros are called on active effect creationg and deletion
  Hooks.on("preCreateActiveEffect", daeOnMacro);
  Hooks.on("preDeleteActiveEffect", daeOffMacro)
  Hooks.on("preCreateActiveEffect", scheduleEffectRemoval);
  // Hooks.on("preUpdateOwnedItem", daeCheckMacro) //consider on/off for enable/disable

  // token magic effects are apllied/removed on active effect creation/deletion
  Hooks.on("preCreateActiveEffect", daeOnTokenMagic);
  Hooks.on("preDeleteActiveEffect", daeOffTokenMagic)
  // Hooks.on("preUpdateOwnedItem", daeCheckTokenMagic) // consider apply/unapply for enable/disable
  Hooks.on('renderActorSheet', initActorSheetHook);

  //@ts-ignore
  tokenizer = new DETokenizeThis({
    shouldTokenize: ['(', ')', ',', '*', '/', '%', '+', '=', '!=', '!', '<', '> ', '<=', '>=', '^']
  });
}

function initActorSheetHook(app, html, data) {
  let title = game.i18n.localize('dae.ActiveEffectName'); 
  let openBtn = $(`<a class="open-actor-effect" title="${title}"><i class="fas fa-clipboard"></i>${title}</a>`);
  openBtn.click(ev => {
      new ActorEffects({actor: app.entity}, {}).render(true);
  });
  html.closest('.app').find('.open-actor-effect').remove();
  let titleElement = html.closest('.app').find('.window-title');
  openBtn.insertAfter(titleElement); 
}

export function daeSetupActions() {
  //@ts-ignore
  cubActive = game.modules.get("combat-utility-belt")?.active;
  //@ts-ignore
  debug("Combat utility belt active ", cubActive, " and cub version is ", game.modules.get("combat-utility-belt")?.data.version)

  //@ts-ignore
  if (cubActive && !isNewerVersion(game.modules.get("combat-utility-belt")?.data.version, "1.1.1")) {
    ui.notifications.warn("Combat Utility Belt needs to be version 1.1.2 or later - conditions disabled");
    console.warn("Combat Utility Belt needs to be version 1.1.2 or later - conditions disabled");
    cubActive = false;
  } else if (cubActive) {
    debug("dae | Combat Utility Belt active and conditions enabled");
  }
  //@ts-ignore
  itemacroActive = game.modules.get("itemacro")?.active;
}

export function fetchParams() {
  requireItemTarget = game.settings.get("dae", "requireItemTarget");
  playersCanSeeEffects = game.settings.get("dae", "playersCanSeeEffects");
  tokenEffects = game.settings.get("dae", "tokenEffects");
  calculateArmor = game.settings.get("dae", "calculateArmor");
  debugEnabled = setDebugLevel(game.settings.get("dae", "ZZDebug"));
  useAbilitySave = game.settings.get("dae", "useAbilitySave")
}

export function mapDuration(item) {
  if (!item.data.data.duration) return null;
  const itemData = item.data;
  let aboutTime = false;
  if (!aboutTime) {
    switch (itemData.data.duration.units) {
      case "turn": return {turns: itemData.data.duration.value};
      case "round": return {rounds: itemData.data.duration.value};
      case "minute": return {minutes: itemData.data.duration.value}
      case "hour": return {rounds: itemData.data.duration.value};
      case "hour": return {hours: itemData.data.duration.value};
      case "day": return {days: itemData.data.duration.value}
      case "week": return {weeks: itemData.data.duration.value}
      case "month": return {months: itemData.data.duration.value};
      case "year": return {years: itemData.data.duration.value};
    }
  } else {
    // do about time stuff
  }
}