import { aboutTimeInstalled, timesUpInstalled, expireRealTime, DAEfromUuid, DAEfromActorUuid, simpleCalendarInstalled, allMacroEffects, getMacro, actionQueue, tokenForActor } from "./dae";
import { warn, debug, error, log, changesQueue } from "../dae";

export class GMActionMessage {
  action: string;
  sender: string;
  targetGM: string; // gm id
  data: {};
  constructor(action: string, sender: string, targetGM: string, data: {}) {
    this.action = action;
    this.sender = sender;
    this.targetGM = targetGM;
    this.data = data;
  }
}
export var socketlibSocket: any = undefined;
export let setupSocket = () => {
  socketlibSocket = globalThis.socketlib.registerModule("dae");
  socketlibSocket.register("test", _testMessage);
  socketlibSocket.register("setTokenVisibility", _setTokenVisibility);
  socketlibSocket.register("setTileVisibility", _setTileVisibility);
  socketlibSocket.register("blindToken", _blindToken);
  socketlibSocket.register("restoreVision", _restoreVision);
  socketlibSocket.register("recreateToken", _recreateToken);
  socketlibSocket.register("createToken", _createToken);
  socketlibSocket.register("deleteToken", _deleteToken);
  socketlibSocket.register("renameToken", _renameToken);
  //  socketlibSocket.register("moveToken", _moveToken); TODO find out if this is used anywhere
  socketlibSocket.register("applyTokenMagic", _addTokenMagic);
  socketlibSocket.register("removeTokenMagic", _removeTokenMagic);
  socketlibSocket.register("applyActiveEffects", _applyActiveEffects);
  socketlibSocket.register("setTokenFlag", _setTokenFlag);
  socketlibSocket.register("setFlag", _setFlag);
  socketlibSocket.register("unsetFlag", _unsetFlag);
  socketlibSocket.register("deleteEffects", _deleteEffects);
  socketlibSocket.register("deleteUuid", _deleteUuid);
  socketlibSocket.register("executeMacro", _executeMacro);
  socketlibSocket.register("createActorItem", _createActorItem);
  socketlibSocket.register("removeActorItem", _removeActorItem);
  socketlibSocket.register("_updateActor", _updateActor)
  socketlibSocket.register("itemReplaceEffects", _itemReplaceEffects);
}

async function _itemReplaceEffects(data) {
  //@ts-expect-error
  const item = fromUuidSync(data.itemUuid);
  // await item.update({"effects": []});
  return item.update({"effects": data.effects});
}

async function _updateActor(data) {
  const actor = await fromUuid(data.actorUuid);
  return actor.update(data.update)
}

async function _removeActorItem(data: { uuid: string, itemUuid: string, itemUuids: string[]}) {
  const {uuid, itemUuid, itemUuids} = data;

  for (let itemUuid of itemUuids ?? []) {
    const item: any = await fromUuid(itemUuid);
    if (!item?.isOwned) continue; // Just in case we are trying to delete a world/compendium item
    await item.delete();
  }
}

async function _createActorItem(data: {uuid: string, itemDetails: string, effectUuid: string}) {
  const {uuid, itemDetails, effectUuid} = data;
  const [itemUuid, option] = itemDetails.split(",").map(s=> s.trim());
  const item = await fromUuid(itemUuid);
  if (!item || !(item instanceof Item)) {
    error(`createActorItem could not find item ${itemUuid}`);
    return undefined;
  }
  let actor: Actor = DAEfromActorUuid(uuid);
  if (!actor) {
    error(`createActorItem could not find Actor ${uuid}`);
  }
  if (actor.token) { // need to delay for unliked tokens as there is a timing issue
    await new Promise(resolve => setTimeout(() => resolve(true), 250))
  }
  //@ts-expect-error createEmbeddedDocument toObject
  const documents = await actor.createEmbeddedDocuments("Item", [item.toObject(false)]);
  if (option === "permanent") return documents;
  //@ts-expect-error CONFIG
  const effect: CONFIG.ActiveEffect.documentClass = await fromUuid(effectUuid);
  if (!effect) {
    console.warn(`dae | createActorItem could not fetch ${effectUuid}`);
    return documents;
  }
  const itemsToDelete = effect?.flags.dae?.itemsToDelete ?? [];
  itemsToDelete.push(documents[0].uuid);
  await effect.update({"flags.dae.itemsToDelete": itemsToDelete});
  return documents;
}

