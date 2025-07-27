import { AnyMutableObject, AnyObject } from "fvtt-types/utils";
import { DoEffectsOptions, BaseValuesInner } from "../dae.js";
export declare let wildcardEffects: RegExp[];
export declare let _characterSpec: {
    data: unknown;
    flags: unknown;
};
export type FieldType = foundry.data.fields.DataField | "number" | "string" | "boolean" | "object" | "Array" | "Set" | 0;
export type Specs = {
    allSpecs: ValidSpec[];
    allSpecsObj: Record<string, ValidSpec>;
    baseSpecs: ValidSpec[];
    baseSpecsObj: Record<string, ValidSpec>;
    derivedSpecs: ValidSpec[];
    derivedSpecsObj: Record<string, ValidSpec>;
};
export declare class ValidSpec {
    static actorSpecs: Record<string, Specs>;
    static itemSpecs: Record<string, Specs>;
    _fieldSpec: string;
    get fieldSpec(): string;
    set fieldSpec(spec: string);
    _fieldType: FieldType;
    get fieldType(): FieldType;
    set fieldType(value: FieldType);
    _label: string;
    get label(): string;
    set label(label: string);
    _description: string;
    get description(): string;
    set description(description: string);
    _forcedMode: number;
    get forcedMode(): number;
    set forcedMode(mode: number);
    _options: Record<string, string> | undefined;
    get options(): Record<string, string> | undefined;
    set options(options: Record<string, string> | undefined);
    constructor(fs: string, sv: FieldType, forcedMode?: number, label?: string, description?: string, options?: Record<string, string>);
    static createValidMods(): void;
    static localizeSpecs(): void;
}
declare function getRollData(wrapped: any, ...args: any[]): AnyMutableObject;
export declare class DAESystem {
    static spellAttacks: string[];
    static weaponAttacks: string[];
    static attackTypes: string[];
    static bonusSelectors: Record<string, {
        attacks: string[];
        selector: string;
        replaceList?: string[];
    }>;
    static daeActionTypeKeys: string[];
    static detectionModeList: Record<string, string>;
    static fieldMappings: Record<string, string>;
    static get systemConfig(): any;
    static getActorDataModelFields(actorType: string): Record<string, foundry.data.fields.DataField<any>>;
    static getRollDataFunc(): typeof getRollData;
    /**
     * accepts a string field specification, e.g. system.traits.languages.value. Used extensively in ConfigPanel.ts
     * return an object or false.
     * Keys are valid options for the field specification and the value is the user facing text for that option
     * e.g. {common: "Common"}
     * */
    static getOptionsForSpec(specification?: ActiveEffect.ChangeData): Record<string, string> | undefined;
    static configureLists(): void;
    static editConfig(): Promise<void>;
    static modifyBaseValues(actorType: string, baseValues: {}, characterSpec: any): void;
    static modifySpecials(actorType: string, specials: BaseValuesInner, characterSpec: any): void;
    static modifyDerivedSpecs(actorType: string, derivedSpecs: ValidSpec[], characterSpec: any): void;
    static effectDisabled(actor: Actor.Implementation, effect: ActiveEffect.Implementation, itemData?: null): boolean;
    static modifyValidSpec(spec: string, validSpec: ValidSpec): ValidSpec;
    static doCustomValue(actor: Actor.Implementation, current: any[], change: ActiveEffect.ChangeData, validValues: any[]): boolean;
    static doCustomArrayValue(actor: Actor.Implementation, current: any, change: ActiveEffect.ChangeData, validValues: string[] | undefined): boolean;
    static initSystemData(): void;
    static addDAEMetaData(activeEffectData: ActiveEffect.Source, item: Item.Implementation, options: DoEffectsOptions): void;
    static getAttributeValue(documentRef: string, attribute: string): any;
    static safeEval(expression: string, sandbox: any, onErrorReturn?: any | undefined): any;
    static safeEvalExpression(input: string, context: AnyObject, depth?: number): string;
    static daeCustomEffect(actor: Actor.Implementation, change: DAEChangeData, _current?: never, _delta?: never, _changes?: never): any;
    static initActions(): void;
    static readyActions(): void;
    static setupActions(): void;
}
export type DAEChangeData = ActiveEffect.ChangeData & {
    count?: number;
    effect?: ActiveEffect.Implementation;
};
export {};
