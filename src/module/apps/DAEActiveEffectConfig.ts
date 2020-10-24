import { ValidSpec, aboutTimeInstalled } from "../dae";

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
    return `${game.i18n.localize("EFFECT.ConfigTitle")}: ${this.object.data.label}`;
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

    data.effect = this.object.data;
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
    if (aboutTimeInstalled && data.effect.duration.startTime) {
      const Gametime = game.Gametime;
      const abdt = Gametime.DT.createFromSeconds(data.effect.duration.startTime);
      data.durationString = abdt.longDate().time;
    }
    data.sourceName = await this.object.sourceName;
    console.error("Source name ", data.sourceName)
    return data;
  }

  _keySelected(event) {
    const target = event.target;
    return this.submit({preventClose: true}).then(() => this.render());
   }
  /* ----------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".effect-control").click(this._onEffectControl.bind(this));
    html.find(".key").click(this._keySelected.bind(this))
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
        button.closest(".effect-change").remove();
        return this.submit({preventClose: true}).then(() => this.render());
    }
  }

  /* ----------------------------------------- */

  _addEffectChange(button) {
    const changes = button.closest(".tab").querySelector(".changes-list");
    const last = changes.lastElementChild;
    const idx = last ? last.dataset.index+1 : 0;
    const change = $(`
    <li class="effect-change" data-index="${idx}">
        <input type="text" name="changes.${idx}.key" value="data.attributes.str.mod"/>
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
    }
    console.error("update ", formData)
    if (parseInt(formData.duration.startTime) === 0) 
      formData.duration.startTime = game.time.worldTime;
    setProperty(formData, "flags.dae", {transfer: formData.transfer});
    return this.object.update(formData);
  }

  static DAEActiveEffectSheetConfigReadyActions() {
    CONFIG.ActiveEffect.sheetClass = DAEActiveEffectConfig;
  }
}
