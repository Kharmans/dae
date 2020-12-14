import { useAbilitySave, daeCreateActiveEffectActions, daeDeleteActiveEffectActions } from "./dae";
//@ts-ignore
// import {d20Roll} from "../../../systems/dnd5e/module/dice.js";
import { debug, log, error,  } from "../dae";

var oldRollAbilitySave;

function rollAbilitySave(abilityId, options={event, fastForward:null, advantage:null, disadvantage:null}) {
  if (!useAbilitySave) return oldRollAbilitySave.bind(this)(abilityId, options);
  const label = CONFIG.DND5E.abilities[abilityId];
  const abl = this.data.data.abilities[abilityId];

  const parts = ["@save"];
  const data = this.getRollData()
  // data = {save: abl.save}; // TP use abl.save rather than abl.mod
  data.save = abl.save;
  
  // Include a global actor ability save bonus - if it is numberic it has already been included
  const actorBonus = getProperty(this.data.data.bonuses, "abilities.save");
  //@ts-ignore
  if ( !!actorBonus && !Number.isNumeric(actorBonus)) {
    parts.push("@saveBonus");
    //@ts-ignore
    data.saveBonus = actorBonus;
  }

  // Add provided extra roll parts now because they will get clobbered by mergeObject below
  //@ts-ignore
  if (options.parts?.length > 0) {
    //@ts-ignore
    parts.push(...options.parts);
  }
  // Roll and return
  const rollData = mergeObject(options, {
    //@ts-ignore
    parts: parts,
    data: data,
    title: game.i18n.format("DND5E.SavePromptTitle", {ability: label}),
    messageData: {"flags.dnd5e.roll": {type: "save", abilityId }},
    //@ts-ignore shfitKey
    fastForward: options.fastForward || options.disadvantage || options.advantage||  (options.event?.shiftKey || options.event?.ctrlKey || options.event?.altKey || options.event?.metaKey),
    //@ts-ignore altKey
    advantage: options.advantage || options.event?.altKey,
    //@ts-ignore ctrlKey
    disadvantage: options.disadvantage || options.event?.ctrlKey || options.event?.metaKey,
  });

  //@ts-ignore
  if (game.system.id !== "sw5e") rollData.halflingLucky =  this.getFlag("dnd5e", "halflingLucky");

  //@ts-ignore
  rollData.speaker = options.speaker || ChatMessage.getSpeaker({actor: this});
  //@ts-ignore
  return d20Roll(rollData);
}

var oldRollAbilityTest;
function rollAbilityTest(abilityId, options={parts: []}) {
  const label = CONFIG.DND5E.abilities[abilityId];
  const abl = this.data.data.abilities[abilityId];

  const data = this.getRollData();
  // Construct parts
  const parts = ["@mod"];
  data.mod = abl.mod;

  // Add feat-related proficiency bonuses
  const feats = this.data.flags.dnd5e || {};
  if ( feats.remarkableAthlete && CONFIG.DND5E.characterFlags.remarkableAthlete.abilities.includes(abilityId) ) {
    parts.push("@proficiency");
    data.proficiency = Math.ceil(0.5 * this.data.data.attributes.prof);
  }
  else if ( feats.jackOfAllTrades ) {
    parts.push("@proficiency");
    data.proficiency = Math.floor(0.5 * this.data.data.attributes.prof);
  }

  // Add global actor bonus
  const bonuses = getProperty(this.data.data, "bonuses.abilities") || {};
  if ( bonuses.check ) {
    parts.push("@checkBonus");
    data.checkBonus = bonuses.check;
  }

  // Add provided extra roll parts now because they will get clobbered by mergeObject below
  if (options.parts?.length > 0) {
    parts.push(...options.parts);
  }

  // Roll and return
  const rollData = mergeObject(options, {
    parts: parts,
    //@ts-ignore
    data,
    title: game.i18n.format("DND5E.AbilityPromptTitle", {ability: label}),
    messageData: {"flags.dnd5e.roll": {type: "ability", abilityId }}
  });
   //@ts-ignore
   if (game.system.id !== "sw5e") rollData.halflingLucky = feats.halflingLucky;

  //@ts-ignore
  rollData.speaker = options.speaker || ChatMessage.getSpeaker({actor: this});
  return d20Roll(rollData);
}

