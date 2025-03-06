import { effectIsTransfer, simpleCalendarInstalled } from "../dae.js"
import { warn, debug, i18n, confirmAction, daeSpecialDurations } from "../../dae.js";
import { ValidSpec } from "../Systems/DAESystem.js";
import { AnyObject } from "fvtt-types/utils";
const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActiveEffects<
  Document extends Actor.Implementation | Item.Implementation,
  RenderContext extends AnyObject
> extends HandlebarsApplicationMixin(DocumentSheetV2)<
  Document,
  RenderContext
> {
  static filters = new Set();
  hookId: number | null = null;
  itemHookId: number | null = null;
  effectHookIdu: number | null = null;
  effectHookIdc: number | null = null;
  effectHookIdd: number | null = null;
  effectHookIdt: number | null = null;
  effectHookIda: number | null = null;
  timeHookId: number | null = null;
  combatHookId: number | null = null;
  effect;
  effectList;
  
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["dae-active-effects"],
    window: {
      title: "dae.ActiveEffectName",
      resizable: true,
    },
    position: {
      height: 500,
      width: 650
    }
  }, { inplace: false });

  static PARTS = {
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
  
    function* effectsGenerator(this: any) { for (const effect of this.effects) yield effect };
    let effects = effectsGenerator.bind(this.document);
    if (this.document instanceof CONFIG.Actor.documentClass && CONFIG.ActiveEffect.legacyTransferral === false) {
      effects = this.document.allApplicableEffects.bind(this.document);
    }
    let actives: any[] = [];
    for (let ae of effects()) {
      //    let newAe = globalThis.foundry.utils.foundry.utils.deepClone(ae);
      let newAe = ae.toObject();
      newAe.uuid = ae.uuid;
      newAe.isSuppressed = ae.isSuppressed;
      newAe.duration = foundry.utils.duplicate(ae.duration);
      ae.updateDuration(); // TODO remove this if v10 change made
      if (simpleCalendarInstalled && ae.duration?.type === "seconds") {
        const simpleCalendar = globalThis.SimpleCalendar?.api;
        newAe.duration.label = simpleCalendar.formatTimestamp(ae.duration.remaining).time
      } else if (ae.duration.label) {
        newAe.duration.label = ae.duration.label.replace("Seconds", "s").replace("Rounds", "R").replace("Turns", "T");
      }
      let specialDuration = foundry.utils.getProperty(ae.flags, "dae.specialDuration") || [daeSpecialDurations["None"]];
      if (typeof specialDuration === "string") specialDuration = [ae.flags.dae.specialDuration]
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
        if (se.id.startsWith("condition-lab-triggler.")) return { id: se.id, name: `${se.name} (CLT)` };
        //@ts-expect-error .name
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
      effect: "new"
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

  _initializeFilterItemList(ul) {
    const set = this.filters;
    const filters = ul.querySelectorAll(".filter-item");
    for (let li of filters) {
      if (set.has(li.dataset.filter)) li.classList.add("active");
    }
  }
  _onToggleFilter(event) {
    event.preventDefault();
    const li = event.target;
    const set = this.filters;
    const filter = li.dataset.filter;
    if (set.has(filter)) set.delete(filter);
    else set.add(filter);
    this.render();
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const filterList of Array.from(this.element.querySelectorAll(".filter-list"))) {
      this._initializeFilterItemList.call(this, filterList);
      filterList.addEventListener("click", (event) => {
        // @ts-expect-error EventTarget oddness
        if (event.target?.closest(".filter-item")) this._onToggleFilter.call(this, event);
      });
    }

    // This doesn't seem to reference anything
    // html.find('.refresh').click(async ev => {
    //   return this.submit({ preventClose: true }).then(() => this.render());
    // });

    // Delete Effect
    for (const deleteButton of Array.from(this.element.querySelectorAll(".effect-delete"))) {
      deleteButton.addEventListener("click", (event) => {
        const object = this.document as Actor.Implementation | Item.Implementation;
        // @ts-expect-error EventTarget oddness
        const effectId = event.currentTarget?.closest(".effect-header")?.getAttribute("effect-id");
        let effect = object.effects.get(effectId ?? "");
        if (effect) { // this will mean deleting item transfer effects won't work unless the item is being edited
          // Shouldn't be necessary
          if (object instanceof CONFIG.Actor.documentClass || object instanceof CONFIG.Item.documentClass) {
            object.deleteEmbeddedDocuments("ActiveEffect", [effectId], { "expiry-reason": "manual-deletion" });
          }
        }
      });
    }

    for (const editButton of Array.from(this.element.querySelectorAll(".effect-edit"))) {
      editButton.addEventListener("click", async (event) => {
        const object = this.document as Actor.Implementation | Item.Implementation;
        if (object.parent instanceof Item) return; // TODO Think about editing effects on items in bags
        // @ts-expect-error EventTarget oddness
        const effectUuid = event.currentTarget?.closest(".effect-header")?.getAttribute("effect-uuid");
        if (!effectUuid) return;
        let effect: any = await fromUuid(effectUuid);

        // const ownedItemEffect = new EditOwnedItemEffectsActiveEffect(effect.toObject(), effect.parent);
        //const ownedItemEffect = new CONFIG.ActiveEffect.documentClass(effect.toObject(), effect.parent);

        return effect?.sheet.render(true);
      });
    }

    this.element.querySelector(".effect-add")?.addEventListener("click", async (event) => {
      const object = this.document as Actor.Implementation | Item.Implementation;
      // @ts-expect-error EventTarget oddness
      const effectName = event.currentTarget?.closest(".effect-header")?.querySelector(".newEffect option:checked")?.textContent;
      let AEData;
      const id = Object.entries(this.effectList).find(([_, value]) => value === effectName)?.[0];
      if (effectName === "new") {
        // if (false && object.system.enchantment) { // I think just creating a simple effect, rather than an enchantment is right
        //   return await ActiveEffect.implementation.create({
        //     name: object.name,
        //     icon: object.img,
        //     // @ts-expect-error no dnd5e-types
        //     type: "enchantment",
        //   }, {parent: object});
        // };
        AEData = {
          name: object.name,
          changes: [],
          transfer: false,
          img: object.img || "icons/svg/mystery-man.svg"
        };
        await object.createEmbeddedDocuments("ActiveEffect", [AEData]);
      } else {
        const statusEffect = CONFIG.statusEffects.find(se => se.id === id);
        if (statusEffect && id) {
          // if (object instanceof CONFIG.Item.documentClass && false) {
          //   AEDATA = {
          //     //@ts-expect-error
          //     name: statusEffect.name,
          //     origin: object.uuid,
          //     changes: [{ key: "StatusEffect", mode: 0, value: id }],
          //     transfer: true,
          //     flags: { "dae.itemName": object.name }
          //   }
          //   //@ts-expect-error
          //   if (game.release.generation < 12) AEDATA.icon = statusEffect.icon;
          //   //@ts-expect-error
          //   else AEDATA.img = statusEffect.img;
          //   object.createEmbeddedDocuments("ActiveEffect", [AEDATA]);
          // } else {
          // fiddle for CE effects - probably irrelevant now?
          if (!statusEffect._id) statusEffect._id = foundry.utils.randomID();
          // @ts-expect-error is keepId gone now?
          let effect = await ActiveEffect.implementation.fromStatusEffect(id, { parent: object, keepId: true });
          effect.updateSource({ _id: statusEffect._id, origin: object.uuid });
          // @ts-expect-error
          await ActiveEffect.implementation.create(effect, { parent: object, keepId: true });
          // }
        }
      }
    });

    function efHandler(type, effect, data, options, user) {
      if (this.document.id === effect.parent.id || effect.parent?.parent?.id === this.document.id) {
        setTimeout(() => this.render(), 0)
      }
    };
    function itemHandler(item, data, options, user) {
      if (this.document.id === item.id || item.parent?.id === this.document.id) {
        setTimeout(() => this.render(), 0)
      }
    };
    function tmHandler(worldTime: number, dt: number) {
      //@ts-expect-error
      if (Array.from(this.document.effects).some(ef => ef.isTemporary))
        setTimeout(() => this.render(), 0)
    }
    function tkHandler(token, update, options, user) {
      if (token.actor.id !== this.document.id) return;
      setTimeout(() => this.render(), 0);
    }
  
    function actHandler(actor, updates, options, user) {
      if (actor.id !== this.document.id) return;
      setTimeout(() => this.render(), 0)
    }
  
    if (!this.effectHookIdu)
      this.effectHookIdu = Hooks.on("updateActiveEffect", efHandler.bind(this, "update"));
    if (!this.effectHookIdc)
      this.effectHookIdc = Hooks.on("createActiveEffect", efHandler.bind(this, "create"));
    if (!this.effectHookIdd)
      this.effectHookIdd = Hooks.on("deleteActiveEffect", efHandler.bind(this, "delete"));
    if (!this.itemHookId)
      this.itemHookId = Hooks.on("updateItem", itemHandler.bind(this))
    if (!this.effectHookIdt)
      this.effectHookIdt = Hooks.on("updateToken", tkHandler.bind(this));
    if (!this.effectHookIda)
      this.effectHookIda = Hooks.on("updateActor", actHandler.bind(this));
    if (!this.timeHookId)
      this.timeHookId = Hooks.on("updateWorldTime", tmHandler.bind(this))
    if (!this.combatHookId)
      this.combatHookId = Hooks.on("updateCombat", tmHandler.bind(this));
  }
  
  async _preClose(options) {
    await super._preClose(options);
    if (this.effectHookIdu) Hooks.off("updateActiveEffect", this.effectHookIdu);
    if (this.effectHookIdc) Hooks.off("createActiveEffect", this.effectHookIdc);
    if (this.effectHookIdd) Hooks.off("deleteActiveEffect", this.effectHookIdd);
    if (this.timeHookId) Hooks.off("updateWorldTime", this.timeHookId);
    if (this.effectHookIdt) Hooks.off("updateToken", this.effectHookIdt);
    if (this.effectHookIda) Hooks.off("updateActor", this.effectHookIda);
    if (this.itemHookId) Hooks.off("updateItem", this.itemHookId);
    if (this.combatHookId) Hooks.off("updateCombat", this.combatHookId);
  }
}
