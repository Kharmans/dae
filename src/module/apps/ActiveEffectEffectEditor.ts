


import { ValidSpec, playersCanSeeEffects, itemacroActive } from "../dae"
import { tokenEffects, cubActive } from "../dae"


export class ActiveEffectEffectEditor extends FormApplication {

  path = null;
  static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "effect-selector";
      options.classes = ["dnd5e"];
      options.title = game.i18n.localize("dae.ItemEffectSelection");
      options.template = "./modules/dae/templates/ActiveEffectEffectEditor.html";
      options.height = 275;
      options.width = 275;
      return options;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('img[data-edit="img"]').click(ev => this._onEditImage(ev));
  }

  _onEditImage(event) {
    new FilePicker({
      type: "image",
      current: this.path,
      callback: path => {
        this.path = path;
        this.render(true)
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    }).browse(this.object.effect.icon);
  }

  getData() {
    if (!this.path) this.path = this.object.effect.icon;
    console.warn("Path is set to ", this.path)
    let data = {
        effect: duplicate(this.object.effect),
    };
    data.effect.icon = this.path;
    return data;
  }
  async _updateObject(event, formData) {
    console.warn("update formData is ", formData, this.options)
    // (change, {item, effect, change_id}

    let newEffect = duplicate(this.object.effect);
    newEffect.label = formData.label;
    newEffect.transfer = formData.transfer;
    newEffect.icon = this.path;
    console.warn(" new effect is ", this.path, newEffect);
    if (this.object.item.isOwned) {
      let effects = duplicate(this.object.item.data.effects);
      for (let i = 0; i < effects.length; i ++) {
        if (effects[i]._id === this.object.effect._id)
          effects[i] = newEffect;
      }
      this.object.item.actor.updateOwnedItem({"_id": this.object.item.id, "effects": effects})
    } else {
      this.object.item.updateEmbeddedEntity("ActiveEffect", newEffect);
    }
  }
}
