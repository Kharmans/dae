# Foundry v14 Effect Expiry Mechanisms

Reference document for how Foundry v14 handles Active Effect duration tracking, expiry detection, and expiry actions — and how DAE patches core behaviour.

## Core Architecture

### ActiveEffectRegistry (Singleton)

`ActiveEffect.registry` is an `IterableWeakSet<ActiveEffect>` that tracks all effects eligible for duration/expiry management.

**Registration criteria** (`isExpiryTrackable`):
- `persisted` (saved to DB)
- Not in a compendium
- `isEmbedded` (has a parent document)
- `active` (not disabled, not suppressed)
- Has `start` data
- `isTemporary` (has an expiry event OR a finite duration value)
- Not already `isExpired` (`duration.expired === false`)

Effects are registered via `registry.add(effect)` — called during `_initialize()` for all actors/tokens, and whenever effects are created or updated. If an effect no longer meets `isExpiryTrackable`, it is removed from the registry.

**Registry cleanup limitation**: `Actor._onDeleteDescendantDocuments` does NOT remove deleted effects from the registry. Stale entries persist as `WeakRef`s until garbage collected. This can cause batch deletion failures — see "Batch Deletion Pitfall" below.

### The `refresh(event, context)` Lifecycle

The registry's `refresh()` method is the main entry point for expiry processing. It is called by core when combat events or world time changes occur.

```
refresh(event, context)
  │
  ├── For each registered effect:
  │   ├── Call effect.updateDuration(context)
  │   ├── Track effects whose remaining time changed (for actor notification)
  │   └── If durationReached AND isExpiryEvent(event, context):
  │       ├── Remove from registry
  │       └── Add to expired map (grouped by parent)
  │
  ├── Notify actors of updated durations
  │   └── actor.onUpdateEffectDurations(effects, event, context)
  │
  └── If activeGM, perform configured expiry action:
      ├── "update" → set duration.expired = true on each expired effect
      ├── "delete" → delete each expired effect
      └── null     → do nothing (modules handle expiry)
```

**`durationReached`** is true when `remaining <= 0` OR `remaining === Infinity`. The `Infinity` case allows effects with no finite duration to still expire based on events alone.

### Batch Deletion Pitfall

`#deleteExpiredEffects` groups all expired effects by parent and calls `foundry.documents.modifyBatch`. If any effect ID in the batch no longer exists in the embedded collection (e.g. deleted by prior code or cleanup), the entire batch fails. This means legitimate effects in the same batch also fail to be deleted, and since they've already been removed from the registry during the refresh loop, subsequent refreshes never retry them.

### Expiry Events

Six core expiry events defined in `CONST.ACTIVE_EFFECT_EXPIRY_EVENTS`:

| Event | Triggers When |
|-------|---------------|
| `combatStart` | A combat encounter begins |
| `combatEnd` | A combat encounter ends |
| `roundStart` | A new combat round starts |
| `roundEnd` | A combat round ends |
| `turnStart` | The current combatant's turn begins |
| `turnEnd` | The previous combatant's turn ends |

Custom expiry events can be registered via `CONFIG.ActiveEffect.expiryEvents`. These appear in the effect editor dropdown but core never fires them as events — they must be handled by the registering module (see DAE patches below).

### `isExpiryEvent(event, context)` Logic (Core)

This method on `ActiveEffect` determines whether a given event matches the effect's configured `duration.expiry`:

1. **`updateWorldTime` event**:
   - No expiry set → `true` (pure duration-based expiry)
   - Expiry is a core combat event (not `combatStart`) AND actor NOT in combat → `true` (time advance satisfies combat events outside combat)
   - Otherwise → `false`
2. **Event mismatch**: Returns `false` if `event !== effect.duration.expiry`.
3. **Custom (non-core) event**: Returns `true` if event matches (no combatant check needed).
4. **Core combat events**: Resolves the "effect combatant" from `start.combatant` (or falls back to finding the combatant by actor):
   - `combatStart`, `combatEnd`, `roundStart`, `roundEnd`: `true` if the effect has a combatant in this combat.
   - `turnStart`: `true` if the **current** combatant IS the effect's combatant.
   - `turnEnd`: `true` if the **previous** combatant was the effect's combatant.

