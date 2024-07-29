import { log } from "../../dae";
import { DAEActiveEffectConfig } from "./DAEActiveEffectConfig";

export class TriniumEffectFlagBrowser {
  private debounceTimeout: number | null = null;
  private throttleTimeout: number | null = null;
  private fieldDataArray: any[] = [];
  private mergedFields: any[] | null = null;
  private selectedIndex: number = 0;
  private currentTab: string = 'All';
  private tabs: string[] = [];

  constructor() {
    log("TriniumEffectFlagBrowser | Initializing");
  }

  async init(): Promise<void> {
    log("TriniumEffectFlagBrowser | Checking DAE module");
    if (!game.modules.get("dae")?.active) {
      console.warn("TriniumEffectFlagBrowser | DAE module is not active.");
      return;
    }

    log("TriniumEffectFlagBrowser | Fetching field data");
    const fieldData = await foundry.utils.fetchJsonWithTimeout('modules/dae/data/field-data.json');
    this.fieldDataArray = this.createFieldDataObjects(fieldData);

    log(`TriniumEffectFlagBrowser | Loaded ${this.fieldDataArray.length} field data objects`);

    this.addEventListeners();
  }

  private addEventListeners(): void {
    log("TriniumEffectFlagBrowser | Adding event listeners");
    document.body.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const fillButton = target.closest('.tefb-fill-button');
    const fieldSelector = document.getElementById('tefb-field-selector');

    if (fillButton) {
      log("TriniumEffectFlagBrowser | Fill button clicked");
      event.preventDefault();
      event.stopPropagation();
      this.showFieldBrowser(fillButton as HTMLElement);
    } else if (fieldSelector) {
      const tabButton = target.closest('.tefb-tab-button');
      const fieldOption = target.closest('.tefb-field-option');

      if (tabButton) {
        log("TriniumEffectFlagBrowser | Tab button clicked");
        this.switchTab(tabButton.dataset.tab as string);
      } else if (fieldOption) {
        log("TriniumEffectFlagBrowser | Field option clicked");
        const index = Array.from(fieldOption.parentElement!.children).indexOf(fieldOption);
        this.selectField(index);
        this.applySelectedField();
      } else if (!fieldSelector.contains(target)) {
        log("TriniumEffectFlagBrowser | Clicked outside browser, removing");
        this.removeExistingBrowser();
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const browser = document.getElementById('tefb-field-selector');
    if (!browser) return;

    log(`TriniumEffectFlagBrowser | Key pressed: ${event.key}`);

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.navigateFields(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.navigateFields(1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.navigateTabs(-1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.navigateTabs(1);
        break;
      case 'Enter':
        event.preventDefault();
        this.applySelectedField();
        break;
      case 'Escape':
        event.preventDefault();
        this.removeExistingBrowser();
        break;
    }
  }

  public addFieldButtons(): void {
    log("TriniumEffectFlagBrowser | Adding field buttons");
    document.querySelectorAll('li.effect-change.flexrow:not(.tefb-processed)').forEach(row => {
      const button = document.createElement('button');
      button.classList.add('tefb-fill-button');
      button.innerHTML = '<i class="fas fa-search"></i>';
      button.setAttribute('data-index', (row as HTMLElement).getAttribute('data-index') || '');

      const formGroup = row.querySelector('.formgroup') as HTMLElement;
      formGroup.classList.add('tefb-relative-position');
      formGroup.appendChild(button);

      row.classList.add('tefb-processed');
    });
  }

  private showFieldBrowser(button: HTMLElement): void {
    log("TriniumEffectFlagBrowser | Showing field browser");
    this.removeExistingBrowser();
    const selector = this.createFieldBrowser(button);
    document.body.appendChild(selector);

    this.populateAllFields();
    this.setupSearchBox();
  }

  private removeExistingBrowser(): void {
    log("TriniumEffectFlagBrowser | Removing existing browser");
    const existingBrowser = document.getElementById('tefb-field-selector');
    if (existingBrowser) {
      existingBrowser.remove();
    }
  }

  private createFieldBrowser(button: HTMLElement): HTMLElement {
    log("TriniumEffectFlagBrowser | Creating field browser");
    const selector = document.createElement('div');
    selector.id = 'tefb-field-selector';
    selector.classList.add('tefb-floating-div');
    selector.dataset.index = button.getAttribute('data-index') || '';

    selector.innerHTML = `
      <div class="tefb-search-container">
        <input type="text" class="tefb-search-box" placeholder="Search..." autofocus />
      </div>
      <div class="tefb-tabs"></div>
      <div class="tefb-tab-content"></div>
    `;

    return selector;
  }

  private populateAllFields(): void {
    log("TriniumEffectFlagBrowser | Populating all fields");
    const fieldObjects = this.getFieldObjects();

    if (!this.mergedFields || this.shouldRebuildBrowser(fieldObjects)) {
      this.mergedFields = this.mergeFields(fieldObjects, this.fieldDataArray);
    }

    this.tabs = ['All', ...new Set(this.mergedFields.map(field => field.category || 'Other'))];
    this.createTabButtons();

    this.tabs.forEach(category => {
      const fields = category === 'All' ? this.mergedFields : this.getFieldsByCategory(this.mergedFields, category);
      this.populateFields(category, fields);
    });

    this.switchTab('All');
    this.focusSearchBox();
  }

  private shouldRebuildBrowser(fieldObjects: any[]): boolean {
    log("TriniumEffectFlagBrowser | Checking if browser should be rebuilt");
    const currentKeys = new Set(this.mergedFields!.map(field => field.key));
    const newKeys = new Set(fieldObjects.map(field => field.key));

    return [...currentKeys].some(key => !newKeys.has(key)) ||
      [...newKeys].some(key => !currentKeys.has(key));
  }

  private getFieldObjects(): any[] {
    log("TriniumEffectFlagBrowser | Getting field objects");
    const DAE_API = game.modules.get("dae")?.api;
    if (!DAE_API) {
      console.error('TriniumEffectFlagBrowser | DAE API not found.');
      return [];
    }

    const validFields = DAE_API.ValidSpec.specs.union.allSpecsObj || {};
    const autoFields = DAE_API.otherValidSpecKeys || [];

    const fieldObjects = [];

    for (const [key, spec] of Object.entries(validFields)) {
      fieldObjects.push({ key, name: (spec as any)._label || '', description: '', category: '' });
    }

    for (const key of autoFields) {
      if (!validFields[key]) {
        fieldObjects.push({ key, name: '', description: '', category: '' });
      }
    }

    return fieldObjects;
  }

  private createFieldDataObjects(fieldData: any): any[] {
    log("TriniumEffectFlagBrowser | Creating field data objects");
    const fieldDataObjects = [];
    for (const [category, fields] of Object.entries(fieldData)) {
      for (const [key, { name, description }] of Object.entries(fields as any)) {
        fieldDataObjects.push({ key, name, description, category });
      }
    }
    return fieldDataObjects;
  }

  private mergeFields(fieldObjects: any[], newFieldObjects: any[]): any[] {
    log("TriniumEffectFlagBrowser | Merging fields");
    const fieldMap = new Map();

    for (const field of fieldObjects) {
      fieldMap.set(field.key, field);
    }

    for (const field of newFieldObjects) {
      if (fieldMap.has(field.key)) {
        const existingField = fieldMap.get(field.key);
        existingField.description = field.description;
        existingField.category = field.category;
        if (!existingField.name) {
          existingField.name = field.name;
        }
      }
    }

    return Array.from(fieldMap.values());
  }

  private createTabButtons(): void {
    log("TriniumEffectFlagBrowser | Creating tab buttons");
    const tabsContainer = document.querySelector('.tefb-tabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = this.tabs.map(tab =>
        `<button class="tefb-tab-button" data-tab="${tab}">${tab}</button>`
      ).join('');
    }
  }

  private setupSearchBox(): void {
    log("TriniumEffectFlagBrowser | Setting up search box");
    const searchBox = document.querySelector('.tefb-search-box') as HTMLInputElement;
    searchBox.addEventListener('input', this.debounce(this.filterFields.bind(this), 100));
    searchBox.addEventListener('focus', () => this.selectField(0));
  }

  private getFieldsByCategory(fields: any[], category: string): any[] {
    return fields.filter(field => field.category === category || (category === 'Other' && !field.category));
  }

  private populateFields(tab: string, fields: any[]): void {
    log(`TriniumEffectFlagBrowser | Populating fields for tab: ${tab}`);
    const tabContent = document.querySelector('.tefb-tab-content');
    if (!tabContent) return;

    const tabPane = document.createElement('div');
    tabPane.classList.add('tefb-tab-pane');
    tabPane.dataset.tab = tab;

    if (fields.length === 0) {
      return;
    }

    tabPane.innerHTML = fields.map(field => {
      const name = field.name ? `${field.name} - ` : '';
      const description = field.description ? `<small>${field.description}</small>` : '';
      return `<div class="tefb-field-option" data-flag="${field.key}">
                <strong>${name}</strong>${field.key}<br/>
                ${description}
              </div>`;
    }).join('');

    tabContent.appendChild(tabPane);
  }

  private focusSearchBox(): void {
    log("TriniumEffectFlagBrowser | Focusing search box");
    const searchBox = document.querySelector('.tefb-search-box') as HTMLInputElement;
    if (searchBox) {
      searchBox.focus();
    }
  }

  private filterFields(event: Event): void {
    const query = (event.target as HTMLInputElement).value.toLowerCase();
    log(`TriniumEffectFlagBrowser | Filtering fields with query: ${query}`);
    const options = document.querySelectorAll(`.tefb-tab-pane[data-tab="${this.currentTab}"] .tefb-field-option`);
    let firstVisibleIndex = -1;
    options.forEach((option, index) => {
      const text = option.textContent?.toLowerCase() || '';
      const display = text.includes(query) ? 'block' : 'none';
      (option as HTMLElement).style.display = display;
      if (display === 'block' && firstVisibleIndex === -1) {
        firstVisibleIndex = index;
      }
    });
    if (firstVisibleIndex !== -1) {
      this.selectField(firstVisibleIndex);
    }
  }

  private navigateFields(direction: number): void {
    log(`TriniumEffectFlagBrowser | Navigating fields: ${direction}`);
    const options = Array.from(document.querySelectorAll(`.tefb-tab-pane[data-tab="${this.currentTab}"] .tefb-field-option`))
      .filter(option => (option as HTMLElement).style.display !== 'none');
    let newIndex = options.indexOf(options.find(option => option.classList.contains('selected'))!) + direction;

    if (newIndex < 0) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 0;

    this.selectField(Array.from(document.querySelectorAll(`.tefb-tab-pane[data-tab="${this.currentTab}"] .tefb-field-option`)).indexOf(options[newIndex]));
  }

  private navigateTabs(direction: number): void {
    log(`TriniumEffectFlagBrowser | Navigating tabs: ${direction}`);
    const currentTabIndex = this.tabs.indexOf(this.currentTab);
    let newTabIndex = currentTabIndex + direction;

    if (newTabIndex < 0) newTabIndex = this.tabs.length - 1;
    if (newTabIndex >= this.tabs.length) newTabIndex = 0;

    this.switchTab(this.tabs[newTabIndex]);
  }

  private selectField(index: number): void {
    log(`TriniumEffectFlagBrowser | Selecting field at index: ${index}`);
    const options = document.querySelectorAll(`.tefb-tab-pane[data-tab="${this.currentTab}"] .tefb-field-option`);
    options.forEach((option, i) => {
      option.classList.toggle('selected', i === index);
    });
    this.selectedIndex = index;
    const selectedOption = options[index] as HTMLElement;
    if (selectedOption) {
      selectedOption.scrollIntoView({ block: 'nearest' });
    }
  }

  private applySelectedField(): void {
    log("TriniumEffectFlagBrowser | Applying selected field");
    const selectedOption = document.querySelector(`.tefb-tab-pane[data-tab="${this.currentTab}"] .tefb-field-option.selected`);
    if (selectedOption) {
      const flag = selectedOption.getAttribute('data-flag');
      const index = document.getElementById('tefb-field-selector')?.dataset.index;
      this.updateInputValue(flag!, index!);
      this.removeExistingBrowser();
    }
  }

  private updateInputValue(flag: string, index: string): void {
    log(`TriniumEffectFlagBrowser | Updating input value: ${flag} at index: ${index}`);
    const input = document.querySelector(`li.effect-change[data-index="${index}"] .awesomplete.keyinput`) as HTMLInputElement;
    if (input) {
      input.value = flag;
      input.dispatchEvent(new Event('change'));
      log(`TriniumEffectFlagBrowser | Updated input value to: ${input.value}`);
      this.triggerDAEChangeEvent(input);
    } else {
      console.warn(`TriniumEffectFlagBrowser | Input element not found for index: ${index}`);
    }
  }

  private triggerDAEChangeEvent(input: HTMLInputElement): void {
    log("TriniumEffectFlagBrowser | Triggering DAE change event");
    const event = new Event('awesomplete-selectcomplete', {
      bubbles: true,
      cancelable: true
    });
    input.dispatchEvent(event);
  }

  private switchTab(tab: string): void {
    log(`TriniumEffectFlagBrowser | Switching to tab: ${tab}`);
    this.currentTab = tab;
    document.querySelectorAll('.tefb-tab-pane').forEach(pane => {
      (pane as HTMLElement).style.display = (pane as HTMLElement).dataset.tab === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.tefb-tab-button').forEach(button => {
      button.classList.toggle('active', (button as HTMLElement).dataset.tab === tab);
    });
    this.focusSearchBox();
    this.selectField(0);
  }

  private debounce(func: Function, delay: number): (...args: any[]) => void {
    return (...args: any[]) => {
      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  private throttle(func: Function, delay: number): (...args: any[]) => void {
    return (...args: any[]) => {
      if (!this.throttleTimeout) {
        this.throttleTimeout = setTimeout(() => {
          func.apply(this, args);
          this.throttleTimeout = null;
        }, delay);
      }
    };
  }
}

// Initialize the browser
Hooks.once('ready', async () => {
  log("TriniumEffectFlagBrowser | Initializing browser");
  const handler = new TriniumEffectFlagBrowser();
  await handler.init();
});