async function _executeMacro(data: {action, args, lastArg, macroData: {change, name, effectData}}) {
  const macro = await getMacro({ change: data.macroData.change, name: data.macroData.name}, null, data.macroData.effectData);
  //@ts-ignore
  const result = await macro.execute(data.action, ...data.args, data.lastArg)
  return result;
}

async function _deleteUuid(data: { uuid: string }) {
  // don't allow deletion of compendium entries or world Items
  if (data.uuid.startsWith("Compendium") || data.uuid.startsWith("Item")) return false;
  const entity = DAEfromUuid(data.uuid);
  if (!entity) return false;
  if (entity instanceof Item) return await entity.delete();
  if (entity instanceof CONFIG.Token.documentClass) return await entity.delete();
  if (entity instanceof CONFIG.ActiveEffect.documentClass) return await entity.delete();
  if (entity instanceof CONFIG.MeasuredTemplate.documentClass) return await entity.delete();
  return false;
}

function _testMessage(data) {
  console.log("DyamicEffects | test message received", data);
  return "Test message received and processed";
}
async function _setTokenVisibility(data) {
  await DAEfromUuid(data.tokenUuid)?.update({ hidden: data.hidden })
}

async function _setTileVisibility(data) {
  return await DAEfromUuid(data.tileUuid)?.update({ visible: data.hidden })
}

async function _applyActiveEffects(data) {

  return await applyActiveEffects(data);
}
async function _recreateToken(data: { userId: string, tokenUuid: string, startSceneId: string, targetSceneId: string, tokenData: {}, targetTokenData: {}, x: number, y: number }) {
  await _createToken(data);
  const token = await DAEfromUuid(data.tokenUuid);
  return token?.delete();
}

async function _createToken(data: { userId: string, targetSceneId: string, tokenData: {}, x: number, y: number }) {
  let scenes = game.scenes;
  let targetScene = scenes.get(data.targetSceneId);
  //@ts-ignore
  return await targetScene.createEmbeddedDocuments('Token', [mergeObject(duplicate(data.tokenData), { "x": data.x, "y": data.y, hidden: false }, { overwrite: true, inplace: true })])
}

async function _deleteToken(data: { tokenUuid: string }) {
  return await DAEfromUuid(data.tokenUuid)?.delete();
}

async function _setTokenFlag(data: { flagName: string, flagValue: any, tokenUuid: string }) {
  const update = {};
  update[`flags.dae.${data.flagName}`] = data.flagValue;
  return await DAEfromUuid(data.tokenUuid)?.update(update)
}

async function _setFlag(data: { actorUuid: string | undefined, actorId: string | undefined, flagId: string, value: any }) {
  if (!data.actorUuid) return await game.actors.get(data.actorId)?.setFlag("dae", data.flagId, data.value);
  else return await DAEfromActorUuid(data.actorUuid)?.setFlag("dae", data.flagId, data.value);
}

async function _unsetFlag(data: { actorUuid: string, flagId: string }) {
  return await DAEfromActorUuid(data.actorUuid)?.unsetFlag("dae", data.flagId)
}

async function _blindToken(data: { tokenUuid: string }) {
  const blind = CONFIG.statusEffects.find(se=>se.id === CONFIG.specialStatusEffects.BLIND)
  return await DAEfromUuid(data.tokenUuid)?.object.toggleEffect(blind, {overlay: false, active: true})
}

