// import {ItemEffectSelector} from "./apps/daeSelector"
import { playersCanSeeEffects, ValidSpec, isDisabled } from "../dae"
import { warn, debug } from "../../dae";
import { ActiveEffectChangeEditor } from "./ActiveEffectChangeEditor";
import { ActiveEffectEffectEditor } from "./ActiveEffectEffectEditor";
// import { ActiveEffectChangeEditor } from "./apps/daeSelector";

export class ActorEffects2 extends FormApplication {

  hookId;
  itemHookId;

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = "effect-selector";
    options.classes = ["dnd5e"];
    options.title = game.i18n.localize("dae.ItemEffectSelection");
    options.template = "./modules/dae/templates/ActorEffects.html";
    options.height = 400;
    options.width = 600;
    return options;
}

getData() {
  //@ts-ignore
  const EFFECTMODES = CONST.ACTIVE_EFFECT_MODES;
  const modeKeys = Object.keys(EFFECTMODES);
  let actives = duplicate(this.object.actor.data.effects).map(ae=> {
    ae.changes.map(change=> {
      change.label=ValidSpec.allSpecsObj[change.key]?.label || "None"; 
      if (typeof change.value === "string" && change.value.length > 40) {
        change.value = change.value.substring(1, 30) + " ... ";
      } else if (Array.isArray(change.value)) {
        if(change.value[0].length > 20) change.value[0] = "<Macro>";
        change.value = change.value.join("|")
      }
      return change;
    }); 
    return ae;
  });

  actives.forEach(e=> {
    let id = e.origin?.match(/Actor.*Item\.(.*)/);
    setProperty(e, "flags.dae.active", !e.disabled);

    if (id?.length === 2) {
      const item = this.object.actor.items.get(id[1]);
      setProperty(e, "flags.dae.itemName", item?.name);
    }
    else {
      setProperty(e, "flags.dae.itemName", "????");
    }
    e.transfer = e.transfer ?? e.flags?.dae?.transfer ?? true;
  });

  // Each effect report source item
  // Item enabled or not.
  // for each effect mark as disabled or not? How to toggle?
  let data = {
    actives: actives, 
    isGM: game.user.isGM,
    modes: modeKeys,
    validSpecs: ValidSpec.allSpecsObj,
    //@ts-ignore
    // canEdit: game.user.isGM || (playersCanSeeEffects === "edit" && game.user.isTrusted),
    canEdit: true,
    // showEffects: playersCanSeeEffects !== "none" || game.user.isGM,
    showEffects: true,
    isOwned: false
  }
  console.error("actor effects ", data)
  return data;
}

 // Add effect
  // edit effect
  // delete effect.

/*
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
*/

  // add change
/*
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
    console.warn("Add change to ", effect)
    makeActive = true;
  })
*/
  // edit change
/*
  html.find('.dae .effect-controls .change-edit').click(ev => {
    console.error("inside change edit")
    let effect_id = $(ev.currentTarget).parents(".dae-change-list").attr("effect-id");
    let change_id = $(ev.currentTarget).parents(".dae-change-list").attr("change-id");
    console.warn("change id is ", effect_id, "  ", change_id, item)
    let effect = item.data.effects.find(e=>e._id === effect_id);
    if (!effect) {
      ui.notifications.warn("Can't edit transferred effects")
      return;
    }
    let change_num = parseInt(change_id);
    let change = effect.changes[change_num];

    console.warn("editing change ", change)
    new ActiveEffectChangeEditor({change, item, effect, change_id: change_num}).render(true);
    makeActive = true;
  });
*/
  // delete change
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.change-delete').click(async ev => {
      let effect_id = $(ev.currentTarget).parents(".dae-change-list").attr("effect-id");
      let change_id = $(ev.currentTarget).parents(".dae-change-list").attr("change-id");
      var effect;
      // li.slideUp(200);
      effect = duplicate(this.object.actor.data.effects.find(ef=>ef._id === effect_id));
      effect.changes.splice(parseInt(change_id),1);
      await this.object.actor.updateEmbeddedEntity("ActiveEffect", effect)
      this.render(true);
    });


  html.find('.change-edit').click(ev => {
    return;
    console.error("inside change edit")
    let effect_id = $(ev.currentTarget).parents(".dae-change-list").attr("effect-id");
    let change_id = $(ev.currentTarget).parents(".dae-change-list").attr("change-id");
    let effect = this.object.actor.effects.find(ef=>ef.id === effect_id);
    warn("change edit ", effect, effect_id, change_id)
    let id = effect.data.origin?.match(/Actor.*Item\.(.*)/);
    if (id?.length === 2) {
      var item = this.object.actor.items.get(id[1]);
    }
    warn("edit item effects ", effect, item)
    if (!effect || !item) {
      ui.notifications.warn("Can't edit transferred effects")
      return;
    }

    let change_num = parseInt(change_id);
    let change = effect.data.changes[change_num];

    console.warn("editing change ", change)
    new ActiveEffectChangeEditor({change, item, effect: effect.data, change_id: change_num}).render(true);
  });

    
    // Delete Effect
    html.find('.effect-delete').click(async ev => {
      const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
      await this.object.actor.deleteEmbeddedEntity("ActiveEffect", effect_id)
      this.render(true);
    });

    /*
    this.hookId = Hooks.on("updateActor", (actor, update) => {
      if (actor.id === this.object.actor.id)
        this.render(true);
    })
    this.itemHookId = Hooks.on("updateOwnedItem", (actor, update) => {
      if (actor.id === this.object.actor.id)
        this.render(false);
    })
*/
  // create active effect
/*
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
  */
  }
  _onClose() {
    Hooks.off("updateActor", this.hookId)
    Hooks.off("updateOwnedItem", this.itemHookId);
   }
}