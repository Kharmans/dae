import { socketlibSocket } from "./GMAction.js";
import { warn, error, debug, i18n } from "../dae.js";

export let applyActive = (itemName: string, activate: boolean = true, itemType: string = "") => {
}

function getTokenUuid(token: foundry.canvas.placeables.Token.Implementation | TokenDocument.Implementation) {
  if (token instanceof foundry.canvas.placeables.Token) return token.document.uuid;
  if (token instanceof TokenDocument) return token.uuid;
  return undefined;
}
export let activateItem = () => {
  const speaker = ChatMessage.getSpeaker();
  const token = canvas?.tokens?.get(speaker.token ?? "");
  if (!token) {
    ui.notifications?.warn(i18n("dae.noSelection"))
    return;
  }
  // return new ActiveItemSelector(token.actor, {}).render(true);
}

let tokenScene = (tokenName, sceneName) => {
  if (!sceneName) {
    for (let scene of game.scenes ?? []) {
      let found = scene.tokens.getName(tokenName);
      if (found) return { scene, found };
      found = scene.tokens.get(tokenName);
      if (found) return { scene, found };
    }
  } else {
    let scene = game.scenes?.getName(sceneName)
    if (scene) {
      let found = scene.tokens.getName(tokenName)
      if (found) {
        return { scene, found };
      }
      found = scene.tokens.get(tokenName)
      if (found) {
        return { scene, found };
      }
    }
  }
  return { scene: null, tokenDocument: null };
}

export let moveToken = async (token, targetTokenName, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") => {
  let { scene, found } = tokenScene(targetTokenName, targetSceneName);
  if (!token) {
    warn("Dynmaiceffects | moveToken: Token not found");
    return ("Token not found")
  }
  if (!found) {
    warn("dae | moveToken: Target Not found");
    return `Token ${targetTokenName} not found`;
  }
  socketlibSocket.executeAsGM("recreateToken",
    {
      userId: game.user?.id,
      startSceneId: canvas?.scene?.id,
      tokenUuid: getTokenUuid(token),
      targetSceneId: scene?.id, 
      tokenData: token.document.toObject(false),
      x: found.x + xGridOffset * (canvas.scene?.grid.size ?? 100),
      y: found.y + yGridOffset * (canvas.scene?.grid.size ?? 100)
    });
}

export let renameToken = async (token: Token, newName: string) => {
  socketlibSocket.executeAsGM("renameToken", { userId: game.user?.id, startSceneId: canvas.scene?.id, tokenData: token.document.toObject(false), newName });
}

export async function teleportToken(token: Token, scene: Scene | string, position: {x:number, y: number}) {
  let theScene: Scene;
  if (typeof scene === "string") theScene = game.scenes?.get(scene) as Scene;
  else theScene = scene;
  return teleport(token, theScene, position.x, position.y)
}
export let teleportToToken = async (token, targetTokenName, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") => {
  let { scene, found } = tokenScene(targetTokenName, targetSceneName);
  if (!token) {
    error("dae| teleportToToken: Token not found");
    return ("Token not found")
  }
  if (!found || !scene) {
    error("dae| teleportToToken: Target Not found");
    return `Token ${targetTokenName} not found`;
  }
  return await teleport(token, scene, found.x + xGridOffset * (canvas.scene?.grid.size ?? 100), found.y + yGridOffset * (canvas.scene?.grid.size ?? 100))
}

export async function createToken(tokenData: TokenDocument.CreateData, x: number, y: number) {
  let targetSceneId = canvas?.scene?.id;
  // requestGMAction(GMAction.actions.createToken, {userId: game.user.id, targetSceneId, tokenData, x, y})
  return socketlibSocket.executeAsGM("createToken", { userId: game.user?.id, targetSceneId, tokenData, x, y })
}

