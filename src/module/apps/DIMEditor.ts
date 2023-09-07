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
  getData(options = {}) {
    const macroTypes = game.documentTypes.Macro.reduce((obj, t) => {
      //@ts-expect-error
      if ( t === CONST.BASE_DOCUMENT_TYPE ) return obj;
      if ( (t === "script") && !game.user.can("MACRO_SCRIPT") ) return obj;
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
    await this.updateMacro(mergeObject(formData, { type: "script", }));
  }

  async updateMacro({ command, type }) {
    let item = this.object;
    let macro: any = this.getMacro();

    debug("DIMEditor | updateMacro  | ", { command, type, item, macro });

    if (macro.command != command)
      await this.setMacro(new Macro({
        name: this.object.name,
        //@ts-expect-error
        img: this.object.img,
        type: "script",
        scope: "global",
        command,
        author: game.user.id,
      }, {}));
  }

  hasMacro() {
    let command = getProperty(this.object, "flags.dae.macro.command") ?? getProperty(this.object, "flags.itemacro.macro");
    return !!command;
  }

  getMacro(): Macro {
    let command = getProperty(this.object, "flags.dae.macro.command") 
      ?? getProperty(this.object, "flags.itemacro.macro.command") 
      ?? getProperty(this.object, "flags.itemacro.macro.data.command") 
      ?? "";
  
    debug("DIMEditor | getMacro | ", { command });

    //@ts-expect-error img
    return new Macro({ command, img: this.object.img, name: this.object.name, scope: "global", type: "script" }, {});
  }

  async setMacro(macro: Macro) {
    if (macro instanceof Macro) {
      //@ts-expect-error toObject
      const data = macro.toObject();
      return await this.object.setFlag("dae", `macro`, data);
    }
  }
}