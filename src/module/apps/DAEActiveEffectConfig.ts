import { ceInterface, atlActive, daeSystemClass, geti18nOptions } from "../dae.js";
import { i18n, confirmAction, daeSpecialDurations, daeMacroRepeats, log } from "../../dae.js";
import { ValidSpec } from "../Systems/DAESystem.js";
import { DAEFieldBrowser } from "./FieldBrowser.js";

export var otherFields: any[] = [];

export function addAutoFields(fields: string[]) {
  let newFields = new Set(fields);
  newFields = newFields.union(new Set(otherFields));
  otherFields = Array.from(newFields).sort();
}

export class DAEActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
  declare tokenMagicEffects: Record<string, string>;
  declare ceEffectList?: Record<string, string>;
  declare statusEffectList: Record<string, string>;
  declare ConditionalVisibilityList?: Record<string, string>;
  declare ConditionalVisibilityVisionList?: Record<string, string>;
  declare ATLPresets?: Record<string, string>;
  declare ATLVisionModes?: Record<string, string>;
  declare validFields: Record<string, string>;
  declare validSpecsToUse: {
    allSpecs: ValidSpec[];
    allSpecsObj: Record<string, ValidSpec>;
    baseSpecs: ValidSpec[];
    baseSpecsObj: Record<string, ValidSpec>;
    derivedSpecs: ValidSpec[],
    derivedSpecsObj: Record<string, ValidSpec>;
  };
  declare daeFieldBrowser: DAEFieldBrowser;

  // object: any; Patch 4535992 Why ???
  constructor(options: Partial<foundry.applications.sheets.ActiveEffectConfig.Configuration>) {
    // @ts-expect-error v13 stubby
    super(options);
    this.tokenMagicEffects = {};
    if (globalThis.TokenMagic?.getPresets) {
      globalThis.TokenMagic.getPresets().forEach(preset => {
        this.tokenMagicEffects[preset.name] = preset.name;
      })
    } else this.tokenMagicEffects["invalid"] = "module not active"

    this.validSpecsToUse = ValidSpec.actorSpecs?.["union"];
    if (!this.validSpecsToUse) {
      ui.notifications?.error("DAE | No valid specs found");
      return;
    }
    daeSystemClass.configureLists(this)

    this.statusEffectList = {};
    let efl: any = CONFIG.statusEffects;
    efl = efl.filter(se => se.id)
      .map(se => {
        if (se.id.startsWith("Convenient Effect:")) return { id: se.id, name: `${se.name} (CE)` };
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
        // @ts-expect-error for some reason
        ceInterface.findEffects().forEach(ceEffect => { this.ceEffectList[ceEffect.name] = ceEffect.name; });
      else {
        //@ts-expect-error
        game.dfreds.effects.all.forEach(ceEffect => { this.ceEffectList[ceEffect.name] = ceEffect.name; });
      }
    }

    if (atlActive && !isEnchantment(options.document!)) {
      this.ATLPresets = {};
      //@ts-expect-error
      game.settings.get("ATL", "presets")?.forEach(preset => this.ATLPresets[preset.name] = preset.name);

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

  static DEFAULT_OPTIONS = {
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
  };

  static PARTS = foundry.utils.mergeObject(super.PARTS ?? {}, {
    details: { template: "./modules/dae/templates/DAESheetConfig/Details.hbs", scrollable: [""] },
    duration: { template: "./modules/dae/templates/DAESheetConfig/Duration.hbs" },
    changes: { template: "./modules/dae/templates/DAESheetConfig/Changes.hbs", scrollable: ["scrollable"] }
  }, { inplace: false });

  /* ----------------------------------------- */

  get id() {
    return `${this.constructor.name}-${this.document.uuid.replace(/\./g, "-")}`;
  }
  /* ----------------------------------------- */
  getOptionsForSpec(spec) {
    if (!spec?.key) return undefined;
    if (spec.key.includes("tokenMagic"))
      return this.tokenMagicEffects;
    if (spec.key === "macro.CE") return this.ceEffectList;
    if (spec.key === "macro.StatusEffect") return this.statusEffectList;
    if (spec.key === "StatusEffect") return this.statusEffectList;
    if (spec.key === "macro.ConditionalVisibility") return this.ConditionalVisibilityList;
    if (spec.key === "macro.ConditionalVisibilityVision") return this.ConditionalVisibilityVisionList;
    if (spec.key === "ATL.preset") return this.ATLPresets;
    if (spec.key === "ATL.sight.visionMode") return this.ATLVisionModes;
    return daeSystemClass.getOptionsForSpec(spec);
  }

  async _prepareContext(options) {
    const context: DAEActiveEffectConfigRenderContext = await super._prepareContext(options);
    const document = this.document;
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
      return context;
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
      context.isActorEffect = document.parent instanceof CONFIG.Actor.documentClass;
    }
    context.validFields = this.validFields;
    context.submitText = "EFFECT.Submit";

    context.source!.changes.forEach(change => {
      if ([-1, undefined].includes(this.validSpecsToUse.allSpecsObj[change.key]?.forcedMode)) {
        // @ts-expect-error dae-added in-memory property
        change.modes = allModes;
      } else if (this.validSpecsToUse.allSpecsObj[change.key]) {
        const mode = {};
        mode[this.validSpecsToUse.allSpecsObj[change.key]?.forcedMode] = allModes[this.validSpecsToUse.allSpecsObj[change.key]?.forcedMode];
        // @ts-expect-error dae-added in-memory property
        change.modes = mode;
      } /*else if (!this.validSpecsToUse.allSpecsObj[change.key].startsWith("flags.midi-qol")) {
        change.modes = allModes; //change.mode ? allModes: [allModes[CONST.ACTIVE_EFFECT_MODES.CUSTOM]];
      }*/

      if (this.validSpecsToUse.allSpecsObj[change.key]?.options)
        // @ts-expect-error dae-added in-memory property
        change.options = this.validSpecsToUse.allSpecsObj[change.key]?.options;
      else
        // @ts-expect-error dae-added in-memory property
        change.options = this.getOptionsForSpec(change);
      if (!change.priority) change.priority = change.mode * 10;

      const fieldInfo = this.daeFieldBrowser.getFieldInfo(change.key);
      // @ts-expect-error dae-added in-memory property
      change.fieldName = fieldInfo.name;
      // @ts-expect-error dae-added in-memory property
      change.fieldDescription = fieldInfo.description;
      if (fieldInfo.name === change.key && !change.key.startsWith("flags")) {
        // Could not find the key so set the name to <UNKNOWN>
        // @ts-expect-error dae-added in-memory property
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
    foundry.utils.setProperty(context.document, "flags.dae.durationExpression", document.flags?.dae?.durationExpression);
    if (!context.document.flags?.dae?.specialDuration || !(context.document.flags.dae.specialDuration instanceof Array))
      foundry.utils.setProperty(context.document.flags, "dae.specialDuration", []);
    context.sourceName = await document.sourceName;
    context.midiActive = globalThis.MidiQOL !== undefined;
    context.isEnchantment = isEnchantment(document);
    context.isConditionalActivationEffect = document.parent?.name === i18n("dae.ConditionalEffectsItem");
    context.transfer = document.transfer;
    if (context.isConditionalActivationEffect) {
      context.transfer = false;
      context.document.transfer = false;
    }
    return context;
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

  async _onRender(context, options) {
    // @ts-expect-error
    const currTabId = Object.values(context.tabs)?.find(i => i.active)?.id;
    if (currTabId !== "changes") this.position.height = this.element.offsetHeight ?? "auto";
    const keyInputs = Array.from(this.element.querySelectorAll(".key-input"));
    for (const keyInput of keyInputs) {
      keyInput.addEventListener("click", this.#onKeyInputInteraction.bind(this));
      keyInput.addEventListener("input", this.#onKeyInputInteraction.bind(this));
    }
    const transferCheckBox = Array.from(this.element.querySelectorAll(".transferCheckbox"));
    for (const checkbox of transferCheckBox) {
      checkbox.addEventListener("change", (event) => {
        this.submit({ preventClose: true })?.then(() => this.render());
      });
    }
  }
  changeTab(tab, group, options) {
    let autoPos: foundry.applications.api.ApplicationV2.Position = { ...this.position, height: "auto" };
    this.setPosition(autoPos);
    super.changeTab(tab, group, options);
    // Don't want to allow resizing height for changes tab, as that's handled by resizing the textareas themselves
    if (tab === "changes") return;
    let newPos = { ...this.position, height: this.element.offsetHeight };
    this.setPosition(newPos);
  }

  #onKeyInputInteraction(event: Event): void {
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
    const submitData = this._processFormData(null, this.form, new foundry.applications.ux.FormDataExtended(this.form));
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
    const submitData = this._processFormData(null, this.form, new foundry.applications.ux.FormDataExtended(this.form));
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

  async _processSubmitData(event, form, submitData) {
    const document = this.document;
    for (let change of submitData.changes ?? []) {
      if (typeof change.priority === "string") change.priority = Number(change.priority);
      if (change.priority === undefined || isNaN(change.priority)) change.priority = change.mode ? change.mode * 10 : 0;
    }
    if (!submitData.tint || submitData.tint === "") submitData.tint = null;
    // fixed for very old items
    if (document.origin?.includes("OwnedItem.")) submitData.origin = document.origin.replace("OwnedItem.", "Item.");
    if (submitData.flags?.dae?.enableCondition?.length > 0) submitData.transfer = false;
    if (submitData.transfer && !isEnchantment(document)) submitData.origin = document.parent?.uuid;
    else delete submitData.origin;
    if (isEnchantment(document)) submitData.transfer = false;
    submitData.statuses ??= [];

    foundry.utils.setProperty(submitData, "flags.dae.specialDuration", Array.from(Object.values(submitData.flags?.dae?.specialDuration ?? {})))
    await this.document.update(submitData);
  }
  /* ----------------------------------------- */


  async _preClose(options) {
    await super._preClose(options);
    if (this.daeFieldBrowser && this.daeFieldBrowser.browserElement) {
      this.daeFieldBrowser.browserElement.remove();
      this.daeFieldBrowser.browserElement = null;
    }
  }
}

interface DAEActiveEffectConfigRenderContext extends foundry.applications.sheets.ActiveEffectConfig.RenderContext {
  modes?: Record<number, string>;
  specialDuration?: Record<string, string>;
  showSpecialDurations?: boolean;
  macroRepeats?: Record<string, string>
  stackableOptions?: Record<string, string>;
  isItemEffect?: boolean;
  isActorEffect?: boolean;
  validFields?: Record<string, string>;
  submitText?: string;
  startTimeString?: string;
  durationString?: string;
  sourceName?: string;
  midiActive?: boolean;
  isEnchantment?: boolean;
  isConditionalActivationEffect?: boolean;
  transfer?: boolean;
}

export function geti18nTranslations() {
  let translations = game.i18n?.translations["dae"];
  // @ts-expect-error protected
  if (!translations) translations = game.i18n._fallback["dae"];
  return translations ?? {};
}

Hooks.once("setup", () => {
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
  if (foundry.utils.isNewerVersion(game.system.version, "3.9.99")) {
    //@ts-expect-error
    return effect.type === "enchantment";
  } else {
    //@ts-expect-error
    return effect.flags?.dnd5e?.type === "enchantment";
  }
}