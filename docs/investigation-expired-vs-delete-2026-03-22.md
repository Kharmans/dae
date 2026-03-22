# Investigation: Switching DAE/midi-qol Expiry from Delete to `duration.expired`

Date: 2026-03-22

## Question

What are the implications of changing DAE and midi-qol's effect expiry code to set `duration.expired = true` on effects instead of deleting them?

## Current Behavior

### Non-Transfer Effects
Currently, when DAE or midi-qol expires a non-transfer effect (the common case for spell effects applied to targets), the effect is **deleted**:
- DAE `expireEffect()`: calls `effect.delete()` for non-transfer effects
- DAE `expireEffects()`: calls `actor.deleteEmbeddedDocuments("ActiveEffect", ids)` in batch
- midi-qol `expireEffects()`: identical pattern — `actor.deleteEmbeddedDocuments` for actor effects, `effect.delete()` for item effects

### Transfer Effects
Transfer effects (passive effects from items) are already **disabled** rather than deleted:
- DAE: `getExpireTransferEffectUpdate()` sets `disabled: true`, clears start data, sets `duration.expired = false`
- midi-qol: `effect.update({ "disabled": true })` for transfer effects
- This allows transfer effects to be re-enabled with fresh duration when the item is re-equipped or conditions change

### Exception: Applied Enchantments
Applied enchantments (dnd5e-specific) are always deleted regardless of transfer status.

## What Would Change

If we switch to setting `duration.expired = true` instead of deleting:

### For Non-Transfer Effects (the main change)

**Before**: `effect.delete()` — effect is removed from actor
**After**: `effect.update({ "duration.expired": true })` — effect stays on actor, marked expired

Effects with `duration.expired = true` become:
- `isSuppressed = true`
- `active = false`
- Excluded from `appliedEffects` (their changes no longer apply)
- Still present in `actor.effects` collection
- Still yielded by `allApplicableEffects()`

## Issues and Implications

### 1. Effect Accumulation on Actors

**Problem**: Expired effects would accumulate on actors indefinitely. A long combat with many spells could leave dozens of expired effects on each actor.

**Impact**:
- `actor.effects` collection grows over time
- `allApplicableEffects()` iterates over more effects
- Actor sheets show more effects (unless filtered)
- Database grows larger
- No automatic cleanup mechanism exists in core

**Possible mitigation**: Add periodic cleanup (e.g., on long rest, on combat end, or via a manual "purge expired" action).

### 2. DAE's `getApplicableEffects()` Returns Expired Effects

**Problem**: DAE's `getApplicableEffects()` uses `allApplicableEffects()`, which yields ALL effects including expired ones. This means:

- **Duration management hooks** (`combatStart`, `deleteCombat`, etc.) would iterate over and attempt to process already-expired effects. For example, `setEffectsExpiryToRounds()` iterates `getApplicableEffects()` and would see expired effects.
- **Special duration expiry scanning** (`preDeleteCombatHook`, `preCreateCombatantHook`) filters by `flags.dae.specialDuration` — expired effects with special durations would be matched again.
- **Macro repeat processing** (`processMacroRepeats`) iterates `getApplicableEffects()` — expired effects with macroRepeat flags would be found (though the code does check `effect.disabled || effect.isSuppressed` for some repeat types).

**Fix required**: All DAE code that uses `getApplicableEffects()` for duration management would need to add `!effect.duration?.expired` or `effect.active` filters. Alternatively, `getApplicableEffects()` could be changed to exclude expired effects by default, with an option to include them.

### 3. midi-qol's `getAppliedEffects()` Already Filters

**Not a problem**: midi-qol's `getAppliedEffects()` uses `actor.appliedEffects`, which already filters to `active === true`. Expired effects would automatically be excluded. The `expireMyEffects()` function and other special duration handlers in midi-qol already only see active effects.

**However**: midi-qol's `expireEffects()` function would need to change from `deleteEmbeddedDocuments` to `update({ "duration.expired": true })`.

### 4. Interaction with `CONFIG.ActiveEffect.expiryAction`

**Conflict**: If DAE's `expiryAction` setting is `"update"` (the default), core will ALSO try to mark effects as expired via the registry. This means:
- Core handles time-based and combat-event-based expiry via the registry
- DAE/midi-qol handle special duration expiry (1Action, 1Hit, etc.) via hooks

If both systems set `duration.expired = true`, there's no conflict — it's idempotent. But if DAE is set to `expiryAction: null` (manual handling), then DAE would need to handle ALL expiry including the events that core normally handles.

The cleanest approach: Let core handle standard duration+event expiry via the registry with `expiryAction: "update"`, and have DAE/midi-qol's special duration expiry also set `duration.expired = true` (instead of deleting).

### 5. Transfer Effect Handling Would Align

