import { log } from "../../dae";


interface FieldData {
  key: string;
  name: string;
  description: string;
  category: string;
}

export class TriniumEffectFlagBrowser {
  private fieldDataArray: FieldData[] = [];
  private mergedFields: FieldData[] | null = null;
  private filteredFields: FieldData[] = [];
  private selectedIndex: number = 0;
  private currentTab: string = 'All';
  private tabs: string[] = [];
  public browserElement: HTMLElement | null = null;
  private validFields: Record<string, any>;
  private currentInput: HTMLInputElement | null = null;
  private isFullBrowser: boolean = false;
  private contentElement: HTMLElement | null = null;
  private eventsSetup: boolean = false;

  constructor(validFields: Record<string, any>) {
    this.validFields = validFields;
    log("TriniumEffectFlagBrowser | Initializing");
  }

  async init(): Promise<void> {
    log("TriniumEffectFlagBrowser | Fetching field data");
    try {
      const fieldData = await foundry.utils.fetchJsonWithTimeout('modules/dae/data/field-data.json');
      this.fieldDataArray = this.createFieldDataObjects(fieldData);
      log(`TriniumEffectFlagBrowser | Loaded ${this.fieldDataArray.length} field data objects`);
      this.mergedFields = this.mergeFields(this.getFieldObjects(), this.fieldDataArray);
      this.filteredFields = this.mergedFields;
      this.tabs = ['All', ...new Set(this.mergedFields.map(field => field.category || 'Other'))];
    } catch (error) {
      log("TriniumEffectFlagBrowser | Failed to initialize:", error);
    }
  }

  private createBrowser(): void {
    if (this.browserElement) return;
    log("TriniumEffectFlagBrowser | Creating browser element");
    
    this.browserElement = document.createElement('div');
    this.browserElement.id = 'tefb-browser';
    this.browserElement.className = 'tefb-browser';
    this.browserElement.innerHTML = `
      <div class="tefb-tabs"></div>
      <div class="tefb-content"></div>
      <div class="tefb-toggle-container">
        <button class="tefb-toggle-button" title="Switch between compact and full browser views">
          <i class="fas fa-expand-arrows-alt"></i> Toggle Full Browser
        </button>
      </div>
    `;
    this.contentElement = this.browserElement.querySelector('.tefb-content');
    this.createTabButtons();
    this.setupEventListeners();
    document.body.appendChild(this.browserElement);
  }

  private createTabButtons(): void {
    const tabsContainer = this.browserElement!.querySelector('.tefb-tabs');
    if (tabsContainer) {
      const fragment = document.createDocumentFragment();
      this.tabs.forEach(tab => {
        const button = document.createElement('button');
        button.className = 'tefb-tab-button';
        button.dataset.tab = tab;
        button.textContent = tab;
        fragment.appendChild(button);
      });
      tabsContainer.appendChild(fragment);
    }
  }

  private setupEventListeners(): void {
    if (this.eventsSetup) return;
    log("TriniumEffectFlagBrowser | Setting up event listeners");

    document.addEventListener('click', this.handleDocumentClick.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.browserElement!.addEventListener('click', this.handleBrowserClick.bind(this));
    this.browserElement!.querySelector('.tefb-toggle-button')?.addEventListener('click', this.toggleFullBrowser.bind(this));

    this.eventsSetup = true;
  }

  public showBrowser(input: HTMLInputElement): void {
    log("TriniumEffectFlagBrowser | Showing browser");
    this.createBrowser();
    this.currentInput = input;
    this.browserElement!.classList.toggle('tefb-full-browser', this.isFullBrowser);
    this.browserElement!.style.display = 'block';
    this.positionBrowser(input);
    this.updateBrowser(input.value);
  }

  private positionBrowser(input: HTMLInputElement): void {
    const rect = input.getBoundingClientRect();
    this.browserElement!.style.position = 'absolute';
    this.browserElement!.style.top = `${rect.bottom + window.scrollY}px`;
    this.browserElement!.style.left = `${rect.left + window.scrollX}px`;
    this.browserElement!.style.width = `${rect.width}px`;
  }

  public updateBrowser(query: string): void {
    if (!this.browserElement || this.browserElement.style.display === 'none') return;
    log(`TriniumEffectFlagBrowser | Updating browser with query: ${query}`);
    const lowercaseQuery = query.toLowerCase();
    this.filteredFields = this.mergedFields!.filter(field => 
      field.key.toLowerCase().includes(lowercaseQuery) ||
      (this.isFullBrowser && (
        (field.name && field.name.toLowerCase().includes(lowercaseQuery)) ||
        (field.description && field.description.toLowerCase().includes(lowercaseQuery))
      ))
    );
    this.renderFields();
    this.selectField(0);
  }

  private renderFields(): void {
    if (!this.contentElement) return;
    log("TriniumEffectFlagBrowser | Rendering fields");

    const fragment = document.createDocumentFragment();
    this.filteredFields.forEach((field, index) => {
      const element = this.createFieldElement(field, index);
      fragment.appendChild(element);
    });

    this.contentElement.innerHTML = '';
    this.contentElement.appendChild(fragment);
  }

  private createFieldElement(field: FieldData, index: number): HTMLElement {
    const element = document.createElement('div');
    element.className = `tefb-field-option${index === this.selectedIndex ? ' selected' : ''}`;
    element.dataset.key = field.key;

    if (this.isFullBrowser) {
      const name = field.name !== field.key ? `<strong>${field.name}</strong> - ` : '';
      const description = field.description ? `<br><small>${field.description}</small>` : '';
      element.innerHTML = `${name}${field.key}${description}`;
    } else {
      element.textContent = field.key;
    }

    return element;
  }

  private handleBrowserClick(event: MouseEvent): void {
    log("TriniumEffectFlagBrowser | Browser clicked");
    const target = event.target as HTMLElement;
    if (target.closest('.tefb-tab-button')) {
      this.switchTab((target.closest('.tefb-tab-button') as HTMLElement).dataset.tab as string);
    } else if (target.closest('.tefb-field-option')) {
      const fieldOption = target.closest('.tefb-field-option') as HTMLElement;
      const index = Array.from(this.contentElement!.children).indexOf(fieldOption);
      this.selectField(index);
      this.applySelectedField();
    }
  }

  private handleDocumentClick(event: MouseEvent): void {
    if (this.browserElement && 
        !this.browserElement.contains(event.target as Node) && 
        event.target !== this.currentInput) {
      this.hideBrowser();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.browserElement || this.browserElement.style.display === 'none') return;
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
      case 'Enter':
        event.preventDefault();
        this.applySelectedField();
        break;
      case 'Escape':
        event.preventDefault();
        this.hideBrowser();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (this.isFullBrowser) {
          event.preventDefault();
          this.navigateTabs(event.key === 'ArrowLeft' ? -1 : 1);
        }
        break;
    }
  }

