import { confirmDelete, cubActive, ceActive, atlActive, daeSystemClass } from "../dae";
import { i18n, confirmAction, daeSpecialDurations, daeMacroRepeats, log } from "../../dae";
import { ValidSpec } from "../Systems/DAESystem";

export var otherFields = [];

export function addAutoFields(fields: string[]) {
  fields.forEach(f => {
    if (!otherFields.includes(f)) otherFields.push(f)
  })
  otherFields.sort();
}

export class DAEActiveEffectConfig extends ActiveEffectConfig {
  tokenMagicEffects;
  fieldsList;
  cubConditionList;
  ceEffectList;
  statusEffectList;
  ConditionalVisibilityList;
  ConditionalVisibilityVisionList;
  ATLPresets;
  validFields;
  constructor(object = {}, options = {}) {
    super(object, options);
    this.tokenMagicEffects = {};
    //@ts-ignore
    if (game.modules.get("tokenmagic")?.active) {
      globalThis.TokenMagic.getPresets().forEach(preset => {
        this.tokenMagicEffects[preset.name] = preset.name;
      })
    } else this.tokenMagicEffects["invalid"] = "module not installed"

    let validSpecsToUse = ValidSpec.specs["union"];
    //@ts-ignore documentClass
    if (this.object.parent instanceof CONFIG.Actor.documentClass) {
      validSpecsToUse = ValidSpec.specs[this.object.parent.type]
    }
    this.fieldsList = Object.keys(validSpecsToUse.allSpecsObj);
    this.fieldsList = this.fieldsList.concat(otherFields)
    //@ts-ignore
    // if (window.MidiQOL?.midiFlags)  this.fieldsList = this.fieldsList.concat(window.MidiQOL.midiFlags);
    this.fieldsList.sort();
    //@ts-ignore
    log(`There are ${this.fieldsList.length} fields to choose from of which ${window.MidiQOL?.midiFlags?.length || 0} come from midi-qol and ${validSpecsToUse.allSpecs.length} from dae`);
    this.fieldsList = this.fieldsList.join(", ");

    daeSystemClass.configureLists(this)
   
    if (cubActive) {
      this.cubConditionList = {}
      game.cub.conditions?.forEach(cubc => {
        this.cubConditionList[cubc.name] = cubc.name;
      })
    }
    this.statusEffectList = {};
    let efl = CONFIG.statusEffects
      .filter(se => se.id)
      .map(se => {
        if (se.id.startsWith("combat-utility-belt.")) return { id: se.id, label: `${se.label} (CUB)` };
        if (se.id.startsWith("Convenient Effect:")) return { id: se.id, label: `${se.label} (CE)` };
        return { id: se.id, label: i18n(se.label) };
      })
      .sort((a, b) => a.label < b.label ? -1 : 1);
    efl.forEach(se => {
      this.statusEffectList[se.id] = se.label;
    });

    if (ceActive) {
      this.ceEffectList = {};
      game.dfreds.effects?.all.forEach(ceEffect => {
        this.ceEffectList[ceEffect.name] = ceEffect.name;
      })
    }

    if (atlActive) {
      this.ATLPresets = {};
      game.settings.get("ATL", "presets").forEach(preset => this.ATLPresets[preset.name] = preset.name);
    }
    this.validFields = { "__": "" }
    this.validFields = validSpecsToUse.allSpecs
      .filter(e => e._fieldSpec.includes(""))
      .reduce((mods, em) => {
        mods[em._fieldSpec] = em._label;
        return mods;
      }, this.validFields);
    for (let field of otherFields) {
      this.validFields[field] = field;
    }
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
      tabs: [{ navSelector: ".tabs", contentSelector: "form", initial: "details" }]
    });
  }

  /* ----------------------------------------- */

  /** @override */
  get title() {
    let suffix = this.object.parent.isOwned ? "(Owned Item) Experimental" : "";
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
    if (spec.includes("tokenMagic"))
      return this.tokenMagicEffects;
    if (spec === "macro.CUB") return this.cubConditionList;
    if (spec === "macro.CE") return this.ceEffectList;
    if (spec === "StatusEffect") return this.statusEffectList;
    if (spec === "macro.ConditionalVisibility") return this.ConditionalVisibilityList;
    if (spec === "macro.ConditionalVisibilityVision") return this.ConditionalVisibilityVisionList;
    if (spec === "ATL.preset") return this.ATLPresets;

    return daeSystemClass.getOptionsForSpec(spec);
  }


  /** @override */
  async getData(options) {
    const data = super.getData(options);
    let validSpecsToUse = ValidSpec.specs["union"]; // TODO this needs to be thought about
    await daeSystemClass.editConfig();

    //@ts-ignore
    const allModes = Object.entries(CONST.ACTIVE_EFFECT_MODES)
      .reduce((obj, e) => {
        //@ts-ignore
        obj[e[1]] = game.i18n.localize("EFFECT.MODE_" + e[0]);
        return obj;
      }, {});
      data.modes = allModes;
    //@ts-ignore
    data.specialDuration = daeSpecialDurations;
    data.macroRepeats = daeMacroRepeats;
    const translations = geti18nTranslations();
    data.stackableOptions = translations.stackableOptions ?? { "none": "Effects do not stack", "multi": "Stacking effects apply the effect multiple times", "count": "each stack increase stack count by 1" };

    if (this.object.parent) {
      //@ts-ignore documentClass
      data.isItem = this.object.parent instanceof CONFIG.Item.documentClass;
      //@ts-ignore documentClass
      data.isActor = this.object.parent instanceof CONFIG.Actor.documentClass;
    }
    if (data.isItem) validSpecsToUse = ValidSpec.specs["union"]; // TODO think about what it means to edit an item effect
    if (data.isActor) validSpecsToUse = ValidSpec.specs[this.object.parent.type]; 
    data.validFields = this.validFields;
    data.submitText = "EFFECT.Submit";
    //@ts-ignore
    data.effect.changes.forEach(change => {
      if (change.key.startsWith("flags.midi-qol")) {
        //@ts-ignore
        change.modes = allModes; //change.mode ? allModes: [allModes[CONST.ACTIVE_EFFECT_MODES.CUSTOM]];
      }
      else if ([-1, undefined].includes(validSpecsToUse.allSpecsObj[change.key]?.forcedMode)) {
        change.modes = allModes;
      }
      else {
        const mode = {};
        mode[validSpecsToUse.allSpecsObj[change.key]?.forcedMode] = allModes[validSpecsToUse.allSpecsObj[change.key]?.forcedMode];
        change.modes = mode;
      }
      change.options = this.getOptionsForSpec(change.key);
      if (!change.priority) change.priority = change.mode * 10;
    });

    const simpleCalendar = globalThis.SimpleCalendar?.api;
    if (simpleCalendar && data.effect.duration?.startTime) {
      const dateTime = simpleCalendar.formatDateTime(simpleCalendar.timestampToDate(data.effect.duration.startTime));
      data.startTimeString = dateTime.date + " " + dateTime.time;
      if (data.effect.duration.seconds) {
        const duration = simpleCalendar.formatDateTime(simpleCalendar.timestampToDate(data.effect.duration.startTime + data.effect.duration.seconds));
        data.durationString = duration.date + " " + duration.time;
      }
    }
    setProperty(data.effect, "flags.dae.durationExpression", this.object.data.flags?.dae?.durationExpression);
    if (!data.effect.flags.dae?.specialDuration || !(data.effect.flags.dae.specialDuration instanceof Array))
      setProperty(data.effect.flags, "dae.specialDuration", []);
    data.sourceName = await this.object.sourceName;
    data.fieldsList = this.fieldsList;
    /*
    if (game.modules.get("dfreds-convenient-effects")?.active && !getProperty(this.object.data, "flags.convenientDescription")) {
      setProperty(this.object.data, "flags.convenientDescription", "test");
      setProperty(data.effect.data, "flags.convenientDescription", "test");
    }
    */
    return data;
  }

  _keySelected(event) {
    const target = event.target;
    // $(target.parentElement.parentElement.children[1]).find(".keylist").val(ValidSpec.allSpecs[target.selectedIndex].fieldSpec)
    if (target.selectedIndex === 0) return; // Account for dummy element 0
    $(target.parentElement.parentElement.parentElement.children[0]).find(".awesomplete").val(target.value)
    /*
        if (!ValidSpec.allSpecs[selected]) { // otherfields
          $(target.parentElement.parentElement.parentElement.children[0]).find(".awesomplete").val(selected)
        } else {
          $(target.parentElement.parentElement.parentElement.children[0]).find(".awesomplete").val(ValidSpec.allSpecs[target.selectedIndex-1].fieldSpec)
        }
        */
    return this.submit({ preventClose: true }).then(() => this.render());
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
    return this.submit({ preventClose: true }).then(() => this.render());
  }


  /* ----------------------------------------- */
  _onEffectControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch (button.dataset.action) {
      case "add":
        this._addEffectChange(button);
        return this.submit({ preventClose: true }).then(() => this.render());
      case "delete":
        return confirmAction(confirmDelete, () => {
          button.closest(".effect-change").remove();
          this.submit({ preventClose: true }).then(() => this.render());
        });
      case "add-specDur":
        this._addSpecDuration(button);
        return this.submit({ preventClose: true }).then(() => this.render());
      case "delete-specDur":
        return confirmAction(confirmDelete, () => {
          button.closest(".effect-special-duration").remove();
          this.submit({ preventClose: true }).then(() => this.render());
        });
    }
  }

  _addSpecDuration(button) {
    const durations = button.closest(".tab").querySelector(".special-duration-list");
    const last = durations.lastElementChild;
    const idx = last ? last.dataset.index + 1 : 0;
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
    const idx = last ? last.dataset.index + 1 : 0;
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

    if (formData.flags?.dae?.specialDuration && typeof formData.flags.dae.specialDuration !== "string") {
      const newSpecDur = []
      Object.values(formData.flags?.dae?.specialDuration).forEach(value => newSpecDur.push(value));
      formData.flags.dae.specialDuration = newSpecDur;
    } else setProperty(formData, "flags.dae.specialDuration", []);

    //@ts-ignore isNumeric
    if (Number.isNumeric(formData.duration.startTime) && Math.abs(Number(formData.duration.startTime) < 3600)) {
      let startTime = parseInt(formData.duration.startTime);
      if (Math.abs(startTime) <= 3600) { // Only acdept durations of 1 hour or less as the start time field
        formData.duration.startTime = game.time.worldTime + parseInt(formData.duration.startTime);
      }
    } else if (this.object.parent.isOwned) formData.duration.startTime = null;
    setProperty(formData, "flags.dae.transfer", formData.transfer);
    await this.object.update(formData);
  }
}

export function geti18nTranslations() {
  let translations = game.i18n.translations["dae"];
  //@ts-ignore _fallback not accessible
  if (!translations) translations = game.i18n._fallback["dae"];
  return translations ?? {};
}