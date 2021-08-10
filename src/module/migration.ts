
import { debug, warn, log, i18n } from "../dae";
import { ValidSpec } from "./dae";

//@ts-ignore
const EFFECTMODES = CONST.ACTIVE_EFFECT_MODES;

export async function removeItemArmorEffects(items, name = "") {
  let promises = [];
  for (let item of items) {
    let toDelete = [];
    if (!item.effects) continue;
    for (let effect of item.effects) {
      if (effect.data.flags?.dae?.armorEffect) toDelete.push(effect.id);
    }
    if (toDelete.length > 0) {
      if (item.parent) {
        let itemData = duplicate(item.data._source);
        for (let effectId of toDelete) {
          // a bit kludgy but there will only be a single item to delete
          itemData.effects = itemData.effects.filter(effectData => effectData._id !== effectId);
        }
        console.warn(`deleting ${name}: Ownded Item effects ${item.name}`, itemData.effects);
        await item.parent.deleteEmbeddedDocuments("Item", [itemData._id]);
        await item.parent.createEmbeddedDocuments("Item", [itemData]);
      } else {
        console.warn(`deleting ${name}: Item effects ${item.name}`);
        await item.deleteEmbeddedDocuments("ActiveEffect", toDelete);
      }
    }
  }
}

export async function removeActorEffectsArmorEffects(actor, name = "") {
  let promises = [];
    let toDelete = [];
    if (!actor.effects) return [];;
    for (let effect of actor.effects) {
      if (effect.data.flags?.dae?.armorEffect) toDelete.push(effect.id);
    }
    if (toDelete.length > 0) {
      console.warn(`deleting ${name}: Actor effects ${actor.name}`, toDelete);
      await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    }
}

export async function removeActorArmorEffects(actor) {
  if (!(actor instanceof Actor)) {
    console.warn(actor, " is not an actor");
    return;
  }
  await removeItemArmorEffects(actor.items, actor.name);
  await removeActorEffectsArmorEffects(actor, actor.name);
}

export async function removeAllActorArmorEffects() {
  let promises = [];
  for (let actor of game.actors) {
    promises.push(removeActorArmorEffects(actor));
  }
  return Promise.all(promises);
}

export async function removeAllTokenArmorEffects() {
  let promises = [];
  for (let scene of game.scenes) {
    //@ts-ignore
    for (let tokenDocument of scene.tokens) {
      if (!tokenDocument.isLinked && tokenDocument.actor) {
        promises.push(removeActorArmorEffects(tokenDocument.actor))
      }
    }
  }
  return Promise.all(promises);
}

export async function removeAllItemsArmorEffects() {
  return removeItemArmorEffects(game.items, "World");
}

export async function cleanArmorWorld() {
  game.settings.set("dae", "applyBaseAC", false);
  game.settings.set("dae", "calculateArmor", false);
  Promise.all([removeAllItemsArmorEffects(), removeAllActorArmorEffects(), removeAllTokenArmorEffects()]);
}


function findDAEItem(itemData, packs) {
  for (let pack of packs) {
    let matchItem = pack.find(pd => pd.name === itemData.name && pd.type === itemData.type);
    if (matchItem) return matchItem;
  }
  return undefined;
}

var packsLoaded = false;
var itemPack;
var spellPack;
var featsPack;
var midiPack;
var magicItemsPack;
var dndSRDItemsPack;
var dndSRDSpellsPack;
var dndSRDclassesPack;
var dndSRDClassfeaturesPack;
var dndSRDMonsterfeaturesPack;

export async function loadPacks() {
  if (packsLoaded) return;
  itemPack = await game.packs.get("Dynamic-Effects-SRD.DAE SRD Items").getContent();
  spellPack = await game.packs.get("Dynamic-Effects-SRD.DAE SRD Spells").getContent();
  featsPack = await game.packs.get("Dynamic-Effects-SRD.DAE SRD Feats").getContent();
  midiPack =  await game.packs.get("Dynamic-Effects-SRD.DAE SRD Midi-collection").getContent();
  magicItemsPack = await game.packs.get("Dynamic-Effects-SRD.DAE SRD Magic Items").getContent();
  dndSRDItemsPack = await game.packs.get(`${game.system.id}.items`).getContent();
  dndSRDSpellsPack = await game.packs.get(`${game.system.id}.spells`).getContent();
  dndSRDclassesPack = await game.packs.get(`${game.system.id}.classes`).getContent();
  dndSRDMonsterfeaturesPack = await game.packs.get(`${game.system.id}.monsterfeatures`)?.getContent();
  dndSRDClassfeaturesPack = await game.packs.get(`${game.system.id}.classfeatures`)?.getContent();
  packsLoaded = true;
}

