import { ceInterface, atlActive, daeSystemClass, getStatusEffectsArray, localizationMap } from "../dae.js";
import { i18n, daeSpecialDurations, daeMacroRepeats, error, daeManagesTurnExpiry } from "../../dae.js";
import { ValidSpec } from "../Systems/DAESystem.js";
import { DAEFieldBrowser } from "./FieldBrowser.js";

export { BooleanFormulaField } from "./BooleanFormulaField.js";

export type AutoFieldEntry = { name: string, type?: import("../Systems/DAESystem.js").FieldType };
export const otherFieldsMap: Map<string, AutoFieldEntry> = new Map();

export function addAutoFields(fields: (string | AutoFieldEntry)[]) {
  for (const field of fields) {
    const entry = typeof field === "string" ? { name: field } : field;
    if (!entry.name) continue;
    const existing = otherFieldsMap.get(entry.name);
    if (existing) {
      // Update type if a new type is provided for an existing entry
      if (entry.type !== undefined) existing.type = entry.type;
      continue;
    }
    otherFieldsMap.set(entry.name, entry);
  }
}

// --- Pluggable field editor registry ---

export interface FieldEditorContext {
  /** The full change key */
  key: string;
  /** The effect being edited */
  effect: ActiveEffect;
  /** The effect's parent document (Actor, Item, etc.) */
  parent: Actor | Item | null;
  /** Index in the changes array */
  changeIndex: number;
  /** The DAEActiveEffectConfig app instance */
  app: DAEActiveEffectConfig;
}

export interface FieldEditorRegistration {
  /** Exact key or prefix ending with "." to match (e.g. "flags.midi-qol.OverTime") */
  keyMatch: string;
  /**
   * Called when the user clicks the edit button.
   * Receives current value string + context, returns updated value or null to cancel.
   */
  editor: (currentValue: string, context: FieldEditorContext) => Promise<string | null>;
  /** Optional icon class (default: "fas fa-edit") */
  icon?: string;
  /** Optional tooltip text */
  tooltip?: string;
}

const fieldEditorRegistry: Map<string, FieldEditorRegistration> = new Map();

export function registerFieldEditor(registration: FieldEditorRegistration): void {
  fieldEditorRegistry.set(registration.keyMatch, registration);
}

export function getFieldEditor(key: string): FieldEditorRegistration | undefined {
  // Exact match first
  if (fieldEditorRegistry.has(key)) return fieldEditorRegistry.get(key);
  // Then prefix match — walk up the key segments
  const parts = key.split(".");
  while (parts.length > 1) {
    parts.pop();
    const prefix = parts.join(".") + ".";
    if (fieldEditorRegistry.has(prefix)) return fieldEditorRegistry.get(prefix);
  }
  return undefined;
}

const stackableOptions = {
  noneName: "dae.StackableOptions.noneName",
  noneNameOnly: "dae.StackableOptions.noneNameOnly",
  none: "dae.StackableOptions.none",
  multi: "dae.StackableOptions.multi",
  count: "dae.StackableOptions.count",
  countDeleteDecrement: "dae.StackableOptions.countDeleteDecrement"
}

