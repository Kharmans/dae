import { requestGMAction, GMAction } from "./GMAction";
import { warn, error, debug } from "../dae";

export let applyActive = (itemName: string, activate: boolean = true, itemType: string = "") => {
 
}

export let activateItem = () => {
  //@ts-ignore cant do anything if there are no targets
  const speaker = ChatMessage.getSpeaker();
  const token = canvas.tokens.get(speaker.token);
  if (!token) {
    ui.notifications.warn(`${game.i18n.localize("dae.noSelection")}`)
    return;
  }
  // return new ActiveItemSelector(token.actor, {}).render(true);
}

let effectNameString = function (actor, item, active) {
  let btnStyling = 'width: 22px; height:22px; font-size:10px;line-height:1px';
  btnStyling = "width: 60px; padding:0px; line-height:1px;";
  if (!active) btnStyling = btnStyling.concat("font-weight: bold; color: green");
  let activeString = active ? `${game.i18n.localize("dae.disable")}`
    : `${game.i18n.localize("dae.enable")}`;
  let buttonID = `${item.name}`;
  let btntxt = `<button type="button" id="[${item.name}][${item.type}]" style="${btnStyling}">${activeString}</button>`;
  return `<div class="dae-toggle dae-${active ? "active" : "inactive"}-button">${item.name}: ${btntxt}</div>`
  //               : `<div class="dae-toggle id="${item.name}" dae-inactive-button">${item.name}: ${btntxt}</div>`;
}

export let getEffects = (allEffects: boolean = false, summary: boolean = true, {token = null, activeOnly = false}) => {
}

let createEffectString = (actor, detailed, activeOnly = false) => {
  
}

export let daeShowEffects = (detailed = true, {token = null, activeOnly = false}={}) => {
  const speaker = ChatMessage.getSpeaker();
  token = token || canvas.tokens.get(speaker.token);
  if (!token) {
    ui.notifications.warn(`${game.i18n.localize("dae.noSelection")}`)
    return;
  }
  return effectsActor(detailed, {token, activeOnly});
}

export let effectsActor = (detailed = true, {token = null, actor = null, activeOnly = false}) => {
  if (!token?.actor && !actor) return;
  let flavor = `${"Effect List"}`;
  let effectString = createEffectString(token?.actor || actor, detailed, activeOnly);
  const speaker = {actor: token?.actor?.id || actor.id, alias: token?.actor?.name || actor.name, token: token?.id};
  ChatMessage.create({
    user: game.user.id,
    speaker,
    content: effectString,
    whisper: [game.user.id], // ChatMessage.getWhisperIDs("GM"),
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    flags: { daeEffects: true, detailed: detailed }
  });
}

let activateHandler = async (message, html, data) => {
  if (!getProperty(message, "data.flags.daeEffects")) return;
  let buttons = html.find(".dae-toggle");
  const speaker = message.data.speaker;
  const token = canvas.tokens.get(speaker.token);
  let actor = token?.actor;
  if (!actor) actor = game.actors.get(speaker.actor);
  if (!actor) return;

  for (let i = 0; i < buttons.length; i++) {
    let button = buttons[i];
    const matches = button.children[0].id.match(/\[([^\]]*)\]\[([^\]]*)\]/);
    if (!matches) return;
    const itemName = matches[1];
    const itemType = matches[2];
    button.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await toggleActorEffect(actor, itemName, itemType); // have to await so that we geet updated status
      let messageString = createEffectString(actor, getProperty(message, "data.flags.detailed"))
      message.update({ "_id": message._id, "content": messageString })
    });
  };
  let actives = html.find(".active-effect-delete");
  for (let i = 0; i < actives.length; i++) {
    let active = actives[i];
    let id = active.id;
    active.addEventListener("click", async (ev)=> {
      let token = canvas.tokens.get(message.data.speaker.token);
      let activeEffects = getProperty(token.actor.data, "flags.dae.activeEffects") || [];
      activeEffects = activeEffects.filter(tem => tem.itemId !== id);
      await token.actor.update({"flags.dae.activeEffects": activeEffects}, {});
      let messageString = createEffectString(token.actor, getProperty(message, "data.flags.detailed"))
      message.update({ "_id": message._id, "content": messageString })
    })
  }
}

Hooks.on("renderChatMessage", activateHandler);

export let daeSetPassiveEffect = (itemName: string, setValue = false, itemType: string = "") => {
  const speaker = ChatMessage.getSpeaker();
  const token = canvas.tokens.get(speaker.token);
  if (!token) {
    ui.notifications.warn(`${game.i18n.localize("dae.noSelection")}`)
    return;
  }
  return toggleActorEffect(token.actor, itemName, itemType, setValue)
}