export async function migrateAllActorsDAESRD(includeSRD = false) {
  game.actors.forEach(async a => {
    await migrateActorDAESRD(a, includeSRD);
  });
}

export async function migrateAllNPCDAESRD(includeSRD = false) {
  game.actors.filter(a=>a.data.type !== "character").forEach(async a => {
    await migrateActorDAESRD(a, includeSRD);
  });
}
export async function migrateActorDAESRD(actor, includeSRD = false) {
  if (!game.modules.get("Dynamic-Effects-SRD")?.active) {
    ui.notifications.warn("DAE SRD Module not active");
    return;
  }
  if (!packsLoaded) await loadPacks();
  const items = actor.data.items;
  let replaceItems = [];
  let count = 0;
  items.forEach(itemData => {
    let replaceData;
    switch(itemData.type) {
      case "feat":
        let srdFeats = (actor?.data?.type === "npc") ? dndSRDMonsterfeaturesPack : dndSRDClassfeaturesPack;
        if (includeSRD) replaceData = findDAEItem(itemData, [midiPack, featsPack, dndSRDclassesPack, srdFeats]);
        else replaceData = findDAEItem(itemData, [midiPack, featsPack]);
        if (replaceData) console.warn("migrating", actor.name, replaceData.name, replaceData)
        if (replaceData) {
          setProperty(replaceData.data, "equipped", itemData.data.equipped)
          setProperty(replaceData.data, "attunement", itemData.data.attunement)
          setProperty(replaceData.data.flags, "dae.migrated", true);
          replaceItems.push(replaceData.toObject());
          count++;
        }
        else replaceItems.push(itemData.toObject())
        break;
      case "spell":
        if (includeSRD) replaceData = findDAEItem(itemData, [midiPack, spellPack, dndSRDSpellsPack]);
        else replaceData = findDAEItem(itemData, [midiPack, spellPack]);
        if (replaceData) console.warn("migrating ", actor.name, replaceData.name, replaceData)
        if (replaceData) {
          setProperty(replaceData.data, "prepared", itemData.data.prepared)
          setProperty(replaceData.data.flags, "dae.migrated", true);
          replaceItems.push(replaceData.toObject());
          count++;
        }
        else replaceItems.push(itemData.toObject())
        break;
      case "equipment":
      case "weapon":
      case "loot":
      case "consumable":
      case "tool":
      case "backpack":
        if (includeSRD) replaceData = findDAEItem(itemData, [midiPack, itemPack, magicItemsPack, dndSRDItemsPack]);
        else replaceData = findDAEItem(itemData, [midiPack, itemPack, magicItemsPack]);
        if (replaceData) console.warn("migrated", actor.name, replaceData.name, replaceData)
        if (replaceData) {
          setProperty(replaceData.data, "data.equipped", itemData.data.equipped)
          setProperty(replaceData.data, "data.attunement", itemData.data.attunement)
          setProperty(replaceData.data.flags, "dae.migrated", true);
          replaceItems.push(replaceData.data);
          count++;
        }
        else replaceItems.push(itemData.toObject());
        break;
      default:
        replaceItems.push(itemData.toObject())
        break;
    }
  })
  let removeItems = actor.items.map(i=> i.id);
  await actor.deleteEmbeddedDocuments("Item", [], { deleteAll: true });
  await actor.deleteEmbeddedDocuments("ActiveEffect", [], { deleteAll: true });
  await actor.createEmbeddedDocuments("Item", replaceItems, { addFeatures: false, promptAddFeatures: false });
  console.warn(actor.name, "replaced ", count, " out of ", replaceItems.length,  " items from the DAE SRD");
}

function removeDynamiceffects(actor) {
  actor.update({"flags.-=dynamiceffects": null})
}

export async function fixupDDBAC(allActors = false) {
  try {
    const itemName = "DDB AC";
    const content = await game.packs.get("dae.premadeitems").getContent();
    const item = content.find(i=> i.name === itemName);
    game.actors.filter(a=>a.data.flags.ddbimporter && a.data.flags.ddbimporter.baseAC)
      .filter(a=> allActors || a.type === "character")
      .filter(a=> !a.items.getName(itemName))
      .forEach(a=> a.createEmbeddedDocuments("Item", [item.toObject()]))
  } catch(err) {
    console.error("dae | migration did not complete", err);
  }
}

