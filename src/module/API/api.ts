import { confirmAction, daeSpecialDurations } from '../../dae';
import { teleportToToken, blindToken, restoreVision, setTokenVisibility, setTileVisibility, moveToken, renameToken, getTokenFlag, setTokenFlag, setFlag, unsetFlag, getFlag, deleteActiveEffect, createToken, teleportToken, deleteItemActiveEffects } from '../../module/daeMacros';
import { convertDuration } from '../GMAction';
import { ActiveEffects } from '../apps/ActiveEffects';
import { DAEActiveEffectConfig, addAutoFields, otherFields } from '../apps/DAEActiveEffectConfig';
import { DIMEditor } from '../apps/DIMEditor';
import { daeMacro, doEffects, daeSystemClass, actionQueue, actorFromUuid } from '../dae';
import { cleanActorItemsEffectOrigins, cleanEffectOrigins, fixTransferEffect, fixTransferEffects, migrateActorDAESRD, migrateAllActorsDAESRD, migrateAllNPCDAESRD, tobMapper } from '../migration';
import { ValidSpec, wildcardEffects } from '../Systems/DAESystem';

const API = {
    ActiveEffects(object: any = {}, options:any = {}) {
       return new ActiveEffects(object, options);
    },
    addAutoFields(fields: string[]) {
        return addAutoFields(fields);
    },
    async blindToken(tokenOrId: Token | string) {
        return await blindToken(tokenOrId);
    },
    async cleanEffectOrigins(processItems?: boolean) {
        return await cleanEffectOrigins(processItems);
    },
    async cleanActorItemsEffectOrigins(actor: any) {
        return await cleanActorItemsEffectOrigins(actor);
    },
    confirmAction(toCheck: boolean, confirmFunction: any, title?: string) {
       return confirmAction(toCheck, confirmFunction, title);
    },
    convertDuration(itemDuration: { units: string, value: number }, inCombat) {
        return convertDuration(itemDuration, inCombat);
    },
    async createToken(tokenData, x, y) {
        return await createToken(tokenData, x, y);
    },
    DAEActiveEffectConfig(object: any = {}, options:any = {}) {
        return new DAEActiveEffectConfig(object, options);
    },
    DAEfromActorUuid(uuid): Actor | null {
        console.warn("dae | Deprecation warning | DAEfromActorUuid is deprecated, use DAE.fromActorUuid instead");
        return actorFromUuid(uuid);
    },
    actorFromUuid(uuid: string): Actor | null {
        return actorFromUuid(uuid);
    },
    DAEfromUuid(uuid) {
        console.warn("dae | Deprecation warning | DAEfromUuid is deprecated, use foundry.utils.fromUuidSync instead");
        //@ts-expect-error fromUuidSync
        return fromUuidSync(uuid);
    },
    async daeMacro(action: string, actor, effectData, lastArgOptions = {}) {
        return await daeMacro(action, actor, effectData, lastArgOptions);
    } ,
    daeSpecialDurations() {
        return daeSpecialDurations;
    },
    async deleteActiveEffect(uuid: string, origin: string, ignore: string[] = [], deleteEffects: string[] = [], removeSequencer: boolean = true) {
        return await deleteActiveEffect(uuid, origin, ignore, deleteEffects, removeSequencer);
    },
    async deleteItemActiveEffects(tokens: Array<string | Token | any /* TokenDocument */>, origin: string, ignore: string[] = [], deleteEffects: string[] = [], removeSequencer: boolean = true) {
        return await deleteItemActiveEffects(tokens, origin, ignore, deleteEffects, removeSequencer);
    },
    DIMEditor(object:any = {}, options:any = {}) {
        return new DIMEditor(object, options);
    },
    async doEffects(item, activate, targets = undefined, options: any =
        {
          whisper: false, spellLevel: 0, damageTotal: null, itemCardId: null, critical: false,
          fumble: false, effectsToApply: [], removeMatchLabel: false, toggleEffect: false,
          selfEffects: "none"
        }) {
        return await doEffects(item, activate, targets, options);
    },
    async fixTransferEffects(actor)  {
        return await fixTransferEffects(actor);
    },
    async fixTransferEffect(actor, item)  {
        return await fixTransferEffect(actor, item);
    },
    getFlag(entity: Actor | Token | string, flagId: string) {
        return getFlag(entity, flagId);
    },
    getTokenFlag(token: Token | any /* TokenDocument*/, flagName: string) {
        return getTokenFlag(token, flagName);
    },
    async migrateActorDAESRD(actor, includeSRD = false) {
        return await migrateActorDAESRD(actor, includeSRD);
    },
    async migrateAllActorsDAESRD(includeSRD = false) {
        return await migrateAllActorsDAESRD(includeSRD);
    },
    async migrateAllNPCDAESRD(includeSRD = false) {
        return await migrateAllNPCDAESRD(includeSRD);
    },
    async moveToken(token, targetTokenName, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") {
        return await moveToken(token, targetTokenName, xGridOffset, yGridOffset, targetSceneName);
    },
    async renameToken(token: Token, newName: string) {
        return await renameToken(token, newName);
    },
    async restoreVision(tokenOrId: Token | string) {
        return await restoreVision(tokenOrId);
    },
    evalExpression():string {
        return daeSystemClass.safeEvalExpression.bind(daeSystemClass);
    },
    async setFlag(tactor: Actor | Token | string, flagId: string, value: any) {
        return await setFlag(tactor, flagId, value);
    },
    async setTileVisibility(tileOrId: Tile | string, visible: boolean) {
        return await setTileVisibility(tileOrId, visible);
    },
    async setTokenFlag(tokenOrId: Token | string | TokenDocument, flagName: string, flagValue: any) {
        return await setTokenFlag(tokenOrId, flagName, flagValue);
    },
    async setTokenVisibility(tokenOrId: string | Token, visible: boolean) {
        return  await setTokenVisibility(tokenOrId, visible);
    },
    async teleportToken(token: Token, scene: Scene | string, position: {x:number, y: number}) {
        return await teleportToken(token, scene, position);
    },
    async teleportToToken(token, targetTokenName, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") {
        return await teleportToToken(token, targetTokenName, xGridOffset, yGridOffset, targetSceneName);
    },
    async tobMapper(iconsPath = "icons/TOBTokens") {
        return await tobMapper(iconsPath);
    },
    async unsetFlag(tactor: Actor | Token | string, flagId) {
        return await unsetFlag(tactor, flagId);
    },
    get ValidSpec() {return ValidSpec},
    get otherValidSpecKeys() { return otherFields},
    get allValidSpecKeys() {
      return otherFields.concat(Object.keys(ValidSpec.specs["union"].allSpecsObj))
    },
    get actionQueue() {return actionQueue},
    get wildcardBaseEffects(): RegExp[] {
        return wildcardEffects;
    },
    get daeCustomEffect() {
        return daeSystemClass.daeCustomEffect;
    }

  };

  export default API;
