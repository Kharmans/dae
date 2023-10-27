import { debug } from "../../dae.js";
export class DIMEditor extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "./modules/dae/templates/DIMEditor.html",
      classes: ["macro-sheet", "sheet", "dimeditor"],
      resizable: true,
      width: 560,
      height: 480
    });
  }

  render(force, options = {}) {
    Hooks.once("renderDIMEditor", (app, html, data) => {
      console.log("renderDIMEditor");
      Hooks.callAll("renderMacroConfig", app, html, data)
    });
    return super.render(force, options)
  }
  //@ts-expect-error getData
  getData(options = {}) {
    //@ts-expect-error documentTypes
    const macroTypes = game.documentTypes.Macro.reduce((obj, t) => {
      if (t === CONST.BASE_DOCUMENT_TYPE) return obj;
      if ((t === "script") && !game.user?.can("MACRO_SCRIPT")) return obj;
      //@ts-expect-error typeLabels
      obj[t] = game.i18n.localize(CONFIG.Macro.typeLabels[t]);
      return obj;
    }, {});
    const macroScopes = CONST.MACRO_SCOPES;
    return mergeObject(super.getData(options), {
      macro: this.getMacro(),
      macroTypes,
      macroScopes
    });
  }
  /*
    Override
  */
  _onEditImage(event) {
    debug("DIMEditor | _onEditImage  | ", { event });
    // return ui.notifications.error(settings.i18n("error.editImage"));
  }

  /*
    Override
  */
  async _updateObject(event, formData) {
    debug("DIMEditor | _updateObject  | ", { event, formData });
    //@ts-expect-error type
    await this.updateMacro(mergeObject(formData, { type: "script", }));
  }

  async updateMacro({ command, type }) {
    let item = this.object;
    let macro: any = this.getMacro();

    debug("DIMEditor | updateMacro  | ", { command, type, item, macro });

    if (macro.command != command)
      await this.setMacro(new Macro({
        name: this.object.name,
        img: this.object.img,
        type: "script",
        scope: "global",
        command,
        author: game.user?.id,
        //@ts-expect-error
        ownership: {default: CONST.DOCUMENT_PERMISSION_LEVELS.OWNER}
      }, {}));
  }

  hasMacro() {
    let command = getProperty(this.object, "flags.dae.macro.command") ?? getProperty(this.object, "flags.itemacro.macro");
    return !!command;
  }

  getMacro(): Macro {
    let  macroData = getProperty(this.object, "flags.dae.macro")
      ?? getProperty(this.object, "flags.itemacro.macro")
      ?? {};
    
    if (!macroData.command && macroData.data) macroData = macroData.data;
    delete macroData.data;
    macroData = mergeObject(macroData, {img: this.object.img, name: this.object.name, scope: "global", type:"script"});
    debug("DIMEditor | getMacro | ", { macroData });
    return new Macro(macroData, {});
  }

  async setMacro(macro: Macro) {
    if (macro instanceof Macro) {
      const data = macro.toObject();
      await this.object.update({"flags.itemacro.macro": data});
      await this.object.unsetFlag("dae", `macro`);
      // if (getProperty(this.object, "flags.itemacro.macro") || itemacroActive)
      //   await this.object.update({"flags.itemacro.macro": data});
    }
  }

  public static preUpdateItemHook(item, updates, context, user): boolean {
    if (!getProperty(updates, "flags.itemacro.macro")) return true;
    // if (getProperty(updates, "flags.dae.macro")) return true;
    updates["flags.dae.-=macro"] = null;
    return true;
  }
}