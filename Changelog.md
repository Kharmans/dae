### 14.6.0 (dnd6 branch)

**Requirements**
* dnd5e 6.0 or later only: `module.json` declares a dnd5e 6.0.0 minimum, and support for every other system has been removed.
* Minimum Foundry raised to 14.365, verified to 14.368.

**Breaking changes**

*How `@` references are filled when an effect is applied (item and effect authors)*

dnd5e 6 gives each effect change a **Replacement** setting that says whose data fills its `@` references. DAE now follows it when it applies an effect to a target (midi activity effects, `doEffects`):
- **Origin** - filled from the caster when the effect is applied.
- **Target** - filled from each target when the effect is applied.
- **None** (the default) - not filled when applied: the reference stays in the effect and is worked out on the target whenever the target is prepared, so it follows the target's current values. Application facts - `@item` (the item as cast), `@activity`, `@spellLevel`, `@itemLevel`, `@scaling`, `@damage`, `@critical`, `@fumble`, `@itemCardUuid`, `@actorUuid` - are filled from the application, so they still work.

Previously DAE filled **every** reference from the caster when the effect was applied, whatever the Replacement setting.

**What to do.** An effect whose changes rely on the caster's values with Replacement left at None - for example `saveDC=@attributes.spell.dc` in an OverTime effect, or a bonus built from the caster's `@abilities` or `@scale` - now gets the target's values. Either:
- set those changes' Replacement to **Origin** (the dnd5e 6 way), or
- set the **Default effect application** world setting to Legacy DAE, set **Effect application** on the effect (DAE tab), or mark a whole item or compendium pack with "DAE: Effect application" on the item sheet or "DAE: Effects use legacy application" on the pack, to keep the old behaviour.

Unchanged in both modes: macro arguments (`macro.execute`, `macro.itemMacro`, ...) are filled from the caster; `##` still defers a reference to the target; transfer (passive) effects are not affected.

*Transfer effects with a duration*
* A duration on a transfer effect no longer runs: re-enabling one no longer starts it. Legacy items that toggled such an effect on and relied on it expiring must add the effect to the activity's Effects list instead; see the midi-qol changelog.

*ATL keys*
* `ATL.*` change keys are converted to `token.*` when an effect is saved; the `atlCompatibility` setting and its four modes are gone. Foundry v14 handles `token.*` natively. An `ATL.*` key saved before this is not applied, and warns once. Detection-mode fields are offered as `token.detectionModes.<id>.range`.

*Inline rolls and `dae.roll`*
* The **Display results of inline rolls** setting is removed. `[[expr]]` in a change value now always posts its roll to chat; use `[[[expr]]]` to roll without a chat message. Effects using `[[expr]]` that relied on the setting being off (the default) should switch to `[[[expr]]]`.
* `dae.roll(expr)` is deprecated: it becomes a silent inline roll, `[[[expr]]]`, when the effect is created or edited on an actor or an owned item. A `dae.roll` still reached when an actor is prepared counts as 0, as before.

#### Changes you will notice

**Applying effects**
* Inline rolls (`[[expr]]`) in a transfer effect are rolled when the item lands on an actor - created, dragged from another actor, or duplicated - and when the formula is edited. The formula stays in the effect, so dragging the item to another actor rolls again; previously a transfer effect's inline roll was not rolled until the effect was edited, and then replaced its formula.
* Effects DAE applies follow dnd5e 6's per-change Replacement setting by default. The "Default effect application" world setting chooses dnd5e or Legacy DAE; an effect's "Effect application" (World default, dnd5e, Legacy DAE) overrides it (see Breaking changes).
* "DAE: Effect application" on item sheets, and "DAE: Effects use legacy/dnd5e/world default application" on Item and Actor compendium packs, set that for every effect in the item or pack.
* dnd5e's own Apply button recognises effects DAE applied, so applying one again refreshes it rather than adding a copy.
* `@UUID[...]` links in a legacy-application effect applied to an actor are kept; they came out as `0[...]`.
* `@activity` references in a legacy-application effect (e.g. `saveDC=@activity.save.dc.value` in an OverTime effect) are filled from the activity; they came out as 0.
* Per-change conditions on an effect change, and effect-level condition suppression, are honoured.
* Macros, `StatusEffect` and Convenient Effects changes are undone when their effect is suppressed, e.g. by unequipping the item; the work used to stay in place.
* Undoing (and redoing) a suppressed effect's side effects runs on one client - the active GM, or the actor's first active owner when no GM is connected - instead of on every connected client.
* A `StatusEffect` change removes its condition when the change is deleted or edited, or its effect is suppressed.
* Combat end no longer throws "does not exist" for effects dnd5e 6 removes itself as the combatant leaves.
* An effect that inherits its duration from the activity or item also expires with world time, not only on the round tick.