export class DAEActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
  declare tokenMagicEffects: Record<string, string>;
  declare statusEffectList: Record<string, string>;
  declare ATLPresets?: Record<string, string>;
  declare ATLVisionModes?: Record<string, string>;
  declare validFields: Record<string, {name: string, description?: string}>;
  declare validSpecsToUse: {
    allSpecs: ValidSpec[];
    allSpecsObj: Record<string, ValidSpec>;
  };
  declare daeFieldBrowser: DAEFieldBrowser;
  ceEffectList: Record<string, string> = {};
  static #migratedEffects: Set<string> = new Set();

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
    daeSystemClass.configureLists()

    this.statusEffectList = {};
    getStatusEffectsArray()
      .filter(se => se.id)
      .map(se => ({ id: se.id, name: i18n(se.name) }))
      .toSorted((a, b) => a.name < b.name ? -1 : 1)
      .forEach(se => {
        this.statusEffectList[se.id] = se.name;
      });

    if (ceInterface) {
      ceInterface.findEffects().forEach(ceEffect => { this.ceEffectList[ceEffect.name] = ceEffect.name; });
    }

    if (atlActive && !isEnchantment(options.document!)) {
      this.ATLPresets = {};
      game.settings.get("ATL", "presets").forEach(preset => this.ATLPresets![preset.name] = preset.name);

      Object.keys(CONFIG.Canvas.detectionModes).forEach(dm => {
        const name = `ATL.detectionModes.${dm}.range`;
        if (!otherFieldsMap.has(name)) {
          otherFieldsMap.set(name, { name });
        }
      });

      this.ATLVisionModes = {};
      Object.values(CONFIG.Canvas.visionModes)
        .filter(f => f.tokenConfig)
        .forEach(f => this.ATLVisionModes![f.id!] = i18n(f.label!))
    }

  }

  static DEFAULT_OPTIONS = {
    window: {
      resizable: true
    },
    position: {
      height: "auto" as "auto",
      width: 900
    },
    classes: ["sheet", "active-effect-config", "window-app", "dae"],
    actions: {
      addSpecialDuration: DAEActiveEffectConfig.#onAddSpecialDuration,
      deleteSpecialDuration: DAEActiveEffectConfig.#onDeleteSpecialDuration,
      resetStartTime: DAEActiveEffectConfig.#onResetStartTime
    }
  };

  static PARTS: Record<string, foundry.applications.api.HandlebarsApplicationMixin.HandlebarsTemplatePart> = (() => {
    const parts = { ...super.PARTS };
    // Insert dae before footer so the tab renders above the submit button
    const footer = parts.footer;
    delete parts.footer;
    parts.dae = { template: "./modules/dae/templates/DAESheetConfig/DAE.hbs", scrollable: [""] };
    if (footer) parts.footer = footer;
    return parts;
  })();

  static TABS = {
    sheet: {
      tabs: [
        { id: "details", icon: "fa-solid fa-book", cssClass: "" },
        { id: "duration", icon: "fa-solid fa-clock", cssClass: "" },
        { id: "dae", icon: "fa-solid fa-wand-magic-sparkles", cssClass: "" },
        { id: "changes", icon: "fa-solid fa-gears", cssClass: "" }
      ],
      initial: "details",
      labelPrefix: "EFFECT.TABS"
    }
  };

  /* ----------------------------------------- */
  getOptionsForSpec(spec?: ActiveEffect.ChangeData) {
    if (!spec?.key) return undefined;
    if (spec.key.includes("tokenMagic"))
      return this.tokenMagicEffects;
    if (spec.key === "macro.CE") return this.ceEffectList;
    if (spec.key === "macro.StatusEffect") return this.statusEffectList;
    if (spec.key === "StatusEffect") return this.statusEffectList;
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
    this.validFields = { "__": { name: ""} }
    this.validFields = this.validSpecsToUse.allSpecs
      .filter(e => e.fieldSpec.includes(""))
      .reduce((mods, em) => {
        mods[em.fieldSpec] = {
          name: localizationMap[em.fieldSpec]?.name ?? em.label,
          description: localizationMap[em.fieldSpec]?.description ?? em.description
        };
        return mods;
      }, this.validFields);
    if (!isEnchantment(document)) {
      for (let fieldName of [...otherFieldsMap.keys()].sort((a, b) => a.toLocaleLowerCase() < b.toLocaleLowerCase() ? -1 : 1)) {
        this.validFields[fieldName] = {
          name: localizationMap[fieldName]?.name ?? fieldName,
          description: localizationMap[fieldName]?.description || (localizationMap[fieldName]?.name ?? fieldName)

        };
      }
    }
    this.daeFieldBrowser = new DAEFieldBrowser(this.validFields, this);
    await this.daeFieldBrowser.init();
    if (document.flags?.dae?.specialDuration === undefined)
      foundry.utils.setProperty(document, "flags.dae.specialDuration", []);

    // One-time migrations — only run once per document per session
    if (!DAEActiveEffectConfig.#migratedEffects.has(document.uuid)) {
      DAEActiveEffectConfig.#migratedEffects.add(document.uuid);
      await this.#migrateDeprecatedData(document);
    }

    if (!document.flags?.dae?.stackable) {
      foundry.utils.setProperty(document, "flags.dae.stackable", "multi");
      foundry.utils.setProperty(context, "effect.flags.dae.stackable", "multi");
    }

    await daeSystemClass.editConfig();

    // DAE-specific duration context:
    context.specialDuration = daeSpecialDurations;
    context.showSpecialDurations = Object.keys(daeSpecialDurations)?.length > 1;
    context.macroRepeats = daeMacroRepeats;
    context.stackableOptions = stackableOptions;
    context.expiryModeOptions = {
      "default": i18n("dae.expiryMode.default"),
      "delete": i18n("dae.expiryMode.delete"),
      "suppress": i18n("dae.expiryMode.suppress"),
    };

    if (document.parent) {
      context.isItemEffect = document.parent instanceof CONFIG.Item.documentClass;
      context.isActorEffect = document.parent instanceof CONFIG.Actor.documentClass;
    }
    context.submitText = "EFFECT.Submit";

    foundry.utils.setProperty(context.document, "flags.dae.durationExpression", document.flags?.dae?.durationExpression);
    if (!context.document.flags?.dae?.specialDuration)
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

  async _renderChange(context) {
    const { change, index } = context;
    // Strip quotes that confuse DAE's selection process
    if (typeof change.value === "string") {
      change.value = change.value.replace(/^(["'])(.*)\1$/, "$2");
    }

    // Restrict change types if the spec has a forced mode
    const spec = this.validSpecsToUse?.allSpecsObj[change.key];
    if (spec?.forcedMode) {
      const restrictedTypes: Record<string, string> = {};
      restrictedTypes[spec.forcedMode] = context.changeTypes[spec.forcedMode] ?? spec.forcedMode;
      context.changeTypes = restrictedTypes;
    }

    // Replace value with a select if the spec provides options
    const options = spec?.options ?? this.getOptionsForSpec(change);

    // Get the base HTML from core
    // @ts-expect-error _renderChange not in fvtt-types yet
    const html = await super._renderChange(context);

    // Parse and inject DAE elements
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    const li = template.content.firstElementChild as HTMLElement;
    if (!li) return html;

    // Inject field info under the key input
    const keyDiv = li.querySelector("div.key");
    if (keyDiv) {
      const keyInput = keyDiv.querySelector("input");
      if (keyInput) keyInput.classList.add("dae-key-input");
      const fieldInfo = this.daeFieldBrowser?.getFieldInfo(change.key);
      const fieldName = fieldInfo?.name ?? change.key;
      const fieldDescription = fieldInfo?.description ?? "";
      const displayName = (fieldName === change.key && !change.key.startsWith("flags")) ? "<UNKNOWN>" : fieldName;
      const infoDiv = document.createElement("div");
      infoDiv.classList.add("dae-field-info");
      infoDiv.innerHTML = `<div class="dae-field-name">${displayName}</div><div class="dae-field-description">${fieldDescription}</div>`;
      keyDiv.appendChild(infoDiv);
    }

    // Replace value input with select if options exist
    const valueDiv = li.querySelector("div.value");
    if (valueDiv && options) {
      const existingInput = valueDiv.querySelector("input");
      if (existingInput) {
        const select = document.createElement("select");
        select.name = `system.changes.${index}.value`;
        select.dataset.dtype = "String";
        for (const [optValue, optLabel] of Object.entries(options)) {
          const option = document.createElement("option");
          option.value = optValue;
          option.textContent = optLabel as string;
          if (optValue === change.value) option.selected = true;
          select.appendChild(option);
        }
        existingInput.replaceWith(select);
      }
    }

    // Inject editor button next to value
    if (valueDiv && !options) {
      const fieldEditor = getFieldEditor(change.key);
      if (fieldEditor) {
        const btn = document.createElement("a");
        btn.classList.add("dae-edit-value");
        btn.dataset.index = String(index);
        btn.dataset.tooltip = fieldEditor.tooltip ?? "Edit";
        btn.innerHTML = `<i class="${fieldEditor.icon ?? "fas fa-edit"}"></i>`;
        valueDiv.appendChild(btn);
      }
    }

    return li.outerHTML;
  }

  updateFieldInfo() {
    // @ts-expect-error v14 system.changes
    const changes = this.document.system.changes;
    changes.forEach((change, index) => {
      const fieldInfo = this.daeFieldBrowser.getFieldInfo(change.key);
      const row = this.element?.querySelector(`li[data-index="${index}"]`);
      const fieldName = row?.querySelector(".dae-field-name");
      const fieldDescription = row?.querySelector(".dae-field-description");
      if (fieldName && fieldDescription) {
        fieldName.textContent = fieldInfo.name;
        fieldDescription.textContent = fieldInfo.description;
      }
    });
  }

  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    const target = event.target as HTMLElement;
  }

  async _onRender(context, options) {
    // @ts-expect-error wait 'til types de-stubs, then type this properly
    const currTabId: string | undefined = Object.values(context.tabs)?.find(i => i.active)?.id;
    if (currTabId !== "changes") this.position.height = this.element.offsetHeight ?? "auto";

    // Inject reset start time button into the core duration tab's start fieldset
    const startFieldset = this.element.querySelector('.tab[data-tab="duration"] fieldset.start-data');
    if (startFieldset) {
      const timeFields = startFieldset.querySelector(".form-fields");
      if (timeFields && !timeFields.querySelector('[data-action="resetStartTime"]')) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.classList.add("icon");
        btn.dataset.action = "resetStartTime";
        btn.dataset.tooltip = i18n("dae.resetStartTime");
        btn.innerHTML = '<i class="fas fa-clock-rotate-left"></i>';
        timeFields.appendChild(btn);
      }
    }

    const keyInputs = Array.from(this.element.querySelectorAll(".dae-key-input"));
    for (const keyInput of keyInputs) {
      keyInput.addEventListener("click", this.#onKeyInputInteraction.bind(this));
      keyInput.addEventListener("input", this.#onKeyInputInteraction.bind(this));
    }
    const transferCheckBox = Array.from(this.element.querySelectorAll(".transferCheckbox"));
    for (const checkbox of transferCheckBox) {
      checkbox.addEventListener("change", (event) => {
        this.submit()?.then(() => this.render());
      });
    }
    new foundry.applications.ux.DragDrop.implementation({
      // dragSelector: ".dae-change-drag-handle",
      dropSelector: ".value",
      callbacks: {
        drop: this._onDrop.bind(this)
      }
    }).bind(this.element);
    // Pluggable editor buttons
    const editButtons = Array.from(this.element.querySelectorAll<HTMLAnchorElement>(".dae-edit-value"));
    for (const btn of editButtons) {
      btn.addEventListener("click", this.#onEditValue.bind(this));
    }

  }
  changeTab(tab: string, group: string, options) {
    if (tab === "changes") {
      // Keep the current height so the changes list can fill available space via flex
      super.changeTab(tab, group, options);
      return;
    }
    let autoPos: foundry.applications.api.ApplicationV2.Position = { ...this.position, height: "auto" };
    this.setPosition(autoPos);
    super.changeTab(tab, group, options);
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
    this.submit()?.then(() => this.render());
  }

  async #onEditValue(event: Event): Promise<void> {
    const btn = event.currentTarget as HTMLElement;
    const index = Number(btn.dataset.index);
    // @ts-expect-error v14 system.changes
    const change = this.document.system.changes[index];
    if (!change) return;

    const registration = getFieldEditor(change.key);
    if (!registration) return;

    // Read current value from the input (may have unsaved edits)
    const valueInput = this.element.querySelector<HTMLInputElement>(
      `input[name="system.changes.${index}.value"]`
    );
    const currentValue = valueInput?.value ?? change.value ?? "";

    const result = await registration.editor(currentValue, {
      key: change.key,
      effect: this.document,
      parent: this.document.parent as Actor | Item | null,
      changeIndex: index,
      app: this,
    });

    if (result !== null && result !== undefined) {
      if (valueInput) valueInput.value = result;
      this.submit()?.then(() => this.render());
    }
  }

  /* ----------------------------------------- */

  async _onDrop(ev: DragEvent) {
    ev.preventDefault();
    const data: any = foundry.applications.ux.TextEditor.getDragEventData(ev);
    const item = await fromUuid(data.uuid);
    const targetValue = (ev.target as HTMLInputElement)?.value?.split(",")[1];
    if (data.uuid && ev.target) {
      (ev.target as HTMLInputElement).value = data.uuid + (targetValue ? `, ${targetValue}` : "");
      this.submit()?.then(() => this.render());
    }

    if (data.fieldName) {
      if (ev.target) (ev.target as HTMLInputElement).value = data.fieldName;
      this.daeFieldBrowser.debouncedUpdateBrowser();
    }
  }

  static #onAddSpecialDuration() {
    // @ts-expect-error v13 stubby
    const submitData = this._processFormData(null, this.form, new foundry.applications.ux.FormDataExtended(this.form));
    const specialDuration = Object.values(submitData.flags?.dae?.specialDuration ?? {}) as string[];
    // @ts-expect-error v13 stubby
    return this.submit({
      updateData: {
        "flags.dae.specialDuration": specialDuration.concat("None")
      }
    });
  }

  static #onDeleteSpecialDuration(event) {
    // @ts-expect-error v13 stubby
    const submitData = this._processFormData(null, this.form, new foundry.applications.ux.FormDataExtended(this.form));
    const specialDuration = Object.values(submitData.flags?.dae?.specialDuration ?? {}) as string[];
    const idx = Number(event.target.closest("li").dataset.index) || 0;
    specialDuration.splice(idx, 1);
    // @ts-expect-error v13 stubby
    return this.submit({
      updateData: {
        "flags.dae.specialDuration": specialDuration
      }
    });
  }

  static #onResetStartTime() {
    // @ts-expect-error v14 ActiveEffect.getEffectStart
    const start = ActiveEffect.getEffectStart(game.combat);
    // @ts-expect-error v13 stubby
    return this.submit({
      updateData: {
        start,
        "duration.expired": false
      }
    });
  }

  async _processSubmitData(event, form, submitData) {
    const document = this.document;

    if (!submitData.tint || submitData.tint === "") submitData.tint = null;
    // fixed for very old items
    if (document.origin?.includes("OwnedItem.")) submitData.origin = document.origin.replace("OwnedItem.", "Item.");
    if (submitData.flags?.dae?.enableCondition?.length > 0) submitData.transfer = false;
    if (submitData.transfer && !isEnchantment(document)) submitData.origin = document.parent?.uuid;
    else delete submitData.origin;
    if (isEnchantment(document)) submitData.transfer = false;
    submitData.statuses ??= [];
    foundry.utils.setProperty(submitData, "flags.dae.specialDuration", Array.from(Object.values(submitData.flags?.dae?.specialDuration ?? {})))

    // Set the correct phase on each change based on the ValidSpec lookup.
    // The schema defaults phase to "initial", but specials/derived fields need "final".
    const changes = submitData.system?.changes;
    if (changes && this.validSpecsToUse?.allSpecsObj) {
      for (const change of Object.values(changes) as any[]) {
        const spec = this.validSpecsToUse.allSpecsObj[change.key];
        if (spec) change.phase = spec.phase;
      }
    }
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

  async #migrateDeprecatedData(document: ActiveEffect) {
    // Migrate deprecated special durations to v14 duration.expiry
    const deprecatedSpecialDurMap: Record<string, string> = daeManagesTurnExpiry ? {
      "turnStart": "targetStart",
      "turnEnd": "targetEnd",
      "turnStartSource": "sourceStart",
      "turnEndSource": "sourceEnd",
      "combatEnd": "combatEnd"
    } : {
      "turnStart": "turnStart",
      "turnEnd": "turnEnd",
      "turnStartSource": "turnStart",
      "turnEndSource": "turnEnd",
      "combatEnd": "combatEnd"
    };
    const specialDurs: string[] = document.flags?.dae?.specialDuration ?? [];
    const deprecatedDurs = specialDurs.filter(sd => sd in deprecatedSpecialDurMap);
    const updateData: Record<string, any> = {};

    if (deprecatedDurs.length > 0) {
      const expiry = deprecatedSpecialDurMap[deprecatedDurs[0]];
      const remaining = specialDurs.filter(sd => !(sd in deprecatedSpecialDurMap));
      ui.notifications?.warn(`DAE | Effect "${document.name}": special duration "${deprecatedDurs.join(", ")}" is deprecated. Migrating to expiry: ${expiry}.`);
      updateData["flags.dae.specialDuration"] = remaining;
      updateData["duration.expiry"] = expiry;
    }

    // Migrate deprecated flags.dae.showIcon to native showIcon field
    if (document.flags?.dae?.showIcon) {
      ui.notifications?.warn(`DAE | Effect "${document.name}": flags.dae.showIcon is deprecated. Migrating to native showIcon field.`);
      updateData["showIcon"] = 2;
      updateData["flags.dae.-=showIcon"] = null;
    }

    if (Object.keys(updateData).length > 0) {
      await document.update(updateData);
    }
  }
}

interface DAEActiveEffectConfigRenderContext extends foundry.applications.sheets.ActiveEffectConfig.RenderContext {
  specialDuration?: Record<string, string>;
  showSpecialDurations?: boolean;
  macroRepeats?: Record<string, string>
  stackableOptions?: Record<string, string>;
  showCombatActorOverride?: boolean;
  expiryModeOptions?: Record<string, string>;
  isItemEffect?: boolean;
  isActorEffect?: boolean;
  submitText?: string;
  sourceName?: string;
  midiActive?: boolean;
  isEnchantment?: boolean;
  isConditionalActivationEffect?: boolean;
  transfer?: boolean;
}

export function geti18nTranslations() {
  let translations = game.i18n?.translations["dae"];
  // if (!translations) translations = game.i18n._fallback["dae"];
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
  //@ts-expect-error no dnd5e-types
  return effect.type === "enchantment";
}

interface DAEChange extends ActiveEffect.ChangeData {
  type?: string; // v14: string change type (replaces numeric mode)
  types?: Record<string, string>;
  options?: Record<string, string>;
  fieldName?: string;
  fieldDescription?: string;
  hasEditor?: boolean;
  editorIcon?: string;
  editorTooltip?: string;
}
