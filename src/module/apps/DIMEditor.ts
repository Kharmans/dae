import { debug } from "../../dae.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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

  async render(options) {
    Hooks.once("renderDIMEditor", (app, html, data) => {
      Hooks.callAll("renderMacroConfig", app, html, data)
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
    // @ts-expect-error
    if (globalThis.MidiQOL?.activityTypes && this.document?.macroData) return this.document.macro;
    let macroData = foundry.utils.getProperty(this.document, "flags.dae.macro")
      ?? foundry.utils.getProperty(this.document, "flags.itemacro.macro")
      ?? {};

    if (!macroData.command && macroData.data) macroData = macroData.data;
    delete macroData.data;
    macroData = foundry.utils.mergeObject(macroData, { img: this.document.img, name: this.document.name, scope: "global", type: "script" });
    debug("DIMEditor | getMacro | ", { macroData });
    return new Macro.implementation(macroData, {});
  }

  async setMacro(macro: Macro) {
    // @ts-expect-error
    if (this.document.macroData) {
      //@ts-expect-error
      await this.document.update({ "macroData.name": macro.name, "macroData.command": macro.command });
    }
    if (macro instanceof Macro) {
      // @ts-expect-error
      await this.document.update({ "flags.dae.macro": macro.toObject() });
    }
  }

  public static preUpdateItemHook(item, updates, context, user): boolean {
    // @ts-expect-error
    if (!game.settings?.get("dae", "DIMESyncItemacro") /*|| !game.modules?.get("itemacro") */) return true;
    const existing = foundry.utils.getProperty(item, "flags.dae.macro")
      ?? foundry.utils.getProperty(item, "flags.itemacro.macro")
      ?? { command: "" };

    if (foundry.utils.getProperty(updates, "flags.dae.macro")) {
      const macroData = foundry.utils.mergeObject(existing, updates.flags.dae.macro);
      foundry.utils.setProperty(updates, "flags.itemacro.macro", macroData);
    } else if (foundry.utils.getProperty(updates, "flags.itemacro.macro")) {
      const macrodata = foundry.utils.mergeObject(existing, updates.flags.itemacro.macro);
      foundry.utils.setProperty(updates, "flags.dae.macro", macrodata);
    }
    return true;
  }
}