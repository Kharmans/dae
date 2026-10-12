import { socketlibSocket } from "./GMAction.js";
import { warn, error, debug, i18n } from "../dae.js";
import { TokenOrDocument } from "../globals.js";
import { AnyMutableObject } from "fvtt-types/utils";

function getTokenUuid(token: TokenOrDocument) {
  if (token instanceof foundry.canvas.placeables.Token) return token.document.uuid;
  if (token instanceof TokenDocument) return token.uuid;
  return undefined;
}

function resolveTokenUuid(tokenOrId: TokenOrDocument | string): string | undefined {
  if (typeof tokenOrId !== "string") return getTokenUuid(tokenOrId);
  if (tokenOrId.startsWith("Scene")) return tokenOrId;
  return `Scene.${canvas?.scene?.id}.Token.${tokenOrId}`;
}

function resolveActorRef(tactor: Actor.Implementation | foundry.canvas.placeables.Token.Implementation | string): { actorId?: string | null; actorUuid?: string } | undefined {
  if (typeof tactor === "string") {
    if (tactor.startsWith("Scene") || tactor.startsWith("Actor")) return { actorUuid: tactor };
    return { actorId: tactor };
  }
  const actor = tactor instanceof foundry.canvas.placeables.Token ? tactor.actor : tactor instanceof Actor ? tactor : undefined;
  if (!actor) return undefined;
  return { actorId: actor.id, actorUuid: actor.uuid };
}

function findTokenInScene(tokenName: string, scene: Scene): TokenDocument.Implementation | undefined {
  return scene.tokens.getName(tokenName) ?? scene.tokens.get(tokenName) ?? undefined;
}

let tokenScene = (tokenName: string, sceneName: string) => {
  const scenes = sceneName ? [game.scenes?.getName(sceneName)] : (game.scenes ?? []);
  for (const scene of scenes) {
    if (!scene) continue;
    const found = findTokenInScene(tokenName, scene);
    if (found) return { scene, found };
  }
  return { scene: null, tokenDocument: null };
}

export let moveToken = async (token: TokenOrDocument, targetTokenName: string, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") => {
  let { scene, found } = tokenScene(targetTokenName, targetSceneName);
  if (!token) {
    warn("dae | moveToken: Token not found");
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
      tokenData: (token instanceof TokenDocument ? token : token.document).toObject(false),
      x: found.x + xGridOffset * (canvas.scene?.grid.size ?? 100),
      y: found.y + yGridOffset * (canvas.scene?.grid.size ?? 100)
    });
}

export let renameToken = async (token: foundry.canvas.placeables.Token.Implementation, newName: string) => {
  socketlibSocket.executeAsGM("renameToken", { userId: game.user?.id, startSceneId: canvas.scene?.id, tokenData: token.document.toObject(false), newName });
}

export async function teleportToken(token: TokenOrDocument, scene: Scene.Implementation | string, position: {x:number, y: number}) {
  let theScene: Scene.Implementation | undefined;
  if (typeof scene === "string") theScene = game.scenes?.get(scene);
  else theScene = scene;
  return teleport(token, theScene, position.x, position.y)
}
export let teleportToToken = async (token: TokenOrDocument, targetTokenName: string, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") => {
  let { scene, found } = tokenScene(targetTokenName, targetSceneName);
  if (!token) {
    error("dae | teleportToToken: Token not found");
    return ("Token not found")
  }
  if (!found || !scene) {
    error("dae | teleportToToken: Target Not found");
    return `Token ${targetTokenName} not found`;
  }
  return await teleport(token, scene, found.x + xGridOffset * (canvas.scene?.grid.size ?? 100), found.y + yGridOffset * (canvas.scene?.grid.size ?? 100))
}

export async function createToken(tokenData: TokenDocument.CreateData, x: number, y: number) {
  let targetSceneId = canvas?.scene?.id;
  // requestGMAction(GMAction.actions.createToken, {userId: game.user.id, targetSceneId, tokenData, x, y})
  return socketlibSocket.executeAsGM("createToken", { userId: game.user?.id, targetSceneId, tokenData, x, y })
}

