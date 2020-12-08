import { fetchParams } from "./dae";

export const registerSettings = function () {
  game.settings.register("dae", "requireItemTarget", {
    name: game.i18n.localize("dae.requireItemTarget.Name"),
    hint: game.i18n.localize("dae.requireItemTarget.Hint"),
    scope: "world",
    default: true,
    config: true,
    type: Boolean,
    onChange: fetchParams
  });
  game.settings.register("dae", "useDAESheet", {
    scope: "world",
    default: true,
    config: true,
    type: Boolean,
    onChange: fetchParams,
    name: game.i18n.localize("dae.useDAESheet.Name"),
    hint: game.i18n.localize("dae.useDAESheet.Hint"),
  });

  game.settings.register("dae", "expireRealTime", {
    name: "dae.expireRealTime.Name",
    hint: "dae.expireRealTime.Hint",
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });
  
  game.settings.register("dae", "playersCanSeeEffects", {
    scope: "world",
    default: "None",
    config: true,
    type: String,
    choices: {none: "Never", view: "View Only", edit: "Edit"},
    onChange: fetchParams,
    name: game.i18n.localize("dae.playersCanSeeEffects.Name"),
    hint: game.i18n.localize("dae.playersCanSeeEffects.Hint"),
  });

  game.settings.register("dae", "useAbilitySave", {
    name: game.i18n.localize("dae.useAbilitySave.Name"),
    hint: game.i18n.localize("dae.useAbilitySave.Hint"),
    scope: "world",
    default: true,
    config: true,
    type: Boolean,
    onChange: fetchParams
  });

  game.settings.register("dae", "calculateArmor", {
    name: game.i18n.localize("dae.calculateArmor.Name"),
    hint: game.i18n.localize("dae.calculateArmor.Hint"),
    scope: "world",
    default: true,
    config: true,
    type: Boolean,
    onChange: fetchParams
  });

  game.settings.register("dae", "applyBaseAC", {
    name: game.i18n.localize("dae.applyBaseAC.Name"),
    hint: game.i18n.localize("dae.applyBaseAC.Hint"),
    scope: "world",
    default: true,
    config: true,
    type: Boolean,
    onChange: fetchParams
  });


  game.settings.register("dae", "confirmDelete", {
    name: game.i18n.localize("dae.confirmDelete.Name"),
    hint: game.i18n.localize("dae.confirmDelete.Hint"),
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  game.settings.register("dae", "ehnanceStatusEffects", {
    name: "dae.enhanceStatusEffects.Name",
    hint: "dae.enhanceStatusEffects.Hint",
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  game.settings.register("dae", "ZZDebug", {
    name: "dae.Debug.Name",
    hint: "dae.Debug.Hint",
    scope: "world",
    default: "none",
    type: String,
    config: true,
    choices: {none: "None", warn: "warnings", debug: "debug", all: "all"},
    onChange: fetchParams
  })

};
