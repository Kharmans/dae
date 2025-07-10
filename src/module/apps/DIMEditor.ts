import { debug } from "../../dae.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

declare module "fvtt-types/configuration" {
  namespace Hooks {
    interface ApplicationV2Config {
      DIMEditor: DIMEditor;
    }
  }
}

export class DIMEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  document: Item.Implementation; // could be an activity too

  static override DEFAULT_OPTIONS = {
    classes: ["macro-config", "dimeditor"],
    tag: "form",
    window: {
      contentClasses: ["standard-form"],
      resizable: true
    },
    position: {
      width: 560,
      height: 480
    },
    form: { 
      closeOnSubmit: true,
      handler: this.#processSubmitData
    }
  };

  static override PARTS = {
    body: {template: "./modules/dae/templates/DIMEditor.hbs", root: true},
    footer: {template: "templates/generic/form-footer.hbs"}
  };

  constructor(options) {
    super(options);
    this.document = options.document;
  }

  override _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    const suffix = options.document.uuid ?? foundry.utils.randomID();
    options.uniqueId = `${this.constructor.name}-${suffix.replaceAll(".", "-")}`;
    return options;
  }

  async render(options) {
    Hooks.once("renderDIMEditor", (app, html, data, options) => {
      // Marked as any because technically they want an actual MacroConfig version of things
      Hooks.callAll("renderMacroConfig", app as any, html, data as any, options as any)
    });
    return super.render(options)
  }

  async _prepareContext(options) {
    const context: any = await super._prepareContext(options);
    context.editorLang = "javascript";
    context.macro = this.getMacro();
    context.macroSchema = Macro.schema;
    context.buttons = [{
      type: "submit", icon: "fa-solid fa-save", label: "MACRO.Save"
    }];
    return context;
  }

  static async #processSubmitData(this: DIMEditor, _event: Event, form: HTMLFormElement) {
    const command = new foundry.applications.ux.FormDataExtended(form)?.get("command");
    await this.updateMacro(foundry.utils.mergeObject({ command, type: "script" }));
  }

  async updateMacro({ command, type }) {
    let item = this.document;
    let macro: any = this.getMacro();

    debug("DIMEditor | updateMacro  | ", { command, type, item, macro });
    if (macro.command != command) {
        await this.setMacro(new Macro({
          name: this.document.name,
          img: this.document.img,
          type: "script",
          scope: "global",
          command,
          author: game.user?.id,
          ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }
        }, {}));
    }
  }

  hasMacro() {
    const command = foundry.utils.getProperty(this.document, "flags.dae.macro.command") ?? foundry.utils.getProperty(this.document, "flags.itemacro.macro");
    return !!command;
  }

  getMacro(): Macro {
    // @ts-expect-error `macroData` is on the Activity pseudo-document with midi installed
    if (globalThis.MidiQOL?.activityTypes && this.document?.macroData) return this.document.macro;
    let macroData = this.document.flags?.dae?.macro ?? this.document.flags?.itemacro?.macro;

    macroData = foundry.utils.mergeObject(macroData ?? {}, { img: this.document.img, name: this.document.name, scope: "global", type: "script" });
    debug("DIMEditor | getMacro | ", { macroData });
    return new Macro.implementation(macroData, {});
  }

  async setMacro(macro: Macro) {
    // @ts-expect-error `macroData` is on the Activity pseudo-document with midi installed
    if (this.document.macroData) {
      // @ts-expect-error `macroData` is on the Activity pseudo-document with midi installed
      await this.document.update({ "macroData.name": macro.name, "macroData.command": macro.command });
    }
    if (macro instanceof Macro) {
      await this.document.setFlag("dae", "macro", macro.toObject());
    }
  }

  public static preUpdateItemHook(item: Item.Implementation, updates: Item.UpdateData, context, user): boolean {
    if (!game.settings.get("dae", "DIMESyncItemacro") /*|| !game.modules.get("itemacro") */) return true;
    const existing = item.flags?.dae?.macro
      ?? item?.flags?.itemacro?.macro
      ?? { command: "" };

    if (updates.flags?.dae?.macro) {
      const macroData = foundry.utils.mergeObject(existing, updates.flags.dae.macro);
      foundry.utils.setProperty(updates, "flags.itemacro.macro", macroData);
    } else if (updates.flags?.itemacro?.macro) {
      const macrodata = foundry.utils.mergeObject(existing, updates.flags.itemacro.macro);
      foundry.utils.setProperty(updates, "flags.dae.macro", macrodata);
    }
    return true;
  }
}