export let teleport = async (token: Token, targetScene: Scene, xpos, ypos) => {
  let x = Number(xpos);
  let y = Number(ypos);

  if (isNaN(x) || isNaN(y)) {
    error("dae| teleport: Invalid co-ords", xpos, ypos);
    return `Invalid target co-ordinates (${xpos}, ${ypos})`;
  }

  if (!token) {
    console.warn("dae | teleport: No Token");
    return "No active token"
  }

  // Hide the current token
  if (targetScene.name === canvas?.scene?.name) {
    foundry.canvas.animation.CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);
    let sourceSceneId = canvas.scene?.id;
    await socketlibSocket.executeAsGM("recreateToken", { userId: game.user!.id, tokenUuid: getTokenUuid(token), startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.document.toObject(false), x: xpos, y: ypos });
    canvas.pan({ x: xpos, y: ypos });
    return true;
  }
  // deletes and recreates the token
  var sourceSceneId = canvas?.scene?.id;
  Hooks.once("canvasReady", () => {
    socketlibSocket.executeAsGM("createToken", { userId: game.user?.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.document.toObject(false), x: xpos, y: ypos })
      .then(async () => {
        // canvas.pan({ x: xpos, y: ypos });
    
        // await requestGMAction(GMAction.actions.deleteToken, { userId: game.user.id, tokenUuid: getTokenUuid(token)});
        await socketlibSocket.executeAsGM("deleteToken", { userId: game.user?.id, tokenUuid: getTokenUuid(token) })
      });
  });

  // Need to stop animation since we are going to delete the token and if that happens before the animation completes we get an error
  foundry.canvas.animation.CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);
  return await targetScene.view();
}

export async function setTokenVisibility(tokenOrId: string | Token, visible: boolean) {
  let tokenUuid: string;
  if (typeof tokenOrId !== "string") tokenUuid = getTokenUuid(tokenOrId) as string;
  else if (tokenOrId.startsWith("Scene")) tokenUuid = tokenOrId;
  else tokenUuid = `Scene.${canvas?.scene?.id}.Token.${tokenOrId}`;
  return socketlibSocket.executeAsGM("setTokenVisibility", { tokenUuid, hidden: !visible });
}

export async function setTileVisibility(tileOrId: TileDocument | string, visible: boolean) {
  let tileUuid: string;
  let tile: TileDocument;
  if (typeof tileOrId !== "string") {
    tileUuid = tileOrId.uuid;
    tile = tileOrId
  } else {
    if (!(tileOrId.startsWith("Scene."))) {
      tileUuid = `Scene.${canvas?.scene?.id}.Tile.${tileOrId}`;
    } else tileUuid = tileOrId;
    tile = await fromUuid(tileUuid) as TileDocument;
  }
  return socketlibSocket.executeAsGM("setTileVisibility", { tileUuid, hidden: !visible });
}

// TODO fix this for v10
export async function blindToken(tokenOrId: Token | string) {
  let tokenUuid: string | undefined;
  if (typeof tokenOrId !== "string") tokenUuid = getTokenUuid(tokenOrId);
  else if (tokenOrId.startsWith("Scene")) tokenUuid = tokenOrId;
  else tokenUuid = `Scene.${canvas?.scene?.id}.Token.${tokenOrId}`;
  return socketlibSocket.executeAsGM("blindToken", { tokenUuid });
}

// TODO fix this for v10
export async function restoreVision(tokenOrId: Token | string) {
  let tokenUuid: string | undefined;
  if (typeof tokenOrId !== "string") tokenUuid = getTokenUuid(tokenOrId);
  else if (tokenOrId.startsWith("Scene")) tokenUuid = tokenOrId;
  else tokenUuid = `Scene.${canvas?.scene?.id}.Token.${tokenOrId}`;
  return socketlibSocket.executeAsGM("restoreVision", { tokenUuid });
}

export let macroReadySetup = () => {
}

export function getTokenFlag(token: Token | any /* TokenDocument*/, flagName: string) {
  const tokenDocument = token.document ? token.document: token;
  return foundry.utils.getProperty(token.document, `flags.dae.${flagName}`);
}

export async function deleteItemActiveEffects(tokens: Array<string | foundry.canvas.placeables.Token.Implementation | TokenDocument.Implementation>, origin: string, ignore: string[] = [], deleteEffects: string[] = [], removeSequencer: boolean = true, options?: any) {
  const targets = tokens.map(t => ({"uuid": typeof t === "string" ? t : getTokenUuid(t)}));
  return socketlibSocket.executeAsGM("deleteEffects", { targets, origin, ignore, deleteEffects, removeSequencer, options});
}

export async function deleteActiveEffect(uuid: string, origin: string, ignore: string[] = [], deleteEffects: string[] = [], removeSequencer: boolean = true, options?: any) {
  return socketlibSocket.executeAsGM("deleteEffects", { targets: [{ uuid }], origin, ignore, deleteEffects, removeSequencer, options });
}

