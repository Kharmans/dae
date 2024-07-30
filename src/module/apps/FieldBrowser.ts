import { log, debug, error } from "../../dae";

interface FieldData {
  key: string;
  name: string;
  description: string;
  category: string;
}

export class DAEFieldBrowser {
  private static fieldDataArray: FieldData[] = [];
  private static isFullBrowser: boolean = false;
  private static fieldDataInitialized: boolean = false;
  private mergedFields: FieldData[] = [];
  private filteredFields: FieldData[] = [];
  private selectedIndex: number = 0;
  private currentTab: string = 'All';
  private tabs: string[] = [];
  public browserElement: HTMLElement | null = null;
  private validFields: Record<string, any>;
  private currentInput: HTMLInputElement;
  private contentElement: HTMLElement | null = null;
  private eventsSetup: boolean = false;

  constructor(validFields: Record<string, any>) {
    this.validFields = validFields;
    log("DaeFieldBrowser | Initializing");
  }

  async init(): Promise<void> {
    log("DAEFieldBrowser | Fetching field data");
    try {
      if (!DAEFieldBrowser.fieldDataInitialized) {
        const fieldData = await foundry.utils.fetchJsonWithTimeout('modules/dae/data/field-data.json');
        DAEFieldBrowser.fieldDataArray = this.createFieldDataObjects(fieldData);
        DAEFieldBrowser.fieldDataInitialized = true;
        debug(`DAEFieldBrowser | Loaded ${DAEFieldBrowser.fieldDataArray.length} field data objects`);
      }

      this.mergedFields = this.mergeFields(this.getFieldObjects(), DAEFieldBrowser.fieldDataArray);
      this.filteredFields = this.mergedFields;
      this.tabs = ['All', ...new Set(this.mergedFields.map(field => field.category || 'Other'))];
    } catch (error) {
      error("DAEFieldBrowser | Failed to initialize:", error);
    }
  }

  private createBrowser(): void {
    if (this.browserElement) return;
    debug("DaeFieldBrowser | Creating browser element");
    
    this.browserElement = document.createElement('div');
    this.browserElement.id = 'dae-fb-browser';
    this.browserElement.className = 'dae-fb-browser';
    this.browserElement.innerHTML = `
      <div class="dae-fb-tabs"></div>
      <div class="dae-fb-content"></div>
      <div class="dae-fb-toggle-container">
        <button class="dae-fb-toggle-button" title="Switch between compact and full browser views">
          <i class="fas fa-expand-arrows-alt"></i> Toggle Full Browser
        </button>
      </div>
    `;
    this.contentElement = this.browserElement.querySelector('.dae-fb-content');
    this.createTabButtons();
    this.setupEventListeners();
    document.body.appendChild(this.browserElement);
  }

  private createTabButtons(): void {
    const tabsContainer = this.browserElement!.querySelector('.dae-fb-tabs');
    if (tabsContainer) {
      const fragment = document.createDocumentFragment();
      this.tabs.forEach(tab => {
        const button = document.createElement('button');
        button.className = 'dae-fb-tab-button';
        button.dataset.tab = tab;
        button.textContent = tab;
        fragment.appendChild(button);
      });
      tabsContainer.appendChild(fragment);
    }
  }

  public setInput(input: HTMLInputElement): void {
    log("DAEFieldBrowser | Setting input");
    this.currentInput = input;
  }

  private positionBrowser(): void {
    const rect = this.currentInput.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
  
    const maxBrowserWidth = DAEFieldBrowser.isFullBrowser ? 880 : 400;
    const maxContentHeight = DAEFieldBrowser.isFullBrowser ? 700 : 400;
  
    const browserWidth = Math.min(maxBrowserWidth, viewportWidth - rect.left - 10);
    const contentHeight = Math.min(maxContentHeight, viewportHeight - rect.bottom - 100);
  
    const contentElement = this.browserElement!.querySelector('.dae-fb-content') as HTMLElement;
    if (contentElement) {
      contentElement.style.maxHeight = `${contentHeight}px`;
    }

    this.browserElement!.style.width = `${browserWidth}px`;
    this.browserElement!.style.left = `${rect.left}px`;
    this.browserElement!.style.top = `${rect.bottom + window.scrollY}px`;
  }

  public updateBrowser(): void {
    if (!this.browserElement) {
      this.createBrowser();
      this.positionBrowser();
    }
    
    if (this.browserElement!.style.display === 'none') {
      this.browserElement!.style.display = 'block';
    }
    
    this.browserElement!.classList.toggle('dae-fb-full-browser', DAEFieldBrowser.isFullBrowser);
    
    debug(`DaeFieldBrowser | Updating browser with query: ${this.currentInput.value}`);
    this.applyFilters();
    this.renderFields();
    this.selectField(0);
    this.currentInput.focus();
  }