async function _restoreVision(data: { tokenUuid: string }) {
  const blind = CONFIG.statusEffects.find(se=>se.id === CONFIG.specialStatusEffects.BLIND)
  return await DAEfromUuid(data.tokenUuid)?.object.toggleEffect(blind, {overlay: false, active: false})
}

async function _renameToken(data: { tokenData: any, newName: string }) { // TODO update this for uuids
  return await canvas.tokens.placeables.find(t => t.id === data.tokenData._id).update({ "name": data.newName })
}

async function _addTokenMagic(data: { tokenUuid: string, effectId: string }) {
  // console.error("remove gma", data.tokenUuid, data.effectId);
  let token = DAEfromUuid(data.tokenUuid)?.object;
  let tokenMagic = globalThis.TokenMagic;
  if (tokenMagic && token) {
    return await tokenMagic.addFilters(token, data.effectId);
  }
}
async function _removeTokenMagic(data: { tokenUuid: string, effectId: string }) {
  // console.error("remove gma", data.tokenUuid, data.effectId);
  let token = DAEfromUuid(data.tokenUuid)?.object;
  let tokenMagic = globalThis.TokenMagic;
  if (tokenMagic && token) {
    return await tokenMagic.deleteFilters(token, data.effectId);
  }
}

async function _deleteEffects(data: { targets: any[], origin: string, ignore: string[], deleteEffects: string[] }) {
  for (let idData of data.targets) {
    const entity = DAEfromUuid(idData.uuid);
    const actor = entity.actor ? entity.actor : entity;
    if (!actor) {
      error("could not find actor for ", idData);
    }
    let effectsToDelete = actor?.effects?.filter(ef => ef.origin === data.origin && !data.ignore?.includes(ef.uuid));
    if (data.deleteEffects?.length > 0) effectsToDelete = effectsToDelete.filter(ae => data.deleteEffects.includes(ae.id))
    if (effectsToDelete?.length > 0) {
      try {
        return await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete.map(ef => ef.id));
      } catch (err) {
        warn("delete effects failed ", err)
        // TODO can get thrown since more than one thing tries to delete an effect
      };
    }
  }
  if (globalThis.Sequencer && data.origin) globalThis.Sequencer.EffectManager.endEffects({ origin: data.origin })
}

