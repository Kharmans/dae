import ApplicationV2 = foundry.applications.api.ApplicationV2;
import HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;
declare module "fvtt-types/configuration" {
    namespace Hooks {
        interface ApplicationV2Config {
            DIMEditor: DIMEditor;
        }
    }
}
declare const WeirdIntermediate: HandlebarsApplicationMixin.Mix<typeof ApplicationV2>;
export declare class DIMEditor extends WeirdIntermediate {
    #private;
    document: Item.Implementation;
    static DEFAULT_OPTIONS: {
        classes: string[];
        tag: string;
        window: {
            contentClasses: string[];
            resizable: boolean;
        };
        position: {
            width: number;
            height: number;
        };
        form: {
            closeOnSubmit: boolean;
            handler: typeof DIMEditor.__#157@#processSubmitData;
        };
    };
    static PARTS: {
        body: {
            template: string;
            root: boolean;
        };
        footer: {
            template: string;
        };
    };
    constructor(options: any);
    _initializeApplicationOptions(options: any): any;
    render(options: any): Promise<this>;
    _prepareContext(options: any): Promise<any>;
    updateMacro(command: string): Promise<void>;
    hasMacro(): boolean;
    getMacro(): Macro.Implementation;
    setMacro(macro: Macro.Implementation): Promise<void>;
    static preUpdateItemHook(item: Item.Implementation, updates: Item.UpdateData, _options: Partial<foundry.abstract.DatabaseBackend.UpdateOperation<any>>, _userId: string): boolean;
}
export {};