**Benefit**: Transfer effects already use a "mark inactive" pattern (disabled). Switching non-transfer effects to use `duration.expired` would align the two approaches — both would stay on the actor but become inactive. Transfer effects would use `disabled = true`, non-transfer effects would use `duration.expired = true`.

However, the current transfer effect pattern also clears start data and resets `duration.expired = false` (via `getExpireTransferEffectUpdate()`), specifically so the effect can be re-enabled with fresh timing. Non-transfer effects don't need this re-enable capability — they're typically one-shot spell effects.

### 6. Effect Origin / Concentration Chain

**Problem**: DAE's `expireEffect()` has special dnd5e logic for concentration: it checks whether the expired effect's origin is a concentration effect and whether that concentration still has remaining duration. This prevents premature deletion when concentration is still active.

If switching to `duration.expired`, the concentration check would still be needed — you wouldn't want to mark an effect as expired if its concentration source is still holding it active. The logic would change from "don't delete" to "don't mark expired", which is functionally equivalent.

### 7. Effect Sheet Display

**UI concern**: Expired effects would still appear on actor sheets and effect lists. dnd5e's sheet (and Tidy5e) may or may not distinguish expired effects visually. Users might be confused by seeing "dead" effects still listed.

**Possible mitigation**: dnd5e or DAE could add CSS styling for expired effects, or filter them from default views.

### 8. `isExpiryTrackable` Self-Cleanup

**Benefit**: The registry uses `isExpiryTrackable`, which requires `active === true`. Once an effect is marked `duration.expired = true`, it becomes `isSuppressed = true`, then `active = false`, and the registry automatically stops tracking it. This prevents double-expiry from the registry side.

### 9. Effect Deletion Hooks

**Change in behavior**: Currently, expiring an effect triggers `preDeleteActiveEffect` / `deleteActiveEffect` hooks. Switching to `duration.expired` would instead trigger `preUpdateActiveEffect` / `updateActiveEffect`. Any code that relies on delete hooks to detect effect expiry would need to change.

Known consumers:
- dnd5e's concentration system listens for effect deletion to potentially break concentration
- DAE's dependent effects (`flags.dnd5e.dependentOn`) — deletion of a parent effect cascades to dependents. With `duration.expired`, the parent wouldn't be deleted, so dependents wouldn't auto-cascade. This would need explicit handling.
- midi-qol's `deleteActiveEffect` hook handlers

### 10. Dependent Effects (dnd5e)

**Problem**: dnd5e has a `flags.dnd5e.dependentOn` system where deleting a parent effect cascades deletion to dependent effects. If the parent is marked expired instead of deleted, the cascade won't fire.

DAE's `expireEffectsSkipDependents()` already handles this — it checks for dependent effects in the expiry set and skips them (letting the cascade handle it). With `duration.expired`, we'd need to explicitly find and expire dependent effects too.

## Recommendation

Switching to `duration.expired = true` is feasible but requires significant work:

### Required Changes

1. **DAE `expireEffect()`**: Change `effect.delete()` to `effect.update({ "duration.expired": true })` for non-transfer, non-enchantment effects
2. **DAE `expireEffects()`**: Change batch delete to batch update
3. **midi-qol `expireEffects()`**: Same change
4. **DAE `getApplicableEffects()`**: Add option to exclude expired effects, or add filters at all call sites
5. **Dependent effect handling**: Add explicit cascade for `flags.dnd5e.dependentOn`
6. **Concentration integration**: Update to check `duration.expired` changes instead of deletions
7. **Cleanup mechanism**: Add purge of expired effects at appropriate points (combat end, long rest, etc.)

### Benefits
- Aligns with v14's intended model (`expiryAction: "update"` is the default)
- Effects can be inspected after expiry (debugging, logging)
- Potential for "revive" functionality
- Consistent with transfer effect handling
- Registry self-manages (stops tracking expired effects automatically)

### Risks
- Effect accumulation without cleanup
- DAE's `getApplicableEffects()` returning expired effects could cause subtle bugs in duration management
- Breaking change for any code relying on delete hooks for expiry detection
- Dependent effect cascade needs rework
- UI clutter from expired effects

### Suggested Approach

If pursuing this change, do it incrementally:
1. First, set `expiryAction: "update"` as default and verify core handles standard expiry correctly
2. Then update DAE's `expireEffect()` / `expireEffects()` for special durations
3. Then update midi-qol's `expireEffects()`
4. Add cleanup mechanisms
5. Update dependent effect handling
6. Test with the `expiryAction: "none"` setting to verify DAE can handle everything when core is disabled

The alternative is to keep `expiryAction: "delete"` (or `null` with DAE deleting) and not change the fundamental expiry model. This is simpler and well-tested, at the cost of not aligning with v14's default pattern.
