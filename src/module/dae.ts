import { applyActiveEffects, socketlibSocket } from "./GMAction";
import { warn, error, debug, setDebugLevel, i18n, timelog, changesQueue, daeSpecialDurations } from "../dae";
import { ActiveEffects } from "./apps/ActiveEffects";
import { DAEActiveEffectConfig } from "./apps/DAEActiveEffectConfig";
import { macroActorUpdate } from "./daeMacros";
import { ValidSpec } from "./Systems/DAESystem";
import { DAESystemDND5E } from "./Systems/DAEdnd5e";
import { DAESystemSW5E } from "./Systems/DAEsw5e";

let templates = {};

export var aboutTimeInstalled = false;
export var timesUpInstalled = false;
export var simpleCalendarInstalled = false;
export var requireItemTarget = true;
export var cubActive;
export var ceActive;
export var atlActive;
export var furnaceActive;
export var itemacroActive;
export var midiActive;
export var statusCounterActive;
export var debugEnabled;
// export var useAbilitySave;
export var activeConditions;
export var confirmDelete;
export var ehnanceStatusEffects;
export var expireRealTime
export var noDupDamageMacro;
export var disableEffects;
export var daeTitleBar;
export var daeNoTitleText;
export var libWrapper;
export var needStringNumericValues;
export var actionQueue;
export var linkedTokens;

export var allMacroEffects = ["macro.execute", "macro.execute.local", "macro.execute.GM", "macro.itemMacro", "macro.itemMacro.local", "macro.itemMacro.GM", "macro.actorUpdate"];
export var macroDestination = {
  "macro.execute": "mixed",
  "macro.execute.local": "local",
  "macro.execute.GM": "GM",
  "macro.itemMacro": "mixed",
  "macro.itemMacro.local": "local",
  "macro.itemMacro.GM": "GM",
  "macro.actorUpdate": "local"
};
export var daeSystemClass;
if (!globalThis.daeSystems) globalThis.daeSystems = {};

// export var showDeprecation = true;
export var showInline = false;

let debugLog = true;


function flagChangeKeys(actor, change) { // this id dnd5e only and should be moved
  if (!(["dnd5e", "sw5e"].includes(game.system.id))) return;
  const hasSaveBonus = change.key.startsWith("data.abilities.") && change.key.endsWith(".save") && !change.key.endsWith(".bonuses.save");
  if (hasSaveBonus) {
    const saveBonus = change.key.match(/data.abilities.(\w\w\w).save/);
    const abl = saveBonus[1];
    console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use system.abilities.${abl}.bonuses.save instead`)
    // change.key = `data.abilities.${abl}.bonuses.save`;
    return;
  }
  const hasCheckBonus = change.key.startsWith("data.abilities.") && change.key.endsWith(".mod");
  if (hasCheckBonus) {
    const checkBonus = change.key.match(/data.abilities.(\w\w\w).mod/);
    const abl = checkBonus[1];
    console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use syatem.abilities.${abl}.bonuses.check instead`)
    // change.key = `data.abilities.${abl}.bonuses.check`;
    return;
  }
  const hasSkillMod = change.key.startsWith("data.skills") && change.key.endsWith(".mod");
  if (hasSkillMod) {
    const skillMod = change.key.match(/data.skills.(\w\w\w).mod/);
    const abl = skillMod[1];
    console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use syatem.skills.${abl}.bonuses.check instead`)
    // change.key = `data.skills.${abl}.bonuses.check`;
    return;
  }
  const hasSkillPassive = change.key.startsWith("data.skills.") && !change.key.endsWith(".bonuses.passive") && change.key.endsWith(".passive");
  if (hasSkillPassive) {
    const skillPassive = change.key.match(/data.skills.(\w\w\w).passive/);
    const abl = skillPassive[1];
    console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use syatem.skills.${abl}.bonuses.passive instead`)
    // change.key = `data.dkills.${abl}.bonuses.passive`;
    return;
  }

  const hasSkillBonus = change.key.startsWith("flags.skill-customization-5e");
  if (hasSkillBonus) {
    const skillPassive = change.key.match(/lags.skill-customization-5e.(\w\w\w).skill-bonus/);
    const abl = skillPassive[1];
    console.error(`dae | deprecated change key ${change.key} found in ${actor.name} use syatem.skills.${abl}.bonuses.check instead`)
    // change.key = `data.dkills.${abl}.bonuses.passive`;
    return;
  }
}


/*
 * Replace default appplyAffects to do value lookups
 */
export function applyDaeEffects(specList, completedSpecs, allowAllSpecs: boolean) {
  if (disableEffects) return;
  const overrides = {};
  if (!this.effects || this.effects.size === 0) return this.overrides || {};
  // Organize non-disabled effects by their application priority
  const changes = this.effects.reduce((changes, effect) => {
    if (daeSystemClass.effectDisabled(this, effect)) return changes;
    // TODO find a solution for flags.? perhaps just a generic speclist
    return changes.concat(expandEffectChanges(effect.changes)
      .filter(c => {
        return !completedSpecs[c.key] && (allowAllSpecs || specList[c.key] !== undefined) && !c.key.startsWith("ATL.")
      })
      .map(c => {
        c = duplicate(c);
        flagChangeKeys(this, c);
        if (c.key.startsWith("flags.midi-qol.optional")) { // patch for optional effects
          const parts = c.key.split(".");
          if (["save", "check", "skill", "damage", "attack"].includes(parts[parts.length - 1])) {
            console.error(`dae/midi-qol | deprecation error ${c.key} should be ${c.key}.all on actor ${this.name}`)
            c.key = `${c.key}.all`;
          }
        }
        if (c.key === "flags.midi-qol.OverTime") c.key = `flags.midi-qol.OverTime.${randomID()}`;
        c.effect = effect;
        c.priority = c.priority ?? (c.mode * 10);
        return c;
      }));
  }, []);
  changes.sort((a, b) => a.priority - b.priority);
  if (changes.length > 0) debug("Applying effect ", this.name, changes)
  // Apply all changes
  for (let c of changes) {
    //TODO remove @data sometime
    if (typeof c.value === "string" && c.value.includes("@data.")) {
      console.warn("dae | @data.key is deprecated, use @key instead", c.value)
      c.value = c.value.replace(/@data./g, "@");
    }
    const stackCount = c.effect.flags?.dae?.stacks ?? c.effect.flags?.dae?.statuscounter?.counter.value ?? 1;
    //@ts-ignore
    if (typeof specList[c.key]?.sampleValue !== "number" || c.mode === CONST.ACTIVE_EFFECT_MODES.CUSTOM)
      c.value = c.value.replace("@stackCount", stackCount)

    //@ts-ignore
    if (c.mode !== CONST.ACTIVE_EFFECT_MODES.CUSTOM) {
      if (typeof specList[c.key]?.sampleValue === "number" && typeof c.value === "string") {
        debug("appplyDaeEffects: Doing eval of ", c, c.value);
        const rollData = this.getRollData();

        rollData.stackCount = stackCount;
        c.value = c.value.replace("@item.level", "@itemLevel");
        //@ts-ignore replaceFormulaData
        let value = Roll.replaceFormulaData(c.value, rollData, { missing: 0, warn: false });
        try { // Roll parser no longer accepts some expressions it used to so we will try and avoid using it
          if (needStringNumericValues) {
            //@ts-ignore - this will throw an error if there are roll expressions
            c.value = `${Roll.safeEval(value)}`;
          } else {
            //@ts-ignore
            c.value = Roll.safeEval(value);
          }
        } catch (err) { // safeEval failed try a roll
          try {
            console.warn("dae | you are using dice expressions in a numeric field this will be disabled eventually")
            console.warn(`Actor ${this.name} ${this.uuid} Change is ${c.key}: ${c.value}`)
            //@ts-ignore evaluate - TODO work out how to do this async
            c.value = `${new Roll(value).evaluate({ async: false }).total}`;
          } catch (err) {
            console.warn("change value calculation failed for", this, c);
            console.warn(err)
          }
        }
      }
    }
    const currentValue = getProperty(this, c.key);
    if (typeof ValidSpec.specs[this.type].allSpecsObj[c.key]?.sampleValue === "number" && typeof currentValue !== "number") {
      //@ts-ignore coerce the value to a number
      const guess = Number.fromString ? Number.fromString(currentValue || "0") : Number(currentValue) || "0";
      if (!Number.isNaN(guess)) setProperty(this, c.key, guess);
      else setProperty(this, c.key, 0);
    }
    const result = c.effect.apply(this, c);
    if (result !== null) overrides[c.key] = result;
  }

  // Expand the set of final overrides
  this.overrides = mergeObject(this.overrides || {}, expandObject(overrides) || {}, { inplace: true, overwrite: true });
}