**Effect sheet**
* The effect sheet is dnd5e's own, with a DAE tab: the effect-level and per-change Conditions fields, its header and its changes UI are back.
* Changes are edited in dnd5e's change dialog, with DAE's field browser, value lists and mode restriction added to it.
* Condition builder: a button beside dnd5e's filter button on per-change and effect-level conditions opens a form of nested groups (All of, Any of, None of, Not all of, XOR) with comparison rows, path autocomplete, a common fields menu (statuses, creature, ability scores and modifiers, attributes, health, defences, level, and the item for item effects), value pickers from dnd5e's lists (statuses, creature types, sizes, damage types, spell schools...) and a live pass/fail on the actor. It writes dnd5e's filter JSON and declines conditions it cannot show.
* Change keys and values autocomplete in Foundry's own menu: keys by category with their name and description; values complete `@` references a segment at a time, and formula functions for number and formula fields. The full-width field browser with category tabs is gone.
* The change dialog offers the registered value editors (DIME for macros, midi's OverTime and condition editors), and edits macro source in a multi-line box that keeps its line breaks.
* The change dialog shows the phase a change is applied in, read-only, under dnd5e's label and hint; saving leaves the stored phase as it was.
* Set-based fields on an actor's effects (`system.damage.base.types` and other item/activity Set fields) are no longer locked to override - they default to add with every mode selectable. 14.0.13 fixed this for item and enchantment effects only.
* Change modes are no longer restricted for fields with a value picker; v14 implements all six modes on Set fields, so only the default is set.

**Special durations**
* Source/target start/end expiries are evaluated the way dnd5e 6.0 does.
* A source/target end expiry no longer ends on the turn the effect was applied.
* Source/target expiries keep their own value instead of being rewritten to `turnStart`/`turnEnd` with a fixed combatant.
* Migrating deprecated special durations no longer discards the ones `duration.expiry` cannot express; the rest stay on `flags.dae.specialDuration` and keep warning. An expiry the author set explicitly is not overwritten.

**Values and bonuses**
* The attack, damage and ability bonus paths dnd5e 6 moved to `system.rolls` (`bonuses.mwak.damage`, `bonuses.abilities.save` and the like) read through again, in formulas, roll data and on the actor, with dnd5e's deprecation warning. dnd5e 6 skips these aliases because their parent objects were removed; DAE supplies them until dnd5e does.
* A numeric flag or `dae.eval(...)` on an item's effect can use `@item` and `@scaling`; they resolved to 0.
* `@stackCount` resolves at every occurrence in a change value, not just the first.
* Arithmetic in a numeric flag's value is evaluated (`floor(@details.level/2)` no longer becomes 0). Formula-valued flags such as midi optional bonuses keep their string.
* `##field` deferral restores every occurrence in a value, not just the first, and also works for effects dnd5e applies itself (enchantments, chat-card apply, region behaviours).
* Bonus selectors write to `system.rolls.attack|damage.<type>.bonus`, the dnd5e 6.0 location, instead of the old `system.bonuses.<type>.<attack|damage>` paths.
* `system.bonuses.All-Attacks` sets dnd5e's own `system.rolls.attack.bonus`, which the system adds to every attack roll.
* New selector keys for groupings dnd5e has no native equivalent for: `system.rolls.attack.weapon.bonus`, `.spell.bonus`, and `system.rolls.damage.all|weapon|spell.bonus`. The `system.bonuses.*` forms keep working as aliases.
* A legacy `system.bonuses.All-Attacks`-style selector logs a deprecation warning naming its replacement.
* Movement and senses fields are offered as `system.attributes.movement.speeds.*` and `system.attributes.senses.ranges.*`, their dnd5e 6.0 locations; the old paths still work through dnd5e's shim.

#### Implementation details

**Effect application**
* DAE's `Roll.replaceFormulaData` patch only turns on core's `recursive` option (unless the caller passes one) and keeps `@Embed[...]`; its own three-pass loop is gone, it passes the caller's options on, and it no longer writes an `Embed` key into the caller's data. Nested references still resolve for core `Roll`s and dnd5e's origin/target replacement.
* The numeric-flag and `dae.eval` paths in `daeApplyChange` resolve with the replacement data core passes, not a fresh `actor.getRollData()`.
* A transfer effect's inline roll totals are stored in `flags.dae.inlineRolls` (`{key, value, totals}` per change) and substituted when the actor is prepared; a change with no stored totals uses 0. Items rolled on creation by wrapping `Item#_preCreate` (rerolls everything) and `Actor#_preCreate` (rolls only what was never rolled).
* `flags.dae.applicationMode` (`default`/`dnd5e`/`legacy`) holds the per-effect mode; unset or `default` follows the `defaultApplicationMode` world setting. The applied copy records the mode it was applied with. `DAE.setApplicationMode(itemOrActorOrEffectOrPack, mode)` sets it for every effect in the target and returns the count; `DAE.applicationModeOf(effectData)` and `DAE.usesLegacyApplication(effectData)` report it.
* In dnd5e mode a `target` change is filled per target on the applying client (GM path included) with dnd5e's `forApplication`; application facts are recorded in `flags.dae.applicationData` and supplied at preparation by a `getReplacementData` wrapper, and by `daeApplyChange` for formula fields, which dnd5e evaluates later from the actor's own roll data. The source item is read live, falling back to `flags.dae.itemData`.
* Applied activity effects record their source as dnd5e 6 does: the source effect in `_stats.duplicateSource`/`compendiumSource`, and the activity, chat message and profile in `system.origin`. DAE's origin goes in as `system.origin.effect`, so the `origin` DAE and midi read is unchanged.
* DAE still chooses the application phase, then delegates to the system, so `change.applied` is set; previously it returned without letting dnd5e run its checks.
* Phase correction uses Foundry's `ActiveEffect#shouldApplyChange`, so a change applied in its field's phase rather than its stored phase takes part in core's priority sort instead of being applied after it.
* Side-effecting changes (`macro.*`, `StatusEffect`, `macro.CE`) are undone on suppression. Suppression is derived state with no document event, so the transition is detected during data preparation, where equipment, antimagic and the origin effect's active state are resolved, and the undo work is queued. New hook: `dae.suppressionChanged`.
* The `StatusEffect` removal is guarded by the same context flags `removeCreateItemChange` used; it had been commented out as "effect will auto remove", which only held when the parent effect was deleted.
* Rider conditions are left to dnd5e, which creates them on effect creation; DAE's duplicate call used an API deprecated in dnd5e 6.0. The macro-init enchantment guard uses `applicableType`, so riders of non-applied enchantments are skipped too.
* Legacy `@activity` is the activity's own entry in its roll data (`activity.getRollData().activity`); it was the whole roll data, so `@activity.<path>` never resolved. In dnd5e mode `@activity` is supplied at preparation from the live activity, falling back to that entry as recorded at application (`flags.dae.applicationData.activity`).
* The encumbrance bonus and multiplier specs are only supplied where the system declares none, so dnd5e 6's `FormulaField`s are used instead of plain strings.
* Internal `getApplicableEffects(actor, ...)` renamed to `getActorEffects`; it is unrelated to dnd5e 6.0's async `Activity#getApplicableEffects()`. Not part of the DAE API.

**Effect sheet**
* `DAE.DAEConditionBuilder` (API) with static `parse(json)` / `serialize(model)`; "not equal" is stored as `NOT` around `exact`, since dnd5e has no such comparison. A `has` with a nested filter has no row form.
* The field browser drives Foundry's `Autocomplete` and no longer adds page-wide click and keydown listeners per instance, which piled up in the change dialog. The dialog rebuilds the value field, editor button and forced mode when the key changes, since it does not re-render once open.

**Durations**
* An effect that inherits its duration from the activity or item gets an `updateWorldTime` expiry.
* Re-enabling a transfer effect no longer stamps a start on it: a start makes it expiry-tracked, after which the system deletes it from the item.
* `_prepareDuration` no longer special-cases an effect with an expiry and no duration value; dnd5e 6.0 already prepares those as infinite, and the special case skipped dnd5e's own labels.
* midi's special durations are no longer registered by DAE; midi registers them via `dae.addSpecialDurations`. DAE's list ran after the hook and overwrote midi's, which is how the misspelt concentration-failure entry reached the UI. DAE defines only system-agnostic entries.
* The special-duration migration writes only the first expiry to `duration.expiry` (it holds one value). Core initialises `duration.expiry` to `turnStart` for any numeric duration, so only a differing value counts as authored.
* Removed the dnd5e < 6.0 source/target pseudo-expiry port; 6.0 implements those natively.

**Removed**
* The system-class dispatch: the `globalThis.daeSystems` registry, lookup by `game.system.id`, the `CONFIG.DAE.systemClass` fallback, and six base methods that existed only as override points. `DAESystemDND5E` extends `DAESystem` directly; `DAE.systemClass` exposes the active system class.
* The game-system compatibility machinery: the `gameSystemCompatible` states, the `DAEUntestedSystems` setting and its strings, the pf2e blocklist and the `game.system.flags.daeCompatible` protocol.
* The ATL runtime translation layer and the `atl` migration option.
* DAE's vision-mode sibling injection; core's `_inflateVisionModeChange` does the job. DAE only keeps `sight.visionMode` ahead of its equal-priority siblings, so an explicit `sight.*` value still wins whatever order it was authored in.
* DAE's 165-line inline change renderer; dnd5e's changes tab renders its own rows. The sheet extends dnd5e's unconditionally.
* The migration no longer rewrites pre-v10 `data.` change keys or appends the missing `.all` to midi optional keys; both are still handled at apply time.

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
