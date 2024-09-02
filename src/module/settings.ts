import { i18n } from "../dae";
import { fetchParams, stackableConditionsv12 } from "./dae";

export const registerSettings = async function () {

  game.settings.register("dae", "rewriteTransferOrigin", {
    name: "dae.rewriteTransferOrigin.Name",
    hint: "dae.rewriteTransferOrigin.Hint",
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  game.settings.register("dae", "noDupDamageMacro", {
    name: "dae.noDupDamageMacro.Name",
    hint: "dae.noDupDamageMacro.Hint",
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    onChange: fetchParams
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

  //@ts-expect-error
  if (game.release.generation >= 12) {
    game.settings.register("dae", "stackableConditions", {
      name: "dae.StackableConditions.Name",
      hint: "dae.StackableConditions.Hint",
      scope: "world",
      default: true,
      type: Boolean,
      config: false,
      onChange: fetchParams
    });
    game.settings.register("dae", "stackableConditionsv12", {
      name: "dae.StackableConditions.Name",
      hint: "dae.StackableConditions.Hint",
      scope: "world",
      //@ts-expect-error
      default: {enable: true, stackable: globalThis.CONFIG.DAE.defaultStackableConditions},
      type: Object,
      config: false,
      onChange: fetchParams
    });
    const formBuilder = import("../libs/FormBuilder.js").then(formBuilder => {
    new formBuilder.FormBuilder()
      .title("dae.StackableConditions.Name")
      .button({
        label: "Default", callback: function () {
          stackableConditionsv12.enabled = true;
          //@ts-expect-error
          stackableConditionsv12.stackable = globalThis.CONFIG.DAE.defaultStackableConditions;
          game.settings.set("dae", "stackableConditionsv12", stackableConditionsv12);
          this.close();
        },
        action: foundry.utils.randomID(),
        icon: "fas fa-cogs"
      })
      .button({
        label: "Disable", callback: function () {
          stackableConditionsv12.enabled = false;
          stackableConditionsv12.stackable = [];
          game.settings.set("dae", "stackableConditionsv12", stackableConditionsv12);
          this.close();
        },
        action: foundry.utils.randomID(),
        icon: "fas fa-cogs"
      })
      .checkbox({ name: "enabled", label: i18n("dae.StackableConditions.Name"), hint: i18n("dae.StackableConditions.Hint"), value: stackableConditionsv12.enabled })
      //@ts-expect-error
      .multiSelect({ name: "stackable", label: i18n("dae.StackableConditions.Name"), hint: i18n("dae.StackableConditions.Hint"), value: stackableConditionsv12.stackable, options: CONFIG.statusEffects.reduce((opts, se) => { opts[se.id] = se.name; return opts }, { all: "All Stackable" }) })
      .registerAsMenu({ moduleId: "dae", key: "stackableConditionsv12", name: "dae.StackableConditions.Name", label: "dae.StackableConditions.Name", icon: "fas fa-layer-group", hint: "dae.StackableConditions.Hint", scope: "world", restricted: true, defaultValue: true, onChange: fetchParams, requiresReload: false });
    })
  } else {
    game.settings.register("dae", "stackableConditions", {
      name: "dae.StackableConditions.Name",
      hint: "dae.StackableConditions.Hint",
      scope: "world",
      default: true,
      type: Boolean,
      config: true,
      onChange: fetchParams
    });
    game.settings.register("dae", "stackableConditionsv12", {
      name: "dae.StackableConditions.Name",
      hint: "dae.StackableConditions.Hint",
      scope: "world",
      //@ts-expect-error
      default: {enable: true, stackable: globalThis.CONFIG.DAE.defaultStackableConditions},
      type: Object,
      config: false,
      onChange: fetchParams
    })
  }
  game.settings.register("dae", "showInline", {
    scope: "client",
    name: game.i18n.localize("dae.ShowInline.Name"),
    hint: game.i18n.localize("dae.ShowInline.Hint"),
    default: false,
    config: true,
    type: Boolean,
    onChange: fetchParams
  });
  game.settings.register("dae", "DAETitleBar", {
    name: game.i18n.localize("dae.DAETitleBar.Name"),
    hint: game.i18n.localize("dae.DAETitleBar.Hint"),
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  game.settings.register("dae", "DIMETitleBar", {
    name: game.i18n.localize("dae.DIMETitleBar.Name"),
    hint: game.i18n.localize("dae.DIMETitleBar.Hint"),
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  game.settings.register("dae", "DIMESyncItemacro", {
    name: game.i18n.localize("dae.DIMESyncItemacro.Name"),
    hint: game.i18n.localize("dae.DIMESyncItemacro.Hint"),
    scope: "world",
    default: true,
    type: Boolean,
    config: true
  });

  game.settings.register("dae", "DAEColorTitleBar", {
    name: game.i18n.localize("dae.DAEColorTitleBar.Name"),
    hint: game.i18n.localize("dae.DAEColorTitleBar.Hint"),
    scope: "world",
    default: true,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  game.settings.register("dae", "DAENoTitleText", {
    name: game.i18n.localize("dae.DAENoTitleText.Name"),
    hint: game.i18n.localize("dae.DAENoTitleText.Hint"),
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    onChange: fetchParams
  });

  game.settings.register("dae", "DAEAddHalfHealthEffect", {
    name: game.i18n.localize("dae.DAEAddHalfHealthEffect.Name"),
    hint: game.i18n.localize("dae.DAEAddHalfHealthEffect.Hint"),
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    onChange: fetchParams,
    //@ts-expect-error
    requiresReload: true
  });

  game.settings.register("dae", "DAEUntestedSystems", {
    name: game.i18n.localize("dae.DAEUntestedSystems.Name"),
    hint: game.i18n.localize("dae.DAEUntestedSystems.Hint"),
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
    onChange: fetchParams,
    //@ts-expect-error
    choices: { none: "None", warn: "warnings", debug: "debug", all: "all" }

  });

  game.settings.register("dae", "disableEffects", {
    name: "dae.DisableEffects.Name",
    hint: "dae.DisableEffects.Hint",
    scope: "world",
    default: false,
    type: Boolean,
    config: true,
    //@ts-expect-error
    requiresReload: true
  })

};
