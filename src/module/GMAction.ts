import { allMacroEffects, tokenForActor, delay, actorFromUuid, getTokenDocument, getToken, ceInterface, getStatusEffectsArray, getItemMacroCommand, syncDependents } from "./dae.js";
import { resolveMacro } from "./lib/macroResolution.js";
import { warn, debug, error, debugEnabled, i18nFormat, i18n } from "../dae.js";
import { AnyMutableObject, AnyObject, MustBeValidUuid } from "fvtt-types/utils";

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
export let socketlibSocket: any = undefined;
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
  socketlibSocket.register("syncDependents", _syncDependents);
  socketlibSocket.register("executeMacro", _executeMacro);
  socketlibSocket.register("createActorItem", _createActorItem);
  socketlibSocket.register("removeActorItem", _removeActorItem);
  socketlibSocket.register("_updateActor", _updateActor)
  socketlibSocket.register("itemReplaceEffects", _itemReplaceEffects);
}

async function _itemReplaceEffects(data: { itemUuid: string, effects: ActiveEffect.Source[] }) {
  const item = fromUuidSync(data.itemUuid) as Item | undefined;
  return item?.update({ "effects": data.effects });
}

async function _updateActor(data: { actorUuid: string, update: Actor.UpdateData, context: Actor.Database.UpdateOperation }) {
  const actor = (await fromUuid(data.actorUuid)) as Actor | undefined;
  return actor?.update(data.update, data.context)
}

async function _removeActorItem(data: { uuid: string, itemUuid: string, itemUuids: string[], context: Item.Database.DeleteOperation }) {
  const { itemUuids, context } = data;

  for (let itemUuid of itemUuids ?? []) {
    const item = await fromUuid(itemUuid);
    if (!(item instanceof Item) || !item?.isOwned) continue; // Just in case we are trying to delete a world/compendium item
    await item.delete(context);
  }
}

