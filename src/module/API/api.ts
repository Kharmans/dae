import { confirmAction, daeSpecialDurations } from '../../dae.js';
import { teleportToToken, blindToken, restoreVision, setTokenVisibility, setTileVisibility, moveToken, renameToken, getTokenFlag, setTokenFlag, setFlag, unsetFlag, getFlag, deleteActiveEffect, createToken, teleportToken, deleteItemActiveEffects } from '../../module/daeMacros.js';
import { convertDuration } from '../GMAction.js';
import { ActiveEffects } from '../apps/ActiveEffects.js';
import { DAEActiveEffectConfig, addAutoFields, otherFields } from '../apps/DAEActiveEffectConfig.js';
import { DIMEditor } from '../apps/DIMEditor.js';
import { daeMacro, doEffects, daeSystemClass, actionQueue, actorFromUuid, doActivityEffects, DoEffectsOptions, DoEffectsTargets } from '../dae.js';
import { cleanActorItemsEffectOrigins, cleanEffectOrigins, fixTransferEffect, fixTransferEffects, removeActorsPassiveEffects, removeAllScenesPassiveEffects, removeCompendiaPassiveEffects, removeScenePassiveEffects, tobMapper } from '../migration.js';
import { ValidSpec, wildcardEffects } from '../Systems/DAESystem.js';
import { enumerateBaseValues } from '../dae.js';
import { TokenOrDocument } from '../../globals.js';

