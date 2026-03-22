# Foundry v14 Effect Expiry Mechanisms

Reference document for how Foundry v14 handles Active Effect duration tracking, expiry detection, and expiry actions.

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

### The `refresh(event, context)` Lifecycle

The registry's `refresh()` method is the main entry point for expiry processing. It is called by core when combat events or world time changes occur.

```
refresh(event, context)
  │
  ├── For each registered effect:
  │   ├── Call effect.updateDuration(context)
  │   ├── Track effects whose remaining time changed (for actor notification)
  │   └── If duration.remaining <= 0 AND isExpiryEvent(event, context):
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

Custom expiry events can be registered via `CONFIG.ActiveEffect.expiryEvents`.

### `isExpiryEvent(event, context)` Logic

This method on `ActiveEffect` determines whether a given event matches the effect's configured `duration.expiry`:

1. **No expiry set**: Only expires on `updateWorldTime` (pure duration-based expiry).
2. **Event mismatch**: Returns `false` if `event !== effect.duration.expiry`.
3. **Custom (non-core) event**: Returns `true` if event matches (no combatant check needed).
4. **Core combat events**:
   - Resolves the "effect combatant" — the combatant associated with this effect. Uses `start.combatant` if the effect's combat matches the active combat, otherwise finds the combatant by actor.
   - `combatStart`, `combatEnd`, `roundStart`, `roundEnd`: Returns `true` if the effect has a combatant in this combat.
   - `turnStart`: Returns `true` if the current combatant IS the effect's combatant.
   - `turnEnd`: Returns `true` if the previous combatant was the effect's combatant.
   - `updateWorldTime` outside combat: Treats any time advancement as satisfying in-combat expiry events (except `combatStart`).

### How `start.combatant` Determines Turn-Based Expiry

For `turnStart`/`turnEnd` expiry events, the combatant stored in `start.combatant` is the one whose turn triggers expiry. By default, core's `_preCreate` sets `start.combatant` to `combat.combatant?.id` (the combatant whose turn it is when the effect is created — typically the source/caster).

DAE's `combatActorOverride` flag modifies this: when set to `"target"`, DAE's `GMAction.ts` changes `start.combatant` to the target's combatant ID when applying the effect. This makes the effect expire on the target's turn instead of the source's.

## Duration Schema

### `duration` Fields

| Field | Type | Description |
|-------|------|-------------|
| `duration.value` | `Number?` | Duration amount (null = indefinite) |
| `duration.units` | `String` | One of: `seconds`, `minutes`, `hours`, `days`, `months`, `years`, `rounds`, `turns` |
| `duration.expiry` | `String?` | Expiry event name (null = time-based only) |
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

## The `active` / `isSuppressed` / `appliedEffects` Chain

This is the filter chain that determines whether an effect's changes are applied to an actor:

```
duration.expired = true
        ↓
isSuppressed = true     (expired effects are suppressed)
        ↓
active = false          (active = !disabled && !isSuppressed)
        ↓
Excluded from appliedEffects  (appliedEffects = allApplicableEffects().filter(e => e.active))
        ↓
Changes NOT applied during applyActiveEffects()
```

Key details:
- `isSuppressed`: Returns `duration.expired` by default. If the effect has a TypeDataModel system, it returns `system.isSuppressed ?? expired` (allowing system-specific suppression logic).
- `active`: `!this.disabled && !this.isSuppressed` — both disabled and expired effects are inactive.
- `appliedEffects`: Filters `allApplicableEffects()` (which yields ALL effects from actor + transfer effects from items) to only those where `active === true`.
- `isExpiryTrackable` also requires `active === true` — once an effect is expired, it is removed from the registry and will not be re-processed.

## `CONFIG.ActiveEffect.expiryAction`

Controls what core does when an effect's duration runs out AND its expiry event fires:

| Value | Behavior |
|-------|----------|
| `"update"` (default) | Sets `duration.expired = true` on the effect. Effect remains on the actor but is suppressed — its changes no longer apply. |
| `"delete"` | Deletes the effect document entirely. |
| `null` | Core does nothing. Modules (DAE, midi-qol) are expected to handle expiry manually. |

DAE registers a world setting (`expiryAction`) that configures this value. Applied in `fetchParams()`.

### Implications of Each Setting

**`"update"` (mark expired)**:
- Effects remain on the actor as suppressed documents
- They appear in `actor.effects` collection but NOT in `appliedEffects`
- `allApplicableEffects()` still yields them
- The effect sheet shows them (possibly with visual indication of expired state)
- Can be "revived" by clearing `duration.expired` and resetting start data
- Effects accumulate on actors over time unless manually cleaned up

**`"delete"`**:
- Effects are permanently removed from the actor
- No accumulation
- Cannot be recovered once deleted
- Simpler mental model for users

**`null` (manual handling)**:
- Core performs no automatic expiry
- DAE/midi-qol's `expireEffect()` handles it: deletes non-transfer effects, disables transfer effects
- Full control over expiry behavior per effect

## How DAE's expireEffect() Works

Located in `specialDurations.ts`:

```
expireEffect(effect)
  ├── If transfer effect:
  │   ├── If applied enchantment → delete
  │   └── Otherwise → update (disable + clear start + set expired=false)
  │       via getExpireTransferEffectUpdate()
  └── If non-transfer effect:
      ├── If not dnd5e → delete
      └── If dnd5e:
          ├── Check if origin is a concentration effect
          │   └── Only delete if concentration still has remaining duration
          └── Otherwise → delete
```

The `expireEffects()` function (in `dae.ts`) is a batch version:
- Groups effects into: actor effects to delete, transfer effects to disable, item effects (enchantments) to delete
- Processes each group in batch

## Key Differences: `getApplicableEffects()` vs `appliedEffects`

| Function | Source | Returns |
|----------|--------|---------|
| `actor.appliedEffects` | Core v14 | Only `active === true` effects (excludes disabled + expired) |
| `actor.allApplicableEffects()` | Core v14 generator | ALL effects including disabled, suppressed, and expired |
| DAE's `getApplicableEffects()` | `dae.ts` | Uses `allApplicableEffects()` — returns ALL effects including expired |
| midi-qol's `getAppliedEffects()` | `utils.ts` | Uses `actor.appliedEffects` — only active effects |

This distinction matters for expiry scanning:
- **DAE** scans ALL effects (including already-expired ones) when looking for effects to expire
- **midi-qol** scans only active effects when looking for special duration triggers
