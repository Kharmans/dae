import { i18n } from "../../dae.js";
import { InputAutocomplete, pathSuggestions, referenceData } from "./ChangeAutocomplete.js";

/*
 * A form-based editor for dnd5e 6 filter conditions (FiltersField): groups of comparisons that are stored
 * as dnd5e's `{k, o, v}` JSON. The builder only ever writes JSON dnd5e can evaluate, and refuses to open
 * anything it cannot represent rather than rewriting it.
 */

const GROUP_OPS = ["AND", "OR", "NOR", "NAND", "XOR", "NOT"] as const;
type GroupOp = typeof GROUP_OPS[number];

// "ne" is the builder's own: dnd5e has no not-equal, so it is stored as NOT around exact.
const COMPARISON_OPS = [
  "exact", "ne", "gt", "gte", "lt", "lte", "has", "hasany", "hasall", "in", "subsetof", "empty",
  "contains", "icontains", "startswith", "istartswith", "endswith", "iendswith"
] as const;
type ComparisonOp = typeof COMPARISON_OPS[number];

const LIST_OPS: ReadonlySet<string> = new Set(["hasany", "hasall", "in", "subsetof"]);
const NUMERIC_OPS: ReadonlySet<string> = new Set(["gt", "gte", "lt", "lte"]);
const TEXT_OPS: ReadonlySet<string> = new Set(["contains", "icontains", "startswith", "istartswith", "endswith", "iendswith"]);

export interface ConditionRow { type: "condition"; key: string; op: ComparisonOp; value: unknown }
export interface ConditionGroup {
  type: "group";
  op: GroupOp;
  children: ConditionNode[];
  /** Root only: how dnd5e's JSON spelled it - a bare array, or a single comparison object. */
  form?: "array" | "single";
}
export type ConditionNode = ConditionRow | ConditionGroup;

interface CommonField { key: string; op: ComparisonOp; label: string; itemOnly?: boolean }

/** Fields worth testing, grouped for the menu; each is added with a sensible operator and the value left to pick. */
const COMMON_FIELDS: Record<string, Record<string, Omit<CommonField, "label">>> = {
  status: {
    statuses: { key: "statusesSet", op: "has" },
    conditionImmunities: { key: "traits.ci.value", op: "has" },
  },
  creature: {
    creatureType: { key: "details.type.value", op: "exact" },
    size: { key: "traits.size", op: "exact" },
    actorType: { key: "actorType", op: "exact" },
  },
  health: {
    hpPercent: { key: "attributes.hp.pct", op: "lt" },
    hp: { key: "attributes.hp.value", op: "lt" },
    tempHp: { key: "attributes.hp.temp", op: "gt" },
  },
  attributes: {
    ac: { key: "attributes.ac.value", op: "gte" },
    speed: { key: "attributes.movement.walk", op: "gte" },
    proficiency: { key: "attributes.prof", op: "gte" },
    spellDC: { key: "attributes.spell.dc", op: "gte" },
    initiative: { key: "attributes.init.total", op: "gte" },
    exhaustion: { key: "attributes.exhaustion", op: "gte" },
    darkvision: { key: "attributes.senses.darkvision", op: "gt" },
  },
  defences: {
    resistances: { key: "traits.dr.value", op: "has" },
    immunities: { key: "traits.di.value", op: "has" },
    vulnerabilities: { key: "traits.dv.value", op: "has" },
  },
  progress: {
    level: { key: "details.level", op: "gte" },
    cr: { key: "details.cr", op: "gte" },
  },
  item: {
    spellLevel: { key: "item.level", op: "gte", itemOnly: true },
    spellSchool: { key: "item.school", op: "exact", itemOnly: true },
    itemProperties: { key: "item.properties", op: "has", itemOnly: true },
  },
};

