import { ValidSpec, aboutTimeInstalled, confirmDelete, midiActive, cubActive, conditionalVisibilityActive } from "../dae";
import { i18n, confirmAction, daeSpecialDurations, daeMacroRepeats, log } from "../../dae";

export class DAEActiveEffectConfig extends ActiveEffectConfig {
  tokenMagicEffects;
  fieldsList;
  traitList;
  languageList;
  conditionList;
  toolProfList;
  armorProfList;
  weaponProfList;
  cubConditionList;
  ConditionalVisibilityList;
  ConditionalVisibilityVisionList;
  validFields;
  constructor(object={}, options={}) {
    super(object, options);
    this.tokenMagicEffects = {};
    //@ts-ignore
    if (game.modules.get("tokenmagic")?.active) {
      game.settings.get("tokenmagic", "presets").forEach(preset=> {
        this.tokenMagicEffects[preset.name] = preset.name;
      })
    } else this.tokenMagicEffects["invalid"] = "module not installed"

    this.fieldsList = Object.keys(ValidSpec.allSpecsObj);
    //@ts-ignore
    if (window.MidiQOL?.midiFlags)  this.fieldsList = this.fieldsList.concat(window.MidiQOL.midiFlags);
    this.fieldsList.sort();
    //@ts-ignore
    log(`There are ${this.fieldsList.length} fields to choose from of which ${window.MidiQOL?.midiFlags?.length || 0} come from midi-qol and ${ValidSpec.allSpecs.length} from dae`);
    if (game.system.id === "dnd5e") {
      this.fieldsList = this.fieldsList.join(", ");
      this.traitList = duplicate(CONFIG.DND5E.damageResistanceTypes);
      Object.keys(CONFIG.DND5E.damageResistanceTypes).forEach(type => {
        this.traitList[`-${type}`] = `-${CONFIG.DND5E.damageResistanceTypes[type]}`;
      });

      this.languageList = duplicate(CONFIG.DND5E.languages);
      Object.keys(CONFIG.DND5E.languages).forEach(type => {
        this.languageList[`-${type}`] = `-${CONFIG.DND5E.languages[type]}`;
      });

      this.conditionList = duplicate(CONFIG.DND5E.conditionTypes);
      Object.keys(CONFIG.DND5E.conditionTypes).forEach(type => {
        this.conditionList[`-${type}`] = `-${CONFIG.DND5E.conditionTypes[type]}`;
      });

      this.toolProfList = duplicate(CONFIG.DND5E.toolProficiencies);
      Object.keys(CONFIG.DND5E.toolProficiencies).forEach(type => {
        this.toolProfList[`-${type}`] = `-${CONFIG.DND5E.toolProficiencies[type]}`;
      });

      this.armorProfList = duplicate(CONFIG.DND5E.armorProficiencies);
      Object.keys(CONFIG.DND5E.armorProficiencies).forEach(type => {
        this.armorProfList[`-${type}`] = `-${CONFIG.DND5E.armorProficiencies[type]}`;
      });

      this.weaponProfList = duplicate(CONFIG.DND5E.weaponProficiencies);
      Object.keys(CONFIG.DND5E.weaponProficiencies).forEach(type => {
        this.weaponProfList[`-${type}`] = `-${CONFIG.DND5E.weaponProficiencies[type]}`;
      });
    } else {
      this.fieldsList = this.fieldsList.join(", ");
      this.traitList = duplicate(CONFIG.SW5E.damageResistanceTypes);
      Object.keys(CONFIG.SW5E.damageResistanceTypes).forEach(type => {
        this.traitList[`-${type}`] = `-${CONFIG.SW5E.damageResistanceTypes[type]}`;
      });

      this.languageList = duplicate(CONFIG.SW5E.languages);
      Object.keys(CONFIG.SW5E.languages).forEach(type => {
        this.languageList[`-${type}`] = `-${CONFIG.SW5E.languages[type]}`;
      });

      this.conditionList = duplicate(CONFIG.SW5E.conditionTypes);
      Object.keys(CONFIG.SW5E.conditionTypes).forEach(type => {
        this.conditionList[`-${type}`] = `-${CONFIG.SW5E.conditionTypes[type]}`;
      });

      this.toolProfList = duplicate(CONFIG.SW5E.toolProficiencies);
      Object.keys(CONFIG.SW5E.toolProficiencies).forEach(type => {
        this.toolProfList[`-${type}`] = `-${CONFIG.SW5E.toolProficiencies[type]}`;
      });

      this.armorProfList = duplicate(CONFIG.SW5E.armorProficiencies);
      Object.keys(CONFIG.SW5E.armorProficiencies).forEach(type => {
        this.armorProfList[`-${type}`] = `-${CONFIG.SW5E.armorProficiencies[type]}`;
      });

      this.weaponProfList = duplicate(CONFIG.SW5E.weaponProficiencies);
      Object.keys(CONFIG.SW5E.weaponProficiencies).forEach(type => {
        this.weaponProfList[`-${type}`] = `-${CONFIG.SW5E.weaponProficiencies[type]}`;
      });

    }
    if (cubActive) {
      this.cubConditionList = {}
      game.cub.conditions?.forEach(cubc => {
        this.cubConditionList[cubc.name] = cubc.name;
      })
    }
    const ConditionalVisibilityNames = ["invisible", "hidden", "obscured", "indarkness"];
    const ConditionalVisibilityVisionNames = ["blindsight", "devilssight", "seeinvisible", "tremorsense", "truesight"]
    if (conditionalVisibilityActive) {
      this.ConditionalVisibilityList = {};
      ConditionalVisibilityNames.forEach(cvc => {
        this.ConditionalVisibilityList[cvc] = i18n(`CONVIS.${cvc}`);
      })
      this.ConditionalVisibilityVisionList = {};
      ConditionalVisibilityVisionNames.forEach(cvc => {
        this.ConditionalVisibilityVisionList[cvc] = i18n(`CONVIS.${cvc}`);
      })
    }

    this.validFields = ValidSpec.allSpecs
    .filter(e => e._fieldSpec.includes(""))
    .reduce((mods, em) => {
        mods[em._fieldSpec] = em._label;
        return mods;
    }, {});
  }

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["sheet", "active-effect-sheet"],
      title: "EFFECT.ConfigTitle",
      template: `./modules/dae/templates/DAEActiveSheetConfig.html`,
      width: 900,
      height: "auto",
      resizable: true,
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
      return this.languageList;
    if (spec === "data.traits.ci.value") 
      return this.conditionList;
    if (spec === "data.traits.toolProf.value")
      return this.toolProfList;
    if (spec === "data.traits.armorProf.value")
      return this.armorProfList;
    if (spec === "data.traits.weaponProf.value")
      return this.weaponProfList;
    if (["data.traits.di.value", "data.traits.dr.value", "data.traits.dv.value"].includes(spec))
      return this.traitList;
    if (spec.includes("data.skills") && spec.includes("value"))
      return { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" };
    if (spec.includes("data.skills") && spec.includes("ability")) {
      if (game.system.id === "dnd5e")
        return CONFIG.DND5E.abilities;
      else
        return CONFIG.SW5E.abilities;
    }
    if (spec.includes("tokenMagic"))
      return this.tokenMagicEffects;
    if (spec === "macro.CUB") return this.cubConditionList;
    if (spec === "macro.ConditionalVisibility") return this.ConditionalVisibilityList;
    if (spec === "macro.ConditionalVisibilityVision") return this.ConditionalVisibilityVisionList;

/*
    blindsight: false
devilssight: false
hidden: false
indarkness: false
invisible: false
obscured: false
seeinvisible: true
tremorsense: false
truesight: false
*/
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
    //@ts-ignore
    data.specialDuration = daeSpecialDurations;
    data.macroRepeats = daeMacroRepeats;

    if (this.object.parent) {
      data.isItem = this.object.parent.__proto__.constructor.name === CONFIG.Item.entityClass.name
      data.isActor = this.object.parent.__proto__.constructor.name === CONFIG.Actor.entityClass.name
    }
    data.validFields = this.validFields;
    data.submitText = "EFFECT.Submit";
    //@ts-ignore
    data.effect.changes.forEach(change => {
      if (change.key.startsWith("flags.midi-qol")) {
        //@ts-ignore
        change.modes = allModes; //change.mode ? allModes: [allModes[CONST.ACTIVE_EFFECT_MODES.CUSTOM]];
      } 
      else if ([-1, undefined].includes(ValidSpec.allSpecsObj[change.key]?.forcedMode)) {
        change.modes = allModes;
      }
      else {
        change.modes = [allModes[ValidSpec.allSpecsObj[change.key]?.forcedMode]]
      }
      change.options = this.getOptionsForSpec(change.key);
      if (!change.priority) change.priority = change.mode * 10;
    });
    if (aboutTimeInstalled && data.effect.duration?.startTime) {
      //@ts-ignore
      const Gametime = window.Gametime;
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
    data.fieldsList =  this.fieldsList;
    return data;
  }

  _keySelected(event) {
    const target = event.target;
    // $(target.parentElement.parentElement.children[1]).find(".keylist").val(ValidSpec.allSpecs[target.selectedIndex].fieldSpec)
    $(target.parentElement.parentElement.parentElement.children[0]).find(".awesomplete").val(ValidSpec.allSpecs[target.selectedIndex].fieldSpec)
    return this.submit({preventClose: true}).then(() => this.render());
   }
  /* ----------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".keylist").change(this._keySelected.bind(this))
    html.find(".awesomplete").on("awesomplete-selectcomplete", this._textSelected.bind(this));
}

  /* ----------------------------------------- */
  _textSelected(event) {
    return this.submit({preventClose: true}).then(() => this.render());
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
      case "add-specDur":
        this._addSpecDuration(button);
        return this.submit({preventClose: true}).then(() => this.render());
      case "delete-specDur":
        return confirmAction(confirmDelete, () => {
          button.closest(".effect-special-duration").remove();
          this.submit({preventClose: true}).then(() => this.render());
        });
    }
  }