function expandEffectChanges(changes) {
  let returnChanges = changes.reduce((list, change) => {
    if (!daeSystemClass.bonusSelectors[change.key]) {
      list.push(change);
    } else {
      const attacks = daeSystemClass.bonusSelectors[change.key].attacks;
      const selector = daeSystemClass.bonusSelectors[change.key].selector;
      attacks.forEach(at => {
        const c = duplicate(change);
        c.key = `system.bonuses.${at}.${selector}`;
        list.push(c);
      });
    }
    return list;
  }, [])
  return returnChanges;
}

/*
export function replaceAtFields(value, context, options: { blankValue: any | number, maxIterations: number } = { blankValue: "", maxIterations: 4 }) {
  if (typeof value !== "string") return value;
  let count = 0;
  if (!value.includes("@")) return value;
  // let re = /@(\w|\.|\-)+/g
  let re = /@(\w|\.|(\-(?=([A-Za-z-_]))))+/g
  let result = duplicate(value);
  result = result.replace("@item.level", "@itemLevel") ;// fix for outdated item.level
  // Remove @data references allow a little bit of recursive lookup
  do {
    count += 1;
    for (let match of result.match(re) || []) {
      result = result.replace(match.replace("@data.", "@"), getProperty(context, match.slice(1)) ?? options.blankValue)
    }
  } while (count < options.maxIterations && result.includes("@"));
  return result;
}
*/
async function addTokenMagicChange(actor, change, tokens) {
  const tokenMagic = globalThis.TokenMagic;
  if (!tokenMagic) return;
  for (let token of tokens) {
    if (token.object) token = token.object; // in case we have a token document
    const tokenUuid = token.document.uuid;
    // Put this back if TMFX does awaited calls
    // await actionQueue.add(tokenMagic.addFilters, token, change.value); - see if gm execute solve problem
    actionQueue.add(socketlibSocket.executeAsGM.bind(socketlibSocket), "applyTokenMagic", { tokenUuid, effectId: change.value })
  }
}

async function removeTokenMagicChange(actor, change, tokens) {
  const tokenMagic = globalThis.TokenMagic;
  if (!tokenMagic) return;
  for (let token of tokens) {
    if (token.object) token = token.object; // in case we have a token document
    // put this back if TMFX does awaited calls
    // await actionQueue.add(tokenMagic.deleteFilters, token, change.value);
    const tokenUuid = token.document.uuid;
    actionQueue.add(socketlibSocket.executeAsGM.bind(socketlibSocket), "removeTokenMagic", { tokenUuid, effectId: change.value })
  }
}

function removeConvenientEffectsChange(effectName: string, uuid: string, origin, metaData: {} = {}) {
  const ceInterface = game?.dfreds?.effectInterface;
  if (ceInterface) actionQueue.add(ceInterface.removeEffect.bind(ceInterface), { effectName, uuid, origin, metaData })
}

function addConvenientEffectsChange(effectName: string, uuid: string, origin, metaData: {} = {}) {
  const ceInterface = game?.dfreds?.effectInterface;
  actionQueue.add(ceInterface.addEffect.bind(ceInterface), { effectName, uuid, origin, metaData })
}
function addCubChange(conditionName, tokens: [Token], options = {}) {
  const cubInterface = game?.cub;
  if (cubInterface?.enhancedConditions.supported) actionQueue.add(cubInterface.addCondition, conditionName, tokens);
}
function removeCubChange(conditionName, tokens: [Token], options = {}) {
  const cubInterface = game?.cub;
  if (cubInterface?.enhancedConditions.supported) actionQueue.add(cubInterface.removeCondition, conditionName, tokens, options);
}

function prepareLastArgData(effect, actor: Actor, lastArgOptions: {} = {}) {
  if (!effect.changes) return effect;
  let tokenUuid;
  if (actor.token) tokenUuid = actor.token.uuid;
  else {
    const selfTarget = getSelfTarget(actor);
    if (selfTarget.document) tokenUuid = selfTarget.document.uuid;
    else tokenUuid = selfTarget.uuid;
  }
  let lastArg = mergeObject(lastArgOptions, {
    //@ts-ignore - undefined fields
    effectId: effect.id,
    origin: effect.origin,
    efData: effect.toObject(),
    actorId: actor.id,
    actorUuid: actor.uuid,
    tokenId: actor.token ? actor.token.id : getSelfTarget(actor)?.id,
    tokenUuid,
  }, { overwrite: false, insertKeys: true, insertValues: true, inplace: false });
  return lastArg;
}

