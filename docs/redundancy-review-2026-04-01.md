# DAE-14x Redundancy Review — 2026-04-01

Code in dae-14x that may be redundant with Foundry v14 or dnd5e native functionality.

## 1. Duration Expiry Tracking — Partially Redundant

**File:** `specialDurations.ts`

DAE hooks into `preCreateActiveEffect`, `updateCombat`, `preDeleteCombat`, `combatStart`, `deleteCombat`, etc. to track effect duration, expire effects on combat events, and convert between seconds/rounds.

v14's `ActiveEffectRegistry` handles most of this natively — tracks temporary effects, fires `refresh(event)` on all combat events and `updateWorldTime`, checks `isExpiryEvent()`, and performs expiry via `CONFIG.ActiveEffect.expiryAction`.

**Still needed:**
- `setDurationRounds()` / `setDurationSeconds()` — seconds/rounds conversion when entering/leaving combat
- `processMacroRepeats()` — per-turn macro execution (no v14 equivalent)
- `expireRoundEffectsOnCombatEnd` — forcibly expires ALL round-based effects, not just those with `combatEnd` expiry
- Transfer effect disable-instead-of-delete logic

**Candidates to remove:**
- Basic "is this effect expired?" checking — `isEffectExpired()` could delegate to `effect.duration.expired`
- Combat event hooks that duplicate `ActiveEffectRegistry.refresh()` for standard expiry types

## 2. Special Duration Migration — Migration Complete

**File:** `specialDurations.ts` (`migrateDeprecatedSpecialDurations`), `DAEActiveEffectConfig.ts`

Converts legacy `flags.dae.specialDuration` to v14's `duration.expiry`. Per migration log, already completed. Currently runs on every effect sheet open in `_prepareContext()`.

**Action:** Move to a one-time world migration instead of running on every sheet render.

## 3. Phase-Based Effect Application — Extension, Not Duplication

**File:** `dae.ts` (`daeApplyActiveEffects`)

Overrides `Actor.applyActiveEffects()`. v14 now has native phase-based application, `applyChange()`, and `CONFIG.ActiveEffect.changeTypes`.

**Still needed (DAE extensions):**
- `dae.eval()` / `dae.roll()` expressions
- Stack count substitution (`@stackCount`)
- Bonus selector expansion (`expandEffectChanges`)
- Field mappings for deprecated keys
- `macro.*`, `StatusEffect` change keys
- `daeCustomEffect()` for dnd5e-specific custom changes

**No action needed** — this is an extension, not a reimplementation.

## 4. Transfer Effect Detection — Redundant

**File:** `specialDurations.ts` (`isTransferEffect`)

Checks `effect.transfer` with fallback to `CONFIG.ActiveEffect.legacyTransferral` and `flags.dae.transfer`. v14's `effect.transfer` is a native schema field with its own backward-compat shim.

**Action:** Simplify to `return effect.transfer`. The `flags.dae.transfer` fallback may still be needed for very old effects — verify.

## 5. Change Type System — Already Updated

**File:** `DAEActiveEffectConfig.ts`

DAE already uses v14's `ActiveEffect.CHANGE_TYPES` with string keys. Remaining custom logic (`BooleanFormulaField`, `daeCustomEffect`) extends v14.

**No action needed.**

## 6. `expireRealTime` — Already Removed

Per migration log, removed since v14's `ActiveEffectRegistry` handles real-time expiry natively.

**Done.**

## 7. Effect Start Time Management — Partially Redundant

**File:** `specialDurations.ts` (`preCreateActiveEffect` hook)

Sets `start.time`, `start.round`, `start.turn`, `start.combat`, `start.combatant`. v14 provides `ActiveEffect.getEffectStart()` which computes start data natively.

**Action:** Verify whether v14 auto-populates start data on creation. If so, DAE's hook is unnecessary for standard cases. Keep the `combatActorOverride` flag logic (sets `start.combatant` to target rather than source for turn-based expiry).

## 8. GMAction Socket Functions — Not Redundant

Token manipulation, macro execution, effect creation with custom duration conversion — all DAE-specific with no v14 equivalent.

**No action needed.**

## 9. Legacy Migration Utilities — Mostly Legacy

**File:** `migration.ts`

Contains utilities for cleaning "OwnedItem" origins, removing legacy passive effects, fixing transfer effects. All v10-era migrations.

**Action:** Move to a separate legacy migration file or gate behind a version check. Still useful for worlds upgrading from very old versions but shouldn't be in the hot path.
