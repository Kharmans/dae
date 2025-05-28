import { timesUpInstalled, simpleCalendarInstalled, allMacroEffects, getMacro, tokenForActor, delay, actorFromUuid, getTokenDocument, getToken, ceInterface, maxShortDuration } from "./dae.js";
import { warn, debug, error, debugEnabled, i18nFormat, i18n } from "../dae.js";
import { MustBeValidUuid } from "fvtt-types/utils";

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
  socketlibSocket.register("suspendActiveEffect", _suspendActiveEffect);
  socketlibSocket.register("executeMacro", _executeMacro);
  socketlibSocket.register("createActorItem", _createActorItem);
  socketlibSocket.register("removeActorItem", _removeActorItem);
  socketlibSocket.register("_updateActor", _updateActor)
  socketlibSocket.register("itemReplaceEffects", _itemReplaceEffects);
}

async function _itemReplaceEffects(data) {
  const item = fromUuidSync(data.itemUuid) as Item | undefined;
  return item?.update({ "effects": data.effects });
}

async function _updateActor(data) {
  const actor = (await fromUuid(data.actorUuid)) as Actor | undefined;
  return actor?.update(data.update, data.context)
}

async function _removeActorItem(data: { uuid: string, itemUuid: string, itemUuids: string[], context: any }) {
  const { uuid, itemUuid, itemUuids, context } = data;

  for (let itemUuid of itemUuids ?? []) {
    // @ts-expect-error
    const item: any = await fromUuid(itemUuid);
    if (!(item instanceof Item) || !item?.isOwned) continue; // Just in case we are trying to delete a world/compendium item
    await item.delete(context);
  }
}

async function _createActorItem(data: { uuid: string, itemDetails: string, effectUuid: string, callItemMacro: boolean }): Promise<Array<Item>> {
  const { uuid, itemDetails, effectUuid } = data;
  const [itemUuid, option] = itemDetails.split(",").map(s => s.trim());
  let item: Item | undefined = await fromUuid(itemUuid) as Item;
  if (!item) item = game.items?.getName(itemUuid); // try to find the item by name if was not a uuid.
  if (!item || !(item instanceof Item)) {
    error(`createActorItem could not find item ${itemUuid}`);
    return [];
  }
  let actor: Actor | undefined | null = actorFromUuid(uuid);
  if (!actor) {
    error(`createActorItem could not find Actor ${uuid}`);
    return [];
  }

  let itemData: any = item?.toObject(true);
  if (!itemData) return [];
  //@ts-expect-error unsupportedItemTypes
  if (actor?.sheet?.constructor.unsupportedItemTypes.has(itemData.type) || itemData.system.advancement?.length) {
    ui.notifications?.warn(i18nFormat("DND5E.ActorWarningInvalidItem", {
      itemType: i18n(CONFIG.Item.typeLabels[itemData.type]),
      actorType: i18n(CONFIG.Actor.typeLabels[actor.type])
    }));
    return [];
  }

  foundry.utils.setProperty(itemData, "flags.dae.DAECreated", true);
  const documents: Item[] = await actor.createEmbeddedDocuments("Item", [itemData]) as Item[];
  if (data.callItemMacro) {
    const change = { key: "macro.itemMacro" };
    for (let item of documents) {
      const effectData = { itemUuid: item.uuid, flags: {} }
      const macro = await getMacro({ change, name: "" }, item, effectData);
      let lastArg = foundry.utils.mergeObject({ itemUuid: item.uuid }, {
        actorId: actor.id,
        actorUuid: actor.uuid,
      }, { overwrite: false, insertKeys: true, insertValues: true, inplace: false });
      let data = {
        action: "onCreate",
        lastArg,
        args: [],
        macroData: { change, name: "", effectData: undefined },
        actor,
        token: tokenForActor(actor),
        item
      };

      _executeMacro(data);
      // const result = await macro.execute(data.action, ...data.args, data.lastArg)
    };
  }
  if (option === "permanent") return documents;
  // @ts-expect-error
  const effect: ActiveEffect.Implementation = await fromUuid(effectUuid);
  if (!effect) {
    console.warn(`dae | createActorItem could not fetch ${effectUuid}`);
    return documents;
  }
  // @ts-expect-error can't know about flags
  const itemsToDelete = effect?.flags.dae?.itemsToDelete ?? [];
  itemsToDelete.push(documents[0].uuid);
  // @ts-expect-error
  await effect.update({ "flags.dae.itemsToDelete": itemsToDelete });
  return documents;
}