export async function applyActiveEffects({activate, tokenList, activeEffects, itemDuration, itemCardId = null, removeMatchLabel = false, toggleEffect, metaData = undefined}) {
  // debug("apply active effect ", activate, tokenList, duplicate(activeEffects), itemDuration)

  for (let tid of tokenList) {
    const tokenOrDocument = DAEfromUuid(tid) || canvas.tokens.get(tid);
    const tokenUuid = tokenOrDocument.uuid ?? tokenOrDocument.document.uuid;
    let targetActor = tokenOrDocument.actor ?? tokenOrDocument; // assume if we did not get a token it is an actor
    const token = tokenOrDocument.object ?? tokenOrDocument;

    if (targetActor) {
      // Remove any existing effects that are not stackable or transfer from the same origin
      let currentStacks = 1;

      const origins = activeEffects.map(aeData => ({ origin: aeData.origin, label: aeData.label }));
      //const origins = actEffects.map(aeData => aeData.origin);

      // TODO: update exsiting count stacks rather than removing and adding.
      // find existing active effect that have same origin as one of our new effects 
      let removeList = targetActor.effects.filter(ae => {
        const notMulti = getProperty(ae, "flags.dae.stackable") !== "multi";
        const noStackByName = getProperty(ae, "flags.dae.stackable") === "noneName";
        if (noStackByName) 
          return origins.find(o => o.label === ae.label)
        else return origins.find(o => {
              const escapedLabel = o.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              return o.origin === ae.origin
              && (!removeMatchLabel || (new RegExp(`^${escapedLabel}( \\([0-9]+\\))?$`)).test(ae.label))
          })
          && getProperty(ae, "flags.dae.transfer") === false
          && notMulti;
      });

      if (removeList.length > 0 && !toggleEffect) {
        currentStacks = removeList.filter(ae => getProperty(ae, "flags.dae.stackable") === "count").reduce((acc, ae) => acc + (getProperty(ae, "flags.dae.stacks") ?? 1), 1)
        removeList = removeList.map(ae => ae._id);
        await targetActor.deleteEmbeddedDocuments("ActiveEffect", removeList);
      }
      if (toggleEffect && removeList.length > 0) {
        removeList = removeList.map(ef => {ef.disabled = !ef.disabled; return ef.toObject(false)});
        targetActor.updateEmbeddedDocuments("ActiveEffect", removeList);
        activate = false;
      }
      if (activate) {
        let dupEffects = duplicate(activeEffects); // .filter(aeData => !aeData.selfTarget));
        for (let aeData of dupEffects) {
          setProperty(aeData, "flags.dae.token", tid);
          if (getProperty(aeData, "flags.dae.stackable") === "count") {
            setProperty(aeData, "flags.dae.stacks", currentStacks);
            aeData.label = `${aeData.label} (${getProperty(aeData, "flags.dae.stacks")})`;
          }
          // convert item duration to seconds/rounds/turns according to combat
          if (aeData.duration.seconds) {
            //@ts-ignore
            aeData.duration.startTime = game.time.worldTime;
          } else if (aeData.duration.rounds || aeData.duration.turns) {
            aeData.duration.startRound = game.combat?.round;
            aeData.duration.startTurn = game.combat?.turn;
          } else { // no specific duration on effect use spell duration
            //@ts-ignore
            const inCombat = (game.combat?.turns.some(turnData => turnData.token?.id === token.id));
            const convertedDuration = convertDuration(itemDuration, inCombat);
            debug("converted duration ", convertedDuration, inCombat, itemDuration)
            if (convertedDuration.type === "seconds") {
              aeData.duration.seconds = convertedDuration.seconds;
              aeData.duration.startTime = game.time.worldTime;
            } else if (convertedDuration.type === "turns") {
              aeData.duration.rounds = convertedDuration.rounds;
              aeData.duration.turns = convertedDuration.turns;
              aeData.duration.startRound = game.combat?.round;
              aeData.duration.startTurn = game.combat?.turn;
            }
          }
          warn("Apply active effects ", aeData, itemCardId)

          setProperty(aeData, "flags.dae.transfer", false);
          let source: any | undefined = await fromUuid(aeData.origin);
          let context = targetActor.getRollData();
          //@ts-ignore
          if (false && source instanceof CONFIG.Item.documentClass) {
            context = source?.getRollData();
          }
          context = mergeObject(context, { "target": tokenOrDocument.id, "targetUuid": tokenUuid, "itemCardid": itemCardId, "@target": "target", "stackCount": "@stackCount", "item": "@item", "itemData": "@itemData" });
          aeData.changes = aeData.changes.map(change => {
            if (allMacroEffects.includes(change.key) || ["flags.dae.onUpdateTarget", "flags.dae.onUpdateSource"].includes(change.key)) {
              let originItem = DAEfromUuid(aeData.origin);
              let sourceActor = originItem?.actor;
              if (!originItem && aeData.flags?.dae?.itemData) { // could not find the item reconstruct it.
                const originActorUuid = aeData.origin.replace(/.Item.*/,"");
                sourceActor = DAEfromActorUuid(originActorUuid);
              } else {
                const originActorUuid = aeData.origin.replace(/.Item.*/,"");
                sourceActor = DAEfromActorUuid(originActorUuid);
              }
              if (change.key === "flags.dae.onUpdateTarget") {
                // for onUpdateTarget effects, put the source actor, the target uuid, the origin and the original change.value
                //@ts-ignore
                change.value = `${aeData.origin}, ${token.document.uuid}, ${tokenForActor(sourceActor)?.document.uuid ?? ""}, ${sourceActor.uuid}, ${change.value}`;
              } else if (change.key === "flags.dae.onUpdateSource") {
                //@ts-ignore
                change.value = `${aeData.origin}, ${tokenForActor(sourceActor)?.document.uuid ?? ""}, ${token.document.uuid}, ${sourceActor.uuid}, ${change.value}`;
                const newEffectData = duplicate(aeData);
                newEffectData.changes = [duplicate(change)];
                newEffectData.changes[0].key = "flags.dae.onUpdateTarget";
                sourceActor.createEmbeddedDocuments("ActiveEffect", [newEffectData], {metaData})
                // createSourceActorLink(change, aeData, tokenUuid, change.value);
                return undefined;
              }

            // if (["macro.execute", "macro.itemMacro", "roll", "macro.actorUpdate"].includes(change.key)) {
              if (typeof change.value === "number") {
              } else if (typeof change.value === "string") {
                //@ts-ignore replaceFormulaData
                change.value = Roll.replaceFormulaData(change.value, context, { missing: 0, warn: false });
                change.value = change.value.replace("##", "@");
              } else {
                change.value = duplicate(change.value).map(f => {
                  if (f === "@itemCardId") return itemCardId;
                  if (f === "@target") return tokenOrDocument.id;
                  if (f === "@targetUuid") return tokenUuid;
                  return f;
                })
              }
            } else {
              //@ts-ignore replaceFormulaData
              //change.value = Roll.replaceFormulaData(change.value, context, { missing: 0, warn: false})
            }
            return change;
          }).filter(change => change !== undefined);
        }

        if (dupEffects.length > 0) {
          let timedRemoveList = await targetActor.createEmbeddedDocuments("ActiveEffect", dupEffects, {metaData});
          setTimeout( () => {
          if (globalThis.EffectCounter) {
            for (let effectData of dupEffects) {
              let flags = effectData.flags;
              if (flags?.dae?.stackable === "count" && flags?.dae?.stacks) {
                const counter = globalThis.EffectCounter.findCounter(token, effectData.icon);
                counter.setValue(flags.dae.stacks);
              }
            }
          }
        }, 1000);

          //TODO remove this when timesup is in the wild.
          if (!timesUpInstalled) { // do the kludgey old form removal
            let doRemoveEffect = async (tokenUuid, removeEffect) => {
              const actor = globalThis.DAE.DAEfromActorUuid(tokenUuid);
              let removeId = removeEffect._id;
              if (removeId && actor?.effects.get(removeId)) {
                await actor?.deleteEmbeddedDocuments("ActiveEffect", [removeId])
              }
            }

            if (!Array.isArray(timedRemoveList)) timedRemoveList = [timedRemoveList];
            timedRemoveList.forEach(ae => {
              // need to do separately as they might have different durations
              let duration = ae.duration?.seconds || 0;
              if (!duration) {
                duration = ((ae.duration.rounds ?? 0) + ((ae.duration.turns > 0) ? 1 : 0)) * CONFIG.time.roundTime;
              }
              warn("removing effect ", ae.toObject, " in ", duration, " seconds ")
              if (duration && aboutTimeInstalled) { // TODO check this v10
                game.Gametime.doIn({ seconds: duration }, doRemoveEffect, tokenUuid, ae.toObject())
              } else if (duration && expireRealTime) { //TODO decide what to do for token magic vs macros
                setTimeout(doRemoveEffect, duration * 1000 || 6000, tokenUuid, ae.toObject());
              }
            })
          }
        }
      };
    };
  }
}

