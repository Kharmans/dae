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

}

export function getTokenFlag(token: Token, flagName: string) {
    return getProperty(token, `data.flags.dae.${flagName}`);
}

export function setTokenFlag(token: Token | string, flagName: string, flagValue: any) {
  const tokenId = (typeof token === "string") ? token : token.id;
  return requestGMAction(GMAction.actions.setTokenFlag, { tokenId: tokenId, sceneId: canvas.scene.id, flagName, flagValue })
}

export function getFlag(actor: Actor | Token | string, flagId: string) {
  let theActor : Actor;
  if (!actor) return error(`dae.getFlag: actor not defined`);
  if (typeof actor === "string") {
    theActor = canvas.tokens.get(actor)?.actor;
    if (!theActor) theActor = game.actors.get(actor);
  } else {
    const id = actor.id;
    const token: Token = canvas.tokens.get(actor.id);
    if (token) theActor = token.actor;
    else theActor = game.actors.get(actor.id)
  }
  if (!theActor) return error(`dae.getFlag: actor not defined`)
  warn("dae get flag ", actor, theActor, getProperty(theActor.data, `flags.dae.${flagId}`))
  return getProperty(theActor.data, `flags.dae.${flagId}`)
}

export function setFlag(actor: Actor | Token | string, flagId: string, value: any) {
  if (typeof actor === "string") {
    return requestGMAction(GMAction.actions.setFlag, { actorId: actor, flagId, value})
  }
  if (!actor) return error(`dae.setFlag: actor not defined`)
  return requestGMAction(GMAction.actions.setFlag, { actorId: actor.id, flagId, value})
}

export function unsetFlag(actor: Actor | Token | string, flagId) {
  if (typeof actor === "string") {
    return requestGMAction(GMAction.actions.unsetFlag, { actorId: actor, flagId})
  }
  if (!actor) return error(`dae.setFlag: actor not defined`)
  return requestGMAction(GMAction.actions.unsetFlag, { actorId: actor.id, flagId})

}