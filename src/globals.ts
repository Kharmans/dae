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
  }
}
