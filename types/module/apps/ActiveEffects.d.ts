import { Specs, ValidSpec } from "../Systems/DAESystem.js";
import DocumentSheetV2 = foundry.applications.api.DocumentSheetV2;
import HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;
declare const WeirdIntermediate: HandlebarsApplicationMixin.Mix<typeof DocumentSheetV2<Actor.Implementation | Item.Implementation, DocumentSheetV2.RenderContext<any>>>;
export declare class ActiveEffects extends WeirdIntermediate {
    #private;
    static filters: Set<FilterEntry>;
    effectHookId: number | null;
    effectList: Record<string, string>;
    static DEFAULT_OPTIONS: {
        classes: string[];
        window: {
            title: string;
            resizable: boolean;
        };
        position: {
            height: number;
            width: number;
        };
        actions: {
            toggleFilter: typeof ActiveEffects.__#155@#onToggleFilter;
            deleteEffect: typeof ActiveEffects.__#155@#onDeleteEffect;
            editEffect: typeof ActiveEffects.__#155@#onEditEffect;
            addEffect: typeof ActiveEffects.__#155@#onAddEffect;
        };
    };
    static PARTS: {
        body: {
            template: string;
        };
    };
    _initializeApplicationOptions(options: any): any;
    get title(): string;
    get filters(): Set<FilterEntry>;
    _prepareContext(options: any): Promise<ActiveEffectsRenderContext>;
    _processSubmitData(_event: SubmitEvent, _form: HTMLFormElement, submitDataOrig: foundry.applications.ux.FormDataExtended): Promise<void>;
    _onRender(context: any, options: any): Promise<void>;
    _preClose(options: any): Promise<void>;
}
interface ActiveEffectsRenderContext extends DocumentSheetV2.RenderContext<any> {
    actives: ActivesEntry[];
    isGM: boolean;
    isItem: boolean;
    isOwned: boolean;
    flags: any;
    modes: string[];
    validSpecs: Record<string, ValidSpec> | Specs;
    canEdit: boolean;
    showEffects: boolean;
    effectList: Record<string, string>;
    effect: string;
    summaryActive: boolean;
    enabledActive: boolean;
    temporaryActive: boolean;
}
interface ActivesEntry extends Omit<foundry.data.fields.SchemaField.SourceData<ActiveEffect.Schema>, "duration" | "changes"> {
    uuid: string;
    isSuppressed: boolean;
    duration: ActiveEffect.Duration;
    isTemporary: boolean;
    sourceName: string;
    changes: (ActiveEffect.ChangeData & {
        label: string;
    })[];
}
type FilterEntry = "summary" | "temporary" | "enabled";
export {};
