import { i18n } from "../dae.js";
import { fetchParams } from "./dae.js";

export const registerSettings = async function () {

  // @ts-expect-error
  game.settings?.register("dae", "DependentConditions", {
    name: "dae.DependentConditions.Name",
    hint: "dae.DependentConditions.Hint",
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  // @ts-expect-error
  game.settings?.register("dae", "noDupDamageMacro", {
    name: "dae.noDupDamageMacro.Name",
    hint: "dae.noDupDamageMacro.Hint",
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  // @ts-expect-error
  game.settings?.register("dae", "expireRealTime", {
    name: "dae.expireRealTime.Name",
    hint: "dae.expireRealTime.Hint",
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });


  // @ts-expect-error
  game.settings?.register("dae", "showInline", {
    scope: "client",
    name: "dae.ShowInline.Name",
    hint: "dae.ShowInline.Hint",
    default: false,
    config: true,
    type: Boolean,
    onChange: fetchParams
  });
  
  // @ts-expect-error
  game.settings?.register("dae", "DAETitleBar", {
    name: "dae.DAETitleBar.Name",
    hint: "dae.DAETitleBar.Hint",
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  // @ts-expect-error
  game.settings?.register("dae", "DIMETitleBar", {
    name: "dae.DIMETitleBar.Name",
    hint: "dae.DIMETitleBar.Hint",
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  // @ts-expect-error
  game.settings?.register("dae", "DIMESyncItemacro", {
    name: "dae.DIMESyncItemacro.Name",
    hint: "dae.DIMESyncItemacro.Hint",
    scope: "world",
    default: true,
    type: Boolean,
    config: true
  });

  // @ts-expect-error
  game.settings?.register("dae", "DAEColorTitleBar", {
    name: "dae.DAEColorTitleBar.Name",
    hint: "dae.DAEColorTitleBar.Hint",
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  // @ts-expect-error
  game.settings?.register("dae", "DAENoTitleText", {
    name: "dae.DAENoTitleText.Name",
    hint: "dae.DAENoTitleText.Hint",
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  // @ts-expect-error
  game.settings?.register("dae", "DAEAddHalfHealthEffect", {
    name: "dae.DAEAddHalfHealthEffect.Name",
    hint: "dae.DAEAddHalfHealthEffect.Hint",
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    onChange: fetchParams,
    requiresReload: true
  });

  // @ts-expect-error
  game.settings?.register("dae", "DAEUntestedSystems", {
    name: "dae.DAEUntestedSystems.Name",
    hint: "dae.DAEUntestedSystems.Hint",
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  // @ts-expect-error
  game.settings?.register("dae", "ZZDebug", {
    name: "dae.Debug.Name",
    hint: "dae.Debug.Hint",
    scope: "world",
    default: "none",
    type: String,
    config: true,
    onChange: fetchParams,
    choices: { none: "None", warn: "warnings", debug: "debug", all: "all" }
  });

  // @ts-expect-error
  game.settings?.register("dae", "disableEffects", {
    name: "dae.DisableEffects.Name",
    hint: "dae.DisableEffects.Hint",
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    requiresReload: true
  })
};
