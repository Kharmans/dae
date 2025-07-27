import { ValidSpec } from "../Systems/DAESystem.js";
import { DAEFieldBrowser } from "./FieldBrowser.js";
export declare let otherFields: string[];
export declare function addAutoFields(fields: string[]): void;
export declare class DAEActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
    #private;
    tokenMagicEffects: Record<string, string>;
    statusEffectList: Record<string, string>;
    ATLPresets?: Record<string, string>;
    ATLVisionModes?: Record<string, string>;
    validFields: Record<string, {
        name: string;
        description?: string;
    }>;
    validSpecsToUse: {
        allSpecs: ValidSpec[];
        allSpecsObj: Record<string, ValidSpec>;
        baseSpecs: ValidSpec[];
        baseSpecsObj: Record<string, ValidSpec>;
        derivedSpecs: ValidSpec[];
        derivedSpecsObj: Record<string, ValidSpec>;
    };
    daeFieldBrowser: DAEFieldBrowser;
    ceEffectList: Record<string, string>;
    constructor(options: Partial<foundry.applications.sheets.ActiveEffectConfig.Configuration>);
    static DEFAULT_OPTIONS: {
        window: {
            title: string;
            resizable: boolean;
        };
        position: {
            height: "auto";
            width: number;
        };
        classes: string[];
        actions: {
            addSpecialDuration: typeof DAEActiveEffectConfig.__#156@#onAddSpecialDuration;
            deleteSpecialDuration: typeof DAEActiveEffectConfig.__#156@#onDeleteSpecialDuration;
        };
    };
    static PARTS: Record<string, foundry.applications.api.HandlebarsApplicationMixin.HandlebarsTemplatePart>;
    getOptionsForSpec(spec?: ActiveEffect.ChangeData): Record<string, string> | undefined;
    _prepareContext(options: any): Promise<DAEActiveEffectConfigRenderContext>;
    updateFieldInfo(): void;
    _onRender(context: any, options: any): Promise<void>;
    changeTab(tab: string, group: string, options: any): void;
    onFieldSelected(): void;
    _onDragStart(ev: any): void;
    _onDrop(ev: DragEvent): Promise<void>;
    _processSubmitData(event: any, form: any, submitData: any): Promise<void>;
    _preClose(options: any): Promise<void>;
}
interface DAEActiveEffectConfigRenderContext extends foundry.applications.sheets.ActiveEffectConfig.RenderContext {
    modes?: Record<number, string>;
    specialDuration?: Record<string, string>;
    showSpecialDurations?: boolean;
    macroRepeats?: Record<string, string>;
    stackableOptions?: Record<string, string>;
    isItemEffect?: boolean;
    isActorEffect?: boolean;
    submitText?: string;
    startTimeString?: string;
    durationString?: string;
    sourceName?: string;
    midiActive?: boolean;
    isEnchantment?: boolean;
    isConditionalActivationEffect?: boolean;
    transfer?: boolean;
}
export declare function geti18nTranslations(): string | Localization.Translations;
export declare function isEnchantment(effect: ActiveEffect): boolean;
export {};
