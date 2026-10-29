import { daeSpecialDurations } from '../../dae.js';
import { teleportToToken, blindToken, restoreVision, setTokenVisibility, setTileVisibility, moveToken, renameToken, getTokenFlag, setTokenFlag, setFlag, unsetFlag, getFlag, deleteActiveEffect, createToken, teleportToken, deleteItemActiveEffects } from '../../module/daeMacros.js';
import { convertDuration } from '../GMAction.js';
import { ActiveEffects } from '../apps/ActiveEffects.js';
import { BooleanFormulaField, DAEActiveEffectConfig, addAutoFields, otherFieldsMap, registerFieldEditor } from '../apps/DAEActiveEffectConfig.js';
import { DIMEditor } from '../apps/DIMEditor.js';
import { DAEConditionBuilder } from '../apps/ConditionBuilder.js';
import { daeMacro, doEffects, daeSystemClass, actionQueue, actorFromUuid, doActivityEffects, localizationMap, getItemMacroCommand, allMacroEffects, macroDestination, usesLegacyApplication, setApplicationMode, applicationModeOf, convertToOriginReplacement } from '../dae.js';
import * as atlMigration from '../atlMigration.js';
import { ValidSpec, wildcardEffects } from '../Systems/DAESystem.js';
import { enumerateBaseValues } from '../dae.js';
import { expireEffect, isEffectExpired, isTransferEffect, hasDuration, hasExpiry } from '../specialDurations.js';
import { migrateEffectData, migrateActor, migrateItem, migrateWorld } from '../migration.js';
import { resolveItemFromEffect, resolveMacro, resolveWorldMacro, resolveItemMacroCommand, resolveActivityMacroCommand, createSyntheticMacro, createFunctionMacro } from '../lib/macroResolution.js';
import { registerChangeHandler, getChangeHandler, changeHandlerRegistry } from '../lib/changeHandlerRegistry.js';
import { effectMatchesSource, getActorItemData, getEffectItem, getEffectItemData, getEffectSource, getMessageItemData } from '../lib/effectSource.js';
import { calibratePhases, calibrateActor, misphaseReport, collapsePaths } from '../lib/phaseCalibration.js';

const API = {
  /** Investigation tool: map dnd5e derived-data steps to the paths they write. Read-only. */
  calibratePhases,
  calibrateActor,
  misphaseReport,
  collapsePaths,
  ActiveEffects(document: Actor.Implementation | Item.Implementation) {
    return new ActiveEffects({document});
  },
  get actionQueue() { return actionQueue },
  get allValidSpecKeys() {
    return [...otherFieldsMap.keys()].concat(Object.keys(ValidSpec.actorSpecs["union"].allSpecsObj))
  },
  DAEActiveEffectConfig(document: ActiveEffect.Implementation, options: Partial<foundry.applications.sheets.ActiveEffectConfig.Configuration> = {}) {
    return new DAEActiveEffectConfig({ document, ...options });
  },
  get DIMEditor() { return DIMEditor },
  /** The active system class. Replaces the former `globalThis.daeSystems` registry. */
  get systemClass() { return daeSystemClass },
  get daeCustomEffect() {
    return daeSystemClass.daeCustomEffect;
  },
  daeSpecialDurations() {
    return daeSpecialDurations;
  },
  evalExpression(): (input: string, context: any, depth?: number) => string {
    return daeSystemClass.safeEvalExpression.bind(daeSystemClass);
  },
  get localizationMap() { return localizationMap },
  get otherValidSpecKeys() { return [...otherFieldsMap.keys()] },
  get ValidSpec() { return ValidSpec },
  get wildcardBaseEffects(): RegExp[] {
    return wildcardEffects;
  },
  actorFromUuid,
  addAutoFields,
  get changeHandlerRegistry() { return changeHandlerRegistry },
  createFunctionMacro,
  createSyntheticMacro,
  get allMacroEffects() { return allMacroEffects },
  BooleanFormulaField,
  blindToken,
  convertDuration,
  createToken,
  daeMacro,
  deleteActiveEffect,
  deleteItemActiveEffects,
  doActivityEffects,
  doEffects,
  effectMatchesSource,
  enumerateBaseValues,
  expireEffect,
  getActorItemData,
  getChangeHandler,
  getEffectItem,
  getEffectItemData,
  getEffectSource,
  getFlag,
  getItemMacroCommand,
  getMessageItemData,
  getTokenFlag,
  hasDuration,
  hasExpiry,
  isEffectExpired,
  isTransferEffect,
  get macroDestination() { return macroDestination },
  moveToken,
  registerChangeHandler,
  registerFieldEditor,
  DAEConditionBuilder,
  renameToken,
  resolveActivityMacroCommand,
  resolveItemFromEffect,
  resolveItemMacroCommand,
  resolveMacro,
  resolveWorldMacro,
  restoreVision,
  setFlag,
  setApplicationMode,
  applicationModeOf,
  convertToOriginReplacement,
  setTileVisibility,
  setTokenFlag,
  setTokenVisibility,
  teleportToken,
  teleportToToken,
  unsetFlag,
  usesLegacyApplication,
  migrateEffectData,
  migrateActor,
  migrateItem,
  migrateWorld,
  // ATL → token.* migration surface (see Changelog 14.0.10).
  atlMigration,
};

export default API;
