## 14.0.5
* Fix `macro.createItem` rejecting items with advancements. Advancements are now stripped from temporary items to prevent orphaned grants on level-up.
* Export `allMacroEffects` and `macroDestination` on the DAE API for external module use.
* Remove obsolete `OwnedItem` origin migration and `tobMapper` utility from API.
* Removed dead Foundry v12/v13 version checks and pre-5.3 dnd5e compatibility code.
* Removed unused stub functions and armor migration functions.
* Consolidated duplicate trait handlers (`.all`, `.custom`, `armorProf.all`/`weaponProf.all`) in custom effect processing.
* Consolidated duplicate loop patterns in `configureLists()` and `setEffectsExpiryToRounds()`.
* Added `getItemMacroCommand()` utility and `CREATE_ITEM_KEYS` Set for cleaner macro command resolution.
* Cache `getTokenDocument`/`getToken` lookups in `applyActiveEffects` to avoid repeated resolution.
* Filter effects before cloning in `applyActiveEffects` to avoid unnecessary deep copies.
* Fix variable shadowing in `specialDurations.ts`.
* Fix typo in compendium cleanup notification.

## 14.0.4
* Fix TypeError when `customStats` is not iterable in `isSuppressed` for Group actors without `system.traits.ci.custom` (MR !157, thanks @thatlonelybugbear).
* Correct descriptions for shimmed enchant keys — swap `system.damage.bonus`/`system.damageBonus` descriptions and replace "Should use … instead" with "Equivalent to …" for attack shim keys (MR !159, thanks @Michael Roth).
* `@activity` is now available in AE change value formulas when effects are applied via an activity (inspired by MR !156, thanks @thatlonelybugbear).
* Fix for token.xxxx effects not working.

## 14.0.0
* Added ability to specify source or target combatant in effect duration fields
* Foundry v14 showIcon replaces dae's show icon on active effects.
