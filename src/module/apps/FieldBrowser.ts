import { error, i18n } from "../../dae.js";
import { daeSystemClass } from "../dae.js";
import { InputAutocomplete, Suggestions } from "./ChangeAutocomplete.js";

const MAX_ENTRIES = 100;

interface FieldData {
  key: string;
  name: string;
  description: string;
  category: string;
}

/**
 * What the browser needs from whatever is hosting it. The effect sheet satisfies this; so does the
 * small adapter used for dnd5e's per-change dialog.
 */
export interface FieldBrowserHost {
  onFieldSelected(): void;
  updateFieldInfo(): void;
}

export class DAEFieldBrowser {
  private static knownFieldData: Record<string, { category: string }> = {};
  private static fieldDataInitialized: boolean = false;

  public enrichedFields: FieldData[] = [];
  private validFields: Record<string, {name: string, description?: string}>;
  private currentInput: HTMLInputElement | undefined;
  private effectConfig: FieldBrowserHost;
  private completers = new WeakMap<HTMLInputElement, InputAutocomplete>();
  public debouncedUpdateBrowser: () => void;

  constructor(validFields: Record<string, {name: string, description?: string}>, effectConfig: FieldBrowserHost) {
    this.validFields = validFields;
    this.effectConfig = effectConfig;
    this.debouncedUpdateBrowser = foundry.utils.debounce(() => this.updateBrowser(), 50);
  }

  async init(): Promise<void> {
    try {
      if (!DAEFieldBrowser.fieldDataInitialized) {
        // fetch data to save known category-field pairings.
        const fieldData = await foundry.utils.fetchJsonWithTimeout('modules/dae/data/field-data.json');
        Hooks.callAll("dae.setFieldData", fieldData);
        for (const [category, keys] of Object.entries(fieldData as Record<string, string[]>)) {
          for (const key of keys) {
            DAEFieldBrowser.knownFieldData[key] = { category };
          }
        }
        DAEFieldBrowser.fieldDataInitialized = true;
      }
      this.enrichedFields = this.enrichValidFields();
      this.effectConfig.updateFieldInfo();
    } catch (err) {
      error("DAEFieldBrowser | Failed to initialize:", err);
    }
  }

  /**
 * Enriches the valid fields with name and description if present.
 * @returns {FieldData[]} The enriched fields.
 */
  private enrichValidFields(): FieldData[] {
    return Object.entries(this.validFields)
      .map(([key, {name, description}]): FieldData => {
        const category = DAEFieldBrowser.knownFieldData[key]?.category;
        let localisationPrefix = `dae.${category ?? "Unknown"}.fieldData`;
        const nameLocalizationPath = `${localisationPrefix}.${key}.name`;
        const descriptionLocalizationPath = `${localisationPrefix}.${key}.description`;
        
        const localizedName = i18n(nameLocalizationPath);
        const localizedDescription = i18n(descriptionLocalizationPath);
        // If we have a localization, use it, otherwise use the default field's name, or finally the key itself
        // Logic looks a bit weird because DAE already sets the value of the validFields kvp to its key if missing.
        const finalName = (localizedName !== "") && (localizedName !== nameLocalizationPath)
          ? localizedName
          : (typeof name === "string" && name !== "" && name !== key && !name.startsWith("dae.genericSuffixes"))
            ? name
            : key;

        // Same logic for descriptions
        let finalDescription = (localizedDescription !== "") && (localizedDescription !== descriptionLocalizationPath)
          ? localizedDescription
          : (typeof description === "string" && description !== "" && !description.startsWith("dae.genericSuffixes"))
            ? description
            : '';

        if (daeSystemClass.fieldMappings[key]) {
          const mapping = daeSystemClass.fieldMappings[key];
          const displayMapping = typeof mapping === "string" ? mapping : `${mapping.key}${mapping.value !== undefined ? ` ${mapping.value}` : ""}`;
          finalDescription += ` deprecated: use ${displayMapping} instead`;
        }
        return {
          key,
          name: finalName,
          description: finalDescription,
          category: DAEFieldBrowser.knownFieldData[key]?.category || 'Other'
        };
      }).filter(field => field.category !== 'Hidden');
  }

  public updateBrowser(): void {
    if (this.currentInput) this.completers.get(this.currentInput)?.refresh();
  }

  public hideBrowser(): void {
    if (this.currentInput) this.completers.get(this.currentInput)?.dismiss();
  }

  public setInput(input: HTMLInputElement): void {
    this.currentInput = input;
    if (!this.completers.has(input)) {
      this.completers.set(input, new InputAutocomplete(input, () => this.suggest(input)));
    }
  }

  /** Matching keys grouped under their category, each with its name and description beneath it. */
  private suggest(input: HTMLInputElement): Suggestions {
    const query = input.value.toLowerCase();
    const matches = this.enrichedFields.filter(field =>
      field.key.toLowerCase().includes(query)
      || field.name.toLowerCase().includes(query)
      || field.description.toLowerCase().includes(query)
    ).slice(0, MAX_ENTRIES);
    const byCategory = Map.groupBy(matches, field => field.category);
    const entries: AutocompleteEntry[] = [];
    for (const [category, fields] of byCategory) {
      if (byCategory.size > 1) {
        entries.push({ identifier: "", label: i18n(`dae.fieldData.fieldCategories.${category}`), disabled: true });
      }
      for (const field of fields) entries.push({ identifier: field.key, label: fieldLabel(field) });
    }
    return {
      entries,
      apply: key => {
        input.value = key;
        this.effectConfig.onFieldSelected();
      }
    };
  }

  /**
   * Gets the field information for a given key.
   * Used by DAEActiveEffectConfig to populate names and descriptions below the input field.
   * @param {string} key - The key to get field information for.
   * @returns {FieldData} The field information.
   */
  getFieldInfo(key: string): FieldData {
    return this.enrichedFields?.find(f => f.key === key) || {
      key: key,
      name: key,
      description: "",
      category: ""
    };
  }
}
function fieldLabel(field: FieldData): HTMLElement {
  const label = document.createElement("span");
  label.classList.add("dae-ac-field");
  label.append(field.key);
  const detail = [field.name !== field.key ? field.name : "", field.description].filter(Boolean).join(" - ");
  if (detail) {
    const small = document.createElement("small");
    small.textContent = detail;
    label.append(small);
  }
  return label;
}
