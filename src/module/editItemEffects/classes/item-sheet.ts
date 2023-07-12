import { debug, warn } from '../../../dae.js';
// import { EditOwnedItemEffectsActiveEffect } from './owned-item-effect.js';

/**
 * Handles all the logic related to Item Sheet
 */
export class ItemEffectsItemSheet {
  static init() {
    Hooks.on('renderItemSheet', this.handleItemSheetRender);
  }

  /**
   * Only applies to owned items which can be edited
   * Removes some effect controls
   * Unregisters all Core Effect Control listeners
   * Adds a "Transfer" button for effects marked "Transfer"
   * Re-registers custom listeners for create, edit, and delete controls
   * 
   * @param {*} app 
   * @param {*} html 
   * @returns 
   */

  static onManageActiveEffect(event, owner) {
    event.preventDefault();
    const a = event.currentTarget;
    const li = a.closest("li");
    const effect = li.dataset.effectId ? owner.effects.get(li.dataset.effectId) : null;
    if (a.dataset.action !== "transfer") {
      // if (CONFIG.ActiveEffect.documentClass.onManageActiveEffect) return CONFIG.ActiveEffect.documentClass.onManageActiveEffect(event, owner);
    } else {
      event.stopPropagation();
        const actor = effect.parent?.parent;

        if (!actor || !(actor instanceof Actor)) {
          debug('Attempted to Transfer an effect on an unowned item.');
          return;
        }

        debug('Attempting to Transfer an effect to an Actor', { effectUuid: effect.uuid, actor });

        return CONFIG.ActiveEffect.documentClass.create({
          ...effect.toObject(),
          origin: effect.parent.uuid,
        }, { parent: actor });
    }
  }

  static handleItemSheetRender = (app, html) => {
    const effectsList = html.find('.tab.effects-list');

    if (!app.item.isOwned || !effectsList || !app.isEditable) {
      return;
    }

    // unregister all remaining listeners on the effect controls
    // tml.find(".effect-control").unbind('click');

    // remove the 'activate' button on the effect list as it's confusing
    // html.find('.effect-control[data-action="toggle"]').remove();

    // add 'transfer' button to the AEs which should be transferrable
    app.item.effects.filter(effect => effect.transfer).forEach(effect => {
      const id = effect.id;

      const newButton = `<a class="effect-control" data-action="transfer" title="${game.i18n.localize('EFFECT.Transfer')}">
      <i class="fas fa-hand-holding-medical"></i>
  </a>`

      html.find(`li[data-effect-id=${id}] .effect-controls`).append(newButton);
    });

    // override the listener preventing management of these effects

    html.on('click', ".effect-control", (ev) => {
      ItemEffectsItemSheet.onManageActiveEffect(ev, app.item);
    })
  }
}