export async function setTokenFlag(tokenOrId: foundry.canvas.placeables.Token.Implementation | string | TokenDocument.Implementation, flagName: string, flagValue: any) {
  let tokenUuid: string = "";
  if (typeof tokenOrId === "string") {
    if (tokenOrId.startsWith("Scene.")) tokenUuid = tokenOrId;
    else tokenUuid = canvas?.scene?.tokens.get(tokenOrId)?.uuid ?? "";
  } 
  else tokenUuid = getTokenUuid(tokenOrId) ?? "";
  return socketlibSocket.executeAsGM("setTokenFlag", { tokenUuid: tokenUuid, flagName, flagValue });
}

export function getFlag(entity: Actor | Token | string, flagId: string) {
  let theActor: Actor | undefined  | null;
  if (!entity) return error(`dae.getFlag: actor not defined`);
  if (typeof entity === "string") { 
    theActor = (fromUuidSync(entity) as TokenDocument)?.actor;
    // assume string === tokenId
    if (!theActor) theActor = canvas?.tokens?.get(entity)?.actor;
    if (!theActor) theActor = game.actors?.get(entity); // if not a token maybe an actor
    if (!theActor) {
      const actor = fromUuidSync(entity);
      // @ts-expect-error
      theActor = actor?.actor ?? actor;
    }
  } else {
    if (entity instanceof Actor)
      theActor = entity;
    else
      theActor = entity.actor;
  }
  if (!theActor) return error(`dae.getFlag: actor not defined`)
  warn("dae get flag ", entity, theActor, foundry.utils.getProperty(theActor, `flags.dae.${flagId}`))
  return foundry.utils.getProperty(theActor, `flags.dae.${flagId}`)
}

export async function setFlag(tactor: Actor | Token | string, flagId: string, value: any) {
  if (typeof tactor === "string" && (tactor.startsWith("Scene") || tactor.startsWith("Actor"))) {
    return socketlibSocket.executeAsGM("setFlag", { actorUuid: tactor, flagId, value });
  } if (typeof tactor === "string") {
    return socketlibSocket.executeAsGM("setFlag", { actorId: tactor, flagId, value });
    // return requestGMAction(GMAction.actions.setFlag, { actorId: actor, flagId, value})
  }
  let actor: Actor | undefined | null;
  if (tactor instanceof foundry.canvas.placeables.Token) actor = tactor.actor;
  if (tactor instanceof Actor) actor = tactor;
  if (!actor) return error(`dae.setFlag: actor not defined`);
  return socketlibSocket.executeAsGM("setFlag", { actorId: actor.id, actorUuid: actor.uuid, flagId, value });
  // return requestGMAction(GMAction.actions.setFlag, { actorId: actor.id, actorUuid: actor.uuid, flagId, value})
}

export async function unsetFlag(tactor: Actor | Token | string, flagId) {
  if (typeof tactor === "string" && (tactor.startsWith("Scene") || tactor.startsWith("Actor"))) {
    return socketlibSocket.executeAsGM("unsetFlag", { actorUuid: tactor, flagId });
  } if (typeof tactor === "string") {
    return socketlibSocket.executeAsGM("unsetFlag", { actorId: tactor, flagId });
    // return requestGMAction(GMAction.actions.setFlag, { actorId: actor, flagId, value})
  }
  let actor: Actor | undefined | null;
  if (tactor instanceof foundry.canvas.placeables.Token) actor = tactor.actor;
  if (tactor instanceof Actor) actor = tactor;
  if (!actor) return error(`dae.setFlag: actor not defined`)
  return socketlibSocket.executeAsGM("unsetFlag", { actorId: actor.id, actorUuid: actor.uuid, flagId });
  // return requestGMAction(GMAction.actions.unsetFlag, { actorId: actor.id, actorUuid: actor.uuid, flagId})
}

