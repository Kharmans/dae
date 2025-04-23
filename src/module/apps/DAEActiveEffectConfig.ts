import { cltActive, ceInterface, atlActive, daeSystemClass, geti18nOptions } from "../dae.js";
import { i18n, confirmAction, daeSpecialDurations, daeMacroRepeats, log } from "../../dae.js";
import { ValidSpec } from "../Systems/DAESystem.js";
import { DAEFieldBrowser } from "./FieldBrowser.js";

export var otherFields: any[] = [];

export function addAutoFields(fields: string[]) {
  let newFields = new Set(fields);
  newFields = newFields.union(new Set(otherFields));
  otherFields = Array.from(newFields).sort();
}

// TODO: Remove this stub once on v13 types
declare module "fvtt-types/configuration" {
  namespace foundry.applications.sheets {
    class ActiveEffectConfig extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
      document: ActiveEffect.Implementation;
      submit: Function;
      _processFormData: Function;
      form: any;
    }
  }
}

export class DAEActiveEffectConfig extends (foundry.applications.sheets.ActiveEffectConfig ?? ActiveEffectConfig) {
  tokenMagicEffects;
  cltConditionList;
  ceEffectList;
  statusEffectList;
  ConditionalVisibilityList;
  ConditionalVisibilityVisionList;
  ATLPresets;
  ATLVisionModes;
  validFields;
  validSpecsToUse;
  // @ts-expect-error
  daeFieldBrowser: DAEFieldBrowser;

  // object: any; Patch 4535992 Why ???
  constructor(options: any = {}, v12Options) {
    const object = options.document ?? options.document ?? options; //(options instanceof Document) ? options : options.document;
    if (!v12Options) {
      super(options);
    } else {
      // @ts-expect-error v12 shenanigans
      super(options, v12Options);
    }
    this.tokenMagicEffects = {};
    if (globalThis.TokenMagic?.getPresets) {
      globalThis.TokenMagic.getPresets().forEach(preset => {
        this.tokenMagicEffects[preset.name] = preset.name;
      })
    } else this.tokenMagicEffects["invalid"] = "module not active"

    //@ts-expect-error
    this.validSpecsToUse = ValidSpec.actorSpecs?.union;
    if (!this.validSpecsToUse) {
      ui.notifications?.error("DAE | No valid specs found");
      return;
    }
    daeSystemClass.configureLists(this)
    if (cltActive) {
      this.cltConditionList = {}
      //@ts-expect-error .clt
      game.clt.conditions?.forEach(cltc => {
        this.cltConditionList[cltc.id] = cltc.name;
      })
    }

    this.statusEffectList = {};
    let efl: any = CONFIG.statusEffects;
    efl = efl.filter(se => se.id)
      .map(se => {
        if (se.id.startsWith("Convenient Effect:")) return { id: se.id, name: `${se.name} (CE)` };
        if (foundry.utils.getProperty(se, "flags.condition-lab-triggler")) return { id: se.id, name: `${se.name} (CLT)` };
        return { id: se.id, name: i18n(se.name) };
      });
    if (ceInterface?.findEffects) {
      const ceList = ceInterface.findEffects().map(ce => ({ id: `z${ce.flags["dfreds-convenient-effects"].ceEffectId}`, name: `${ce.name} (CE)` }));
      // efl = efl.concat(ceList);
    }
    efl = efl.sort((a, b) => a.name < b.name ? -1 : 1);
    efl.forEach(se => {
      this.statusEffectList[se.id] = se.name;
    });

    if (ceInterface) {
      this.ceEffectList = {};
      if (ceInterface.findEffects)
        ceInterface.findEffects().forEach(ceEffect => { this.ceEffectList[ceEffect.name] = ceEffect.name; });
      else {
        //@ts-expect-error
        game.dfreds.effects.all.forEach(ceEffect => { this.ceEffectList[ceEffect.name] = ceEffect.name; });
      }
    }

    if (atlActive && !isEnchantment(object)) {
      this.ATLPresets = {};
      //@ts-expect-error
      game.settings?.get("ATL", "presets")?.forEach(preset => this.ATLPresets[preset.name] = preset.name);

      Object.keys(CONFIG.Canvas.detectionModes).forEach(dm => {
        otherFields.push(`ATL.detectionModes.${dm}.range`);
      });

      this.ATLVisionModes = {};
      Object.values(CONFIG.Canvas.visionModes)
        .filter(f => f.tokenConfig)
        //@ts-expect-error
        .forEach(f => this.ATLVisionModes[f.id] = i18n(f.label))
    }

    this.validFields = { "__": "" }
    this.validFields = this.validSpecsToUse.allSpecs
      .filter(e => e._fieldSpec.includes(""))
      .reduce((mods, em) => {
        mods[em._fieldSpec] = em._label;
        return mods;
      }, this.validFields);
    if (!isEnchantment(this.document)) {
      for (let field of otherFields) {
        this.validFields[field] = field;
      }
    }
    this.daeFieldBrowser = new DAEFieldBrowser(this.validFields, this);
    this.daeFieldBrowser.init();
  }

