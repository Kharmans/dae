import { ceInterface, atlActive, daeSystemClass, getStatusEffectsArray, localizationMap, effectivePhase } from "../dae.js";
import { i18n, daeSpecialDurations, daeMacroRepeats, error } from "../../dae.js";
import { DAEChangeData, ValidSpec } from "../Systems/DAESystem.js";

/*
 * The schema default for a change's phase. Stored rather than a resolved phase, because a change
 * carrying the default is the one `effectivePhase` resolves from the key's ValidSpec — which is how
 * a change stays correct when the phase for its key is revised.
 */
const DEFAULT_PHASE = "initial";
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

// Change keys whose values are always macro source / multi-line code. These render as a
// textarea regardless of the current value, so a freshly-imported multi-line macro is
// preserved even before it has a chance to be displayed.
const MULTILINE_CHANGE_KEYS: ReadonlySet<string> = new Set([
  "flags.dae.macro.command",
  "flags.itemacro.macro.command",
  "flags.itemacro.macro.data.command",
]);

function isMultilineChangeValue(key: string, value: unknown): boolean {
  if (MULTILINE_CHANGE_KEYS.has(key)) return true;
  return typeof value === "string" && value.includes("\n");
}

const stackableOptions = {
  noneName: "dae.StackableOptions.noneName",
  noneNameOnly: "dae.StackableOptions.noneNameOnly",
  none: "dae.StackableOptions.none",
  multi: "dae.StackableOptions.multi",
  count: "dae.StackableOptions.count",
  countDeleteDecrement: "dae.StackableOptions.countDeleteDecrement"
}

/*
 * The system's own effect sheet is the base, so every tab except the DAE tab is whatever dnd5e
 * renders — its effect-level and per-change Conditions fields, its header, its changes UI, and
 * whatever it adds next. Resolved at module scope because `super.PARTS` in the static initialiser
 * below is evaluated with the class body, so the base has to be known by then; systems load before
 * modules, so the class is already defined.
 */
const SheetBase: typeof foundry.applications.sheets.ActiveEffectConfig =
  globalThis.dnd5e.applications.activeEffect.ActiveEffectSheet5e;

