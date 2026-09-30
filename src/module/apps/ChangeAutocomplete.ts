import { APPLICATION_REF_NAMES } from "../dae.js";
import { ValidSpec } from "../Systems/DAESystem.js";

export interface Suggestions {
  entries: AutocompleteEntry[];
  apply(identifier: string): void;
}

/** Drives Foundry's autocomplete menu from a text field. */
export class InputAutocomplete {
  #menu: AutocompleteMenu;
  #apply?: (identifier: string) => void;
  #shown = false;

  constructor(
    readonly field: HTMLInputElement | HTMLTextAreaElement,
    private suggest: (field: HTMLInputElement | HTMLTextAreaElement) => Suggestions | undefined
  ) {
    const { Autocomplete } = foundry.applications.ux as unknown as { Autocomplete: AutocompleteStatic };
    this.#menu = new Autocomplete.implementation({
      onSelect: identifier => {
        this.#shown = false;
        this.#apply?.(identifier);
      }
    });
    field.addEventListener("input", () => this.refresh());
    field.addEventListener("blur", () => this.dismiss());
  }

  refresh(): void {
    const suggestions = this.suggest(this.field);
    if (!suggestions?.entries.some(e => !e.disabled)) return this.dismiss();
    this.#apply = suggestions.apply;
    this.#menu.activate(this.field, suggestions.entries);
    this.#shown = true;
    this.#menu.select(0);
    // Clicking an entry must not blur the field, or the blur closes the menu before the click lands.
    const element = this.#menu.element;
    if (element && !element.dataset.daeKeepFocus) {
      element.dataset.daeKeepFocus = "true";
      element.addEventListener("mousedown", event => event.preventDefault());
    }
  }

  /** Refresh once the menu has finished committing, which dismisses it after calling onSelect. */
  refreshAfterCommit(): void {
    setTimeout(() => this.refresh(), 0);
  }

  dismiss(): void {
    if (this.#shown) this.#menu.dismiss();
    this.#shown = false;
  }
}

const REFERENCE = /(@|##)([\w.-]*)$/;
const WORD = /(?<![\w.@#])([a-zA-Z]+)$/;
const MAX_ENTRIES = 50;

const MATH_FUNCTIONS = Object.getOwnPropertyNames(Math)
  .filter(name => typeof Math[name as keyof Math] === "function")
  .sort();

function isBranch(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function insert(field: HTMLInputElement | HTMLTextAreaElement, start: number, end: number, text: string): void {
  field.value = field.value.slice(0, start) + text + field.value.slice(end);
  const cursor = start + text.length;
  field.setSelectionRange(cursor, cursor);
}

let sampleData: object | undefined;

/** Roll data from an unsaved character, for effects with no actor to read. */
function sampleActorData(): object {
  // @ts-expect-error no dnd5e-types
  sampleData ??= new CONFIG.Actor.documentClass({ name: "DAE sample", type: "character" }).getRollData();
  return sampleData;
}

/**
 * What an `@` reference in a change value can name: the roll data of the actor the effect sits on or will
 * reach, the item's own data for an item effect, plus the facts DAE fills from an effect's application.
 */
export function referenceData(effect: ActiveEffect.Implementation): Record<string, unknown> {
  const parent = effect.parent;
  let data: object;
  if (parent instanceof Actor) data = parent.getRollData();
  else if (parent instanceof Item) {
    data = parent.actor ? parent.getRollData() : { ...sampleActorData(), ...parent.getRollData() };
  } else data = sampleActorData();
  const application = Object.fromEntries(APPLICATION_REF_NAMES.map(name => [name, 0]));
  return { ...application, ...data, stackCount: 0 };
}

/** Whether a key's value is a number or formula, so formula functions belong in it. */
export function takesFormula(spec: ValidSpec | undefined): boolean {
  const type = spec?.fieldType;
  if (type instanceof foundry.data.fields.DataField) {
    const FormulaField = globalThis.dnd5e?.dataModels?.fields?.FormulaField;
    return type instanceof foundry.data.fields.NumberField || (!!FormulaField && type instanceof FormulaField);
  }
  return type === undefined || typeof type === "number";
}

/**
 * Suggestions for the last segment of a dotted roll-data path ending at the cursor. A branch is inserted
 * with its separator and the next level offered straight away.
 */
function completePath(
  field: HTMLInputElement | HTMLTextAreaElement, cursor: number, pathText: string,
  data: Record<string, unknown>, completer: () => InputAutocomplete, onApply?: () => void
): Suggestions | undefined {
  const path = pathText.split(".");
  const partial = path.pop() ?? "";
  let node: unknown = data;
  for (const segment of path) {
    node = isBranch(node) ? node[segment] : undefined;
    if (!isBranch(node)) return undefined;
  }
  const branch = node as Record<string, unknown>;
  const lower = partial.toLowerCase();
  const names = Object.keys(branch).filter(name => name.toLowerCase().startsWith(lower)).sort().slice(0, MAX_ENTRIES);
  return {
    entries: names.map(name => ({ identifier: name, label: isBranch(branch[name]) ? `${name}.` : name })),
    apply: name => {
      const more = isBranch(branch[name]);
      insert(field, cursor - partial.length, cursor, more ? `${name}.` : name);
      onApply?.();
      if (more) completer().refreshAfterCommit();
    }
  };
}

/** Suggestions for a field holding a bare roll-data path, such as a condition key. */
export function pathSuggestions(
  completer: () => InputAutocomplete, data: Record<string, unknown>, onApply?: () => void
): (field: HTMLInputElement | HTMLTextAreaElement) => Suggestions | undefined {
  return field => {
    const cursor = field.selectionStart ?? field.value.length;
    const pathText = field.value.slice(0, cursor).match(/[\w.-]*$/)?.[0] ?? "";
    return completePath(field, cursor, pathText, data, completer, onApply);
  };
}

/** Suggestions for the text before the cursor in a change value: `@`/`##` paths, then formula functions. `mode` is read per keystroke, since the key can change while the field stays. */
export function valueSuggestions(
  completer: () => InputAutocomplete, data: Record<string, unknown>, mode: () => "none" | "references" | "formula"
): (field: HTMLInputElement | HTMLTextAreaElement) => Suggestions | undefined {
  return field => {
    const current = mode();
    if (current === "none") return undefined;
    const cursor = field.selectionStart ?? field.value.length;
    const before = field.value.slice(0, cursor);

    const reference = before.match(REFERENCE);
    if (reference) return completePath(field, cursor, reference[2], data, completer);

    if (current !== "formula") return undefined;
    const word = before.match(WORD)?.[1];
    if (!word) return undefined;
    const names = MATH_FUNCTIONS.filter(name => name.startsWith(word) && name !== word);
    return {
      entries: names.map(name => ({ identifier: name, label: `${name}()` })),
      apply: name => insert(field, cursor - word.length, cursor, `${name}(`)
    };
  };
}