  /** @override */
  static get defaultOptions() {
    // @ts-expect-error v12-shenanigans
    return foundry.utils.mergeObject(super.defaultOptions ?? {}, {
      classes: ["sheet", "active-effect-sheet window-app"],
      title: "EFFECT.ConfigTitle",
      template: `./modules/dae/templates/DAEActiveSheetConfig.html`,
      width: 900,
      height: "auto",
      resizable: true,
      tabs: [{ navSelector: ".tabs", contentSelector: "form", initial: "details" }],
      dragDrop: [{ dropSelector: ".value" }, { dropSelector: ".key" }],
      scrollY: [".dae-scrollable-list .scrollable"],
      viewPermission: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    });
  }

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
    window: {
      title: "EFFECT.ConfigTitle",
      resizable: true
    },
    position: {
      height: "auto" as "auto",
      width: 900
    },
    classes: ["sheet", "active-effect-config", "window-app", "dae"],
    actions: {
      addSpecialDuration: DAEActiveEffectConfig.#onAddSpecialDuration,
      deleteSpecialDuration: DAEActiveEffectConfig.#onDeleteSpecialDuration
    }
  }, { inplace: false });

  static PARTS = foundry.utils.mergeObject(super.PARTS ?? {}, {
    details: {template: "./modules/dae/templates/DAESheetConfig/Details.hbs"},
    duration: {template: "./modules/dae/templates/DAESheetConfig/Duration.hbs"},
    changes: {template: "./modules/dae/templates/DAESheetConfig/Changes.hbs"}
  }, {inplace: false});

  /* ----------------------------------------- */

  get id() {
    return `${this.constructor.name}-${this.document.uuid.replace(/\./g, "-")}`;
  }
  /* ----------------------------------------- */
  getOptionsForSpec(spec) {
    if (!spec?.key) return undefined;
    if (spec.key.includes("tokenMagic"))
      return this.tokenMagicEffects;
    if (spec.key === "macro.CUB") return this.cltConditionList;
    if (spec.key === "macro.CE") return this.ceEffectList;
    if (spec.key === "macro.StatusEffect") return this.statusEffectList;
    if (spec.key === "macro.CLT") return this.cltConditionList;
    if (spec.key === "StatusEffect") return this.statusEffectList;
    if (spec.key === "macro.ConditionalVisibility") return this.ConditionalVisibilityList;
    if (spec.key === "macro.ConditionalVisibilityVision") return this.ConditionalVisibilityVisionList;
    if (spec.key === "ATL.preset") return this.ATLPresets;
    if (spec.key === "ATL.sight.visionMode") return this.ATLVisionModes;
    return daeSystemClass.getOptionsForSpec(spec);
  }

  async prepHelper(document: ActiveEffect.Implementation, context, options?) {
    if (document.parent instanceof CONFIG.Actor.documentClass || document instanceof CONFIG.Actor.documentClass) {
      this.validSpecsToUse = ValidSpec.actorSpecs[document.parent?.type ?? ""]
    }
    if (isEnchantment(document)) {
      document.transfer = false;
      // @ts-expect-error no dnd5e-types
      if (document.isAppliedEnchantment) {
        this.validSpecsToUse = ValidSpec.itemSpecs[document.parent?.type ?? ""] ?? ValidSpec.itemSpecs["union"];
      } else {
        let restrictionType = "union";
        if (document.parent instanceof CONFIG.Item.documentClass) {
          // @ts-expect-error no dnd5e-types
          const activity = document.parent.system.activities.find(
            a => a.type === "enchant" && a.effects.find(e => e.effect?.uuid === document?.uuid)
          );
          if (activity) {
            restrictionType = activity.restrictions.type;
          }
          this.validSpecsToUse = ValidSpec.itemSpecs[restrictionType || "union"];
        }
      }
    }
    if (!this.validSpecsToUse) {
      ui.notifications?.error("DAE | No valid specs found");
      return;
    }
    this.validFields = { "__": "" }
    this.validFields = this.validSpecsToUse.allSpecs
      .filter(e => e._fieldSpec.includes(""))
      .reduce((mods, em) => {
        mods[em._fieldSpec] = em._label;
        return mods;
      }, this.validFields);
    if (!isEnchantment(document)) {
      for (let field of otherFields) {
        this.validFields[field] = field;
      }
    }
    this.daeFieldBrowser = new DAEFieldBrowser(this.validFields, this);
    this.daeFieldBrowser.init();
    if (foundry.utils.getProperty(document, "flags.dae.specialDuration") === undefined)
      foundry.utils.setProperty(document, "flags.dae.specialDuration", []);

    if (!foundry.utils.getProperty(document, "flags.dae.stackable")) {
      foundry.utils.setProperty(document, "flags.dae.stackable", "multi");
      foundry.utils.setProperty(context, "effect.flags.dae.stackable", "multi");
    }

    await daeSystemClass.editConfig();

    const allModes = Object.entries(CONST.ACTIVE_EFFECT_MODES)
      .reduce((obj, e) => {
        obj[e[1]] = i18n("EFFECT.MODE_" + e[0]);
        return obj;
      }, {});
    context.modes = allModes;
    context.specialDuration = daeSpecialDurations;
    context.showSpecialDurations = Object.keys(daeSpecialDurations)?.length > 1;
    context.macroRepeats = daeMacroRepeats;
    context.stackableOptions = geti18nOptions("StackableOptions", "dae");

    if (document.parent) {
      context.isItemEffect = document.parent instanceof CONFIG.Item.documentClass;
      context.isActorEffrect = document.parent instanceof CONFIG.Actor.documentClass;
    }
    context.validFields = this.validFields;
    context.submitText = "EFFECT.Submit";

    (context.source ?? context.effect).changes.forEach(change => {
      if ([-1, undefined].includes(this.validSpecsToUse.allSpecsObj[change.key]?.forcedMode)) {
        change.modes = allModes;
      } else if (this.validSpecsToUse.allSpecsObj[change.key]) {
        const mode = {};
        mode[this.validSpecsToUse.allSpecsObj[change.key]?.forcedMode] = allModes[this.validSpecsToUse.allSpecsObj[change.key]?.forcedMode];
        change.modes = mode;
      } /*else if (!this.validSpecsToUse.allSpecsObj[change.key].startsWith("flags.midi-qol")) {
        change.modes = allModes; //change.mode ? allModes: [allModes[CONST.ACTIVE_EFFECT_MODES.CUSTOM]];
      }*/

      if (this.validSpecsToUse.allSpecsObj[change.key]?.options)
        change.options = this.validSpecsToUse.allSpecsObj[change.key]?.options;
      else
        change.options = this.getOptionsForSpec(change);
      if (!change.priority) change.priority = change.mode * 10;

      const fieldInfo = this.daeFieldBrowser.getFieldInfo(change.key);
      change.fieldName = fieldInfo.name;
      change.fieldDescription = fieldInfo.description;
      if (fieldInfo.name === change.key && !change.key.startsWith("flags")) {
        // Could not find the key so set the name to <UNKNOWN>
        change.fieldName = "<UNKNOWN>";
      }

    });

    const simpleCalendar = globalThis.SimpleCalendar?.api;
    if (simpleCalendar && context.document.duration?.startTime) {
      const dateTime = simpleCalendar.formatDateTime(simpleCalendar.timestampToDate(context.document.duration.startTime));
      context.startTimeString = dateTime.date + " " + dateTime.time;
      if (context.document.duration.seconds) {
        const duration = simpleCalendar.formatDateTime(simpleCalendar.timestampToDate(context.document.duration.startTime + context.document.duration.seconds));
        context.durationString = duration.date + " " + duration.time;
      }
    }
    // @ts-expect-error
    foundry.utils.setProperty(context.document, "flags.dae.durationExpression", document.flags?.dae?.durationExpression);
    if (!(context.effect ?? context.document).flags?.dae?.specialDuration || !((context.effect ?? context.document).flags.dae.specialDuration instanceof Array))
      foundry.utils.setProperty(context.document.flags, "dae.specialDuration", []);
    context.sourceName = await document.sourceName;
    context.midiActive = globalThis.MidiQOL !== undefined;
    context.isEnchantment = isEnchantment(document);
    context.isConditionalActivationEffect = document.parent?.name === i18n("dae.ConditionalEffectsItem");
    if (context.isConditionalActivationEffect) {
      context.transfer = false;
      if (context.effect) context.effect.transfer = false;
      if (context.document) context.document.transfer = false;
    }
    return context;
  }

  // TODO: Kill once v12 is over
  /** @override */
  async getData(options?): Promise<any> {
    // @ts-expect-error v12 shenanigans
    const context = await super.getData(options);
    // @ts-expect-error v12 shenanigans
    return this.prepHelper(this.object, context, options);
  }

  async _prepareContext(options?) {
    const context = await super._prepareContext(options);
    return this.prepHelper(this.document, context, options);
  }

  updateFieldInfo() {
    const element = this.element instanceof jQuery ? this.element[0] : this.element;
    if (!element) return;

    const changes = this.document.changes;
    changes.forEach((change, index) => {
      const fieldInfo = this.daeFieldBrowser.getFieldInfo(change.key);
      const row = element.querySelector(`.effect-change[data-index="${index}"]`);
      const fieldName = row?.querySelector(".dae-field-name");
      const fieldDescription = row?.querySelector(".dae-field-description");
      if (fieldName && fieldDescription) {
        fieldName.textContent = fieldInfo.name;
        fieldDescription.textContent = fieldInfo.description;
      }
    });
  }

  _onRender(context, options) {
    // @ts-expect-error
    const currTabId = Object.values(context.tabs)?.find(i => i.active)?.id;
    if (currTabId !== "changes") this.position.height = this.element.offsetHeight ?? "auto";
    const keyInputs = Array.from(this.element.querySelectorAll(".key-input"));
    for (const keyInput of keyInputs) {
      keyInput.addEventListener("click", this._onKeyInputInteraction.bind(this));
      keyInput.addEventListener("input", this._onKeyInputInteraction.bind(this));
    }
  }

  /** @override */
  activateListeners(html) {
    // @ts-expect-error v12 shenanigans
    super.activateListeners(html);

    // html.find(".effectTransfer").on("click", event => {
    //   this.object.transfer = !this.object.transfer;
    //   this.render(true);
    // });

    const keyInputs: Element[] = Array.from(this.element[0].querySelectorAll(".key-input"));
    for (const keyInput of keyInputs) {
      keyInput.addEventListener("click", this._onKeyInputInteraction.bind(this));
      keyInput.addEventListener("input", this._onKeyInputInteraction.bind(this));
    }
  }

  changeTab(tab, group, options) {
    let autoPos: foundry.applications.api.ApplicationV2.Position = {...this.position, height: "auto"};
    this.setPosition(autoPos);
    super.changeTab(tab, group, options);
    // Don't want to allow resizing height for changes tab, as that's handled by resizing the textareas themselves
    if (tab === "changes") return;
    let newPos = {...this.position, height: this.element.offsetHeight};
    this.setPosition(newPos);
  }

  private _onKeyInputInteraction(event): void {
    const input = event.currentTarget as HTMLInputElement;
    this.daeFieldBrowser.setInput(input);

    if (event.type === "click") {
      this.daeFieldBrowser.updateBrowser();
    } else if (event.type === "input") {
      this.daeFieldBrowser.debouncedUpdateBrowser();
    }
  }

  public onFieldSelected(): void {
    this.submit({ preventClose: true })?.then(() => this.render());
  }

  /* ----------------------------------------- */

  _onDragStart(ev) { }

  async _onDrop(ev) {
    ev.preventDefault();
    const data: any = TextEditor.getDragEventData(ev);
    const item = await fromUuid(data.uuid);
    const targetValue = ev.target.value?.split(",")[1];
    if (data.uuid) ev.target.value = data.uuid + (targetValue ? `, ${targetValue}` : "");
    if (data.fieldName) {
      ev.target.value = data.fieldName;
      this.daeFieldBrowser.debouncedUpdateBrowser();
      // TODO need to update the description when selected.
    }
  }

  static #onAddSpecialDuration() {
    // @ts-expect-error static doesn't seem to inherit
    const submitData = this._processFormData(null, this.form, new FormDataExtended(this.form));
    const specialDuration = Object.values(submitData.flags?.dae?.specialDuration ?? {});
    // @ts-expect-error as above
    return this.submit({
      preventClose: true, 
      updateData: {
        "flags.dae.specialDuration": specialDuration.concat("None")
      }
    });
  }

  static #onDeleteSpecialDuration(event) {
    // @ts-expect-error as above
    const submitData = this._processFormData(null, this.form, new FormDataExtended(this.form));
    const specialDuration = Object.values(submitData.flags?.dae?.specialDuration ?? {});
    const idx = Number(event.target.closest("li").dataset.index) || 0;
    specialDuration.splice(idx, 1);
    // @ts-expect-error as above
    return this.submit({ 
      preventClose: true,
      updateData: {
        "flags.dae.specialDuration": specialDuration
      }
    });
  }

  /* ----------------------------------------- */
  // V12 only
  async _onEffectControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch (button.dataset.action) {
      case "add":
        return this._addEffectChange();
      case "delete":
        button.closest(".effect-change").remove();
        return this.submit({ preventClose: true }).then(() => this.render()) as Promise<this>;
      case "add-specDur":
        this._addSpecDuration();
        return this.submit({ preventClose: true }).then(() => this.render()) as Promise<this>;
      case "delete-specDur":
        button.closest(".effect-special-duration").remove();
        return this.submit({ preventClose: true }).then(() => this.render()) as Promise<this>;
    }
    return this;
  }

  _addSpecDuration() {
    // @ts-expect-error v12 shenanigans
    const idx = this.object.flags?.dae.specialDuration?.length ?? 0;
    // @ts-expect-error v12 shenanigans
    if (idx === 0) foundry.utils.setProperty(this.object, "flags.dae.specialDuration", []);
    return this.submit({
      preventClose: true, updateData: {
        [`flags.dae.specialDuration.${idx}`]: ""
      }
    });
  }

  /* ----------------------------------------- */

  async _addEffectChange(): Promise<this> {
    // @ts-expect-error v12 shenanigans
    const idx = (this.document ?? this.object).changes.length;
    return (this.submit({
      preventClose: true, updateData: {
        [`changes.${idx}`]: { key: "", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "" }
      }
    })) ?? this;
  }

  submitHelper(document: ActiveEffect.Implementation, data) {
    for (let change of data.changes ?? []) {
      if (typeof change.priority === "string") change.priority = Number(change.priority);
      if (change.priority === undefined || isNaN(change.priority)) change.priority = change.mode ? change.mode * 10 : 0;
    }
    if (!data.tint || data.tint === "") data.tint = null;
    // fixed for very old items
    if (document.origin?.includes("OwnedItem.")) data.origin = document.origin.replace("OwnedItem.", "Item.");
    if (data.flags?.dae?.enableCondition?.length > 0) data.transfer = false;
    if (data.transfer && !isEnchantment(document)) data.origin = document.parent?.uuid;
    else delete data.origin;
    if (isEnchantment(document)) data.transfer = false;
    data.statuses ??= [];

    foundry.utils.setProperty(data, "flags.dae.specialDuration", Array.from(Object.values(data.flags?.dae?.specialDuration ?? {})))
    return data;
  }

  async _processSubmitData(event, form, submitData) {
    submitData = this.submitHelper(this.document, submitData);
    await this.document.update(submitData);
  }

  _getSubmitData(updateData: any = {}) {
    // @ts-expect-error v12 shenanigans
    const data = this.submitHelper(this.object, super._getSubmitData(updateData))
    return data;
  }
  /* ----------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    if (formData.duration) {
      //@ts-expect-error isNumeric
      if (Number.isNumeric(formData.duration?.startTime) && Math.abs(Number(formData.duration.startTime) < 3600)) {
        let startTime = parseInt(formData.duration.startTime);
        if (Math.abs(startTime) <= 3600) { // Only acdept durations of 1 hour or less as the start time field
          formData.duration.startTime = (game.time?.worldTime ?? 0) + parseInt(formData.duration.startTime);
        }
        // @ts-expect-error v12-shenanigans
      } else if (this.object.parent?.isOwned) formData.duration.startTime = null;
    }
    if (isEnchantment(formData)) formData.transfer = false;
    // @ts-expect-error v12-shenanigans
    await this.object.update(formData);
  }

  /** @override */
  async close(options = {}): Promise<this> {
    // Once purely in v13 can probably make this happen in _preClose
    // Though it seems right to do it this way, if there's any issue with overriding close, the closeDAEActiveEffectConfig hook can be used.
    if (this.daeFieldBrowser && this.daeFieldBrowser.browserElement) {
      this.daeFieldBrowser.browserElement.remove();
      this.daeFieldBrowser.browserElement = null;
    }

    return super.close(options);
  }
}

export function geti18nTranslations() {
  let translations = game.i18n?.translations["dae"];
  // @ts-expect-error protected
  if (!translations) translations = game.i18n._fallback["dae"];
  return translations ?? {};
}

Hooks.once("setup", () => {
  //@ts-expect-error
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    CONFIG.ActiveEffect.documentClass,
    "core",
    DAEActiveEffectConfig,
    {
      label: i18n("dae.EffectSheetLabel"),
      makeDefault: true,
      canBeDefault: true,
      canConfigure: true
    });
})

export function isEnchantment(effect: ActiveEffect): boolean {
  //@ts-expect-error
  if (foundry.utils.isNewerVersion(game.system.version, "3.9.99")) {
    //@ts-expect-error
    return effect.type === "enchantment";
  } else {
    //@ts-expect-error
    return effect.flags?.dnd5e?.type === "enchantment";
  }
}