import { MIPMAP_MODES } from "pixi.js";
import { daeSetPassiveEffect } from "./daeMacros";
import { debug, warn } from "../dae";
import { ValidSpec } from "./dae";

const ActiveEffect = CONFIG.ActiveEffect.entityClass;
//@ts-ignore
const EFFECTMODES = ACTIVE_EFFECT_MODES;

function migrateDynamicEffect(effects: [{
  active: boolean, 
  modSpecKey: string
  mode: string, 
  value: string | boolean | number | []
  //@ts-ignore
}]): {actives, passives} {
  let actives = [];
  let passives = [];
  effects.forEach(ef => {
    let newEffect = {
      key: ef.modSpecKey,
      value: ef.value,
      mode: 0,
      priority: 0
    }
    if (ef.modSpecKey === "macro.macroExecute") 
      ef.modSpecKey = "macro.execute";
    if (!ValidSpec.allSpecsObj[ef.modSpecKey]) {
      console.error("Could not find ", ef.modSpecKey, " effect not migrated")
    } else {
      if (ValidSpec.allSpecsObj[ef.modSpecKey].forcedMode !== -1) {
        newEffect.mode = ValidSpec.allSpecsObj[ef.modSpecKey].forcedMode;
        newEffect.priority = ValidSpec.allSpecsObj[ef.modSpecKey].forcedMode * 10;
      } else if (ef.mode === "+") {
        newEffect.mode = EFFECTMODES.ADD;
        newEffect.priority = EFFECTMODES.ADD * 10;
      } else if (ef.mode === "=") { // dynamic effects = mode happen before others
        newEffect.mode = EFFECTMODES.OVERRIDE;
        newEffect.priority = 5;
      }
      (ef.active ? actives : passives).push(newEffect)
    }
  })
  return {actives, passives};
}