/** The menu's groups, with abilities taken from dnd5e's config so added abilities appear too. */
function commonFieldGroups(): [string, CommonField[]][] {
  const fixed = (group: string): CommonField[] => Object.entries(COMMON_FIELDS[group])
    .map(([id, field]) => ({ ...field, label: i18n(`dae.ConditionBuilder.Field.${id}`) }));
  const abilities: CommonField[] = Object.entries(CONFIG.DND5E.abilities).flatMap(([id, ability]) => {
    const name = i18n(ability.label);
    return [
      { key: `abilities.${id}.value`, op: "gte" as const, label: game.i18n?.format("dae.ConditionBuilder.Field.abilityScore", { ability: name }) ?? name },
      { key: `abilities.${id}.mod`, op: "gte" as const, label: game.i18n?.format("dae.ConditionBuilder.Field.abilityMod", { ability: name }) ?? name },
    ];
  });
  return [
    ["status", fixed("status")], ["creature", fixed("creature")], ["abilities", abilities],
    ["attributes", fixed("attributes")], ["health", fixed("health")], ["defences", fixed("defences")],
    ["progress", fixed("progress")], ["item", fixed("item")],
  ];
}

function labels(config: Record<string, { label?: string; name?: string }>): Record<string, string> {
  return Object.fromEntries(Object.entries(config).map(([id, entry]) => [id, i18n(entry.label ?? entry.name ?? id)]));
}

/** Paths whose values come from a dnd5e or core list, so the value is picked rather than typed. */
const CHOICES: Record<string, () => Record<string, string>> = {
  statusesSet: () => Object.fromEntries(CONFIG.statusEffects.map(status => [status.id, i18n(status.name ?? status.id)])),
  "traits.ci.value": () => labels(CONFIG.DND5E.conditionTypes),
  "details.type.value": () => labels(CONFIG.DND5E.creatureTypes),
  "traits.size": () => labels(CONFIG.DND5E.actorSizes),
  actorType: () => Object.fromEntries(Object.entries(CONFIG.Actor.typeLabels ?? {})
    .filter(([type]) => type !== "base").map(([type, label]) => [type, i18n(String(label))])),
  "traits.dr.value": () => labels(CONFIG.DND5E.damageTypes),
  "traits.di.value": () => labels(CONFIG.DND5E.damageTypes),
  "traits.dv.value": () => labels(CONFIG.DND5E.damageTypes),
  // @ts-expect-error no dnd5e-types
  "item.school": () => labels(CONFIG.DND5E.spellSchools),
  "item.properties": () => labels(CONFIG.DND5E.itemProperties),
};

