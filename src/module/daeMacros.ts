import { requestGMAction, GMAction } from "./GMAction";
import { aboutTimeInstalled, ValidSpec, doEffects, playersCanSeeEffects, validateDuration } from "./dae";

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
  if (!actor) return false;
  let consumeCharge = game.settings.get("dae", "ConsumeCharge");
  const item = actor ? actor.items.find(i => i.name === itemName && (itemType === "" || itemType === i.data.type)) : null;
  if (!item) {
    ui.notifications.warn(`${game.i18n.localize("dae.noeffect")} ${itemName}`);
    return false;
  }

  let useUpdate = {};
  let consumeUpdate = {};
  let newStatus;
  if (["class", "spell", "feat"].includes(item.data.type)) {
/*    if (!hasProperty(item.data, "flags.dae.alwaysActive")) {
      console.log(`Dynamic Effects | item ${item.name} has no alwaysActive property can't toggle`)
      return false;
    }
    */
    newStatus = !item.data.flags.dae.alwaysActive;
    if (overRide !== undefined) {
      newStatus = overRide;
    }
    useUpdate = { "_id": item.id, "flags.dae.alwaysActive": newStatus };
  } else { // equip/unequip
    newStatus = !item.data.data.equipped;
    if (overRide !== undefined) {
      newStatus = overRide;
    }
    useUpdate = { "_id": item.id, "data.equipped": newStatus };
  }
  if (consumeCharge && newStatus && item.data.data.uses && item.data.data.uses.max > 0) {
    let oldCharges = item.data.data.uses.value;
    if (oldCharges < 1) {
      if (newStatus) { // no charges and inactive cant make it active
        ui.notifications.info(`${actor.name} ${item.name} ${game.i18n.localize("dae.noCharges")}`)
        return false;
      }
    }
    consumeUpdate = { "data.uses.value": oldCharges - 1, "_id": item.id }
  }
  ui.notifications.info(`${actor.name} ${item.name} ${game.i18n.localize(newStatus ? "dae.active" : "dae.inactive")}`)
  let update = mergeObject(useUpdate, consumeUpdate);
  await actor.updateEmbeddedEntity("OwnedItem", update);
  if (aboutTimeInstalled && newStatus && item.data.data.duration) { //only if about-time installed
    // let secPerRound = game.settings.get("about-time", "seconds-per-round");
    let duration = validateDuration(item.data.data.duration);
    if (duration.value > 0) {
      let spec = {};
      spec[duration.units] = duration.value
      //@ts-ignore
      game.Gametime.doIn(spec, window.dae._toggleActorIdEffect, actor.id, itemName, item.type, false)
    }
  }
  return newStatus;
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
    console.log("Dynmaiceffects | moveToken: Token not found");
    return ("Token not found")
  }
  if (!target) {
    console.log("dae | moveToken: Target Not found");
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
    console.log("dae| teleportToToken: Token not found");
    return ("Token not found")
  }
  if (!target) {
    console.log("dae| teleportToToken: Target Not found");
    return `Token ${targetTokenName} not found`;
  }
  //@ts-ignore target.scene.data.grid
  return teleport(token, target.scene, target.token.x + xGridOffset * target.scene.data.grid, target.token.y + yGridOffset * canvas.scene.data.grid)
}

export let teleport = async (token: Token, targetScene, xpos, ypos) => {
  let x = parseInt(xpos);
  let y = parseInt(ypos);

  if (isNaN(x) || isNaN(y)) {
    console.log("dae| teleport: Invalid co-ords", xpos, ypos);
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

    console.log("Sheet names are ", pcSheetNames)
  pcSheetNames.forEach(sheetName => {
    Hooks.on("render" + sheetName, (app, html, data) => {
      // only for GMs or the owner of this character
      console.log("In add button ", app, data)
      if (!data.owner || !data.actor) return;
      _addEffects(app, html, data);
    });
  })
}

let _addEffects = (app, html, data) => {
  let openBtn = $(`<a class="open-de-effects" title="${"DEEffects"}"><i class="fas fa-clipboard"></i>${"Show DE"}</a>`);
  console.log("Open button called ", openBtn);
  openBtn.click(ev => {
    effectsActor(ev.shiftKey, {actor: app.object})
  });
  html.closest('.app').find('.open-de-effects').remove();
  let titleElement = html.closest('.app').find('.window-title');
  console.log("Title element ", titleElement);
  openBtn.insertAfter(titleElement);
}