//@ts-ignore
export async function migrateItem(item: CONFIG.Item.EntityClass): CONFIG.Item.EntityClass {
  if (getProperty(item.data.flags, "dynamiceffects.effects")?.length > 0) {
    let activeEffects = migrateDynamicEffect(item.data.flags.dynamiceffects.effects);
    debug("migrate Item ", activeEffects)
    const TRANSFER_DATA = {
      label: `${item.name} Passive Effects`,
      icon: item.img,
      changes: activeEffects.passives,
      transfer: true,
      origin: ""
    }
    setProperty(TRANSFER_DATA, "flags.dae.transfer", true)
    const APPLIED_DATA = {
      label: `${item.name} Active Effects`,
      icon: item.img,
      changes: activeEffects.actives,
      transfer: false
    }
    setProperty(APPLIED_DATA, "flags.dae.transfer", false)
    if (activeEffects.passives.length + activeEffects.actives.length === 0) return null;
    let theItem = item;
    const isOwned = theItem.isOwned;
    console.warn("Migrating ", theItem.name, activeEffects)

    let ae = [];
    await item.deleteEmbeddedEntity("ActiveEffect", theItem.effects.map(i => i.data._id));
    if (activeEffects.passives.length > 0) ae.push(TRANSFER_DATA);
    if (activeEffects.actives.length > 0) ae.push(APPLIED_DATA);
    if (getProperty(item.data.flags, "dynamiceffects")) {
      warn("Migration: dynamiceffects flags ",
        "alwaysActive", getProperty(item.data.flags, "dynamiceffects.alwaysActive"), 
        "activeEquipped", getProperty(item.data.flags, "dynamiceffects.equipActive")
      )
      await item.update({
        "flags.dynamiceffects.alwaysActive": getProperty(item.data.flags, "dynamiceffects.alwaysActive"),
        "flags.dynamiceffects.activeEquipped": getProperty(item.data.flags, "dynamiceffects.equipActive")
      })
    }
    item.createEmbeddedEntity("ActiveEffect", ae);
  }
}
//@ts-ignore
export function migrateOwnedItem(item: CONFIG.Item.EntityClass, actor = null): CONFIG.Item.EntityClass {
  if (getProperty(item.data.flags, "dynamiceffects.effects")?.length > 0) {
    let activeEffects = migrateDynamicEffect(item.data.flags.dynamiceffects.effects);
    debug("migrate Item ", activeEffects)
    const TRANSFER_DATA = {
      label: `${item.name} Passive Effects`,
      icon: item.img,
      changes: activeEffects.passives,
      transfer: true,
      origin: ""
    }
    setProperty(TRANSFER_DATA, "flags.dae.transfer", true)
    const APPLIED_DATA = {
      label: `${item.name} Active Effects`,
      icon: item.img,
      changes: activeEffects.actives,
      transfer: false
    }
    setProperty(APPLIED_DATA, "flags.dae.transfer", false)
    if (activeEffects.passives.length + activeEffects.actives.length === 0) return null;
    let theItem = item;
    const isOwned = theItem.isOwned;
    console.warn("Migrating ", theItem.name, activeEffects)
    if (!actor) actor = item.actor;

    if (isOwned) {
      let itemData = duplicate(item.data)
      itemData.effects = [];
      let id = item.id || item._id || item.data._id;
      if (actor) {
        const origin = `Actor.${actor.id}.OwnedItem.${theItem.data._id}`;
        TRANSFER_DATA.origin = origin;
      }
      let ae = [];
      // await item.deleteEmbeddedEntity("ActiveEffect", theItem.effects.map(i => i.data._id));
      // warn("Deleting effects ", theItem.effects.map(ef => ef.data._id))
      if (activeEffects.passives.length > 0) ae.push(TRANSFER_DATA);
      if (activeEffects.actives.length > 0) ae.push(APPLIED_DATA);
      itemData.effects = ae;
      warn("Created item is ", item)
      warn("Migration: dynamiceffects flags ",
        "alwaysActive", getProperty(itemData.flags, "dynamiceffects.alwaysActive"), 
        "activeEquipped", getProperty(itemData.flags, "dynamiceffects.equipActive")
      )
      if (getProperty(theItem.data.flags, "dynamiceffects")) {
        setProperty(itemData.flags, "dae.alwaysActive", getProperty(item.data.flags, "dynamiceffects.alwaysActive"))
        setProperty(itemData.flags, "dae.aactiveEquipped", getProperty(item.data.flags, "dynamiceffects.equipActive"))
      }
      return itemData;
    }
  }
}
export function convertAllItems() {
  game.items.entities.forEach(item => {
    migrateItem(item);
  })
}

export async function migrateActorItems(actor) {
  const ids = actor.effects.map(ef => ef.data._id);
  let delResults = await actor.deleteEmbeddedEntity("ActiveEffect", ids);
  console.warn("Deletion results are ", delResults)

  const itemIds = actor.items.map(i=>i.id);
  let itemsData = [];
  itemIds.forEach(async id=> {
    const item = actor.items.get(id);
    let results = migrateOwnedItem(item, actor);
    console.warn("Results are ", item.name, results)
    if (results) itemsData.push(results);
  })
  console.warn("items data is ", itemsData)

  let activeEffects = actor.effects.map(ef=>ef.id);
  await actor.deleteEmbeddedEntity("ActiveEffect", activeEffects)
  const deleteItemIds = itemsData.map(id=>id._id);
  console.warn("deleted ids are ", deleteItemIds)
  await actor.deleteEmbeddedEntity("OwnedItem", deleteItemIds)
  await actor.createEmbeddedEntity("OwnedItem", itemsData)
}
export async function removeActorEffects(actor) {
  let activeEffects = actor.effects.map(ef=>ef.id);
  await actor.deleteEmbeddedEntity("ActiveEffect", activeEffects)
}

export async function migrateAllActors() {
  game.actors.forEach(actor => migrateActorItems(actor))
}