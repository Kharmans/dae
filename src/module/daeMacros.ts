import { socketlibSocket } from "./GMAction";
import { warn, error, debug } from "../dae";
import { DAEfromActorUuid, DAEfromUuid } from "./dae";

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
    for (let scene of game.scenes) {
      //@ts-ignore
      let found = scene.tokens.getName(tokenName);
      if (found) return {scene, found}
    }
  } else {
    //@ts-ignore
    let scene = game.scenes.getName(sceneName)
    if (scene) {
      //@ts-ignore
      let found = scene.tokens.getName(tokenName)
      if (found) {
        return { scene, found };
      }
    }
  }
  return {scene: null, tokenDocument: null};
}

export let moveToken = async (token, targetTokenName, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") => {
  let {scene, found} = tokenScene(targetTokenName, targetSceneName);
  if (!token) {
    warn("Dynmaiceffects | moveToken: Token not found");
    return ("Token not found")
  }
  if (!found) {
    warn("dae | moveToken: Target Not found");
    return `Token ${targetTokenName} not found`;
  }
  socketlibSocket.executeAsGM("recreateToken",
    { userId: game.user.id,
      startSceneId: canvas.scene.id,
      tokenUuid: token.uuid,
       targetSceneId: scene.id, tokenData: token.data,
       x: found.data.x + xGridOffset * canvas.scene.data.grid,
       y: found.data.y + yGridOffset * canvas.scene.data.grid
  });
  /*
  return await requestGMAction(GMAction.actions.recreateToken,
    { userId: game.user.id,
      startSceneId: canvas.scene.id,
      tokenUuid: token.uuid,
       targetSceneId: scene.id, tokenData: token.data,
       x: found.data.x + xGridOffset * canvas.scene.data.grid,
       y: found.data.y + yGridOffset * canvas.scene.data.grid
  });
  */
}

export let renameToken = async(token: Token, newName: string) => {
  // requestGMAction(GMAction.actions.renameToken, { userId: game.user.id, startSceneId: canvas.scene.id,  tokenData: token.data, newName});
  socketlibSocket.executeAsGM("renameToken", { userId: game.user.id, startSceneId: canvas.scene.id,  tokenData: token.data, newName});
}

export let teleportToToken = async (token, targetTokenName, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") => {
  let {scene, found}  = tokenScene(targetTokenName, targetSceneName);
  if (!token) {
    error("dae| teleportToToken: Token not found");
    return ("Token not found")
  }
  if (!found) {
    error("dae| teleportToToken: Target Not found");
    return `Token ${targetTokenName} not found`;
  }
  //@ts-ignore target.scene.data.grid
  return teleport(token, scene, found.data.x + xGridOffset * canvas.scene.data.grid, found.data.y + yGridOffset * canvas.scene.data.grid)
}

export async function createToken (tokenData, x, y) {
  let targetSceneId = canvas.scene.id;
  // requestGMAction(GMAction.actions.createToken, {userId: game.user.id, targetSceneId, tokenData, x, y})
  return socketlibSocket.execuateAsGM("createToken", {userId: game.user.id, targetSceneId, tokenData, x, y})
}

