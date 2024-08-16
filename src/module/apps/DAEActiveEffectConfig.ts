import { cltActive, ceInterface, atlActive, daeSystemClass } from "../dae";
import { i18n, confirmAction, daeSpecialDurations, daeMacroRepeats, log } from "../../dae";
import { ValidSpec } from "../Systems/DAESystem";
import { DAEFieldBrowser } from "./FieldBrowser";

export var otherFields: any[] = [];

export function addAutoFields(fields: string[]) {
  fields.forEach(f => {
    if (!otherFields.includes(f)) otherFields.push(f)
  })
  otherFields.sort();
}

export class DAEActiveEffectConfig extends ActiveEffectConfig {
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
  bypassesList;
  daeFieldBrowser: DAEFieldBrowser;

  // object: any; Patch 4535992 Why ???
  constructor(object: any = {}, options = {}) {
    super(object, options);
    this.tokenMagicEffects = {};
    if (game.modules.get("tokenmagic")?.active) {
      globalThis.TokenMagic.getPresets().forEach(preset => {
        this.tokenMagicEffects[preset.name] = preset.name;
      })
    } else this.tokenMagicEffects["invalid"] = "module not installed"

    //@ts-expect-error
    this.validSpecsToUse = ValidSpec.actorSpecs?.union;
    if (!this.validSpecsToUse) {
      ui.notifications.error("DAE | No valid specs found");
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
        if (se.id.startsWith("Convenient Effect:")) return { id: se.id, name: `${se.name ?? se.label} (CE)` };
        if (foundry.utils.getProperty(se, "flags.condition-lab-triggler")) return { id: se.id, name: `${se.name ?? se.label} (CLT)` };
        return { id: se.id, name: i18n(se.name ?? se.label) };
      });
    if (ceInterface?.findEffects) {
      const ceList = ceInterface.findEffects().map(ce => ({ id: `z${ce.flags["dfreds-convenient-effects"].ceEffectId}`, name: `${ce.name} (CE)` }));
      efl = efl.concat(ceList);
    }
    //@ts-expect-error
    if (foundry.utils.isNewerVersion(game.modules.get("dfreds-convenient-effects")?.version, "7.0"))
      efl = efl.sort((a, b) => a.id < b.id ? -1 : 1);
    else
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

