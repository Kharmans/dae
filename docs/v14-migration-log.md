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

---

## Completed Migrations

### 2026-03-21: libWrapper OVERRIDE for applyActiveEffects

**Files changed:**
- `src/module/dae.ts` (~line 119)
- `src/module/Systems/DAESystem.ts` (line 565)
- `src/module/Systems/DAEdnd5e.ts` (line 549)

**Problem:** DAE used WRAPPER mode with a pre-marking hack — it added the current phase to `_completedActiveEffectPhases` before calling `wrapped()`, so core's `applyActiveEffects` would early-return. This broke when dnd5e 5.3's `applyActiveEffects()` dropped the `phase` argument when calling `super.applyActiveEffects()`, causing core to infer "final" instead of "initial".

**Fix:** Changed from WRAPPER to OVERRIDE:
- Removed `wrapped` parameter from `daeApplyActiveEffects()`
- Removed pre-marking hack
- Added direct `this.system.prepareEmbeddedData()` call (the only useful work dnd5e's override did before delegating to core)
- Changed `libWrapper.register()` third arg from `"WRAPPER"` to `"OVERRIDE"` in both DAESystem.ts and DAEdnd5e.ts

### 2026-03-21: DAE Effect Editor — v14 Schema Compliance

**Problem:** The DAE effect editor used v13 data paths for form fields and code, relying on backward-compatibility shims instead of the actual v14 data schema.

#### Template Changes

**`src/templates/DAESheetConfig/Changes.hbs`:**
- Fixed localization keys (see reference above)
- Changed all form field `name` attributes: `changes.X.key` -> `system.changes.X.key` (also `.type`, `.value`, `.priority`)
- Changed data source: `source.changes` -> `source.system.changes`

**`src/templates/DAESheetConfig/Duration.hbs`:**
- Fixed localization keys: `EFFECT.Duration` -> `EFFECT.DURATION.Label`, `EFFECT.StartTurns` -> `EFFECT.START.Header`, `EFFECT.FIELDS.duration.combat.label` -> `DOCUMENT.Combat`
- Duration field names (`duration.value`, `duration.units`, `start.time`, etc.) were already correct for v14

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

### 2026-03-21: Detection Modes (midi-qol-14x, not DAE)

This change was in midi-qol-14x but noted here for reference:
- `token.detectionModes.find(m => m.id === id)` -> direct property access `[id]`
- `for (const detectionMode of tokenDetectionModes)` -> `for (const [modeId, detectionMode] of Object.entries(tokenDetectionModes))`

### 2026-03-22: Duration Tab Redesign + Special Duration Migration

**Files changed:**
- `src/templates/DAESheetConfig/Duration.hbs` — full rewrite
- `src/module/apps/DAEActiveEffectConfig.ts` — context cleanup
- `src/module/specialDurations.ts` — application-time migration
- `src/dae.ts` — removed deprecated entries from dropdown

#### Duration Tab Template Rewrite

Replaced v13-style raw inputs with v14 core layout:
- **Effect Start fieldset**: Read-only display via core `_prepareStartContext()` using `game.time.calendar.format()`. Removed editable `start.time`/`start.round`/`start.turn` number inputs. Removed SimpleCalendar dependency.
- **Effect Duration fieldset**: Uses `formInput`/`formGroup` with schema fields for proper validation. Duration units grouped (Time vs Combat). Expiry Event dropdown always visible with all 6 core events (combatStart/End, roundStart/End, turnStart/End).
- **DAE fieldset**: Separate fieldset with Combat Actor Override, Macro Repeat, and Special Durations.

#### Special Duration Migration to v14 `duration.expiry`

Removed 5 deprecated special duration types from the dropdown — these are now handled natively by v14's `duration.expiry` field + DAE's `combatActorOverride`:

| Removed Special Duration | v14 Replacement |
|---|---|
| `turnStart` | `duration.expiry: "turnStart"` + `combatActorOverride: "target"` |
| `turnEnd` | `duration.expiry: "turnEnd"` + `combatActorOverride: "target"` |
| `turnStartSource` | `duration.expiry: "turnStart"` + `combatActorOverride: "source"` |
| `turnEndSource` | `duration.expiry: "turnEnd"` + `combatActorOverride: "source"` |
| `combatEnd` | `duration.expiry: "combatEnd"` |

Only `joinCombat` remains in the base special duration list (no v14 core equivalent).

**Migration is applied in two places:**
1. **Edit-time** (`_prepareContext`): When opening the effect config sheet, deprecated special durations are automatically converted to `duration.expiry` + `combatActorOverride`.
2. **Application-time** (`preCreateActiveEffect` hook): When an effect with deprecated special durations is applied to an actor, the migration runs via `updateSource()` before creation completes.

The `preDeleteCombat` hook handler for `combatEnd` special duration remains as a runtime fallback for any un-migrated effects.

#### expiryAction Left at v14 Default

#### expiryAction Setting

New DAE setting `expiryAction` configures `CONFIG.ActiveEffect.expiryAction` (applied via `fetchParams()`):
- **"update"** (default): v14 marks expired effects with `duration.expired = true` (suppressed but kept)
- **"delete"**: v14 deletes expired effects immediately
- **"none"**: Disables v14's automatic expiry handling; DAE/midi-qol handle expiry manually via `expireEffect()`

#### Reset Start Time Button

Added a "Reset Start to Now" button (clock-rotate-left icon) in the Effect Start fieldset on the Duration tab. Calls `ActiveEffect.getEffectStart()` to get fresh start data (time, combat, combatant, round, turn) and also clears `duration.expired`.

### 2026-03-22: Expiry Respects expiryAction Setting + Remove expireRealTime

**Files changed:**
- `src/module/specialDurations.ts` — `expireEffect()` rewritten
- `src/module/dae.ts` — `expireEffects()` updated, `expireRealTime` references removed
- `src/module/settings.ts` — removed `expireRealTime` setting
- `src/globals.ts` — removed `expireRealTime` type
- `src/lang/en.json` — removed `expireRealTime` strings, updated `expiryAction` hint
- `midi-qol-14x/src/module/utils.ts` — `expireEffects()` updated

**Changes:**

#### Expiry functions now respect `CONFIG.ActiveEffect.expiryAction`

DAE's `expireEffect()`, `expireEffects()`, and midi-qol's `expireEffects()` now check the `expiryAction` setting when expiring non-transfer actor-owned effects:

- **`"delete"`**: Deletes the effect (previous behavior for all settings)
- **`"update"` or `null`**: Sets `duration.expired = true` — the effect is suppressed (changes stop applying) but remains on the actor

Transfer effects still use the existing disable pattern. Applied enchantments are still deleted.

#### `getApplicableEffects()` excludes expired effects

Added `includeExpired` option (default `false`) to `getApplicableEffects()`. All duration management call sites automatically skip effects with `duration.expired = true`, preventing re-processing of already-expired effects.

#### Removed `expireRealTime` setting

The `expireRealTime` setting was already commented out in code (non-functional). Removed the setting registration, type definition, and all localization strings. v14's core `ActiveEffectRegistry` handles time-based expiry natively.

#### Concentration check simplified

`expireEffect()` concentration logic was simplified: instead of multiple nested `await effect.delete()` calls, it now computes whether the concentration origin has remaining duration and returns early if not (letting concentration removal handle dependents). The actual expiry action (delete vs mark expired) is applied once at the end.

---

## Pending / Known Issues

- `ActiveEffects.ts` (effect list app) still references `submitData.changes` and `newAe.changes` — uses shim getters, functional but should be updated
- Many references to `effect.changes` throughout dae.ts, GMAction.ts, DAEdnd5e.ts — these use the v14 shim getter and work, but emit deprecation warnings. Bulk migration to `effect.system.changes` is a future task.