export let teleport = async (token: Token, targetScene, xpos, ypos) => {
  let x = Number(xpos);
  let y = parseInt(ypos);

  if (isNaN(x) || isNaN(y)) {
    error("dae| teleport: Invalid co-ords", xpos, ypos);
    return `Invalid target co-ordinates (${xpos}, ${ypos})`;
  }

  if (!token) {
    console.warn("dae | teleport: No Token");
    return "No active token"
  }

  // Hide the current token
  if (targetScene.name === canvas.scene.name) {
    //@ts-ignore
    CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);
    let sourceSceneId = canvas.scene.id;
    socketlibSocket.executeAsGM("recreateToken", { userId: game.user.id, tokenUuid: token.uuid, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
    //requestGMAction(GMAction.actions.recreateToken, { userId: game.user.id, tokenUuid: token.uuid, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
    canvas.pan({ x: xpos, y: ypos });
    return true;
  }
  // deletes and recreates the token
  var sourceSceneId = canvas.scene.id;
  Hooks.once("canvasReady", async () => {
    await socketlibSocket.executeAsGM("createToken", { userId: game.user.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
    // await requestGMAction(GMAction.actions.createToken, { userId: game.user.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
    // canvas.pan({ x: xpos, y: ypos });

    await socketlibSocket.executeAsGM("deleteToken", { userId: game.user.id, tokenUuid: token.uuid})
    // await requestGMAction(GMAction.actions.deleteToken, { userId: game.user.id, tokenUuid: token.uuid});
  })

  // Need to stop animation since we are going to delete the token and if that happens before the animation completes we get an error
  //@ts-ignore
  CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);

  return await targetScene.view();
}

export async function setTokenVisibility(tokenId: string | Token, visible: boolean) {
  let tokenUuid: string;
  if (typeof tokenId !== "string") tokenUuid = tokenId.uuid;
  else if (tokenId.startsWith("Token")) tokenUuid = tokenId;
  else tokenUuid = `Scene.${canvas.scene.id}.Token.${tokenId}`;
  return socketlibSocket.executeAsGM("setTokenVisibility", { tokenUuid, hidden: !visible });
  // return requestGMAction(GMAction.actions.setTokenVisibility, { targetSceneId: canvas.scene.id, tokenId, hidden: !visible })
}

export async function setTileVisibility(tileId: Tile | string, visible: boolean) {
    let tileUuid: string;
  if (typeof tileId !== "string") tileUuid = tileId.uuid;
  else {
    tileUuid = `Scene.${canvas.scene.id}.Tile.${tileId}`;
  }
  return socketlibSocket.executeAsGM("setTileVisibility", { targetSceneId: canvas.scene.id, tileId, hidden: !visible });
  // return requestGMAction(GMAction.actions.setTileVisibility, { targetSceneId: canvas.scene.id, tileId, hidden: !visible })
}

export async function blindToken(tokenId: Token | string) {
  let tokenUuid: string;
  if (typeof tokenId !== "string") tokenUuid = tokenId.uuid;
  else if (tokenId.startsWith("Token")) tokenUuid = tokenId;
  else tokenUuid = `Scene.${canvas.scene.id}.Token.${tokenId}`;
  return socketlibSocket.executeAsGM("blindToken", { tokenUuid });
  // return requestGMAction(GMAction.actions.blindToken, { tokenId: tokenId, sceneId: canvas.scene.id })
}

export async function restoreVision(tokenId: Token | string) {
  let tokenUuid: string;
  if (typeof tokenId !== "string") tokenUuid = tokenId.uuid;
  else if (tokenId.startsWith("Token")) tokenUuid = tokenId;
  else tokenUuid = `Scene.${canvas.scene.id}.Token.${tokenId}`;
  return socketlibSocket.executeAsGM("restoreVision", { tokenUuid });
  // return requestGMAction(GMAction.actions.restoreVision, { tokenId: tokenId, sceneId: canvas.scene.id })
}

export let macroReadySetup = () => {

}

export function getTokenFlag(token: Token, flagName: string) {
    return getProperty(token, `data.flags.dae.${flagName}`);
}

export async function deleteActiveEffect(actorUuid: string, origin: string, ignore: string[] = []) {
  return socketlibSocket.executeAsGM("deleteEffects", {targets: [{actorUuid}], origin, ignore});
  // requestGMAction(GMAction.actions.deleteEffects, {targets: [{actorUuid}], origin, ignore});
}

export async function setTokenFlag(token: Token | string, flagName: string, flagValue: any) {
  let theToken: Token;
  if (typeof token === "string") theToken = DAEfromUuid(token);
  else theToken = token;
  return socketlibSocket.executeAsGM("setTokenFlag", { tokenUuid: theToken.uuid, flagName, flagValue });
  // return requestGMAction(GMAction.actions.setTokenFlag, { tokenId: tokenId, sceneId: canvas.scene.id, flagName, flagValue })
}

export function getFlag(actor: Actor | Token | string, flagId: string) {
  let theActor : Actor;
  if (!actor) return error(`dae.getFlag: actor not defined`);
  if (typeof actor === "string") { // assume tstring === tokenId
    theActor = canvas.tokens.get(actor)?.actor;
    if (!theActor) theActor = game.actors.get(actor); // if not a token maybe an actor
    if (!theActor) {
      const entity = DAEfromUuid(actor);
      theActor = entity.actor ?? entity;
    }
  } else {
    if (actor instanceof Actor)
      theActor = actor;
    else
      theActor = actor.actor;
  }
  if (!theActor) return error(`dae.getFlag: actor not defined`)
  warn("dae get flag ", actor, theActor, getProperty(theActor.data, `flags.dae.${flagId}`))
  return getProperty(theActor.data, `flags.dae.${flagId}`)
}

export async function setFlag(tactor: Actor | Token | string, flagId: string, value: any) {
  if (typeof tactor === "string") {
    return socketlibSocket.executeAsGM("setFlag", { actorId: tactor, flagId, value});
    // return requestGMAction(GMAction.actions.setFlag, { actorId: actor, flagId, value})
  }
  let actor: Actor;
  if (tactor instanceof Token) actor = tactor.actor;
  if (tactor instanceof Actor) actor = tactor;
  if (!actor) return error(`dae.setFlag: actor not defined`);
  return socketlibSocket.executeAsGM("setFlag", { actorId: actor.id, actorUuid: actor.uuid, flagId, value});
  // return requestGMAction(GMAction.actions.setFlag, { actorId: actor.id, actorUuid: actor.uuid, flagId, value})
}

export async function unsetFlag(tactor: Actor | Token | string, flagId) {

  if (typeof tactor === "string") {
    socketlibSocket.executeAsGM("unsetFlag", { actorId: tactor, flagId});
    // return requestGMAction(GMAction.actions.unsetFlag, { actorId: tactor, flagId})
  }
  let actor: Actor;
  if (tactor instanceof Token) actor = tactor.actor;
  if (tactor instanceof Actor) actor = tactor;
  if (!actor) return error(`dae.setFlag: actor not defined`)
  return socketlibSocket.executeAsGM("unsetFlag", { actorId: actor.id, actorUuid: actor.uuid, flagId});
  // return requestGMAction(GMAction.actions.unsetFlag, { actorId: actor.id, actorUuid: actor.uuid, flagId})
}