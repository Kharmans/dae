import { effectIsTransfer } from "./dae.js";

export async function fixTransferEffects(actor: Actor.Implementation) {
  if (!actor) {
    return;
  }
  let items = Array.from(actor.items) || [];
  return await _fixTransferEffects(actor, items);
}

async function _fixTransferEffects(actor: Actor.Implementation, itemsToCheck: Item.Implementation[]) {
  let items = itemsToCheck.filter(i => i.effects.some(e => effectIsTransfer(e)));
  let transferEffects = actor.effects.filter(e => (!e.isTemporary || effectIsTransfer(e)) && !!e.origin?.includes("Item."));
  console.warn("Deleting effects", transferEffects)
  await actor.deleteEmbeddedDocuments("ActiveEffect", transferEffects.map(e => e.id!));
  const toCreate = items.map(i => i.toObject())
  console.warn("Deleting items ", items.map(i => i.id))
  await actor.deleteEmbeddedDocuments("Item", items.map(i => i.id!));
  console.warn("Creating items ", toCreate)
  await actor.createEmbeddedDocuments("Item", toCreate);
}

export async function fixTransferEffect(actor: Actor.Implementation, item: Item.Implementation) {
  if (!item) {
    return;
  }
  let items = [item];
  return await _fixTransferEffects(actor, items);
}


async function removeDaePassiveEffectsActor(actor, skipOrigins = false) {
  if (!actor) return;
  const effectsToDelete = actor.effects.filter(ef => foundry.utils.getProperty(ef, "flags.dae.transfer"));
  if (effectsToDelete?.length > 0) {
    console.log("Actor ", actor.name, "removing legacy effects", effectsToDelete.map(ef => ef.name));
    await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete.map(ef => ef.id));
  }
  if (!skipOrigins) {
    for (let item of actor.items) {
      for (let effect of item.effects) {
        const effectsToUpdate = item.effects.filter(ef => ef.transfer && ef.origin !== item.uuid);
        if (effectsToUpdate?.length > 0) {
          console.log("Actor", actor.name, "updating origin for ", item.name, effectsToUpdate.map(ef => ef.name));
          await item.updateEmbeddedDocuments("ActiveEffect", effectsToUpdate.map(ef => ({ _id: effect.id, origin: item.uuid })))
        }
      }
    }
  }
}
export async function removeScenePassiveEffects() {
  for (let token of canvas?.scene?.tokens ?? []) {
    try {
      if (token.actor) await removeDaePassiveEffectsActor(token.actor, false);
    } catch (err) {
      console.warn("error when removing legacy passive effects for", token?.actor?.name, err)
    }
  }
  ui.notifications?.notify("Scene Token legacy passive effects removed")
}

export async function removeActorsPassiveEffects() {
  for (let actor of game.actors ?? []) {
    try {
      await removeDaePassiveEffectsActor(actor, false);
    } catch (err) {
      console.warn("error when removing legacy passive effects for", actor?.name, err)
    }
  }
  ui.notifications?.notify("Actor legacy passive effects removed")
}

export async function migrateCompendium(pack) {
  const documentName = pack.documentName;
  if (!["Actor"].includes(documentName)) return;

  // Unlock the pack for editing
  const wasLocked = pack.locked;
  await pack.configure({ locked: false });
  //@ts-expect-error no dnd5e-types
  game.dnd5e.moduleArt.suppressArt = true;

  const documents = await pack.getDocuments();

  // Iterate over compendium entries - applying fine-tuned migration functions
  for (let doc of documents) {
    try {
      switch (documentName) {
        case "Actor":
          console.log(`Checking ${documentName} document ${doc.name} in Compendium ${pack.collection}`);
          await removeDaePassiveEffectsActor(doc, true);
          break;
        default:
          break;
      }
    }

    // Handle migration failures
    catch (err: any) {
      err.message = `Legacy passive wEffect removal for document ${doc.name} in pack ${pack.collection} failed: ${err.message}`;
      console.error(err);
    }
  }
  // Apply the original locked status for the pack
  await pack.configure({ locked: wasLocked });
  //@ts-expect-error no dnd5e-types
  game.dnd5e.moduleArt.suppressArt = false;
  ui.notifications?.notify(`Removed Passive effects for all ${documentName} documents from Compendium ${pack.collection}`);
};

export async function removeCompendiaPassiveEffects() {
  // Migrate World Compendium Packs
  for (let p of game.packs ?? []) {
    // if (p.metadata.packageType !== "world") continue;
    if (!["Actor"].includes(p.documentName)) continue;
    console.log("doing compendium", p.collection)
    await migrateCompendium(p);
  }
  ui.notifications?.notify("Finished compendium clean up")
}

export async function removeAllScenesPassiveEffects() {
  if (game.scenes)
    for (let scene of game.scenes) {
      for (let token of scene.tokens) {
        if (token.actorLink || !token.actor) continue;
        await removeDaePassiveEffectsActor(token.actor, true);
      }
    }
  ui.notifications?.notify("All Scene Token legacy passive effects removed")
}