export {}
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
        durationExpression?: string;
        enableCondition?: string;
        itemData?: Item.InitializedData;
        itemUuid?: string;
        specialDuration?: string | string[];
        stackable?: "noneName" | "noneNameOnly" | "none" | "multi" | "count" | "countDeleteDecrement";
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
    }
    Item: {
      dae?: {
        macro?: Macro.CreateData;
      },
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
  }
}
