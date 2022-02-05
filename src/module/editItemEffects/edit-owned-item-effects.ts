import { EditOwnedItemEffectsItemSheet } from "./classes/item-sheet";

export class EditOwnedItemEffects {
  static MODULE_NAME = "edit-owned-item-effects";
  static MODULE_TITLE = "Edit Owned Item Effects";

  static log(...args) {
    if (game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.MODULE_NAME)) {
      console.log(this.MODULE_TITLE, '|', ...args);
    }
  }
}

Hooks.on('init', () => {
  console.log(`${EditOwnedItemEffects.MODULE_NAME} | Initializing ${EditOwnedItemEffects.MODULE_TITLE}`);
})

Hooks.on("ready", async () => {

  // initialize item sheet hooks
  // EditOwnedItemEffectsItemSheet.init();
});

Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
  // registerPackageDebugFlag(EditOwnedItemEffects.MODULE_NAME);
});
