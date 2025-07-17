import { DAEActiveEffectConfig } from "./DAEActiveEffectConfig.js";
interface FieldData {
    key: string;
    name: string;
    description: string;
    category: string;
}
export declare class DAEFieldBrowser {
    private static knownFieldData;
    private static fieldDataInitialized;
    private static isFullBrowser;
    private static showDescriptions;
    enrichedFields: FieldData[];
    private filteredFields;
    private selectedIndex;
    private currentTab;
    private tabs;
    browserElement: HTMLElement | null;
    private validFields;
    private currentInput;
    private contentElement;
    private effectConfig;
    debouncedUpdateBrowser: () => void;
    private memoizedFilterFields;
    /**
     * Creates an instance of DAEFieldBrowser.
     * @param {Record<string, {name: string, description?: string}>} validFields - The valid fields for the browser.
     * @param {DAEActiveEffectConfig} effectConfig - The effect configuration class.
     */
    constructor(validFields: Record<string, {
        name: string;
        description?: string;
    }>, effectConfig: DAEActiveEffectConfig);
    init(): Promise<void>;
    /**
   * Enriches the valid fields with name and description if present.
   * @returns {FieldData[]} The enriched fields.
   */
    private enrichValidFields;
    updateBrowser(): void;
    private createBrowser;
    private createTabButtons;
    /**
     * Renders filtered field elements.
     */
    private renderFields;
    /**
     * Creates a field element.
     * @param {FieldData} field - The field data.
     * @param {number} index - The index of the field.
     * @returns {HTMLElement} The created field element.
     */
    private createFieldElement;
    /**
   * Positions the browser element based on selected input field and browser settings.
   */
    private positionBrowser;
    private setupEventListeners;
    /**
     * Handles mouse click events for buttons, tab switching and field selection.
     * @param {MouseEvent} event - The mouse event.
     */
    private handleBrowserClick;
    /**
     * Handles document click events to close the browser if clicking outside.
     * @param {MouseEvent} event - The mouse event.
     */
    private handleDocumentClick;
    /**
     * Handles keydown events for navigation.
     * @param {KeyboardEvent} event - The keyboard event.
     */
    private handleKeyDown;
    hideBrowser(): void;
    /**
     * Switches to the specified tab.
     * @param {string} tab - The tab to switch to.
     */
    private switchTab;
    /**
     * Navigates through fields.
     * @param {number} direction - The direction to navigate (-1 for up, 1 for down).
     */
    private navigateFields;
    /**
     * Navigates through tabs.
     * @param {number} direction - The direction to navigate (-1 for left, 1 for right).
     */
    private navigateTabs;
    private memoize;
    /**
   * Filters the fields based on query and tab.
   * @param {string} query - The search query.
   * @param {string} tab - The current tab.
   * @returns {FieldData[]} The filtered fields.
   */
    private filterFields;
    /**
     * Selects a field at the specified index.
     * @param {number} index - The index of the field to select.
     */
    private selectField;
    /**
   * Applies the selected field to the DAEActiveEffectConfig input.
   */
    applySelectedField(): void;
    /**
   * Sets the current input element to the selected one. Called by event listeners in DAEActiveEffectConfig.
   * @param {HTMLInputElement} input - The input element to set.
   */
    setInput(input: HTMLInputElement): void;
    /**
     * Gets the field information for a given key.
     * Used by DAEActiveEffectConfig to populate names and descriptions below the input field.
     * @param {string} key - The key to get field information for.
     * @returns {FieldData} The field information.
     */
    getFieldInfo(key: string): FieldData;
}
export {};
