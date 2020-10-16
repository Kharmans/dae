import { removeActiveEffectsToken } from "./daeMacros";
import { aboutTimeInstalled } from "./dae";
import { warn, debug, error } from "../dae";

export class GMActionMessage {
  action: string;
  sender: string;
  targetGM: string; // gm id
  data: {};
  constructor(action: string, sender: string, targetGM: string, data: {})
  {
    this.action = action;
    this.sender = sender;
    this.targetGM = targetGM;
    this.data = data;
  }
}


export let requestGMAction = async (action: string, data: {}, debugLog: boolean = false) => {
  if (game.user.isGM) {
    //@ts-ignore
    return await 
    GMAction.processAction(action, game.user.id, duplicate(data));
  }
  //@ts-ignore
  let intendedGM = game.users.entities.find(u => u.isGM && u.active);
  //@ts-ignore
  // if (!game.user.isTrusted) return;
  if (!intendedGM) {
    ui.notifications.error(`${game.user.name} ${game.i18n.localize("dae.noGM")}`);
    console.error("dae | No GM user connected - cannot do request ", action, data);
    return;
  }
  //@ts-ignore
  let message = new DAE.GMActionMessage(action, game.user.id, intendedGM.id, data);
  debug("About to send message", message)
  //@ts-ignore
  game.socket.emit(DAE.GMAction._moduleSocket, message, resp => {
    debug("message sent")
   });
}

export class GMAction {
  public static actions = {
    test: "testMessage",
    setTokenVisibility: "setTokenVisibility",
    setTileVisibility: "setTileVisibility",
    blindToken: "blindToken",
    restoreVision: "restoreVision",
    recreateToken: "recreateToken",
    createToken: "createToken",
    deleteToken: "deleteToken",
    renameToken: "renameToken",
    moveToken: "moveToken",
    applyTokenMagic: "applyTokenMagic",
    applyActiveEffects: "applyActiveEffects"
  }

  private static actionQueue = [];
  private static processingActions = false;
  private static _moduleSocket = "module.dae";

  private static _setupSocket() {
    //@ts-ignore
    game.socket.on(this._moduleSocket, async (message: GMActionMessage) => {
      if (game.user.id !== message.targetGM) return;
      if (!game.user.isGM) return;
      return this.processAction(message.action, message.sender, message.data)
    });
  }

  public static initActions() {
  }

  public static setupActions () {
  }

  public static readyActions() {
    this._setupSocket();
    requestGMAction("testMessage", game.user.name);
  }

  static chatEffects = (userId: string, actorId: string, itemData, tokenList: string[], flavor: string, whisper: boolean) => {
    let names = tokenList.filter(tid => canvas.tokens.get(tid)).map(tid=> canvas.tokens.get(tid).name);
    if (names.length > 0) {
      let chatData = {
        user: game.users.get(userId),
        speaker: {actor: game.actors.get(actorId)},
        content: `${flavor} (${itemData.name}): ${names}`,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        flags: { }
      };
      //@ts-ignore
      if (whisper) chatData.whisper = ChatMessage.getWhisperRecipients("GM");
      ChatMessage.create(chatData);
    }
  }

  public static async processAction(action:string, userId: string, data: {}) {
    this.processSingleAction(action, userId, data);
  }

  private static async processActionQueue() {
    debug("Processing action queue")
    this.processingActions = this.actionQueue.length > 0;
    while (this.processingActions) {
      debug("Processing Actions ", this.actionQueue.length)
      let {action, userId, data} = this.actionQueue[0];
      debug("Processing actions ", action, userId, data)
      await this.processSingleAction(action, userId, data);
      this.actionQueue = this.actionQueue.slice(1)
      this.processingActions = this.actionQueue.length > 0;
    }
  }