function _onCreateActiveEffect(...args) {
  let [effect, options, userId] = args;
  if (userId !== game.user.id) return true;
  const parent = effect.parent;
  //@ts-ignore documentClass TODO
  if (!parent || !(parent instanceof CONFIG.Actor.documentClass)) return true;
  const actor = parent;
  const tokens = parent.isToken ? [parent.token.object] : parent.getActiveTokens();
  const token = tokens[0];
  effect.determineSuppression && effect.determineSuppression();
  if (effect.changes && !effect.disabled && !effect.isSuppressed) {
    let changeLoop = async () => {
      try {
        for (let change of effect.changes) {
          if (cubActive && change.key === "macro.CUB" && token) {
            addCubChange(change.value, [token])
            // await game.cub.addCondition(change.value, [token]);
          }
          if (ceActive && change.key === "macro.CE") {
            const lastArg = prepareLastArgData(effect, actor)
            addConvenientEffectsChange(change.value, actor.uuid, effect.origin, lastArg);
            //@ts-ignore
            // await game.dfreds.effectInterface?.addEffect({ effectName: change.value, uuid: parent.uuid, origin: effect.origin });
          }
          const tokenMagic = globalThis.TokenMagic;
          if (tokenMagic && change.key === "macro.tokenMagic" && token)
            addTokenMagicChange(parent, change, tokens); //TODO check disabled
        }
        if (effect.changes.some(change => change.key.startsWith("macro.execute") || change.key.startsWith("macro.itemMacro") || change.key.startsWith("macro.actorUpdate")))
          actionQueue.add(daeMacro, "on", parent, effect.toObject(), {}); // TODO revisit to see if passing the effect is ok

      } catch (err) {
        console.warn("dae | create effect error", err);
      } finally {
        return true;
      }
    };
    changeLoop();
  }
  return true;
}

function preCreateActiveEffectHook(candidate, data, options, user) {
  const actor: any = candidate.parent;
  // TODO remove the isToken check if and when core does not break for this

  //@ts-ignore
  if (!(actor instanceof CONFIG.Actor.documentClass) || actor.isToken) return true;
  candidate.updateSource({ "flags.dae.transfer": data.transfer });
  if (getProperty(candidate, "flags.dae.stackable") === undefined) candidate.updateSource({ "flags.dae.stackable": "multi" });
  const stackable = getProperty(candidate, "flags.dae.stackable");
  if (getProperty(candidate, "flags.dae.transfer") && ["noneName", "none"].includes(stackable)) {
    const parent = candidate.parent;
    if (!parent) return true;
    const hasExisting = parent.effects.filter(ef => {
      switch (stackable) {
        case "noneName":
          return ef.label === candidate.label
        case "none":
          return candidate.origin && ef.origin === candidate.origin;
      }
    });
    if (hasExisting.length === 0) return true;
    hasExisting.forEach(existingEffect => actionQueue.add(existingEffect.delete.bind(existingEffect)));
    return true;
  }
  if (getProperty(candidate, "flags.dae.stackable") !== "noneName") return true;
  if (actor.effects.contents.some(ef => ef.label === candidate.label)) {
    return false;
  }
  return true;
}

async function _preCreateActiveEffect(wrapped, ...args) {
  const parent = this.parent;
  let [data, options, user] = args;
  try {
    //@ts-ignore documentClass TODO
    // if (!parent) return wrapped(...args);

    if (!parent || !(parent instanceof CONFIG.Actor.documentClass)) return wrapped(...args);

    let updates = {};

    if (this.origin === parent.uuid) {
      updates = { "flags.dae.transfer": this.transfer || data.transfer };
    }

    //@ts-ignore documentClass 
    if (this.flags?.dae?.durationExpression && parent instanceof CONFIG.Actor.documentClass) {
      let sourceActor = parent;
      if (!this.transfer) {
        const thing = await fromUuid(this.origin);
        //@ts-ignore
        if (thing?.actor) sourceActor = thing.actor;
      }
      //@ts-ignore roll(argument)
      const theDuration = await new Roll(`${this.flags.dae.durationExpression}`, sourceActor.getRollData()).roll({ async: true });
      //@ts-ignore turnData.actor
      const inCombat = game.combat?.turns?.some(turnData => turnData.actor?.uuid === parent.uuid);

      if (inCombat) {
        updates["duration.rounds"] = Math.floor(theDuration.total / CONFIG.time.roundTime + 0.5);
        updates["duration.seconds"] = null;
      } else updates["duration.seconds"] = theDuration.total;
    }
    let changesChanged = false;
    let newChanges = [];
    for (let change of this.changes) {
      let inline = typeof change.value === "string" && change.value.includes("[[");
      if (change.key === "StatusEffect") {
        const statusEffect = CONFIG.statusEffects.find(se => se.id === change.value);
        if (statusEffect) {
          newChanges = statusEffect.changes ? newChanges.concat(statusEffect.changes) : newChanges;
          updates["icon"] = statusEffect.icon;
          updates["label"] = i18n(statusEffect.label);
          changesChanged = true;
          updates["flags.core.statusId"] = statusEffect.id;
          if (statusEffect.flags?.isConvenient) updates["flags.isConvenient"] = true;
        }
      } else if (change.key === "StatusEffectLabel") {
        updates["label"] = change.value;
      } else if (inline) {
        const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;
        const newChange = duplicate(change);
        changesChanged = true;
        for (let match of change.value.matchAll(rgx)) {
          if (!match[1]) {
            const newValue = await evalInline(match[2], this.parent, this);
            newChange.value = newChange.value.replace(match[0], `${newValue}`);
          }
        }
        newChanges.push(newChange);
      } else newChanges.push(change);
    }
    if (changesChanged) updates["changes"] = newChanges;
    this.updateSource(updates);
  } catch (err) {
    console.warn("dae | create effect error", err);
  } finally {
    let result = wrapped(...args);
    return result;
  }
}