### Trigger Points

```
game.time.advance()        -> registry.refresh("updateWorldTime")
Combat.startCombat()       -> registry.refresh("combatStart", {combat})
Combat.#onEndTurn()        -> registry.refresh("turnEnd", {combat, ...context})
Combat.#onEndRound()       -> registry.refresh("roundEnd", {combat, ...context})
Combat.#onStartRound()     -> registry.refresh("roundStart", {combat, ...context})
Combat.#onStartTurn()      -> registry.refresh("turnStart", {combat, ...context})
Combat.endCombat()         -> registry.refresh("combatEnd", {combat})
```

Note: `registry.refresh()` is async but fire-and-forget from `game.time.advance` — it is NOT awaited.

World time advances on **every turn change** (not just round boundaries), but the time delta for within-round turns is `CONFIG.time.turnTime` (typically 0 in dnd5e). So `updateWorldTime` effectively only fires with a nonzero delta on round changes.

## Effect Start Data

### `getEffectStart(combat)` (Core)

Called by core's `_preCreate` to set initial start data on Actor-owned effects:

```js
static getEffectStart(combat=game.combat) {
  const combatant = combat?.combatant;  // whoever's turn it is NOW
  return {
    time: game.time.worldTime,
    combat: combat?.id ?? null,
    combatant: combatant?.id ?? null,
    initiative: combatant?.initiative ?? null,
    round: combat?.round ?? null,
    turn: combat?.turn ?? null
  };
}
```

**Key point**: `start.combatant` is the **currently active combatant** — not the source (caster), not the target (actor the effect is on). In the common case where Actor A casts on their own turn, all three coincide. But for reactions, readied actions, or manual effect creation during another actor's turn, they diverge.

**v14 `_preCreate` return value**: Returns `void` (undefined) on success, `false` to cancel. This differs from v13 which returned `true` on success. All DAE wrappers check `result !== false` rather than `if (result)`.

**`start` SchemaField**: The `start` field has `nullable: true` in v14 — it defaults to `null` until `_preCreate` populates it. Code that accesses `start` before `_preCreate` must guard against null.

**dnd5e does not modify this behaviour.** `ActiveEffect5e` has no `_preCreate` override and does not touch `start.combatant`.

### How `start.combatant` Controls Expiry

**Duration calculation** (`_prepareCombatBasedDuration`): The combatant from `start.combatant` provides the reference for `startRound` and `startTurn`. Duration remaining is calculated relative to when this combatant's round/turn started.

**Expiry event matching** (`isExpiryEvent`): For `turnStart`, the effect expires when `combat.combatant === effectCombatant` (the combatant resolved from `start.combatant`). For `turnEnd`, when the previous combatant matches. So `start.combatant` determines **whose turn** triggers the expiry event.

### Core Turn-Based Duration Formula

For `units: "turns"`, core's `_prepareCombatBasedDuration` calculates:

```js
const elapsedPriorRounds = (combat.turns.length - startTurn) * (currentRound - startRound);
const elapsedThisRound = Math.max(0, currentTurn - startTurn);
const elapsedInCombat = elapsedPriorRounds + elapsedThisRound;
const remaining = duration.value - elapsedInCombat;
```