export function checkLibWrapperVersion() {
  if (isNewerVersion("1.8.0", game.modules.get("lib-wrapper").data.version)) {
    let d = new Dialog({
      // localize this text
      title: i18n("dae.confirm"),
      content: `<h2>DAE requires libWrapper version 1.8.0 or later</p>`,
      buttons: {
          one: {
              icon: '<i class="fas fa-cross"></i>',
          },
        },
        default: "one"
      });
    d.render(true);
  }
}

export function checkArmorDisabled() {
  if (
    game.system.id === "dnd5e" 
        && isNewerVersion(game.system.data.version, "1.3.9") 
        && game.settings.get("dae", "ArmorDisabled") < 1) {
    let d = new Dialog({
      // localize this text
      title: i18n("dae.confirm"),
      content: `<h2>You have updated to DND 1.4.x</h2><p>DND 1.4.x auto calculates AC</p><p> Auto calculation in DAE will be disabled</p>`,
      buttons: {
          one: {
              icon: '<i class="fas fa-cross"></i>',
              label: "Disable DAE AC",
              callback: async () => {
                if (game.settings.get("dae", "calculateArmor") || game.settings.get("dae", "applyBaseAC")) {
                  await cleanArmorWorld();
                }
                await cleanDAEArmorWorld();
                await game.settings.set("dae", "ArmorDisabled", 1)
                await game.settings.set("dae", "calculateArmor", false); 
                await game.settings.set("dae", "applyBaseAC", false);
              }
          },
        },
        default: "one"
      });
    d.render(true);
  }
}

export async function cleanDAEArmorWorld() {
  await removeAllActorArmorItems();
  await removeAllTokenArmorItems();
}

export async function removeAllActorArmorItems() {
  let promises = [];
  for (let actor of game.actors) {
    //@ts-ignore
    await removeActorArmorItems(actor);
  }
}

export async function removeAllTokenArmorItems() {
  let promises = [];
  for (let scene of game.scenes) {
    //@ts-ignore
    for (let tokenDocument of scene.tokens) {
      if (!tokenDocument.isLinked && tokenDocument.actor) {
        await removeActorArmorItems(tokenDocument.actor);
      }
    }
  }
}

export async function removeActorArmorItems(actor: Actor) {
  let promises = [];
  for (let item of actor.items) {
    let toDelete = [];
    //@ts-ignore
    if (!item.effects) continue;
    //@ts-ignore
    for (let effect of item.effects) {
      for (let change of effect.data.changes) {
        if (change.key === "data.attributes.ac.value" && change.value === "AutoCalc") {
          //@ts-ignore
          console.warn("Removing DAE Item ", actor.name, item.name, item.id)
          //@ts-ignore
          toDelete.push(item.id)
        }
      }
    }
    if (toDelete.length > 0) {
      //@ts-ignore
      await actor.deleteEmbeddedDocuments("Item", toDelete)
    }
  }
}

export async function cleanEffectOrigins() {
  await cleanAllActorEffectOrigins();
  await cleanAllTokenEffectOrigins();
}

export async function cleanAllActorEffectOrigins() {
  //@ts-ignore
  for (let actor of game.actors.contents) {
    //@ts-ignore
    let ownedItemEffects = actor.effects.filter(ef => ef.data.origin?.includes("OwnedItem"));
    let updates = ownedItemEffects.map(ef => {return {_id: ef.id, origin: ef.data.origin.replace("OwnedItem", "Item")}});
    if (updates.length > 0) {
      await actor.updateEmbeddedDocuments("ActiveEffect", updates)
      console.warn("Updates are ", actor.name, updates)
    }
  }
}


export async function cleanAllTokenEffectOrigins() {
  for (let scene of game.scenes) {
    //@ts-ignore
    for (let tokenDocument of scene.tokens) {
      if (!tokenDocument.isLinked && tokenDocument.actor) {
        const actor = tokenDocument.actor;
        let ownedItemEffects = actor.effects.filter(ef => ef.data.origin?.includes("OwnedItem"));
        let updates = ownedItemEffects.map(ef => {return {_id: ef.id, origin: ef.data.origin.replace("OwnedItem", "Item")}});
        if (updates.length > 0) {
          await actor.updateEmbeddedDocuments("ActiveEffect", updates)
          console.warn("Updates are ", actor.name, updates)
        }
      }
    }
  }
}