/** Operators that pick one value, or several, from a list; the rest are typed. */
const PICK_ONE: ReadonlySet<string> = new Set(["exact", "ne", "has"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function row(key: string, op: ComparisonOp, value: unknown): ConditionRow {
  return { type: "condition", key, op, value };
}

function isComparisonOp(op: unknown): op is ComparisonOp {
  return typeof op === "string" && op !== "ne" && (COMPARISON_OPS as readonly string[]).includes(op);
}

function isGroupOp(op: unknown): op is GroupOp {
  return typeof op === "string" && (GROUP_OPS as readonly string[]).includes(op);
}

function parseNode(node: unknown): ConditionNode | null {
  if (!isPlainObject(node)) return null;
  const { k, o = "exact", v } = node as { k?: unknown; o?: unknown; v?: unknown };
  if (o === "NOT") {
    if (!isPlainObject(v)) return null;
    const child = parseNode(v);
    if (!child) return null;
    if (child.type === "condition" && child.op === "exact") return row(child.key, "ne", child.value);
    return { type: "group", op: "NOT", children: [child] };
  }
  if (isGroupOp(o)) {
    if (!Array.isArray(v)) return null;
    const children = v.map(parseNode);
    return children.every(c => c) ? { type: "group", op: o, children: children as ConditionNode[] } : null;
  }
  if (!isComparisonOp(o) || typeof k !== "string") return null;
  // A nested filter tested against each member of a collection has no row form.
  if (isPlainObject(v)) return null;
  return row(k, o, v);
}

function serializeNode(node: ConditionNode): object {
  if (node.type === "condition") {
    if (node.op === "ne") return { o: "NOT", v: { k: node.key, o: "exact", v: node.value } };
    return { k: node.key, o: node.op, v: node.value };
  }
  const children = node.children.map(serializeNode);
  if (node.op === "NOT") return children.length === 1 ? { o: "NOT", v: children[0] } : { o: "NAND", v: children };
  return { o: node.op, v: children };
}

/** A typed value from what was typed, using the current value at the path as the guide for exact matches. */
function coerce(raw: string, op: ComparisonOp, sample: unknown): unknown {
  const scalar = (text: string): unknown => {
    const trimmed = text.trim();
    if (trimmed === "true" || trimmed === "false") return trimmed === "true";
    if (trimmed !== "" && Number.isFinite(Number(trimmed))) return Number(trimmed);
    return trimmed;
  };
  if (op === "empty") return raw !== "false";
  if (LIST_OPS.has(op)) return raw.split(",").map(s => s.trim()).filter(s => s).map(scalar);
  if (TEXT_OPS.has(op)) return raw;
  if (NUMERIC_OPS.has(op)) return scalar(raw);
  if (typeof sample === "number") return Number.isFinite(Number(raw)) && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof sample === "boolean") return raw.trim() === "true";
  if (typeof sample === "string") return raw;
  return scalar(raw);
}

function display(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return value === undefined || value === null ? "" : String(value);
}

interface ConditionBuilderOptions {
  value: string;
  effect: ActiveEffect.Implementation;
  onSubmit: (value: string) => void;
}

export class DAEConditionBuilder extends foundry.applications.api.ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    classes: ["dae-condition-builder-app"],
    window: {
      icon: "fa-solid fa-diagram-project",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    position: { width: 680, height: "auto" as const },
    actions: {
      addCondition: DAEConditionBuilder.#onAddCondition,
      addGroup: DAEConditionBuilder.#onAddGroup,
      remove: DAEConditionBuilder.#onRemove,
      save: DAEConditionBuilder.#onSave,
      cancel: DAEConditionBuilder.#onCancel,
    }
  };

  /** The builder's model of a dnd5e condition, or null when the JSON has no builder form. */
  static parse(json: string): ConditionGroup | null {
    let data: unknown;
    try {
      data = JSON.parse(json || "{}");
    } catch {
      return null;
    }
    if (foundry.utils.isEmpty(data as object)) return { type: "group", op: "AND", children: [], form: "array" };
    if (Array.isArray(data)) {
      const children = data.map(parseNode);
      return children.every(c => c) ? { type: "group", op: "AND", children: children as ConditionNode[], form: "array" } : null;
    }
    const node = parseNode(data);
    if (!node) return null;
    return node.type === "group" ? node : { type: "group", op: "AND", children: [node], form: "single" };
  }

  static serialize(root: ConditionGroup): string {
    if (root.op === "AND" && root.form) {
      if (!root.children.length) return "{}";
      if (root.form === "single" && root.children.length === 1) return JSON.stringify(serializeNode(root.children[0]));
      return JSON.stringify(root.children.map(serializeNode));
    }
    return JSON.stringify(serializeNode(root));
  }

  #root: ConditionGroup | null;
  #original: string;
  #effect: ActiveEffect.Implementation;
  #onSubmit: (value: string) => void;
  #data: Record<string, unknown>;
  #nodes = new WeakMap<HTMLElement, ConditionNode>();
  #parents = new WeakMap<ConditionNode, ConditionGroup>();

  constructor(options: ConditionBuilderOptions) {
    super({ window: { title: `${i18n("dae.ConditionBuilder.Title")}: ${options.effect.name}` } });
    this.#original = options.value;
    this.#root = DAEConditionBuilder.parse(options.value);
    this.#effect = options.effect;
    this.#onSubmit = options.onSubmit;
    this.#data = referenceData(options.effect);
  }

  /** The actor the live result is tested against. */
  get #actor(): Actor.Implementation | undefined {
    const parent = this.#effect.parent;
    if (parent instanceof Actor) return parent;
    if (parent instanceof Item) return parent.actor ?? undefined;
    return undefined;
  }

  protected override async _renderHTML(): Promise<HTMLElement> {
    const content = document.createElement("div");
    content.classList.add("dae-cb");

    const hint = document.createElement("p");
    hint.classList.add("hint");
    hint.textContent = i18n("dae.ConditionBuilder.Hint");
    content.append(hint);

    if (this.#root) content.append(this.#buildGroup(this.#root, true));
    else {
      const notice = document.createElement("p");
      notice.classList.add("dae-cb-unsupported", "notification", "warning");
      notice.textContent = i18n("dae.ConditionBuilder.Unsupported");
      content.append(notice);
    }

    const result = document.createElement("p");
    result.classList.add("dae-cb-result");
    content.append(result);

    const footer = document.createElement("footer");
    footer.classList.add("form-footer");
    footer.append(
      this.#button("cancel", "fa-solid fa-xmark", i18n("Cancel")),
      this.#button("save", "fa-solid fa-floppy-disk", i18n("Save"))
    );
    const save = footer.querySelector<HTMLButtonElement>('[data-action="save"]');
    if (save) save.disabled = !this.#root;
    content.append(footer);
    return content;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
    this.#refreshResult();
  }

  protected override async _onRender(context: object, options: foundry.applications.api.ApplicationV2.RenderOptions): Promise<void> {
    await super._onRender(context, options);
    if (this.element.dataset.daeListening) return;
    this.element.dataset.daeListening = "true";
    this.element.addEventListener("change", this.#onChange.bind(this));
    this.element.addEventListener("input", this.#onChange.bind(this));
  }

  #button(action: string, icon: string, label?: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    const i = document.createElement("i");
    i.className = icon;
    button.append(i);
    if (label) button.append(` ${label}`);
    return button;
  }

  #select(field: string, options: [string, string][], value: string): HTMLSelectElement {
    const select = document.createElement("select");
    select.dataset.field = field;
    for (const [optionValue, label] of options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = label;
      select.append(option);
    }
    select.value = value;
    return select;
  }

  #buildGroup(group: ConditionGroup, isRoot = false): HTMLElement {
    const element = document.createElement("div");
    element.classList.add("dae-cb-group");
    this.#nodes.set(element, group);

    const header = document.createElement("div");
    header.classList.add("dae-cb-group-header");
    // NOT is only offered where a stored condition already uses it; None of says the same.
    const groupOps = GROUP_OPS.filter(op => op !== "NOT" || group.op === "NOT");
    header.append(this.#select("group-op",
      groupOps.map(op => [op, i18n(`dae.ConditionBuilder.Group.${op}`)]), group.op));
    header.append(
      this.#button("addCondition", "fa-solid fa-plus", i18n("dae.ConditionBuilder.AddCondition")),
      this.#button("addGroup", "fa-solid fa-folder-plus", i18n("dae.ConditionBuilder.AddGroup"))
    );
    header.append(this.#commonFieldsMenu());
    if (!isRoot) header.append(this.#button("remove", "fa-solid fa-trash"));
    element.append(header);

    const children = document.createElement("div");
    children.classList.add("dae-cb-children");
    for (const child of group.children) {
      this.#parents.set(child, group);
      children.append(child.type === "group" ? this.#buildGroup(child) : this.#buildRow(child));
    }
    element.append(children);
    return element;
  }

  #buildRow(condition: ConditionRow): HTMLElement {
    const element = document.createElement("div");
    element.classList.add("dae-cb-row");
    this.#nodes.set(element, condition);

    const key = document.createElement("input");
    key.type = "text";
    key.dataset.field = "key";
    key.value = condition.key;
    key.placeholder = "attributes.hp.pct";
    const completer: InputAutocomplete = new InputAutocomplete(key, pathSuggestions(() => completer, this.#data,
      () => key.dispatchEvent(new Event("change", { bubbles: true }))));

    const op = this.#select("op",
      COMPARISON_OPS.map(o => [o, i18n(`dae.ConditionBuilder.Op.${o}`)]), condition.op);
    element.append(key, op, this.#buildValue(condition), this.#button("remove", "fa-solid fa-trash"));
    return element;
  }

  #commonFieldsMenu(): HTMLSelectElement {
    const select = document.createElement("select");
    select.dataset.field = "field";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = i18n("dae.ConditionBuilder.CommonFields");
    select.append(placeholder);
    const onItem = this.#effect.parent instanceof Item;
    for (const [groupId, fields] of commonFieldGroups()) {
      const entries = fields.filter(field => !field.itemOnly || onItem);
      if (!entries.length) continue;
      const optgroup = document.createElement("optgroup");
      optgroup.label = i18n(`dae.ConditionBuilder.FieldGroup.${groupId}`);
      for (const field of entries) {
        const option = document.createElement("option");
        option.value = field.key;
        option.textContent = field.label;
        optgroup.append(option);
      }
      select.append(optgroup);
    }
    select.value = "";
    return select;
  }

  #buildValue(condition: ConditionRow): HTMLElement {
    if (condition.op === "empty") {
      return this.#select("value", [["true", i18n("Yes")], ["false", i18n("No")]], condition.value === false ? "false" : "true");
    }
    const choices = CHOICES[condition.key]?.();
    if (choices && (PICK_ONE.has(condition.op) || LIST_OPS.has(condition.op))) {
      // A stored value missing from the list is kept as an extra choice rather than lost.
      const current = (Array.isArray(condition.value) ? condition.value : [condition.value])
        .filter(v => v !== undefined && v !== null && v !== "").map(String);
      for (const value of current) choices[value] ??= value;
      const options = Object.entries(choices).map(([value, label]) => ({ value, label }));
      if (LIST_OPS.has(condition.op)) {
        const multi = foundry.applications.elements.HTMLMultiSelectElement.create({ name: "dae-cb-value", options, value: current });
        multi.dataset.field = "value";
        return multi;
      }
      const select = this.#select("value", [["", ""], ...options.map(o => [o.value, o.label] as [string, string])], current[0] ?? "");
      return select;
    }
    const value = document.createElement("input");
    value.type = "text";
    value.dataset.field = "value";
    value.value = display(condition.value);
    if (LIST_OPS.has(condition.op)) value.placeholder = i18n("dae.ConditionBuilder.ListHint");
    return value;
  }

  #onChange(event: Event): void {
    const target = event.target;
    const MultiSelect = foundry.applications.elements.HTMLMultiSelectElement;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof MultiSelect)) return;
    const field = target.dataset.field;
    const holder = target.closest<HTMLElement>(".dae-cb-row, .dae-cb-group");
    const node = holder ? this.#nodes.get(holder) : undefined;
    if (!field || !node) return;
    const raw = target instanceof MultiSelect ? Array.from(target.value).join(",") : target.value;

    if (node.type === "group") {
      if (field === "group-op" && isGroupOp(raw)) node.op = raw;
      else if (field === "field" && raw && event.type === "change") {
        const common = commonFieldGroups().flatMap(([, fields]) => fields).find(f => f.key === raw);
        if (common) node.children.push(row(common.key, common.op, ""));
        this.render();
        return;
      }
    } else if (field === "key") {
      node.key = raw.trim();
      // The key decides whether the value is picked from a list.
      if (event.type === "change") this.#rebuildValue(holder, node);
    } else if (field === "op" && (COMPARISON_OPS as readonly string[]).includes(raw)) {
      node.op = raw as ComparisonOp;
      node.value = coerce(display(node.value), node.op, foundry.utils.getProperty(this.#data, node.key));
      this.#rebuildValue(holder, node);
    } else if (field === "value") {
      node.value = coerce(raw, node.op, foundry.utils.getProperty(this.#data, node.key));
    }
    this.#refreshResult();
  }

  #rebuildValue(holder: HTMLElement | null, condition: ConditionRow): void {
    holder?.querySelector(':scope > [data-field="value"]')?.replaceWith(this.#buildValue(condition));
  }

  #refreshResult(): void {
    const result = this.element?.querySelector<HTMLElement>(".dae-cb-result");
    if (!result) return;
    const actor = this.#actor;
    if (!actor) {
      result.dataset.result = "none";
      result.textContent = i18n("dae.ConditionBuilder.NoActor");
      return;
    }
    const json = this.#root ? DAEConditionBuilder.serialize(this.#root) : this.#original;
    let passes = false;
    try {
      passes = new globalThis.dnd5e.Filter.Filter(JSON.parse(json)).check(this.#data);
    } catch { /* an invalid condition fails, as dnd5e treats it */ }
    result.dataset.result = passes ? "pass" : "fail";
    result.textContent = game.i18n?.format(passes ? "dae.ConditionBuilder.Passes" : "dae.ConditionBuilder.Fails",
      { actor: actor.name ?? "" }) ?? "";
  }

  #groupFor(target: HTMLElement): ConditionGroup | undefined {
    const holder = target.closest<HTMLElement>(".dae-cb-group");
    const node = holder ? this.#nodes.get(holder) : undefined;
    return node?.type === "group" ? node : undefined;
  }

  static #onAddCondition(this: DAEConditionBuilder, _event: PointerEvent, target: HTMLElement): void {
    this.#groupFor(target)?.children.push(row("", "exact", ""));
    this.render();
  }

  static #onAddGroup(this: DAEConditionBuilder, _event: PointerEvent, target: HTMLElement): void {
    this.#groupFor(target)?.children.push({ type: "group", op: "AND", children: [] });
    this.render();
  }

  static #onRemove(this: DAEConditionBuilder, _event: PointerEvent, target: HTMLElement): void {
    const holder = target.closest<HTMLElement>(".dae-cb-row, .dae-cb-group");
    const node = holder ? this.#nodes.get(holder) : undefined;
    const parent = node ? this.#parents.get(node) : undefined;
    if (!node || !parent) return;
    parent.children.splice(parent.children.indexOf(node), 1);
    this.render();
  }

  static #onSave(this: DAEConditionBuilder): void {
    if (!this.#root) return;
    this.#onSubmit(DAEConditionBuilder.serialize(this.#root));
    this.close();
  }

  static #onCancel(this: DAEConditionBuilder): void {
    this.close();
  }
}

/** Put a builder button after each of dnd5e's condition fields in `root` that lacks one. */
export function addConditionBuilderButtons(root: HTMLElement, effect: ActiveEffect.Implementation): void {
  for (const input of Array.from(root.querySelectorAll<HTMLElement>("filters-input"))) {
    if (input.nextElementSibling?.classList.contains("dae-condition-builder")) continue;
    if (!(input instanceof foundry.applications.elements.AbstractFormInputElement)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("dae-condition-builder", "icon", "fa-solid", "fa-diagram-project");
    button.dataset.tooltip = i18n("dae.ConditionBuilder.Open");
    button.ariaLabel = i18n("dae.ConditionBuilder.Open");
    button.addEventListener("click", () => {
      new DAEConditionBuilder({
        value: String(input.value ?? "{}"),
        effect,
        onSubmit: value => { input.value = value; }
      }).render({ force: true });
    });
    input.after(button);
  }
}