async function _executeMacro(data: {
  action,
  args,
  lastArg,
  macroData: { change, name, effectData },
  actor,
  token,
  item
}) {
  const macro = await getMacro({ change: data.macroData.change, name: data.macroData.name }, data.item, data.macroData.effectData);
  let v11args: any = {};
  v11args[0] = "on";
  v11args[1] = data.lastArg;
  v11args.length = 2;
  v11args.lastArg = data.lastArg;
  const speaker = data.actor ? ChatMessage.getSpeaker({ actor: data.actor }) : undefined;
  const AsyncFunction = (async function () { }).constructor;
  //@ts-expect-error
  const fn = new AsyncFunction("speaker", "actor", "token", "character", "item", "args", macro.command);
  return fn.call(this, speaker, data.actor, data.token, undefined, data.item, v11args);
}

async function _suspendActiveEffect(data: { uuid: string }) {
  // @ts-expect-error
  const effect = await fromUuid(data.uuid);
  if (!effect) return;
  if (effect instanceof CONFIG.ActiveEffect.documentClass) {
    return effect.update({ disabled: true });
  }
}

async function _deleteUuid(data: { uuid: string }) {
  // don't allow deletion of compendium entries or world Items
  if (data.uuid.startsWith("Compendium") || data.uuid.startsWith("Item")) return false;
  const entity = fromUuidSync(data.uuid as MustBeValidUuid<string>);
  if (!entity) return false;
  if (entity instanceof Item.implementation) return await entity.delete();
  if (entity instanceof TokenDocument.implementation) return await entity.delete();
  if (entity instanceof ActiveEffect.implementation) return await entity.delete();
  if (entity instanceof MeasuredTemplateDocument.implementation) return await entity.delete();
  return false;
}

function _testMessage(data) {
  console.log("DyamicEffects | test message received", data);
  return "Test message received and processed";
}
async function _setTokenVisibility(data) {
  await (fromUuidSync(data.tokenUuid as MustBeValidUuid<string>) as TokenDocument)?.update({ hidden: data.hidden })
}

async function _setTileVisibility(data) {
  return await (fromUuidSync(data.tileUuid as MustBeValidUuid<string>) as TileDocument)?.update({ hidden: data.hidden })
}

async function _applyActiveEffects(data) {
  return await applyActiveEffects(data);
}
async function _recreateToken(data: { userId: string, tokenUuid: string, startSceneId: string, targetSceneId: string, tokenData: {}, targetTokenData: {}, x: number, y: number }) {
  //TODO this looks odd - should get the token data form the tokenUuid?
  await _createToken(data);
  //@ts-expect-error fromUuidSync
  const token = await fromUuidSync(data.tokenUuid) as TokenDocument.Implementation;
  return token?.delete();
}

async function _createToken(data: { userId: string, targetSceneId: string, tokenData: {}, x: number, y: number }) {
  let scenes = game.scenes;
  let targetScene = scenes?.get(data.targetSceneId);
  return await targetScene?.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(foundry.utils.duplicate(data.tokenData), { "x": data.x, "y": data.y, hidden: false }, { overwrite: true, inplace: true })])
}

async function _deleteToken(data: { tokenUuid: string }) {
  //@ts-expect-error fromUuidSync
  return await fromUuidSync(data.tokenUuid)?.delete();
}