async function evalInline(expression: string, actor: Actor, effect) {
  try {
    //@ts-ignore
    expression = expression.replaceAll("@data.", "@");
    const roll = await (new Roll(expression, actor?.getRollData())).roll();
    if (showInline) {
      roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${effect.label} ${expression}`, chatMessage: true })
    }
    return `${roll.total}`;
  } catch (err) {
    console.warn(`dae | evaluate args error: rolling ${expression} failed`);
    return "0";
  }
}

export function _onUpdateActiveEffect(...args) {
  let [effect, changes, options, userId] = args;
  if (userId !== game.user.id) return true;
  const parent = effect.parent;
  //@ts-ignore documentClass TODO
  if (!parent || !(parent instanceof CONFIG.Actor.documentClass)) return true;

  let changeLoop = async () => {
    try {
      // const item = await fromUuid(effect.origin);
      const tokens = parent.isToken ? [parent.token.object] : parent.getActiveTokens();
      const token = tokens[0];
      if (effect.determineSuppression) effect.determineSuppression();
      // Just deal with equipped etc
      warn("add active effect actions", parent, changes)
      if (effect.changes) {
        const tokenMagic = globalThis.TokenMagic;
        if (changes.disabled === true) {
          for (let change of effect.changes) {
            if (token && cubActive && change.key === "macro.CUB") {
              removeCubChange(change.value, [token], { warn: false });
            }
            if (ceActive && change.key === "macro.CE") {
              const lastArg = prepareLastArgData(effect, parent);
              removeConvenientEffectsChange(change.value, parent.uuid, undefined, lastArg);
            }
            if (token && tokenMagic && change.key === "macro.tokenMagic") removeTokenMagicChange(parent, change, tokens);
          }
          if (effect.changes.some(change => change.key.startsWith("macro.execute") || change.key.startsWith("macro.itemMacro") || change.key.startsWith("macro.actorUpdate")))
            actionQueue.add(daeMacro, "off", parent, effect.toObject(), {});

        } else if (changes.disabled === false && !effect.isSuppressed) {
          for (let change of effect.changes) {
            if (token && cubActive && change.key === "macro.CUB") {
              addCubChange(change.value, [token])
            }
            if (ceActive && change.key === "macro.CE") {
              const lastArg = prepareLastArgData(effect, parent)
              addConvenientEffectsChange(change.value, parent.uuid, undefined, lastArg);
            }
            if (token && tokenMagic && change.key === "macro.tokenMagic") addTokenMagicChange(parent, change, tokens);
          }
          if (effect.changes.some(change => change.key.startsWith("macro.execute") || change.key.startsWith("macro.itemMacro") || change.key.startsWith("macro.actorUpdate")))
            actionQueue.add(daeMacro, "on", parent, effect.toObject(), {});
        }
      }
    } catch (err) {
      console.warn("dae | updating active effect error", err)
    } finally {
      return true;
    }
  };
  changeLoop();

  return true;
}

export async function _preUpdateActiveEffect(wrapped, updates, options, user) {
  const parent = this.parent;
  //@ts-ignore documentClass TODO
  if (!parent || !(parent instanceof CONFIG.Actor.documentClass)) {
    return wrapped(updates, options, user);
  }

  try {
    const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;
    for (let change of updates.changes ?? []) {
      let inline = typeof change.value === "string" && change.value.includes("[[");
      if (inline) {
        const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;
        let newChangeValue = duplicate(change.value);
        for (let match of change.value.matchAll(rgx)) {
          if (!match[1]) {
            const newValue = await evalInline(match[2], this.parent, this);
            newChangeValue = newChangeValue.replace(match[0], `${newValue}`);
          }
        }
        change.value = newChangeValue
      };
    }
  } catch (err) {
    console.warn(`dae | update active effect Actor ${parent.name}, Effect ${this.label}`, updates, err);
  } finally {
    return wrapped(updates, options, user);
  }
}

export function _onDeleteActiveEffect(...args) {
  let [effect, options, userId] = args;
  if (game.user.id !== userId) return true;
  //@ts-ignore documentClass
  if (!(effect.parent instanceof CONFIG.Actor.documentClass)) return true;
  const actor = effect.parent;
  const tokens = actor.token ? [actor.token] : actor.getActiveTokens();
  const token = tokens[0];
  const tokenMagic = globalThis.TokenMagic;

  let changesMade = false;

  let changesLoop = async () => {
    try {
      let entityToDelete;
      if (effect.changes) {
        for (let change of effect.changes) {
          if (token && tokenMagic && change.key === "macro.tokenMagic") await removeTokenMagicChange(actor, change, tokens)
          if (ceActive && change.key === "macro.CE") {
            const lastArg = prepareLastArgData(effect, actor)
            removeConvenientEffectsChange(change.value, actor.uuid, undefined, lastArg);
          }
          if (token && cubActive && change.key === "macro.CUB") {
            removeCubChange(change.value, [token]);
          }
          if (change.key === "flags.dae.deleteUuid" && change.value) {
            socketlibSocket.executeAsGM("deleteUuid", { uuid: change.value })
          }
          if (change.key === "flags.dae.deleteOrigin") entityToDelete = effect.origin;

        }
        if (effect.changes.some(change => change.key.startsWith("macro.execute") || change.key.startsWith("macro.itemMacro") || change.key.startsWith("macro.actorUpdate")))
          actionQueue.add(daeMacro, "off", actor, effect.toObject(), options);

        if (entityToDelete) socketlibSocket.executeAsGM("deleteUuid", { uuid: entityToDelete })
      }
      if (effect.origin) {
        let origin: any = await fromUuid(effect.origin);
        // Remove the associated animation if the origin points to the actor or if the items parent is the effects parent
        // Covers the spirit guardian case where all the aura's point back to the source item.
        if (globalThis.Sequencer && (origin === effect.parent || origin?.parent === effect.parent))
          globalThis.Sequencer.EffectManager.endEffects({ origin: effect.origin });
        if (canvas?.scene && (origin === effect.parent || origin?.parent === effect.parent)) {
          const removeTiles = canvas.scene.tiles.filter(tile => tile.flags?.autoanimations?.origin === effect.origin).map(tile=>tile.id);
          // if (removeTiles.length > 0) await canvas.Scene.deleteEmbeddedDocuments("Tile", removeTiles);
        }
      }

    } catch (err) {
      console.warn("dae | error deleting active effect ", err);
    }
  };
  changesLoop();
  return true;
}

export async function _preDeleteActiveEffect(wrapped, ...args) {
  //@ts-ignore documentClass
  return wrapped(...args);
}

export function getSelfTarget(actor) {
  if (actor.token) return actor.token;
  const speaker = ChatMessage.getSpeaker({ actor })
  if (speaker.token) return canvas.tokens.get(speaker.token);
  //@ts-ignore this is a token document not a token ??
  return new CONFIG.Token.documentClass(actor.getTokenData(), { actor });
}

export async function daeMacro(action: string, actor, effectData, lastArgOptions = {}) {
  let result;
  let effects
  let selfTarget;
  // Work out what itemdata should be
  warn("Dae macro ", action, actor, effectData, lastArgOptions)
  if (!effectData.changes) return effectData;
  let tokenUuid;
  if (actor.token) {
    tokenUuid = actor.token.uuid;
    selfTarget = actor.token;
  }
  else {
    selfTarget = getSelfTarget(actor);
    tokenUuid = selfTarget.uuid ?? selfTarget.document.uuid;
  }
  let lastArg = mergeObject(lastArgOptions, {
    //@ts-ignore - undefined fields
    effectId: effectData._id,
    origin: effectData.origin,
    efData: effectData,
    actorId: actor.id,
    actorUuid: actor.uuid,
    tokenId: selfTarget.id,
    tokenUuid,
  }, { overwrite: false, insertKeys: true, insertValues: true, inplace: false });
  let source = effectData.origin ? await fromUuid(effectData.origin) : undefined;
  let context = actor.getRollData();
  //@ts-ignore
  if (source instanceof CONFIG.Item.documentClass) {
    //@ts-ignore toObject
    context.item = source.toObject(); // TODO v10 check this
  }

  for (let change of effectData.changes) {
    try {
      if (!allMacroEffects.includes(change.key)) continue;
      context.stackCount = effectData.flags?.dae?.stacks ?? effectData.flags?.dae?.statuscounter?.counter.value ?? 1;
      const theChange = await evalArgs({ itemData: null, effectData, context, actor, change, doRolls: true })
      let args = [];
      if (typeof theChange.value === "string") {
        tokenizer.tokenize(theChange.value, (token) => args.push(token));
        args = args.map(arg => {
          if ("@itemData" === arg) {
            return effectData.flags.dae.itemData;
          } else if ("@item" === arg) {
            return effectData.flags.dae.itemData;
          }
          return arg;
        })
      } else args = change.value;
      if (theChange.key.includes("macro.execute") || theChange.key.includes("macro.itemMacro")) {
        const macro = await getMacro({ change, name: args[0] }, null, effectData);
        if (!macro) {
          //TODO localize this
          if (action !== "off") {
            ui.notifications.warn(`macro.execute/macro.itemMacro | No macro ${args[0]} found`)
            error(`macro.execute/macro.itemMacro | No macro ${args[0]} found`);
            continue;
          }
        }

        let data = { action, lastArg, args: [], macroData: { change, name: args[0], effectData } };
        if (theChange.key.includes("macro.execute"))
          data.args = args.slice(1);
        //@ts-ignore
        else
          data.args = args;
        // insert item data
        if (furnaceActive) {
          result = await macro.execute(data.action, ...data.args, data.lastArg)
          // result = await socketlibSocket.executeAsGM("executeMacro", data)
        } else { // support macro calling without furnace.
          const speaker = ChatMessage.getSpeaker({ token: selfTarget, actor });
          const character = game.user?.character;
          let args: any[] = [data.action];
          args = args.concat(data.args).concat(data.lastArg);
          const body = `return (async () => {
            ${macro.command}
          })()`;
          const fn = Function("{speaker, actor, token, character, args}={}", body);

          return fn.call(this, { speaker, actor, token: selfTarget, character, args });
        }
      } else if (theChange.key === "macro.actorUpdate") {
        await macroActorUpdate(action, ...args, lastArg);
        // result = await macroActorUpdate(action, ...args, lastArg);
      }
    } catch (err) {
      console.warn(err);
    }
  };
  return effectData;
}

export async function evalArgs({ effectData = null, itemData = null, context, actor, change, spellLevel = 0, damageTotal = 0, doRolls = false, critical = false, fumble = false, whisper = false, itemCardId = null }) {
  let theItem
  if (itemData) { // TODO v10 check this
    theItem = actor.items.get(itemData._id);
    if (itemData._source) itemData = itemData.toObject(false);
    setProperty(effectData.flags, "dae.itemData", itemData);
  }
  let itemId = getProperty(effectData.flags, "dae.itemData._id");

  if (typeof change.value !== 'string')
    return change; // nothing to do
  const returnChange = duplicate(change);
  let contextToUse = mergeObject({
    scene: canvas.scene.id,
    token: ChatMessage.getSpeaker({ actor }).token,
    target: "@target",
    targetUuid: "@targetUuid",
    spellLevel: spellLevel,
    itemLevel: spellLevel,
    damage: damageTotal,
    itemCardId: itemCardId,
    unique: randomID(),
    actor: actor.id,
    actorUuid: actor.uuid,
    critical: critical,
    fumble: fumble,
    whisper: whisper,
    change: JSON.stringify(change.toJSON),
    itemId: itemId
  }, context, { overwrite: false });
  //contextToUse["item"] = "@item";

  if (itemData) {
    contextToUse["itemData"] = itemData;
    contextToUse["item"] = theItem?.getRollData().item ?? itemData;
  } else {
    contextToUse["itemData"] = "@itemData";
    contextToUse["item"] = "@itemData";
  }

  returnChange.value = returnChange.value.replace("@item.level", "@itemLevel")
  returnChange.value = returnChange.value.replace(/@data./g, "@");
  //@ts-ignore replaceFormulaData
  returnChange.value = Roll.replaceFormulaData(returnChange.value, contextToUse, { missing: 0, warn: false });
  returnChange.value = returnChange.value.replaceAll("##", "@");
  if (typeof returnChange.value === "string" && !returnChange.value.includes("[[")) {
    switch (change.key) {
      case "macro.itemMacro":
      case "macro.itemMacro.local":
      case "macro.itemMacro.GM":
      case "macro.execute":
      case "macro.execute.local":
      case "macro.execute.GM":
      case "macro.actorUpdate":
        break;
      case "macro.CUB":
      case "macro.tokenMagic":
        break;
      default:
        if (doRolls && typeof ValidSpec.specs[actor.type].allSpecsObj[change.key]?.sampleValue === "number") {
          //@ts-ignore evaluate - probably need to make this a saveEval
          returnChange.value = new Roll(returnChange.value, context).evaluate({ async: false }).total;
        };
        break;
    };
    debug("evalargs: change is ", returnChange);
  }
  return returnChange;
}

export async function getMacro({ change, name }, itemData, effectData) {
  if (change.key.includes("macro.execute")) {
    // the first argument conatins the macro name
    return game.macros.getName(name);
  } else if (change.key.startsWith("macro.itemMacro")) {
    // Get the macro command for the macro TODO look at using an item name as well?


    let macroCommand;
    if (change.macro) macroCommand = change.macro.macroCommand;
    // 1. Try and get item dat to look for the command in.
    if (!itemData) itemData = getProperty(effectData.flags, "dae.itemData")
    macroCommand = getProperty(effectData.flags, "dae.itemData.flags.itemacro.macro.data.command");

    // Could not get the macro from the itemData or we had not Itemdata
    if (!macroCommand && !itemData) { // we never got an item do a last ditch attempt
      warn("eval args: fetching item from effectData/origin ", effectData.origin)
      itemData = DAEfromUuid(effectData?.origin)?.toObject(false); // Try and get it from the effectData
      //@ts-ignore
      macroCommand = itemData?.flags.itemacro?.macro.data.command; // TODO V10 when item macros migrated check this and othes 
    }
    if (effectData && itemData) setProperty(effectData.flags, "dae.itemData", itemData);

    if (!macroCommand) {
      macroCommand = `if (!args || args[0] === "on") {ui.notifications.warn("macro.itemMacro | No macro found for item ${itemData?.name}");}`;
      error(`No macro found for item ${itemData?.name}`);
    }
    return CONFIG.Macro.documentClass.create({
      name: "DAE-Item-Macro",
      type: "script",
      img: null,
      command: macroCommand,
      // TODO see if this should change.
      flags: { "dnd5e.itemMacro": true }
    }, { displaySheet: false, temporary: true });
  } else if (change.key === "actorUpdate") {
    console.error("Should not be trying to lookup the macro for actorUpdate")
  }
}
/*
 * appply non-transfer effects to target tokens - provided for backwards compat
 */
export async function doEffects(item, activate, targets = undefined,
  { whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false, effectsToApply = [], removeMatchLabel = false, toggleEffect = false, selfEffects = false }) {
  return await applyNonTransferEffects.bind(item)(activate, targets, { effectsToApply, whisper, spellLevel, damageTotal, itemCardId, critical, fumble, removeMatchLabel, toggleEffect, selfEffects })
}

// Apply non-transfer effects to targets.
// macro arguments are evaluated in the context of the actor applying to the targets
// @target is left unevaluated.
// request is passed to a GM client if the token is not owned
export async function applyNonTransferEffects(activate, targets, { whisper = false, spellLevel = 0, damageTotal = null, itemCardId = null, critical = false, fumble = false, tokenId: tokenId, effectsToApply = [], removeMatchLabel = false, toggleEffect = false, selfEffects = false }) {
  if (!targets) return;
  let macroLocation = "mixed";
  let appliedEffects = duplicate(this.effects.filter(
    ae => ae.transfer !== true
    && (!selfEffects || getProperty(ae, "flags.dae.selfTarget")))
  );
  if (effectsToApply.length > 0) appliedEffects = appliedEffects.filter(aeData => effectsToApply.includes(aeData._id))
  if (appliedEffects.length === 0) return;
  const rollData = this.getRollData(); //TODO if not caster eval move to evalArgs call
  for (let [aeIndex, activeEffectData] of appliedEffects.entries()) {
    for (let [changeIndex, change] of activeEffectData.changes.entries()) {
      const doRolls = allMacroEffects.includes(change.key);
      if (doRolls) {
        if (macroDestination[change.key] === "local" && macroLocation !== "GM") {
          macroLocation = "local"
        } else if (macroDestination[change.key] === "GM") macroLocation = "GM";
      }
      // eval args before calling GMAction so macro arguments are evaled in the casting context.
      // Any @fields for macros are looked up in actor context and left unchanged otherwise
      rollData.stackCount = activeEffectData.flags?.dae?.stacks ?? activeEffectData.flags?.dae?.statuscounter?.counter.value ?? 1;
      let newChange = await evalArgs({ itemData: this.toObject(), effectData: activeEffectData, context: rollData, actor: this.actor, change, spellLevel, damageTotal, doRolls, critical, fumble, itemCardId, whisper })
      activeEffectData.changes[changeIndex] = newChange;
    };
    activeEffectData.origin = this.uuid;
    activeEffectData.duration.startTime = game.time.worldTime;
    activeEffectData.transfer = false;
    appliedEffects[aeIndex] = activeEffectData;
  }

  // Split up targets according to whether they are owned on not. Owned targets have effects applied locally, only unowned are passed ot the GM
  const targetList = Array.from(targets);
  const stringTokens = targetList.filter(t => typeof t === "string");
  if (stringTokens.length) console.warn("String tokens in apply non transfer are ", stringTokens);
  //@ts-ignore
  let localTargets = targetList.filter(t => macroLocation === "local" || (t.isOwner && macroLocation === "mixed")).map(
    //@ts-ignore
    t => {
      if (typeof t === "string") return t;
      //@ts-ignore t.document
      if (t.document) return t.document.uuid; // means we have a token
      //@ts-ignore
      if (t instanceof CONFIG.Actor.documentClass) return t.uuid;
      //@ts-ignore
      if (t instanceof CONFIG.Token.documentClass) return t.actor?.uuid;
      //@ts-ignore .uuid
      return t.uuid;
    }
  );
  //@ts-ignore
  let gmTargets = targetList.filter(t => (!t.isOwner && macroLocation === "mixed") || macroLocation === "GM").map(
    //@ts-ignore
    t => typeof t === "string" ? t : (t.document?.uuid ?? t.uuid)
  );
  debug("apply non-transfer effects: About to call gmaction ", activate, appliedEffects, targets, localTargets, gmTargets)
  if (gmTargets.length > 0)
    await socketlibSocket.executeAsGM("applyActiveEffects", { userId: game.user.id, activate, activeEffects: appliedEffects, targets: gmTargets, itemDuration: this.system.duration, itemCardId, removeMatchLabel, toggleEffect })

  if (localTargets.length > 0) {
    const result = await applyActiveEffects(activate, localTargets, appliedEffects, this.system.duration, itemCardId, removeMatchLabel, toggleEffect)
  }
}

function preUpdateItemHook(candidate, updates, options, user) {
  return true;
}

// Update the actor active effects when editing an owned item
function updateItemEffects(candidate, updates, options, user) {
  if (!candidate.isOwned) return true;
  if (user !== game.user.id) return true;
  if (options.isAdvancement) {
    console.warn(`Dae | Skipping effect re-creation for class advancement ${candidate.parent?.name ?? ""} item ${candidate.name}`)
    return;
  }
  if (updates.effects) { // item effects have changed - update transferred effects
    //@ts-ignore
    const itemUuid = candidate.uuid;
    // delete all actor effects for the given item
    let deletions = [];
    for (let aef of candidate.parent.effects) { // remove all transferred effects for the item
      const isTransfer = aef.flags?.dae?.transfer;
      if (isTransfer && (aef.origin === itemUuid)) deletions.push(aef.id);
    };
    // Now get all the itemm transfer effects
    let additions = candidate.effects.filter(aef => {
      const isTransfer = aef.flags?.dae?.transfer || aef.transfer === true;
      return isTransfer;
    });
    additions = additions.map(ef => ef.toJSON()); // TODO v10 try toObjct
    additions.forEach(efData => {
      efData.origin = itemUuid;
    });
    if (deletions.length > 0) {
      candidate.parent.deleteEmbeddedDocuments("ActiveEffect", deletions).then(() => {
        if (additions.length > 0) candidate.parent.createEmbeddedDocuments("ActiveEffect", additions);
      });
    } else if (additions.length > 0) {
      candidate.parent.createEmbeddedDocuments("ActiveEffect", additions);
    }
  }
  return true;
}


export function preCreateItemHook(candidate, data, options, user) {
  if (!candidate.isOwned) return true;
  if (data.effects) {
    candidate.effects.delete();
    candidate.updateSource({ "effects": data.effects });
  }
  return true;
}

export async function preUpdateActor(wrapped, updates, options, user) {
  try {
    if (options.onUpdateCalled) return;
    for (let onUpdate of (getProperty(this, "flags.dae.onUpdateTarget") ?? [])) {
      if (onUpdate.macroName.length === 0) continue;
      if (!getProperty(updates, onUpdate.filter)) continue;

      const originObject: any = DAEfromUuid(onUpdate.origin);
      const sourceTokenDocument = DAEfromUuid(onUpdate.sourceTokenUuid)
      const targetTokenDocument = DAEfromUuid(onUpdate.targetTokenUuid);
      const sourceActor = DAEfromUuid(onUpdate.sourceActorUuid);
      const sourceToken = sourceTokenDocument?.object;
      const targetActor = targetTokenDocument?.actor;
      const targetToken = targetTokenDocument?.object;

      let originItem = (originObject instanceof Item) ? originObject : undefined;
      if (!originItem) {
        const theEffect = targetActor.effects.find(ef => ef.origin === onUpdate.origin);
          const itemData = getProperty(theEffect, "flags.dae.itemData");
          //@ts-ignore
          if (itemData) originItem = new CONFIG.Item.documentClass(itemData, { parent: targetActor });
      }
      let lastArg = {
        tag: "onUpdateTarget",
        effectId: null,
        origin: onUpdate.origin,
        efData: null,
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        tokenId: targetToken.id,
        tokenUuid: targetTokenDocument.uuid,
        actor: this,
        updates,
        options,
        user,
        sourceActor,
        sourceToken,
        targetActor,
        targetToken,
        originItem
      };
      let macroText;
      if (onUpdate.macroName.startsWith("ItemMacro")) {
        if (onUpdate.macroName === "ItemMacro") {
          macroText = originObject?.flags?.itemacro?.macro.data.command;
        } else if (onUpdate.macroName.startsWith("ItemMacro.")) {
          let macroObject = sourceActor?.items.getName(onUpdate.macroName.split(".")[1]);
          if (!macroObject) macroObject = originObject?.parent?.items.getName(onUpdate.macroName.split(".")[1]);
          macroText = macroObject.data?.flags?.itemacro?.macro.data.command;
        }
      } else {
        const theMacro: Macro = game.macros.getName(onUpdate.macroName);
        if (!theMacro) {
          console.warn(`dae | onUpdateActor no macro found for actor ${this.name} macro ${onUpdate.macroName}`);
          continue;
        }
        //@ts-ignore type v10
        if (theMacro?.type === "chat") {
          theMacro.execute(); // use the core foundry processing for chat macros
          continue;
        }
        //@ts-ignore
        macroText = theMacro?.command;
      }
      try {
        const speaker = ChatMessage.getSpeaker({ actor: this });
        const args: any[] = ["onUpdateActor"].concat(onUpdate.args);
        args.push(lastArg);
        const character = undefined; // game.user?.character;
        const body = `return ( async () => {
    ${macroText}
  })()`;
        const fn = Function("{speaker, actor, token, character, item, args}={}", body);
        await fn.call(this, { speaker, actor: this, token: undefined, character, item: originItem, args });
      } catch (err) {
        ui.notifications?.error(`There was an error running your macro. See the console (F12) for details`);
        error("dae | Error evaluating macro for onUpdateActor", err)
      }
    }
  } finally {
    return wrapped(updates, options, user);
  }
}

export function daeReadyActions() {
  ValidSpec.localizeSpecs();
  // initSheetTab();
  //@ts-ignore
  if (game.settings.get("dae", "disableEffects")) {
    ui?.notifications?.warn("DAE effects disabled no DAE effect processing")
    console.warn("dae disabled - no active effects")
  }
  daeSystemClass.readyActions()
  aboutTimeInstalled = game.modules.get("about-time")?.active;
  simpleCalendarInstalled = game.modules.get("foundryvtt-simple-calendar")?.active;
  timesUpInstalled = game.modules.get("times-up")?.active;
}

export function localDeleteFilters(tokenId: string, filterName: string) {
  let tokenMagic = globalThis.TokenMagic;
  let token = canvas.tokens.get(tokenId);
  tokenMagic.deleteFilters(token, filterName);
}

export var tokenizer;

function daeApply(wrapped, actor, change) { // TODO remains broken in v10
  //TODO revisit this for item changes, requires setProperty(map, "index", value) to work.
  if (change.key?.startsWith("items")) {
    const fields = change.key.split(".");
    const name = fields[1];
    let indices;
    if (false || daeSystemClass.daeActionTypeKeys.includes(name)) { //TODO multiple changes are a problem
      const items = actor.items.contents.map((item, index) => item.system.actionType === name ? index : -1)
      indices = items.filter(index => index !== -1)
    } else {
      indices = [actor.items.contents.findIndex(i => i.name === name)];
    }
    if (indices.length > 0) { // Only works for a single effect because of overrides
      for (let index of indices) {
        fields[1] = `contents.${index}.data`;
        if (fields[1] !== -1) {
          change.key = fields.join(".");
          var rval = wrapped(actor, change)
        }
      }
      // change.key = originalKey;
      return rval;
    }
  }
  return wrapped(actor, change)
}

export function daeInitActions() {
  // Default systtem class is setup, this oeverrides with system specific calss
  const dnd5esystem = DAESystemDND5E; // force reference so they are installed?
  const sw5eSystem = DAESystemSW5E;
  libWrapper = globalThis.libWrapper;
  if (getProperty(globalThis.daeSystems, game.system.id))
    daeSystemClass = getProperty(globalThis.daeSystems, game.system.id);
  else
    //@ts-ignore
    daeSystemClass = globalThis.CONFIG.DAE.systemClass;
  daeSystemClass.initActions();
  daeSystemClass.initSystemData();

  needStringNumericValues = isNewerVersion("9.250", game.version);

  ValidSpec.createValidMods();
  if (game.settings.get("dae", "disableEffects")) {
    ui?.notifications?.warn("DAE effects disabled no DAE effect processing")
    console.warn("DAE active effects disabled.")
    return;
  }

  // TODO put this back when doing item effects.
  // libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype.apply", daeApply, "WRAPPER");
  // libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", applyBaseActiveEffects, "OVERRIDE");

  // If updating item effects recreate actor effects for updated item.
  Hooks.on("updateItem", updateItemEffects);
  Hooks.on("preUpdateItem", preUpdateItemHook);
  Hooks.on("preCreateItem", preCreateItemHook);
  Hooks.on("preCreateActiveEffect", preCreateActiveEffectHook);

  // Hooks.on("preUpdateActor", preUpdateActorHook);
  libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype._preUpdate", preUpdateActor, "WRAPPER");

  // libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype._preDelete", _preDeleteActiveEffect, "WRAPPER");
  libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype._preCreate", _preCreateActiveEffect, "WRAPPER");
  libWrapper.register("dae", "CONFIG.ActiveEffect.documentClass.prototype._preUpdate", _preUpdateActiveEffect, "WRAPPER");

  Hooks.on("createActiveEffect", _onCreateActiveEffect);
  Hooks.on("deleteActiveEffect", _onDeleteActiveEffect);
  Hooks.on("updateActiveEffect", _onUpdateActiveEffect);

  // Add the active effects title bar actions
  Hooks.on('renderActorSheet', initActorSheetHook);
  // disabled since not needed with full active effect edting.
  Hooks.on('renderItemSheet', initItemSheetHook);

  //@ts-ignore
  tokenizer = new DETokenizeThis({
    shouldTokenize: ['(', ')', ',', '*', '/', '%', '+', '=', '!=', '!', '<', '> ', '<=', '>=', '^']
  });
  actionQueue = new globalThis.Semaphore();
}


function initActorSheetHook(app, html, data) {
  if (!daeTitleBar) return;
  const title = game.i18n.localize('dae.ActiveEffectName')
  let titleText = daeNoTitleText ? "" : title;
  let openBtn = $(`<a class="open-actor-effect" title="${title}"><i class="fas fa-wrench"></i>${titleText}</a>`);
  openBtn.click(ev => {
    new ActiveEffects(app.document, {}).render(true);
  });
  html.closest('.app').find('.open-actor-effect').remove();
  let titleElement = html.closest('.app').find('.window-title');
  if (!app._minimized) openBtn.insertAfter(titleElement);
}

function initItemSheetHook(app, html, data) {
  if (!daeTitleBar) return true;
  const title = game.i18n.localize('dae.ActiveEffectName')
  let titleText = daeNoTitleText ? "" : title;
  let openBtn = $(`<a class="open-item-effect" title="${title}"><i class="fas fa-wrench"></i>${titleText}</a>`);
  openBtn.click(ev => {
    new ActiveEffects(app.document, {}).render(true);
  });
  html.closest('.app').find('.open-item-effect').remove();
  let titleElement = html.closest('.app').find('.window-title');
  openBtn.insertAfter(titleElement);
  return true;
}

export function daeSetupActions() {
  cubActive = game.modules.get("combat-utility-belt")?.active;
  ceActive = game.modules.get("dfreds-convenient-effects")?.active && isNewerVersion(game.modules.get("dfreds-convenient-effects").version, "1.6.2");
  debug("Combat utility belt active ", cubActive, " and cub version is ", game.modules.get("combat-utility-belt")?.version)

  atlActive = game.modules.get("ATL")?.active;
  if (cubActive && !isNewerVersion(game.modules.get("combat-utility-belt")?.version, "1.1.2")) {
    ui.notifications.warn("Combat Utility Belt needs to be version 1.1.3 or later - conditions disabled");
    console.warn("Combat Utility Belt needs to be version 1.1.3 or later - conditions disabled");
    cubActive = false;
  } else if (cubActive) {
    debug("dae | Combat Utility Belt active and conditions enabled");
  }
  itemacroActive = game.modules.get("itemacro")?.active;
  furnaceActive = game.modules.get("furnace")?.active || game.modules.get("advanced-macros")?.active;
  midiActive = game.modules.get("midi-qol")?.active;
  statusCounterActive = game.modules.get("statuscounter")?.active;
  daeSystemClass.setupActions();
}

export function fetchParams(doUpdatePatches = true) {
  requireItemTarget = game.settings.get("dae", "requireItemTarget");
  debugEnabled = setDebugLevel(game.settings.get("dae", "ZZDebug"));
  // useAbilitySave = game.settings.get("dae", "useAbilitySave") disabled as of 0.8.74
  confirmDelete = game.settings.get("dae", "confirmDelete")
  noDupDamageMacro = game.settings.get("dae", "noDupDamageMacro");
  disableEffects = game.settings.get("dae", "disableEffects");
  daeTitleBar = game.settings.get("dae", "DAETitleBar");
  daeNoTitleText = game.settings.get("dae", "DAENoTitleText");
  /* TODO decide what to do about enhancing status effects or not
  ehnanceStatusEffects = game.settings.get("dae", "ehnanceStatusEffects");
  procStatusEffects(ehnanceStatusEffects);
  */
  let useDAESheet = game.settings.get("dae", "useDAESheet");
  if (useDAESheet) { // TODO v10 Do this properly
    if (CONFIG.ActiveEffect.sheetClasses.base)
      CONFIG.ActiveEffect.sheetClasses.base["core.ActiveEffectConfig"].cls = DAEActiveEffectConfig;
  } else {
    if (CONFIG.ActiveEffect.sheetClasses.base)
      CONFIG.ActiveEffect.sheetClasses.base["core.ActiveEffectConfig"].cls = ActiveEffectConfig;

    // CONFIG.ActiveEffect.sheetClass = ActiveEffectConfig;
  }
  expireRealTime = game.settings.get("dae", "expireRealTime");
  // showDeprecation = game.settings.get("dae", "showDeprecation") ?? true;
  showInline = game.settings.get("dae", "showInline") ?? false;
  Hooks.callAll("dae.settingsChanged")
}

export function DAEfromUuid(uuid) {
  let doc;
  if (!uuid) return null;
  try {
    let parts = uuid.split(".");

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
  } /*catch (err) {
    error(`dae | could not fetch ${uuid} ${err}`)
  } */finally {
    return doc || null;
  }
}

export function DAEfromActorUuid(uuid) {
  let doc = DAEfromUuid(uuid);
  if (doc instanceof CONFIG.Token.documentClass) doc = doc.actor;
  return doc || null;
}

// Allow limited recursion of the formula replace function for things like
// bonuses.heal.damage in spell formulas.
export function replaceFormulaData(wrapped, formula, data, { missing, warn = false } = { missing: undefined, warn: false }) {
  let result = formula;
  const maxIterations = 3;
  if (typeof formula !== "string") return formula;
  for (let i = 0; i < maxIterations; i++) {
    if (!result.includes("@")) break;
    try {
      result = wrapped(result, data, { missing, warn });
    } catch (err) {
      error(err, formula, data, missing, warn);
    }
  }
  return result;
}

export function tokenForActor(actor): Token | undefined {
  const tokens = actor.getActiveTokens();
  if ( !tokens.length ) return undefined;
  const controlled = tokens.filter(t => t._controlled);
  return controlled.length ? controlled.shift() : tokens.shift();
}