var oldRollSkill;
function rollSkill(skillId, options={parts: []}) {
  const skl = this.data.data.skills[skillId];
  const bonuses = getProperty(this.data.data, "bonuses.abilities") || {};

  const data = this.getRollData();
  // Compose roll parts and data
  const parts = ["@mod"];
  data.mod = skl.mod + skl.prof;

  // Ability test bonus
  if ( bonuses.check ) {
    data["checkBonus"] = bonuses.check;
    parts.push("@checkBonus");
  }

  // Skill check bonus
  if ( bonuses.skill ) {
    data["skillBonus"] = bonuses.skill;
    parts.push("@skillBonus");
  }

  // Add provided extra roll parts now because they will get clobbered by mergeObject below
  if (options.parts?.length > 0) {
    parts.push(...options.parts);
  }

  // Reliable Talent applies to any skill check we have full or better proficiency in
  const reliableTalent = (skl.value >= 1 && this.getFlag("dnd5e", "reliableTalent"));

  // Roll and return
  const rollData = mergeObject(options, {
    parts: parts,
    //@ts-ignore
    data: data,
    title: game.i18n.format("DND5E.SkillPromptTitle", {skill: CONFIG.DND5E.skills[skillId]}),
    reliableTalent: reliableTalent,
    messageData: {"flags.dnd5e.roll": {type: "skill", skillId }}
  });
  //@ts-ignore
  if (game.system.id !== "sw5e") rollData.halflingLucky = this.getFlag("dnd5e", "halflingLucky"),

  //@ts-ignore
  rollData.speaker = options.speaker || ChatMessage.getSpeaker({actor: this});
  return d20Roll(rollData);
}

var oldActorTokenHelpersDeleteEmbeddedEntity;
var oldActorTokenHelpersCreateEmbeddedEntity;

//TODO: when this Hooks.on("createActiveEffect") workds for tokens
async function createEmbeddedEntityToken(embeddedName, data, options={}) {
  let created = await oldActorTokenHelpersCreateEmbeddedEntity.bind(this)(embeddedName, data, options);
  if (embeddedName === "ActiveEffect") {
    debug("Token: create Active Effect", embeddedName, data, options);
    data = data instanceof Array ? data : [data];

    if (data.length > 0) {
      daeCreateActiveEffectActions(this, created)
    }
  }
  return created;
}

//TODO: when this Hooks.on("deleteActiveEffect") workds for tokens
async function deleteEmbeddedEntityToken(embeddedName, data, options={}) {
    if (embeddedName === "ActiveEffect") {
    debug("Token: delete Active Effect", embeddedName, data, options);
    data = data instanceof Array ? data : [data];
    let effects = [];
    data.forEach(effectId => {
      let effect = this.effects.get(effectId);
      if (effect) effects.push(effect.data);
    })
    if (effects.length > 0) {
      daeDeleteActiveEffectActions(this, effects)
    }
  }
  return oldActorTokenHelpersDeleteEmbeddedEntity.bind(this)(embeddedName, data, options);
}

var d20Roll;
var dice;
var actorSheetFlags;

