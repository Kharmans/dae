import { ItemEffect, ModSpec } from "./dynamiceffects.js";
var debug;
export async function migrateItems(saveItem = false, itemName = "", deleteOldEffects = false, _debug = false) {
    debug = _debug;
    let items = game.items.entities;
    items.forEach(async (item) => {
        if (itemName === "" || item.name === itemName) {
            console.log("Migrating Item", item.name);
            let itemData = duplicate(item.data);
            if (hasProperty(item.data.flags, "dynamicitems.effects.value")) {
                if (debug)
                    console.log(`${item.name} has effects`, item.data.flags.dynamicitems);
                let newEffects = convertEffects(item.data.flags.dynamicitems.effects.value, item);
                if (debug)
                    console.log(`For Item ${item.name} ${item.id} new effects are`, newEffects);
                if (newEffects.length > 0) {
                    itemData.flags.dynamiceffects = {};
                    itemData.flags.dynamiceffects.effects = newEffects;
                    itemData.flags.dynamiceffects.alwaysActive = getProperty(item.data.flags.dynamicitems, "cursed.value") || false;
                    itemData.flags.dynamiceffects.equipActive = getProperty(item.data.flags.dynamicitems, "active.value") || false;
                }
            }
            if (deleteOldEffects) {
                delete itemData.flags.dynamicitems;
                if (getProperty(itemData.flags, "core.sheetClass") === "dnd5e.DynamicItemSheet5e") {
                    itemData.flags.core.sheetClass = "dnd5e.ItemSheet5e";
                }
            }
            if (saveItem)
                await item.update({ "flags": itemData.flags }, {});
            if (deleteOldEffects)
                await item.update({ "flags.-=dynamicitems": null }, {});
            item.data.flags = itemData.flags;
        }
    });
}
function convertEffects(oldEffects, item) {
    let fixedEffects = [];
    let counter = 0;
    oldEffects.forEach(oe => {
        if (obsoleteEffects[oe.effect]) {
            console.warn(`Detected obsolete effect ${oe.effect} replacing wtih ${obsoleteEffects[oe.effect]}`);
            oe.effect = obsoleteEffects[oe.effect];
        }
        if (!ModSpec.allSpecsObj[oe.effect]) {
            console.warn(`Invalid modification specification ${oe.effect} for item ${item.name} ${item.id} - effect skipped`);
        }
        else {
            if (typeof oe.value === "string")
                while (oe.value.startsWith("+"))
                    oe.value = oe.value.slice(1);
            oe.value = oe.value.replace(/@data./g, "@");
            fixedEffects.push(new ItemEffect(counter, item.id, oe.effect, oe.mode, oe.value));
        }
        counter += 1;
    });
    return fixedEffects;
}
export async function migrateActors(saveActor = false, actorName = "", deleteOldEffects = true, _debug = false) {
    debug = _debug;
    game.actors.entities.forEach(async (a) => {
        if (actorName === "" || actorName === a.name) {
            console.log("Migrating Actor", a.name);
            //@ts-ignore
            let newItems = duplicate(a.data.items);
            if (debug)
                console.log("Old items are ", newItems);
            newItems = newItems.map(itemData => {
                if (debug)
                    console.log("migrating item ", itemData);
                if (hasProperty(itemData.flags, "dynamicitems")) {
                    itemData.flags.dynamiceffects = {};
                    itemData.flags.dynamiceffects.effects = convertEffects(getProperty(itemData.flags.dynamicitems, "effects.value") || [], itemData);
                    itemData.flags.dynamiceffects.alwaysActive = getProperty(itemData.flags.dynamicitems, "cursed.value") || false;
                    itemData.flags.dynamiceffects.equipActive = getProperty(itemData.flags.dynamicitems, "active.value") || false;
                }
                if (deleteOldEffects)
                    delete itemData.flags.dynamicitems;
                return itemData;
            });
            if (saveActor) {
                await a.update({ "items": [] });
                await a.update({ "items": newItems });
            }
            //@ts-ignore
            else
                a.data.items = newItems;
            //@ts-ignore
            a.prepareEmbeddedEntities();
            a.prepareData();
            if (debug)
                console.log(`For actor ${a.name} new items are `, newItems);
        }
    });
}
export async function migrateAll(saveData = false, _debug = false) {
    debug = _debug;
    await migrateItems(saveData, "", true, debug);
    await migrateActors(saveData, "", true, debug);
}
export async function migrateActorsAts(saveActor = false, actorName = "", deleteOldEffects = true, _debug = false) {
    debug = _debug;
    game.actors.entities.forEach(async (a) => {
        if (actorName === "" || actorName === a.name) {
            console.log("Migrating Actor", a.name);
            //@ts-ignore
            let newItems = duplicate(a.data.items);
            if (debug)
                console.log("Old items are ", newItems);
            newItems = newItems.map(itemData => {
                if (debug)
                    console.log("migrating item ", itemData);
                if (hasProperty(itemData.flags, "dynamiceffects")) {
                    itemData.flags.dynamiceffects.effects = convertEffectsAt(getProperty(itemData.flags.dynamiceffects, "effects") || []);
                }
                return itemData;
            });
            if (saveActor) {
                await a.update({ "items": [] });
                await a.update({ "items": newItems });
            }
            //@ts-ignore
            else
                a.data.items = newItems;
            //@ts-ignore
            a.prepareEmbeddedEntities();
            a.prepareData();
            if (debug)
                console.log(`For actor ${a.name} new items are `, newItems);
        }
    });
}
export async function migrateItemsAts(saveItem = false, itemName = "", deleteOldEffects = false, _debug = false) {
    debug = _debug;
    let items = game.items.entities;
    items.forEach(async (item) => {
        if (itemName === "" || item.name === itemName) {
            console.log("Migrating Item", item.name);
            let itemData = duplicate(item.data);
            if (hasProperty(item.data.flags, "dynamiceffects.effects")) {
                if (debug)
                    console.log(`${item.name} has effects`, item.data.flags.dynamiceffects);
                let newEffects = convertEffectsAt(item.data.flags.dynamiceffects.effects);
                if (debug)
                    console.log(`For Item ${item.name} ${item.id} new effects are`, newEffects);
                if (newEffects.length > 0) {
                    itemData.flags.dynamiceffects.effects = newEffects;
                }
            }
            if (saveItem)
                await item.update({ "flags": itemData.flags }, {});
            item.data.flags = itemData.flags;
        }
    });
}
function convertEffectsAt(oldEffects) {
    oldEffects = oldEffects.map(oe => {
        oe.value = oe.value.replace(/@data./g, "@");
        return oe;
    });
    return oldEffects;
}
export async function migrateAllAts(saveData = false, _debug = false) {
    debug = _debug;
    await migrateItemsAts(saveData, "", true, debug);
    await migrateActorsAts(saveData, "", true, debug);
}
export async function fixAbilities() {
    let abilityKeys = Object.keys(CONFIG.DND5E.abilities);
    game.actors.entities.forEach(a => {
        Object.keys(a.data.data.skills).forEach(async (sname) => {
            let s = a.data.data.skills[sname];
            if (!abilityKeys.includes(s.ability)) {
                let update = {};
                update[`data.skills.${sname}.ability`] = game.system.model.Actor.character.skills[sname].ability;
                console.log("Actor ", a.name, " skill ", sname, " is broken");
                console.log("Fixed is ", await a.update(update));
            }
        });
    });
}
let obsoleteEffects = {
    "data.bonuses.mwak": "data.bonuses.mwak.attack",
    "data.bonuses.rwak": "data.bonuses.rwak.attack",
    "data.bonuses.msak": "data.bonuses.msak.attack",
    "data.bonuses.rsak": "data.bonuses.rsak.attack",
    "data.bonuses.damage": "data.bonuses.mwak.damage",
    "data.bonuses.abilitySave": "data.bonuses.abilities.save",
    "data.bonuses.abilityCheck": "data.bonuses.abilities.check",
    "data.bonuses.skillCheck": "data.bonuses.abilities.skill",
    "data.bonuses.skills.check": "data.bonuses.abilities.skill",
    "flags.dnd5e.spellDCBonus": "data.bonuses.spell.dc"
};
