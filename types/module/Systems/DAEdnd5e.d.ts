import { BaseValuesInner } from "../dae.js";
import { ValidSpec } from "./DAESystem.js";
export declare class DAESystemDND5E extends CONFIG.DAE.systemClass {
    static traitList: Record<string, string>;
    static languageList: Record<string, string>;
    static conditionList: Record<string, string>;
    static bypassesList: Record<string, string>;
    static customDamageResistanceList: Record<string, string>;
    static armorClassCalcList: Record<string, string>;
    static toolProfList: Record<string, string>;
    static armorProfList: Record<string, string>;
    static weaponProfList: Record<string, string>;
    static get systemConfig(): {
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
    static getItemSpecs(): ItemSpecs;
    static modifyBaseValues(actorType: string, baseValues: BaseValuesInner | undefined, characterSpec: any): void;
    static modifySpecials(actorType: string, specials: BaseValuesInner, characterSpec: any): void;
    static modifyValidSpec(spec: string, validSpec: ValidSpec): ValidSpec;
    static initActions(): void;
    static setupActions(): void;
    static readyActions(): void;
    static initSystemData(): void;
    static effectDisabled(actor: any, effect: any, itemData?: null): any;
    static enumerateLanguages(systemLanguages: Record<string, {
        label?: string;
        children?: Record<string, Record<string, unknown>>;
    }>): any;
    static configureLists(): void;
    static getOptionsForSpec(spec?: ActiveEffect.ChangeData): Record<string, string> | undefined;
    static editConfig(): Promise<void>;
    static attackDamageBonusEval(bonusString: string, actor: Actor.Implementation): string;
    static daeCustomEffect(actor: Actor.Implementation, change: ActiveEffect.ChangeData & {
        count?: number;
        effect: ActiveEffect.Implementation;
    }, current: any, delta: unknown, changes: unknown): boolean | undefined;
    static getRollDataFunc(): typeof getRollData;
}
declare function getRollData(this: Actor.Implementation, wrapped: any, ...args: any[]): import("fvtt-types/utils").AnyMutableObject;
export declare function getActorItemForEffect(effect: ActiveEffect.Implementation): Item.Implementation | undefined;
type ItemSpecs = Record<string, {
    allSpecsObj: Record<string, ValidSpec>;
    baseSpecsObj: Record<string, ValidSpec>;
    derivedSpecsObj: Record<string, ValidSpec>;
    allSpecs: ValidSpec[];
    baseSpecs: ValidSpec[];
    derivedSpecs: ValidSpec[];
    allSpecKeys: string[];
    baseSpecKeys: string[];
    derivedSpecKeys: string[];
    excludeKeys?: string[];
}>;
export {};