async function _setTokenFlag(data: { flagName: string, flagValue: any, tokenUuid: string }) {
  const update = {};
  update[`flags.dae.${data.flagName}`] = data.flagValue;
  const tokenDocument = getTokenDocument(data.tokenUuid);
  return await tokenDocument?.update(update);
}

async function _setFlag(data: { actorUuid: string | undefined, actorId: string | undefined, flagId: string, value: any }) {
  // @ts-expect-error can't know about flags
  if (data.actorUuid) return await actorFromUuid(data.actorUuid)?.setFlag("dae", data.flagId, data.value);
  // @ts-expect-error can't know about flags
  else if (data.actorId) return await game.actors?.get(data.actorId)?.setFlag("dae", data.flagId, data.value);
  return undefined;
}

async function _unsetFlag(data: { actorUuid: string, flagId: string }) {
  // @ts-expect-error can't know about flags
  return await actorFromUuid(data.actorUuid)?.unsetFlag("dae", data.flagId)
}

async function _blindToken(data: { tokenUuid: string }) {
  const tokenDocument = getTokenDocument(data.tokenUuid);
  //@ts-expect-error .dfreds
  const dfreds = game.dfreds;
  if (!tokenDocument?.actor) return;
  if (dfreds?.effects?._blinded) {
    ceInterface.addEffect({ effectName: dfreds.effects._blinded.name, uuid: tokenDocument.actor?.uuid })
  } else if (ceInterface.findEffect && ceInterface.findEffect({ effectId: "ce-blinded" })) {
    if (!ceInterface.hasEffectApplied({ effectId: "ce-blinded", uuid: tokenDocument.actor.uuid }))
      ceInterface.addEffect({ effectId: "ce-blinded", uuid: tokenDocument.actor?.uuid })
  } else {
    const blind = CONFIG.statusEffects.find(se => se.id === CONFIG.specialStatusEffects.BLIND);
    if (blind) {
      return await tokenDocument.actor.toggleStatusEffect(blind.id, { active: true });
    }
  }
}

async function _restoreVision(data: { tokenUuid: string }) {
  const tokenDocument = getTokenDocument(data.tokenUuid);
  //@ts-expect-error .dfreds
  const dfreds = game.dfreds;
  if (!tokenDocument?.actor) return;
  if (dfreds?.effects?._blinded) {
    dfreds.effectInterface?.removeEffect({ effectName: dfreds.effects._blinded.name, uuid: tokenDocument.actor.uuid })
  } else if (ceInterface.findEffect && ceInterface.findEffect({ effectId: "ce-blinded" })) {
    if (ceInterface.hasEffectApplied({ effectId: "ce-blinded", uuid: tokenDocument.actor.uuid }))
      ceInterface.removeEffect({ effectId: "ce-blinded", uuid: tokenDocument.actor.uuid })
  } else {
    const blind = CONFIG.statusEffects.find(se => se.id === CONFIG.specialStatusEffects.BLIND);
    if (blind) {
      return await tokenDocument.actor.toggleStatusEffect(blind.id, { active: false });
    }
  }
}

async function _renameToken(data: { tokenData: any, newName: string }) { // TODO update this for uuids
  return await canvas?.tokens?.placeables.find(t => t.id === data.tokenData._id)?.document.update({ "name": data.newName })
}

async function _addTokenMagic(data: { tokenUuid: string, effectId: string }) {
  const tokenMagic = globalThis.TokenMagic;
  if (!tokenMagic) return;
  const token = getToken(data.tokenUuid);
  if (token) return await tokenMagic.addFilters(token, data.effectId);
}
async function _removeTokenMagic(data: { tokenUuid: string, effectId: string }) {
  const tokenMagic = globalThis.TokenMagic;
  if (!tokenMagic) return;
  const token = getToken(data.tokenUuid);
  if (token) return await tokenMagic.deleteFilters(token, data.effectId);
}