  private toggleFullBrowser(): void {
    log("TriniumEffectFlagBrowser | Toggling full browser");
    this.isFullBrowser = !this.isFullBrowser;
    this.browserElement!.classList.toggle('tefb-full-browser', this.isFullBrowser);
    this.currentInput!.focus();
    this.updateBrowser(this.currentInput!.value);
  }

  public hideBrowser(): void {
    log("TriniumEffectFlagBrowser | Hiding browser");
    if (this.browserElement) {
      this.browserElement.style.display = 'none';
    }
  }

  private switchTab(tab: string): void {
    log(`TriniumEffectFlagBrowser | Switching to tab: ${tab}`);
    this.currentTab = tab;
    const tabButtons = this.browserElement!.querySelectorAll('.tefb-tab-button');
    tabButtons.forEach(button => button.classList.toggle('active', (button as HTMLElement).dataset.tab === tab));

    this.filteredFields = tab === 'All' ? this.mergedFields! : this.mergedFields!.filter(field => field.category === tab);
    this.renderFields();
    this.selectField(0);
  }

  private navigateFields(direction: number): void {
    const newIndex = (this.selectedIndex + direction + this.filteredFields.length) % this.filteredFields.length;
    this.selectField(newIndex);
  }

  private navigateTabs(direction: number): void {
    const currentTabIndex = this.tabs.indexOf(this.currentTab);
    const newTabIndex = (currentTabIndex + direction + this.tabs.length) % this.tabs.length;
    this.switchTab(this.tabs[newTabIndex]);
  }

  private selectField(index: number): void {
    log(`TriniumEffectFlagBrowser | Selecting field at index: ${index}`);
    const previousSelected = this.contentElement!.querySelector('.tefb-field-option.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }

    this.selectedIndex = index;
    const newSelected = this.contentElement!.children[index] as HTMLElement;
    if (newSelected) {
      newSelected.classList.add('selected');
      newSelected.scrollIntoView({ block: 'nearest' });
    }
  }

  public applySelectedField(): void {
    log("TriniumEffectFlagBrowser | Applying selected field");
    const selectedField = this.filteredFields[this.selectedIndex];
    if (selectedField && this.currentInput) {
      this.currentInput.value = selectedField.key;
      this.currentInput.dispatchEvent(new Event('change', { bubbles: true }));
      this.hideBrowser();
    }
  }

  private getFieldObjects(): FieldData[] {
    return Object.entries(this.validFields).map(([key, spec]) => ({
      key,
      name: spec || '',
      description: '',
      category: ''
    }));
  }

  private createFieldDataObjects(fieldData: any): FieldData[] {
    return Object.entries(fieldData).flatMap(([category, fields]: [string, any]) =>
      Object.entries(fields).map(([key, { name, description }]: [string, any]) => ({
        key,
        name,
        description,
        category
      }))
    );
  }

  private mergeFields(fieldObjects: FieldData[], newFieldObjects: FieldData[]): FieldData[] {
    const fieldMap = new Map(fieldObjects.map(field => [field.key, field]));

    for (const field of newFieldObjects) {
      if (fieldMap.has(field.key)) {
        const existingField = fieldMap.get(field.key)!;
        existingField.description = field.description;
        existingField.category = field.category;
        if (existingField.name === existingField.key) {
          existingField.name = field.name;
        }
      } else {
        fieldMap.set(field.key, field);
      }
    }

    return Array.from(fieldMap.values());
  }
}