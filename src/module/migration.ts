import { MIPMAP_MODES } from "pixi.js";
import { daeSetPassiveEffect } from "./daeMacros";
import { debug, warn, log } from "../dae";
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
    if (ef.modSpecKey === "data.attributes.spelldc") {
      ef.modSpecKey = "data.bonuses.spell.dc";
    }
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
    setProperty(item.data.flags, "dae", {});
    const TRANSFER_DATA = {
      label: `${item.name}`,
      icon: item.img,
      changes: activeEffects.passives,
      transfer: true,
      origin: ""
    }
    setProperty(TRANSFER_DATA, "flags.dae.transfer", true)
    const APPLIED_DATA = {
      label: `${item.name}`,
      icon: item.img,
      changes: activeEffects.actives,
      transfer: false
    }
    setProperty(APPLIED_DATA, "flags.dae.transfer", false)
    if (activeEffects.passives.length + activeEffects.actives.length === 0) return null;
    log("Migrating ", item.name, activeEffects)

    let ae = [];
    debug("Migrating item effects", item.data.effects)
    await item.deleteEmbeddedEntity("ActiveEffect", item.data.effects?.map(i => i._id));
    if (activeEffects.passives.length > 0) ae.push(TRANSFER_DATA);
    if (activeEffects.actives.length > 0) ae.push(APPLIED_DATA);
    if (getProperty(item.data.flags, "dynamiceffects")) {
      if (getProperty(item.data.flags, "dynamiceffects")) {
        setProperty(item.data.flags, "dae.alwaysActive", getProperty(item.data.flags, "dynamiceffects.alwaysActive"))
        setProperty(item.data.flags, "dae.activeEquipped", getProperty(item.data.flags, "dynamiceffects.equipActive"))
      }
    }
    item.createEmbeddedEntity("ActiveEffect", ae);
  }
}
//@ts-ignore
export function migrateOwnedItem(item: CONFIG.Item.EntityClass, actor = null): CONFIG.Item.EntityClass {
  if (getProperty(item.data.flags, "dynamiceffects.effects")?.length > 0) {
    let activeEffects = migrateDynamicEffect(item.data.flags.dynamiceffects.effects);
    setProperty(item.data.flags, "dae", {});
    debug("migrate Item ", activeEffects)
    const TRANSFER_DATA = {
      label: `${item.name}`,
      icon: item.img,
      changes: activeEffects.passives,
      transfer: true,
      origin: ""
    }
    setProperty(TRANSFER_DATA, "flags.dae.transfer", true)
    const APPLIED_DATA = {
      label: `${item.name}`,
      icon: item.img,
      changes: activeEffects.actives,
      transfer: false
    }
    setProperty(APPLIED_DATA, "flags.dae.transfer", false)
    if (activeEffects.passives.length + activeEffects.actives.length === 0) return null;
    let theItem = item;
    const isOwned = theItem.isOwned;
    warn("Migrating owned item ", theItem.name, activeEffects)
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
      if (getProperty(theItem.data.flags, "dynamiceffects")) {
        setProperty(itemData.flags, "dae.alwaysActive", getProperty(item.data.flags, "dynamiceffects.alwaysActive"))
        setProperty(itemData.flags, "dae.activeEquipped", getProperty(item.data.flags, "dynamiceffects.equipActive"))
      }
      return itemData;
    }
  }
}
export function migrateAllItems() {
  game.items.entities.forEach(item => {
    migrateItem(item);
  })
}

export async function migrateActorItems(actor) {
  const ids = actor.effects.map(ef => ef.data._id);
  let delResults = await actor.deleteEmbeddedEntity("ActiveEffect", ids);
  warn("Deletion results are ", delResults)

  log("Migrating Actor ", actor.name)
  const itemIds = actor.items.map(i=>i.id);
  let itemsData = [];
  itemIds.forEach(async id=> {
    const item = actor.items.get(id);
    let results = migrateOwnedItem(item, actor);
    if (results) {
      warn("Migrated ", item.name, results)
      itemsData.push(results);
    }
  })

  const deleteItemIds = itemsData.map(id=>id._id);
  debug("deleted ids are ", deleteItemIds)
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

export async function fixupMonstersCompendium() {
  const pack = game.packs.get("dnd5e.monsters");
  let locked = pack.locked;
  pack.configure({locked: false})
  let content = await pack.getContent()
  content.forEach(entity=>["mwak","rwak","rsak","msak"]
    .forEach(id=>entity.data.data.bonuses[id]={attack: "", damage: ""}))
  content.forEach(async actor=>await pack.updateEntity(actor.data))
  pack.configure({locked: locked})
}
export async function fixupActors() {
  game.actors.forEach(async actor => {
    const bonuses = duplicate(actor.data.data.bonuses);
    let found = false;
    ["mwak","rwak","rsak","msak"].forEach(bonusId => {
      if (typeof actor.data.data.bonuses[bonusId] === "string") {
        bonuses[bonusId] = {"attack": "", "damage": ""};
        found = true;
      }
    })
    if (found) {
      console.warn("Fixing actor ", actor.name, actor.id, bonuses)
      await actor.update({"data.bonuses": bonuses});
    }
  })
}

  export async function fixupBonuses() {
    fixupMonstersCompendium();
    fixupActors();
  }