export async function macroActorUpdate(...args) {
  let [onOff, actorUuid, type, value, targetField, undo] = args;
  //if (args.length>6) undo = args.slice(5,-1).join('');    //someone might have forgotten to wrap the undo within ""
  const lastArg =  args[args.length -1];
  if (!(actorUuid && type && value && targetField)) {
    console.warn("dae | invalid arguments passed ", ...args)
    console.warn(`dae | macro.actorUpdate expects the following arguments:
      actorUuid: string
      type: "number", "boolean", "string"
      expression: a roll expression, optionally starting with +-/*
      targetField: "string", e.g. system.attrbutes.hp.value
      undo: 
          blank/true/restore: set the target field back to what it was before the effect was applied
          false: don't change the target field when removing the effect
          remove: remove the numeric effect of the change to the target field
          "+-*/"newValue add/subtract/multiply/divide the value of the field with the newValue
    `);
    return;
  }

  let tactor: any = await fromUuid(actorUuid);
  let actor;
  actor = tactor.actor ? tactor.actor : tactor;
  // const fieldDef = `flags.dae.save.${targetField}`;
  const fieldDef = `flags.dae.actorUpdate.${lastArg.effectId}.${targetField}`;
  let actorValue = foundry.utils.getProperty(actor, targetField);
  if (args[0] === "each") {
    // for subsequent executions we have to recover the origianl actor value from the saved value.
    const fieldValue = foundry.utils.getProperty(actor, fieldDef);
    // @ts-expect-error
    actorValue = fieldValue.actorValue;
  }
  const rollContext = actor.getRollData();
  rollContext.stackCount = lastArg.efData.flags?.dae?.stacks ?? 1;
  if (["on", "each"].includes(args[0])) {
    if (!game.user?.isGM) {
      console.warn(`dae | macro.actorUpdate user ${game.user?.name} is updating ${actor.name} ${targetField}`);
    }
    switch (type) {
      case 'boolean':
        value = JSON.parse(value) ? true : false;
        break;
      case 'number':
        let op = ' ';
        if (typeof value === 'string') {
          value = value.trim();
          op = value[0];
        }
        value = `${value}`.replace(/(\*\*(.+?)\*\*)/g, '@$2');
        if (['+', '-', '*', '/'].includes(op) && Number.isNumeric(actorValue)) 
          value = new Roll(`${actorValue}${value}`, rollContext).evaluateSync({ strict: false }).total;
        else 
          value = new Roll(value, rollContext).evaluateSync({ strict: false }).total;
        break;
      default: // assume a string
    }
    const update = {};
    update[fieldDef] = {oldValue: actorValue, updateValue: value};
    update[targetField] = value;
    if (actor.isOwner) return await actor.update(update);
    else return await socketlibSocket.executeAsGM("_updateActor", {actorUuid: actor.uuid, update});
  } else if (args[0] === "off") {
    // @ts-expect-error
    const {oldValue = undefined, updateValue} = foundry.utils.getProperty(actor, fieldDef);
    let restoreValue;
    if (undo === undefined) undo = true;
    if (typeof undo === "string") undo = undo.replace(/(\*\*(.+?)\*\*)/g, "@$2");
    if (typeof undo === "string") {
      undo = undo.trim();
    } 
    if (typeof undo === "string" && undo === "restore") {
      undo = true;
    }
    if (typeof undo === "string" && undo === "remove") {
      // @ts-expect-error
      restoreValue = Math.max(0, actorValue - (updateValue - oldValue))
    } else if (typeof undo == "string" && type === "number" && ["+","-","/","*"].includes(undo[0])) {
      restoreValue = (await new Roll(`${actorValue}${undo}`, rollContext).roll()).total;
    } else if (typeof undo === "string" /*&&!undo.includes("Actor") && !undo.includes("Token")*/ && type === "number") {
      if (undo.includes("actorValue")) undo = undo.replace("actorValue",`${actorValue}`);
      restoreValue = new Roll(`${undo}`, rollContext).evaluateSync({strict: false}).total;
    } else if (undo === "undefined") {
      restoreValue = undefined;
    } else if (typeof undo === "string") {
      restoreValue = JSON.parse(undo);
    }
    if (undo === true) restoreValue = oldValue;

    if (undo !== false) {
      const update = {};
      foundry.utils.setProperty(update, `flags.dae.actorUpdate.-=${lastArg.effectId}`, null);
      update[targetField] = restoreValue;
      if (actor.isOwner) return await actor.update(update);
      else return await socketlibSocket.executeAsGM("_updateActor", {actorUuid: actor.uuid, update})
    }
  }
}
