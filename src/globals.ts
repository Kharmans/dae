import API from "./module/API/api";
import { BaseValuesInner } from "./module/dae";
import { ValidSpec } from "./module/Systems/DAESystem";

export type TokenOrDocument = foundry.canvas.placeables.Token.Implementation | TokenDocument.Implementation;

// Declaration Merging for DAE-specific stuff
declare module "fvtt-types/configuration" {
  interface AssumeHookRan {
    init: never;
  }
  namespace Hooks {
    interface HookConfig {
      // Render hooks for coloring DAE/DIME header buttons
      "renderItemSheetV2": (app: foundry.applications.sheets.ItemSheetV2, element: HTMLElement, ...args: any[]) => void;
      "renderActorSheetV2": (app: foundry.applications.sheets.ActorSheetV2, element: HTMLElement, ...args: any[]) => void;
      "dae.addAutoFields": (addAutoFields: typeof API.addAutoFields, fields: {
        BooleanFormulaField: typeof import("./module/apps/DAEActiveEffectConfig.js").BooleanFormulaField;
        FormulaField: (new (...args: any[]) => foundry.data.fields.StringField) | undefined;
        NumberField: typeof foundry.data.fields.NumberField;
        StringField: typeof foundry.data.fields.StringField;
      }) => void;
      "dae.ready": (api: typeof API) => void;
      /** An effect started or stopped being suppressed. Suppression is derived state with no
       *  document event of its own, so DAE detects the transition during data preparation. */
      "dae.suppressionChanged": (effect: ActiveEffect.Implementation, suppressed: boolean) => void;
      "dae.addFieldMappings": (fieldMappings: Record<string, string | { key: string, value?: string, mode?: number | string }>) => void;
      "dae.addSpecialDurations": (specialDurations: unknown) => void;
      "dae.modifyBaseValues": (specKey: string, baseValues: BaseValuesInner, charSpec: unknown) => void;
      "dae.modifyDerivedSpecs": (specKey: string, derivedSpecs: ValidSpec[], charSpec: unknown) => void;
      "dae.modifySpecials": (speKey: string, specials: BaseValuesInner, charSpec: unknown) => void;
      "dae.modifySpecs": (specKey: string, allSpecsObj: Record<string, ValidSpec>) => void;
      "dae.setFieldData": (fieldData: unknown) => void;
      "dae.setupComplete": (api: typeof API) => void;
      "dae.settingsChanged": () => void;