export let daeTogglePassiveEffect = (itemName: string, itemType: string = "") => {
  const speaker = ChatMessage.getSpeaker();
  const token = canvas.tokens.get(speaker.token);
  if (!token) {
    ui.notifications.warn(`${game.i18n.localize("dae.noSelection")}`)
    return;
  }
  return toggleActorEffect(token.actor, itemName, itemType, undefined)
}

/*
export let toggleTokenEffect = async (tokenId: string, itemName: string, itemType: String, overRide: boolean = undefined) => {
  if (!tokenId) return false;
  let token = canvas.tokens.get(tokenId);
  return toggleActorEffect(token.actor, itemName, itemType, overRide);
}
*/
export let toggleActorIdEffect = async (actorId: string, itemName: string, itemType: String = "", overRide: boolean = undefined) => {
  return toggleActorEffect(game.actors.get(actorId), itemName, itemType, overRide);
}

let toggleActorEffect = async (actor: Actor, itemName: string, itemType: String, overRide: boolean = undefined) => {
}

export let removeActiveEffectsToken = () => {
  if (!game.user.isGM) return;
  //canvas.tokens.controlled.forEach(token => removeAllTokenEffects(token));
}

let tokenScene = (tokenName, sceneName) => {
  if (!sceneName) {
    //@ts-ignore
    for (let scene of game.scenes.entities) {
      //@ts-ignore scene.data.tokens
      let token = scene.data.tokens.find(t => t.name === tokenName);
      if (token) {
        return { scene, token };
      }
    }
  } else {
    //@ts-ignore
    let scene = game.scenes.entities.find(t => t.name === sceneName);
    if (scene) {
      //@ts-ignore scene.data.tokens
      let token = scene.data.tokens.find(t => t.name === tokenName);
      if (token) {
        return { scene, token };
      }
    }
  }
  return null;
}

export let moveToken = async (token, targetTokenName, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") => {
  let target = tokenScene(targetTokenName, targetSceneName);
  if (!token) {
    warn("Dynmaiceffects | moveToken: Token not found");
    return ("Token not found")
  }
  if (!target) {
    warn("dae | moveToken: Target Not found");
    return `Token ${targetTokenName} not found`;
  }
  return await requestGMAction(GMAction.actions.recreateToken,
    { userId: game.user.id,
      startSceneId: canvas.scene.id,
       targetSceneId: target.scene.id, tokenData: token.data,
       x: target.token.x + xGridOffset * canvas.scene.data.grid,
       y: target.token.y + yGridOffset * canvas.scene.data.grid
  });
}

export let renameToken = async(token: Token, newName: string) => {
  requestGMAction(GMAction.actions.renameToken, { userId: game.user.id, startSceneId: canvas.scene.id,  tokenData: token.data, newName});
}

export let teleportToToken = async (token, targetTokenName, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") => {
  let target = tokenScene(targetTokenName, targetSceneName);
  if (!token) {
    error("dae| teleportToToken: Token not found");
    return ("Token not found")
  }
  if (!target) {
    error("dae| teleportToToken: Target Not found");
    return `Token ${targetTokenName} not found`;
  }
  //@ts-ignore target.scene.data.grid
  return teleport(token, target.scene, target.token.x + xGridOffset * target.scene.data.grid, target.token.y + yGridOffset * canvas.scene.data.grid)
}

