# DAE v14 Testing Checklist (vs dae-10x / v13)

Covers all functional changes in dae-14x compared to dae-10x. Items marked with **(new)** are entirely new behavior; others are changed behavior that needs regression testing.

---

## 1. Effect Application Phases

The v14 effect application system uses phase-based application (`"initial"`, `"final"`, `"daePostDerived"`) instead of the v13 spec-list approach (`baseSpecsObj` / `derivedSpecsObj`).

- [ ] Base actor stats (HP, abilities, AC) are correctly modified by active effects during the `initial` phase
- [ ] Derived stats (spell DC, proficiency-dependent values) are correctly modified during the `final` phase
- [ ] **(new)** `daePostDerived` phase applies effects that depend on fully-derived actor data
- [ ] **(new)** `_completedActiveEffectPhases` prevents duplicate application of the same phase — verify no console error about phase already completed during normal use
- [ ] Effects with `flags.dae.showIcon` still display on the token (v13 patched `isTemporary`; v14 removes this patch — verify core v14 handles it natively)
- [ ] Transfer effects from items are applied correctly
- [ ] Enchantment effects on items are applied correctly
- [ ] Suppressed effects are skipped
- [ ] Disabled effects are skipped

## 2. Special Durations (moved to specialDurations.ts)

Previously handled inline in `dae.ts`; now in a dedicated module. Verify identical behavior.

### combatEnd
- [ ] Effects with `specialDuration: ["combatEnd"]` are expired when combat is deleted (`preDeleteCombat` hook)
- [ ] Only the GM processes the expiry (non-GM clients should not duplicate)
- [ ] Transfer effects with `combatEnd` are handled correctly
- [ ] Enchantment effects with `combatEnd` are handled correctly
- [ ] Multiple actors in the same combat all have their `combatEnd` effects expired

### joinCombat
- [ ] Effects with `specialDuration: ["joinCombat"]` are expired when the actor's combatant is created (`preCreateCombatant` hook)
- [ ] Works for actors added to combat mid-fight

## 3. Macro Repeats (moved from times-up to DAE)

Previously handled by times-up's `updateCombat` hook; now in DAE's `specialDurations.ts`.

### Basic firing
- [ ] `startEveryTurn` — macro fires at the start of the effect owner's turn
- [ ] `endEveryTurn` — macro fires at the end of the effect owner's turn
- [ ] `startEndEveryTurn` — macro fires at both start and end of the owner's turn
- [ ] `startEveryTurnAny` — macro fires at the start of every combatant's turn (even if effect is disabled/suppressed)
- [ ] `endEveryTurnAny` — macro fires at the end of every combatant's turn (even if disabled/suppressed)
- [ ] `startEndEveryTurnAny` — macro fires at both start and end of every combatant's turn

### Disabled/suppressed behavior
- [ ] `startEveryTurn` does NOT fire when the effect is disabled or suppressed
- [ ] `endEveryTurn` does NOT fire when the effect is disabled or suppressed
- [ ] `startEveryTurnAny` DOES fire even when the effect is disabled or suppressed
- [ ] `endEveryTurnAny` DOES fire even when the effect is disabled or suppressed

### Turn tracking
- [ ] **(new)** Options use `dae.combat.round` / `dae.combat.turn` keys (was `times-up.combat.*`) — verify no interaction issues with times-up also setting options
- [ ] Advancing one turn fires the correct start/end macros
- [ ] Advancing multiple turns (e.g., skipping a combatant) fires macros for all intermediate turns
- [ ] Round rollover (last turn → first turn of next round) fires correctly
- [ ] Only the active GM processes macro repeats

## 4. Special Duration / Macro Repeat UI (unconditional registration)

In v13, `daeSpecialDurations` and `daeMacroRepeats` were only populated if times-up was active. In v14, they are always populated.

- [ ] **(new)** The DAE effect config sheet shows special duration options (`turnStart`, `turnEnd`, `turnStartSource`, `turnEndSource`, `combatEnd`, `joinCombat`) even when times-up is NOT active
- [ ] **(new)** The DAE effect config sheet shows macro repeat options even when times-up is NOT active
- [ ] Special duration dropdown works correctly with times-up active
- [ ] Macro repeat dropdown works correctly with times-up active

## 5. Duration Management (moved from times-up to DAE)

All duration management now lives in `specialDurations.ts`. times-up-14x is a stub — these tests should pass with times-up **disabled**.

### Duration conversion (seconds ↔ rounds)
- [ ] Short seconds-based effects (≤ `maxShortDuration`) convert to rounds on `combatStart`
- [ ] Short seconds-based effects convert to rounds when a combatant is added (`createCombatant`)
- [ ] Effects convert back to seconds when combat is deleted (`deleteCombat`)
- [ ] Effects convert back to seconds when a combatant is removed (`deleteCombatant`)
- [ ] `flags.times-up.durationSeconds` stores the original seconds value on conversion (backward compat)
- [ ] Effects exceeding `maxShortDuration` (default 600s) are NOT converted
- [ ] Transfer effects are only converted if `updatePassiveEffects` is enabled

