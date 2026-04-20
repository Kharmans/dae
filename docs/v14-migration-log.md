# DAE v14 Migration Log

Tracks all changes made to dae-14x for Foundry v14 compatibility.

## Foundry v14 ActiveEffect Schema Changes (Reference)

### Changes Array
- Moved from top-level `changes` to `system.changes`
- `mode` (numeric 0-5) replaced by `type` (string: "custom", "multiply", "add", "downgrade", "upgrade", "override")
- New `phase` field per change (optional)
- v14 provides read-only shim: `effect.changes` getter delegates to `effect.system.changes`
- v14 provides shim: `change.mode` getter converts string `type` back to numeric

### Duration
- Old: `duration.seconds`, `duration.rounds`, `duration.turns` (separate fields)
- New: `duration.value` (number) + `duration.units` (string: "seconds", "minutes", "hours", "days", "months", "rounds", "turns")
- New: `duration.expiry` (string: "turnStart" or "turnEnd")
- v14 auto-migrates old fields in `migrateData()` and provides read-only shims

### Start Data
- Old: `duration.startTime`, `duration.startRound`, `duration.startTurn`, `duration.combat`
- New: `start.time`, `start.round`, `start.turn`, `start.combat`
- v14 auto-migrates in `migrateData()` and provides read-only shims

### Localization Keys
- `EFFECT.Duration` -> `EFFECT.DURATION.Label`
- `EFFECT.StartTurns` -> `EFFECT.START.Header`
- `EFFECT.FIELDS.duration.combat.label` -> `DOCUMENT.Combat`
- `EFFECT.ChangeKey` -> `EFFECT.FIELDS.changes.element.key.label`
- `EFFECT.ChangeMode` -> `EFFECT.FIELDS.changes.element.type.label`
- `EFFECT.ChangeValue` -> `EFFECT.FIELDS.changes.element.value.label`
- `EFFECT.ChangePriority` -> `EFFECT.FIELDS.changes.element.priority.label`
- `EFFECT.ConfigTitle` -> auto-generated from document name (no longer needed)

### Detection Modes (Token)
- Old: `token.detectionModes` is an array of `{id, enabled, range}`
- New: `token.detectionModes` is a keyed object where key=id, value=`{enabled, range}`

