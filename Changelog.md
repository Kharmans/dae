### 14.0.14
* Minimum Foundry raised to 14.365, verified to 14.367.
* Phase correction now uses Foundry's `ActiveEffect#shouldApplyChange`, so a change applied in its field's phase rather than its stored phase takes part in core's priority sort instead of being applied after it.
* `@stackCount` now resolves at every occurrence in a change value, not just the first.
* Arithmetic in a numeric flag's value is now evaluated (`floor(@details.level/2)` no longer becomes 0). Formula-valued flags such as midi optional bonuses keep their string.
* Special durations: the source/target start/end expiries are evaluated the way dnd5e 6.0 does on earlier dnd5e versions too.
* An effect that inherits its duration from the activity/item now gets an `updateWorldTime` expiry, instead of only expiring on the round tick.
* Effect editor: set-backed fields on an actor's effects (`system.damage.base.types` and other item/activity Set fields) are no longer locked to override - they default to add with every mode selectable. 14.0.13 fixed this for item and enchantment effects only.
* Effect editor: change modes are no longer restricted for fields with a value picker; v14 implements all six modes on Set fields, so only the default is set.

### 14.0.13
* Effect editor: each change row now has an editable Phase dropdown (defaults to the field's phase, and re-defaults when you change the change's key). Your choice wins at apply time, including forcing initial on a normally-final field.
* Effect editor: fixed the change row wrapping the delete icon onto the next line.
* Effect editor: widened the default window and fixed horizontally scrolling the changes list clipping the right-hand columns.
* Status reconciliation: removing a status effect no longer errors when a concurrent call already deleted it.
* Set-backed fields (damage types, traits, and any other Set-valued field): the "-value" removal options are now offered in add mode, not just custom.
* Enchantment/item effects: system.damage.types, system.damage.base.types and the save ability (activities[save].save.ability) now allow all change modes instead of being locked to override.
* Custom-mode handling now ignores non-custom changes, so an unrecognised change type on a flag/macro key is no longer mis-applied as custom.
* Special durations: on dnd5e 6.0+, effects expiring out of combat (including at combat end) are now deleted immediately instead of left marked-expired.
* Deprecated special-duration names (turnStart/turnEnd and their Source variants) now migrate to source/target expiry on dnd5e 6.0+ too, preserving the source/target distinction.

### 14.0.12
* Harden item spec building - spec generation for one item type can no longer break others.
* Enchantment effect configs fall back to union specs and render degraded instead of erroring when specs are missing.
* The joinCombat special duration label now uses its own localization key (dae.joinCombat) instead of borrowing a core Foundry string.
* Set-backed trait fields (e.g. system.traits.dr.value) in the effect editor are no longer forced to override mode. They default to add (which preserves existing entries) with the change type left selectable; use subtract to remove. The "-value" removal options are shown only in custom mode, and the value list now refreshes when you change the mode.

### 14.0.10
* Fix for macro.createItem not deleting items on unequip etc.
* New world setting **"ATL → token.* migration policy"** (`dae.atlCompatibility`) for switching DAE to Foundry v14's native `token.*` active-effect routing. Default `legacy` keeps current behavior (ATL.* keys handled by the ATL module). Other modes:
  - `runtime` — rewrite ATL.* keys to token.* at apply time only; saved effects are untouched
  - `migrate` — one-shot bulk migration of world data + non-published-module compendiums, plus pre-write normalisation for new content. Locked compendiums are skipped with a console log
  - `full` — `migrate` plus runtime fallback for unmigrated content, and auto-unlock/relock of locked compendiums during migration
* Directly mapped ATL keys: alpha, light.* (angle, attenuation, bright, color, coloration, contrast, dim, luminosity, saturation, shadows, darkness.min, darkness.max), sight.* (angle, attenuation, brightness, color, contrast, enabled, range, saturation).
* Expanded with care: `ATL.light.alpha` (squared at migration to match ATL's runtime), `ATL.light.animation` (JSON unpack into per-field sub-keys with the same fixer ATL uses for malformed JSON), `ATL.sight.visionMode` (also emits per-default sub-keys from `CONFIG.Canvas.visionModes[X].vision.defaults`), `ATL.detectionModes.<id>.range` (emits paired `enabled: true` + `range` so the TypedObjectField entry materialises correctly), `ATL.preset` (full preset unpack into multiple token.* changes), legacy `ATL.dimSight`/`ATL.brightSight` (jumps directly to `token.sight.range`/`brightness`).
* Not migrated (require ATL on v14 until core or dnd5e fills the `_onOverrideSize` gap): `ATL.width`, `ATL.height`, `ATL.depth`, `ATL.shape`, `ATL.elevation`, `ATL.hidden`, `ATL.rotation`. A one-shot console warning per unsupported key tells the user which effects still need ATL.
* `token.sight.visionMode` active-effect changes now auto-apply the mode's visual defaults (saturation, contrast, brightness, attenuation) as sibling overrides at apply time. 

### 14.0.9
* Fix for package release fails

### 14.0.8
* Active effect change rows now preserve newlines and indentation. Previously, opening an effect sheet with a multi-line change value (such as `flags.dae.macro.command`) collapsed the value to a single line and saving the sheet permanently destroyed the source formatting.
* Macro change rows (`flags.dae.macro.command` and the `flags.itemacro.macro.*` variants) now show an edit button that opens the DIME macro editor on the change value, giving syntax highlighting and a full-size code editor without leaving the effect sheet.

### 14.0.7
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

### 14.0.6
* Fix for visibility height errors

### 14.0.5
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

### 14.0.4
* Fix TypeError when `customStats` is not iterable in `isSuppressed` for Group actors without `system.traits.ci.custom` (MR !157, thanks @thatlonelybugbear).
* Correct descriptions for shimmed enchant keys — swap `system.damage.bonus`/`system.damageBonus` descriptions and replace "Should use … instead" with "Equivalent to …" for attack shim keys (MR !159, thanks @Michael Roth).
* `@activity` is now available in AE change value formulas when effects are applied via an activity (inspired by MR !156, thanks @thatlonelybugbear).
* Fix for token.xxxx effects not working.

### 14.0.0
* Added ability to specify source or target combatant in effect duration fields
* Foundry v14 showIcon replaces dae's show icon on active effects.
