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

  game.settings.register("dae", "tokenEffects", {
    name: game.i18n.localize("dae.tokenEffects.Name"),
    hint: game.i18n.localize("dae.tokenEffects.Hint"),
    scope: "world",
    default: false,
    config: false,
    type: Boolean,
    onChange: fetchParams
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