### Effect creation in combat (`preCreateActiveEffect`)
- [ ] New effects with short seconds duration are auto-converted to rounds when created during combat
- [ ] New effects with round/turn duration missing `startRound` get it set from current combat
- [ ] New effects with seconds duration missing `startTime` get it set from `game.time.worldTime`
- [ ] Applied enchantments on items also get duration setup

### Transfer effect lifecycle (`preDeleteActiveEffect` / `preUpdateActiveEffect`)
- [ ] Transfer effects are disabled (not deleted) when they expire via v14 registry
- [ ] Applied enchantments are still deleted normally (not intercepted)
- [ ] Disabling is skipped when `enablePassiveEffects` is false
- [ ] Re-enabling a disabled transfer effect resets `startRound`/`startTurn`/`startTime`
- [ ] Re-enabling in combat converts back to rounds if within `maxShortDuration`

### Expire round effects on combat end
- [ ] `expireRoundEffectsOnCombatEnd` setting expires round/turn-based effects when combat ends
- [ ] Transfer effects are NOT expired by this setting
- [ ] Dependent effects (via `flags.dnd5e.dependentOn`) are skipped when their parent is also expiring
- [ ] Circular dependencies are detected and broken

### `CONFIG.ActiveEffect.expiryAction`
- [ ] **(new)** `CONFIG.ActiveEffect.expiryAction = "delete"` is set by DAE's init hook (not times-up)
- [ ] Works correctly with times-up disabled

### Guard checks
- [ ] All duration management hooks are gated by `durationManagementEnabled` setting
- [ ] Only the active GM processes combat hooks (`combatStart`, `createCombatant`, `deleteCombatant`, `deleteCombat`)

## 6. Effect Expiry via actionQueue

The `actionQueue` (Semaphore) serializes effect expiry to prevent race conditions.

- [ ] Multiple effects expiring simultaneously (e.g., several `combatEnd` effects) are processed without errors
- [ ] Effect expiry during combat deletion doesn't cause orphaned references

## 7. DAE Macro Execution

`daeMacro()` is called from the new `processMacroRepeats()` with the same arguments as before.

- [ ] The `args[0]` passed to the macro is `"each"` (not `"on"` or `"off"`)
- [ ] `lastArg.turn` is `"startTurn"` or `"endTurn"` as appropriate
- [ ] `lastArg.actor`, `lastArg.effectId`, `lastArg.tokenId`, `lastArg.actorUuid`, `lastArg.actorID`, `lastArg.efData` are all populated
- [ ] ItemMacro resolution works (the macro specified in the effect's `macro.itemMacro` change)

## 8. Migration

Some migration functions were removed in v14.

- [ ] `localDeleteFilters()` (Token Magic cleanup) removed — verify Token Magic integration still works if the module is active
- [ ] `cleanDAEArmorWorld()` removed — verify no issues with existing worlds that have legacy DAE armor data

## 9. API Surface

- [ ] `globalThis.DAE` API object is set up correctly
- [ ] `DAE.actionQueue` is accessible
- [ ] `DAE.daeMacro()` is callable externally (used by times-up in v13, may be used by other modules)
- [ ] `applyDaeEffects` export alias still works for backward compatibility
- [ ] **(new)** `DAE.expireEffect()` is callable and correctly expires/disables effects
- [ ] **(new)** `DAE.isEffectExpired()` returns correct expiry status
- [ ] **(new)** `DAE.isTransferEffect()` correctly identifies transfer effects
- [ ] **(new)** `DAE.hasDuration()` / `DAE.hasExpiry()` work correctly
- [ ] **(new)** `window.TimesUp.isEffectExpired` / `window.TimesUp.expireEffect` still work (backward compat stubs in times-up)

## 10. Duration Management Settings & Migration

### New DAE settings
- [ ] **(new)** `dae.durationManagementEnabled` (Boolean, default: true) — disabling prevents all duration management hooks from running
- [ ] **(new)** `dae.enablePassiveEffects` (Boolean, default: true) — disabling lets transfer effects be deleted instead of disabled on expiry
- [ ] **(new)** `dae.updatePassiveEffects` (Boolean, default: true) — disabling prevents transfer effect duration conversion
- [ ] **(new)** `dae.expireRoundEffectsOnCombatEnd` (Boolean, default: false) — enabling expires round/turn effects when combat ends
- [ ] All 4 settings appear in the DAE settings UI with correct names/hints
- [ ] Changing settings triggers `fetchParams` (live update, no reload needed)

### One-time migration from times-up
- [ ] **(new)** If times-up settings exist and `dae.timesUpMigrated` is false, settings are copied to DAE namespace at `ready`
- [ ] **(new)** `MaxRoundsToConvert` (rounds) is correctly converted to `maxShortDuration` (seconds) using `CONFIG.time.roundTime`
- [ ] **(new)** Migration only runs once (`dae.timesUpMigrated` set to true after migration)
- [ ] **(new)** If times-up was never installed (settings don't exist), migration is skipped silently

## 11. Edge Cases

- [ ] Actor with no effects — no errors during effect application
- [ ] Actor not in combat — macro repeats don't fire, special durations don't trigger
- [ ] Combat with no combatants — deleting combat doesn't error
- [ ] Effect created during combat on an actor not in the encounter — no spurious expiry
- [ ] Multiple combats active — correct combat is referenced for each actor
- [ ] Unlinked token actors — effects and macro repeats work correctly