      // Other module hooks that might exist
      "spotlightOmnisearch.indexBuilt": (index: unknown[]) => void;
      "dfreds-convenient-effects.createEffects": () => void;
      "tidy5e-sheet.ready": (api: {
        registerItemHeaderControls?: (controls: unknown) => void,
        registerActivityHeaderControls?: (controls: unknown) => void
      }) => void;
      "babel.ready": () => void;
      "dnd5e.getUnknownAttributeLabel": (attr: string, options: { actor?: Actor.Implementation, item?: Item.Implementation, label?: string }) => void;
      // dnd5e's per-change editor; DAE attaches the field browser to its key input.
      "renderEffectChangeConfig": (app: foundry.applications.api.ApplicationV2, element: HTMLElement,
        context?: object, options?: object) => void;
      "macro-autocomplete.ready": (api: {
        tree: Record<string, any>,
        objectToCompletions: (obj: any, maxDepth?: number) => Record<string, any>,
        mergeCompletions: (target: any, additions: Record<string, any>) => void,
        rebuildSignatureMap: () => void,
        schemaToCompletions: (schema: any) => Record<string, any>,
        classToCompletions: (cls: any) => { staticChildren: Record<string, any>, instanceChildren: Record<string, any>, constructorDetail?: string },
        fieldToCompletionNode: (field: any, name: string) => any,
        valueToCompletionEntry: (value: any, maxDepth?: number) => any,
        setContextCompletions: (element: HTMLElement, completions: Record<string, any>) => void,
        clearContextCompletions: (element: HTMLElement) => void,
      }) => void;
    }
    // Temporary, 'til we try dnd5e-types
    interface ApplicationV2Config {
      ItemSheet5e: foundry.applications.sheets.ItemSheetV2;
    }
    interface ApplicationConfig {
      ActivitySheet: any;
    }
  }
  interface FlagConfig {
    ActiveEffect: {
      dae?: {
        activity?: string;
        activityMacro?: string;
        /** Flags for the conditions this effect's statuses cause, keyed by status id (DAE's Dependent Conditions) */
        conditionFlags?: Record<string, object>;
        /** Values of the moment a dnd5e-mode effect was applied, supplied to its references when its target is prepared */
        applicationData?: { spellLevel?: number; scaling?: number; damage?: number; critical?: boolean; fumble?: boolean; itemCardUuid?: string | null; actorUuid?: string | null; activityId?: string; activity?: object };
        /** The effect's workflow references were filled when DAE applied it (fillWorkflowRefs) */
        workflowRefs?: boolean;
        autoCreated?: boolean;
        disableIncapacitated?: boolean;
        dontApply?: boolean;
        durationExpression?: string;
        enableCondition?: string;
        expiryMode?: "default" | "delete" | "suppress";
        itemData?: Item.InitializedData;
        itemMacro?: string;
        itemUuid?: string;
        itemsToDelete?: string[];
        /** How DAE fills `@` references when applying the effect; unset or "default" follows the world setting */
        applicationMode?: "default" | "dnd5e" | "legacy";
        /** A transfer effect's inline roll totals, rolled when it reached its actor (see lib/inlineRolls.ts) */
        inlineRolls?: { key: string, value: string, totals: number[] }[];
        /** Ids of max HP changes that also raise current HP when applied (see lib/currentHp.ts) */
        raiseCurrentHp?: string[];
        /** Disabled because its enableCondition is false (expiry mode "suppress"); enabled again when it holds */
        disabledByCondition?: boolean;
        /** Set when the effect was saved through the DAE editor: every change's `phase` is explicitly
         *  authored, so `change.phase` is authoritative at apply time (even an explicit "initial"). */
        phaseStamped?: boolean;
        selfTarget?: boolean;
        selfTargetAlways?: boolean;
        /** @deprecated Use native ActiveEffect showIcon field instead */
        showIcon?: boolean;
        specialDuration?: string[];
        stackable?: "noneName" | "noneNameOnly" | "none" | "multi" | "count" | "countDeleteDecrement";
        stacks?: number;
        transfer?: boolean;
      }
      // Temp, while no 5e-types
      dnd5e: {
        halfHealth: boolean;
      }
    }
    Actor: {
      dae?: {
        /** Current HP raised by max HP changes, by effect and change id (see lib/currentHp.ts) */
        hpGranted?: Record<string, number>;
        onUpdateTarget?: {
          flagName: string;
          macroName: string;
          origin: string;
          sourceTokenUuid: string;
          args: string[];
          targetTokenUuid: string;
          filter: string;
          sourceActorUuid: string;
        }[];
      }
      // Until midi has its own types exported that we can rely on, maybe
      "midi-qol"?: {
        advantage?: MidiAdvantageFlag;
        disadvantage?: MidiAdvantageFlag
      }
    }
    ChatMessage: {
      dae?: {
        /** The card's item, stored when it was deleted while effects it applied remain (see lib/effectSource.ts) */
        itemSnapshot?: Item.Source;
      }
    }
    Item: {
      dae?: {
        macro?: Macro.CreateData;
      }
      itemacro?: {
        macro?: Macro.CreateData;
      }
    }
    Macro: {
      dae?: {
        version?: string; // TODO: probably remove this if/when `createDAEMacros` removed
      }
      dnd5e?: {
        itemMacro?: boolean;
      }
    }
  }
  interface SettingConfig {
    "dae.DependentConditions": boolean;
    "dae.noDupDamageMacro": boolean;
    "dae.DAETitleBar": boolean;
    "dae.DIMETitleBar": boolean;
    "dae.DAEColorTitleBar": boolean;
    "dae.DAEAddHalfHealthEffect": boolean;
    "dae.ZZDebug": "none" | "warn" | "debug" | "all";
    "dae.disableEffects": boolean;
    "dae.initMacrosOnLoad": boolean;
    "dae.expireRoundEffectsOnCombatEnd": boolean;
    "dae.expiryAction": string;
    "dae.defaultApplicationMode": "dnd5e" | "legacy";
    "dae.coreExpiryAction": string;
    "dae.enableAutoMigration": boolean;
    "dae.migrationVersion": string;

    // Other module settings
    "ATL.presets": {
      name: string;
      light: Record<string, unknown>;
      id: string;
    }[]

