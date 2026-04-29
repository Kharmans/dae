## 14.0.7
* `flags.dae.showIcon` is now auto-migrated to the native `ActiveEffect.showIcon` field when effects are created. Existing effects show a deprecation warning during actor recalculation and are migrated when opened in the effect editor.
* Deprecated special durations (`turnStart`, `turnEnd`, `turnStartSource`, `turnEndSource`, `combatEnd`) are auto-migrated to `duration.expiry` on effect creation.
* New migration system: "Migrate Now" button in DAE settings scans all world actors, items, scene tokens, and compendium packs for deprecated effect data and updates it. Includes an "Auto-migrate on update" setting.
* Migration covers: `flags.dae.showIcon`, deprecated special durations, old `data.` prefix change keys, field mappings (`StatusEffect`, `system.traits.d*.all`), and `flags.midi-qol.optional` keys missing `.all` suffix.
* Migration API exported on `game.modules.get("dae").api`: `migrateEffectData`, `migrateActor`, `migrateItem`, `migrateWorld`.
* Fix effect config crash (`forcedMode.toLowerCase is not a function`) when modules register specs with numeric mode values. Numeric modes are now mapped to their v14 string equivalents.
* Fix effect config dropdown not showing the correct selected value when reopening (e.g. damage type always showing "All Damage"). The `selected` attribute now survives HTML serialization.
* Fix effect config setting `flags.dae.stackable` in memory during render, which prevented the stacking mode from being saved when editing compendium effects.
* Fix for token effects being applied twice in some cases.
* Fix for duplicate display of ac attribution.

## 14.0.6
* Fix for visibility height errors

## 14.0.5
* Fix `macro.createItem` rejecting items with advancements. Advancements are now stripped from temporary items to prevent orphaned grants on level-up.
* Export `allMacroEffects` and `macroDestination` on the DAE API for external module use.
* Remove obsolete `OwnedItem` origin migration and `tobMapper` utility from API.
* Removed dead Foundry v12/v13 version checks and pre-5.3 dnd5e compatibility code.
* Removed unused stub functions and armor migration functions.
* Consolidated duplicate trait handlers (`.all`, `.custom`, `armorProf.all`/`weaponProf.all`) in custom effect processing.
* Added `getItemMacroCommand()` utility and `CREATE_ITEM_KEYS` Set for cleaner macro command resolution.
* Filter effects before cloning in `applyActiveEffects` to avoid unnecessary deep copies.
* Fix typo in compendium cleanup notification.
* Inject `expiry-reason` into core v14 duration expiry operations. Foundry v14's `ActiveEffectRegistry.refresh()` does not pass any reason when expiring effects — DAE now injects `expiry-reason` into the delete/update options so macros and hooks can determine why an effect was removed. Migration from v13 times-up reasons:

```
  v13 (times-up)                      v14 (DAE)
  times-up:expired                    duration-expired:updateWorldTime (or duration-expired:{event})
  times-up:turnStart                  duration-expired:turnStart
  times-up:turnEnd                    duration-expired:turnEnd
  times-up:turnStartSource            duration-expired:turnStart:source
  times-up:turnEndSource              duration-expired:turnEnd:source
  times-up:expired:combat-end-rounds  dae:expired:combat-end-rounds
```

* Fix `expireEffects()` not passing context to transfer effect disable and enchantment delete paths — `expiry-reason` was lost for those expiry routes.
* Fix `expireEffect()` not passing options to transfer effect update path.
* Consolidated effect change processing into `processEffectChanges()`, removing nested `actionQueue` calls that could deadlock.
* Significant changes to dae's processing of effect expiry. 
  - Generally all time/turn start/end expiry is handled by core foundry and not dae. Dae enhances core foundry to allow you to modify which combatants turn is recorded for turn start/end effect expiry. Core foundry always records the current combatant as the start.combatant, dae allows you to choose current combatant, the source of the effect being created or the target of the effect, allowing effects to expire on the source or targets turn start/end.
    - the old dae special durations for turn start/end are now deprecated and will throw a deprecation warning. If you edit the effect dae will migrate the data fo
  - Since core foundry deals with time based expiry so well there is no duration mapping on combat start/end or when applying effects. The effect/item duration is always used for the duration on the created effect.
  - dae adds an additional expiry event timeElapsed which indicates an effect only requires a duration expiry for the effect to expire.

## 14.0.4
* Fix TypeError when `customStats` is not iterable in `isSuppressed` for Group actors without `system.traits.ci.custom` (MR !157, thanks @thatlonelybugbear).
* Correct descriptions for shimmed enchant keys — swap `system.damage.bonus`/`system.damageBonus` descriptions and replace "Should use … instead" with "Equivalent to …" for attack shim keys (MR !159, thanks @Michael Roth).
* `@activity` is now available in AE change value formulas when effects are applied via an activity (inspired by MR !156, thanks @thatlonelybugbear).
* Fix for token.xxxx effects not working.

## 14.0.0
* Added ability to specify source or target combatant in effect duration fields
* Foundry v14 showIcon replaces dae's show icon on active effects.