async function _deleteEffects(data: { targets: any[], origin: string, ignore: string[], deleteEffects: string[], removeSequencer: boolean, options: any }) {
  if (data.options === undefined) data.options = {};
  for (let idData of data.targets) {
    const actor = actorFromUuid(idData.uuid);
    if (!actor) {
      error("could not find actor for ", idData);
    }
    let effectsToDelete = actor?.effects?.filter(ef => ef.origin === data.origin && !data.ignore?.includes(ef.uuid));
    if (data.deleteEffects?.length > 0) effectsToDelete = effectsToDelete?.filter(ae => ae.id && data.deleteEffects.includes(ae.id))
    if (effectsToDelete && effectsToDelete?.length > 0) {
      try {
        if (!foundry.utils.getProperty(data, "options.expiry-reason")) foundry.utils.setProperty(data, "options.expiry-reason", "programmed-removal");
        await actor?.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete.map(ef => ef.id ?? "XXX"), data.options);
      } catch (err) {
        warn("delete effects failed ", err)
        // TODO can get thrown since more than one thing tries to delete an effect
        return false;
      }
    }
  }
  if (globalThis.Sequencer && data.origin && data.removeSequencer !== false) globalThis.Sequencer.EffectManager.endEffects({ origin: data.origin })
  return true;
}

