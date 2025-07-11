import { DAESystemDND5E } from "./module/Systems/DAEdnd5e";
import { DAESystem } from "./module/Systems/DAESystem";

export type TokenOrDocument = foundry.canvas.placeables.Token.Implementation | TokenDocument.Implementation;

// Declaration Merging for DAE-specific stuff
declare module "fvtt-types/configuration" {
  interface AssumeHookRan {
    init: never;
  }
  namespace Hooks {
    interface HookConfig {
      "DAE.setupComplete": () => void;
      "dae.addFieldMappings": (fieldMappings: unknown) => void;
      "dae.addSpecialDurations": (specialDurations: unknown) => void;
      "dae.modifyBaseValues": (specKey: unknown, baseValues: Record<string, unknown>, charSpec: unknown) => void;
      "dae.modifyDerivedSpecs": (specKey: unknown, derivedSpecs: Record<string, unknown>, charSpec: unknown) => void;
      "dae.modifySpecials": (speKey: unknown, specials: Record<string, unknown>, charSpec: unknown) => void;
      "dae.setFieldData": (fieldData: unknown) => void;
      "dae.setupComplete": () => void;
      "dae.settingsChanged": () => void;

      // Other module hooks that might exist
      "spotlightOmnisearch.indexBuilt": (index: unknown[]) => void;
      "dfreds-convenient-effects.createEffects": () => void;
      "tidy5e-sheet.ready": (api: {
        registerItemHeaderControls?: (unknown) => void
      }) => void;
      "babel.ready": () => void;
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
        autoCreated?: boolean;
        disableIncapacitated?: boolean;
        dontApply?: boolean;
        durationExpression?: string;
        enableCondition?: string;
        itemData?: Item.InitializedData;
        itemUuid?: string;
        selfTarget?: boolean;
        selfTargetAlways?: boolean;
        specialDuration?: string | string[];
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
    Item: {
      dae?: {
        macro?: Macro.CreateData;
      }
      itemacro?: {
        macro?: Macro.CreateData;
      }
    }
    Macro: {
      dnd5e?: {
        itemMacro?: boolean;
      }
    }
  }
  interface SettingConfig {
    "dae.DependentConditions": boolean;
    "dae.noDupDamageMacro": boolean;
    "dae.expireRealTime": boolean;
    "dae.showInline": boolean;
    "dae.DAETitleBar": boolean;
    "dae.DIMETitleBar": boolean;
    "dae.DIMESyncItemacro": boolean;
    "dae.DAEColorTitleBar": boolean;
    "dae.DAENoTitleText": boolean;
    "dae.DAEAddHalfHealthEffect": boolean;
    "dae.DAEUntestedSystems": boolean;
    "dae.ZZDebug": "none" | "warn" | "debug" | "all";
    "dae.disableEffects": boolean;
    "dae.maxShortDuration": number;

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
  interface CONFIG {
    DAE: {
      systemClass: typeof DAESystem;
    }
    // Temp, until we use dnd5e-types
    DND5E: {
      abilities: Record<string, {
        label: string;
      }>;
      abilityConsumptionTypes: Record<string, string>;
      actorSizes: Record<string, {
        label: string;
      }>;
      armorClasses: Record<string, {
        label: string
      }>;
      armorProficiencies: Record<string, string>;
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
      conditionEffects: Record<string, Set<string>>;
      conditionTypes: Record<string, {
        name: string;
      }>;
      // This one's added by midi
      customDamageResistanceTypes: Record<string, string>;
      damageTypes: Record<string, {
        label: string;
        isPhysical: boolean;
      }>;
      healingTypes: Record<string, {
        label: string;
      }>;
      itemActionTypes: Record<string, string>;
      itemProperties: Record<string, {
        label: string;
        isPhysical: boolean;
      }>;
      languages: Record<string, Record<string, unknown>>;
      limitedUsePeriods: Record<string, Record<string, string>>;
      movementTypes: Record<string, string>;
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
      toolProficiencies: Record<string, string>;
      tools: Record<string, {
        ability: string;
        id: string;
      }>;
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