export let teleport = async (token: Token, targetScene, xpos, ypos) => {
  let x = parseInt(xpos);
  let y = parseInt(ypos);

  if (isNaN(x) || isNaN(y)) {
    error("dae| teleport: Invalid co-ords", xpos, ypos);
    return `Invalid target co-ordinates (${xpos}, ${ypos})`;
  }

  if (!token) {
    console.warn("dae| teleport: No Token");
    return "No active token"
  }

  // Hide the current token
  if (targetScene.name === canvas.scene.name) {
    //@ts-ignore
    CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);
    let sourceSceneId = canvas.scene.id;
    requestGMAction(GMAction.actions.recreateToken, { userId: game.user.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
    canvas.pan({ x: xpos, y: ypos });
    return true;
  }
  // deletes and recreates the token
  var sourceSceneId = canvas.scene.id;
  Hooks.once("canvasReady", async () => {
    await requestGMAction(GMAction.actions.createToken, { userId: game.user.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
    // canvas.pan({ x: xpos, y: ypos });
    await requestGMAction(GMAction.actions.deleteToken, { userId: game.user.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
  })

  // Need to stop animation since we are going to delete the token and if that happens before the animation completes we get an error
  //@ts-ignore
  CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);

  return await targetScene.view();
}

export let setTokenVisibility = async (tokenId: any, visible: boolean) => {
  if (typeof tokenId !== "string") tokenId = tokenId.id;
  return requestGMAction(GMAction.actions.setTokenVisibility, { targetSceneId: canvas.scene.id, tokenId, hidden: !visible })
}

export let setTileVisibility = async (tileId: any, visible: boolean) => {
  if (typeof tileId !== "string") tileId = tileId.id;
  return requestGMAction(GMAction.actions.setTileVisibility, { targetSceneId: canvas.scene.id, tileId, hidden: !visible })
}

export let blindToken = async (tokenId: any) => {
  if (typeof tokenId !== "string") tokenId = tokenId.id;
  return requestGMAction(GMAction.actions.blindToken, { tokenId: tokenId, sceneId: canvas.scene.id })
}

export let restoreVision = async (tokenId: any) => {
  if (typeof tokenId !== "string") tokenId = tokenId.id;
  return requestGMAction(GMAction.actions.restoreVision, { tokenId: tokenId, sceneId: canvas.scene.id })
}

export let macroReadySetup = () => {
  //@ts-ignore
  let pcSheetNames = Object.values(CONFIG.Actor.sheetClasses.character).concat(Object.values(CONFIG.Actor.sheetClasses.npc))
    //@ts-ignore
    .map((sheetClass) => sheetClass.cls)
    .map((sheet) => sheet.name);

    debug("Sheet names are ", pcSheetNames)
  pcSheetNames.forEach(sheetName => {
    Hooks.on("render" + sheetName, (app, html, data) => {
      // only for GMs or the owner of this character
      debug("In add button ", app, data)
      if (!data.owner || !data.actor) return;
      _addEffects(app, html, data);
    });
  })
}

export function getTokenFlag(token: Token, flagName: string) {
    return getProperty(token, `data.flags.dae.${flagName}`);
}

export function setTokenFlag(token: Token | string, flagName: string, flagValue: any) {
  const tokenId = (typeof token === "string") ? token : token.id;
  return requestGMAction(GMAction.actions.setTokenFlag, { tokenId: tokenId, sceneId: canvas.scene.id, flagName, flagValue })
}

let _addEffects = (app, html, data) => {
  let openBtn = $(`<a class="open-de-effects" title="${"DEEffects"}"><i class="fas fa-clipboard"></i>${"Show DE"}</a>`);
  debug("Open button called ", openBtn);
  openBtn.click(ev => {
    effectsActor(ev.shiftKey, {actor: app.object})
  });
  html.closest('.app').find('.open-de-effects').remove();
  let titleElement = html.closest('.app').find('.window-title');
  debug("Title element ", titleElement);
  openBtn.insertAfter(titleElement);
}

export function getFlag(actor: Actor | string, flagId: string) {
  if (typeof actor === "string") actor = game.actors.get(actor);
  if (!actor) return console.error(`dae.getFlag: actor not defined`)
  return getProperty(actor.data, `flags.dae.${flagId}`)
}

export function setFlag(actor: Actor | string, flagId: string, value: any) {
  if (typeof actor === "string") actor = game.actors.get(actor);
  if (!actor) return console.error(`dae.setFlag: actor not defined`)
  return requestGMAction(GMAction.actions.setFlag, { actorId: actor.id, flagId, value})
}

export function unsetFlag(actor: Actor | string, flagId) {
  if (typeof actor === "string") actor = game.actors.get(actor);
  if (!actor) return console.error(`dae.setFlag: actor not defined`)
  return requestGMAction(GMAction.actions.unsetFlag, { actorId: actor.id, flagId})

}

export function myExecuteMacro(macroName: string, ...args) {
  const macro = game.macros.getName(macroName);
  //@ts-ignore base macro.execute does not support args
  macro.execute(...args);
}

export async function setupDAEMacros() {
  if (game.user.isGM) {
    var macro;
    ["dae.1Hit", "dae.1Action", "dae.turnEnd", "dae.turnStart"].forEach(macroName => {
      const macros = game.macros.filter(m=> m.name === macroName);
      macros.forEach(m => {
        // m.delete()
      })
    });
  }
}
export function hookCondition(activate, actor, hookName: string, removeConditionMacro: string, actionMacro: string, ...actionArgs) {
  const flagName = `${hookName}${removeConditionMacro}${actionMacro}`;
  const remove = false;
  if (activate) {
    const hookId = Hooks.on(hookName, (...hookArgs) => {

      myExecuteMacro(removeConditionMacro, actor, ...hookArgs, ...actionArgs)
    })
    let currentHooks = getProperty(actor.data, `flags.dae.${flagName}`) || [];
    currentHooks.push(hookId);
    actor.setFlag("dae", `${flagName}`, currentHooks);
  } else {
    let currentHooks = getProperty(actor.data, `flags.dae.${flagName}`) || [];
    currentHooks.forEach(hookId => {
      Hooks.off(hookName, hookId);
    })
    actor.unsetFlag("dae", `${flagName}`);


  }
}