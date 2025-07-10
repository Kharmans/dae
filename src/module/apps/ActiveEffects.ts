import { effectIsTransfer, simpleCalendarInstalled } from "../dae.js"
import { warn, debug, i18n, confirmAction, daeSpecialDurations } from "../../dae.js";
import { ValidSpec } from "../Systems/DAESystem.js";
import { AnyObject } from "fvtt-types/utils";
const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

declare module "fvtt-types/configuration" {
  namespace Hooks {
    interface ApplicationV2Config {
      ActiveEffects: ActiveEffects;
    }
  }
}

export class ActiveEffects extends HandlebarsApplicationMixin(DocumentSheetV2)<
  Actor.Implementation | Item.Implementation,
  //@ts-expect-error render context wants to know exactly which document is being used
  foundry.applications.api.DocumentSheetV2.RenderContext
> {
  static filters = new Set();
  effectHookIdd: number | null = null;
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

  get id() {
    const actor: any = this.document;
    let id = `ActiveEffects-${actor.id}`;
    if (actor.isToken) id += `-${actor.token.id}`;
    return id;
  }

  get title() {
    return i18n("dae.ActiveEffectName") + ` ${this.document.name}`;
  }

  get filters() { return ActiveEffects.filters }

  async _prepareContext(options) {
    const EFFECTMODES = CONST.ACTIVE_EFFECT_MODES;
    const modeKeys = Object.keys(EFFECTMODES);
  
    function* effectsGenerator(this: Actor.Implementation | Item.Implementation) { for (const effect of this.effects) yield effect };
    let effects = effectsGenerator.bind(this.document);
    if (this.document instanceof CONFIG.Actor.documentClass && CONFIG.ActiveEffect.legacyTransferral === false) {
      effects = this.document.allApplicableEffects.bind(this.document);
    }
    let actives: any[] = [];
    for (let ae of effects()) {
      //    let newAe = globalThis.foundry.utils.foundry.utils.deepClone(ae);
      const newAe = ae.toObject() as ActivesEntry;
      newAe.uuid = ae.uuid;
      newAe.isSuppressed = ae.isSuppressed;
      newAe.duration = foundry.utils.duplicate(ae.duration) as ActiveEffect.Duration;
      const aeDuration = ae.updateDuration(); // TODO remove this if v10 change made
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
      let id = e.origin?.match(/Actor.*Item\.(.*)/);
      if (id?.length === 2 && this.document instanceof Actor) {
        const item = this.document.items?.get(id[1]);
        foundry.utils.setProperty(e, "flags.dae.itemName", item?.name || "???");
      }
      else {
        foundry.utils.setProperty(e, "flags.dae.itemName", "????");
      }
      e.transfer = effectIsTransfer(e) ?? true;
    });
  
    let efl = CONFIG.statusEffects
      .map(se => {
        if (se.id.startsWith("Convenient Effect:")) return { id: se.id, name: `${se.name} (CE)` };
        return { id: se.id, name: i18n(se.name) };
      })
      .sort((a, b) => a.name < b.name ? -1 : 1);
    this.effectList = { "new": "new" }
    efl.forEach(se => {
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

  async _processSubmitData(event, form, submitData) {
    const document = this.document;
    submitData = foundry.utils.expandObject(submitData);
    submitData.changes ??= [];
    submitData.changes = Object.values(submitData.changes);
    for (let c of submitData.changes) {
      if (Number.isNumeric(c.value)) c.value = parseFloat(c.value);
    }
    await document.update(submitData);
  }

  static #onToggleFilter(this: ActiveEffects, _event: PointerEvent, target: HTMLElement) {
    const set = this.filters;
    const filter = target.dataset.filter;
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
    // @ts-expect-error types doesn't know this is definitely AppV2
    await effect?.sheet?.render({ force: true });
  }

  static async #onAddEffect(this: ActiveEffects) {
    const id = this.element.querySelector<HTMLSelectElement>('select[name="newEffect"]')?.value;
    if (id === "new") {
      const AEData = {
        name: this.document.name,
        changes: [],
        tranfer: false,
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

  // TODO: nuke these last two, if possible
  async _onRender(context, options) {
    super._onRender(context, options);

    function efHandler(this: ActiveEffects, effect: ActiveEffect.Implementation) {
      if (this.document.id === effect.parent?.id || effect.parent?.parent?.id === this.document.id) {
        this.render();
      }
    };
  
    if (!this.effectHookIdd)
      this.effectHookIdd = Hooks.on("deleteActiveEffect", efHandler.bind(this));
  }
  
  async _preClose(options) {
    await super._preClose(options);
    if (this.effectHookIdd) Hooks.off("deleteActiveEffect", this.effectHookIdd);
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