**This formula counts turns relative to `startTurn`** — only turns at or after the start position within each round. Turns before `startTurn` in subsequent rounds contribute 0 to `elapsedThisRound`. This is correct for `turnStart`/`turnEnd` expiry (tracking a specific combatant's turns) but wrong for "time elapsed" where all turns should count equally. See DAE patch 6.7.

### Example: 3-Actor Combat

Combat order: Actor A (turn 0), Actor B (turn 1), Actor C (turn 2).

**Scenario**: It's Actor C's turn. Actor A applies a 1-round `turnStart` effect to Actor B.

- Core sets `start.combatant` = Actor C (whoever's turn it is)
- `isExpiryEvent("turnStart")` checks if `combat.combatant === Actor C's combatant`
- Effect expires at Actor C's next turnStart — NOT Actor A's (source) or Actor B's (target)

This is usually wrong for gameplay purposes, which is why DAE provides source/target expiry events (see section 6.4).

## Duration Schema

### `duration` Fields

| Field | Type | Description |
|-------|------|-------------|
| `duration.value` | `Number?` | Duration amount (null = indefinite) |
| `duration.units` | `String` | One of: `seconds`, `minutes`, `hours`, `days`, `months`, `years`, `rounds`, `turns` |
| `duration.expiry` | `String?` | Expiry event name (null = time-based only). Defaults to `"turnStart"` when value is set to a number. |
| `duration.expired` | `Boolean` | Whether the effect has been marked as expired |

### `start` Fields

| Field | Type | Description |
|-------|------|-------------|
| `start.time` | `Number` | World time when effect started |
| `start.combat` | `String?` | Combat document ID |
| `start.combatant` | `String?` | Combatant ID (determines whose turn triggers expiry) |
| `start.initiative` | `Number?` | Initiative value at start |
| `start.round` | `Number?` | Combat round at start |
| `start.turn` | `Number?` | Combat turn index at start |

### Derived Duration Properties

Computed by `updateDuration()` / `_prepareDuration()`:

| Property | Description |
|----------|-------------|
| `remaining` | Time/rounds/turns remaining (negative if overdue, Infinity if indefinite) |
| `seconds` | Total duration in seconds |
| `label` | Localized display string ("3 Rounds", "2 minutes ago", etc.) |
| `_worldTime` | World time at last computation |

### Core's `_prepareDuration` Dispatch

```js
_prepareDuration(duration, context) {
  // Indefinite: not temporary
  if (!this.isTemporary) duration.expired = false;
  // Infinite: no start data or explicit Infinity value
  if (!this.start || duration.value === Infinity)
    return { remaining: Infinity, seconds: Infinity, label: "None" };
  // Dispatch by unit type
  return TIME_UNITS.includes(units)
    ? this._prepareTimeBasedDuration(duration, context)
    : this._prepareCombatBasedDuration(duration, context);
}
```

**Core limitation**: Missing `duration.value` (null/undefined) is NOT caught by the `value === Infinity` check. It falls through to time/combat preparation, which treats null as 0 — resulting in immediate expiry. See DAE patch 6.2.

## The `active` / `isSuppressed` / `appliedEffects` Chain

```
duration.expired = true
        ↓
isSuppressed = true     (expired effects are suppressed)
        ↓
active = false          (active = !disabled && !isSuppressed)
        ↓
Excluded from appliedEffects  (only active effects apply)
        ↓
Changes NOT applied during applyActiveEffects()
```

## `CONFIG.ActiveEffect.expiryAction`

Controls what core does when an effect expires:

| Value | Behavior |
|-------|----------|
| `"update"` (default) | Sets `duration.expired = true`. Effect remains but is suppressed. |
| `"delete"` | Deletes the effect document entirely. |
| `null` | Core does nothing. Modules handle expiry. |

DAE sets this via the `coreExpiryAction` world setting, applied during `ready`.

---

## DAE Patches

All `ActiveEffect.prototype` patches are registered via **lib-wrapper** in `src/module/patching.ts` (called from the init hook). Previous versions used direct monkey-patching.

### 6.1 Custom Expiry Event: "Time Elapsed" (`updateWorldTime`)

**Problem**: Core special-cases `"updateWorldTime"` as an event parameter in `isExpiryEvent`, but doesn't support it as an expiry value. An effect with `expiry: "updateWorldTime"` would never match any event — the `event === "updateWorldTime"` branch checks `!expiry` or combat fallback, but `event !== expiry` on line 876 returns false for all other events.

**Fix**: DAE registers `"updateWorldTime"` as a custom expiry event via `CONFIG.ActiveEffect.expiryEvents` (always, regardless of system) and patches `isExpiryEvent` (MIXED wrapper): if `this.duration.expiry === "updateWorldTime"`, always return `true`. This lets effects expire purely based on duration elapsed, regardless of which event triggered the refresh.

### 6.2 Blank Duration Values

**Problem**: Core's `_prepareDuration` treats a missing `duration.value` (null/undefined) as 0, routing it to `_prepareTimeBasedDuration` which computes `seconds = 0` and `remaining < 0`. This causes event-only effects (e.g. `expiry: "turnStart"` with no duration value, meaning "until the start of your next turn") to expire immediately on the next time advance.

**Fix**: DAE patches `_prepareDuration` (MIXED wrapper): when `duration.value` is not a finite number and not `Infinity`, but an `expiry` event is set, returns `remaining: Infinity` and `seconds: Infinity`. The effect stays in the registry (because `isTemporary` is true — `expiry` is set) and `durationReached` is satisfied (because `remaining === Infinity`), but actual expiry depends on the event check.

### 6.3 Event-Only Effects and Time Advance

**Problem**: Even with the `_prepareDuration` fix (6.2) setting `remaining: Infinity`, effects with combat expiry events still expire on time advance outside combat. This is because:
1. `durationReached` is true (`remaining === Infinity`)
2. Core's `isExpiryEvent("updateWorldTime")` returns true for combat events when not in combat

This means an event-only effect with `expiry: "turnStart"` and no duration value would be deleted on any `game.time.advance()` call outside combat — defeating the purpose.

**Fix**: DAE extends the `isExpiryEvent` patch: when `event === "updateWorldTime"` and the effect has no finite `duration.value` (`!Number.isFinite(this._source.duration.value)`), return `false`. Event-only effects will never expire from time advance. They only expire when the actual combat event fires.

This does NOT affect effects with a finite duration value — those continue to expire on time advance outside combat as core intends.

### 6.4 Source/Target Expiry Events

**Problem**: Core sets `start.combatant` to whoever's turn it is at effect creation time. This is usually the caster, but:
- "Until start of your next turn" effects on the **target** should expire on the target's turnStart, not the caster's
- Reactions or effects applied outside the source's turn get the wrong combatant entirely
- "Until the start of your next turn" from the **source's** perspective needs the source's combatant

**Fix**: DAE registers four custom expiry event values and converts them to core values at creation time:

| DAE Expiry Value | Core Equivalent | `start.combatant` Set To |
|-----------------|-----------------|--------------------------|
| `sourceStart` | `turnStart` | Source actor's combatant (resolved from `origin` UUID) |
| `sourceEnd` | `turnEnd` | Source actor's combatant |
| `targetStart` | `turnStart` | Target actor's combatant (the actor the effect is on) |
| `targetEnd` | `turnEnd` | Target actor's combatant |

**Registration**: The four values are registered in `CONFIG.ActiveEffect.expiryEvents` during init, so they appear in the effect editor dropdown. Since core never fires custom events, they must be converted to core values.

**Implementation** (`_preCreate` wrapper in `dae.ts`): Runs in two phases:
1. **Before `wrapped()`**: Converts the DAE expiry value to the core equivalent (`sourceStart` → `turnStart`, etc.) via `updateSource`. This ensures core's `_preCreate` sees a valid expiry value.
2. **After `wrapped()`**: Overrides `start.combatant` (and related start fields) based on the original expiry value. For `source*`, resolves the origin actor via `actorFromUuid(this.origin)`, falling back to the parent actor. For `target*`, uses the parent actor.

**Version guard**: All source/target handling is guarded by `daeManagesTurnExpiry`, which is `true` when `game.system.id !== "dnd5e"` OR dnd5e version is < 6.0.0. dnd5e 6.0+ handles source/target turn expiry natively, so DAE gets out of the way. When guarded off, the four custom expiry events are not registered and no conversion occurs.

**`updateSource` with nested objects**: v14's `updateSource` requires nested object form for SchemaFields — dotted keys like `"duration.expiry"` do NOT work. Use `{ duration: { expiry: value } }` instead. The nested form performs a merge on SchemaFields.

### 6.5 Per-Effect Expiry Mode (`flags.dae.expiryMode`)

Core's `CONFIG.ActiveEffect.expiryAction` is global. DAE wraps `registry.refresh()` and intercepts `preDeleteActiveEffect`/`preUpdateActiveEffect` hooks during refresh to redirect effects whose `flags.dae.expiryMode` differs from the global setting.

| Per-Effect Mode | Global Action | Redirect |
|----------------|---------------|----------|
| `"suppress"` | `"delete"` | Cancel delete → set `duration.expired = true` instead |
| `"delete"` | `"update"` | Cancel update → delete instead |
| (unset) | any | No redirect — use global action |

The wrapper also injects `expiry-reason` into the options of all expiry operations (both core and redirected) for downstream consumers.

### 6.6 Special Duration Migration

Old DAE effects used `flags.dae.specialDuration` arrays. These are migrated to v14's native `duration.expiry` + source/target expiry values. The migration map depends on `daeManagesTurnExpiry`:

**When `daeManagesTurnExpiry` is true** (dnd5e < 6.0.0):

| Old Special Duration | `duration.expiry` |
|---------------------|-------------------|
| `"turnStart"` | `"targetStart"` |
| `"turnEnd"` | `"targetEnd"` |
| `"turnStartSource"` | `"sourceStart"` |
| `"turnEndSource"` | `"sourceEnd"` |
| `"combatEnd"` | `"combatEnd"` |

**When `daeManagesTurnExpiry` is false** (dnd5e 6.0+):

| Old Special Duration | `duration.expiry` |
|---------------------|-------------------|
| `"turnStart"` | `"turnStart"` |
| `"turnEnd"` | `"turnEnd"` |
| `"turnStartSource"` | `"turnStart"` |
| `"turnEndSource"` | `"turnEnd"` |
| `"combatEnd"` | `"combatEnd"` |

Migration runs in `_preCreate` (specialDurations.ts) and the effect sheet editor (DAEActiveEffectConfig.ts). Non-deprecated special durations (e.g. `"isAttacked"`, `"isDamaged"`) are preserved.

### 6.7 "Time Elapsed" + Turn-Based Duration Fix

**Problem**: Core's `_prepareCombatBasedDuration` formula for `units: "turns"` counts turns **relative to `startTurn`** — only turns at or after the start position within each round are counted. With `startTurn = 5` and 8 combatants, only 3 turns per round count (positions 5, 6, 7). Turns 0–4 of subsequent rounds contribute nothing to elapsed.

This is correct for `turnStart`/`turnEnd` expiry (where you want to track how many times a specific combatant's turn has passed), but wrong for `updateWorldTime` ("time elapsed") expiry where **all** turns should count equally.

**Example**: Effect created at round 25, turn 5 with `value: 5, units: "turns", expiry: "updateWorldTime"` and 8 combatants:
- Core formula: expires at round 26, turn 7 (10 actual turns later — only 3 counted per round)
- Correct: should expire at round 26, turn 2 (5 actual turns later)

**Fix**: DAE's `_prepareDuration` wrapper (in `patching.ts`) detects effects with `expiry: "updateWorldTime"`, `units: "turns"`, and a finite `duration.value`. For these, it overrides the `remaining` calculation with total turns elapsed:

```
totalElapsed = (currentRound - startRound) * combat.turns.length + (currentTurn - startTurn)
remaining = duration.value - totalElapsed
```

This correctly decrements `remaining` by 1 for every turn regardless of which combatant is active.

---

## Summary: Core Limitations and DAE Fixes

| Core Limitation | DAE Fix |
|----------------|---------|
| `"updateWorldTime"` not usable as expiry value | Register as custom event + patch `isExpiryEvent` (6.1) |
| Missing `duration.value` treated as 0 (immediate expiry) | Patch `_prepareDuration` to return `remaining: Infinity` (6.2) |
| Time advance expires event-only effects outside combat | Patch `isExpiryEvent` to block `updateWorldTime` for no-duration effects (6.3) |
| `start.combatant` always set to current combatant | Source/target expiry events converted in `_preCreate` (6.4) |
| `expiryAction` is global | Per-effect `expiryMode` flag via refresh wrapper (6.5) |
| `specialDuration` flags deprecated in v14 | Automatic migration to `duration.expiry` + source/target values (6.6) |
| Turn-based "time elapsed" counts combatant-relative turns | Override remaining with total-turns-elapsed formula (6.7) |
| Deleted effects linger in registry as WeakRefs | Test helper `cleanRegistry()` purges stale entries |
