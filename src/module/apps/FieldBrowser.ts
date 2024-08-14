import { log, debug } from "../../dae";
import { DAEActiveEffectConfig } from "./DAEActiveEffectConfig";

interface FieldData {
  key: string;
  name: string;
  description: string;
  category: string;
}

export class DAEFieldBrowser {
  private static knownFieldData: Record<string, { category: string }> = {};
  private static fieldDataInitialized: boolean = false;

  private static isFullBrowser: boolean = false;
  private static showDescriptions: boolean = true;

  public enrichedFields: FieldData[] = [];
  private filteredFields: FieldData[] = [];
  private selectedIndex: number = 0;
  private currentTab: string = 'All';
  private tabs: string[] = [];
  public browserElement: HTMLElement | null = null;
  private validFields: Record<string, any>;
  private currentInput: HTMLInputElement;
  private contentElement: HTMLElement | null = null;
  private effectConfig: DAEActiveEffectConfig;
  public debouncedUpdateBrowser: () => void;
  private memoizedFilterFields: (query: string, tab: string) => FieldData[];


  constructor(validFields: Record<string, any>, effectConfig: DAEActiveEffectConfig) {
    this.validFields = validFields;
    this.effectConfig = effectConfig;
    log("DaeFieldBrowser | Initializing");

    this.debouncedUpdateBrowser = foundry.utils.debounce(() => {
      this.updateBrowser();
    }, 50);
    this.memoizedFilterFields = this.memoize(this.filterFields.bind(this));
    
  }