export async function applyActiveEffects({ activate = true, activityUuid = undefined, targetList, activeEffects, effectDuration, itemCardUuid = null, removeMatchLabel = false, toggleEffect = false, metaData = {}, origin = undefined }) {
  for (let targetActorUuid of targetList) {
    let targetActor = fromUuidSync(targetActorUuid);
    if (!targetActor) continue;
    if (targetActor instanceof TokenDocument) targetActor = targetActor.actor; // for backwards compatibility
    if (!(targetActor instanceof Actor)) continue; // TODO: verify this is always true

    // Removal of existing is now handled by _preCreateActiveEffect override.
    // TODO workout what to do if activate is false? does not seem to be used anywhere to force delete effects
    if (activate) {
      let dupEffects = foundry.utils.duplicate(activeEffects).filter(effectData => effectData.flags?.dae?.dontApply !== true);

      dupEffects.forEach(effectData => {
        effectData.transfer = false;
        if (effectData.flags?.dae?.transfer !== undefined) delete effectData.flags.dae.transfer;
        // New effect so remove the source effects dependents
        foundry.utils.setProperty(effectData, "flags.dnd5e.dependents", []);
        effectData.changes.forEach(change => { if (change.key === "StatusEffect") change.key = "macro.StatusEffect" })
      });
      for (let aeData of dupEffects) {
        if (activityUuid) foundry.utils.setProperty(aeData, "flags.dae.activity", activityUuid);
        foundry.utils.setProperty(aeData, "flags.dae.actor", targetActor.uuid);
        if (aeData.changes.some(change => change.key === "macro.itemMacro")) { // populate the itemMacro data.
          let origin: any = fromUuidSync(aeData.origin);
          let item;
          let macroCommand;
          let count;
          for (count = 0; count < 10 && origin instanceof CONFIG.ActiveEffect.documentClass; count++) {
            //@ts-expect-error
            origin = await fromUuid(origin.origin);
          }
          if (count === 10) {
            console.warn("dae | applyActiveEffects: too many levels of active effects", aeData);
          } else if (origin instanceof Item) {
            item = origin;
            macroCommand = foundry.utils.getProperty(item, "flags.dae.macro.command") ?? foundry.utils.getProperty(item, "flags.itemacro.macro.command") ?? foundry.utils.getProperty(item, "flags.itemacro.macro.data.command");
          } 
          
          if (!macroCommand && aeData.flags?.dae?.itemData) {
            const itemData = foundry.utils.getProperty(aeData, "flags.dae.itemData");
            if (itemData)
              macroCommand = foundry.utils.getProperty(itemData, "flags.dae.macro.command") ?? foundry.utils.getProperty(itemData, "flags.itemacro.macro.command") ?? foundry.utils.getProperty(itemData, "flags.itemacro.macro.data.command");
          }
          foundry.utils.setProperty(aeData, "flags.dae.itemMacro", macroCommand)
        }
        if (aeData.changes.some(change => change.key === "macro.ActivityMacro")) { // populate the ActivityMacro data.  
          const activity = fromUuidSync(activityUuid);
          if (activity) {
            // @ts-expect-error no dnd5e-types
           const macroCommand = activity.macro?.command;
            foundry.utils.setProperty(aeData, "flags.dae.ActivityMacro", macroCommand)
          }
        }

        // convert item duration to seconds/rounds/turns according to combat
        if (aeData.duration.seconds) {
          aeData.duration.startTime = game.time?.worldTime;
          const inCombat = targetActor.inCombat;
          let convertedDuration;
          if (inCombat && (aeData.duration.rounds || aeData.duration.turns)) {
            convertedDuration = {
              type: "turns",
              rounds: aeData.duration.rounds ?? 0,
              turns: aeData.duration.turns ?? 0
            }
          } else convertedDuration = convertDuration({ value: aeData.duration.seconds, units: "second" }, inCombat, maxShortDuration);
          if (aeData.duration.seconds === -1) { // special case duration of -1 seconds
            delete convertedDuration.rounds;
            delete convertedDuration.turns;
            delete convertedDuration.seconds;
          }
          if (convertedDuration.type === "turns") {
            aeData.duration.rounds = convertedDuration.rounds;
            aeData.duration.turns = convertedDuration.turns;
            aeData.startRound = game.combat?.round;
            aeData.startTurn = game.combat?.turn;
            delete aeData.duration.seconds;
          }
        } else if (aeData.duration.rounds || aeData.duration.turns) {
          aeData.duration.startRound = game.combat?.round;
          aeData.duration.startTurn = game.combat?.turn;
        } else { // no specific duration on effect use spell duration
          const inCombat = targetActor.inCombat;
          const convertedDuration = convertDuration(effectDuration, inCombat, maxShortDuration);
          debug("converted duration ", convertedDuration, inCombat, effectDuration, maxShortDuration);
          if (convertedDuration.type === "seconds") {
            aeData.duration.seconds = convertedDuration.seconds;
            aeData.duration.startTime = game.time?.worldTime;
          } else if (convertedDuration.type === "turns") {
            aeData.duration.rounds = convertedDuration.rounds;
            aeData.duration.turns = convertedDuration.turns;
            aeData.duration.startRound = game.combat?.round;
            aeData.duration.startTurn = game.combat?.turn;
          }
        }
        warn("Apply active effects ", aeData, itemCardUuid);
        let source: any | undefined = await fromUuid(aeData.origin);
        let context = targetActor.getRollData();
        if (false && source instanceof CONFIG.Item.documentClass) {
          context = source?.getRollData();
        }
        context = foundry.utils.mergeObject(context, { "target": getTokenDocument(targetActor)?.id, "targetUuid": getTokenDocument(targetActor)?.uuid, "targetActorUuid": targetActor?.uuid, itemCardUuid: itemCardUuid, "@target": "target", "stackCount": "@stackCount", "item": "@item", "itemData": "@itemData" });

        let newChanges: any[] = [];
        for (let change of aeData.changes) {
          if (allMacroEffects.includes(change.key) || ["flags.dae.onUpdateTarget", "flags.dae.onUpdateSource"].includes(change.key)) {
            let originEntity = fromUuidSync(aeData.origin);
            let originItem;
            let sourceActor;
            if (originEntity instanceof Item) {
              originItem = originEntity;
              sourceActor = originEntity.actor;
            } else if (originEntity instanceof Actor) sourceActor = originEntity;
            else if (originEntity instanceof ActiveEffect && originEntity.transfer) sourceActor = originEntity?.parent?.parent;
            else if (originEntity instanceof ActiveEffect) {
              sourceActor = originEntity?.parent;
              if (sourceActor instanceof CONFIG.Item.documentClass) {
                sourceActor = sourceActor.actor;
              }
            }

            if (change.key === "flags.dae.onUpdateTarget") {
              // for onUpdateTarget effects, put the source actor, the target uuid, the origin and the original change.value
              change.value = `${aeData.origin}, ${getTokenDocument(targetActor)?.uuid}, ${tokenForActor(sourceActor)?.document.uuid ?? ""}, ${sourceActor.uuid}, ${change.value}`;
            } else if (change.key === "flags.dae.onUpdateSource") {
              change.value = `${aeData.origin}, ${tokenForActor(sourceActor)?.document.uuid ?? ""}, ${getTokenDocument(targetActor)?.uuid}, ${sourceActor.uuid}, ${change.value}`;
              const newEffectData = foundry.utils.duplicate(aeData);
              newEffectData.changes = [foundry.utils.duplicate(change)];
              newEffectData.changes[0].key = "flags.dae.onUpdateTarget";
              const effects = await sourceActor.createEmbeddedDocuments("ActiveEffect", [newEffectData], { metaData });
              if (effects) for (let effect of effects) {
                const origin = fromUuidSync(effect.origin);
                //@ts-expect-error no dnd5e-types
                if (origin instanceof ActiveEffect && origin.addDependent) {
                  //@ts-expect-error no dnd5e-types
                  await origin.addDependent(effect);
                }
              }
            }

            // if (["macro.execute", "macro.itemMacro", "roll", "macro.actorUpdate"].includes(change.key)) {
            if (typeof change.value === "number") {
            } else if (typeof change.value === "string") {
              change.value = Roll.replaceFormulaData(change.value, context, { missing: '0', warn: false });
              change.value = change.value.replace("##", "@");
            } else {
              change.value = foundry.utils.duplicate(change.value).map(f => {
                if (f === "@itemCardId") {
                  foundry.utils.logCompatibilityWarning("DAE | @itemCardId is deprecated use @itemCardUuid instead",
                  {since: "12.0.21", until: "13.0.0"});
                  const itemCard = fromUuidSync(itemCardUuid);
                  return itemCard?.id;
                }
                if (f === "@itemCardUuid") return itemCardUuid;
                if (f === "@target") return getToken(targetActor)?.id;
                if (f === "@targetUuid") return getTokenDocument(targetActor)?.uuid;
                return f;
              })
            }
          } else {
            const targetContext = { "targetUuid": getTokenDocument(targetActor)?.uuid, "target": getToken(targetActor)?.id, "tokenUuid": getTokenDocument(targetActor)?.uuid, "token": getToken(targetActor)?.id };
            for (let key of Object.keys(targetContext)) {
              change.value = change.value.replace(`@${key}`, targetContext[key])
            }
          }
          newChanges.push(change);
        }
        aeData.changes = newChanges
      }

      if (dupEffects.length > 0) {
        if (debugEnabled > 0) warn(`applyActiveEffects creating effects ${targetActor.name}`, dupEffects)
        let createdEffects = (await targetActor.createEmbeddedDocuments("ActiveEffect", dupEffects, { toggleEffect, metaData })) ?? [];
        for (let effect of createdEffects) {
          const origin = fromUuidSync(effect.origin as MustBeValidUuid<string>);
          // @ts-expect-error
          if (origin?.addDependent) await origin.addDependent(effect);
        }
      }
    }
  };
}

