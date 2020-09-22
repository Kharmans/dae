


import { ValidSpec, playersCanSeeEffects, itemacroActive } from "../dae"
import { tokenEffects, cubActive } from "../dae"


export class ActiveEffectChangeEditor extends FormApplication {

  static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "effect-selector";
      options.classes = ["dnd5e"];
      options.title = game.i18n.localize("dae.ItemEffectSelection");
      options.template = "./modules/dae/templates/ActiveEffectChangeEditor.html";
      options.height = 275;
      options.width = 275;
      return options;
  }

  // static categories = {abilities: "Abilities", attributes: "Attributes", skills: "Skills", flags: "Flags", currency: "Currency", details: "Details", spells: "Spells", traits: "Traits"};
  static categories = {
      abilities: "dae.abilities",
      attributes: "dae.attributes",
      bonuses: "dae.bonuses",
      currency: "dae.currency",
      details: "dae.details",
      flags: "dae.flags",
      resources: "dae.resources",
      skills: "dae.skills",
      spells: "dae.spells",
      traits: "dae.traits",
      macro: "macro"
  };

  static advantages = {
      none: "dae.none",
      adv: "dae.advantage",
      disadv: "dae.disadvantage"
  }

  static get validMods() {
    return ValidSpec.allSpecs;
  }
  get validMods() {
      return ValidSpec.allSpecs;
  }
  // set validMods(validMods) {this.validMods = validMods}

  /* -------------------------------------------- */
  
  activateListeners(html) {
      super.activateListeners(html);
      html.find(".changeKey").change(ev => {
          this.options.selected = ev.target.selectedIndex;
          //@ts-ignore
          this.render(false, { selected: ev.target.selectedIndex });
          return true;
      });

      html.find(".effectCategory").change(ev => {
          this.options.category = ev.target.selectedIndex;
          //@ts-ignore
          this.render(false, { category: ev.target.selectedIndex });
          return true;
      });
  }

  filterEffects(filterString = "") {
      let mods = ValidSpec.allSpecs
          .filter(e => e._fieldSpec.includes(filterString))
          .reduce((mods, em) => {
              mods[em._fieldSpec] = em._label;
              return mods;
          }, {});
      return mods;
  }

  static initActions() {}
  static setupActions() {
    Object.keys(ActiveEffectChangeEditor.categories).forEach(
        name =>
            (ActiveEffectChangeEditor.categories[name] = game.i18n.localize(ActiveEffectChangeEditor.categories[name]))
    );
    Object.keys(ActiveEffectChangeEditor.advantages).forEach(
        name =>
            (ActiveEffectChangeEditor.advantages[name] = game.i18n.localize(ActiveEffectChangeEditor.advantages[name]))
    );
  }

  static readyActions() {
      this.validMods.sort((a, b) => (game.i18n.localize(a._fieldSpec) < game.i18n.localize(b._fieldSpec) ? -1 : 1));
  }

  getData() {
    if (!this.options.allEffectList) this.options.allEffectList = this.filterEffects();
    // Return data
    var modSpecKey;
    var category;
    if (this.options.selected) {
      this.object.change.key =  Object.keys(this.options.effectList)[this.options.selected];
    }
    console.warn("getdata ", this.options)
    if (this.options.category) {
        category = Object.keys(ActiveEffectChangeEditor.categories)[this.options.category - 1];
        this.options.effectList = this.filterEffects(category); //this.options.category)
        // this.options.selected = undefined;
    } else this.options.effectList = this.options.allEffectList;
    let changeData = duplicate(this.object.change);
    changeData.priority = changeData.priority || changeData.mode * 10;
    let data = {
        change: changeData,
        categories: ActiveEffectChangeEditor.categories,
        category: category,
        effects: this.options.effectList,
        //@ts-ignore
        modes: CONST.ACTIVE_EFFECT_MODES,
    };

    if (cubActive) {
      //@ts-ignore
      if (game.cub.conditions) {
        var cubConditions: any = {};
        //@ts-ignore
        for (let condition of game.cub.conditions) {
          cubConditions[condition.name] = condition.name;
        }
      } else var cubConditions = undefined;
    }
    let tokenMagicEffects = {};
    //@ts-ignore
    if (game.modules.get("tokenmagic")?.active) {
      game.settings.get("tokenmagic", "presets").forEach(preset=> {
        tokenMagicEffects[preset.name] = preset.name;
      })
    } else tokenMagicEffects["invalid"] = "module not installed";

    if (game.system.id === "dnd5e") {
      let isTransfer = this.object.effect.flags?.dae?.transfer;
      mergeObject(data, {
        //@ts-ignore come back to this
          languages: CONFIG.DND5E.languages,
          cubConditions: cubActive && cubConditions ? cubConditions : CONFIG.DND5E.conditionTypes,
          conditions: CONFIG.DND5E.conditionTypes,
          damages: CONFIG.DND5E.damageTypes,
          toolProfs: CONFIG.DND5E.toolProficiencies,
          abilities: CONFIG.DND5E.abilities,
          armorProfs: CONFIG.DND5E.armorProficiencies,
          weaponProfs: CONFIG.DND5E.weaponProficiencies,
          tokenMagicEffects: tokenMagicEffects,
          advantages: ActiveEffectChangeEditor.advantages,
          isLanguage: this.object.change.key === "data.traits.languages.value",
          isCUBCondition: (this.object.change.key === "flags.dnd5e.conditions"),
          isCondition: (this.object.change.key === "data.traits.ci.value"),
          isToolProf: this.object.change.key === "data.traits.toolProf.value",
          isArmorProf: this.object.change.key === "data.traits.armorProf.value",
          isWeaponProf: this.object.change.key === "data.traits.weaponProf.value",
          isDamage: ["data.traits.di.value", "data.traits.dr.value", "data.traits.dv.value"].includes(this.object.key),
          proficiencies: { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" },
          isProficiency: this.object.change.key.includes("data.skills") && this.object.change.key.includes("value"),
          isAbility: this.object.change.key.includes("data.skills") && this.object.change.key.includes("ability"),
          isTokenMagic: this.object.change.key.includes("tokenMagic") && !isTransfer,
          isAdvantage: this.object.change.key==="data.attributes.advantage",
      }, {inplace: true, overwrite:true, insertKeys: true, insertValues: true});
    }
    return data;
  }
  async _updateObject(event, formData) {
    // (change, {item, effect, change_id}
    let item = this.object.item;
    let newEffect = duplicate(this.object.effect);
    //@ts-ignore
    newEffect.changes[this.object.change_id] = {key: formData.key, mode: formData.key.includes("macro") ? CONST.ACTIVE_EFFECT_MODES.CUSTOM : formData.mode, value: formData.value, priority: formData.priority};
    if (this.object.item.isOwned) {
      let itemData = duplicate(this.object.item.data)
      itemData.effects.forEach(async ae=> {
        if (ae._id === this.object.effect._id) ae.changes = newEffect.changes;
      })
      this.object.item.actor.updateEmbeddedEntity("OwnedItem", itemData);
    }
    else
      this.object.item.updateEmbeddedEntity("ActiveEffect", newEffect);
  }
}
