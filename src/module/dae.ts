import { requestGMAction, GMAction } from "./GMAction";
import { warn, error } from "../dae";
import { removeActiveEffectsToken } from "./daeMacros";
import { initSheetTab } from "./daeTab";

export let _characterSpec: { data: any, flags: any } = { data: {}, flags: {} }
let templates = {};

export var aboutTimeInstalled = false;
export var requireItemTarget = true;
export var playersCanSeeEffects = "view";
export var tokenEffects = false;
export var cubActive;
export var itemacroActive;
export var calculateArmor;

let debugLog = true;
let acAffectingArmorTypes = [];

function debug(...args) {
  console.log("dae | ", ...args);
}
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

  _sampleValue: string | number;
  get sampleValue(): string | number { return this._sampleValue }
  set sampleValue(value: string | number) { this._sampleValue = value }

  _label: string;
  get label(): string { return this._label }
  set label(label: string) { this._label = label }

  constructor(fs: string, sv: string | number) {
    this._fieldSpec = fs;
    this._sampleValue = sv;
    this._label = fs;
  }

  static createValidMods(characterSpec: {} = game.system.model.Actor.character) {
    _characterSpec["data"] = duplicate(characterSpec);
    let baseValues = flattenObject(_characterSpec);
    console.error("Creating valid mods ", baseValues)
    if (game.system.id === "dnd5e") { // patch for missing fields
      // data.bonuses.spell.dc hoping will appear in 0.8.3
      baseValues["data.bonuses.heal.damage"] = "";
      baseValues["data.bonuses.heal.attack"] = "";
      // The way spell.dc is expected to behave is as a number so treat it as such
      baseValues["data.bonuses.spell.dc"] = 0;
      // dae pseudo field
      baseValues["data.traits.languages.all"] = false;
      // dae psuedo field 
      baseValues["data.bonuses.All-Attacks"] = false;
      baseValues["data.traits.di.all"] = false;
      baseValues["data.traits.dr.all"] = false;
      baseValues["data.traits.dv.all"] = false;
      baseValues["data.spells.pact.level"] = 0;
    }
    //@ts-ignore
    if (game.modules.get("gm-notes")?.active) {
      baseValues["flags.gm-notes.notes"] = "";
    }
    // baseSpecs are all those fields defined in template.json game.system.model and are things the user can directly change
    this.baseSpecs = Object.keys(baseValues).map(spec => {
      let validSpec = new ValidSpec(spec, baseValues[spec]);
      this.baseSpecsObj[spec] = validSpec;
      return validSpec;
    });

    // Do the system specific part
    if (game.system.id === "dnd5e") {
      // 1. abilities add mod and save to each;
      Object.keys(_characterSpec.data.abilities).forEach(ablKey => {
        let abl = _characterSpec.data.abilities[ablKey];
        abl.mod = 0; abl.saveBonusDE = 0; abl.min = 0;
      })
      // adjust specs for bonuses - these are strings, @fields are looked up but dice are not rolled.

      // Skills add mod, passive and bonus fields
      Object.keys(_characterSpec.data.skills).forEach(sklKey => {
        let skl = _characterSpec.data.skills[sklKey];
        skl.mod = 0; skl.passive = 0; // skl.bonus = 0;
      })
      // Add special fields
      // 1st group are flags that are absent in model
      // 2nd special fields check_all
      let characterFlags = CONFIG.DND5E.characterFlags; // look at using this to update the _characterSpec instead of hard coding
      mergeObject(_characterSpec, {
        //@ts-ignore - come back to this
        "flags.dnd5e.initiativeAdv": false,
        "flags.dnd5e.initiativeAlert": false,
        "flags.dnd5e.initiativeHalfProf": false,
        "flags.dnd5e.powerfulBuild": false,
        "flags.dnd5e.savageAttacks": false,
        "flags.dnd5e.elvenAccuracy": false,
        "flags.dnd5e.halflingLucky": false,
        "flags.dnd5e.jackOfAllTrades": false,
        "flags.dnd5e.observantFeat": false,
        "flags.dnd5e.reliableTalent": false,
        "flags.dnd5e.remarkableAthlete": false,
        "flags.dnd5e.weaponCriticalThreshold": 20,
        "data.attributes.ac.value": 0,
        "data.attributes.ac.min": 0,
        "data.attributes.init.total": 0,
        "data.attributes.hd": 0,
        "data.attributes.prof": 0,
        "data.attributes.spelldc": 0,
        // "data.attributes.spelllevel":  0,
        "flags.dnd5e.forceCritical": false,
        "flags.dnd5e.attackAdvantage": 0,
        "flags.dnd5e.conditions": [],
        "skills.all": 0,
        "macro.execute": "",
        "macro.itemMacro": ""
      }, { inplace: true, insertKeys: true, insertValues: true, overwrite: false });
      //@ts-ignore
      if (game.modules.get("tokenmagic")?.active) {
        _characterSpec["macro.tokenMagic"] = "";
      }


      let allSpecsTemp = flattenObject(_characterSpec)
      this.derivedSpecs = Object.keys(allSpecsTemp)
        .filter(specName => { return undefined === this.baseSpecs.find(vs => vs.fieldSpec === specName) })
        .map(spec => { 
          let vspec =  new ValidSpec(spec, allSpecsTemp[spec])
          this.derivedSpecsObj[vspec._fieldSpec] = vspec;
          return vspec;
        })
      this.allSpecs = this.baseSpecs.concat(this.derivedSpecs);
      if (game.system.id === "dnd5e") {
        let additions = [];
        // Special case for armor/hp which can depend on derived attributes - like dexterity mod or constituion mod
        // and initiative bonus depends on advantage on initiative
        this.allSpecs.forEach(m => {
          if (m._fieldSpec.includes("data.attributes.hp")) {
            m._sampleValue = 0;
          }
        });

        this.allSpecs = this.allSpecs.concat(additions);
      }
      this.allSpecs.forEach(ms => this.allSpecsObj[ms._fieldSpec] = ms);
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
function isDisabled(itemData) {
  // Get the dae flags from the item.
  const daeFlags = itemData.flags?.dae;
  if (!daeFlags) return true;
    let active = daeFlags.alwaysActive 
    || (daeFlags.activeEquipped && itemData.data.equipped)
    || (itemData.data.attuned && itemData.data.equipped)
  // warn("is disabled returning ", !active), daeFlags;
  return !active;
}


var oldPrepareData;
/*
 * Replace default appplyAffects to do value lookups
 */
function applyDaeEffects(specList) {
  // console.warn("Doing dae effects", this.effects)
  const overrides = {};
  if (this.effects.size === 0)  return this.overrides;
  const rollData = daeRollData(this);
  warn("ApplyDaeEffects: Roll data is ", rollData)
  // Organize non-disabled effects by their application priority
  const changes = this.effects.reduce((changes, e) => {
    if ( e.data.disabled ) return changes;
    let id = e.data.origin?.match(/Actor.*Item\.(.*)/);
    if (id?.length === 2) {
      const item = e.parent.items.get(id[1]);
      if (item && isDisabled(item.data) && e.data.flags?.dae?.transfer !== false) return changes;
    }
    return changes.concat(e.data.changes
      .filter(c => {
        return specList[c.key] !== undefined}
        )
      .map(c => {
        c = duplicate(c);
        if (typeof specList[c.key].sampleValue === "number" && typeof c.value === "string") {
          warn("appplyDaeEffects: Doing eval of ", c, c.value)
          c.value = new Roll(c.value, rollData).roll().total          
        }
        c.effect = e;
        c.priority = c.priority ?? (c.mode * 10);
        return c;
      }));
  }, []);
  changes.sort((a, b) => a.priority - b.priority);

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
  if (["data.traits.di.value", "data.traits.dr.value", "data.traits.dv.value"].includes(change.key)) {
    const validValues = Object.keys(CONFIG.DND5E.damageResistanceTypes);
    const current = getProperty(actor.data, change.key);
    if (current.includes(change.value)) return true;
    var value;
    if (change.value === "all") 
      value = validValues;
    else {
      if (!validValues.includes(change.value)) return;
      value = current.concat([change.value])
    }
    setProperty(actor.data, change.key, value)
    return true;
  } else if (["data.traits.di.custom", "data.traits.dr.custom", "data.traits.dv.custom"].includes(change.key)) {
    const current = getProperty(actor.data, change.key);
    let value  = current.concat(current.length === 0 ? `${change.value}` : `; ${change.value}`);
    setProperty(actor.data, change.key, value)
    return true;
  } if ("data.traits.languages.value" === change.key) {
    const validValues = Object.keys(CONFIG.DND5E.languages);
    const current = getProperty(actor.data, change.key);
    if (current.includes(change.value)) return true;
    var value;
    if (change.value === "all") 
      value = validValues;
    else {
      if (!validValues.includes(change.value)) return true;
      value = current.concat([change.value])
    }
    setProperty(actor.data, change.key, value)
    return true;
  } else if ("data.traits.languages.custom" === change.key) {
    const current = getProperty(actor.data, change.key);
    let value  = current.concat(current.length === 0 ? `${change.value}` : `; ${change.value}`);
    setProperty(actor.data, change.key, value)
    return true;
  }
}

/*
* replace the default actor prepareData
* call applyDaeEffects
* add an additional pass after derivfed data
*/
function prepareData() {
  this.data = duplicate(this._data);
  warn("prepare data: before passes", this.data)
  if (!this.data.img) this.data.img = CONST.DEFAULT_TOKEN;
  if ( !this.data.name ) this.data.name = "New " + this.entity;
  this.prepareBaseData();
  this.prepareEmbeddedEntities();
  applyDaeEffects.bind(this)(ValidSpec.baseSpecsObj);
  this.prepareDerivedData();
  applyDaeEffects.bind(this)(ValidSpec.derivedSpecsObj);
  warn("prepare data: after passes", this.data)
}

export function daeOnMacro(actor, effect) {
  warn("daeOnMacro",actor, effect)
  return daeMacro(true, actor, effect)
}
export function daeOffMacro(actor, effect) {
  warn("daeOffMacro",actor, effect)
  return daeMacro(false, actor, effect)
}
async function daeMacro(enable, actor, effect) {
  effect.changes.forEach(async change => {
    if (change.key === "macro.execute") {
      const macro = game.macros.getName(change.value[0]);
      //@ts-ignore
      macro.execute(enable ? "on" : "off", ...duplicate(change.value).splice(1))
    } else if (change.key === "macro.itemMacro") {
      let macroCommand = change.value[0];
      // macroCommand = `ChatMessage.create({content: "Item macro for ${itemData.name} called"})\n` + macroCommand;
      if (!macroCommand) {
        macroCommand = `ChatMessage.create({content: "No Item Macro for ${this.name}"})`;
        return;
      }
      let macro =  await CONFIG.Macro.entityClass.create({
        name: "DynamicEffects-Item-Macro",
        type: "script",
        img: null,
        command: macroCommand,
        flags: { "dnd5e.itemMacro": true }
      }, { displaySheet: false, temporary: true });
      macro.execute(enable ? "on" : "off", ...duplicate(change.value).splice(1));
    }
  });
  return true;
}
function daeOnTokenMagic(actor, effect) {daeTokenMagic(true, actor, effect)}
function daeOffTokenMagic(actor, effect) {daeTokenMagic(false, actor, effect)}
function daeTokenMagic(enable, actor, effect) {
 effect.changes.forEach(change=> {
    if (change.key === "macro.tokenMagic") {
      // get the token id from the effect
      let tokenId = getProperty(effect, "flags.dae.token");
      let token = canvas.tokens.get(tokenId);
      //@ts-ignore
      let tokenMagic = window.TokenMagic;
      if (tokenMagic && token && enable) {
        tokenMagic.addFilters(token, change.value);
      } else if (tokenMagic && token && !enable) {
        tokenMagic.deleteFilters(token, change.value)
      }
    }
  })
}

function daeToggleTokenMagic(...args) {
  warn("update owned item ", ...args)
  // owned item update
  // see if item active has changed
  // if yes find active effect && toggle token magic effect
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
      let macroCommand = this.data.flags?.itemacro?.macro?.data.command || "";
    case "macro.execute":
      tokenizer.tokenize(change.value, (token) => fields.push(token))
      fields = fields.map(f => {
        warn("eval args ", f, getProperty(context, f.slice(1)));
        if (f === "@scene") return canvas.scene.id;
        else if (f === "@token") return ChatMessage.getSpeaker().token;
        else if (f === "@item") return this.data;
        else if (f === "@actor") return actor.id;
        else if (f === "@spellLevel") return spellLevel;
        else if (f === "@item.level") return spellLevel;
        else if (f === "@damage") return damageTotal;
        else if (f === "@target") return "@target"
        else if (f === "@unique") return randomID();
        else if (f.startsWith("@")) {
          return getProperty(context, f.slice(1))
        }
        else return f;
      });
      if (change.key === "macro.itemMacro") {
        value = [macroCommand].concat(fields)
      } else value = fields;
      // call the macro with the right 
      break;
    default:
      if (typeof ValidSpec[change.key]?.sampleValue === "number")
        value = new Roll(change.value, context).roll().total
      else value = change.value;          
      // do a roll on the value in the context of the calling actor
      break;
  };
  warn("evalargs: change is ", change);
  return value;
}

/*
 * appply non-transfer effects to target tokens
 */
export function doEffects(item, activate, targets = undefined, { whisper = false, spellLevel = 0, damageTotal = null }) {
  applyNonTransferEffects.bind(item)(activate, targets, {whisper, spellLevel, damageTotal })
}

export function applyNonTransferEffects(activate, targets, {whisper = false, spellLevel = 0, damageTotal = null }) {
  if (!targets) return;
  let appliedEffects = duplicate(this.data.effects.filter(aeData => aeData.transfer === false))
  if (appliedEffects.length === 0) return;
  const rollData = daeRollData(this.actor)
  appliedEffects.forEach(activeEffectData => {
    activeEffectData.changes.forEach(change => {
      change.value = evalArgs.bind(this)(rollData, this.actor, change, spellLevel, damageTotal)
    })
    activeEffectData.origin = `Actor.${this.actor.id}.OwnedItem.${this.id}`;
    activeEffectData.duration.startTime = game.time.worldTime;
    activeEffectData.disabled = false;
    //@ts-ignore
    targets = Array.from(targets).map(t=>typeof t === "string" ? t : t.id);
  });
  console.error("About to call gmaction ", activate, appliedEffects, targets)
  requestGMAction(GMAction.actions.applyActiveEffects, {activate, activeEffects: appliedEffects, targets})
}
/* Transfer transferrable effects from actor to target token */

// How to do armor effects
/* Create a single actor effect with each of the item fields in it - updated when armor is equipeed/unequipped?
*/
/*
let addArmorEffect = (itemData, effectList, actor) => {
  // Special case for armor
  if (itemData.data.hasOwnProperty("armor") && hasProperty(actor.data, "data.abilities.dex")
    && acAffectingArmorTypes.includes(itemData.data.armor.type)
    && (itemData.data.equipped || itemData.data.armor.type === "natural")
  ) {
    let acValue = itemData.data.armor.value || 0;
    if (!["shield", "bonus"].includes(itemData.data.armor.type)) {
      let dexMod = itemData.data.armor.dex === 0 ? 0 : actor.data.data.abilities.dex.mod || 0;
      acValue = acValue + ([null, "", undefined].includes(itemData.data.armor.dex) ? dexMod : Math.min(itemData.data.armor.dex, dexMod));
    }
    if (itemData.data.armor.value !== 0) effectList.push(new EffectModifier("data.attributes.ac.value", ["shield", "bonus"].includes(itemData.data.armor.type) ? "+" : "=", acValue))
  }
}
*/

export function daeReadyActions() {
  ValidSpec.localizeSpecs();
  // console.warn("Specs are ", ValidSpec.allSpecs)
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
  Hooks.on("applyActiveEffect", daeCustomEffect);

  Hooks.on("preCreateActiveEffect", daeOnMacro);
  Hooks.on("preCreateActiveEffect", daeOnTokenMagic);
  Hooks.on("preDeleteActiveEffect", daeOffMacro)
  Hooks.on("preDeleteActiveEffect", daeOffTokenMagic)
  Hooks.on("preUpdateOwnedItem", daeToggleTokenMagic)
  //@ts-ignore
  tokenizer = new DETokenizeThis({
    shouldTokenize: ['(', ')', ',', '*', '/', '%', '+', '=', '!=', '!', '<', '> ', '<=', '>=', '^']
  });
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
}

export let validateDuration = (originalDuration): { units: string, value: number } => {
  if (typeof originalDuration === "string") {
    let syntheticDuration: { units: string, value: number } = { units: "", value: 0 };
    tokenizer.tokenize(originalDuration, (token) => {
      let possibleValue = parseInt(token);
      if (!isNaN(possibleValue)) {
        syntheticDuration.value = Math.abs(possibleValue);
      } else {
        if (!token.endsWith("s")) token = token.concat("s");
        let possibleUnits = ["seconds", "minutes", "hours", "days", "months", "years", "rounds", "turns"].find(u => u === token.toLocaleLowerCase())
        if (possibleUnits) syntheticDuration.units = possibleUnits;
      }
    })
    if (syntheticDuration.units === "") return { value: 0, units: "" };
    return durationUnitsMap(syntheticDuration);
  }
  let duration = duplicate(originalDuration);
  if (duration.units !== undefined && duration.value !== undefined) {
    if (duration.units === "") return { value: 0, units: "seconds" };
    if (duration.units.length > 0 && duration.units[duration.units.length - 1] !== "s") duration.units = `${duration.units}s`;
    if (!["hours", "minutes", "seconds", "years", "months", "days", "turns", "inst", "rounds"].includes(duration.units)) duration.units = "rounds";
    if (isNaN(duration.value) || duration.value < 0) duration.value = 1;
    return durationUnitsMap(duration);
  }
  return { value: 0, units: "" }
}


export let durationUnitsMap = (duration: { units: string, value: number }): { units: string, value: number } => {
  let roundDuration = aboutTimeInstalled ? game.settings.get("about-time", "seconds-per-round") : 6;
  switch (duration.units) {
    case "inst":
      duration.units = ""
      break;
    case "turns":
      duration.units = "seconds";
      duration.value = roundDuration * duration.value;
      break;
    case "rounds":
      duration.units = "seconds";
      duration.value = roundDuration * duration.value;
  }
  return duration;
}