export class DAEActiveEffectConfig extends SheetBase {
  declare tokenMagicEffects: Record<string, string>;
  declare statusEffectList: Record<string, string>;
  declare ATLPresets?: Record<string, string>;
  declare ATLVisionModes?: Record<string, string>;
  declare visionModeChoices?: Record<string, string>;
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
    }

    // visionMode picker — available for both ATL.sight.visionMode and the native token.sight.visionMode
    // regardless of ATL being installed. The token field is a plain StringField with no choices, so we
    // sourced the list from CONFIG.Canvas.visionModes (populated by Foundry core + system + modules).
    this.visionModeChoices = {};
    Object.values(CONFIG.Canvas.visionModes)
      .filter(f => f.tokenConfig)
      .forEach(f => this.visionModeChoices![f.id!] = i18n(f.label!));
    this.ATLVisionModes = this.visionModeChoices;
  }

  static DEFAULT_OPTIONS = {
    window: {
      resizable: true
    },
    position: {
      height: "auto" as "auto",
      // 968px minimum grid + ~34px window chrome.
      width: 1010
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
    if (spec.key === "ATL.sight.visionMode") return this.visionModeChoices;
    if (spec.key === "token.sight.visionMode") return this.visionModeChoices;
    return daeSystemClass.getOptionsForSpec(spec);
  }

  async _prepareContext(options) {
    const context: DAEActiveEffectConfigRenderContext = await super._prepareContext(options);
    const document = this.document;
    const resolved = resolveValidFields(document);
    this.validSpecsToUse = resolved.validSpecsToUse;
    this.validFields = resolved.validFields;
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

  async _preparePartContext(partId, context, options) {
    const partContext: any = await super._preparePartContext(partId, context, options);
    if (partId === "details") {
      if (partContext.isItemEffect && (isEnchantment(this.document) || this.document.parent?.name === i18n("dae.ConditionalEffectsItem")))
        partContext.isItemEffect = false;
    }
    return partContext;
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
    // Re-render when a change's type flips so the value picker re-filters (e.g. "-value" removal
    // options are only offered in custom mode).
    if (target instanceof HTMLSelectElement && /^system\.changes\.\d+\.type$/.test(target.name)) {
      this.submit()?.then(() => this.render());
    }
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

    // Add the Phase column header to the changes tab.
    // Inserted before .priority to match the row DOM order (key, type, value, phase, priority, controls).
    const changesHeader = this.element.querySelector('.tab[data-tab="changes"] header');
    if (changesHeader && !changesHeader.querySelector(".phase")) {
      const phaseHeader = document.createElement("div");
      phaseHeader.classList.add("phase");
      phaseHeader.textContent = i18n("dae.PhaseHeader");
      changesHeader.insertBefore(phaseHeader, changesHeader.querySelector(".priority"));
    }

    const keyInputs = Array.from(this.element.querySelectorAll(".dae-key-input"));
    for (const keyInput of keyInputs) {
      keyInput.addEventListener("click", this.#onKeyInputInteraction.bind(this));
      keyInput.addEventListener("input", this.#onKeyInputInteraction.bind(this));
    }
    const transferCheckBox = this.element.querySelector('input[name="transfer"]');
    transferCheckBox?.addEventListener("change", (event) => {
      this.submit()?.then(() => this.render());
    });
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

    // Read current value from the input (may have unsaved edits). Multi-line keys render
    // as a <textarea> instead of <input>.
    const valueInput = this.element.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `input[name="system.changes.${index}.value"], textarea[name="system.changes.${index}.value"]`
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

    /*
     * A change whose key was just repointed keeps no opinion about its phase: it is reset to the
     * schema default so the new key's ValidSpec decides, now and after any later revision of what
     * that key's phase should be. Storing the spec's phase instead would be right today and frozen
     * tomorrow, which is the trap `phaseStamped` fell into.
     *
     * A phase already stored against an unchanged key is left alone — including a legacy explicit
     * "final" on a key the spec calls "initial", which is still honoured at runtime.
     */
    const changes = submitData.system?.changes;
    if (changes && this.validSpecsToUse?.allSpecsObj) {
      // @ts-expect-error v14 system.changes
      const oldChanges = this.document.system?.changes ?? [];
      // Only trust per-index key comparison when the row count is unchanged; add/delete re-indexes rows.
      const sameShape = Object.keys(changes).length === oldChanges.length;
      for (const [index, change] of Object.entries(changes) as [string, any][]) {
        const spec = this.validSpecsToUse.allSpecsObj[change.key];
        if (!spec) continue;
        const oldKey = sameShape ? oldChanges[index]?.key : undefined;
        const keyChanged = oldKey !== undefined && oldKey !== change.key;
        if (!change.phase || keyChanged) change.phase = DEFAULT_PHASE;
      }
    }
    /*
     * Deliberately not stamping. `phaseStamped` means "the author chose these phases", which was
     * true while the editor offered a dropdown and is not true now that the field is read-only —
     * and it is not an idle claim: a stamped change stops consulting its ValidSpec, so a phase
     * frozen today survives a later change to what the phase for that key should be.
     *
     * Effects stamped by earlier versions keep their stored phases and go on working; they simply
     * are not joined by new ones.
     */
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
    // Migrate deprecated special durations to v14 duration.expiry. dnd5e 6.0+ understands the same
    // source/target expiry names DAE uses (< 6.0), so one map serves both versions.
    const deprecatedSpecialDurMap: Record<string, string> = {
      "turnStart": "targetStart",
      "turnEnd": "targetEnd",
      "turnStartSource": "sourceStart",
      "turnEndSource": "sourceEnd",
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
      foundry.utils.logCompatibilityWarning(
        `dae | Effect "${document.name}": flags.dae.showIcon is deprecated, auto-migrated to ActiveEffect.showIcon.`,
        { once: true, stack: false }
      );
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

/*
 * dnd5e edits a change in its own EffectChangeConfig dialog rather than inline, so DAE's field
 * browser is attached there instead of to a row. Decorating the dialog keeps dnd5e's markup
 * authoritative — nothing is forked or pinned, so anything dnd5e adds to the dialog still appears.
 */
Hooks.on("renderEffectChangeConfig", async (app: foundry.applications.api.ApplicationV2, element: HTMLElement) => {
  const effect = foundry.utils.getProperty(app, "effect") as ActiveEffect.Implementation | undefined;
  const keyInput = element.querySelector<HTMLInputElement>('input[name="key"]');
  if (!effect || !keyInput) return;

  const { validFields, validSpecsToUse } = resolveValidFields(effect);
  const browser = new DAEFieldBrowser(validFields, {
    // Re-render so the dialog picks up the key the browser wrote into the input.
    onFieldSelected: () => { app.render(); },
    updateFieldInfo: () => { }
  });
  await browser.init();
  browser.setInput(keyInput);

  keyInput.addEventListener("click", () => browser.updateBrowser());
  keyInput.addEventListener("input", () => browser.debouncedUpdateBrowser());

  const change = foundry.utils.getProperty(app, "change") as DAEChangeData | undefined;
  const spec = validSpecsToUse.allSpecsObj[keyInput.value];

  /*
   * Phase: a core change field that dnd5e's dialog does not offer. Injected rather than added to the
   * changes tab, because that tab is dnd5e's own template and forking it would freeze it.
   *
   * Labels come from the system and core rather than from DAE: dnd5e already ships a label and hint
   * for the field it does not render, and CHANGE_PHASES carries core's per-phase labels plus any a
   * module registered in CONFIG.ActiveEffect.phases. DAE's own strings remain only as the fallback
   * for a system that supplies neither.
   */
  const phaseSelect = document.createElement("select");
  phaseSelect.name = "phase";
  const phases = (CONFIG.ActiveEffect.documentClass as unknown as ActiveEffectStatic).CHANGE_PHASES ?? {};
  const phaseIds = Object.keys(phases).length
    ? Object.keys(phases)
    : (CONST as unknown as { ACTIVE_EFFECT_CHANGE_PHASES: string[] }).ACTIVE_EFFECT_CHANGE_PHASES ?? ["initial", "final"];
  for (const phase of phaseIds) {
    const opt = document.createElement("option");
    opt.value = phase;
    opt.textContent = localized(phases[phase]?.label) ?? localized(`dae.phase.${phase}`) ?? phase;
    opt.selected = (change?.phase ?? "initial") === phase;
    phaseSelect.append(opt);
  }
  const phaseField = "DND5E.EFFECT.BASE.FIELDS.changes.element.phase";
  element.querySelector("fieldset")?.append(daeFormGroup(
    localized(`${phaseField}.label`) ?? localized("dae.phase.Label") ?? "Phase",
    phaseSelect,
    localized(`${phaseField}.hint`)
  ));

  // A spec with a forced mode allows only that change type.
  const typeSelect = element.querySelector<HTMLSelectElement>('select[name="type"]');
  if (spec?.forcedMode && typeSelect) {
    const forced = String(spec.forcedMode).toLowerCase();
    for (const opt of Array.from(typeSelect.options)) opt.disabled = opt.value !== forced;
    typeSelect.value = forced;
  }

  /*
   * Where the key has a known value list, offer it instead of free text. The sheet resolves these
   * (token magic, convenient effects, statuses, ATL presets, vision modes) from its own state, and
   * the dialog is opened from that sheet, so reuse it; fall back to the system-level list.
   */
  const sheet = foundry.utils.getProperty(effect, "sheet") as DAEActiveEffectConfig | undefined;
  const options: Record<string, string> | undefined =
    (typeof sheet?.getOptionsForSpec === "function"
      ? sheet.getOptionsForSpec({ key: keyInput.value } as ActiveEffect.ChangeData)
      : undefined)
    ?? daeSystemClass.getOptionsForSpec({ key: keyInput.value } as ActiveEffect.ChangeData);
  const valueInput = element.querySelector<HTMLInputElement>('[name="value"]');
  if (options && Object.keys(options).length && valueInput) {
    const select = document.createElement("select");
    select.name = "value";
    for (const [value, label] of Object.entries(options)) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = String(label);
      opt.selected = String(change?.value ?? "") === value;
      select.append(opt);
    }
    valueInput.replaceWith(select);
  }
});

/** A form group matching the markup the system's dialog already uses. */
function daeFormGroup(label: string, field: HTMLElement, hint?: string): HTMLElement {
  const group = document.createElement("div");
  group.classList.add("form-group");
  const lbl = document.createElement("label");
  lbl.textContent = label;
  const fields = document.createElement("div");
  fields.classList.add("form-fields");
  fields.append(field);
  group.append(lbl, fields);
  if (hint) {
    const p = document.createElement("p");
    p.classList.add("hint");
    p.textContent = hint;
    group.append(p);
  }
  return group;
}

/** A localized string, or undefined when the key is absent (game.i18n returns the key unchanged). */
function localized(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const text = i18n(key);
  return (text && text !== key) ? text : undefined;
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

/**
 * Whether a change key is backed by a SetField. DAE models some of these as StringField in its own
 * spec, so the real data model has to be consulted.
 *
 * Item and activity keys must be recognised as well as actor ones. An effect on an actor is matched
 * against actorSpecs, which holds no entry for keys like system.damage.base.types, so the caller
 * falls through to here - and resolving the path against actor schemas alone finds nothing for any
 * actor type, which silently mistyped set-valued item fields. DAE's own itemSpecs table is tried
 * first since it already resolves activity keys (activities.<id>.damage...), which no schema
 * getField call will walk into.
 */
function isSetBackedKey(key: string, doc: ActiveEffect.Implementation): boolean {
  const SetField = foundry.data.fields.SetField;

  if (ValidSpec.itemSpecs?.["union"]?.allSpecsObj?.[key]?.fieldType instanceof SetField) return true;

  if (!key.startsWith("system.")) return false;
  const path = key.slice(7);
  const fieldFor = (models: Record<string, any>, type?: string) =>
    type ? models[type]?.schema?.getField?.(path) : undefined;

  const parent: any = doc?.parent;
  const isItemParent = parent instanceof CONFIG.Item.documentClass;
  const preferredActor = parent instanceof CONFIG.Actor.documentClass ? parent.type
    : isItemParent ? parent.actor?.type : undefined;

  let field = fieldFor(CONFIG.Actor.dataModels, preferredActor)
    ?? (isItemParent ? fieldFor(CONFIG.Item.dataModels, parent.type) : undefined);
  if (!field) for (const type of Object.keys(CONFIG.Actor.dataModels)) {
    field = fieldFor(CONFIG.Actor.dataModels, type); if (field) break;
  }
  if (!field) for (const type of Object.keys(CONFIG.Item.dataModels)) {
    field = fieldFor(CONFIG.Item.dataModels, type); if (field) break;
  }
  return field instanceof SetField;
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

/**
 * Resolve the valid change specs and the field list for an effect. Shared by the effect sheet and by
 * the field browser attached to dnd5e's per-change dialog, so both offer the same keys.
 */
export function resolveValidFields(document: ActiveEffect.Implementation): {
  validSpecsToUse: { allSpecs: ValidSpec[]; allSpecsObj: Record<string, ValidSpec> };
  validFields: Record<string, { name: string, description?: string }>;
} {
  let validSpecsToUse: { allSpecs: ValidSpec[]; allSpecsObj: Record<string, ValidSpec> } | undefined;
  let validFields: Record<string, { name: string, description?: string }>;
    if (document.parent instanceof CONFIG.Actor.documentClass || document instanceof CONFIG.Actor.documentClass) {
      validSpecsToUse = ValidSpec.actorSpecs[document.parent?.type ?? ""]
    }
    if (isEnchantment(document)) {
      document.transfer = false;
      // @ts-expect-error no dnd5e-types
      if (document.isAppliedEnchantment) {
        validSpecsToUse = ValidSpec.itemSpecs[document.parent?.type ?? ""] ?? ValidSpec.itemSpecs["union"];
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
          validSpecsToUse = ValidSpec.itemSpecs[restrictionType || "union"] ?? ValidSpec.itemSpecs["union"];
        }
      }
    }
    if (!validSpecsToUse) {
      ui.notifications?.error("DAE | No valid specs found");
      // Continue with an empty spec set so the sheet still renders - returning a half-built
      // context makes the details template part fail on the missing fields
      validSpecsToUse = { allSpecs: [], allSpecsObj: {} };
    }
    validFields = { "__": { name: ""} }
    validFields = validSpecsToUse.allSpecs
      .filter(e => e.fieldSpec.includes(""))
      .reduce((mods, em) => {
        mods[em.fieldSpec] = {
          name: localizationMap[em.fieldSpec]?.name ?? em.label,
          description: localizationMap[em.fieldSpec]?.description ?? em.description
        };
        return mods;
      }, validFields);
    if (!isEnchantment(document)) {
      for (let fieldName of [...otherFieldsMap.keys()].sort((a, b) => a.toLocaleLowerCase() < b.toLocaleLowerCase() ? -1 : 1)) {
        validFields[fieldName] = {
          name: localizationMap[fieldName]?.name ?? fieldName,
          description: localizationMap[fieldName]?.description || (localizationMap[fieldName]?.name ?? fieldName)

        };
      }
    }
  return { validSpecsToUse, validFields };
}
