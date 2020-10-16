// import {ItemEffectSelector} from "./apps/daeSelector"
import { playersCanSeeEffects, ValidSpec, isDisabled } from "../dae"
import { warn, debug } from "../../dae";
import { DAEActiveEffectConfig } from "./DAEActiveEffectConfig";

export class ItemEffects extends FormApplication {
  effectHookIdu = null;
  effectHookIdc = null;
  effectHookIdd = null;
  hookId;
  itemHookId;

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = "effect-selector";
    options.classes = ["dnd5e", "sw5e"];
    options.title = game.i18n.localize("dae.ActiveEffectName");
    options.template = "./modules/dae/templates/ItemEffects.html";
    options.height = 400;
    options.width = 600;
    options.submitOnClose = true;
    return options;
  }

  get title() {
    return game.i18n.localize("dae.ActiveEffectName") + ` ${this.object.item.name}`;
  }

  getData() {
    //@ts-ignore
    const EFFECTMODES = CONST.ACTIVE_EFFECT_MODES;
    const modeKeys = Object.keys(EFFECTMODES);
    let actives = duplicate(this.object.item.data.effects).map(ae => {
      ae.changes.map(change => {
        change.label = ValidSpec.allSpecsObj[change.key]?.label || "None";
        if (typeof change.value === "string" && change.value.length > 40) {
          change.value = change.value.substring(0, 30) + " ... ";
        } else if (Array.isArray(change.value)) {
          if (change.value[0].length > 20) change.value[0] = "<Macro>";
          change.value = change.value.join("|")
        }
        return change;
      });
      return ae;
    });

    actives.sort((a,b) => a.label < b.label ? -1 : 1);
    actives.forEach(e => {
      setProperty(e, "flags.dae.itemName", this.object.item?.name);
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
      flags: this.object.item.data.flags,
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
      effect = duplicate(this.object.item.data.effects.find(ef => ef._id === effect_id));
      effect.changes.splice(parseInt(change_id), 1);
      this.object.item.updateEmbeddedEntity("ActiveEffect", effect).then(() => this.render());
    });

    // Delete Effect
    html.find('.effect-delete').click(async ev => {
      const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
      this.object.item.deleteEmbeddedEntity("ActiveEffect", effect_id).then(() => this.render());
    });
    html.find('.effect-edit').click(async ev => {
      const effect_id = $(ev.currentTarget).parents(".effect-header").attr("effect-id");
      let effect = this.object.item.effects.get(effect_id);
      new DAEActiveEffectConfig(effect).render(true);

    })
    html.find('.effect-add').click(async ev => {
      //@ts-ignore
      const AEDATA = {
        label: this.object.item.name || "New Active Effect",
        icon: this.object.item.img || "icons/svg/mystery-man.svg",
        changes: [],
        transfer: false,
      };
      //@ts-ignore
      const effectId = (await this.object.item.createEmbeddedEntity("ActiveEffect", AEDATA))._id;
      let effect = this.object.item.effects.get(effectId)
      this.render();
      new DAEActiveEffectConfig(effect).render(true);
    })
    // this.hookId = Hooks.on("updateActor", () => this.render(true))
    let efhandler = (item) => {
      if (this.object.item.id === item.id) {
        setTimeout(() => this.render(), 0)
      }
    };
    if (!this.effectHookIdu)
      this.effectHookIdu = Hooks.on("updateActiveEffect", efhandler);
    if (!this.effectHookIdc)
      this.effectHookIdc = Hooks.on("createActiveEffect", efhandler);
    if (!this.effectHookIdd)
      this.effectHookIdd = Hooks.on("deleteActiveEffect", efhandler);
  }

  async _updateObject(event: Event, formData) {
    if (!this.object.item.isOwned) {
      this.object.item.update(formData)
    }
  }
  async close() {
    // Hooks.off("updateActor", this.hookId)
    Hooks.off("updateActiveEffect", this.effectHookIdu);
    Hooks.off("createActiveEffect", this.effectHookIdc);
    Hooks.off("deleteActiveEffect", this.effectHookIdd);
    return super.close();
  }
}