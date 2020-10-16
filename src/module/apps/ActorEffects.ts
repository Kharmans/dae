// import {ItemEffectSelector} from "./apps/daeSelector"
import { playersCanSeeEffects, ValidSpec, isDisabled } from "../dae"
import { warn, debug } from "../../dae";
import { DAEActiveEffectConfig } from "./DAEActiveEffectConfig";

export class ActorEffects extends FormApplication {

  hookId = null;
  itemHookId = null;
  effectHookIdu = null;
  effectHookIdc = null;
  effectHookIdd = null;
  timeHookId: any;
  summary = true;
  active = true;
  temporary = true;


  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = "effect-selector-actor";
    options.classes = ["dnd5e", "sw5e"];
    options.title = game.i18n.localize("dae.ActiveEffectName");
    options.template = "./modules/dae/templates/ActorEffects.html";
    options.height = 400;
    options.width = 600;
    return options;
}

get title() {
  return game.i18n.localize("dae.ActiveEffectName") + ` ${this.object.actor.name}`;
}

getData() {
  //@ts-ignore
  const EFFECTMODES = CONST.ACTIVE_EFFECT_MODES;
  const modeKeys = Object.keys(EFFECTMODES);
  let actives = this.object.actor.effects.map(ae=> {
    let newAe = duplicate(ae.data);
    newAe.duration = ae.duration;
    if (newAe.duration.label) {
      newAe.duration.label = newAe.duration.label.replace("Seconds", "s").replace("Rounds", "R").replace("Turns", "T");
    }
    newAe.isTemporary = ae.isTemporary;
    if (this.summary) {
      newAe.changes = [];
      return newAe;
    }
    newAe.changes.map(change=> {
      change.label=ValidSpec.allSpecsObj[change.key]?.label || "None"; 
      if (typeof change.value === "string" && change.value.length > 40) {
        change.value = change.value.substring(0, 30) + " ... ";
      } else if (Array.isArray(change.value)) {
        if(change.value[0].length > 20) change.value[0] = "<Macro>";
        change.value = change.value.join("|")
      }
      return change;
    });
    return newAe;
  });

  if (this.active) actives = actives.filter(e=>!e.disabled);
  if (this.temporary) actives = actives.filter(e=>e.isTemporary);
  actives.sort((a,b) => a.label < b.label ? -1 : 1);
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
    summary: this.summary,
    active: this.active,
    temporary: this.temporary,
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
    this.object.actor.updateEmbeddedEntity("ActiveEffect", effect).then(() => this.render());
  });

  
  html.find('.refresh').click(async ev => {
    return this.submit({preventClose: true}).then(() => this.render());
  });
  
  // Delete Effect
  html.find('.effect-delete').click(async ev => {
    const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
    this.object.actor.deleteEmbeddedEntity("ActiveEffect", effect_id).then(() => this.render());
  });
  html.find('.effect-edit').click(async ev => {
    const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
    let effect = this.object.actor.effects.get(effect_id);
    new DAEActiveEffectConfig(effect).render(true);
  })
  html.find('.effect-add').click(async ev => {
    //@ts-ignore
    const AEDATA = {
      label: "New Active Effect",
      icon: "icons/svg/mystery-man.svg",
      changes: [],
      transfer: false,
    };
    //@ts-ignore
    const effectId = (await this.object.actor.createEmbeddedEntity("ActiveEffect", AEDATA))._id;
    let effect = this.object.actor.effects.get(effectId)
    this.render();
    new DAEActiveEffectConfig(effect).render(true);
  })

  // this.hookId = Hooks.on("updateActor", () => this.render(true))
  function efhandler(type, actor) {
    if (this.object.actor.id === actor.id) {
      setTimeout(() => this.render(), 0)
    }
  };
  function tmHandler(worldTime: number, dt: number) {
    //@ts-ignore
    if (Array.from(this.object.actor.effects).some(ef=>ef.isTemporary))
      setTimeout(() => this.render(), 0)
  }
  if (!this.effectHookIdu)
    this.effectHookIdu = Hooks.on("updateActiveEffect", efhandler.bind(this, "update"));
  if (!this.effectHookIdc)
    this.effectHookIdc = Hooks.on("createActiveEffect", efhandler.bind(this, "create"));
  if (!this.effectHookIdd)
    this.effectHookIdd = Hooks.on("deleteActiveEffect", efhandler.bind(this, "delete"));
  if (!this.itemHookId)
    this.itemHookId = Hooks.on("updateOwnedItem", efhandler.bind(this, "owneditem"))
  if (!this.timeHookId) 
    this.timeHookId = Hooks.on("updateWorldTime", tmHandler.bind(this))

}
async _updateObject(event, formData) {
  this.active = formData.active;
  this.summary = formData.summary;
  this.temporary = formData.temporary;
}

async close() {
  // Hooks.off("updateActor", this.hookId)
  Hooks.off("updateActiveEffect", this.effectHookIdu);
  Hooks.off("createActiveEffect", this.effectHookIdc);
  Hooks.off("deleteActiveEffect", this.effectHookIdd);
  Hooks.off("updateWorldTime", this.timeHookId);
  Hooks.off("updateOwnedItem", this.itemHookId);
  return super.close()
  }
}