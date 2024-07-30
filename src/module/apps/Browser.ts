import { log } from "../../dae";

export class TriniumEffectFlagBrowser {
  private fieldDataArray: any[] = [];
  private mergedFields: any[] | null = null;
  private selectedIndex: number = 0;
  private currentTab: string = 'All';
  private tabs: string[] = [];
  public browserElement: HTMLElement | null = null;
  private validFields: Record<string, any>;
  private currentInput: HTMLInputElement | null = null;
  private isFullBrowser: boolean = false;

  constructor(validFields: Record<string, any>) {
    this.validFields = validFields;
    log("TriniumEffectFlagBrowser | Initializing");
  }

  async init(): Promise<void> {
    log("TriniumEffectFlagBrowser | Fetching field data");
    const fieldData = await foundry.utils.fetchJsonWithTimeout('modules/dae/data/field-data.json');
    this.fieldDataArray = this.createFieldDataObjects(fieldData);
    log(`TriniumEffectFlagBrowser | Loaded ${this.fieldDataArray.length} field data objects`);
    this.mergedFields = this.mergeFields(this.getFieldObjects(), this.fieldDataArray);
    this.tabs = ['All', ...new Set(this.mergedFields.map(field => field.category || 'Other'))];
    this.createBrowserElement();
  }

private createBrowserElement(): void {
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
  this.createTabButtons();
  this.setupEventListeners();
  document.body.appendChild(this.browserElement);
  this.browserElement.style.display = 'none';
}

  private createTabButtons(): void {
    const tabsContainer = this.browserElement!.querySelector('.tefb-tabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = this.tabs.map(tab =>
        `<button class="tefb-tab-button" data-tab="${tab}">${tab}</button>`
      ).join('');
    }
  }

  public showBrowser(input: HTMLInputElement): void {
    this.currentInput = input;
    this.browserElement!.classList.toggle('tefb-full-browser', this.isFullBrowser);
    this.browserElement!.style.display = 'block';
    this.positionBrowser(input);
    this.updateBrowser(input.value);
    this.selectField(0);
  }

  private positionBrowser(input: HTMLInputElement): void {
    const rect = input.getBoundingClientRect();
    this.browserElement!.style.position = 'absolute';
    this.browserElement!.style.top = `${rect.bottom + window.scrollY}px`;
    this.browserElement!.style.left = `${rect.left + window.scrollX}px`;
    this.browserElement!.style.width = `${rect.width}px`;
  }

  public updateBrowser(query: string): void {
    const lowercaseQuery = query.toLowerCase();
    const filteredFields = this.mergedFields!.filter(field => 
      field.key.toLowerCase().includes(lowercaseQuery) ||
      (this.isFullBrowser && (
        (field.name && field.name.toLowerCase().includes(lowercaseQuery)) ||
        (field.description && field.description.toLowerCase().includes(lowercaseQuery))
      ))
    );
    this.populateFields(filteredFields);
    this.selectField(0);
  }

  private setupEventListeners(): void {
    this.browserElement!.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('click', this.handleOutsideClick.bind(this));
    
    const toggleButton = this.browserElement!.querySelector('.tefb-toggle-button');
    toggleButton!.addEventListener('click', this.toggleFullBrowser.bind(this));
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('tefb-tab-button')) {
      this.switchTab(target.dataset.tab as string);
    } else if (target.classList.contains('tefb-field-option')) {
      this.selectField(Array.from(target.parentElement!.children).indexOf(target));
      this.applySelectedField();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.browserElement!.style.display || this.browserElement!.style.display === 'none') return;

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

  private handleOutsideClick(event: MouseEvent): void {
    if (this.browserElement && 
        !this.browserElement.contains(event.target as Node) && 
        event.target !== this.currentInput) {
      this.hideBrowser();
    }
  }

  private toggleFullBrowser(): void {
    this.isFullBrowser = !this.isFullBrowser;
    this.browserElement!.classList.toggle('tefb-full-browser', this.isFullBrowser);
    this.currentInput!.focus();
    this.updateBrowser(this.currentInput!.value);
  }

  private hideBrowser(): void {
    this.browserElement!.style.display = 'none';
  }

  private populateFields(fields?: any[]): void {
    const content = this.browserElement!.querySelector('.tefb-content');
    if (!content) return;
  
    const fieldsToUse = fields || this.mergedFields;
    content.innerHTML = fieldsToUse.map(field => {
      const name = this.isFullBrowser && field.name !== field.key ? `<strong>${field.name}</strong> - ` : '';
      const description = this.isFullBrowser && field.description ? `<br><small>${field.description}</small>` : '';
      return `<div class="tefb-field-option" data-key="${field.key}">
                ${name}${field.key}${description}
              </div>`;
    }).join('');
  
    if (this.isFullBrowser) {
      this.switchTab(this.currentTab);
    }
  }

  private switchTab(tab: string): void {
    this.currentTab = tab;
    const tabButtons = this.browserElement!.querySelectorAll('.tefb-tab-button');
    tabButtons.forEach(button => button.classList.toggle('active', (button as HTMLElement).dataset.tab === tab));

    const options = this.browserElement!.querySelectorAll('.tefb-field-option');
    options.forEach(option => {
      const field = this.mergedFields!.find(f => f.key === (option as HTMLElement).dataset.key);
      (option as HTMLElement).style.display = (tab === 'All' || field?.category === tab) ? '' : 'none';
    });
    this.selectField(0);
  }

  private navigateFields(direction: number): void {
    const options = Array.from(this.browserElement!.querySelectorAll('.tefb-field-option'))
      .filter(option => (option as HTMLElement).style.display !== 'none');
    let newIndex = this.selectedIndex + direction;

    if (newIndex < 0) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 0;

    this.selectField(newIndex);
  }

  private navigateTabs(direction: number): void {
    const currentTabIndex = this.tabs.indexOf(this.currentTab);
    let newTabIndex = currentTabIndex + direction;

    if (newTabIndex < 0) newTabIndex = this.tabs.length - 1;
    if (newTabIndex >= this.tabs.length) newTabIndex = 0;

    this.switchTab(this.tabs[newTabIndex]);
  }

  private selectField(index: number): void {
    const options = Array.from(this.browserElement!.querySelectorAll('.tefb-field-option'))
      .filter(option => (option as HTMLElement).style.display !== 'none');
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
    const selectedOption = this.browserElement!.querySelector('.tefb-field-option.selected') as HTMLElement;
    if (selectedOption && this.currentInput) {
      const key = selectedOption.dataset.key;
      if (key) {
        this.currentInput.value = key;
        this.currentInput.dispatchEvent(new Event('change', { bubbles: true }));
        this.hideBrowser();
      }
    }
  }

  private getFieldObjects(): any[] {
    return Object.entries(this.validFields).map(([key, spec]) => ({
      key,
      name: spec || '',
      description: '',
      category: ''
    }));
  }

  private createFieldDataObjects(fieldData: any): any[] {
    return Object.entries(fieldData).flatMap(([category, fields]: [string, any]) =>
      Object.entries(fields).map(([key, { name, description }]: [string, any]) => ({
        key,
        name,
        description,
        category
      }))
    );
  }

  private mergeFields(fieldObjects: any[], newFieldObjects: any[]): any[] {
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