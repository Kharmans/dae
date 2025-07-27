import { DAESystem, ValidSpec } from "./Systems/DAESystem.js";
import { DAESystemDND5E } from "./Systems/DAEdnd5e.js";
import { AnyObject, InexactPartial } from "fvtt-types/utils";
import { TokenOrDocument } from "../globals.js";
export declare let aboutTimeInstalled: boolean;
export declare let timesUpInstalled: boolean;
export declare let simpleCalendarInstalled: boolean;
export declare let atlActive: boolean;
export declare let itemacroActive: boolean;
export declare let midiActive: boolean;
export declare let useDetermineSuppression: boolean;
export declare let ceInterface: {
    findEffects: () => ActiveEffect.Implementation[];
    findEffect: (input: {
        folderId?: string;
        effectId?: string;
        effectName?: string;
    }) => ActiveEffect.Implementation | null;
    hasEffectApplied: (input: {
        effectId?: string;
        effectName?: string;
        uuid?: string;
    }) => boolean;
    addEffect: (input: {
        effectId?: string;
        effectName?: string;
        effectData?: ActiveEffect.CreateData;
        uuid?: string;
        overlay?: boolean;
        origin?: string | null;
    }) => Promise<ActiveEffect.Implementation[]>;
    removeEffect: (input: {
        effectId?: string;
        effectName?: string;
        uuid?: string;
        origin?: string | null;
    }) => Promise<void>;
} | undefined;
export declare let localizationMap: Record<string, {
    name?: string;
    description?: string;
}>;
export declare let noDupDamageMacro: boolean;
export declare let disableEffects: boolean;
export declare let daeTitleBar: boolean;
export declare let DIMETitleBar: boolean;
export declare let daeColorTitleBar: boolean;
export declare let daeNoTitleText: boolean;
export declare let libWrapper: any;
export declare let actionQueue: foundry.utils.Semaphore;
export declare let DAEReadyComplete: boolean;
export declare let dependentConditions: boolean;
export declare let allMacroEffects: string[];
export declare let macroDestination: {
    "macro.execute": string;
    "macro.execute.local": string;
    "macro.execute.GM": string;
    "macro.itemMacro": string;
    "macro.itemMacro.local": string;
    "macro.itemMacro.GM": string;
    "macro.actorUpdate": string;
    "macro.activityMacro": string;
};
export declare function geti18nOptions(key: string, moduleId: string): Record<string, string>;
export declare let daeSystemClass: typeof DAESystem | typeof DAESystemDND5E;
export declare let showInline: boolean;
export declare function applyDaeEffects(this: Actor.Implementation, { specList, excludeSpecs, allowAllSpecs, wildCardsInclude, wildCardsExclude, doStatusEffects }: {
    specList: Record<string, ValidSpec>;
    excludeSpecs: Record<string, ValidSpec>;
    allowAllSpecs: boolean;
    wildCardsInclude: Array<RegExp>;
    wildCardsExclude: Array<RegExp>;
    doStatusEffects: boolean;
}): Record<string, unknown> | undefined;
export declare function addCreateItemChange(change: {
    key: string;
    value: string;
}, actor: Actor.Implementation, effect: ActiveEffect.Implementation, context: unknown): Promise<void>;
export declare function removeCreateItemChange(itemId: string, actor: Actor.Implementation, effect: ActiveEffect.Implementation, context?: any): Promise<void>;
export declare function addTokenMagicChange(actor: Actor.Implementation, change: ActiveEffect.ChangeData, tokens: (TokenOrDocument | null | undefined)[]): Promise<void>;
export declare function removeTokenMagicChange(actor: Actor.Implementation, change: ActiveEffect.ChangeData, tokens: (TokenOrDocument | null | undefined)[], context?: any): Promise<void>;
export declare function removeConvenientEffectsChange(effectName: string, uuid: string, origin: string | undefined | null, isToken: boolean): Promise<void | undefined>;
export declare function addConvenientEffectsChange(effectName: string, uuid: string, origin: string | undefined | null, context: any, isToken: boolean): Promise<ActiveEffect.Implementation[] | undefined>;
export declare function addConditionChange(actor: Actor.Implementation, change: ActiveEffect.ChangeData, token: foundry.canvas.placeables.Token.Implementation | undefined, effect: ActiveEffect.Implementation): Promise<ActiveEffect.Implementation[] | undefined>;
export declare function removeConditionChange(actor: Actor.Implementation, change: ActiveEffect.ChangeData, token: foundry.canvas.placeables.Token.Implementation | null, effect: ActiveEffect.Implementation, context?: any): Promise<void>;
export declare function addStatusEffectChange(actor: Actor.Implementation, change: ActiveEffect.ChangeData, tokens: foundry.canvas.placeables.Token.Implementation[], sourceEffect: ActiveEffect.Implementation, context?: any): Promise<ActiveEffect[] | boolean>;
export declare function removeStatusEffectChange(actor: Actor.Implementation, change: ActiveEffect.ChangeData, tokens: foundry.canvas.placeables.Token.Implementation[], effect: ActiveEffect.Implementation, context?: any): Promise<void>;
export declare function expireEffects(actor: Actor.Implementation, effects: ActiveEffect.Implementation[], context: any): Promise<any>;
export declare function preDeleteCombatHook(combat: Combat.Implementation, options: Combat.Database.PreDeleteOptions, user: string): void;
export declare function preCreateCombatantHook(combatant: Combatant.Implementation, data: Combatant.CreateData, options: Combatant.Database.PreCreateOptions, user: string): void;
export declare function updateActiveEffectHook(effect: ActiveEffect.Implementation, updates: ActiveEffect.UpdateData, options: ActiveEffect.Database.PreUpdateOptions & {
    dae?: {
        active?: {
            wasDisabled?: boolean;
            wasSuppressed?: boolean;
        };
    };
    effectUuid?: string;
}, userId: string): true | undefined;
export declare function preUpdateActiveEffectEvalInlineHook(candidate: ActiveEffect.Implementation, updates: ActiveEffect.UpdateData, options: ActiveEffect.Database.PreUpdateOptions, userId: string): boolean;
export declare function deleteActiveEffectHook(effect: ActiveEffect.Implementation, options: ActiveEffect.Database.DeleteOptions, userId: string): boolean;
export declare function getSelfTarget(actor: Actor.Implementation | null): Token | TokenDocument;
export declare function daeMacro(action: string, actor: Actor.Implementation, effectData: ActiveEffect.Implementation | ActiveEffect.Source, lastArgOptions?: any): Promise<unknown>;
export declare function evalArgs({ effectData, item, context, actor, change, spellLevel, damageTotal, doRolls, critical, fumble, whisper, itemCardUuid, tokenUuid }: EvalArgsInput): Promise<ActiveEffect.ChangeData>;
export declare function getMacro({ change, name }: {
    change: ActiveEffect.ChangeData;
    name: string;
}, item: Item.Implementation, effectData?: ActiveEffect.Source): Promise<Macro.Implementation | undefined>;
export declare function doEffects(item: Item.Implementation, activate: boolean, targets: DoEffectsTargets, options: DoEffectsOptions): Promise<void>;
export declare function doActivityEffects(activity: any, activate: boolean, targets: DoEffectsTargets, activityEffectsUuids: string[], options: DoEffectsOptions): Promise<void>;
export declare function applyActivityEffects(activity: any, activate: boolean, targets: DoEffectsTargets, activityEffects: ActiveEffect.Source[], options?: DoEffectsOptions): Promise<void>;
export declare function applyNonTransferEffects(item: Item.Implementation, activate: boolean, targets?: DoEffectsTargets, options?: DoEffectsOptions): Promise<void>;
export declare function addEffectChange(actor: Actor.Implementation, tokens: (foundry.canvas.placeables.Token | undefined)[], effectToApply: ActiveEffect.Implementation, item: Item.Implementation, change: ActiveEffect.ChangeData, context: Item.Database.UpdateOperation): void;
export declare function removeEffectChange(actor: Actor.Implementation, tokens: foundry.canvas.placeables.Token[], effectToApply: ActiveEffect.Implementation, item: Item.Implementation, change: ActiveEffect.ChangeData, context: Item.Database.UpdateOperation): void;
export declare function deleteItemHook(candidateItem: Item.Implementation, options: Item.Database.DeleteOptions, userId: string): Promise<void>;
export declare function createItemHook(item: Item.Implementation, options: Item.Database.CreateOptions, userId: string): Promise<void>;
export declare function preUpdateActorHook(candidate: Actor.Implementation, updates: Actor.UpdateData, options: Actor.Database.UpdateOptions, userId: string): boolean;
export declare function daeReadyActions(): void;
export declare function localDeleteFilters(tokenId: string, filterName: string): void;
export declare let tokenizer: any;
export declare function daeInitActions(): void;
export declare function daeSetupActions(): void;
export declare let maxShortDuration: number;
export declare function fetchParams(): void;
export declare function getTokenDocument(tokenRef: Token | TokenDocument | string | Actor): TokenDocument | undefined;
export declare function getToken(tokenRef: Token | TokenDocument | string | Actor): Token | undefined;
export declare function actorFromUuid(uuid: string): Actor.Implementation | null;
export declare function replaceFormulaData(wrapped: any, formula: any, data?: any, { missing, warn }?: {
    missing: undefined;
    warn?: false;
}): any;
export declare function tokensForActor(actorRef: Actor | string | undefined | null): Token[] | undefined;
export declare function tokenForActor(actor: Actor | string | undefined | null): Token | undefined;
export declare function effectIsTransfer(effect: ActiveEffect.Implementation | ActiveEffect.Source): boolean;
export declare function delay(interval: number): Promise<void>;
export declare function safeGetGameSetting(moduleName: any, settingName: any): any | undefined;
export declare function getApplicableEffects(actor: any, { includeEnchantments }: {
    includeEnchantments: any;
}): any[];
export declare function toggleActorStatusEffectPossible(actor: Actor, statusId: string, { active, overlay, enableCondition, origin, flags }?: ToggleStatusEffectOptions): Promise<ActiveEffect.Implementation | boolean | undefined>;
export declare function toggleActorStatusEffect(actor: Actor, statusId: string, { active, overlay, enableCondition, origin, flags }?: ToggleStatusEffectOptions): Promise<ActiveEffect[] | boolean>;
export declare function processConditionalEffects(actor: Actor.Implementation, updates: TokenDocument.UpdateData | Actor.UpdateData): Promise<void>;
export declare function enumerateBaseValues(objectDataModels: Record<string, typeof foundry.abstract.DataModel<any, Item.Implementation>>, logErrors?: boolean): BaseValuesReturn;
export declare function effectBaseName(effect: ActiveEffect.Implementation): string;
export declare function getStaticID(id: string): string;
export type DoEffectsTargets = (string | Actor.Implementation | TokenOrDocument)[] | undefined;
export interface DoEffectsOptions extends InexactPartial<{
    applyAll: boolean;
    context: AnyObject;
    critical: boolean;
    damageTotal: number | null;
    effectsToApply: string[];
    fumble: boolean;
    itemCardUuid: string | null;
    metaData: AnyObject;
    origin: string;
    removeMatchLabel: boolean;
    selfEffects: "selfEffectsAlways" | "selfEffectsAll" | "none";
    spellLevel: number;
    toggleEffect: boolean;
    tokenId: string;
    whisper: boolean;
}> {
}
interface ToggleStatusEffectOptions {
    active?: boolean;
    overlay?: boolean;
    enableCondition?: string;
    origin?: string;
    flags?: any;
}
export type BaseValuesInner = Record<string, [foundry.data.fields.DataField<any>, number]>;
type BaseValuesReturn = Record<string, BaseValuesInner>;
interface EvalArgsInput {
    effectData: ActiveEffect.Source;
    item?: Item.Implementation | null;
    context: AnyObject;
    actor: Actor.Implementation;
    change: ActiveEffect.ChangeData;
    spellLevel?: number;
    damageTotal?: number;
    doRolls?: boolean;
    critical?: boolean;
    fumble?: boolean;
    whisper?: boolean;
    itemCardUuid?: string | null;
    tokenUuid?: string | null;
}
export {};