  private applyFilters(): void {
    const lowercaseQuery = this.currentInput.value.toLowerCase();
    this.filteredFields = this.mergedFields.filter(field => {
      const matchesTab = DAEFieldBrowser.isFullBrowser ? 
        (this.currentTab === 'All' || field.category === this.currentTab) : true;
      
      const matchesSearch = field.key.toLowerCase().includes(lowercaseQuery) ||
        (DAEFieldBrowser.isFullBrowser && (
          (field.name && field.name.toLowerCase().includes(lowercaseQuery)) ||
          (field.description && field.description.toLowerCase().includes(lowercaseQuery))
        ));

      return matchesTab && matchesSearch;
    });
  }

  private renderFields(): void {
    if (!this.contentElement) return;
    debug("DaeFieldBrowser | Rendering fields");

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
    element.className = `dae-fb-field-option${index === this.selectedIndex ? ' selected' : ''}`;
    element.dataset.key = field.key;

    if (DAEFieldBrowser.isFullBrowser) {
      const name = field.name !== field.key ? `<strong>${field.name}</strong> - ` : '';
      const description = field.description ? `<br><small>${field.description}</small>` : '';
      element.innerHTML = `${name}${field.key}${description}`;
    } else {
      element.textContent = field.key;
    }

    return element;
  }

  private setupEventListeners(): void {
    if (this.eventsSetup) return;
    debug("DaeFieldBrowser | Setting up event listeners");

    document.addEventListener('click', this.handleDocumentClick.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.browserElement!.addEventListener('click', this.handleBrowserClick.bind(this));

    this.eventsSetup = true;
  }

  private handleBrowserClick(event: MouseEvent): void {
    debug("DaeFieldBrowser | Browser clicked");
    const target = event.target as HTMLElement;
    if (target.closest('.dae-fb-tab-button')) {
      this.switchTab((target.closest('.dae-fb-tab-button') as HTMLElement).dataset.tab as string);
    } else if (target.closest('.dae-fb-field-option')) {
      const fieldOption = target.closest('.dae-fb-field-option') as HTMLElement;
      const index = Array.from(this.contentElement!.children).indexOf(fieldOption);
      this.selectField(index);
      this.applySelectedField();
    } else if (target.closest('.dae-fb-toggle-button')) {
      DAEFieldBrowser.isFullBrowser = !DAEFieldBrowser.isFullBrowser;
      this.browserElement!.classList.toggle('dae-fb-full-browser', DAEFieldBrowser.isFullBrowser);
      this.switchTab('All');
      this.positionBrowser();
    }
    this.currentInput.focus();
  }

  private handleDocumentClick(event: MouseEvent): void {
    if (this.browserElement && 
        !this.browserElement.contains(event.target as Node) && 
        event.target !== this.currentInput &&
        !(this.currentInput.classList.contains('keyinput') && event.target === this.currentInput)) {
      this.hideBrowser();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.browserElement || this.browserElement.style.display === 'none') return;
    debug(`DaeFieldBrowser | Key pressed: ${event.key}`);
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
        if (DAEFieldBrowser.isFullBrowser) {
          event.preventDefault();
          this.navigateTabs(event.key === 'ArrowLeft' ? -1 : 1);
        }
        break;
    }
  }

  public hideBrowser(): void {
    debug("DaeFieldBrowser | Hiding browser");
    if (this.browserElement) {
      this.browserElement.style.display = 'none';
    }
  }

  private switchTab(tab: string): void {
    debug(`DaeFieldBrowser | Switching to tab: ${tab}`);
    this.currentTab = tab;
    const tabButtons = this.browserElement!.querySelectorAll('.dae-fb-tab-button');
    tabButtons.forEach(button => button.classList.toggle('active', (button as HTMLElement).dataset.tab === tab));
  
    this.updateBrowser();
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
    debug(`DaeFieldBrowser | Selecting field at index: ${index}`);
    const previousSelected = this.contentElement!.querySelector('.dae-fb-field-option.selected');
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
    debug("DaeFieldBrowser | Applying selected field");
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
      if (field.category === 'Hidden') {
        fieldMap.delete(field.key);
      } else if (fieldMap.has(field.key)) {
        const existingField = fieldMap.get(field.key)!;
        existingField.description = field.description;
        existingField.category = field.category;
        if (existingField.name === existingField.key && field.name != '') {
          existingField.name = field.name;
        }
      } else {
        fieldMap.set(field.key, field);
      }
    }
  
    return Array.from(fieldMap.values());
  }
}