    if (atlActive && object.flags?.dnd5e?.type !== "enchantment") {
      this.ATLPresets = {};
      //@ts-expect-error
      game.settings.get("ATL", "presets")?.forEach(preset => this.ATLPresets[preset.name] = preset.name);

      //@ts-expect-error
      Object.keys(CONFIG.Canvas.detectionModes).forEach(dm => {
        otherFields.push(`ATL.detectionModes.${dm}.range`);
      });

      this.ATLVisionModes = {};
      //@ts-expect-error visionModes
      Object.values(CONFIG.Canvas.visionModes)
        //@ts-expect-error TokenConfig, the core sheet for a token does this filtering, I think we should too
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
    if (this.object.flags.dnd5e?.type !== "enchantment") {
      for (let field of otherFields) {
        this.validFields[field] = field;
      }
    }
    this.daeFieldBrowser = new DAEFieldBrowser(this.validFields, this);
    this.daeFieldBrowser.init();
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sheet", "active-effect-sheet window-app"],
      title: "EFFECT.ConfigTitle",
      template: `./modules/dae/templates/DAEActiveSheetConfig.html`,
      width: 900,
      height: "auto",
      resizable: true,
      tabs: [{ navSelector: ".tabs", contentSelector: "form", initial: "details" }],
      dragDrop: [{ dropSelector: ".value" }, { dropSelector: ".key" }],
      scrollY: [".dae-scrollable-list .scrollable"],
      //@ts-expect-error DOCUMENT_OWNERSHIP_LEVELS
      viewPermission: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    });
  }

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
    if ([`system.traits.di.bypasses`, `system.traits.dr.bypasses`, `system.traits.dv.bypasses`].includes(spec.key))
      return this.bypassesList;
    return daeSystemClass.getOptionsForSpec(spec);
  }

  /** @override */
  async getData(options?): Promise<any> {
    if (this.object.parent instanceof CONFIG.Actor.documentClass || this.object instanceof CONFIG.Actor.documentClass) {
      this.validSpecsToUse = ValidSpec.actorSpecs[this.object.parent.type]
    }
    if (this.object.flags?.dnd5e?.type === "enchantment") {
      this.object.transfer = false;
      if (this.object.isAppliedEnchantment) {
        this.validSpecsToUse = ValidSpec.itemSpecs[this.object.parent.type] ?? ValidSpec.itemSpecs["union"];
      } else {
        let restrictionType = "union";
        if (this.object.parent instanceof CONFIG.Item.documentClass) {
          if ((foundry.utils.getProperty(this.object.parent, "system.enchantment.restrictions.type") ?? "") !== "") {
            restrictionType = foundry.utils.getProperty(this.object.parent, "system.enchantment.restrictions.type")
          }
          this.validSpecsToUse = ValidSpec.itemSpecs[restrictionType];
        }
      }
    }
    if (!this.validSpecsToUse) {
      ui.notifications.error("DAE | No valid specs found");
      return;
    }
    this.validFields = { "__": "" }
    this.validFields = this.validSpecsToUse.allSpecs
      .filter(e => e._fieldSpec.includes(""))
      .reduce((mods, em) => {
        mods[em._fieldSpec] = em._label;
        return mods;
      }, this.validFields);
    if (this.object.flags.dnd5e?.type !== "enchantment") {
      for (let field of otherFields) {
        this.validFields[field] = field;
      }
    }
    this.daeFieldBrowser = new DAEFieldBrowser(this.validFields, this);
    this.daeFieldBrowser.init();
    if (foundry.utils.getProperty(this.object, "flags.dae.specialDuration") === undefined)
      foundry.utils.setProperty(this.object, "flags.dae.specialDuration", []);
    if (foundry.utils.getProperty(this.object, "flags.dae.stackable") === undefined)
      foundry.utils.setProperty(this.object, "flags.dae.stackable", "noneName");
    const data: any = await super.getData(options);
    //@ts-expect-error
    data.preV12 = game.release.generation <= 11;
    if (data.preV12) {
      data.statuses = data.effect._source.statuses;
      // Status Conditions
      data.statuses = CONFIG.statusEffects.map(s => {
        return {
          id: s.id,
          //@ts-expect-error
          label: game.i18n.localize(s.name ?? /** @deprecated since v12 */ s.label),
          selected: data.statuses.includes(s.id) ? "selected" : ""
        };
      });
    }

    await daeSystemClass.editConfig();

    const allModes = Object.entries(CONST.ACTIVE_EFFECT_MODES)
      .reduce((obj, e) => {
        obj[e[1]] = game.i18n.localize("EFFECT.MODE_" + e[0]);
        return obj;
      }, {});
    data.modes = allModes;
    data.specialDuration = daeSpecialDurations;
    data.macroRepeats = daeMacroRepeats;
    const translations = geti18nTranslations();
    //@ts-expect-error
    data.stackableOptions = translations.stackableOptions ?? { "noneName": "Effects do not stack by name and origin", "noneNameOnly": "Effects do not stack by name", "none": "Effects do not stack", "multi": "Stacking effects apply the effect multiple times", "count": "each stack increase stack count by 1" };

    if (this.object.parent) {
      data.isItemEffect = this.object.parent instanceof CONFIG.Item.documentClass;
      data.isActorEffrect = this.object.parent instanceof CONFIG.Actor.documentClass;
    }
    data.validFields = this.validFields;
    data.submitText = "EFFECT.Submit";

    data.effect.changes.forEach(change => {
      if ([-1, undefined].includes(this.validSpecsToUse.allSpecsObj[change.key]?.forcedMode)) {
        change.modes = allModes;
      } else if (this.validSpecsToUse.allSpecsObj[change.key]) {
        const mode = {};
        mode[this.validSpecsToUse.allSpecsObj[change.key]?.forcedMode] = allModes[this.validSpecsToUse.allSpecsObj[change.key]?.forcedMode];
        change.modes = mode;
      } else if (!this.validSpecsToUse.allSpecsObjchange.key.startsWith("flags.midi-qol")) {
        change.modes = allModes; //change.mode ? allModes: [allModes[CONST.ACTIVE_EFFECT_MODES.CUSTOM]];
      }

      if (this.validSpecsToUse.allSpecsObj[change.key]?.options)
        change.options = this.validSpecsToUse.allSpecsObj[change.key]?.options;
      else
        change.options = this.getOptionsForSpec(change);
      if (!change.priority) change.priority = change.mode * 10;

      const fieldInfo = this.daeFieldBrowser.getFieldInfo(change.key);
      change.fieldName = fieldInfo.name;
      change.fieldDescription = fieldInfo.description;
      if (fieldInfo.name === change.key && !change.key.startsWith("flags")) {
        // Could not find the key so set the name to <INVALID>
        change.fieldName = "<INVALID>";
      }

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
    foundry.utils.setProperty(data.effect, "flags.dae.durationExpression", this.object.flags?.dae?.durationExpression);
    if (!data.effect.flags?.dae?.specialDuration || !(data.effect.flags.dae.specialDuration instanceof Array))
      foundry.utils.setProperty(data.effect.flags, "dae.specialDuration", []);
    data.sourceName = await this.object.sourceName;
    data.midiActive = globalThis.MidiQOL !== undefined;
    //@ts-expect-error
    data.useIcon = game.release.generation < 12;
    data.isEnchantment = this.object.getFlag(game.system.id, "type") === "enchantment";
    data.isConditionalActivationEffect = this.object.parent.name === i18n("dae.ConditionalEffectsItem");
    if (data.isConditionalActivationEffect) {
      data.transfer = false;
      data.effect.transfer = false;
    }
    return data;
  }

  updateFieldInfo() {
    if (!this.element) return;

    const changes = this.object.changes;
    changes.forEach((change, index) => {
      const fieldInfo = this.daeFieldBrowser.getFieldInfo(change.key);
      const row = this.element.find(`.effect-change[data-index="${index}"]`);
      if (row.length) {
        row.find('.dae-field-name').text(fieldInfo.name);
        row.find('.dae-field-description').text(fieldInfo.description);
      }
    });
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".effectTransfer").on("click", event => {
      this.object.transfer = !this.object.transfer;
      this.render(true);
    });

    const keyInputs = html.find(".keyinput");
    keyInputs.off("click input");
    keyInputs.on("click input", this._onKeyInputInteraction.bind(this));
  }

  private _onKeyInputInteraction(event: JQuery.TriggeredEvent): void {
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
    //@ts-expect-error getDragEventData
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

  /* ----------------------------------------- */
  _onEffectControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch (button.dataset.action) {
      case "add":
        return this._addEffectChange();
      case "delete":
        button.closest(".effect-change").remove();
        //@ts-expect-error
        return this.submit({ preventClose: true }).then(() => this.render());
      case "add-specDur":
        this._addSpecDuration();
        //@ts-expect-error
        return this.submit({ preventClose: true }).then(() => this.render());
      case "delete-specDur":
        button.closest(".effect-special-duration").remove();
        //@ts-expect-error
        return this.submit({ preventClose: true }).then(() => this.render());
    }
  }

  _addSpecDuration() {
    const idx = this.object.flags?.dae.specialDuration?.length ?? 0;
    if (idx === 0) foundry.utils.setProperty(this.object, "flags.dae.specialDuration", []);
    return this.submit({
      preventClose: true, updateData: {
        [`flags.dae.specialDuration.${idx}`]: ""
      }
    });
  }

  /* ----------------------------------------- */

  async _addEffectChange(): Promise<this> {
    //@ts-expect-error .document
    const idx = (this.document ?? this.object).changes.length;
    return (this.submit({
      preventClose: true, updateData: {
        [`changes.${idx}`]: { key: "", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "" }
      }
    })) ?? this;
  }

  _getSubmitData(updateData: any = {}) {
    const data: any = super._getSubmitData(updateData);
    for (let change of data.changes) {
      if (typeof change.priority === "string") change.priority = Number(change.priority);
      if (change.priority === undefined || isNaN(change.priority)) change.priority = change.mode ? change.mode * 10 : 0;
    }
    if (!data.tint || data.tint === "") data.tint = null;
    // fixed for very old items
    if (this.object.origin?.includes("OwnedItem.")) data.origin = this.object.origin.replace("OwnedItem.", "Item.");
    if (data.flags?.dae?.enableCondition?.length > 0) data.transfer = false;
    if (data.transfer && this.object.getFlag(game.system.id, "type") !== "enchantment") data.origin = this.object.parent?.uuid;
    else delete data.origin;
    data.statuses ??= [];

    foundry.utils.setProperty(data, "flags.dae.specialDuration", Array.from(Object.values(data.flags?.dae?.specialDuration ?? {})))
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
          formData.duration.startTime = game.time.worldTime + parseInt(formData.duration.startTime);
        }
      } else if (this.object.parent.isOwned) formData.duration.startTime = null;
    }
    if (foundry.utils.getProperty(formData, `flags.${game.system.id}.type`) === "enchantment") formData.transfer = false;
    await this.object.update(formData);
  }

  /** @override */
  async close(options = {}): Promise<void> {
    // Though it seems right to do it this way, if there's any issue with overriding close, the closeDAEActiveEffectConfig hook can be used.
    if (this.daeFieldBrowser && this.daeFieldBrowser.browserElement) {
      this.daeFieldBrowser.browserElement.remove();
      this.daeFieldBrowser.browserElement = null;
    }

    return super.close(options);
  }
}

export function geti18nTranslations() {
  let translations = game.i18n.translations["dae"];
  //@ts-expect-error _fallback not accessible
  if (!translations) translations = game.i18n._fallback["dae"];
  return translations ?? {};
}

Hooks.once("setup", () => {
  DocumentSheetConfig.registerSheet(
    CONFIG.ActiveEffect.documentClass,
    "core",
    DAEActiveEffectConfig,
    {
      label: i18n("dae.EffectSheetLabel"),
      makeDefault: true,
      //@ts-expect-error canBeDefault missing
      canBeDefault: true,
      canConfigure: true
    });
})