export function convertDuration(itemDuration: { units: string, value: number }, inCombat) {
  // TODO rewrite this abomination
  const useTurns = inCombat && timesUpInstalled;
  if (!itemDuration) return { type: "seconds", seconds: 0, rounds: 0, turns: 0 };
  if (!simpleCalendarInstalled) {
    switch (itemDuration.units) {
      case "turn":
      case "turns": return { type: useTurns ? "turns" : "seconds", seconds: 1, rounds: 0, turns: itemDuration.value };
      case "round":
      case "rounds": return { type: useTurns ? "turns" : "seconds", seconds: itemDuration.value * CONFIG.time.roundTime, rounds: itemDuration.value, turns: 0 }
      case "second":
      case "seconds":
        return { type: useTurns ? "turns" : "seconds", seconds: itemDuration.value, rounds: itemDuration.value / CONFIG.time.roundTime, turns: 0 }
      case "minute":
      case "minutes":
        let durSeconds = itemDuration.value * 60
        if (durSeconds / CONFIG.time.roundTime <= 10) {
          return { type: useTurns ? "turns" : "seconds", seconds: durSeconds, rounds: durSeconds / CONFIG.time.roundTime, turns: 0 };
        } else {
          return { type: "seconds", seconds: durSeconds, rounds: durSeconds / CONFIG.time.roundTime, turns: 0 };
        }
      case "hour":
      case "hours": return { type: "seconds", seconds: itemDuration.value * 60 * 60, rounds: 0, turns: 0 };
      case "day":
      case "days": return { type: "seconds", seconds: itemDuration.value * 60 * 60 * 24, rounds: 0, turns: 0 };
      case "week":
      case "weeks": return { type: "seconds", seconds: itemDuration.value * 60 * 60 * 24 * 7, rounds: 0, turns: 0 };
      case "month":
      case "months": return { type: "seconds", seconds: itemDuration.value * 60 * 60 * 24 * 30, rounds: 0, turns: 0 };
      case "year":
      case "years": return { type: "seconds", seconds: itemDuration.value * 60 * 60 * 24 * 30 * 365, rounds: 0, turns: 0 };
      case "inst": return { type: useTurns ? "turns" : "seconds", seconds: 1, rounds: 0, turns: 1 };
      default:
        console.warn("dae | unknown time unit found", itemDuration.units);
        return { type: useTurns ? "none" : "seconds", seconds: undefined, rounds: undefined, turns: undefined };
    }
  } else {
    switch (itemDuration.units) {
      case "perm":
        return { type: "seconds", seconds: undefined, rounds: undefined, turns: undefined};
      case "turn":
      case "turns": return { type: useTurns ? "turns" : "seconds", seconds: 1, rounds: 0, turns: itemDuration.value };
      case "round":
      case "rounds": return { type: useTurns ? "turns" : "seconds", seconds: itemDuration.value * CONFIG.time.roundTime, rounds: itemDuration.value, turns: 0 }
      case "second": return { type: useTurns ? "turns" : "seconds", seconds: itemDuration.value, rounds: itemDuration.value / CONFIG.time.roundTime, turns: 0 };
      case "inst": return { type: useTurns ? "turns" : "seconds", seconds: 1, rounds: 0, turns: 1 };
      default:
        let interval = {}
        interval[itemDuration.units] = itemDuration.value;
        const durationSeconds = globalThis.SimpleCalendar.api.timestampPlusInterval(game.time.worldTime, interval) - game.time.worldTime;
        if (durationSeconds / CONFIG.time.roundTime <= 10) {
          return { type: useTurns ? "turns" : "seconds", seconds: durationSeconds, rounds: Math.floor(durationSeconds / CONFIG.time.roundTime), turns: 0 };
        } else {
          return { type: "seconds", seconds: durationSeconds, rounds: Math.floor(durationSeconds / CONFIG.time.roundTime), turns: 0 };
        }
      //      default: return {type: combat ? "none" : "seconds", seconds: CONFIG.time.roundTime, rounds: 0, turns: 1};
    }
  }
}
