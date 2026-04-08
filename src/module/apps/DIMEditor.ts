import { debug } from "../../dae.js";
import { getItemMacroCommand } from "../dae.js";
import ApplicationV2 = foundry.applications.api.ApplicationV2;
import HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;

declare module "fvtt-types/configuration" {
  namespace Hooks {
    interface ApplicationV2Config {
      DIMEditor: DIMEditor;
    }
  }
}

const WeirdIntermediate: HandlebarsApplicationMixin.Mix<typeof ApplicationV2> = HandlebarsApplicationMixin(ApplicationV2);

export class DIMEditor extends WeirdIntermediate {
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
    const command = new foundry.applications.ux.FormDataExtended(form)?.get("command") as string;
    await this.updateMacro(command);
  }

  async updateMacro(command: string) {
    let item = this.document;
    let macro: Macro.Implementation = this.getMacro();

    debug("DIMEditor | updateMacro  | ", { command, item, macro });
    if (macro.command !== command) {
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
    return !!getItemMacroCommand(this.document);
  }

  getMacro(): Macro.Implementation {
    // @ts-expect-error `macroData` is on the Activity pseudo-document with midi installed
    if (globalThis.MidiQOL?.activityTypes && this.document?.macroData) return this.document.macro;
    let macroData = this.document.flags?.dae?.macro ?? this.document.flags?.itemacro?.macro;

    macroData = foundry.utils.mergeObject(macroData ?? {}, { img: this.document.img, name: this.document.name, scope: "global", type: "script" });
    debug("DIMEditor | getMacro | ", { macroData });
    return new Macro.implementation(macroData, {});
  }

  async setMacro(macro: Macro.Implementation) {
    // @ts-expect-error `macroData` is on the Activity pseudo-document with midi installed
    if (this.document.macroData) {
      // @ts-expect-error `macroData` is on the Activity pseudo-document with midi installed
      await this.document.update({ "macroData.name": macro.name, "macroData.command": macro.command });
    } else if (macro instanceof Macro) {
      await this.document.setFlag?.("dae", "macro", macro.toObject());
    }
  }

}