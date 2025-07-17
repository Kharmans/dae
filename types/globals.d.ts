import { BaseValuesInner } from "./module/dae";
import { DAESystem, ValidSpec } from "./module/Systems/DAESystem";
export type TokenOrDocument = foundry.canvas.placeables.Token.Implementation | TokenDocument.Implementation;
declare module "fvtt-types/configuration" {
    interface AssumeHookRan {
        init: never;
    }
    namespace Hooks {
        interface HookConfig {
            "DAE.setupComplete": () => void;
            "dae.addFieldMappings": (fieldMappings: Record<string, string>) => void;
            "dae.addSpecialDurations": (specialDurations: unknown) => void;
            "dae.modifyBaseValues": (specKey: string, baseValues: BaseValuesInner, charSpec: unknown) => void;
            "dae.modifyDerivedSpecs": (specKey: string, derivedSpecs: ValidSpec[], charSpec: unknown) => void;
            "dae.modifySpecials": (speKey: string, specials: BaseValuesInner, charSpec: unknown) => void;
            "dae.setFieldData": (fieldData: unknown) => void;
            "dae.setupComplete": () => void;
            "dae.settingsChanged": () => void;
            "spotlightOmnisearch.indexBuilt": (index: unknown[]) => void;
            "dfreds-convenient-effects.createEffects": () => void;
            "tidy5e-sheet.ready": (api: {
                registerItemHeaderControls?: (unknown: any) => void;
            }) => void;
            "babel.ready": () => void;
        }
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
                itemMacro?: string;
                itemUuid?: string;
                itemsToDelete?: string[];
                selfTarget?: boolean;
                selfTargetAlways?: boolean;
                showIcon?: boolean;
                specialDuration?: string | string[];
                stackable?: "noneName" | "noneNameOnly" | "none" | "multi" | "count" | "countDeleteDecrement";
                stacks?: number;
                transfer?: boolean;
            };
            dnd5e: {
                halfHealth: boolean;
            };
        };
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
            };
            "midi-qol"?: {
                advantage?: MidiAdvantageFlag;
                disadvantage?: MidiAdvantageFlag;
            };
        };
        Item: {
            dae?: {
                macro?: Macro.CreateData;
            };
            itemacro?: {
                macro?: Macro.CreateData;
            };
        };
        Macro: {
            dae?: {
                version?: string;
            };
            dnd5e?: {
                itemMacro?: boolean;
            };
        };
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
        "ATL.presets": {
            name: string;
            light: Record<string, unknown>;
            id: string;
        }[];
        "dnd5e.honorScore": boolean;
        "dnd5e.sanityScore": boolean;
    }
}
declare global {
    interface CONFIG {
        DAE: {
            systemClass: typeof DAESystem;
        };
        DND5E: {
            abilities: Record<string, {
                label: string;
            }>;
            abilityConsumptionTypes: Record<string, string>;
            activityActivationTypes: Record<string, {
                label: string;
            }>;
            actorSizes: Record<string, {
                label: string;
            }>;
            areaTargetTypes: Record<string, {
                label: string;
            }>;
            armorClasses: Record<string, {
                label: string;
            }>;
            armorProficiencies: Record<string, string>;
            attackClassifications: Record<string, {
                label: string;
            }>;
            attackTypes: Record<string, {
                label: string;
            }>;
            attunementTypes: Record<string, string>;
            characterFlags: Record<string, {
                name: string;
                hint: string;
                section: string;
                type: BooleanConstructor | StringConstructor | NumberConstructor;
                placeholder: string;
                abilities?: string[];
                choices?: Record<string, string>;
                skills?: string[];
            }>;
            creatureTypes: Record<string, {
                label: string;
            }>;
            conditionEffects: Record<string, Set<string>>;
            conditionTypes: Record<string, {
                name: string;
            }>;
            customDamageResistanceTypes: Record<string, string>;
            damageScalingModes: Record<string, {
                label: string;
            }>;
            damageTypes: Record<string, {
                label: string;
                isPhysical: boolean;
            }>;
            distanceUnits: Record<string, {
                label: string;
            }>;
            healingTypes: Record<string, {
                label: string;
            }>;
            individualTargetTypes: Record<string, {
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
            movementUnits: Record<string, {
                label: string;
            }>;
            skills: Record<string, {
                label: string;
                ability: string;
            }>;
            sourcePacks: {
                BACKGROUNDS: string;
                CLASSES: string;
                ITEMS: string;
                RACES: string;
            };
            targetTypes: Record<string, string>;
            timePeriods: Record<string, string>;
            timeUnits: Record<string, {
                label: string;
            }>;
            toolProficiencies: Record<string, string>;
            tools: Record<string, {
                ability: string;
                id: string;
            }>;
            transformation: {
                presets: Record<string, {
                    label: string;
                }>;
            };
            vehicleTypes: Record<string, string>;
            weaponProficiencies: Record<string, string>;
        };
    }
}
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
    };
};
export {};
