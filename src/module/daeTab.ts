// import {ItemEffectSelector} from "./apps/daeSelector"
import { playersCanSeeEffects, ValidSpec } from "./dae"
import { warn, debug } from "../dae";
import { ActiveEffectChangeEditor } from "./apps/ActiveEffectChangeEditor";
import { ActiveEffectEffectEditor } from "./apps/ActiveEffectEffectEditor";
// import { ActiveEffectChangeEditor } from "./apps/daeSelector";

let debugLog: boolean = false;
var makeActive = false;


export function initSheetTab() {
  let itemSheets = {}
  Object.values(CONFIG.Item.sheetClasses).forEach(itemType => Object.keys(itemType).forEach(sheetName => itemSheets[sheetName] = 1));
  debug("Item sheets are ", CONFIG.Item.sheetClasses, itemSheets)
  Object.keys(itemSheets).forEach(
    sheetName => Hooks.on(`render${sheetName.split(".")[1]}`, (app, html, data) => {
        adddaeTab(app, html, data);
    })
  );
}

async function adddaeTab(app, html, data) {
  if (playersCanSeeEffects === "none" && !game.user.isGM) return;
  let daetab = html.find(`.dae-tab`);
  
  if (daetab.length > 0) {
    if (makeActive && app._tabs[0]) app._tabs[0].activate("dae");
    return;
  }
  // console.warn("dae tab ", html.find(".sheet-navigation"))
  let item = app.object;
  // if (["spell", "backpack"].includes(item.type)) return;
  if (["loot"].includes(item.type)) return;
  // if (!game.user.isGM && !(item.data.data.attuned || item.data.data.identified)) return;
  app.options.daeAdded = true;
  if (!hasProperty(item.data, "flags.dae.activeEquipped")) setProperty(item.data, "flags.dae.activeEquipped", false);
  if (!hasProperty(item.data, "flags.dae.alwaysActive")) setProperty(item.data, "flags.dae.alwaysActive", false);
  if (!hasProperty(item.data, "effects")) setProperty(item.data, "effects", []);

  //  let tabSelector = html.find(`.sheet-navigation`),
  
  let tabSelector = html.find(`.tabs`),
      settingsContainer = html.find(`.sheet-body`),
      daeTabString = `<a class="item dae-tab" data-tab="dae">${game.i18n.localize("dae.Title")}</a>`,
      tab = tabSelector.append($(daeTabString));

  // let settingsContainer = html.find(`.sheet-body`);
  if (settingsContainer.length === 0) settingsContainer = html.find(`.primary-body`);

  //@ts-ignore
  const EFFECTMODES = ACTIVE_EFFECT_MODES;
  const modeKeys = Object.keys(EFFECTMODES);
  let actives = duplicate(item.data.effects);

  /*
  if (item.isOwned) {
    console.warn("ae effects ", item.actor.effects)
    let extra_effects = item.actor.effects.filter(ae=>{
      console.warn("extra effects ", ae, ae.data.origin, item.uuid, ae.flags?.dae?.transfer);
      return ae.data.origin === item.uuid && ae.flags?.dae?.transfer !== false})
      .map(ae=>{let data = duplicate(ae.data); data.transfer=true; return data});
    actives = actives.concat(extra_effects)
    console.warn("setup active effects ", extra_effects, actives)
  }
  */
  actives = actives.map(ae=>{ae.changes.map(change=>{change.label=ValidSpec.allSpecsObj[change.key]?.label || "None"; return change}); return ae});

  let daeTabTemplate = await renderTemplate("./modules/dae/templates/dae-tab.html", {
    flags: item.data.flags,
    actives, 
    isGM: game.user.isGM,
    isOwned: item.isOwned,
    modes: modeKeys,
    validSpecs: ValidSpec.allSpecsObj,
    //@ts-ignore
    canEdit: game.user.isGM || (playersCanSeeEffects === "edit" && game.user.isTrusted),
    showEffects: playersCanSeeEffects !== "none" || game.user.isGM,
    data: {attuned: getProperty(item.data, "data.attuned")},
    needsAttuned : ["tool"].includes(item.type)
  });
  let extraTab = settingsContainer.append(daeTabTemplate);

  warn("Appp tabs ", app._tabs)
  if (makeActive && app._tabs[0]) app._tabs[0].activate("dae");
  makeActive = false;
  // Add effect
  // edit effect
  // delete effect.

  html.find(".dae .effect-edit").click(ev => {
    const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
    let effect = item.data.effects.find(e=>e._id === effect_id);
    if (!effect) {
      ui.notifications.warn("Can't edit transferred effects");
      return;
    }
    new ActiveEffectEffectEditor({item, effect}).render(true);
    makeActive = true;
  })

  // add change
  html.find('.dae .effect-controls .change-create').click(async ev => {
    const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");

    // const effect_id = $(ev.currentTarget).attr("effect-id");
    if (item.isOwned) {
      const effects = duplicate(item.data.effects);
      var effect = effects.find(ef=>ef._id === effect_id)
      if (!effect) {
        ui.notifications.warn("Can't edit transferred effects")
        return;
      }
      effect.changes.push({key: "data.abilities.str.value", mode: EFFECTMODES.CUSTOM, value: 0});
      item.actor.updateOwnedItem({"_id": item.id, "effects": effects})
    } else {
      effect = duplicate(item.data.effects.find(ef=>ef._id === effect_id));
      effect.changes.push({key: "data.abilities.str.value", mode: 0, value: 0})
      item.updateEmbeddedEntity("ActiveEffect", effect)
    }
    makeActive = true;
  })

  // edit change
  html.find('.dae .effect-controls .change-edit').click(ev => {
    let effect_id = $(ev.currentTarget).parents(".dae-change-list").attr("effect-id");
    let change_id = $(ev.currentTarget).parents(".dae-change-list").attr("change-id");
    debug("edit-change: change id is ", effect_id, "  ", change_id, item)
    let effect = item.data.effects.find(e=>e._id === effect_id);
    if (!effect) {
      ui.notifications.warn("Can't edit transferred effects")
      return;
    }
    let change_num = parseInt(change_id);
    let change = effect.changes[change_num];

    new ActiveEffectChangeEditor({change, item, effect, change_id: change_num}).render(true);
    makeActive = true;
  });

  // delete change
  html.find('.dae .effect-controls .change-delete').click(async ev => {
    let effect_id = $(ev.currentTarget).parents(".dae-change-list").attr("effect-id");
    let change_id = $(ev.currentTarget).parents(".dae-change-list").attr("change-id");
    debug("delete-change: change id is ", effect_id, "  ", change_id, item)
    var effect;
    // li.slideUp(200);
    if (item.isOwned) {
      const effects = duplicate(item.data.effects);
      effect = effects.find(ef=>ef._id === effect_id)
      if (!effect) {
        ui.notifications.warn("Can't delete transferred effects");
        return;
      }
      effect.changes.splice(parseInt(change_id),1);
      item.actor.updateOwnedItem({"_id": item.id, "effects": effects})
    } else {
      effect = duplicate(item.data.effects.find(ef=>ef._id === effect_id));
      effect.changes.splice(parseInt(change_id),1);
      item.updateEmbeddedEntity("ActiveEffect", effect)
    }
    makeActive = true;
  });

  // intercept Input Click and set Tab
  html.find('.dae input[type="checkbox"]').click(ev => {
    const effect_name = $(ev.currentTarget).attr("name")
    makeActive = true;
  });
  
  // Delete Effect
  html.find('.dae .effect-delete').click(async ev => {
    const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
    if (item.isOwned) {
      let effects = item.data.effects.filter(ef => ef._id !== effect_id);
      item.actor.updateOwnedItem({"_id": item.id, "effects": effects});
    } else {
      item.deleteEmbeddedEntity("ActiveEffect", effect_id)
    }
    makeActive = true;
  });

  // create active effect
  html.find('.dae .effect-create').click(async ev => {
    let ae = {
      label: "New Effect",
      icon: "icons/svg/mystery-man.svg",
      changes: [
        {key: "", value: 0, mode: EFFECTMODES.ADD},
      ],
      transfer: false
    }
    if (item.isOwned ) {
      ui.notifications.warn("Can't create effects on owned items");
      return;
      item.data.effects.push(ae)
      item.actor.updateOwnedItem(item.data)
    } else {
      await item.createEmbeddedEntity("ActiveEffect", ae)
    }
    makeActive = true;
  });
}