// import {ItemEffectSelector} from "./apps/daeSelector"
import { playersCanSeeEffects, ValidSpec, isDisabled } from "../dae"
import { warn, debug } from "../../dae";
import { ActiveEffectChangeEditor } from "./ActiveEffectChangeEditor";
import { ActiveEffectEffectEditor } from "./ActiveEffectEffectEditor";
// import { ActiveEffectChangeEditor } from "./apps/daeSelector";

export class ActorEffects extends FormApplication {

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

get title() {
  return game.i18n.localize("dae.ItemEffectSelection") + ` ${this.object.actor.name}`;
}

getData() {
  //@ts-ignore
  const EFFECTMODES = CONST.ACTIVE_EFFECT_MODES;
  const modeKeys = Object.keys(EFFECTMODES);
  let actives = duplicate(this.object.actor.data.effects).map(ae=> {
    ae.changes.map(change=> {
      change.label=ValidSpec.allSpecsObj[change.key]?.label || "None"; 
      if (typeof change.value === "string" && change.value.length > 40) {
        change.value = change.value.substring(0, 30) + " ... ";
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
  return data;
}

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

    // Delete Effect
    html.find('.effect-delete').click(async ev => {
      const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
      await this.object.actor.deleteEmbeddedEntity("ActiveEffect", effect_id)
      this.render(true);
    });
  }
  _onClose() {
    Hooks.off("updateActor", this.hookId)
    Hooks.off("updateOwnedItem", this.itemHookId);
   }
}