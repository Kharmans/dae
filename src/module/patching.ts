import { useAbilitySave, daeCreateActiveEffectActions, daeDeleteActiveEffectActions } from "./dae";
//@ts-ignore
// import {d20Roll} from "../../../systems/dnd5e/module/dice.js";
import { debug, log,  } from "../dae";

var oldRollAbilitySave;

function rollAbilitySave(abilityId, options={}) {
  if (!useAbilitySave) return oldRollAbilitySave.bind(this)(abilityId, options);
  const label = CONFIG.DND5E.abilities[abilityId];
  const abl = this.data.data.abilities[abilityId];
  const parts = ["@save"];
  const data = {save: abl.save}; // TP use abl.save rather than abl.mod

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
    parts: parts,
    data: data,
    title: game.i18n.format("DND5E.SavePromptTitle", {ability: label}),
    halflingLucky: this.getFlag("dnd5e", "halflingLucky"),
    messageData: {"flags.dnd5e.roll": {type: "save", abilityId }}
  });
  //@ts-ignore
  rollData.speaker = options.speaker || ChatMessage.getSpeaker({actor: this});
  //@ts-ignore
  return d20Roll(rollData);
}


var oldActorTokenHelpersDeleteEmbeddedEntity;
var oldActorTokenHelpersCreateEmbeddedEntity;

//TODO: when this Hooks.on("createActiveEffect") workds for tokens
function createEmbeddedEntity(embeddedName, data, options={}) {
  if (embeddedName === "ActiveEffect") {
    debug("Token: create Active Effect", embeddedName, data, options);
    data = data instanceof Array ? data : [data];
    if (data.length > 0) {
      daeCreateActiveEffectActions(this.token.actor, data)
    }
  }
  return oldActorTokenHelpersCreateEmbeddedEntity.bind(this)(embeddedName, data, options);
}

//TODO: when this Hooks.on("deleteActiveEffect") workds for tokens
function deleteEmbeddedEntity(embeddedName, data, options={}) {
  if (embeddedName === "ActiveEffect") {
    debug("Token: delete Active Effect", embeddedName, data, options);
    data = data instanceof Array ? data : [data];
    let effects = [];
    data.forEach(effectId => {
      let effect = this.token.actor.effects.get(effectId);
      if (effect) effects.push(effect.data);
    })
    if (effects.length > 0) {
      daeDeleteActiveEffectActions(this.token.actor, effects)
    }
  }
  return oldActorTokenHelpersDeleteEmbeddedEntity.bind(this)(embeddedName, data, options);
}

var d20Roll
export async function patchingInitSetup() {
  //TODO remove this when token create active effects calls a hook
  log("Paatching ActorTokenHelpers deleteEmbeddedEntity")
  //@ts-ignore
  oldActorTokenHelpersDeleteEmbeddedEntity = ActorTokenHelpers.prototype.deleteEmbeddedEntity;
  //@ts-ignore
  ActorTokenHelpers.prototype.deleteEmbeddedEntity = deleteEmbeddedEntity;
  log("Paatching ActorTokenHelpers createEmbeddedEntity")
  //@ts-ignore
  oldActorTokenHelpersCreateEmbeddedEntity = ActorTokenHelpers.prototype.createEmbeddedEntity;
  //@ts-ignore
  ActorTokenHelpers.prototype.createEmbeddedEntity = createEmbeddedEntity;
  console.error("system is ", game.system)
  //@ts-ignore
  let dice;
  //@ts-ignore
  if (game.system.id === "dnd5e") dice = await import("../../../systems/dnd5e/module/dice.js");
  //@ts-ignore
  else if (game.system.id === "sw5e") dice = await import("../../../systems/sw5e/module/dice.js")
  if (!dice) console.error ("Dice not defined! ")
  else  d20Roll = dice?.d20Roll;
}

export function patchingReadySetup() {
  log("Patching actor.rollAbilitySave: override default save is ", useAbilitySave)
  //@ts-ignore
  oldRollAbilitySave = CONFIG.Actor.entityClass.prototype.rollAbilitySave;
  if (oldRollAbilitySave && d20Roll) {
    //@ts-ignore
    CONFIG.Actor.entityClass.prototype.rollAbilitySave = rollAbilitySave;  
  }
};
Hooks.once("ready", () => {
  /*
  console.log("dae | Patching Roll._replaceFormulaData v0.7.0");
  //@ts-ignore
  Roll.prototype._replaceFormulaData = new Proxy(Roll.prototype._replaceFormulaData, {
    //@ts-ignore
    apply: (target, thisvalue, args) => Roll_replaceData.bind(thisvalue)(new Set(), ...args)
  });
  */
});
