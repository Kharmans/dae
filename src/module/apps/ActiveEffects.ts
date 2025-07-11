import { effectIsTransfer, simpleCalendarInstalled } from "../dae.js"
import { i18n, daeSpecialDurations } from "../../dae.js";
import { ValidSpec } from "../Systems/DAESystem.js";
const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActiveEffects extends HandlebarsApplicationMixin(DocumentSheetV2)<
  Actor.Implementation | Item.Implementation,
  foundry.applications.api.DocumentSheetV2.RenderContext<any>
> {
  static filters: Set<FilterEntry> = new Set();
  effectHookId: number | null = null;
  declare effectList: Record<string, string>;
  
  static override DEFAULT_OPTIONS = {
    classes: ["dae-active-effects"],
    window: {
      title: "dae.ActiveEffectName",
      resizable: true,
    },
    position: {
      height: 500,
      width: 650
    },
    actions: {
      toggleFilter: ActiveEffects.#onToggleFilter,
      deleteEffect: ActiveEffects.#onDeleteEffect,
      editEffect: ActiveEffects.#onEditEffect,
      addEffect: ActiveEffects.#onAddEffect
    }
  };

  static override PARTS = {
    body: {template: "modules/dae/templates/ActiveEffects.hbs"}
  };

  override _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    const suffix = options.document.uuid ?? foundry.utils.randomID();
    options.uniqueId = `${this.constructor.name}-${suffix.replaceAll(".", "-")}`;
    return options;
  }

  get title() {
    return `${i18n("dae.ActiveEffectName")} ${this.document.name}`;
  }

  get filters() { return ActiveEffects.filters }

  async _prepareContext(options) {
    const modeKeys = Object.keys(CONST.ACTIVE_EFFECT_MODES);
  
    function* effectsGenerator(this: Actor.Implementation | Item.Implementation) { for (const effect of this.effects) yield effect };
    let effects = effectsGenerator.bind(this.document);
    if (this.document instanceof CONFIG.Actor.documentClass && CONFIG.ActiveEffect.legacyTransferral === false) {
      effects = this.document.allApplicableEffects.bind(this.document);
    }
    let actives: ActivesEntry[] = [];
    for (const ae of effects()) {
      const newAe = ae.toObject() as ActivesEntry;
      newAe.uuid = ae.uuid;
      newAe.isSuppressed = ae.isSuppressed;
      newAe.duration = foundry.utils.duplicate(ae.duration) as ActiveEffect.Duration;
      const aeDuration = ae.updateDuration();
      if (simpleCalendarInstalled && aeDuration.type === "seconds") {
        const simpleCalendar = globalThis.SimpleCalendar?.api;
        newAe.duration.label = simpleCalendar.formatTimestamp(aeDuration.remaining).time
      } else if (aeDuration.label) {
        newAe.duration.label = aeDuration.label.replace("Seconds", "s").replace("Rounds", "R").replace("Turns", "T");
      }
      let specialDuration = ae.flags?.dae?.specialDuration || [daeSpecialDurations["None"]];
      if (typeof specialDuration === "string") specialDuration = [specialDuration]
      newAe.duration.label += ", " + `[${specialDuration.map(dur => (daeSpecialDurations[dur], dur))}]`;
      newAe.isTemporary = ae.isTemporary;
      newAe.sourceName = `(${ae.sourceName ?? "Unknown"})`;
      if (this.filters.has("summary")) {
        newAe.changes = [];
        actives.push(newAe);
        continue;
      }
      newAe.changes.map(change => {
        if (this.document instanceof CONFIG.Item.documentClass)
          change.label = ValidSpec.actorSpecs["union"].allSpecsObj[change.key]?.label || change.key;
        else
          change.label = ValidSpec.actorSpecs[this.document.type].allSpecsObj[change.key]?.label || change.key;
        if (typeof change.value === "string" && change.value.length > 40) {
          change.value = change.value.substring(0, 30) + " ... ";
        } else if (Array.isArray(change.value)) {
          if (typeof change.value[0] === "string" && change.value[0].length > 20)
            change.value[0] = "<Macro>";
          change.value = change.value.join("|")
        }
        return change;
      });
      actives.push(newAe);
    };
  
    if (this.filters.has("temporary")) actives = actives.filter(e => e.isTemporary);
    if (this.filters.has("enabled")) actives = actives.filter(e => !e.disabled && !e.isSuppressed);
    actives.sort((a, b) => a.name < b.name ? -1 : 1);
    actives.forEach(e => {
      const id = e.origin?.match(/Actor.*Item\.(.*)/);
      if (id?.length === 2 && this.document instanceof Actor) {
        const item = this.document.items?.get(id[1]);
        foundry.utils.setProperty(e, "flags.dae.itemName", item?.name || "???");
      }
      else {
        foundry.utils.setProperty(e, "flags.dae.itemName", "????");
      }
      e.transfer = effectIsTransfer(e as ActiveEffect.Source) ?? true;
    });
  
    this.effectList = { "new": "new" };
    CONFIG.statusEffects
      .map(se => ({ id: se.id, name: i18n(se.name) }))
      .toSorted((a, b) => a.name < b.name ? -1 : 1)
      .forEach(se => {
        this.effectList[se.id] = se.name;
      });
  
    const isItem = this.document instanceof CONFIG.Item.documentClass;
    const context = foundry.utils.mergeObject(await super._prepareContext(options), {
      actives: actives,
      isGM: game.user?.isGM,
      isItem,
      isOwned: this.document instanceof Item && this.document.isOwned,
      flags: this.document.flags,
      modes: modeKeys,
      validSpecs: isItem ? ValidSpec.actorSpecs["union"].allSpecsObj : ValidSpec.actorSpecs[this.document.type],
      // canEdit: game.user.isGM || (playersCanSeeEffects === "edit" && game.user.isTrusted),
      canEdit: true,
      // showEffects: playersCanSeeEffects !== "none" || game.user.isGM,
      showEffects: true,
      effectList: this.effectList,
      effect: "new",
      summaryActive: this.filters.has("summary"),
      enabledActive: this.filters.has("enabled"),
      temporaryActive: this.filters.has("temporary")
    });
    return context;
  }

  async _processSubmitData(_event: SubmitEvent, _form: HTMLFormElement, submitDataOrig: foundry.applications.ux.FormDataExtended) {
    const document = this.document;
    const submitData = foundry.utils.expandObject(submitDataOrig) as Record<string, any>;
    submitData.changes ??= [];
    submitData.changes = Object.values(submitData.changes);
    for (const c of submitData.changes) {
      if (Number.isNumeric(c.value)) c.value = parseFloat(c.value);
    }
    await document.update(submitData);
  }

  static #onToggleFilter(this: ActiveEffects, _event: PointerEvent, target: HTMLElement) {
    const set = this.filters;
    const filter = target.dataset.filter as FilterEntry;
    if (set.has(filter)) set.delete(filter);
    else set.add(filter);
    this.render();
  }

  static #onDeleteEffect(this: ActiveEffects, _event: PointerEvent, target: HTMLElement) {
    const effectId = target.closest<HTMLElement>("[data-effect-id]")?.dataset.effectId;
    // Note: This means transfer effects can't be deleted via the Actor's ActiveEffects app
    const effect = this.document.effects.get(effectId ?? "");
    if (effect) {
      // @ts-expect-error types confused about item vs actor
      this.document.deleteEmbeddedDocuments("ActiveEffect", [effectId], { "expiry-reason": "manual-deletion" });
    }
  }

  static async #onEditEffect(this: ActiveEffects, _event: PointerEvent, target: HTMLElement) {
    if (this.document.parent instanceof Item) return; // TODO think about editing effects on items in bags
    const effectUuid = target.closest<HTMLElement>("[data-effect-uuid]")?.dataset.effectUuid;
    if (!effectUuid) return;
    const effect: ActiveEffect | null = await fromUuid(effectUuid);
    await (effect?.sheet as foundry.applications.api.ApplicationV2)?.render({ force: true });
  }

  static async #onAddEffect(this: ActiveEffects) {
    const id = this.element.querySelector<HTMLSelectElement>('select[name="newEffect"]')?.value;
    if (id === "new") {
      const AEData = {
        name: this.document.name,
        changes: [],
        transfer: false,
        img: this.document.img || "icons/svg/mystery-man.svg"
      };
      // @ts-expect-error types confused about item vs actor
      await this.document.createEmbeddedDocuments("ActiveEffect", [AEData]);
    } else {
      const statusEffect = CONFIG.statusEffects.find(se => se.id === id);
      if (statusEffect && id) {
        if (!statusEffect._id) statusEffect._id = foundry.utils.randomID();
        const effect = await ActiveEffect.implementation.fromStatusEffect(id, { parent: this.document });
        effect.updateSource({ _id: statusEffect._id, origin: this.document.uuid });
        await ActiveEffect.implementation.create(effect.toObject(), { parent: this.document, keepId: true });
      }
    }
  }

  // TODO (Michael): nuke these last two, if possible
  async _onRender(context, options) {
    super._onRender(context, options);

    if (!this.effectHookId) this.effectHookId = Hooks.on("deleteActiveEffect", (effect: ActiveEffect.Implementation) => {
      if (this.document.id === effect.parent?.id || effect.parent?.parent?.id === this.document.id) {
        this.render();
      }
    });
  }
  
  async _preClose(options) {
    await super._preClose(options);
    if (this.effectHookId) Hooks.off("deleteActiveEffect", this.effectHookId);
  }
}

interface ActivesEntry extends Omit<foundry.data.fields.SchemaField.SourceData<ActiveEffect.Schema>, "duration" | "changes"> {
  uuid: string;
  isSuppressed: boolean;
  duration: ActiveEffect.Duration;
  isTemporary: boolean;
  sourceName: string;
  changes: (ActiveEffect.ChangeData & {
    label: string;
  })[]
}

type FilterEntry = "summary" | "temporary" | "enabled";
