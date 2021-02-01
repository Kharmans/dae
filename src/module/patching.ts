import { useAbilitySave, daeCreateActiveEffectActions, daeDeleteActiveEffectActions, displayTraits } from "./dae";
//@ts-ignore
// import {d20Roll} from "../../../systems/dnd5e/module/dice.js";
import { debug, log, error, warn, } from "../dae";

function rollAbilitySave(abilityId, options = { event, fastForward: null, advantage: null, disadvantage: null }) {
  const label = CONFIG.DND5E.abilities[abilityId];
  const abl = this.data.data.abilities[abilityId];

  const parts = ["@save"];
  const data = this.getRollData()
  // data = {save: abl.save}; // TP use abl.save rather than abl.mod
  data.save = abl.save;

  // Include a global actor ability save bonus - if it is numberic it has already been included
  const actorBonus = getProperty(this.data.data.bonuses, "abilities.save");
  //@ts-ignore
  if (!!actorBonus && !Number.isNumeric(actorBonus)) {
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
  const savePromptTitle = game.system.id === "dnd5e" ? "DND5E.SavePromptTitle" : "SW5E.SavePromptTitle";
  const messageData = {};
  messageData[`flags.${game.system.id}.roll`] = { type: "save", abilityId };
  // Roll and return
  const rollData = mergeObject(options, {
    //@ts-ignore
    parts: parts,
    data: data,
    title: game.i18n.format(savePromptTitle, { ability: label }),
    messageData,
    //@ts-ignore shfitKey
    fastForward: options.fastForward || options.disadvantage || options.advantage || (options.event?.shiftKey || options.event?.ctrlKey || options.event?.altKey || options.event?.metaKey),
    //@ts-ignore altKey
    advantage: options.advantage || options.event?.altKey,
    //@ts-ignore ctrlKey
    disadvantage: options.disadvantage || options.event?.ctrlKey || options.event?.metaKey,
  });

  //@ts-ignore
  if (game.system.id !== "sw5e") rollData.halflingLucky = this.getFlag("dnd5e", "halflingLucky");

  //@ts-ignore
  rollData.speaker = options.speaker || ChatMessage.getSpeaker({ actor: this });
  //@ts-ignore
  return d20Roll(rollData);
}

function rollAbilityTest(abilityId, options = { parts: [] }) {
  const label = CONFIG.DND5E.abilities[abilityId];
  const abl = this.data.data.abilities[abilityId];

  const data = this.getRollData();
  // Construct parts
  const parts = ["@mod"];
  data.mod = abl.mod;

  // Add feat-related proficiency bonuses
  const feats = this.data.flags[game.system.id] || {};
  if (feats.remarkableAthlete && CONFIG.DND5E.characterFlags.remarkableAthlete.abilities.includes(abilityId)) {
    parts.push("@proficiency");
    data.proficiency = Math.ceil(0.5 * this.data.data.attributes.prof);
  }
  else if (feats.jackOfAllTrades) {
    parts.push("@proficiency");
    data.proficiency = Math.floor(0.5 * this.data.data.attributes.prof);
  }

  // Add global actor bonus
  const bonuses = getProperty(this.data.data, "bonuses.abilities") || {};
  if (bonuses.check) {
    parts.push("@checkBonus");
    data.checkBonus = bonuses.check;
  }

  // Add provided extra roll parts now because they will get clobbered by mergeObject below
  if (options.parts?.length > 0) {
    parts.push(...options.parts);
  }

  const messageData = {};
  messageData[`flags.${game.system.id}.roll`] = { type: "ability", abilityId };
  const abilityPromptTitle = game.system.id === "dnd5e" ? "DND5E.AbilityPromptTitle" : "SW5E.AbilityPromptTitle";
  // Roll and return
  const rollData = mergeObject(options, {
    parts: parts,
    //@ts-ignore
    data,
    title: game.i18n.format(abilityPromptTitle, { ability: label }),
    messageData
  });
  //@ts-ignore
  if (game.system.id !== "sw5e") rollData.halflingLucky = feats.halflingLucky;

  //@ts-ignore
  rollData.speaker = options.speaker || ChatMessage.getSpeaker({ actor: this });
  return d20Roll(rollData);
}

function rollSkill(skillId, options = { parts: [] }) {
  const skl = this.data.data.skills[skillId];
  const bonuses = getProperty(this.data.data, "bonuses.abilities") || {};

  const data = this.getRollData();
  // Compose roll parts and data
  const parts = ["@mod"];
  data.mod = skl.mod + skl.prof;

  // Ability test bonus
  if (bonuses.check) {
    data["checkBonus"] = bonuses.check;
    parts.push("@checkBonus");
  }

  // Skill check bonus
  if (bonuses.skill) {
    data["skillBonus"] = bonuses.skill;
    parts.push("@skillBonus");
  }

  // Add provided extra roll parts now because they will get clobbered by mergeObject below
  if (options.parts?.length > 0) {
    parts.push(...options.parts);
  }

  // Reliable Talent applies to any skill check we have full or better proficiency in
  const reliableTalent = (skl.value >= 1 && this.getFlag(game.system.id, "reliableTalent"));

  const messageData = {};
  messageData[`flags.${game.system.id}.roll`] = { type: "skill", skillId };
  const skillPromptTitle = game.system.id === "dnd5e" ? "DND5E.SkillPromptTitle" : "SW5E.SkillPromptTitle";
  // Roll and return
  const rollData = mergeObject(options, {
    parts: parts,
    //@ts-ignore
    data: data,
    title: game.i18n.format(skillPromptTitle, { skill: CONFIG.DND5E.skills[skillId] }),
    reliableTalent: reliableTalent,
    messageData
  });
  //@ts-ignore
  if (game.system.id === "dnd5e") rollData.halflingLucky = this.getFlag("dnd5e", "halflingLucky"),

    //@ts-ignore
    rollData.speaker = options.speaker || ChatMessage.getSpeaker({ actor: this });
  return d20Roll(rollData);
}

//TODO: when this Hooks.on("createActiveEffect") works for tokens
async function createEmbeddedEntityToken(wrapped, ...args) {
  let [embeddedName, data, options = {}] = args;
  let created = await wrapped(...args);
  if (embeddedName === "ActiveEffect") {
    debug("Token: create Active Effect", embeddedName, data, options);
    data = data instanceof Array ? data : [data];
    if (data.length > 0) {
      await daeCreateActiveEffectActions(this, created)
    }
  }
  return created;
}

//TODO: when this Hooks.on("deleteActiveEffect") workds for tokens
async function deleteEmbeddedEntityToken(wrapped, ...args) {
  let [embeddedName, data, options = {}] = args;
  if (embeddedName === "ActiveEffect") {
    debug("Token: delete Active Effect", embeddedName, data, options);
    data = data instanceof Array ? data : [data];
    let effects = [];
    data.forEach(effectId => {
      let effect = this.effects.get(effectId);
      if (effect) effects.push(effect.data);
    })
    if (effects.length > 0) {
      await daeDeleteActiveEffectActions(this, effects)
    }
  }
  return await wrapped(...args);
}

var d20Roll;
var dice;

export async function patchingInitSetup() {
  //TODO remove this when token create active effects calls a hook
  log("Patching ActorTokenHelpers.prototype.deleteEmbeddedEntity");
  log("Patching ActorTokenHelpers.prototype.createEmbeddedEntity");
  //@ts-ignore
  if (game.modules.get("lib-wrapper")?.active && false) {
    // ignored at the momemnt because of the way these are setup on the tokens themselves.
    //@ts-ignore
    libWrapper.register("dae", "ActorTokenHelpers.prototype.deleteEmbeddedEntity", deleteEmbeddedEntityToken, "WRAPPER");
    //@ts-ignore
    libWrapper.register("dae", "ActorTokenHelpers.prototype.createEmbeddedEntity", createEmbeddedEntityToken, "WRAPPER");

  } else {
    //@ts-ignore
    const oldActorTokenHelpersDeleteEmbeddedEntity = ActorTokenHelpers.prototype.deleteEmbeddedEntity;
    //@ts-ignore
    ActorTokenHelpers.prototype.deleteEmbeddedEntity = function () {
      return deleteEmbeddedEntityToken.call(this, oldActorTokenHelpersDeleteEmbeddedEntity.bind(this), ...arguments);
    };
    //@ts-ignore
    const oldActorTokenHelpersCreateEmbeddedEntity = ActorTokenHelpers.prototype.createEmbeddedEntity;
    //@ts-ignore
    ActorTokenHelpers.prototype.createEmbeddedEntity = function () {
      return createEmbeddedEntityToken.call(this, oldActorTokenHelpersCreateEmbeddedEntity.bind(this), ...arguments);
    };
  }

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

// Allow limited recursion of the formula replace function for things like
// bonuses.heal.damage in spell formulas.
function replaceFormulaData(wrapped, formula, ...args) {
  let result = formula;
  const maxIterations = 3;
  for (let i = 0; i < maxIterations; i++) {
    if (!result.includes("@")) break;
    result = wrapped(result, ...args);
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
    log(`Patching CONFIG.Actor.entityClass.prototype.rollAbilitySave (override=${useAbilitySave})`);
    if (!useAbilitySave) {
      if (abilitySavePatched) {
        //@ts-ignore
        if (game.modules.get("lib-wrapper")?.active) {
          //@ts-ignore
          libWrapper.unregister("dae", "CONFIG.Actor.entityClass.prototype.rollAbilitySave");
          //@ts-ignore
          // libWrapper.unregister("dae", "CONFIG.Actor.entityClass.prototype.rollAbilityTest");
          //@ts-ignore
          // libWrapper.unregister("dae", "CONFIG.Actor.entityClass.prototype.rollSkill");
        } else {
          window.location.reload();
        }
      }
    } else {
      if (!abilitySavePatched) {
        //@ts-ignore
        if (game.modules.get("lib-wrapper")?.active) {
          //@ts-ignore
          libWrapper.register("dae", "CONFIG.Actor.entityClass.prototype.rollAbilitySave", rollAbilitySave, "OVERRIDE");
          //@ts-ignore
          // libWrapper.register("dae", "CONFIG.Actor.entityClass.prototype.rollAbilityTest", rollAbilityTest, "OVERRIDE");
          //@ts-ignore
          // libWrapper.register("dae", "CONFIG.Actor.entityClass.prototype.rollSkill", rollSkill, "OVERRIDE");
        } else {
          //@ts-ignore
          CONFIG.Actor.entityClass.prototype.rollAbilitySave = rollAbilitySave;
          //@ts-ignore
          // CONFIG.Actor.entityClass.prototype.rollAbilityTest = rollAbilityTest;
          //@ts-ignore
          // CONFIG.Actor.entityClass.prototype.rollSkill = rollSkill;
        }
      }
    }
    abilitySavePatched = useAbilitySave;
  }
};

export function patchingSetup() {
  patchAbilitySave();

  //@ts-ignore
  log("Patching Roll.replaceFormulaData");
  //@ts-ignore
  if (game.modules.get("lib-wrapper")?.active) {
    //@ts-ignore
    libWrapper.register("dae", "Roll.replaceFormulaData", replaceFormulaData, "MIXED");
  } else {
    //@ts-ignore
    const oldReplaceFormulaData = Roll.replaceFormulaData;
    //@ts-ignore
    Roll.replaceFormulaData = function () {
      return replaceFormulaData.call(this, oldReplaceFormulaData.bind(this), ...arguments);
    };
  }
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
        //@ts-ignore
        if (game.modules.get("lib-wrapper")?.active) {
          //@ts-ignore
          libWrapper.unregister("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._updateObject`);
          //@ts-ignore
          libWrapper.unregister("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getFlags`);
          //@ts-ignore
          libWrapper.unregister("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getBonuses`);
        } else {
          window.location.reload();
        }
      }
    } else {
      if (!specialTraitsPatched) {
        //@ts-ignore
        if (game.modules.get("lib-wrapper")?.active) {
          //@ts-ignore
          libWrapper.register("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._updateObject`, _updateObject, "OVERRIDE");
          //@ts-ignore
          libWrapper.register("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getFlags`, _getFlags[game.system.id], "OVERRIDE");
          //@ts-ignore
          libWrapper.register("dae", `game.${game.system.id}.applications.ActorSheetFlags.prototype._getBonuses`, _getBonuses[game.system.id], "OVERRIDE");
        } else {
          //@ts-ignore
          const actorSheetFlags = game[game.system.id].applications.ActorSheetFlags;
          actorSheetFlags.prototype._updateObject = _updateObject;
          actorSheetFlags.prototype._getFlags = _getFlags[game.system.id];
          actorSheetFlags.prototype._getBonuses = _getBonuses[game.system.id];
        }
      }
    }
    specialTraitsPatched = displayTraits;
  }
}

const _getBonuses = { "dnd5e": _getBonusesdnd5e, "sw5e": _getBonusessw5e };
const _getFlags = { "dnd5e": _getFlagsdnd5e, "sw5e": _getFlagssw5e };

function _getFlagsdnd5e() {
  const flags = {};
  const baseData = this.entity.data;
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
  const baseData = this.entity.data;
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

  // console.error(actor.overrides, updateData)
  // Diff the data against any applied overrides and apply
  await actor.update(diffObject(actor.overrides || {}, updateData), { diff: false });
}