  _addSpecDuration(button) {
    const durations = button.closest(".tab").querySelector(".special-duration-list");
    const last = durations.lastElementChild;
    const idx = last ? last.dataset.index+1 : 0;
    const duration = $(` 
    <li class="effect-special-duration flexrow" data-index="${idx}">
    <div class="formgroup">
      <select name="flags.dae.specialDuration.${idx}" data-dtype="string">
        {{selectOptions ../specialDuration selected=label}}
      </select>
      <div class="effect-controls">
        <a class="effect-control" data-action="delete-specDur"><i class="fas fa-trash"></i></a>
      </div>
    </div>
  </li>
    `);
    durations.appendChild(duration[0])
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
    if (formData.flags?.dae?.specialDuration) {
      const newSpecDur = []
      Object.values(formData.flags?.dae?.specialDuration).forEach(value => newSpecDur.push(value));
      formData.flags.dae.specialDuration = newSpecDur;
    }
  
    //@ts-ignore isNumeric
    if (Number.isNumeric(formData.duration.startTime)) {
      let startTime = parseInt(formData.duration.startTime);
      if (startTime <= 3600) { // Only acdept durations of 1 hour or less as the start time field
        formData.duration.startTime = game.time.worldTime + parseInt(formData.duration.startTime);
      }
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