export let teleport = async (token: TokenOrDocument, targetScene: Scene | undefined, xpos: number, ypos: number) => {
  token = token instanceof TokenDocument ? token.object! : token;
  let x = Number(xpos);
  let y = Number(ypos);

  if (isNaN(x) || isNaN(y)) {
    error("dae | teleport: Invalid co-ords", xpos, ypos);
    return `Invalid target co-ordinates (${xpos}, ${ypos})`;
  }

  if (!token) {
    console.warn("dae | teleport: No Token");
    return "No active token";
  }

  if (!targetScene) {
    console.warn("dae | teleport: No Scene");
    return "No scene";
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
  let sourceSceneId = canvas?.scene?.id;
  Hooks.once("canvasReady", () => {
    socketlibSocket.executeAsGM("createToken", { userId: game.user?.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.document.toObject(false), x: xpos, y: ypos })
      .then(async () => {
        await socketlibSocket.executeAsGM("deleteToken", { userId: game.user?.id, tokenUuid: getTokenUuid(token) })
      })
      .catch(err => console.error("dae | cross-scene teleport failed", err));
  });

  // Need to stop animation since we are going to delete the token and if that happens before the animation completes we get an error
  foundry.canvas.animation.CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);
  return await targetScene.view();
}

export async function setTokenVisibility(tokenOrId: string | TokenOrDocument, visible: boolean) {
  return socketlibSocket.executeAsGM("setTokenVisibility", { tokenUuid: resolveTokenUuid(tokenOrId), hidden: !visible });
}

export async function setTileVisibility(tileOrId: TileDocument.Implementation | string, visible: boolean) {
  let tileUuid: string | undefined;
  if (tileOrId instanceof TileDocument) tileUuid = tileOrId.uuid;
  else {
    let tile = fromUuidSync(tileOrId) as TileDocument.Implementation | undefined;
    if (!tile) tile = canvas.scene?.tiles.get(tileOrId);
    if (tile) tileUuid = tile.uuid;
  }
  if (!tileUuid) return;
  return socketlibSocket.executeAsGM("setTileVisibility", { tileUuid, hidden: !visible });
}

export async function blindToken(tokenOrId: TokenOrDocument | string) {
  return socketlibSocket.executeAsGM("blindToken", { tokenUuid: resolveTokenUuid(tokenOrId) });
}

export async function restoreVision(tokenOrId: TokenOrDocument | string) {
  return socketlibSocket.executeAsGM("restoreVision", { tokenUuid: resolveTokenUuid(tokenOrId) });
}

export function getTokenFlag(token: TokenOrDocument, flagName: string) {
  const tokenDocument = token instanceof TokenDocument ? token : token.document;
  return foundry.utils.getProperty(tokenDocument, `flags.dae.${flagName}`);
}

export async function deleteItemActiveEffects(tokens: Array<string | TokenOrDocument>, origin: string, ignore: string[] = [], deleteEffects: string[] = [], removeSequencer: boolean = true, options?: any) {
  const targets = tokens.map(t => ({"uuid": typeof t === "string" ? t : getTokenUuid(t)}));
  return socketlibSocket.executeAsGM("deleteEffects", { targets, origin, ignore, deleteEffects, removeSequencer, options});
}

export async function deleteActiveEffect(uuid: string, origin: string, ignore: string[] = [], deleteEffects: string[] = [], removeSequencer: boolean = true, options?: any) {
  return socketlibSocket.executeAsGM("deleteEffects", { targets: [{ uuid }], origin, ignore, deleteEffects, removeSequencer, options });
}

export async function setTokenFlag(tokenOrId: TokenOrDocument | string, flagName: string, flagValue: any) {
  return socketlibSocket.executeAsGM("setTokenFlag", { tokenUuid: resolveTokenUuid(tokenOrId) ?? "", flagName, flagValue });
}