  private memoize<T extends (...args: any[]) => any>(fn: T, maxSize = 100) {
    const cache = new Map<string, ReturnType<T>>();
    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = `${args.join('|')}|${DAEFieldBrowser.isFullBrowser}|${DAEFieldBrowser.showDescriptions}`;
      if (cache.has(key)) return cache.get(key)!;
      const result = fn(...args);
      if (cache.size >= maxSize) cache.delete(cache.keys().next().value);
      return cache.set(key, result).get(key)!;
    }) as T;
  }

  private filterFields(query: string, tab: string): FieldData[] {
    const lowercaseQuery = query.toLowerCase();
    const isAllTab = tab === 'All';
    
    return this.enrichedFields.filter(field => {
      if (DAEFieldBrowser.isFullBrowser && !isAllTab && field.category !== tab) {
        return false;
      }
      return field.key.toLowerCase().includes(lowercaseQuery) ||
             field.name.toLowerCase().includes(lowercaseQuery) ||
             (DAEFieldBrowser.showDescriptions && 
              field.description && 
              field.description.toLowerCase().includes(lowercaseQuery));
    });
  }

    async init(): Promise<void> {
    log("DAEFieldBrowser | Fetching field data");
    try {
      if (!DAEFieldBrowser.fieldDataInitialized) {
        // fetch data to save known category-field pairings.
        const fieldData = await foundry.utils.fetchJsonWithTimeout('modules/dae/data/field-data.json');
        
        for (const [category, keys] of Object.entries(fieldData as Record<string, string[]>)) {
          for (const key of keys) {
            DAEFieldBrowser.knownFieldData[key] = { category };
          }
        }
        
        DAEFieldBrowser.fieldDataInitialized = true;
      }

      //TODO cache this to avoid rebuilding if a new browser is opened with the same validFields
      this.enrichedFields = this.enrichValidFields();
      this.filteredFields = this.enrichedFields;

      this.tabs = ['All', ...new Set(this.enrichedFields.map(field => field.category))];

      this.effectConfig.updateFieldInfo();
    } catch (error) {
      error("DAEFieldBrowser | Failed to initialize:", error);
    }
  }

  private enrichValidFields(): FieldData[] {
    return Object.entries(this.validFields)
      .map(([key, name]): FieldData => {
        const nameLocalizationPath = `dae.fieldData.${key}.name`;
        const descriptionLocalizationPath = `dae.fieldData.${key}.description`;
        
        const localizedName = game.i18n.localize(nameLocalizationPath);
        const localizedDescription = game.i18n.localize(descriptionLocalizationPath);

        const finalName = 
        // If the field already has a name, use it, otherwise attempt to localize or use the key itself
        // Logic looks a bit weird because DAE already sets the value of the validFields kvp to its key if missing.
          (typeof name === 'string' && name !== '' && name !== key) ? name :
          (localizedName !== nameLocalizationPath ? localizedName : key);

        // For descriptions, simply check if the localization string is present.
        const finalDescription = 
        localizedDescription !== descriptionLocalizationPath ? localizedDescription : '';
        
        return {
          key,
          name: finalName,
          description: finalDescription,
          category: DAEFieldBrowser.knownFieldData[key]?.category || 'Other'
        };
      })
      .filter(field => field.category !== 'Hidden');
  }

  private createBrowser(): void {
    if (this.browserElement) return;
    debug("DaeFieldBrowser | Creating browser element");
    
    const fullBrowserClass = DAEFieldBrowser.isFullBrowser ? 'active' : '';
    const descriptionsClass = DAEFieldBrowser.showDescriptions ? 'active' : '';
    const browserClass = DAEFieldBrowser.isFullBrowser ? 'dae-fb-browser dae-fb-full-browser' : 'dae-fb-browser';
  
    this.browserElement = document.createElement('div');
    this.browserElement.id = 'dae-fb-browser';
    this.browserElement.className = browserClass;
    this.browserElement.innerHTML = `
      <div class="dae-fb-tabs"></div>
      <div class="dae-fb-content"></div>
      <div class="dae-fb-toggle-container">
        <button class="dae-fb-toggle-button ${fullBrowserClass}" data-action="toggle-full" title="Switch between compact and full browser views">
          <i class="fas fa-expand-arrows-alt"></i> Toggle Full Browser
        </button>
        <button class="dae-fb-toggle-button ${descriptionsClass}" data-action="toggle-descriptions" title="Toggle field descriptions">
          <i class="fas fa-align-left"></i> Toggle Descriptions
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
        button.dataset.action = 'switch-tab';
        button.dataset.tab = tab;
        button.textContent = game.i18n.localize(`dae.fieldData.fieldCategories.${tab}`);
        fragment.appendChild(button);
      });
      tabsContainer.appendChild(fragment);
    }
  }

  public setInput(input: HTMLInputElement): void {
    debug("DAEFieldBrowser | Setting input");
    this.currentInput = input;
  }

  private positionBrowser(): void {
    const rect = this.currentInput.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
  
    let maxBrowserWidth = DAEFieldBrowser.isFullBrowser ? 880 : 400;
    let maxContentHeight = DAEFieldBrowser.isFullBrowser ? 700 : 400;

    // if (!DAEFieldBrowser.isFullBrowser && DAEFieldBrowser.showDescriptions) {
    //   maxBrowserWidth += 200;
    //   maxContentHeight += 200;
    // }
  
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
    }
    
    if (this.browserElement!.style.display === 'none') {
      this.browserElement!.style.display = 'block';
    }
    
    this.browserElement!.classList.toggle('dae-fb-full-browser', DAEFieldBrowser.isFullBrowser);
    
    debug(`DaeFieldBrowser | Updating browser with query: ${this.currentInput.value}`);
    this.positionBrowser();
    this.applyFilters();
    this.renderFields();
    this.selectField(0);
    this.currentInput.focus();
  }

  private applyFilters(): void {
    this.filteredFields = this.memoizedFilterFields(this.currentInput.value, this.currentTab);
  }

  private renderFields(): void {
    if (!this.contentElement) return;
    debug("DaeFieldBrowser | Rendering fields");

    const fragment = document.createDocumentFragment();
    
    this.filteredFields.forEach((field, index) => {
      const fieldElement = this.createFieldElement(field, index);
      fragment.appendChild(fieldElement);
    });

    this.contentElement.innerHTML = '';
    this.contentElement.appendChild(fragment);
  }

  private createFieldElement(field: FieldData, index: number): HTMLElement {
    const fieldElement = document.createElement('div');
    fieldElement.className = `dae-fb-field-option${index === this.selectedIndex ? ' selected' : ''}`;
    fieldElement.dataset.action = 'select-field';
    fieldElement.dataset.key = field.key;
  
    if (DAEFieldBrowser.isFullBrowser) {
      fieldElement.innerHTML = `<strong>${field.name}</strong> - ${field.key}${
        DAEFieldBrowser.showDescriptions && field.description 
          ? `<br><small>${field.description}</small>` 
          : ''
      }`;
    } else {
      fieldElement.textContent = field.key;
      if (DAEFieldBrowser.showDescriptions && field.description) {
        fieldElement.insertAdjacentHTML('beforeend', `<br><small>${field.description}</small>`);
      }
    }
  
    return fieldElement;
  }

  private setupEventListeners(): void {
    debug("DaeFieldBrowser | Setting up event listeners");

    document.addEventListener('click', this.handleDocumentClick.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.browserElement!.addEventListener('click', this.handleBrowserClick.bind(this));
  }

  private handleBrowserClick(event: MouseEvent): void {
    debug("DaeFieldBrowser | Browser clicked");
    const target = event.target as HTMLElement;
    const actionElement = target.closest('[data-action]') as HTMLElement | null;
    const action = actionElement?.dataset.action;
  
    switch (action) {
      case 'toggle-full':
        DAEFieldBrowser.isFullBrowser = !DAEFieldBrowser.isFullBrowser;
        this.browserElement!.classList.toggle('dae-fb-full-browser', DAEFieldBrowser.isFullBrowser);
        actionElement?.classList.toggle('active', DAEFieldBrowser.isFullBrowser);
        this.switchTab('All');
        this.positionBrowser();
        break;
      case 'toggle-descriptions':
        DAEFieldBrowser.showDescriptions = !DAEFieldBrowser.showDescriptions;
        actionElement?.classList.toggle('active', DAEFieldBrowser.showDescriptions);
        this.updateBrowser();
        break;
      case 'select-field':
        const fieldOption = target.closest('.dae-fb-field-option') as HTMLElement;
        if (fieldOption) {
          const index = Array.from(this.contentElement!.children).indexOf(fieldOption);
          this.selectField(index);
          this.applySelectedField();
        }
        break;
      case 'switch-tab':
        const tab = actionElement?.dataset.tab;
        if (tab) {
          this.switchTab(tab);
        }
        break;
      default:
        // Do nothing for unhandled actions
        break;
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
      case 'Tab':
        this.hideBrowser();
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
    console.log(selectedField, this.currentInput);
    if (selectedField && this.currentInput) {
      this.currentInput.value = selectedField.key;
      this.currentInput.blur();
      this.hideBrowser();
      this.effectConfig.onFieldSelected();
    }
  }

  getFieldInfo(key: string): FieldData {
    return this.enrichedFields?.find(f => f.key === key) || {
      key: key,
      name: key,
      description: "",
      category: ""
    };
  }
}