export function convertDuration(durationData: { units: string, value: number }, inCombat, maxSecondsToConvert = Number.POSITIVE_INFINITY) {
  // TODO rewrite this abomination - for v13 look at default calendar
  let useTurns = inCombat && timesUpInstalled;
  if (durationData.units === "second" && durationData.value > maxSecondsToConvert) useTurns = false;
  if (!durationData || (durationData.units === "second" && durationData.value < CONFIG.time.roundTime)) { // no duration or very short (less than 1 round)
    if (useTurns)
      return { type: "turns", seconds: 0, rounds: 0, turns: 1 };
    else
      return { type: "seconds", seconds: Math.min(1, durationData?.value ?? 1), rounds: 0, turns: 0 };
  }

  if (!simpleCalendarInstalled) {
    switch (durationData.units) {
      case "turn":
      case "turns": return { type: useTurns ? "turns" : "seconds", seconds: 1, rounds: 0, turns: durationData.value };
      case "round":
      case "rounds": return { type: useTurns ? "turns" : "seconds", seconds: durationData.value * CONFIG.time.roundTime, rounds: durationData.value, turns: 0 }
      case "second":
      case "seconds":
        return { type: useTurns ? "turns" : "seconds", seconds: durationData.value, rounds: durationData.value / CONFIG.time.roundTime, turns: 0 }
      case "minute":
      case "minutes":
        let durSeconds = durationData.value * 60
        if (durSeconds / CONFIG.time.roundTime <= 10) {
          return { type: useTurns ? "turns" : "seconds", seconds: durSeconds, rounds: durSeconds / CONFIG.time.roundTime, turns: 0 };
        } else {
          return { type: "seconds", seconds: durSeconds, rounds: durSeconds / CONFIG.time.roundTime, turns: 0 };
        }
      case "hour":
      case "hours": return { type: "seconds", seconds: durationData.value * 60 * 60, rounds: 0, turns: 0 };
      case "day":
      case "days": return { type: "seconds", seconds: durationData.value * 60 * 60 * 24, rounds: 0, turns: 0 };
      case "week":
      case "weeks": return { type: "seconds", seconds: durationData.value * 60 * 60 * 24 * 7, rounds: 0, turns: 0 };
      case "month":
      case "months": return { type: "seconds", seconds: durationData.value * 60 * 60 * 24 * 30, rounds: 0, turns: 0 };
      case "year":
      case "years": return { type: "seconds", seconds: durationData.value * 60 * 60 * 24 * 30 * 365, rounds: 0, turns: 0 };
      case "inst":
      case "spec": 
      case "perm":
      case "disp":
      case "distr":
        return { type: useTurns ? "none" : "none", seconds: undefined, rounds: undefined, turns: undefined };
      default:
        warn("dae | unknown time unit found", durationData.units);
        return { type: useTurns ? "none" : "none", seconds: undefined, rounds: undefined, turns: undefined };
    }
  } else {
    switch (durationData.units) {
      case "perm":
        return { type: "seconds", seconds: undefined, rounds: undefined, turns: undefined };
      case "turn":
      case "turns": return { type: useTurns ? "turns" : "seconds", seconds: 1, rounds: 0, turns: durationData.value };
      case "round":
      case "rounds": return { type: useTurns ? "turns" : "seconds", seconds: durationData.value * CONFIG.time.roundTime, rounds: durationData.value, turns: 0 }
      case "second":
        return { type: useTurns ? "turns" : "seconds", seconds: durationData.value, rounds: durationData.value / CONFIG.time.roundTime, turns: 0 };
      case "inst":
      case "spec":
      case "perm":
      case "disp":
      case "distr":
        return { type: useTurns ? "none" : "seconds", seconds: undefined, rounds: undefined, turns: undefined };
      default:
        let interval = {}
        interval[durationData.units] = durationData.value;
        const durationSeconds = globalThis.SimpleCalendar.api.timestampPlusInterval(game.time?.worldTime, interval) - (game.time?.worldTime ?? 0);
        if (durationSeconds / CONFIG.time.roundTime <= 10) {
          return { type: useTurns ? "turns" : "seconds", seconds: durationSeconds, rounds: Math.floor(durationSeconds / CONFIG.time.roundTime), turns: 0 };
        } else {
          return { type: "seconds", seconds: durationSeconds, rounds: Math.floor(durationSeconds / CONFIG.time.roundTime), turns: 0 };
        }
      //      default: return {type: combat ? "none" : "seconds", seconds: CONFIG.time.roundTime, rounds: 0, turns: 1};
    }
  }
}