export function getFlag(entity: Actor.Implementation | TokenOrDocument | string, flagId: string) {
  let theActor: Actor.Implementation | undefined | null;
  if (!entity) return error(`dae.getFlag: entity not defined`);
  if (typeof entity === "string") { 
    // Try as UUID, see if actor
    let retrievedDocument = fromUuidSync(entity);
    if (retrievedDocument instanceof Actor)
      theActor = retrievedDocument;
    else if (retrievedDocument instanceof TokenDocument)
      theActor = retrievedDocument.actor;
    else {
      // Try as token ID
      theActor = canvas.tokens?.get(entity)?.actor;
      // Try as actor ID
      if (!theActor) theActor = game.actors!.get(entity);
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

export async function setFlag(tactor: Actor.Implementation | foundry.canvas.placeables.Token.Implementation | string, flagId: string, value: any) {
  const ref = resolveActorRef(tactor);
  if (!ref) return error(`dae.setFlag: actor not defined`);
  return socketlibSocket.executeAsGM("setFlag", { ...ref, flagId, value });
}

export async function unsetFlag(tactor: Actor.Implementation | foundry.canvas.placeables.Token.Implementation | string, flagId: string) {
  const ref = resolveActorRef(tactor);
  if (!ref) return error(`dae.unsetFlag: actor not defined`);
  return socketlibSocket.executeAsGM("unsetFlag", { ...ref, flagId });
}

export async function macroActorUpdate(...args) {
  let [action, actorUuid, type, value, targetField, undo] = args as [string, string, string, string | boolean | number, string, string | boolean | undefined];
  const lastArg = args[args.length - 1];
  // Without an undo argument, lastArg lands in its place.
  if (undo === lastArg) undo = undefined;
  if (!actorUuid || !type || value === undefined || value === null || value === "" || !targetField) {
    console.warn("dae | macro.actorUpdate: missing arguments (actorUuid, type, expression, targetField, [undo])", ...args);
    return;
  }

  const tactor = await fromUuid(actorUuid) as Actor.Implementation | TokenDocument.Implementation;
  const actor = tactor instanceof TokenDocument ? tactor.actor : tactor;
  if (!actor) { console.warn("dae | macro.actorUpdate: actor not found", actorUuid); return; }

  const fieldDef = `flags.dae.actorUpdate.${lastArg.effectId}.${targetField}`;
  const actorValue = foundry.utils.getProperty(actor, targetField);
  const rollContext = actor.getRollData() as AnyMutableObject;
  rollContext.stackCount = lastArg.efData.flags?.dae?.stacks ?? 1;

  const doUpdate = async (update) => {
    if (actor.isOwner) return actor.update(update);
    return socketlibSocket.executeAsGM("_updateActor", { actorUuid: actor.uuid, update });
  };

  if (["on", "each"].includes(action)) {
    if (type === "boolean") value = !!JSON.parse(value as string);
    else if (type === "number") {
      let op = ' ';
      if (typeof value === "string") { value = value.trim(); op = value[0]; }
      value = `${value}`.replace(/(\*\*(.+?)\*\*)/g, "@$2");
      const formula = (['+', '-', '*', '/'].includes(op) && Number.isNumeric(actorValue)) ? `${actorValue}${value}` : value as string;
      value = (await new Roll(formula, rollContext).evaluate()).total;
    }
    // "each" keeps the value saved by "on", so "off" restores the original.
    const stored = foundry.utils.getProperty(actor, fieldDef) as { oldValue?: unknown } | undefined;
    const oldValue = action === "each" && stored ? stored.oldValue : actorValue;
    return doUpdate({ [fieldDef]: { oldValue, updateValue: value }, [targetField]: value });
  }

  if (action === "off") {
    const { oldValue = 0, updateValue } = (foundry.utils.getProperty(actor, fieldDef) as { oldValue: number, updateValue: number }) ?? {};
    if (undo === undefined) undo = true;
    if (typeof undo === "string") {
      undo = undo.replace(/(\*\*(.+?)\*\*)/g, "@$2").trim();
      if (undo === "restore") undo = true;
    }
    let restoreValue: number | string | boolean | undefined;
    if (undo === true) restoreValue = oldValue;
    else if (undo === false) return;
    else if (undo === "undefined") restoreValue = undefined;
    else if (typeof undo === "string" && undo === "remove") restoreValue = Math.max(0, (actorValue as number) - (updateValue - oldValue));
    else if (typeof undo === "string" && type === "number" && ["+", "-", "/", "*"].includes(undo[0]))
      restoreValue = (await new Roll(`${actorValue}${undo}`, rollContext).roll()).total;
    else if (typeof undo === "string" && type === "number") {
      if (undo.includes("actorValue")) undo = undo.replace("actorValue", `${actorValue}`);
      restoreValue = (await new Roll(`${undo}`, rollContext).evaluate()).total;
    } else if (typeof undo === "string") restoreValue = JSON.parse(undo);

    const update = { [targetField]: restoreValue };
    foundry.utils.setProperty(update, `flags.dae.actorUpdate.${lastArg.effectId}`, new foundry.data.operators.ForcedDeletion());
    return doUpdate(update);
  }
}
