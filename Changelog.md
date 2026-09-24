### 14.6.0
* Internal `getApplicableEffects(actor, ...)` renamed to `getActorEffects`. It collects an actor's embedded effects and is unrelated to dnd5e 6.0's new async `Activity#getApplicableEffects()`, which resolves an activity's effect profiles and may fetch from a compendium. Internal only - not part of the DAE API.
* Minimum Foundry raised to 14.365, verified to 14.368.
* Phase correction now uses Foundry's `ActiveEffect#shouldApplyChange`, so a change applied in its field's phase rather than its stored phase takes part in core's priority sort instead of being applied after it.
* `@stackCount` now resolves at every occurrence in a change value, not just the first.
* Arithmetic in a numeric flag's value is now evaluated (`floor(@details.level/2)` no longer becomes 0). Formula-valued flags such as midi optional bonuses keep their string.
* Special durations: the source/target start/end expiries are evaluated the way dnd5e 6.0 does on earlier dnd5e versions too.
* Special durations: a source/target end expiry no longer ends on the turn the effect was applied.
* Special durations: source/target expiries keep their own value instead of being rewritten to `turnStart`/`turnEnd` with a fixed combatant.
* Rider conditions are left to dnd5e, which creates them itself on effect creation; DAE's duplicate call used an API deprecated in dnd5e 6.0.
* The macro-init enchantment guard uses `applicableType`, so riders of non-applied enchantments are skipped too.
* midi's special durations are no longer registered by DAE; midi registers them itself via `dae.addSpecialDurations`. DAE's duplicate list ran after the hook and overwrote midi's, which is how the mis-spelled concentration-failure entry reached the UI. DAE now defines only system-agnostic entries.
* Re-enabling a transfer effect no longer stamps a start on it, so a duration on a transfer effect never runs. A transfer effect is the definition on the item, and a start makes it expiry-tracked, after which the system deletes it off the item. Legacy items that toggled such an effect on and relied on it expiring must add the effect to the activity's Effects list instead; see the midi-qol changelog.
* `_prepareDuration` no longer special-cases an effect that has an expiry and no duration value; dnd5e 6.0 already prepares those as infinite, and the special case skipped dnd5e's own duration labels.
* Per-change `conditions` on an effect change are now honoured, and `change.applied` is set. DAE decided the application phase and returned without letting the system run its own checks, so dnd5e's per-change conditions and effect-level condition suppression were skipped for every keyed change. DAE still chooses the phase, then delegates.
* Bonus selectors expand to `system.rolls.attack|damage.<type>.bonus`, the dnd5e 6.0 location, instead of the old `system.bonuses.<type>.<attack|damage>` paths that only still resolve through the system's deprecation shim.
* `system.bonuses.All-Attacks` now sets dnd5e's own `system.rolls.attack.bonus`, which the system combines into every attack roll, rather than writing each attack type separately.
* New selector keys for the groupings dnd5e has no native equivalent for: `system.rolls.attack.weapon.bonus`, `.spell.bonus`, and `system.rolls.damage.all|weapon|spell.bonus`. The `system.bonuses.*` forms keep working as aliases.
* Using a legacy `system.bonuses.All-Attacks`-style selector logs a deprecation warning naming its replacement.
* Movement and senses fields are offered as `system.attributes.movement.speeds.*` and `system.attributes.senses.ranges.*`, their dnd5e 6.0 locations; the old paths still work through the system's shim.
* The effect sheet extends the system's own effect sheet where there is one, so every tab except the DAE tab is the system's. Under dnd5e 6.0 that restores the effect-level and per-change Conditions fields, its header and its changes UI, which were previously missing because DAE extended the core sheet. Systems without their own effect sheet are unaffected and keep DAE's inline change editor.
* Under dnd5e, changes are edited in the system's change dialog rather than inline. DAE adds the field browser, the application phase, spec-driven value lists and forced-mode restriction to that dialog.
* The injected phase control uses dnd5e's own label and hint and core's phase names, so it reads as part of the dialog and picks up any phase a module registers.
* `##field` deferral: all occurrences in a value are now restored, not just the first, and the restore also runs for effects the system applies itself (enchantments, chat-card apply, region behaviors), which never reached DAE's own substitution.

## dnd6 branch — dnd5e 6.0 only

This branch drops support for every system other than dnd5e 6.0+ and removes the code that existed
to accommodate them.

* `module.json` declares a dnd5e 6.0.0 minimum.
* Side-effecting changes (`macro.*`, `StatusEffect`, `macro.CE`) are now undone when an effect becomes suppressed — an unequipped item left its macros' work in place. Suppression is derived state with no document event of its own, so the transition is detected during data preparation, where equipment, antimagic and the origin effect's active state are all already resolved, and the work is queued rather than run inline. Fires the new `dae.suppressionChanged` hook.
* `StatusEffect` now removes its condition when the change is deleted or edited, or the effect is suppressed. The removal had been commented out as "effect will auto remove", which is only true when the parent effect is deleted — dnd5e deletes dependents then, and DAE deleting as well raced it. Guarded on the same context flags `removeCreateItemChange` already used.
* Migrating deprecated special durations no longer discards the ones `duration.expiry` cannot express. `duration.expiry` holds a single value, so only the first can be migrated; the rest stay on `flags.dae.specialDuration` and keep warning instead of being silently dropped. An expiry the author set explicitly is not overwritten — but core initialises `duration.expiry` to `turnStart` for any numeric duration, so only an expiry differing from that default counts as authored.
* The migration no longer rewrites pre-v10 `data.` change keys or appends the missing `.all` to midi optional keys; both predate every version this branch supports and are still handled at apply time.
* ATL support removed. Foundry v14 handles `token.*` change keys natively, so `ATL.*` is normalised to `token.*` on write, unconditionally — the `atlCompatibility` setting, its four modes, the runtime translation layer and the `atl` migration option are all gone. An `ATL.*` key that predates this and reaches application is not applied and warns once. Detection-mode fields are offered as `token.detectionModes.<id>.range`.
* Removed DAE's vision-mode sibling injection; core's `_inflateVisionModeChange` does the same job. DAE now only keeps `sight.visionMode` ahead of its equal-priority siblings, so an explicit `sight.*` value still wins whatever order it was authored in — core applies the defaults after the change, so order would otherwise matter.
* Removed the game-system compatibility machinery: the `gameSystemCompatible` states, the
  `DAEUntestedSystems` setting and its strings, the pf2e blocklist and the
  `game.system.flags.daeCompatible` protocol.
* Removed the dnd5e < 6.0 source/target pseudo-expiry port; 6.0 implements those natively.
* Removed the system-class dispatch: the `globalThis.daeSystems` registry, lookup by
  `game.system.id`, the `CONFIG.DAE.systemClass` fallback, and six base methods that existed only as
  override points. `DAESystemDND5E` now extends `DAESystem` directly.
* `DAE.systemClass` exposes the active system class, replacing the `globalThis.daeSystems` registry
  as the supported way to reach it.
* The effect sheet extends dnd5e's sheet unconditionally, and DAE's 165-line inline change renderer
  is gone — dnd5e's changes tab renders its own rows, so it produced markup nothing displayed.
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