### ApplicationV2
- `preventClose` option on `submit()` is unnecessary (programmatic submit doesn't close)

### v14 applyChange Architecture
- `ActiveEffect.applyChange(targetDoc, change, options)` is now a static method
- For keys with a DataModel field, core routes through `applyChangeField` → `field.applyChange()` — the `applyActiveEffect` hook still fires for `type: "custom"` via `DataField._applyChangeCustom`
- For keys without a DataModel field, core uses `_applyChangeUnguided` (legacy heuristic path)
- `AnyField` stores values as-is — no `JSON.parse` conversion. Always use string values for effect changes.
- `type: "override"` breaks Set fields (replaces Set with plain value). Use `type: "add"` for Set-based trait fields.

---

## Completed Migrations

### Effect Application Architecture (libWrapper Refactoring)

**Files changed:**
- `src/module/dae.ts` — `daeApplyActiveEffects`, `daeApplyChange`, getRollData registration
- `src/module/Systems/DAESystem.ts` — `initActions()` rewritten, removed `getRollData` pass-through and `getRollDataFunc()`
- `src/module/Systems/DAEdnd5e.ts` — `initActions()` updated, removed `getRollDataFunc()` override, removed Item.applyActiveEffects OVERRIDE

#### applyActiveEffects: WRAPPER (not OVERRIDE)

DAE previously used an OVERRIDE on `Actor.applyActiveEffects` with a pre-marking hack — it added the current phase to `_completedActiveEffectPhases` before calling the original function, so core would early-return. This broke when dnd5e 5.3 dropped the `phase` argument when calling `super.applyActiveEffects()`.

The fix went through two iterations: first converting to a clean OVERRIDE that replicated core logic, then converting to a WRAPPER that lets core+dnd5e handle phase validation, change collection, sorting, and `applyChange` calls. DAE wraps to add:
- Phase correction for "missed" changes (ValidSpec says a key belongs to a different phase than the change specifies)
- `showIcon` deprecation warnings
- CI priority enforcement (priority 0 for `system.traits.ci.*` keys)

Both `DAESystem.initActions()` (base) and `DAEdnd5e.initActions()` now register as `"WRAPPER"`.

#### applyChange: MIXED wrapper

`daeApplyChange` is registered as a MIXED wrapper on the static `ActiveEffect.applyChange`. MIXED mode allows per-call decisions on whether to chain to `wrapped()`. Three paths legitimately skip core processing:
- **ATL exclusion**: `ATL.*` keys return `{}` (ATL module handles these directly)
- **Phase correction**: Changes whose ValidSpec phase differs from the current phase return `{}` (collected and applied later by `daeApplyActiveEffects`)
- **bonusSelector expansion**: Synthetic keys like `system.bonuses.All-Attacks` expand into multiple real keys and recurse through the full `applyChange` chain

All other paths chain to `wrapped()` after applying DAE transformations: field mappings, `dae.eval()`/`dae.roll()` expression evaluation, `@data.` deprecation rewrite, `@stackCount` substitution, OverTime key suffixing, `midi-qol.optional` `.all` suffix fix, and stack count multi-apply.

**Item target handling** (previously a separate Item.applyActiveEffects OVERRIDE) is now in `daeApplyChange`: when `targetDoc` is an Item, `@UUID`/`@uuid` values are masked to `##UUID`/`##uuid` to prevent roll data mangling, and actor rollData is injected as `replacementData` so `@-expressions` resolve.

#### Removed Item.applyActiveEffects OVERRIDE

DAE had an OVERRIDE on `Item.prototype.applyActiveEffects` (~45 lines) that replicated core behavior with minor additions. In v14, dnd5e only calls `Item.applyActiveEffects` for enchantment effects during actor preparation (gated by `_embeddedPreparation`), so the OVERRIDE was unnecessary. The Item-specific handling was moved into the `daeApplyChange` MIXED wrapper (see above).

#### getRollDataFunc indirection removed

`DAESystem` had a `getRollData` function that just called `wrapped()` and a `getRollDataFunc()` method returning it. `DAEdnd5e.getRollData` called `DAESystem.getRollDataFunc().bind(this)(wrapped, ...args)` — an indirect way of calling `wrapped()`.

Replaced with a `getRollDataWrapper: Function | null` static property. DAEdnd5e sets it to its enrichment function in `initActions()`. The registration site checks for non-null before registering. DAEdnd5e's `getRollData` now calls `wrapped(...args)` directly.

### DAE Effect Editor — v14 Schema Compliance

**Problem:** The DAE effect editor used v13 data paths for form fields and code, relying on backward-compatibility shims instead of the actual v14 data schema.

#### Template Changes

**`src/templates/DAESheetConfig/Changes.hbs`:**
- Fixed localization keys (see reference above)
- Changed all form field `name` attributes: `changes.X.key` -> `system.changes.X.key` (also `.type`, `.value`, `.priority`)
- Changed data source: `source.changes` -> `source.system.changes`

**`src/templates/DAESheetConfig/Duration.hbs`:**
- Full rewrite to v14 core layout
- **Effect Start fieldset**: Read-only display via core `_prepareStartContext()` using `game.time.calendar.format()`. Removed editable `start.time`/`start.round`/`start.turn` number inputs. Removed SimpleCalendar dependency. Added "Reset Start to Now" button.
- **Effect Duration fieldset**: Uses `formInput`/`formGroup` with schema fields for proper validation. Duration units grouped (Time vs Combat). Expiry Event dropdown always visible with all 6 core events.
- **DAE fieldset**: Separate fieldset with Combat Actor Override, Macro Repeat, and Special Durations.
- Added `class="flexrow"` and warning `<span>` to the Duration label to match core.

**`src/templates/DAESheetConfig/Details.hbs`:**
- Added `{{formGroup fields.showIcon ...}}` dropdown (Never / Conditional / Always) after the `statuses` field

#### TypeScript Changes (`src/module/apps/DAEActiveEffectConfig.ts`)

- Removed `window.title: "EFFECT.ConfigTitle"` from DEFAULT_OPTIONS (v14 auto-generates)
- `_prepareContext`: `context.source!.changes` -> `context.source!.system.changes`
- `updateFieldInfo`: `this.document.changes` -> `this.document.system.changes`
- `#onEditValue`: `this.document.changes[index]` -> `this.document.system.changes[index]`, textarea selector `changes.${index}.value` -> `system.changes.${index}.value`
- `#onAddChange`: Rewritten to collect from `submitData.system?.changes`, append via `schema.fields.changes.element.getInitialValue()`, submit as `{system: {changes}}`
- `#onDeleteChange`: Same pattern — collect from `submitData.system?.changes`, splice, submit as `{system: {changes}}`
- `_processSubmitData`: Removed `submitData.changes` -> `submitData.system.changes` migration block (no longer needed since form fields use `system.changes` paths directly)
- Removed `MODES_TO_TYPES` constant (only used by removed migration block)
- Removed all `preventClose: true` from `submit()` calls (unnecessary in v14 ApplicationV2)

### Duration & Expiry

#### Special Duration Migration to v14 `duration.expiry`

**Files changed:**
- `src/module/specialDurations.ts` — application-time migration, `expireEffect()` rewritten
- `src/module/dae.ts` — `expireEffects()` updated, `expireRealTime` references removed
- `src/module/settings.ts` — removed `expireRealTime` setting
- `src/globals.ts` — removed `expireRealTime` type
- `src/dae.ts` — removed deprecated entries from dropdown

Removed 5 deprecated special duration types — now handled natively by v14's `duration.expiry` + DAE's `combatActorOverride`:

| Removed Special Duration | v14 Replacement |
|---|---|
| `turnStart` | `duration.expiry: "turnStart"` + `combatActorOverride: "target"` |
| `turnEnd` | `duration.expiry: "turnEnd"` + `combatActorOverride: "target"` |
| `turnStartSource` | `duration.expiry: "turnStart"` + `combatActorOverride: "source"` |
| `turnEndSource` | `duration.expiry: "turnEnd"` + `combatActorOverride: "source"` |
| `combatEnd` | `duration.expiry: "combatEnd"` |

Only `joinCombat` remains in the base special duration list (no v14 core equivalent).

Migration is applied at edit-time (`_prepareContext`) and application-time (`preCreateActiveEffect` hook). The `preDeleteCombat` hook handler for `combatEnd` remains as a runtime fallback for un-migrated effects.

#### expiryAction Setting

New DAE setting `expiryAction` configures `CONFIG.ActiveEffect.expiryAction`:
- **"update"** (default): v14 marks expired effects with `duration.expired = true` (suppressed but kept)
- **"delete"**: v14 deletes expired effects immediately
- **"none"**: Disables v14's automatic expiry handling; DAE/midi-qol handle expiry manually

DAE's `expireEffect()`, `expireEffects()`, and midi-qol's `expireEffects()` respect this setting. Transfer effects still use the existing disable pattern. Applied enchantments are still deleted.

#### Per-Effect Expiry Mode

`src/dae.ts` wraps `ActiveEffect.registry.refresh()` to support per-effect `flags.dae.expiryMode` that overrides the global `CONFIG.ActiveEffect.expiryAction`. Uses pre-hooks (`preDeleteActiveEffect`, `preUpdateActiveEffect`) during registry refresh to redirect effects whose per-effect mode differs from the global setting.

#### Removed `expireRealTime` setting

The `expireRealTime` setting was non-functional (commented out in code). Removed entirely. v14's core `ActiveEffectRegistry` handles time-based expiry natively.

### Dead Code, Legacy Cleanup, and Optimization

**Files changed:**
- `src/module/dae.ts` — major cleanup and refactoring (~400 lines net reduction)
- `src/module/GMAction.ts` — dead version checks removed, performance improvements, macro.createItem fix
- `src/module/specialDurations.ts` — simplified `isTransferEffect`, merged duplicate branches, fixed variable shadowing
- `src/module/apps/ActiveEffects.ts` — removed `legacyTransferral` condition
- `src/module/migration.ts` — removed 6 precondition check blocks, removed obsolete OwnedItem migration and tobMapper
- `src/module/Systems/DAESystem.ts` — removed `doCustomValue()`, `getRollData` pass-through, stale comments
- `src/module/Systems/DAEdnd5e.ts` — removed commented-out blocks, `getRollDataFunc()`, consolidated trait handlers
- `src/module/apps/FieldBrowser.ts` — removed dead v12 generation check
- `src/css/field-browser.less` — removed dead `&.dae-v12` CSS block
- `src/module/apps/DIMEditor.ts` — uses `getItemMacroCommand()` helper
- `src/module/API/api.ts` — updated exports
- `src/dae.ts` — removed commented-out `legacyTransferral = false`

#### legacyTransferral cleanup (-243 lines)

`CONFIG.ActiveEffect.legacyTransferral` is always `false` in dnd5e v5 (hardcoded at init). All code branches guarded by `legacyTransferral === true` were dead:
- `effectIsTransfer` simplified to `return effect.transfer === true`
- `updateItemEffects` and `updateTransferEffectsHook` gutted to no-ops, then removed entirely
- Dead branches removed from `addEffectChange`, `removeEffectChange`, `deleteItemHook`, `createItemHook`
- `isTransferEffect` (specialDurations.ts) simplified to `return effect.transfer`
- 6 precondition check blocks removed from migration.ts
- Removed stub functions `preUpdateItemHook`, `_preCreateEnchantmentEffect` and their hook registrations

#### Removed obsolete migration and utility code
- `cleanEffectOrigins` and all supporting functions (`cleanActorEffectOrigins`, `cleanActorItemsEffectOrigins`, `cleanAllActorEffectOrigins`, `cleanAllActorItemsEffectOrigins`, `cleanAllTokenEffectOrigins`, `replaceOwnedItemOrigins`) — ancient `OwnedItem` → `Item` origin migration from pre-v10
- `tobMapper` — one-off Tome of Beasts token image mapping utility
- Both removed from API exports
- Unused `dae.ts` imports cleaned up from `migration.ts`
- Removed 3 unused armor migration functions (`removeAllActorArmorItems`, `removeAllTokenArmorItems`, `removeActorArmorItems`)

#### Dead version checks and compatibility code removed
- `expandEffectChanges` function (dead code, bonusSelector expansion now in applyChange)
- `useDetermineSuppression` variable and all 4 call sites (removed from both core v14 and dnd5e v5)
- `doCustomValue()` function (DAESystem.ts, unused)
- Commented-out code blocks: initiative flags, movement effects, modifyDerivedSpecs, character flags, `_preDeleteActiveEffectBeta`, `preCreateItemHook`, 4 libWrapper registrations
- dnd5e 5.2.99 version checks (always true in v14, removed if-wrappers)
- `dae.roll` error message updated (still referenced "foundry version 12")
- Dead v12 generation check in `FieldBrowser.ts` and associated `&.dae-v12` CSS
- 3 dead `addDependent` fallback blocks in GMAction.ts (dnd5e 5.2+ handles natively)
- `_deleteEffects` null safety fix (continue instead of falling through when actor is null)

#### New utility functions
- **`getItemMacroCommand(source)`**: Resolves macro command text from an item or raw item data, checking `flags.dae.macro.command`, `flags.itemacro.macro.command`, and `flags.itemacro.macro.data.command` in precedence order. Replaced ~10 inline resolution patterns across `dae.ts`, `GMAction.ts`, and `DIMEditor.ts`. Exported on the DAE API.
- **`CREATE_ITEM_KEYS`**: `Set` constant for O(1) lookup of `macro.createItem` / `macro.createItemRunMacro`, replacing repeated array `includes()` calls.
- **`allMacroEffects`** and **`macroDestination`**: Now exported on the DAE API for external module use.

#### Consolidated trait handlers (DAEdnd5e.ts)
- Merged 4 separate damage `.all` cases (`di.all`, `dr.all`, `dv.all`, `da.all`) and `sdi.all` into a single parameterized handler
- Merged 7 separate damage `.custom` cases and 4 proficiency `.custom` cases into a single consolidated handler
- Merged `armorProf.all` and `weaponProf.all` into a parameterized handler using trait key extraction
- Merged dual-loop patterns in `configureLists()` for conditions, tools, armor, and weapons (each from 2 loops to 1)

#### Performance improvements
- **Merged duplicate `setEffectsExpiryToRounds` branches** (specialDurations.ts): Transfer and non-transfer branches executed identical code; merged into single condition `(!isTransferEffect(effect) || updatePassiveEffects)`
- **Cached `getTokenDocument`/`getToken` in `applyActiveEffects`** (GMAction.ts): 6 repeated calls for the same `targetActor` in the per-effect loop body replaced with cached variables
- **Filter before clone** (GMAction.ts): `duplicate(activeEffects).filter(...)` reordered to `duplicate(activeEffects.filter(...))` to avoid deep-cloning effects that are immediately discarded
- **Fixed variable shadowing** (specialDurations.ts): Removed unused outer `let update = {}`, changed inner declarations to `const`

#### macro.createItem fix
- Removed blanket rejection of items with `system.advancement?.length` — items with advancements were incorrectly blocked with `DND5E.ActorWarningInvalidItem`
- Advancements are now stripped from cloned item data before creation to prevent unprocessed advancements confusing users and to avoid orphaned advancement grants if the actor levels up while the temporary item exists
- The `unsupportedItemTypes` check remains (vehicles/groups still can't receive certain item types)

#### Bug fixes
- Fixed typo in compendium cleanup notification ("Finsihed" → "Finished")

### Detection Modes (midi-qol-14x, not DAE)

This change was in midi-qol-14x but noted here for reference:
- `token.detectionModes.find(m => m.id === id)` -> direct property access `[id]`
- `for (const detectionMode of tokenDetectionModes)` -> `for (const [modeId, detectionMode] of Object.entries(tokenDetectionModes))`

### Test Suite Expansion (dae-tests-14x)

**Files added:**
- `src/12-atl-and-field-mapping-tests.ts` (8 tests)
- `src/13-trait-handler-tests.ts` (11 tests)
- `src/14-proficiency-handler-tests.ts` (12 tests)
- `src/15-movement-handler-tests.ts` (8 tests)
- `src/16-expression-and-stack-tests.ts` (10 tests)
- `src/18-refactored-code-tests.ts` (15 tests)
- `src/19-macro-and-conditional-tests.ts` (16 tests)

**Files changed:**
- `src/dae-tests.ts` — registered 8 new test batches (12-19)
- `src/06-custom-effect-tests.ts` — changed test 6.6 from tool proficiency to weapon proficiency
- `src/10-item-effect-tests.ts` — complete rewrite with enchantment effect coverage (5 tests)

**Coverage added (80 new tests):**
- ATL exclusion (`ATL.*` keys not processed by DAE)
- bonusSelector expansion (All-Attacks, weapon.attack, spell.attack, All-Damage)
- Field mapping (di.all, dr.all -> value with "ALL")
- Damage trait handlers (di/dr/dv `.value`, `.custom`, `.bypasses`)
- Condition immunity (ci.all, ci.custom)
- Language proficiency (value, all, custom)
- Weapon/armor proficiency (value, all, custom)
- Tool proficiency (prof, ability, bonus, all)
- `movement.all` with operators (+, -, *, plain number), units/hover exclusion, no-negative
- `@stackCount` substitution and multi-apply stacking
- `dae.eval()` with arithmetic, `@abilities`, `@stackCount`
- OverTime key unique suffix collision prevention
- `midi-qol.optional` `.all` suffix auto-fix
- Disabled effect no-op, empty value safety
- Item enchantment effects (name override, `@UUID` unmapping, `@-expression` in FormulaField, multiple enchantments)
- `getItemMacroCommand()` — all 3 flag paths, precedence, undefined/null handling (5 tests)
- Consolidated `.all` damage traits (di.all, dr.all, dv.all, da.all) (4 tests)
- Consolidated `.custom` traits (armorProf.custom, dr.custom, mixed traits on one effect) (3 tests)
- Merged `armorProf.all` + `weaponProf.all` on same effect (1 test)
- `configureLists()` output — condition and proficiency lists with negative variants (2 tests)
- `allMacroEffects` and `macroDestination` API coverage (2 tests)
- `macro.execute` — runs named macro on create ("on") and delete ("off") (1 test)
- `macro.actorUpdate` — applies flag updates to actor (1 test)
- `macro.StatusEffect` — applies status condition (1 test)
- `macro.createItem` — creates item on actor from UUID (1 test)
- `disableCondition` — flag-based and expression-based conditional disabling (3 tests)
- `enableCondition` — removes effect when condition becomes false (1 test)
- Effect expiry modes — `expiryMode: "delete"` vs `"suppress"`, flag storage (3 tests)
- Multiple macro keys on one effect (1 test)
- `macro.execute` formula substitution (`@details.level` resolved from rollData) (1 test)
- DAE API expiry utilities (`hasDuration`, `isEffectExpired`, `isTransferEffect`) (1 test)

**Key discovery:** "Special" keys (di.custom, dr.bypasses, ci.all, movement.all, etc.) get ValidSpec phase `"final"` because specials are constructed with `new ValidSpec(..., "final")`. Tests for these keys must use `phase: "final"` in the change data.

### ActiveEffects List & CSS Improvements

**Files changed:**
- `src/templates/ActiveEffects.hbs` — `effect.changes` → `effect.system.changes`
- `src/module/apps/ActiveEffects.ts` — minor update
- `src/css/dae.less` — resizable columns and scrollable layout

#### Template fix
The ActiveEffects list template referenced `effect.changes` which returned empty in v14 (the shim on `toObject()` output only works via getter, not in Handlebars iteration). Changed to `effect.system.changes` to display effect change details correctly.

#### CSS: Resizable columns
Made `.effect-name`/`.effect-label` and `.effect-value`/`.effect-value-value` growable (`flex: 1 0 Npx`) so key and value columns expand when the window is resized. Mode column stays fixed width. Controls column uses `flex: 0 0 auto` to prevent dropdown expansion.

#### CSS: Scrollable effect list
Added flex column chain for `.dae-active-effects .window-content` through `form` → `section` → `.dae-item` → `.dae-effect-list` with `overflow-y: auto` so the effect list scrolls within the window.

#### CSS: Changes tab resize
Added `flex: 1; min-height: 0` on `.dae.active-effect-config .tab.changes` and its `ol` child with `overflow-y: auto`, so the changes tab expands when the editor window is resized. Fixed `changeTab()` to keep current height instead of setting to `"auto"` for the changes tab.

### DAEActiveEffectConfig Cleanup

**Files changed:**
- `src/module/apps/DAEActiveEffectConfig.ts` — refactored (~79 lines net reduction)
- `src/module/apps/BooleanFormulaField.ts` — new file (extracted class)
- `src/templates/DAESheetConfig/Changes.hbs` — uses `enrichedChanges` instead of mutating `source`

#### Extracted BooleanFormulaField
Moved `BooleanFormulaField` class to its own file. Original location re-exports for backward compatibility.

#### Migration guard
Added `static #migratedEffects: Set<string>` to prevent re-running migration on every render. Extracted migration logic to `#migrateDeprecatedData(document)` method.

#### enrichedChanges pattern
Previously, `_prepareContext` mutated `context.source.system.changes` to add `fieldName`/`fieldDescription`/`type` fields for the template. Since `context.source` is `document._source` (same object reference, not a clone), this polluted the actual document data. Changed to build a separate `context.enrichedChanges` array, and `Changes.hbs` now iterates `enrichedChanges`.

#### Other cleanup
- Awaited `this.daeFieldBrowser.init()` instead of fire-and-forget
- Removed `_onDragStart` no-op override
- Removed `_preClose` source cleanup (no longer needed with enrichedChanges)
- Removed redundant `#onAddChange`/`#onDeleteChange` (identical to parent class)

### Redundant start.time Removal

**Files changed:**
- `src/module/GMAction.ts` — removed ~26 lines of `start.time`/`start.round`/`start.turn` assignments
- `src/module/dae.ts` — removed 2 `activeEffectData.start = { time: game.time.worldTime }` lines

Foundry v14 core's `ActiveEffect._preCreate` (for Actor-owned effects) calls `getEffectStart()` which sets `start.time` to `game.time.worldTime` and fills `start.combat`, `start.combatant`, `start.round`, `start.turn` from the active combat. It merges field-by-field, preserving any user-defined values.

DAE was redundantly setting these same fields in three places:
1. **GMAction.ts** `convertDuration()` — set `start.time`, `start.round`, `start.turn` across seconds/rounds/turns branches
2. **dae.ts** `applyActivityEffects()` — set `start = { time: worldTime }`
3. **dae.ts** `applyNonTransferEffects()` — set `start = { time: worldTime }`

All removed. The `combatActorOverride` block in GMAction.ts (which sets `start.combatant` to the *target's* combatant, not current turn) is NOT redundant and was kept.

### Duration Handling: Removed Seconds↔Rounds Conversion

**Files changed:**
- `src/module/dae.ts` — removed `updates["duration.units"] = "seconds"` from `durationExpression` handler

Foundry v14 handles durations natively in whatever units they are specified (seconds, minutes, rounds, etc.) via `_prepareTimeBasedDuration` and `_prepareCombatBasedDuration`. The v13/times-up pattern of forcing all durations to seconds is no longer needed.

The `durationExpression` handler previously set both `duration.value` (the evaluated roll total) and `duration.units = "seconds"`. The units override was removed — the effect now keeps whatever units were configured. Only `duration.value` is set from the expression result.

### Duration Handling: Blank Duration Values

**Files changed:**
- `src/dae.ts` — patched `ActiveEffect.prototype._prepareDuration`

**Problem:** Core's `_prepareDuration` treats a missing `duration.value` (null/undefined) as 0, routing it to `_prepareTimeBasedDuration` which computes `seconds = 0` and `remaining < 0`. This makes event-only effects (e.g. `expiry: "turnStart"` with no duration value, meaning "until the start of your next turn") expire immediately on the next time advance.

**Fix:** DAE patches `_prepareDuration`: when `duration.value` is not a finite number and not `Infinity`, but an `expiry` event is set, returns `remaining: Infinity` and `seconds: Infinity`. The effect stays in the registry (because `isTemporary` is true via the `expiry` field) but won't expire based on time.

### Duration Handling: Event-Only Effects and Time Advance

**Files changed:**
- `src/dae.ts` — extended `isExpiryEvent` patch

**Problem:** Even with `remaining: Infinity` from the `_prepareDuration` patch, the registry's `refresh` method treats `remaining === Infinity` as "duration reached" (by design). Combined with core's `isExpiryEvent` treating `updateWorldTime` as satisfying combat events when not in combat, event-only effects are still deleted on any time advance.

**Fix:** The `isExpiryEvent` patch was extended: when `event === "updateWorldTime"` and the effect has no finite `duration.value`, return `false`. Event-only effects only expire from the actual combat event, never from time advance.

This does NOT affect effects with a finite `duration.value` — those continue to expire on time advance outside combat as core intends.

### Expiry Combatant Override: Three-Option Model

**Files changed:**
- `src/dae.ts` — added `combatActorOverride` handling to `_preCreateActiveEffect`
- `src/module/apps/DAEActiveEffectConfig.ts` — added `""` (default) option to `combatActorOptions`
- `src/lang/en.json` — added `dae.combatActorDefault`, updated labels
- `src/module/GMAction.ts` — existing `combatActorOverride` handling (unchanged)

**Problem:** Core sets `start.combatant` to whoever's turn it is at effect creation time (`combat.combatant`). This is the "current combatant" — not the source (caster) and not the target (the actor the effect is on). In the common case where Actor A casts on their own turn, all three coincide. But for reactions, readied actions, or manual effect creation during another actor's turn, they diverge. The effect then expires on the wrong combatant's turn.

**Fix:** DAE's `flags.dae.combatActorOverride` now has three options:

| Value | UI Label | Behaviour |
|-------|----------|-----------|
| `""` (default) | Default (Active Combatant) | Core behaviour — `start.combatant` = whoever's turn it is at creation |
| `"source"` | Source Combatant | Override to the originating actor's combatant (from `origin` UUID) |
| `"target"` | Target Combatant | Override to the target actor's combatant (the actor the effect is on) |

Previously only `"source"` and `"target"` existed, with `"source"` appearing first in the dropdown (making it the inadvertent default for new effects). The empty string default option was added and placed first.

**Two code paths apply the override:**

1. **Programmatic creation** (GMAction.ts, unchanged): When midi-qol applies effects to targets, checks `combatActorOverride` and sets `start.combatant` in the effect data before creation. For `""`, does nothing — core sets current combatant via `getEffectStart()`.

2. **Manual/general creation** (`_preCreate` hook in dae.ts, new): Runs after core's `_preCreate` sets `start` from `getEffectStart()`. For `"source"`, resolves the origin actor, falling back to the parent actor if no origin. For `"target"`, uses the parent actor. For `""`, does nothing. Both `"source"` and `"target"` resolve to the parent actor's combatant for manually created effects (no distinct source/target).

### Test Suite: Effect Expiry Tests (dae-tests-14x)

**Files added:**
- `src/22-effect-expiry-tests.ts` (13 tests)

**Files changed:**
- `src/dae-tests.ts` — registered batch 22

**Coverage:**
- 22.1: Seconds duration expires on time advance
- 22.2: Seconds duration survives partial time advance
- 22.3: Minutes duration expires on time advance
- 22.4: `turnStart` expiry after 1 round of combat
- 22.5: `turnEnd` expiry after 1 round of combat
- 22.6: Rounds duration expires after N rounds
- 22.7: `combatActorOverride: "source"` expires on source's turn
- 22.8: Rounds-based effect expires outside combat via time elapsed
- 22.9: `roundEnd` expiry
- 22.10: Deprecated `turnStart` special duration migrated to `duration.expiry` on creation
- 22.11: Deprecated `turnStartSource` sets `combatActorOverride: "source"`
- 22.12: Non-deprecated special durations preserved during migration
- 22.13: Effect with duration but no expiry expires on time elapsed

**Registry cleanup helper**: `cleanRegistry()` added to `beforeEach` — removes stale deleted effects from `ActiveEffect.registry` that linger as `WeakRef`s. Without this, stale entries from prior tests can poison `modifyBatch` calls (one invalid ID fails the entire batch, preventing legitimate effects from being deleted).

### Test Suite: Start Time Tests (dae-tests-14x)

**Files added:**
- `src/17-start-time-tests.ts` (8 tests)

**Files changed:**
- `src/dae-tests.ts` — registered batch 17

**Coverage:**
- 17.1: Actor effect gets `start.time` set to worldTime by core
- 17.2: Seconds duration effect gets `start.time`
- 17.3: Rounds duration effect gets `start.time` and combat context
- 17.4: User-defined `start.time` is preserved by core
- 17.5: Core fills all start fields (time, combat, combatant, round, turn)
- 17.6: User `start.time` doesn't prevent core setting combat fields
- 17.7: Item effect without duration does NOT get `start.time` (core only sets for Actor-owned)
- 17.8: Non-enchantment item effect with seconds duration has no `start.time` (DAE skips non-enchantment item effects)

---

## Resolved Issues

- `ActiveEffects.ts` `submitData.changes` / `newAe.changes` references — resolved, no longer present in codebase.
- `effect.changes` references throughout dae.ts, GMAction.ts, DAEdnd5e.ts — all 96 occurrences verified to use `effect.system.changes` (or `aeData.system.changes`) with `@ts-expect-error v14 system.changes` annotations. No deprecated shim usage remains.
