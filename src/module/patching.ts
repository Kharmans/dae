import { useAbilitySave,  displayTraits } from "./dae";
//@ts-ignore
// import {d20Roll} from "../../../systems/dnd5e/module/dice.js";
import { debug, log, error, warn, } from "../dae";
import { libWrapper } from "../libs/shim.js";


function rollAbilitySave(abilityId, options = { event, fastForward: null, advantage: null, disadvantage: null }) {
  const label = CONFIG.DND5E.abilities[abilityId];
    const abl = this.data.data.abilities[abilityId];

    // Construct parts
    const parts = ["@mod"];
    const data = {mod: abl.save};

/*
    // Include proficiency bonus
    if ( abl.prof > 0 ) {
      parts.push("@prof");
      //@ts-ignore
      data.prof = abl.prof;
    }
    */

    // Include a global actor ability save bonus
    const bonuses = getProperty(this.data.data, "bonuses.abilities") || {};
    if ( bonuses.save ) {
      parts.push("@saveBonus");
      //@ts-ignore
      data.saveBonus = bonuses.save;
    }

    // Add provided extra roll parts now because they will get clobbered by mergeObject below
      //@ts-ignore
      if (options.parts?.length > 0) {
      //@ts-ignore
      parts.push(...options.parts);
    }

    // Roll and return
      //@ts-ignore
      const rollData = foundry.utils.mergeObject(options, {
      parts: parts,
      data: data,
      title: game.i18n.format("DND5E.SavePromptTitle", {ability: label}),
      halflingLucky: this.getFlag("dnd5e", "halflingLucky"),
      messageData: {
      //@ts-ignore
      speaker: options.speaker || ChatMessage.getSpeaker({actor: this}),
        "flags.dnd5e.roll": {type: "save", abilityId }
      }
    });
    return d20Roll(rollData);
}

var d20Roll;
var dice;

export function patchingInitSetup() {
  warn("system is ", game.system)
  //@ts-ignore
  if (game.system.id === "dnd5e") {
    //@ts-ignore
    dice = game.dnd5e.dice;
  }
  //@ts-ignore
  else if (game.system.id === "sw5e") {
    //@ts-ignore
    dice = game.sw5e.dice;
  }
  if (!dice) console.error("Dice not defined! Many things won't work")
  else d20Roll = dice?.d20Roll;
}


export function patchGetInitiativeFormula() {
  warn("Patching Combatant getInitiativeFormula")
  //@ts-ignore Combatant
  Combatant.prototype._getInitiativeFormula = getInitiativeFormula;
}  

// Allow limited recursion of the formula replace function for things like
// bonuses.heal.damage in spell formulas.
export function replaceFormulaData(wrapped, ...args) {
  let [formula, data, {missing="", warn=false}={}] = args;
  let result = formula;
  const maxIterations = 3;
  if (typeof formula !== "string") return formula;
  for (let i = 0; i < maxIterations; i++) {
    if (!result.includes("@")) break;
    try {
      result = wrapped(result, data, {missing, warn});
    } catch(err) {
      console.error(err, ...args);
    }
  }
  return result;
}
export function updatePatches() {
  patchAbilitySave();
  patchSpecialTraits();
};

var abilitySavePatched = false;

function patchAbilitySave() {
  if (!d20Roll)
    return;
  //@ts-ignore
  if (["dnd5e", "sw5e"].includes(game.system.id)) {
    log(`Patching CONFIG.Actor.documentClass.prototype.rollAbilitySave (override=${useAbilitySave})`);
    if (!useAbilitySave) {
      if (abilitySavePatched) {
        libWrapper.unregister("dae", "CONFIG.Actor.documentClass.prototype.rollAbilitySave");
      }
    } else {
      if (!abilitySavePatched) {
        libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.rollAbilitySave", rollAbilitySave, "OVERRIDE");
      }
    }
    abilitySavePatched = useAbilitySave;
  }
};

export function patchingSetup() {
  patchAbilitySave();
  log("Patching Roll.replaceFormulaData");
  libWrapper.register("dae", "Roll.replaceFormulaData", replaceFormulaData, "MIXED");
};

var specialTraitsPatched = false;

// Patch for actor-flags app to display settings including active effects
export function patchSpecialTraits() {
  //@ts-ignore
  if ("dnd5e" === game.system.id && isNewerVersion(game.system.data.version, "1.1.0") ||
    "sw5e" === game.system.id) {
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

export function getInitiativeFormula() {
  const actor = this.actor;
  if ( !actor ) return "1d20";
  const init = actor.data.data.attributes.init;

  // Construct initiative formula parts
  let nd = 1;
  let mods = "";
  const adv = actor.getFlag("dnd5e", "initiativeAdv");
  const disadv = actor.getFlag("dnd5e", "initiativeDisadv");
  if (adv && !disadv) {
    nd = 2;
    mods = "kh";
  } else if (disadv && !adv) {
    nd = 2;
    mods = "kl";
  }
  if (actor.getFlag("dnd5e", "halflingLucky")) mods += "r1=1";

  const parts = [`${nd}d20${mods}`, init.mod, (init.prof !== 0) ? init.prof : null, (init.bonus !== 0) ? init.bonus : null];

  // Optionally apply Dexterity tiebreaker
  const tiebreaker = game.settings.get("dnd5e", "initiativeDexTiebreaker");
  if ( tiebreaker ) parts.push(actor.data.data.abilities.dex.value / 100);
  return parts.filter(p => p !== null).join(" + ");
};