    // Temp until dnd5e-types
    "dnd5e.honorScore": boolean;
    "dnd5e.sanityScore": boolean;
  }
  // More precise `getProperty`
  // namespace foundry.utils {
  //   export function getProperty<T extends object, K extends DotKeys<T>>(object: T, key: K): GetProperty<T, K>;
  // }
}

declare global {
  // v14 data field operators, not yet in fvtt-types. `{ key: new ForcedDeletion() }` replaces the
  // `{ "-=key": null }` deletion syntax that v14 deprecates.
  namespace foundry.data.operators {
    class ForcedDeletion {
      constructor(value?: unknown);
    }
  }

  // v14 statics not yet in fvtt-types. Reach them with
  // `ActiveEffect as unknown as ActiveEffectStatic` rather than a suppression.
  interface ActiveEffectStatic {
    CHANGE_TYPES: Record<string, { label: string; defaultPriority?: number }>;
    CHANGE_PHASES: Record<string, { label?: string; hint?: string }>;
  }

  // v14's foundry.applications.ux.Autocomplete, not yet in fvtt-types. Reach it with
  // `foundry.applications.ux as unknown as { Autocomplete: AutocompleteStatic }`.
  interface AutocompleteEntry { identifier: string; label: string | Node; disabled?: boolean }
  interface AutocompleteMenu {
    readonly element: HTMLMenuElement | null;
    activate(target: HTMLElement, entries: AutocompleteEntry[],
      options?: { prefix?: string; position?: { top?: number; left?: number } }): void;
    select(increment?: number): void;
    commit(): void;
    dismiss(): void;
  }
  interface AutocompleteStatic {
    implementation: new (options: { onSelect?: (identifier: string, label: string,
      options: { prefix?: string }) => void }) => AutocompleteMenu;
  }

  interface CONFIG {
    // Temp, until we use dnd5e-types
    DND5E: {
      abilities: Record<string, {
        label: string;
      }>;
      abilityConsumptionTypes: Record<string, string>;
      activityActivationTypes: Record<string, {label: string}>;
      actorSizes: Record<string, {
        label: string;
      }>;
      areaTargetTypes: Record<string, {label: string}>;
      armorClasses: Record<string, {
        label: string
      }>;
      armorProficiencies: Record<string, string>;
      attackClassifications: Record<string, {label: string}>;
      attackTypes: Record<string, {label: string}>;
      attunementTypes: Record<string, string>;
      characterFlags: Record<string, {
        name: string;
        hint: string;
        section: string;
        type: BooleanConstructor | StringConstructor | NumberConstructor;
        placeholder: string
        abilities?: string[];
        choices?: Record<string, string>;
        skills?: string[];
      }>;
      creatureTypes: Record<string, {label: string}>;
      conditionEffects: Record<string, Set<string>>;
      conditionTypes: Record<string, {
        name: string;
      }>;
      // This one's added by midi
      customDamageResistanceTypes: Record<string, string>;
      damageScalingModes: Record<string, {label: string}>;
      damageTypes: Record<string, {
        label: string;
        isPhysical: boolean;
      }>;
      distanceUnits: Record<string, {label: string}>;
      healingTypes: Record<string, {
        label: string;
      }>;
      individualTargetTypes: Record<string, {label: string}>;
      itemActionTypes: Record<string, string>;
      itemProperties: Record<string, {
        label: string;
        isPhysical: boolean;
      }>;
      languages: Record<string, Record<string, unknown>>;
      limitedUsePeriods: Record<string, Record<string, string>>;
      movementTypes: Record<string, string>;
      movementUnits: Record<string, {label: string}>;
      skills: Record<string, {
        label: string;
        ability: string;
      }>;
      sourcePacks: {
        BACKGROUNDS: string;
        CLASSES: string;
        ITEMS: string;
        RACES: string;
      }
      targetTypes: Record<string, string>;
      timePeriods: Record<string, string>;
      timeUnits: Record<string, {label: string}>;
      toolProficiencies: Record<string, string>;
      tools: Record<string, {
        ability: string;
        id: string;
      }>;
      transformation: {
        presets: Record<string, {label: string}>;
      }
      vehicleTypes: Record<string, string>;
      weaponProficiencies: Record<string, string>;
    }
  }
}

// Incomplete typing
type MidiAdvantageFlag = {
  all?: boolean;
  ability?: {
    all?: boolean;
    check?: {
      all?: boolean;
    };
    save?: {
      all?: boolean;
    };
  };
  skill?: {
    all?: boolean;
  }
};