async function _createActorItem(data: { uuid: string, itemDetails: string, effectUuid: string, callItemMacro: boolean }): Promise<Array<Item>> {
  const { uuid, itemDetails, effectUuid } = data;
  const [itemUuid, option] = itemDetails.split(",").map(s => s.trim());
  let item = await fromUuid(itemUuid) as Item.Implementation | undefined;
  if (!item) item = game.items?.getName(itemUuid); // try to find the item by name if was not a uuid.
  if (!item || !(item instanceof Item)) {
    error(`createActorItem could not find item ${itemUuid}`);
    return [];
  }
  let actor = actorFromUuid(uuid);
  if (!actor) {
    error(`createActorItem could not find Actor ${uuid}`);
    return [];
  }

  let itemData = item?.toObject(true);
  if (!itemData) return [];
  //@ts-expect-error no dnd5e-types
  if (actor?.sheet?.constructor.unsupportedItemTypes.has(itemData.type)) {
    ui.notifications?.warn(i18nFormat("DND5E.ActorWarningInvalidItem", {
      itemType: i18n(CONFIG.Item.typeLabels[itemData.type]),
      actorType: i18n(CONFIG.Actor.typeLabels[actor.type])
    }));
    return [];
  }

  // Strip advancements from temporary items — they are removed when the effect ends,
  // and unprocessed advancements would confuse users. Level-up could also trigger
  // advancement processing on the temporary item, leaving orphaned grants behind.
  if (itemData.system.advancement?.length) itemData.system.advancement = [];
  foundry.utils.setProperty(itemData, "flags.dae.DAECreated", true);
  const documents = await actor.createEmbeddedDocuments("Item", [itemData]);
  if (data.callItemMacro) {
    const change = { key: "macro.itemMacro" } as ActiveEffect.ChangeData;
    for (let item of documents) {
      // const effectData = { itemUuid: item.uuid, flags: {} }
      // const macro = await getMacro({ change, name: "" }, item, effectData);
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
  const effect = await fromUuid(effectUuid) as ActiveEffect.Implementation | undefined;
  if (!effect) {
    console.warn(`dae | createActorItem could not fetch ${effectUuid}`);
    return documents;
  }
  const itemsToDelete = effect.flags.dae?.itemsToDelete ?? [];
  itemsToDelete.push(documents[0].uuid);
  await effect.setFlag("dae", "itemsToDelete", itemsToDelete);
  return documents;
}

async function _executeMacro(data: {
  action: string,
  args: never[],
  lastArg: AnyObject,
  macroData: {
    change: ActiveEffect.ChangeData;
    name: string;
    effectData?: ActiveEffect.Source;
  },
  actor: Actor.Implementation,
  token?: foundry.canvas.placeables.Token,
  item: Item.Implementation
}) {
  const macro = await resolveMacro(data.macroData.change.key, data.macroData.name, data.item, data.macroData.effectData);
  if (!macro?.command) return;
  let v11args: any = {};
  v11args[0] = data.action;
  v11args[1] = data.lastArg;
  v11args.length = 2;
  v11args.lastArg = data.lastArg;
  const speaker = data.actor ? ChatMessage.getSpeaker({ actor: data.actor }) : undefined;
  const AsyncFunction = (async function () { }).constructor;
  //@ts-expect-error for some reason
  const fn = new AsyncFunction("speaker", "actor", "token", "character", "item", "args", macro.command);
  return fn.call(this, speaker, data.actor, data.token, undefined, data.item, v11args);
}

async function _suspendActiveEffect(data: { uuid: string }) {
  const effect = await fromUuid(data.uuid);
  if (!effect) return;
  if (effect instanceof CONFIG.ActiveEffect.documentClass) {
    return effect.update({ disabled: true });
  }
}

/** For a user who owns the parent effect, bring its dependents into line with it. */
async function _syncDependents(this: { socketdata?: { userId?: string } }, data: { uuid: string }) {
  const user = game.users?.get(this?.socketdata?.userId ?? "");
  const effect = fromUuidSync(data.uuid as MustBeValidUuid<string>);
  if (!user || !(effect instanceof ActiveEffect) || !effect.testUserPermission(user, "OWNER")) return;
  return syncDependents(effect);
}

async function _deleteUuid(data: { uuid: string }) {
  // don't allow deletion of compendium entries or world Items
  if (data.uuid.startsWith("Compendium") || data.uuid.startsWith("Item")) return false;
  const entity = fromUuidSync(data.uuid as MustBeValidUuid<string>);
  if (!entity) return false;
  if (entity instanceof Item) return await entity.delete();
  if (entity instanceof TokenDocument) return await entity.delete();
  if (entity instanceof ActiveEffect) return await entity.delete();
  if (entity instanceof MeasuredTemplateDocument) return await entity.delete();
  return false;
}

function _testMessage(data) {
  console.log("DyamicEffects | test message received", data);
  return "Test message received and processed";
}
async function _setTokenVisibility(data: { tokenUuid: string, hidden: boolean }) {
  await (fromUuidSync(data.tokenUuid) as TokenDocument.Implementation)?.update({ hidden: data.hidden });
}

async function _setTileVisibility(data: { tileUuid: string, hidden: boolean }) {
  return await (fromUuidSync(data.tileUuid) as TileDocument.Implementation)?.update({ hidden: data.hidden })
}

async function _applyActiveEffects(data: ApplyActiveEffectsInput) {
  return await applyActiveEffects(data);
}
async function _recreateToken(data: { userId: string, tokenUuid: string, startSceneId: string, targetSceneId: string, tokenData: TokenDocument.CreateData, x: number, y: number }) {
  //TODO this looks odd - should get the token data form the tokenUuid?
  await _createToken(data);
  const token = fromUuidSync(data.tokenUuid) as TokenDocument.Implementation;
  return token?.delete();
}

async function _createToken(data: { userId: string, targetSceneId: string, tokenData: TokenDocument.CreateData, x: number, y: number }) {
  let scenes = game.scenes;
  let targetScene = scenes?.get(data.targetSceneId);
  let tokenData = foundry.utils.mergeObject(data.tokenData, {
    x: data.x,
    y: data.y,
    hidden: false
  }, {
    inplace: false
  });
  return await targetScene?.createEmbeddedDocuments('Token', [tokenData]);
}

async function _deleteToken(data: { tokenUuid: string }) {
  return (fromUuidSync(data.tokenUuid) as TokenDocument.Implementation)?.delete();
}

async function _setTokenFlag(data: { flagName: string, flagValue: any, tokenUuid: string }) {
  const tokenDocument = getTokenDocument(data.tokenUuid);
  // @ts-expect-error I'm (Michael) unaware of any dae-specific token document flags, so was unable to document them
  return await tokenDocument?.setFlag("dae", data.flagName, data.flagValue);
}

async function _setFlag(data: { actorUuid: string | undefined, actorId: string | undefined, flagId: string, value: any }) {
  if (data.actorUuid) return await actorFromUuid(data.actorUuid)?.setFlag("dae", data.flagId as keyof FlagConfig["Actor"]["dae"], data.value as never);
  else if (data.actorId) return await game.actors?.get(data.actorId)?.setFlag("dae", data.flagId as keyof FlagConfig["Actor"]["dae"], data.value as never);
  return undefined;
}

async function _unsetFlag(data: { actorUuid: string, flagId: string }) {
  return await actorFromUuid(data.actorUuid)?.unsetFlag("dae", data.flagId as keyof FlagConfig["Actor"]["dae"])
}

async function _blindToken(data: { tokenUuid: string }) {
  const tokenDocument = getTokenDocument(data.tokenUuid);
  if (!tokenDocument?.actor) return;
  const blind = getStatusEffectsArray().find(se => se.id === CONFIG.specialStatusEffects.BLIND);
  if (blind) {
    return await tokenDocument.actor.toggleStatusEffect(blind.id, { active: true });
  }
}

async function _restoreVision(data: { tokenUuid: string }) {
  const tokenDocument = getTokenDocument(data.tokenUuid);
  if (!tokenDocument?.actor) return;
  const blind = getStatusEffectsArray().find(se => se.id === CONFIG.specialStatusEffects.BLIND);
  if (blind) {
    return await tokenDocument.actor.toggleStatusEffect(blind.id, { active: false });
  }
}

async function _renameToken(data: { tokenData: foundry.canvas.placeables.Token.Source, newName: string }) { // TODO update this for uuids
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

/**
 * Whether an effect came from `origin`. An item's uuid also matches effects whose origin is one of its effects or
 * activities, or that DAE recorded as applied from it (`flags.dae.itemUuid`); any other uuid must match exactly.
 */
function fromOrigin(effect: ActiveEffect.Implementation, origin: string): boolean {
  if (!origin) return false;
  if (effect.origin === origin) return true;
  if (foundry.utils.parseUuid(origin)?.type !== "Item") return false;
  return !!effect.origin?.startsWith(`${origin}.`) || effect.flags?.dae?.itemUuid === origin;
}

async function _deleteEffects(data: { targets: { uuid: string }[], origin: string, ignore: string[], deleteEffects: string[], removeSequencer: boolean, options?: ActiveEffect.Database.DeleteOperation }) {
  if (data.options === undefined) data.options = {};
  for (let idData of data.targets) {
    const actor = actorFromUuid(idData.uuid);
    if (!actor) {
      error("could not find actor for ", idData);
      continue;
    }
    let effectsToDelete = actor.effects.filter(ef => fromOrigin(ef, data.origin) && !data.ignore?.includes(ef.uuid));
    if (data.deleteEffects?.length > 0) effectsToDelete = effectsToDelete.filter(ae => ae.id && data.deleteEffects.includes(ae.id))
    if (effectsToDelete.length > 0) {
      try {
        if (!foundry.utils.getProperty(data, "options.expiry-reason")) foundry.utils.setProperty(data, "options.expiry-reason", "programmed-removal");
        await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete.map(ef => ef.id ?? "XXX"), data.options);
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

export async function applyActiveEffects({
  activate = true,
  activityUuid = undefined,
  targetList,
  activeEffects,
  effectDuration,
  itemCardUuid = null,
  removeMatchLabel = false,
  toggleEffect = false,
  metaData = {},
  origin = undefined
}: ApplyActiveEffectsInput) {
  for (let targetActorUuid of targetList) {
    let targetActor = fromUuidSync(targetActorUuid);
    if (!targetActor) continue;
    if (targetActor instanceof TokenDocument) targetActor = targetActor.actor; // for backwards compatibility
    if (!(targetActor instanceof Actor)) continue; // TODO: verify this is always true

    // Removal of existing is now handled by _preCreateActiveEffect override.
    // TODO workout what to do if activate is false? does not seem to be used anywhere to force delete effects
    if (activate) {
      let dupEffects = foundry.utils.duplicate(activeEffects.filter(effectData => effectData.flags?.dae?.dontApply !== true));

      dupEffects.forEach(effectData => {
        effectData.transfer = false;
        if (effectData.flags?.dae?.transfer !== undefined) delete effectData.flags.dae.transfer;
        // @ts-expect-error v14 system.changes
        effectData.system.changes.forEach(change => { if (change.key === "StatusEffect") change.key = "macro.StatusEffect" })
      });
      for (let aeData of dupEffects) {
        if (activityUuid) foundry.utils.setProperty(aeData, "flags.dae.activity", activityUuid);
        foundry.utils.setProperty(aeData, "flags.dae.actor", targetActor.uuid);
        // @ts-expect-error v14 system.changes
        if (aeData.system.changes.some(change => change.key === "macro.itemMacro")) { // populate the itemMacro data.
          let origin = fromUuidSync(aeData.origin);
          let item: Item.Implementation;
          let macroCommand: string | undefined | null;
          let count: number;
          for (count = 0; count < 10 && origin instanceof CONFIG.ActiveEffect.documentClass && !(origin.parent instanceof Item); count++) {
            if (origin.parent instanceof CONFIG.Item.documentClass) origin = origin.parent;
            else {
              origin = await fromUuid(origin.origin);
            }
          }
          if (count === 10) {
            console.warn("dae | applyActiveEffects: too many levels of active effects", aeData);
          } else if (origin instanceof Item) {
            item = origin;
            macroCommand = getItemMacroCommand(item);
          } else if (origin?.parent instanceof Item) {
            item = origin.parent;
            macroCommand = getItemMacroCommand(item);
          }

          if (!macroCommand && aeData.flags?.dae?.itemData) {
            macroCommand = getItemMacroCommand(aeData.flags.dae.itemData);
          }
          foundry.utils.setProperty(aeData, "flags.dae.itemMacro", macroCommand)
        }
        // Inherit the activity/item duration only if the effect has neither a duration nor an expiry event (as dnd5e 6)
        // @ts-expect-error v14 duration.value
        const aeValue = aeData.duration.value;
        // Elapsed Time ends the effect when its duration has passed: no event of its own
        // @ts-expect-error v14 duration.expiry not in fvtt-types yet
        const aeExpiry = aeData.duration.expiry === "updateWorldTime" ? null : aeData.duration.expiry;
        if (!Number.isFinite(aeValue) && !aeExpiry && effectDuration?.value && effectDuration?.units) {
          // Map dnd5e singular units to Foundry v14 plural units
          const mappedUnits = dnd5eToFoundryUnits[effectDuration.units] ?? effectDuration.units;
          // @ts-expect-error v14 duration.value
          aeData.duration.value = effectDuration.value;
          // @ts-expect-error v14 duration.units
          aeData.duration.units = mappedUnits;
          debug("inherited duration from activity/item", effectDuration, "→", mappedUnits);
        }
        warn("Apply active effects ", aeData, itemCardUuid);
        let source = await fromUuid(aeData.origin);
        let context = targetActor.getRollData();
        if (source instanceof CONFIG.Item.documentClass) {
          context = source?.getRollData();
        }
        const targetTokenDoc = getTokenDocument(targetActor);
        const targetToken = getToken(targetActor);
        context = foundry.utils.mergeObject(context, {
          target: targetTokenDoc?.id,
          targetUuid: targetTokenDoc?.uuid,
          targetActorUuid: targetActor?.uuid,
          itemCardUuid: itemCardUuid,
          "@target": "target",
          stackCount: "@stackCount",
          item: "@item",
          itemData: "@itemData"
        });

        let newChanges: ActiveEffect.ChangeData[] = [];
        // @ts-expect-error v14 system.changes
        for (let change of aeData.system.changes) {
          if (allMacroEffects.includes(change.key) || ["flags.dae.onUpdateTarget", "flags.dae.onUpdateSource"].includes(change.key)) {
            let originEntity = fromUuidSync(aeData.origin, { strict: false }) as AnyObject | undefined;
            let originItem: Item.Implementation;
            let sourceActor: Actor.Implementation | null | undefined;
            if (!originEntity) {
              // A temporary item (a synthetic roll, a used-up consumable) cannot be resolved; its actor still can.
              const sourceUuid = aeData.origin ?? aeData.flags?.dae?.itemUuid;
              const actor = fromUuidSync(sourceUuid?.split(".Item.")[0] ?? "", { strict: false });
              if (actor instanceof Actor) sourceActor = actor;
            } else if (originEntity instanceof Item) {
              originItem = originEntity;
              sourceActor = originEntity.actor;
            } else if (originEntity instanceof Actor) sourceActor = originEntity;
            else if (originEntity instanceof ActiveEffect && originEntity.transfer) sourceActor = (originEntity?.parent as Item.Implementation)?.parent;
            else if (originEntity instanceof ActiveEffect) {
              sourceActor = originEntity?.parent instanceof Item ? originEntity.parent.actor : originEntity.parent;
            } else if (originEntity) { // originEntity is an activity
              sourceActor = originEntity?.actor as Actor.Implementation | undefined;
            }
            if (!sourceActor) continue;
            if (change.key === "flags.dae.onUpdateTarget") {
              // for onUpdateTarget effects, put the source actor, the target uuid, the origin and the original change.value
              change.value = `${aeData.origin}, ${targetTokenDoc?.uuid}, ${tokenForActor(sourceActor)?.document.uuid ?? ""}, ${sourceActor.uuid}, ${change.value}`;
            } else if (change.key === "flags.dae.onUpdateSource") {
              change.value = `${aeData.origin}, ${tokenForActor(sourceActor)?.document.uuid ?? ""}, ${targetTokenDoc?.uuid}, ${sourceActor.uuid}, ${change.value}`;
              const newEffectData = foundry.utils.duplicate(aeData);
              // @ts-expect-error v14 system.changes
              newEffectData.system.changes = [foundry.utils.duplicate(change)];
              // @ts-expect-error v14 system.changes
              newEffectData.system.changes[0].key = "flags.dae.onUpdateTarget";
              if (game.system.id === "dnd5e" && aeData.origin) {
                foundry.utils.setProperty(newEffectData, "flags.dnd5e.dependentOn", aeData.origin)
              }
              // @ts-expect-error TODO (Michael) What's up with this metaData
              await sourceActor.createEmbeddedDocuments("ActiveEffect", [newEffectData as ActiveEffect.CreateData], { metaData });
            }

            // if (["macro.execute", "macro.itemMacro", "roll", "macro.actorUpdate"].includes(change.key)) {
            if (typeof change.value === "number") {
            } else if (typeof change.value === "string") {
              change.value = Roll.replaceFormulaData(change.value, context, { missing: '0', warn: false });
              change.value = change.value.replace("##", "@");
            } else {
              change.value = foundry.utils.duplicate(change.value).map(f => {
                if (f === "@itemCardUuid") return itemCardUuid;
                if (f === "@target") return targetToken?.id;
                if (f === "@targetUuid") return targetTokenDoc?.uuid;
                return f;
              });
            }
          } else {
            if (typeof change.value === "string") {
              const targetContext = { "targetUuid": targetTokenDoc?.uuid, "target": targetToken?.id, "tokenUuid": targetTokenDoc?.uuid, "token": targetToken?.id };
              for (let key of Object.keys(targetContext)) {
                change.value = change.value.replace(`@${key}`, targetContext[key])
              }
            }
          }
          newChanges.push(change as ActiveEffect.ChangeData);
        }
        // @ts-expect-error v14 system.changes
        aeData.system.changes = newChanges
        if (game.system.id === "dnd5e" && aeData.origin) {
          foundry.utils.setProperty(aeData, "flags.dnd5e.dependentOn", aeData.origin)
        }
      }

      if (dupEffects.length > 0) {
        if (debugEnabled > 0) warn(`applyActiveEffects creating effects ${targetActor.name}`, dupEffects)
        // @ts-expect-error TODO (Michael) What's up with this toggleEffect/metaData
        await targetActor.createEmbeddedDocuments("ActiveEffect", dupEffects as ActiveEffect.CreateData[], { toggleEffect, metaData });
      }
    }
  };
}

// Map dnd5e singular duration units to Foundry v14 plural units
const dnd5eToFoundryUnits: Record<string, string> = {
  turn: "turns", round: "rounds", second: "seconds", minute: "minutes",
  hour: "hours", day: "days", week: "weeks", month: "months", year: "years"
};

/** @deprecated Foundry v14 handles duration natively. Use dnd5eToFoundryUnits map for unit conversion. */
export function convertDuration(durationData: { units: string, value: number }, _inCombat?: boolean, _maxSecondsToConvert?: number) {
  if (!durationData?.value || ["spec", "perm", "disp", "distr", "inst"].includes(durationData.units)) {
    return { type: "none", value: undefined, units: undefined };
  }
  const units = dnd5eToFoundryUnits[durationData.units] ?? durationData.units;
  const type = ["rounds", "turns"].includes(units) ? "turns" : "seconds";
  return { type, value: durationData.value, units };
}

interface ApplyActiveEffectsInput {
  activate: boolean;
  activityUuid?: string;
  targetList: string[];
  activeEffects: ActiveEffect.Source[];
  effectDuration: { units: string, value: number };
  itemCardUuid?: string | null;
  removeMatchLabel: boolean;
  toggleEffect: boolean;
  metaData: AnyMutableObject;
  origin?: string;
}
