import { fetchParams } from "./dynamiceffects.js";
export const registerSettings = function () {
    game.settings.register("dynamiceffects", "ConsumeCharge", {
        name: game.i18n.localize("dynamiceffects.ConsumeCharge.Name"),
        hint: game.i18n.localize("dynamiceffects.ConsumeCharge.Hint"),
        scope: "world",
        default: true,
        config: true,
        type: Boolean
    });
    game.settings.register("dynamiceffects", "requireItemTarget", {
        name: game.i18n.localize("dynamiceffects.requireItemTarget.Name"),
        hint: game.i18n.localize("dynamiceffects.requireItemTarget.Hint"),
        scope: "world",
        default: true,
        config: true,
        type: Boolean,
        onChange: fetchParams
    });
    game.settings.register("dynamiceffects", "playersCanSeeEffects", {
        scope: "world",
        default: "None",
        config: true,
        type: String,
        choices: { none: "Never", view: "View Only", edit: "Edit" },
        onChange: fetchParams,
        name: game.i18n.localize("dynamiceffects.playersCanSeeEffects.Name"),
        hint: game.i18n.localize("dynamiceffects.playersCanSeeEffects.Hint"),
    });
    game.settings.register("dynamiceffects", "playerControlsInvisibleTokens", {
        name: game.i18n.localize("dynamiceffects.playerControlsInvisibleTokens.Name"),
        hint: game.i18n.localize("dynamiceffects.playerControlsInvisibleTokens.Hint"),
        scope: "world",
        default: false,
        config: true,
        type: Boolean,
        choices: [],
        onChange: (value) => { window.location.reload(); }
    });
    game.settings.register("dynamiceffects", "tokenEffects", {
        name: game.i18n.localize("dynamiceffects.tokenEffects.Name"),
        hint: game.i18n.localize("dynamiceffects.tokenEffects.Hint"),
        scope: "world",
        default: false,
        config: false,
        type: Boolean,
        onChange: fetchParams
    });
    game.settings.register("dynamiceffects", "calculateArmor", {
        name: game.i18n.localize("dynamiceffects.calculateArmor.Name"),
        hint: game.i18n.localize("dynamiceffects.calculateArmor.Hint"),
        scope: "world",
        default: true,
        config: true,
        type: Boolean,
        onChange: fetchParams
    });
};
