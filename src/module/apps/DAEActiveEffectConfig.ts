import { ValidSpec, aboutTimeInstalled, confirmDelete } from "../dae";
import { i18n, confirmAction, daeSpecialDurations, daeMacroRepeats } from "../../dae";

export class DAEActiveEffectConfig extends ActiveEffectConfig {
  tokenMagicEffects;
  constructor(object={}, options={}) {
    super(object, options);
    this.tokenMagicEffects = {};
    //@ts-ignore
    if (game.modules.get("tokenmagic")?.active) {
      game.settings.get("tokenmagic", "presets").forEach(preset=> {
        this.tokenMagicEffects[preset.name] = preset.name;
      })
    } else this.tokenMagicEffects["invalid"] = "module not installed"
  }

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["sheet", "active-effect-sheet"],
      title: "EFFECT.ConfigTitle",
      template: `./modules/dae/templates/DAEActiveSheetConfig.html`,
      width: 750,
      height: "auto",
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "details"}]
    });
  }

  /* ----------------------------------------- */

  /** @override */
  get title() {
    let suffix = this.object.parent.isOwned ? "(Owned Item) Experimental" :"";
    return `${i18n("EFFECT.ConfigTitle")}: ${this.object.data.label}` + suffix;
  }

  get id() {
    const object = this.object;
    let id = `ActiveEffectsConfig-${object?.id}`;
    if (object?.isToken) id += `-${object.token.id}`;
    return id;
  }
  /* ----------------------------------------- */

  getOptionsForSpec(spec) {
    if (spec === "data.traits.languages.value") 
      return CONFIG.DND5E.languages;
    if (spec === "data.traits.ci.value") 
      return CONFIG.DND5E.conditionTypes;
    if (spec === "data.traits.toolProf.value")
      return CONFIG.DND5E.toolProficiencies;
    if (spec === "data.traits.armorProf.value")
      return CONFIG.DND5E.armorProficiencies;
    if (spec === "data.traits.weaponProf.value")
      return CONFIG.DND5E.weaponProficiencies;
    if (["data.traits.di.value", "data.traits.dr.value", "data.traits.dv.value"].includes(spec))
      return CONFIG.DND5E.damageResistanceTypes;
    if (spec.includes("data.skills") && spec.includes("value"))
      return { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" };
    if (spec.includes("data.skills") && spec.includes("ability"))
      return CONFIG.DND5E.abilities;
    if (spec.includes("tokenMagic"))
      return this.tokenMagicEffects;
      if (spec === "data.traits.size") return CONFIG.DND5E.actorSizes;
    return false;
   }

   /** @override */
  async getData(options) {
    const data = super.getData(options);
    //@ts-ignore
    const allModes = Object.entries(CONST.ACTIVE_EFFECT_MODES)
    .reduce((obj, e) => {
      //@ts-ignore
      obj[e[1]] = game.i18n.localize("EFFECT.MODE_"+e[0]);
      return obj;
    }, {});
    data.specialDuration = daeSpecialDurations;
    data.macroRepeats = daeMacroRepeats;

    if (this.object.parent) {
      data.isItem = this.object.parent.__proto__.constructor.name === CONFIG.Item.entityClass.name
      data.isActor = this.object.parent.__proto__.constructor.name === CONFIG.Actor.entityClass.name
    }
    data.validFields = ValidSpec.allSpecs
          .filter(e => e._fieldSpec.includes(""))
          .reduce((mods, em) => {
              mods[em._fieldSpec] = em._label;
              return mods;
          }, {});
    data.submitText = "EFFECT.Submit";
    //@ts-ignore
    data.effect.changes.forEach(change => {
      if ([-1, undefined].includes(ValidSpec.allSpecsObj[change.key]?.forcedMode)) 
        change.modes = allModes;
      else 
        change.modes = [allModes[ValidSpec.allSpecsObj[change.key]?.forcedMode]]
      change.options = this.getOptionsForSpec(change.key);
      if (!change.priority) change.priority = change.mode * 10;
    });
    if (aboutTimeInstalled && data.effect.duration?.startTime) {
      const Gametime = game.Gametime;
      const startTime = Gametime.DT.createFromSeconds(data.effect.duration.startTime).shortDate();
      data.startTimeString = (startTime.date + " " + startTime.time) || "";
      if (data.effect.duration.seconds) {
        const endTime = Gametime.DT.createFromSeconds(data.effect.duration.startTime + data.effect.duration.seconds).shortDate();
        data.durationString = endTime.date + " " + endTime.time;
      }
    }
    if (!data.effect.flags.dae?.specialDuration)
      setProperty(data.effect.flags, "dae.specialDuration", []);
    if (typeof data.effect.flags.dae?.specialDuration === "string") {
      data.effect.flags.dae.specialDuration = [data.effect.flags.dae.specialDuration]
    }
    data.sourceName = await this.object.sourceName;
    // data.effect.flags.dae.stackable = this.object.data.flags?.dae?.stackable ||false;

    return data;
  }

  _keySelected(event) {
    const target = event.target;
    $(target.parentElement.parentElement.children[1]).find(".keyinput").val(ValidSpec.allSpecs[target.selectedIndex].fieldSpec)
    return this.submit({preventClose: true}).then(() => this.render());
   }
  /* ----------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".keylist").change(this._keySelected.bind(this))
  }

  /* ----------------------------------------- */

  _onEffectControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch ( button.dataset.action ) {
      case "add":
        this._addEffectChange(button);
        return this.submit({preventClose: true}).then(() => this.render());
      case "delete":
        return confirmAction(confirmDelete, () => {
          button.closest(".effect-change").remove();
          this.submit({preventClose: true}).then(() => this.render());
        });
    }
  }

  /* ----------------------------------------- */

  _addEffectChange(button) {
    const changes = button.closest(".tab").querySelector(".changes-list");
    const last = changes.lastElementChild;
    const idx = last ? last.dataset.index+1 : 0;
    const change = $(`
    <li class="effect-change" data-index="${idx}">
        <input type="text" name="changes.${idx}.key" value=""/>
        <input type="number" name="changes.${idx}.mode" value="2"/>
        <input type="text" name="changes.${idx}.value" value="0"/>
        <input type="number" name="changes.${idx}.priority" value="0">
    </li>`);
    changes.appendChild(change[0]);
  }

  /* ----------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    formData = expandObject(formData);
    if (!formData.changes) formData.changes = [];
    formData.changes = Object.values(formData.changes);
    for ( let c of formData.changes ) {
      if (typeof ValidSpec.allSpecsObj[c.key]?.sampleValue === "number") {
        //@ts-ignore
        if ( Number.isNumeric(c.value) ) c.value = parseFloat(c.value);
      }
      if (typeof ValidSpec.allSpecsObj[c.key]?.sampleValue === "string") {
        if (typeof c.value === "number") c.value = `${c.value}`;
      }
      // stored mode is a selection index ok for the list, but not "forced Mode"
      if (ValidSpec.allSpecsObj[c.key]?.forcedMode !== -1) c.mode = ValidSpec.allSpecsObj[c.key]?.forcedMode || c.mode;
      //@ts-ignore
      c.priority = Number.isNumeric(c.priority) ? parseInt(c.priority) : c.mode * 10;
    }
    //@ts-ignore isNumeric
    if (Number.isNumeric(formData.duration.startTime)) {
      formData.duration.startTime = game.time.worldTime + parseInt(formData.duration.startTime);
    }
    setProperty(formData, "flags.dae.transfer", formData.transfer);
    //setProperty(formData, "flags.dae", {stackable: formData.flags.dae.stackable});
    if (this.object.parent.isOwned) { // we are editing an owned item
      let itemData = this.object.parent.data;
      itemData.effects.forEach(efData => {
        if (efData._id == this.object.id)
          mergeObject(efData, expandObject(formData), {overwrite:true, inplace: true})
      })
      this.object.parent.actor.updateOwnedItem(itemData)
    } else {
      return this.object.update(formData);
    }
  }
}