  public static async processSingleAction(action:string, userId: string, data: {}) {
    var actorId:string;
    //@ts-ignore
    let itemData = data.itemData;
    //@ts-ignore
    var tokenId = data.tokenId;
    var targetList;
    //@ts-ignore
    var requester = userId;
    //@ts-ignore
    var actorId = data.actorId;
    var scene;
    switch (action) {
      case "testMessage":
        console.log("DyamicEffects | test message received", data);
        return "Test message received and processed";
        break;
      case this.actions.setTokenVisibility:
        //@ts-ignore
        await setTokenVisibility(requester, data)
        break;
      case this.actions.setTileVisibility:
        //@ts-ignore
        await setTileVisibility(requester, data);
        break;
      case this.actions.applyActiveEffects:
        //@ts-ignore
        await applyActiveEffects(data.activate, data.targets, data.activeEffects, data.itemDuration)
        //@ts-ignore
        // this.chatEffects(requester, actorId, itemData, [tokenId], game.i18n.localize("dae.applyingEffects"), data.whisper)
        break;
      case this.actions.recreateToken:
        //@ts-ignore
        await recreateToken(requester, data);
        break;
      case this.actions.createToken:
        //@ts-ignore
        await createToken(requester, data);
        break;
      case this.actions.deleteToken:
        //@ts-ignore
        await deleteToken(requester, data);
        break;
      case this.actions.blindToken:
        //@ts-ignore
        scene = game.scenes.get(data.sceneId);
        await scene.updateEmbeddedEntity("Token", {"_id": tokenId, vision: false})
        break;
      case this.actions.restoreVision:
        //@ts-ignore
        scene = game.scenes.get(data.sceneId);
        await scene.updateEmbeddedEntity("Token", {"_id": tokenId, vision: true})
        break;
      case this.actions.renameToken:
        //@ts-ignore
        canvas.tokens.placeables.find(t=> t.id === data.tokenData._id).update({"name": data.newName})
        break;
      case this.actions.applyTokenMagic:
        //@ts-ignore
        await applyTokenMagic(data.tokenId, data.effectId, data.duration);
        break;

      default:
        console.warn("dae invalid message received", action, data)
    }
  }
}

// delete a token from the specified scene and recreate it on the target scene.
let recreateToken = async (userId: string, data: {startSceneId: string, targetSceneId: string, tokenData: {}, targetTokenData: {}, x: number, y: number}) => {
  createToken(userId, data);
  deleteToken(userId, data);
  return;
}

// delete a token from the specified scene and recreate it on the target scene.
let deleteToken = async (userId: string, data: {startSceneId: string, tokenData: {}, x: number, y: number}) => {
  //@ts-ignore
  let scenes = game.scenes;
  let startScene = scenes.get(data.startSceneId);
  //@ts-ignore
  await startScene.deleteEmbeddedEntity("Token", data.tokenData._id);
}
// delete a token from the specified scene and recreate it on the target scene.
let createToken = async (userId: string, data: {targetSceneId: string, tokenData: {}, x: number, y: number}) => {
  //@ts-ignore
  let scenes = game.scenes;
  let targetScene = scenes.get(data.targetSceneId);
  return await targetScene.createEmbeddedEntity('Token', mergeObject(duplicate(data.tokenData), {"x": data.x, "y": data.y, hidden: false}, {overwrite: true, inplace:true}))
}
//Set the hidden status for a token.
let setTokenVisibility = async(userId: string, data: {targetSceneId: string, tokenId: string, hidden: boolean}) => {
  if (!data.targetSceneId || !data.tokenId) return;
  //@ts-ignore
  let scene = game.scenes.get(data.targetSceneId);
  await scene.updateEmbeddedEntity("Token", {"_id": data.tokenId, "hidden": data.hidden})
  return "token visibility complete"
}

// Set the hidden staturs for a tile
let setTileVisibility = async(userId: string, data: {targetSceneId: string, tileId: string, hidden: boolean}) => {
  if (!data.targetSceneId || !data.tileId) return;
  //@ts-ignore
  let scene = game.scenes.get(data.targetSceneId);
  return await scene.updateEmbeddedEntity("Tile", {"_id": data.tileId, "hidden": data.hidden})
}

let applyTokenMagic = async (tokenId: string, effectId: string, duration: number) => {
  let token = canvas.tokens.get(tokenId);
  //@ts-ignore
  let tokenMagic = window.TokenMagic;
  if (tokenMagic && token) {
    tokenMagic.addFilters(token, effectId);
  } else {
    console.log(`dae | Something went wrong with finding effect ${effectId} or the duration ${duration}`)
  }
}