const API = {
  ActiveEffects(document: Actor.Implementation | Item.Implementation) {
    return new ActiveEffects({document});
  },
  addAutoFields(fields: string[]) {
    return addAutoFields(fields);
  },
  async blindToken(tokenOrId: TokenOrDocument | string) {
    return await blindToken(tokenOrId);
  },
  async cleanEffectOrigins(processItems?: boolean) {
    return await cleanEffectOrigins(processItems);
  },
  async cleanActorItemsEffectOrigins(actor: Actor.Implementation) {
    return await cleanActorItemsEffectOrigins(actor);
  },
  confirmAction(toCheck: boolean, confirmFunction: any, title?: string) {
    return confirmAction(toCheck, confirmFunction, title);
  },
  convertDuration(itemDuration: { units: string, value: number }, inCombat: boolean) {
    return convertDuration(itemDuration, inCombat);
  },
  async createToken(tokenData: TokenDocument.CreateData, x: number, y: number) {
    return await createToken(tokenData, x, y);
  },
  DAEActiveEffectConfig(document: ActiveEffect.Implementation, options: Partial<foundry.applications.sheets.ActiveEffectConfig.Configuration> = {}) {
    return new DAEActiveEffectConfig({ document, ...options });
  },
  actorFromUuid(uuid: string): Actor.Implementation | null {
    return actorFromUuid(uuid);          
  },
  async daeMacro(action: string, actor: Actor.Implementation, effectData: ActiveEffect.Implementation | ActiveEffect.Source, lastArgOptions: any = {}) {
    if (effectData instanceof ActiveEffect && !lastArgOptions.effectUuid) lastArgOptions.effectUuid = effectData.uuid;
    return await daeMacro(action, actor, effectData, lastArgOptions);
  },
  daeSpecialDurations() {
    return daeSpecialDurations;
  },
  async deleteActiveEffect(uuid: string, origin: string, ignore: string[] = [], deleteEffects: string[] = [], removeSequencer: boolean = true) {
    return await deleteActiveEffect(uuid, origin, ignore, deleteEffects, removeSequencer);
  },
  async deleteItemActiveEffects(tokens: Array<string | foundry.canvas.placeables.Token.Implementation | TokenDocument.Implementation>, origin: string, ignore: string[] = [], deleteEffects: string[] = [], removeSequencer: boolean = true) {
    return await deleteItemActiveEffects(tokens, origin, ignore, deleteEffects, removeSequencer);
  },
  get DIMEditor() { return DIMEditor },
  async doEffects(
    item: Item.Implementation,
    activate: boolean,
    targets: DoEffectsTargets = undefined,
    options: DoEffectsOptions
  ) {
    return await doEffects(item, activate, targets, options);
  },
  async doActivityEffects(
    // TODO (Michael) dnd5e-types
    activity,
    activate: boolean,
    targets: DoEffectsTargets = undefined,
    activityEffectsUuids: string[],
    options: DoEffectsOptions
  ) {
    return doActivityEffects(activity, activate, targets, activityEffectsUuids, options);
  },
  enumerateBaseValues(dataModels: foundry.abstract.DataModel<any>[]) {
    return enumerateBaseValues(dataModels);
  },
  async fixTransferEffects(actor: Actor.Implementation) {
    return await fixTransferEffects(actor);
  },
  async fixTransferEffect(actor: Actor.Implementation, item: Item.Implementation) {
    return await fixTransferEffect(actor, item);
  },
  getFlag(entity: Actor.Implementation | TokenOrDocument | string, flagId: string) {
    return getFlag(entity, flagId);
  },
  getTokenFlag(token: TokenOrDocument, flagName: string) {
    return getTokenFlag(token, flagName);
  },
  async moveToken(token: TokenOrDocument, targetTokenName: string, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") {
    return await moveToken(token, targetTokenName, xGridOffset, yGridOffset, targetSceneName);
  },
  async renameToken(token: foundry.canvas.placeables.Token.Implementation, newName: string) {
    return await renameToken(token, newName);
  },
  async restoreVision(tokenOrId: TokenOrDocument | string) {
    return await restoreVision(tokenOrId);
  },
  evalExpression(): string {
    return daeSystemClass.safeEvalExpression.bind(daeSystemClass);
  },
  async setFlag(tactor: Actor.Implementation | foundry.canvas.placeables.Token.Implementation | string, flagId: string, value: any) {
    return await setFlag(tactor, flagId, value);
  },
  async setTileVisibility(tileOrId: TileDocument.Implementation | string, visible: boolean) {
    return await setTileVisibility(tileOrId, visible);
  },
  async setTokenFlag(tokenOrId:  string | TokenOrDocument, flagName: string, flagValue: any) {
    return await setTokenFlag(tokenOrId, flagName, flagValue);
  },
  async setTokenVisibility(tokenOrId: string | TokenOrDocument, visible: boolean) {
    return await setTokenVisibility(tokenOrId, visible);
  },
  async teleportToken(token: TokenOrDocument, scene: Scene.Implementation | string, position: { x: number, y: number }) {
    return await teleportToken(token, scene, position);
  },
  async teleportToToken(token: TokenOrDocument, targetTokenName: string, xGridOffset: number = 0, yGridOffset: number = 0, targetSceneName: string = "") {
    return await teleportToToken(token, targetTokenName, xGridOffset, yGridOffset, targetSceneName);
  },
  async tobMapper(iconsPath = "icons/TOBTokens") {
    return await tobMapper(iconsPath);
  },
  async unsetFlag(tactor: Actor.Implementation | foundry.canvas.placeables.Token.Implementation | string, flagId: string) {
    return await unsetFlag(tactor, flagId);
  },
  get ValidSpec() { return ValidSpec },
  get otherValidSpecKeys() { return otherFields },
  get allValidSpecKeys() {
    return otherFields.concat(Object.keys(ValidSpec.actorSpecs["union"].allSpecsObj))
  },
  get actionQueue() { return actionQueue },
  get wildcardBaseEffects(): RegExp[] {
    return wildcardEffects;
  },
  get daeCustomEffect() {
    return daeSystemClass.daeCustomEffect;
  },
  async removeScenePassiveEffects() {
    return removeScenePassiveEffects();
  },
  async removeAllScenesPassiveEffects() {
    return removeAllScenesPassiveEffects();
  },
  async removeActorsPassiveEffects() {
    return removeActorsPassiveEffects()
  },
  async removeCompendiaPassiveEffects() {
    return removeCompendiaPassiveEffects()
  }
};

export default API;
