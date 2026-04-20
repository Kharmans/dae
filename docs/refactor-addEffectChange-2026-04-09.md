# Refactor: addEffectChange / removeEffectChange Serialization

**Bug Audit Item:** #2 — `addEffectChange` fire-and-forget async calls  
**Date:** 2026-04-09  
**Status:** IN PROGRESS

## Problem

`addEffectChange` and `removeEffectChange` are sync functions that call async helpers
(`addConvenientEffectsChange`, `addConditionChange`, `addTokenMagicChange`, `addCreateItemChange`)
without `await`. Side effects complete at unpredictable times. Additionally, the dispatch logic
is duplicated — the `changeLoop()`/`changesLoop()` functions in `createActiveEffectHook`,
`updateActiveEffectHook`, and `deleteActiveEffectHook` contain their own inline copies of the
same switch/if logic instead of calling `addEffectChange`/`removeEffectChange`.

## Design

### Two-Layer Architecture

**Layer 1 — Inner helpers (no queuing):**  
Strip `actionQueue.add()` from inside all helper functions. They become plain async functions
that directly await their work (socket calls, CE API calls, etc.).

Functions to modify:
- `addCreateItemChange` (dae.ts:426) — remove `actionQueue.add(socketlibSocket.executeAsGM...)`, use direct `await socketlibSocket.executeAsGM(...)`
- `removeCreateItemChange` (dae.ts:434) — same
- `addTokenMagicChange` (dae.ts:445) — same
- `removeTokenMagicChange` (dae.ts:457) — same
- `addConvenientEffectsChange` (dae.ts:485) — remove `actionQueue.add(myAddCEEffectWith...)`, call `myAddCEEffectWith` directly
- `removeConvenientEffectsChange` (dae.ts:473) — remove `actionQueue.add(myRemoveCEEffect...)`, call `myRemoveCEEffect` directly
- `addConditionChange` (dae.ts:495) — no actionQueue usage, stays as-is
- `removeConditionChange` (dae.ts:517) — no actionQueue usage (line 527 already commented out), stays as-is
- `removeStatusEffectChange` (dae.ts:547) — remove `actionQueue.add(actor.deleteEmbeddedDocuments...)`, use direct `await`

**Layer 2 — Unified dispatch via `processEffectChanges()`:**  
A single async function that dispatches all change types and calls `daeMacro` directly.
Replaces both `addEffectChange`/`removeEffectChange` AND the duplicated inline dispatch in
the three hook changeLoop functions. Always called from within `actionQueue`.

```typescript
async function processEffectChanges(
  action: "on" | "off",
  actor: Actor.Implementation,
  tokens: Token[],
  effect: ActiveEffect.Implementation,
  item: Item.Implementation,
  changes: ActiveEffect.ChangeData[],
  context: any
): Promise<void>
```

### Caller Changes

**Category A — async callers (can await):**
- `createActiveEffectHook` changeLoop (dae.ts:617-654) — replace inline dispatch with `await actionQueue.add(processEffectChanges, ...)`
- `updateActiveEffectHook` changeLoop (dae.ts:920-1037) — replace inline dispatch with `await actionQueue.add(processEffectChanges, ...)` for add/remove
- `deleteActiveEffectHook` changesLoop (dae.ts:1095-1149) — replace inline dispatch with `await actionQueue.add(processEffectChanges, ...)`
- `createItemHook` (dae.ts:1841-1865) — replace loop with `await actionQueue.add(processEffectChanges, ...)`

**Category B — sync callers (fire-and-forget):**
- `updateActiveEffectHook` becameEnabled/becameDisabled (dae.ts:903-913) — replace with `actionQueue.add(processEffectChanges, ...)` (no await)
- `DAEdnd5e.ts:preUpdateItemHook` (lines 1484-1511) — replace with `actionQueue.add(processEffectChanges, ...)` (no await)

### Deadlock Analysis

**No deadlock** because:
1. Inner helpers no longer call `actionQueue.add()` — no nesting
2. `daeMacro` never called `actionQueue` internally — it was always called VIA `actionQueue.add(daeMacro, ...)`
3. Hooks are fire-and-forget: if a user macro (inside `daeMacro`) creates a new effect, the resulting `createActiveEffectHook` calls `actionQueue.add(processEffectChanges, ...)` but does NOT await it from the hook — it just queues and returns `true`. The queued work runs after the current task completes.
4. The only deadlock scenario would be if a hook awaited `actionQueue.add()` from a context that already holds the semaphore — but hooks never do this (they fire-and-forget).

### Additional Considerations

- The `updateActiveEffectHook` changeLoop has extra logic for diffing old/new changes (added/removed/existing) and handling dependents. This logic stays in the hook; only the per-change dispatch moves into `processEffectChanges`.
- The `deleteActiveEffectHook` changesLoop has `flags.dae.deleteUuid`, `flags.dae.suspendActiveEffect`, `flags.dae.deleteOrigin`, and Sequencer cleanup. These need to be handled either in `processEffectChanges` or left in the hook after the `processEffectChanges` call.
- `removeTokenMagicChange` at line 976 is called without `await` — fix during refactor.

## Implementation Steps

### Step 1: Write tests (batch 21)
Create `21-effect-change-serialization-tests.ts` with:
- 21.1: Basic macro.createItem — verify item created after effect creation
- 21.2: macro.StatusEffect — verify status applied after effect creation
- 21.3: Effect with multiple change types (createItem + statusEffect) — verify all processed
- 21.4: Rapid sequential effect create/delete — verify no interleaving
- 21.5: Effect disable/enable cycle (Category B path) — verify side effects complete
- 21.6: Reentrant test — macro.execute that creates another effect with macro changes (deadlock canary)
- 21.7: Reentrant test — macro.execute that deletes an effect (deadlock canary)
- 21.8: Multiple effects created in quick succession — verify ordering

### Step 2: Strip actionQueue from inner helpers
Modify the 6 helper functions listed above. No caller changes yet — existing fire-and-forget
behavior still works (just without internal serialization, which is temporarily worse but
will be fixed in step 3).

### Step 3: Create processEffectChanges()
Unified dispatch function. Initially call it from `addEffectChange`/`removeEffectChange`
to minimize caller changes.

### Step 4: Update callers
- Category A: await the result
- Category B: fire-and-forget but through actionQueue
- Remove duplicated inline dispatch from changeLoop/changesLoop

### Step 5: Clean up
- Remove old `addEffectChange`/`removeEffectChange` if fully replaced
- Update exports/imports
- Remove the TODO comment at dae.ts:962

### Step 6: Run tests, verify no deadlock