async function applyActiveEffects(activate, tokenList, activeEffects, itemDuration) {
  debug("gmaction apply effect ", activate, tokenList, duplicate(activeEffects), itemDuration)
  console.warn("gmaction apply effect ", activate, tokenList, duplicate(activeEffects), itemDuration)

  tokenList.forEach(async tid => {
    const token = canvas.tokens.get(tid);
    if (token) {
      let actEffects = duplicate(activeEffects)
      let removeList = [];
      // TODO redo this as a reduce
      actEffects.forEach(newAE => {
        removeList = removeList.concat(token.actor.effects.filter(ae => ae.data.origin === newAE.origin && getProperty(ae.data.flags, "dae.transfer") === false));
      });
      removeList = removeList.map(ae=>ae.data._id);
      if (removeList.length > 0)
        await token.actor.deleteEmbeddedEntity("ActiveEffect", removeList)
      if (activate) {
        actEffects.forEach(ae=> {
          warn("Apply active effects ", ae)
          setProperty(ae.flags, "dae.transfer", false);
          ae.changes.forEach(change=> {
            if (["macro.execute", "macro.itemMacro"].includes(change.key)) {
              change.value = change.value.map(f=> f === "@target" ? tid : f);
              change.value.push(canvas.tokens.get(tid)?.actor?.data)
            }
          })
         setProperty(ae, "flags.dae.token", tid)
         // convert mapped duration to seconds
         const seconds = convertToSeconds(itemDuration);
         ae.duration.seconds = seconds;
        })
        warn("gm action apply effect", token, actEffects)
        await token.actor.createEmbeddedEntity("ActiveEffect", actEffects);
        let removeEffect = async (tokenId, effect) => {
          const token = canvas.tokens.get(tokenId);
          const actor = token?.actor;
          if (actor) {
            let removeList = actor.effects.filter(ae => ae.data.origin === effect.origin && getProperty(ae.data.flags, "dae.transfer") === false);
            removeList = removeList.map(ae=>ae.data._id);
            if (removeList.length)
              await token.actor.deleteEmbeddedEntity("ActiveEffect", removeList)
          }
        }
        actEffects.forEach(ae => {
          // TODO remove this when core supports expriy
          let duration = ae.duration.seconds || 0;
          if (!duration) {
            duration += (ae.duration.rounds || 0 ) * CONFIG.time.roundTime;
            duration += (ae.duration.turns || 0 ) * CONFIG.time.roundTime;
          }
          warn("removing effect ", ae, " in ", duration, " seconds ")
          if (duration && aboutTimeInstalled) {
            game.Gametime.doIn({seconds: duration}, removeEffect, token.id, ae)
          } else {
            setTimeout(removeEffect, duration || 6000, token.id, ae);
          }
        })
      }
    };
  });
}

export function convertToSeconds(itemDuration: {units: string, value: number}) {
  if (!itemDuration) return 0;
  if (!aboutTimeInstalled ) {
    switch (itemDuration.units) {
      case "turn": 
      case "turns": return itemDuration.value * CONFIG.time.roundTime;
      case "round": 
      case "rounds": return itemDuration.value * CONFIG.time.roundTime
      case "second":
      case "seconds": itemDuration.value;
      case "minute": 
      case "minute": return itemDuration.value * 60;
      case "hour": 
      case "hours" :return itemDuration.value * 60 * 60;
      case "day": 
      case "days": return itemDuration.value * 60 * 60 * 24;
      case "week":
      case "weeks": return itemDuration.value * 60 * 60 * 24 * 7;
      case "month": 
      case "months": return itemDuration.value * 60 * 60 * 24 * 30;
      case "year": 
      case "years":return itemDuration.value * 60 * 60 * 24 * 30;
      default: return 0;
    }
  } else {
    // do about time stuff
    var dtMod;
    switch (itemDuration.units) {
      case "turn": return itemDuration.value * CONFIG.time.roundTime;
      case "round": return itemDuration.value * CONFIG.time.roundTime
      case "second": return itemDuration.value;
      case "minute": return game.Gametime.DTNow().add({"minutes": itemDuration.value}).toSeconds() - game.Gametime.DTNow().toSeconds();
      case "hour": return game.Gametime.DTNow().add({"hours": itemDuration.value}).toSeconds() - game.Gametime.DTNow().toSeconds();
      case "day": return game.Gametime.DTNow().add({"days": itemDuration.value}).toSeconds() - game.Gametime.DTNow().toSeconds();
      case "week": return game.Gametime.DTNow().add({"weeks": itemDuration.value}).toSeconds() - game.Gametime.DTNow().toSeconds();
      case "month": return game.Gametime.DTNow().add({"months": itemDuration.value}).toSeconds() - game.Gametime.DTNow().toSeconds();
      case "year": return game.Gametime.DTNow().add({"years": itemDuration.value}).toSeconds() - game.Gametime.DTNow().toSeconds();
      default: return CONFIG.time.roundTime;
    }
  }
}