export async function patchingInitSetup() {
  
  //TODO remove this when token create active effects calls a hook
  log("Paatching ActorTokenHelpers deleteEmbeddedEntity")
  //@ts-ignore
  oldActorTokenHelpersDeleteEmbeddedEntity = ActorTokenHelpers.prototype.deleteEmbeddedEntity;
  //@ts-ignore
  ActorTokenHelpers.prototype.deleteEmbeddedEntity = deleteEmbeddedEntityToken;
  log("Paatching ActorTokenHelpers createEmbeddedEntity")
  //@ts-ignore
  oldActorTokenHelpersCreateEmbeddedEntity = ActorTokenHelpers.prototype.createEmbeddedEntity;
  //@ts-ignore
  ActorTokenHelpers.prototype.createEmbeddedEntity = createEmbeddedEntityToken;
  
  console.warn("system is ", game.system)
    //@ts-ignore
  if (game.system.id === "dnd5e") {
    //@ts-ignore
    dice = await import("../../../systems/dnd5e/module/dice.js");
    //@ts-ignore
    actorSheetFlags = await import("../../../systems/dnd5e/module/apps/actor-flags.js");
  }
  else if (game.system.id === "sw5e") {
    //@ts-ignore
    dice = await import("../../../systems/sw5e/module/dice.js")
    //@ts-ignore
    actorSheetFlags = await import("../../../systems/sw5e/module/apps/actor-flags.js");
  }
  if (!dice) console.error ("Dice not defined! Many things won't work")
  else  d20Roll = dice?.d20Roll;
}

// Allow limited recursion of the formula replace function for things like
// bonuses.heal.damage in spell formulas.
var oldReplaceFormulaData;
// function replaceFormulaData(formula, data, {missing = "", warn = false}) {
function replaceFormulaData(formula, data, {missing = "", warn=false}={missing: "", warn: false}) {
  let result = formula;
  const maxIterations = 3;
  for (let i = 0; i < maxIterations; i++) {
    if (!result.includes("@")) break;
    result = oldReplaceFormulaData.bind(this)(result, data, {missing, warn});
  }
  return result;
}

export function patchingSetup() {
  if (["dnd5e", "sw5e"].includes(game.system.id)) {
    log("Patching actor.rollAbilitySave: override default save is ", useAbilitySave)
    //@ts-ignore
    oldRollAbilitySave = CONFIG.Actor.entityClass.prototype.rollAbilitySave;
    //@ts-ignore
    oldRollAbilityTest = CONFIG.Actor.entityClass.prototype.rollAbilityTest;
    //@ts-ignore
    oldRollSkill = CONFIG.Actor.entityClass.prototype.rollSkill;
    if (useAbilitySave && d20Roll) {
      //@ts-ignore
      // CONFIG.Actor.entityClass.prototype.rollAbilityTest = rollAbilityTest;
      //@ts-ignore
      CONFIG.Actor.entityClass.prototype.rollAbilitySave = rollAbilitySave;
      //@ts-ignore
      //CONFIG.Actor.entityClass.prototype.rollSkill = rollSkill;  
    }
  }
  //@ts-ignore
  log("dae | Patching Roll.replaceFormulaData");
  //@ts-ignore
  oldReplaceFormulaData = Roll.replaceFormulaData;
  //@ts-ignore
  Roll.replaceFormulaData = replaceFormulaData;

  if (game.system.id === "dnd5e" && game.system.data.version === 0.99) {
    //@ts-ignore
    actorSheetFlags.default.prototype._updateObject = _updateObject;
  }
};

async function _updateObject(event, formData) {
  const actor = this.object;
  let updateData = expandObject(formData);

  // Unset any flags which are "false"
  let unset = false;
  const flags = updateData.flags.dnd5e;
  for ( let [k, v] of Object.entries(flags) ) {
    //@ts-ignore
    if ( [undefined, null, "", false, 0].includes(v) ) {
      delete flags[k];
      if ( hasProperty(actor.data.flags, `dnd5e.${k}`) ) {
        unset = true;
        flags[`-=${k}`] = null;
      }
    }
  }

  // Clear any bonuses which are whitespace only
  for ( let b of Object.values(updateData.data.bonuses ) ) {
    for ( let [k, v] of Object.entries(b) ) {
      b[k] = v.trim();
    }
  }

  // Diff the data against any applied overrides and apply
  await actor.update(diffObject(actor.overrides || {}, updateData), {diff: false});
}