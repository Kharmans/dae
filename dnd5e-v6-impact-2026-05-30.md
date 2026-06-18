# dnd5e v6 Impact Analysis — midi-qol / dae

**Created:** 2026-05-30
**Scope:** Foundry v14 line only (midi-qol-14x / dae-14x). dnd5e v6 PRs are explicitly "reliant on V14".
**Status of v6 at time of writing:** unpublished and in-flight.
- Milestone #122 "D&D5E 6.0.0": **69 open / 0 closed**.
- `6.0.x` branch: 3 open PRs, 0 merged. `6.0-deprecations` branch exists.
- No v6 CHANGELOG yet. There is **no completed/closed v6 work** to review — everything below is *planned* behaviour drawn from open issues/PRs and may change before release.

**Purpose:** record the impact assessment and reconciliation plan per area. **No code changes are made** against pending dnd5e behaviour; this is the design record to act on once v6 lands. Items are worked in priority order; sections are appended as each is analysed.

---

## v6 milestone items relevant to midi/dae (reference)

Grouped by area (issue/PR numbers from milestone #122):

- **Active Effects overhaul:** #6837/#5067 (auto-expire by duration), #6800/#6641 (standalone AE linked to activity — *breaking*), #6315 (Rule AE / conditional), #6671/#6672/#6821 (FiltersField), #6631/#6687 (non-persisted base-data fields), #5941 (modify `base` AE type + migration), #6626 (AE origins on system data), #4437/#6676 (AE props from item / token-size sync), #6618/#6619 (consumed / rest expiry), #6439 (additional phases), #5559/#6798/#6154/#6822/#6783 (auras, apply-effect behaviors, emanations), #6679 (stock-effects compendium).
- **Dice/damage:** #6538 (critical damage), #6261/#6834 (`modifiers` on DamageData), #6121/#6646/#6658 (multiple AC formulas, `ac.min` baseline).
- **Canvas/templates:** #6763/#6778 (TemplatePlacement replaces AbilityTemplate), #6438/#6784 (ring-wall AoE), #6436/#6783 (emanations attached to tokens), #6722/#6761 (behaviors on template regions).
- **Vision:** #4698 (token vision mode from character-sheet senses).
- **Compatibility removal:** #6888 (remove deprecated shims/APIs).
- **Misc:** #6183 (spellcastingAbility highest), calendar/rests (#6233/#5845/#5210/#5209/#2187/#2291/#5647/#6591).

---

## Cross-cutting principle: converge to a single implementation post-release

**Commitment:** once dnd5e v6 is the minimum supported version for midi-qol-14x / dae-14x, **prefer dnd5e's native implementation over midi/DAE's parallel one** for any feature where the two overlap. The parallel midi/DAE machinery exists because the system lacked these features; once v6 ships them, the parallel code is technical debt.

**Items this applies to** (analysed in detail in their sections):

| midi/DAE parallel feature | v6 native equivalent | preferred direction |
|---|---|---|
| midi's `flags.midi-qol.{advantage,disadvantage,bonuses,optional,grants,fail}.*` | Rule AE change modes (Item 5, #6315) | **translate** at roll time, retire flags long-term |
| midi's bespoke filter syntax on flag paths | `FiltersField` + `Filter` JSON tree (Item 8, #6671/#6672/#6821) | **translate** to native filters as `#6671` consumers stabilise |
| midi's `attachToken` activity setting (shipped this session) | Emanation auto-attach at placement (Item 9, #6783) | **defer to native for emanations** on v6+; keep midi's path for non-emanation templates only |
| midi's `MidiRegionActivityBehaviorType` apply/remove rules | dnd5e `applyActiveEffect` region behavior (Item 9, #6822) | **keep midi's** (superset: turn triggers, oncePerTurn, multi-rule); reconsider when #6822 adds FiltersField support |
| midi's region-light activity behavior | Activity Behaviors framework (Item 10, #6761) | **register midi behaviors under the framework** if config shape fits; coexist otherwise |
| DAE's `daeSpecialDurations["shortRest"]/["longRest"]` + midi's `restManager` | Native rest expiry events (Item 7, #6619 — blocked) | **migrate to native** when #6619 lands; keep midi's as legacy back-compat reader only |
| midi/DAE hand-rolled `token.*` sense effects | Sense-driven token vision sync (Item 11, #6864) | **prefer sense-only authoring**; legacy `token.*` AEs continue to work for ad-hoc cases |
| DAE's `daeSpecialDurations` turn-start/end / combat-end | Foundry v14 core expiry registry + dnd5e's pseudo-expiries (Item 1, #6837) | **already migrating** — `daeManagesTurnExpiry` version-gated for dnd5e ≥ 6.0.0 |

**Why this matters now:** every item I analyse has a "coexist / translate / migrate" decision. Without this commitment, the path of least resistance is **coexist forever**, which compounds maintenance burden and confuses users (two ways to do everything). The commitment makes the default direction explicit so each reconciliation defaults to convergence, with coexistence as the exception that needs justification.

**Deprecation discipline:** when migrating off a midi/DAE parallel system, follow dnd5e's pattern from #6800 (deprecated getter with compat-window-until-x.x). Don't break user content abruptly. Sample-item authoring guidance updates first; back-compat reading layer stays for ≥1 minor release after the native equivalent is the default.

**Exception criteria:** keep midi/DAE's parallel only when it is a *strict superset* of the native (e.g. `MidiRegionActivityBehaviorType`'s turn triggers + oncePerTurn) AND the missing native features are not on dnd5e's roadmap. Otherwise migrate.

---

## Finding 0 (pre–item 1): async `Activity#getApplicableEffects` (#6800) vs DAE actor initialisation

### How #6800 works (the "why" and the call flow)

**Why:** v6 lets an activity apply an effect that lives somewhere *other than the activity's own item* — a compendium, or another document — referenced by **UUID** instead of only a local embedded `_id`. Resolving a UUID can require an async compendium fetch, so effect resolution becomes async.

**Schema (root change), `AppliedEffectField`:** the per-effect "profile" stored on an activity gains a `uuid` (`DocumentUUIDField`) next to the existing `_id`. Data-prep then defines on each resolved profile:

| member | behaviour |
|---|---|
| `effect` (getter) | **deprecated** (compat warning, removed DnD5e 6.2) → delegates to `getEffect()` |
| `getEffect()` | `obj.uuid ? fromUuid(obj.uuid) : item?.effects.get(obj._id)` — **may be a Promise** (async for remote uuid, sync for local id) |
| `relativeUUID` | `obj.uuid ?? ".ActiveEffect.${obj._id}"` — relative-uuid string for referencing it |

**Getters change meaning:**
- `applicableEffects` — **was** resolved `ActiveEffect5e[]` (level-filtered documents); **now** returns `EffectApplicationData[]` — the *profiles* (level-filtered, unresolved). Anyone doing `applicableEffects.map(e => e.id)` or treating entries as documents breaks.
- `getApplicableEffects()` (**new, async**) — `Promise.all(applicableEffects.map(e => e.getEffect())).then(a => a.filter(Boolean))`; the replacement for "give me the actual documents".

**dnd5e's own call flow (consumers updated in #6800):**
1. Usage → chat card (`mixin.mjs`): records `system.effects` as `e.relativeUUID` (was `e.id`); the chat field becomes `ArrayField(StringField)` (was `ArrayField(DocumentIdField)`).
2. Chat render (`usage-message-data.mjs`): resolves those strings async — `await Promise.all(this.effects.map(uuid => fromUuid(uuid, { relative: this.item })))`.
3. Apply-Effect button (`effect-application.mjs`): reads `data-uuid` (was `data-id`), `await fromUuid(...)`; for compendium-sourced effects sets origin to the **item** and stamps `_stats.compendiumSource`/`duplicateSource`.
4. Summoning (`summon.mjs`): `(await this.getApplicableEffects()).map(e => e.toObject())` (was `this.applicableEffects.map(...)`).
5. Activity sheet (`activity-sheet.mjs`): builds context with `await data.getEffect()`; form splits into `appliedLocalEffects` (by id) vs `appliedRemoteEffects` (by uuid → stored as `{ _id: "<rand>REMOTE", uuid }`).

### midi touch-points (midi's breaking change to absorb — tracked separately)
- `AttackActivity.ts:604`, `Workflow.ts:8376` — `effects: this.applicableEffects?.map(e => e.id)`. Profiles have no `.id` (only `_id`/`uuid`/`relativeUUID`) → `e.id` is `undefined`. Switch to **`e.relativeUUID`** to match what dnd5e now writes to `system.effects`.
- `utils.ts:6480` — `activity.applicableEffects?.forEach(effect => …)` treats entries as documents → use `await activity.getApplicableEffects()` (or `.getEffect()` per profile).
- Any midi read of a chat card's `system.effects` expecting ids — now relative-uuid strings.
- `Workflow.ts:2886` — midi's custom resolution path (needs onSave info, can't reuse `applicableEffects` wholesale) must be re-checked against the profile/uuid model.

### DAE impact

**Question:** does the new async `getApplicableEffects()` break DAE's change application during actor data prep?

**Answer: no.** Two unrelated APIs share a name:

| | dnd5e v6 `Activity#getApplicableEffects()` (#6800) | DAE `getApplicableEffects(actor, {...})` (`module/dae.ts:2532`) |
|---|---|---|
| Subject | the **activity's** effect *profiles*, resolved to documents (may fetch from a compendium) | the **actor's** already-embedded effects, filtered |
| Async | yes | no — sync wrapper over `actor.allApplicableEffects()` |
| When | at effect **application/creation** time | during recalcs / duration checks |

- DAE's synchronous change path — `daeApplyActiveEffects` (wraps `Actor.applyActiveEffects`) and `daeApplyChange` (wraps `ActiveEffect.applyChange`) — iterates **`actor.allApplicableEffects()`**, the actor's already-embedded ActiveEffect documents. #6800 does not change `allApplicableEffects()`; it stays a sync generator.
- By the time actor prep runs, effects are concrete embedded documents. The compendium fetch already happened at apply time (async context). Nothing async is resolved during prep.
- DAE never reads `activity.applicableEffects` — midi does, and hands DAE concrete effect data. So #6800 is **midi's** breaking change to absorb (switch `activity.applicableEffects` → `await activity.getApplicableEffects()` in its async application path), **not DAE's**.

**Protecting invariant:** `prepareData` must stay synchronous; dnd5e resolves compendium-linked effects to local embedded copies at apply time, never lazily during prep.

**Action items:**
- DAE: none required for actor-init correctness.
- DAE: **rename or comment** DAE's `getApplicableEffects` to avoid confusion with dnd5e v6's async `Activity#getApplicableEffects` (cosmetic).
- midi (tracked separately): adopt `await activity.getApplicableEffects()`; `applicableEffects` now returns profiles.

---

## Item 1: Reconcile DAE duration management with #6837 (auto-expire AEs by duration)

### #6837 planned behaviour (from PR body; draft, V14-reliant, builds on #5941)
- Effects expired by **Core out of combat** → **deleted immediately**.
- Effects expired by **Core in combat** → **marked expired / inactive**, then **deleted on combat exit**.
- Adds **four "pseudo-expiries"** to the expiry dropdown: start/end of the **source's** and **target's** *next turn*. Selecting one **locks duration to 1 Round**; the effect expires per the option.
- Pseudo-expiry effects still active when an actor leaves combat → deleted.
- Any **rounds-duration effect without a specified expiry** → given core **"Turn Start"** expiry (expires after `n` rounds at the start of the turn of the actor active at application time).
- Non-user-facing: expired enchantments move to the "inactive" section.

### Current DAE-14x duration management (`module/specialDurations.ts` + `src/dae.ts`)
- **Already version-gated for v6.** `daeManagesTurnExpiry` (`src/dae.ts:33,47`) = `true` for dnd5e < 6.0.0, **`false` for dnd5e ≥ 6.0.0** — i.e. DAE already intends to hand source/target turn expiry to dnd5e core in v6.
- `getDeprecatedSpecialDurMap()` (`specialDurations.ts:257`) maps DAE's legacy `turnStart/turnEnd/turnStartSource/turnEndSource` onto **`targetStart/targetEnd/sourceStart/sourceEnd`** when `daeManagesTurnExpiry` is false, else onto core `turnStart/turnEnd`.
- `expireEffect()` (`specialDurations.ts:37`): **transfer effects are disabled, not deleted** (except applied enchantments, which are deleted); non-transfer effects deleted or marked `duration.expired = true` per `resolveEffectExpiryAction` (per-effect → global). **Concentration-aware**: skips expiring effects whose concentration origin still has remaining duration.
- Registry-refresh interception (`src/dae.ts:127-175`): injects `expiry-reason` into core's duration-expiry delete/update options, and redirects effects whose per-effect `expiryMode` differs from the global. So DAE **already cooperates with Foundry v14 core auto-expiry** (`ActiveEffectRegistry.refresh`).
- Event-based special durations DAE owns that core does NOT provide: `combatEnd` (preDeleteCombat), `joinCombat` (preCreateCombatant), `roundStart/roundEnd`, macro-repeat (`processMacroRepeats` on updateCombat), plus the workflow-driven ones (1Hit/1Action/isAttacked/etc. set by midi).
- Settings: `expireRoundEffectsOnCombatEnd`, `coreExpiryAction` (sets `CONFIG.ActiveEffect.expiryAction`), per-effect `flags.dae.expiryMode`, `maxShortDuration` (seconds↔rounds conversion ceiling).

### Overlap / conflict analysis
1. **Duration + time/turn expiry**: #6837 makes dnd5e core expire effects by duration with combat-aware delete-vs-mark. DAE already defers time/turn expiry to Foundry core and only enhances it. Net: **mostly already reconciled** via `daeManagesTurnExpiry`. Risk of **double expiry** only if DAE still runs its own round/turn expiry on v6 — must verify those paths no-op when `daeManagesTurnExpiry === false`.
2. **Source/target pseudo-expiries**: #6837 introduces them in the expiry dropdown with duration locked to 1 Round. DAE's deprecated-duration map already targets `sourceStart/sourceEnd/targetStart/targetEnd`. **Must confirm these strings match dnd5e v6's actual pseudo-expiry identifiers** — the map currently *assumes* them. If dnd5e uses different keys, update `getDeprecatedSpecialDurMap`.
3. **Combat-aware delete vs mark-inactive-then-delete**: #6837's "mark inactive in combat, delete on exit" overlaps DAE's `expireRoundEffectsOnCombatEnd` + combat-end handling. Decide which owns the in-combat→exit deletion to avoid duplicates.
4. **Transfer effects (key divergence)**: DAE **disables** transfer effects on expiry so the source item retains the effect for re-enable. If dnd5e v6 core auto-expiry **deletes** transfer effects, that removes them from the item — unacceptable. **Must verify** core's behaviour; if it deletes, DAE must intercept (it already has the registry-refresh + `preUpdateActiveEffect` interception) to convert delete→disable for transfer effects under #6837.
5. **Concentration-aware expiry**: DAE skips effects whose concentration origin is still active. Verify dnd5e v6 respects concentration similarly; if not, keep DAE's guard.
6. **`expiry-reason` context**: DAE/macros depend on it; DAE injects it via the registry interception. Verify #6837's deletion path still flows through `ActiveEffectRegistry.refresh` so the interception fires (it builds on the same v14 mechanism, so likely yes).

### Reconciliation plan (act on once v6 ships / #6837 merges)
1. **Confirm pseudo-expiry identifier strings** in shipped #6837 and align `getDeprecatedSpecialDurMap` to the real values; keep DAE's legacy `turnStart*`/`turnEnd*` durations migrating onto them.
2. **Ensure DAE's own round/turn expiry no-ops on dnd5e ≥ 6.0.0** (verify every `daeManagesTurnExpiry`-gated path; remove residual double-handling). Event-based durations (combatEnd, joinCombat, macro-repeat, midi workflow durations) stay DAE-owned.
3. **Guarantee transfer-effect disable semantics under core auto-expiry** — verify and, if core deletes, intercept to disable instead.
4. **Preserve concentration-aware skip** unless core covers it.
5. **Reconcile settings**: decide whether `expireRoundEffectsOnCombatEnd` / `maxShortDuration` / `coreExpiryAction` become redundant once core owns duration; keep only what adds value beyond core.
6. **Verify `expiry-reason` injection** still fires under #6837's deletion path.

### Open questions / decisions needed
- Exact pseudo-expiry identifier strings dnd5e v6 uses (need final #6837 code or the expiry dropdown values).
- Does core auto-expiry **delete transfer effects**? (blocks decision in step 3)
- Is core auto-expiry **concentration-aware**?
- Does #6837 route deletions through `ActiveEffectRegistry.refresh` (so DAE's reason-injection still works)?
- Which DAE duration settings to retire vs keep.

---

## Item 2: New `base` AE data model with system-specific data (#5941)

Chosen as item 2 because it is foundational — #6837 (item 1) explicitly *builds on* it, and it is the most DAE-coupled piece of the AE overhaul (DAE walks the AE schema and applies changes per document type).

### #5941 planned behaviour
Replaces core's base AE type with a dnd5e-specific data model and reworks how the system reasons about what an effect applies to.

- **New abstract `ActiveEffectDataModel`** (`data/abstract/active-effect-data-model.mjs`) extending `foundry.data.ActiveEffectTypeDataModel`. Adds getters `actor`, `item` (resolved from `parent.parent`), `isConcealed`, and **`applicableType`** (default `"Actor"`), plus an `onRenderActiveEffectConfig` hook. Both base and enchantment system models now extend it. This enables **module-provided AE types** that apply to actors, items, or neither.
- **`BaseEffectData`** (`data/active-effect/base.mjs`): adds `system.magical` (BooleanField) and **`system.rider.statuses`** (SetField). `applicableType` returns `""` when `isRider` (a rider for a non-applied enchantment, detected via `item.getFlag("dnd5e","riders.effect")`), else `"Actor"`.
- **Rider statuses moved out of flags:** `flags.dnd5e.riders.statuses` → `system.rider.statuses`. In-memory migration in `ActiveEffect5e.migrateData` moves them and deletes the flag. `createRiderConditions()` now reads `this.system.riders?.statuses`. *(NB: PR has a singular/plural mismatch — schema/migration use `system.rider.statuses` but `createRiderConditions` reads `system.riders.statuses`; watch the shipped resolution.)*
- **`magical` toggle + antimagic:** `EnchantmentData.magical` defaults `true`; `ActiveEffect5e.isSuppressed` now returns true when `system.magical && actor.statuses.has("antimagic")`. System migration (`_migrateEffectMagical`, pre-5.2.0 content) marks effects on spells/scrolls and `mgc`-property items as magical.
- **`isAppliedEnchantment` redefined:** now `this.type === "enchantment" && this.system.isApplied`, where `EnchantmentData.isApplied = !!parent.origin && (parent.origin !== item?.uuid)`. Enchantment `applicableType` is `"Item"` when applied, else `""`. Enchantment tracking (`registry.enchantments.track/untrack`), `_preCreate`/`_onCreate`/`_onDelete`, and the "not on actor" guard all move from the document into `EnchantmentData`.

### DAE touch-points
- `specialDurations.ts:89` `isAppliedEnchantment(effect)` → reads `effect.isAppliedEnchantment` (document getter). **Retained** in v6 (delegates to `system.isApplied`). No change needed; semantics unchanged.
- `Systems/DAEdnd5e.ts:1219-1220` — DAE's own effect walk does `if (ef.type === "enchantment" && !ef.isAppliedEnchantment) continue;`. This is the **key reconciliation point**: v6 generalises "what does this effect apply to" into `applicableType` (`"Actor"`/`"Item"`/`""`), covering rider effects and module-provided types — not just the enchantment special-case. **Action:** once v6 lands, change this guard to skip anything whose `applicableType !== "Actor"` (instead of the enchantment-only check), so DAE doesn't apply rider/item-targeted/foreign-type effects to the actor. Verify against what `actor.allApplicableEffects()` already filters in v6 to avoid double-filtering.
- `DAEActiveEffectConfig.ts:225` (`document.isAppliedEnchantment`), `:729` (`effect.type === "enchantment"`) — still valid (getter + type retained). The new `onRenderActiveEffectConfig` system hook means dnd5e renders the magical/rider form-groups itself; verify DAE's config sheet doesn't duplicate or fight the rider-statuses field (dnd5e's `EnchantmentData.onRenderActiveEffectConfig` *removes* the transfer/statuses groups).
- `dae.ts:2541` `if (!ae.isAppliedEnchantment) return false;` and `dae.ts:1951` `this.type !== "enchantment"` — still valid.
- **Rider statuses:** DAE does **not** read `flags.dnd5e.riders.statuses` anywhere → no direct break. DAE's own migration system need not migrate it (dnd5e does so in `migrateData`).
- **`magical`/antimagic:** DAE benefits automatically — dnd5e suppresses magical effects under antimagic via `isSuppressed`, and DAE's apply path honours suppression. Verify DAE's group-actor `isSuppressed` logic (`DAEdnd5e.ts`) doesn't shadow the new condition.

### midi touch-points (tracked separately)
- `patching.ts:182-190` patches `isAppliedEnchantment` to avoid a throw when `this.parent.uuid` is dereferenced during prep. In v6 the getter delegates to `system.isApplied` (optional-chained on `item?.uuid`), so the throw midi guards may no longer occur — **re-evaluate whether the patch is still needed** under v6.
- `utils.ts:9214` (`filter(ae => ae.isAppliedEnchantment)`), `Workflow.ts:2884` (`effect?.type !== "enchantment"`) — still valid.
- midi's `magicalDamage`/`requireMagical` logic reads `item.system.magicalBonus`/properties — unrelated to the new effect-level `system.magical` (which is antimagic suppression). No conflict; optional future opportunity to consume `system.magical`.

### Open questions / decisions needed
- Does v6 `actor.allApplicableEffects()` filter by `applicableType` itself, or must consumers (DAE) do it? Determines whether DAE's guard change is additive or redundant.
- Final resolution of the `rider.statuses` vs `riders.statuses` singular/plural mismatch in shipped #5941.
- Whether DAE should expose `applicableType` awareness for its own custom/derived effect handling and the field-editor specs.

### Net assessment
Low-to-moderate DAE impact, mostly a **one-line guard generalisation** (`type==="enchantment" && !isAppliedEnchantment` → `applicableType !== "Actor"`) plus a config-sheet duplication check. No data-shape break for DAE (it doesn't store rider statuses). The migration of rider statuses is dnd5e-owned.

---

## Item 3: Non-persisted base-data fields for AE hints (#6631 / #6687)

Chosen as item 3 because it directly touches `ActiveEffect.FORMULA_FIELDS` (which DAE's ValidSpec/field-editor consumes) and converts pre-populated `prepareBaseData` slots into schema-declared `persisted: false` fields — DAE's schema walker should pick them up automatically.

### #6687 planned behaviour
Replaces hand-rolled `prepareBaseData` initialisation + `FORMULA_FIELDS` hints with proper schema-declared, non-persisted fields. Both `prepareBaseArmorClass()` and `prepareBaseEncumbrance()` become empty no-ops; character/NPC `prepareBaseData` stops setting `details.level` and `attunement.value`. Save activity `prepareData` stops setting `save.dc.bonus = ""`. `FORMULA_FIELDS` is reduced to `new Set()` and marked `@deprecated since DnD5e 6.0`.

**Fields moved into schema (`persisted: false`):**
- `system.attributes.ac.armor` — NumberField, initial 10
- `system.attributes.ac.shield` — NumberField, initial 0
- `system.attributes.ac.cover` — NumberField, initial 0
- `system.attributes.ac.bonus` — FormulaField (deterministic)
- `system.attributes.ac.min` — FormulaField (deterministic)
- `system.attributes.encumbrance.bonuses.{encumbered,heavilyEncumbered,maximum,overall}` — FormulaField (deterministic)
- `system.attributes.encumbrance.multipliers.{encumbered,heavilyEncumbered,maximum,overall}` — FormulaField (deterministic), initial `"1"`
- `system.attributes.attunement.value` — NumberField, initial 0
- `system.details.level` — NumberField, initial 0
- **New:** `system.attributes.spell` schema with `attack`/`dc`/`mod` NumberFields (`persisted: false`) — first-class AE-targetable spellcasting modifiers
- Activity-level: `save.dc.bonus` — FormulaField (deterministic, `persisted: false`)

### DAE touch-points (`Systems/DAEdnd5e.ts`)
DAE currently fills these slots manually because the schema doesn't expose them; that machinery becomes redundant in v6 and in some places harmful.

**Guarded fallbacks (safe — become no-ops in v6):**
- Lines 284-290: `system.details.level`, `ac.bonus`, `ac.armor`, `ac.shield`, `ac.cover`, `ac.min` all wrapped in `if (!baseValues[X]) baseValues[X] = [...]`. Once v6 puts the field in the schema, the schema walker fills `baseValues[X]` first and the manual line skips itself. **No action needed**, but a one-time review when v6 lands to drop the dead fallbacks is worth doing for clarity.

**Unguarded overrides (`MUST` add guards or remove for v6):**
- Lines 397-404: `system.attributes.encumbrance.bonuses.*` and `multipliers.*` are written unconditionally as `[new StringField(), ""]`. In v6 these are real `FormulaField`s (deterministic), and DAE's unconditional rewrite replaces the proper spec with a `StringField` — losing the formula semantics for ValidSpec/field-editor. **Action:** add `if (!baseValues[X])` guards (matching the AC fields' pattern) or delete the manual entries once v6 ships.

**New fields appear automatically (a win):**
- `system.attributes.spell.attack/dc/mod` — DAE's schema walker should expose them as AE-targetable without code changes. Worth verifying field-editor renders them with sensible labels (probably need `lang/en.json` entries).
- `system.attributes.ac.cover` (now in DAE-14x's `baseValues` line 289 already, guarded) — schema-side becomes authoritative.

**`FORMULA_FIELDS` deprecation:**
- DAE does not read `ActiveEffect.FORMULA_FIELDS` anywhere (`src/dae.ts:83` imports the `FormulaField` *class* via `globalThis.dnd5e?.dataModels?.fields?.FormulaField`, not the set). So the emptying/deprecation is transparent to DAE.

### midi-qol touch-points (tracked separately)
- midi's `field-data.json` autocomplete already includes most of these keys (and `ac.cover`). New v6 keys to add later: `system.attributes.spell.attack`, `system.attributes.spell.dc`, `system.attributes.spell.mod`, and possibly `save.dc.bonus` on activities. Low-priority autocomplete refresh.
- No runtime midi code reads these fields directly in ways affected by #6687.

### Open questions / decisions needed
- Should DAE proactively delete its now-redundant fallbacks once v6 ships, or keep guarded versions for cross-version (5.x ↔ 6.x) compatibility? Recommend: keep the guarded ones (cheap, harmless), drop the unguarded encumbrance overrides (replace with guarded equivalents).
- Verify `persisted: false` fields appear in DAE's schema walker. Foundry's `SchemaField` traversal includes non-persisted fields in `defineSchema()` output, so they should — but worth confirming once v6 is testable.
- Should DAE add a `system.attributes.spell.*` group to its localisation/field-editor labels proactively? Yes, once v6 ships.

### Net assessment
**Low DAE impact, mostly cleanup.** Two action items only:
1. Add guards (or remove) the unguarded encumbrance overrides at `DAEdnd5e.ts:397-404`.
2. Optional one-time pruning of now-redundant guarded fallbacks (`details.level`, `ac.*`) for clarity.

Plus a quick localisation pass for the new `system.attributes.spell.{attack,dc,mod}` keys.

---

## Item 4: Store AE origins on system data (#6626)

Status: **open issue, no PR**, labelled `compatibility` + `priority: high`. Analysis is therefore of the *proposal* — final API may differ. The issue ties into the broader AE-data-model overhaul (item 2, #5941); enchantment-applied-state may join the same schema (suggested in #6626 comment).

### #6626 proposal
Move `ActiveEffect.origin` (a top-level `StringField`) into the system data model as a SchemaField:

```js
class ActiveEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    return {
      origin: new foundry.data.fields.SchemaField({
        uuid: new foundry.data.fields.StringField({ nullable: true, blank: false })
      })
    };
  }
}
```

Motivation: extensibility — additional origin metadata (likely an `applied` boolean for enchantments per the issue comment, possibly source/role fields later) beyond the bare UUID. The wrapping `origin: {...}` schema is the deliberate shape for that future extension.

### Compat-layer expectations (the variable that determines blast radius)
The proposal does not state whether Foundry core or dnd5e will provide a top-level `origin` getter/setter delegating to `system.origin.uuid`. **Two scenarios:**

- **Compat shim provided (likely, matching #6800's pattern)**: top-level `effect.origin` keeps working as a getter (deprecation warning until 6.2), and `migrateData` rewrites legacy strings into `system.origin.uuid`. → DAE/midi need **no immediate code change**, just a deprecation-clean-up pass before 6.2.
- **No compat shim** (worst case): every `effect.origin` read/write across DAE and midi breaks. → Mechanical but wide sed-style update needed.

The pattern from #6800 (deprecated `effect` getter with compat-window-until-6.2) makes the first scenario the safer bet, but until #6626 ships the affected surface must be inventoried.

### DAE touch-points (`grep effect.origin`/`.origin`)
**Reads** (~35 sites):
- `GMAction.ts:270-291` (`_deleteEffects` filter by origin), `:329-457` (effect creation/macro routing, `flags.dnd5e.dependentOn` writes derived from `aeData.origin`)
- `specialDurations.ts:49` (`fromUuidSync(effect.origin)` to resolve concentration source)
- `stackingPolicy.ts:29-92` (cross-effect stacking by `ef.origin === effect.origin`)
- `macroResolution.ts:20-127` (`fromUuid(effectData.origin)` to find item-macro source, with cycle-aware traversal of nested origins)
- `Systems/DAEdnd5e.ts:1367-1494` (`getItemFromEffectOrigin` parser — multiple regex patterns over `effect.origin` strings; **highest concentration of origin-shape assumptions**)
- `dae.ts:124-792` (`addConvenientEffectsChange`/`removeConvenientEffectsChange` plumbing, `flags.dae.deleteOrigin` lookup, transfer-effect detection at line 727: `effect.origin?.startsWith(actor.uuid)`)
- `apps/ActiveEffects.ts:116` (regex `/Actor.*Item\.(.*)/` against `e.origin` to extract item id)

**Writes**:
- `apps/DAEActiveEffectConfig.ts:617-620` (form-submit normalisation: OwnedItem→Item conversion, transfer→parent.uuid sync). **Top priority for v6 migration sympathy** — this is the only place DAE actively normalises origin shape; the legacy-OwnedItem step is the natural home for a `system.origin.uuid` write-back if needed.
- `apps/ActiveEffects.ts:212` (`effect.updateSource({ origin: ... })`)

**Pattern-based concerns** (origin as a UUID *string* with structural meaning):
- The `DAEdnd5e.getItemFromEffectOrigin` regexes assume origin is a UUID string. If v6 keeps it as a string (just in a different field), regexes still work via the compat-shim getter. If v6 ever extends `system.origin` into a richer object the *string* property survives but a richer source-lookup helper could be exposed.
- `stackingPolicy` compares origins by string equality — same compat-shim story.

### midi-qol touch-points (tracked separately)
Even denser than DAE: `Workflow.ts` (~10 writes via `origin: this.item.uuid`/`activity.uuid`), `Hooks.ts:277,544,581`, `utils.ts:989-1043` (the `change.effect.origin` driver of `@activity`/`ActivityMacro.<uuid>` resolution), `patching.ts:2543-2556` (`getItemEffectsToDelete`), `GMAction.ts:632-689`, `regionBehaviors/MidiRegionActivityBehaviorType.ts:270,299`, plus the `getItemFromEffectOrigin` API surfaced through `lib/midiCompletions.ts:141`. Same compat-shim assumption applies — if dnd5e keeps `origin` readable/writable as a top-level string, midi is unaffected at runtime.

### Reconciliation plan (act when #6626 has a PR)
1. **Confirm compat surface**: does the shipped PR keep `effect.origin` as a top-level get/set that proxies `system.origin.uuid`, and does `migrateData` move legacy values? If yes → no urgent action; queue a deprecation sweep for 6.2.
2. **If no compat shim**: cross-cutting find/replace of `effect.origin` reads/writes in DAE and midi, gated by a `daeOriginInSystem` version flag (`game.system.version >= "6.0.0"`).
3. **DAEActiveEffectConfig form-submit (`:617-620`)**: in v6 path, write to `system.origin.uuid` instead of `origin`; keep OwnedItem→Item conversion until 6.2.
4. **`getItemFromEffectOrigin`** (`DAEdnd5e.ts:1367` and midi's twin via `getItemFromEffectOrigin`): keep working on the string; revisit only if `system.origin` is extended with a structural item-uuid field.
5. **`flags.dnd5e.dependentOn`** writes (GMAction): nothing structural changes — it's still a UUID string.
6. **Stacking policy / concentration lookup / macro resolution**: zero changes expected; all consume origin as opaque string.
7. **Enchantment-applied refinement** (per #6626 comment): if v6 adds `system.applied`/equivalent, prefer that over the current origin-comparison heuristic in `EnchantmentData.isApplied` (already in item 2).

### Open questions / decisions needed
- Top-level `origin` getter/setter compat: provided or not?
- Migration policy: does dnd5e migrate world+pack `origin` strings into `system.origin.uuid`, or rely on the compat getter forever?
- Will `system.origin` be on `ActiveEffectTypeDataModel` (system-wide for all AE types) or only on the dnd5e base type? Affects whether enchantments and module-provided types inherit it.
- Long-term `dependentOn` consolidation: should `flags.dnd5e.dependentOn` collapse into `system.origin` once it's an extensible schema?

### Net assessment
**Potentially broad reach, but probably small effort** — entirely determined by whether dnd5e provides the top-level `origin` compat getter (which their recent PR pattern, e.g. #6800's deprecated `effect` getter, suggests they will). Worst-case it's a mechanical sweep, no semantic redesign required. The *one* thing to watch for behaviour change is enchantment applied-state (item 2's `EnchantmentData.isApplied`); if #6626 adds an explicit `applied` boolean, prefer it.

---

## Item 5: Rule AE / conditional change-mode application (#6315)

Status: **open issue, no PR**, labelled `epic` + `priority: high` + `strategic`. Design is in active flux (last update 2026-03-16). **Heavy midi overlap; low DAE impact.**

### Design pivot (important)
The original proposal (Aug 2025) was a new AE *type* with conditional `key` + custom `mode`. **2026-03-16 arbron comment** pivots to a different design: **new change modes** added to existing AEs, rather than a separate AE type:

| field | role | example values |
|---|---|---|
| `key` | what is changed | `attack`, `damage`, `skill` |
| `mode` (renamed `type`) | how it is changed | `dnd5e.bonus`, `dnd5e.modifier`, `dnd5e.mode` |
| `value` | the modification | `1d4`, `min2`, `1` (advantage) |

Examples: `attack | dnd5e.bonus | 1d4`, `damage | dnd5e.modifier | min2`, `skill | dnd5e.mode | 1`.

Advantage of this approach (per arbron): **Rule changes coexist on the same AE as ordinary changes** and **can live on enchantments** (per-item conditional effects, e.g. "this handaxe gives +1d4 when thrown only").

### Dependency that is now dead
The original proposal hoped to build on Foundry core **#13465** ("Add JSON-serializable logic DSL to support conditional application of ActiveEffects"). That issue was **closed `not_planned`** on 2026-01-26 by stwlam. So dnd5e cannot rely on a core conditional DSL — any filtering syntax will be **system-defined** (likely extending the existing `system.bonuses` filter machinery).

### Timeline outlook
- **No PR exists.** Design pivoting from "new AE type" → "new change modes" — significant rework from the original proposal.
- The core DSL dependency is dead. Either dnd5e ships its own filter syntax (substantial work) or scope-reduces to a small set of pre-baked filters.
- Comments (thatlonelybugbear, Zanderaf, krbz999) all flag the need for a custom UI — non-trivial UX work in addition to data model + apply-time integration.
- **Realistic: this lands in 6.x (post-6.0), not in 6.0 itself**, given the open design questions and the absence of a PR three months before 6.0 milestone close.

### DAE impact: **low**
DAE is a general-purpose AE engine — Rule AE's custom change modes are mostly transparent:

1. **Mode-dropdown in field editor** (`apps/DAEActiveEffectConfig.ts`): when v6 ships custom string change modes (`dnd5e.bonus`/`dnd5e.modifier`/`dnd5e.mode`), DAE's mode dropdown must surface them. DAE already handles string-valued modes (per Changelog `14.0.7` — "Numeric modes are now mapped to their v14 string equivalents"), so adding new modes is a registration step, not a refactor.
2. **`daeApplyChange` wrap** (`module/dae.ts`): wraps `ActiveEffect.applyChange`. Rule AE changes are likely **not** applied to actor data at all (they're filtered at roll time, per arbron's design) — so dnd5e probably routes them through a custom path that never calls `applyChange`, and DAE's wrap silently doesn't see them. No-op for DAE; safe by default.
3. **ValidSpec field-data** (`src/data/field-data.json` / `Systems/DAEdnd5e.ts`): the new `key` values (`attack`, `damage`, `skill`, …) are conceptual roll categories, not actor data paths. They should not appear in DAE's standard schema-walker output. Likely needs a separate **"Rule AE keys" registry** to populate the field-editor for Rule changes — additive, not a breaking change.
4. **Stacking / duration / origin** — unaffected.

**Net:** ~1 module-config change (register new modes) + ~1 UI registry addition (Rule AE key list for the field editor). No data-model migration. No behavioural change to existing effects.

### midi-qol impact: **high — strategic overlap with existing optional/advantage/disadvantage system**

midi already implements a parallel conditional-bonus ecosystem (the very same problem space Rule AE targets):

| flag family | midi role | Rule AE equivalent |
|---|---|---|
| `flags.midi-qol.advantage.{attack,save,check,skill}.<filter>` | grant advantage/disadvantage conditionally | `<scope> \| dnd5e.mode \| 1/-1` |
| `flags.midi-qol.disadvantage.*` | same, inverse | same |
| `flags.midi-qol.fail.{ability.save.<ability>}` | auto-fail saves | `save | dnd5e.mode | autoFail` (if Rule AE supports it) |
| `flags.midi-qol.optional.<id>.{attack,damage,save,check,skill}` | optional user-confirmed bonus (dialog) | `<scope> \| dnd5e.bonus \| <formula>` (without the optionality) |
| `flags.midi-qol.bonuses.{attack,damage,…}` | unconditional bonus to specific rolls | `<scope> \| dnd5e.bonus \| <formula>` |
| `flags.midi-qol.grants.*` / `flags.midi-qol.advantage.attack.all` etc. | target-side modifiers | possibly need a "target" channel in Rule AE |

**Strategic decisions required (cannot pre-plan beyond awareness):**
1. **Coexist vs migrate vs translate.** Options:
   - *Coexist*: keep `flags.midi-qol.*`, read Rule AE changes additionally at roll time. Lowest disruption; permanent dual-system maintenance cost.
   - *Translate*: at runtime, midi reads Rule AE changes and feeds them into the existing bonus/advantage pipeline. Cleanest user story; depends on Rule AE's apply path being inspectable.
   - *Migrate*: emit Rule AE changes from new `flags.midi-qol.*` writes; long-term, deprecate the flag system. Riskiest (touches every consumer); only attractive if Rule AE proves substantially more expressive.
2. **Optional-bonus dialog**: Rule AE (as drafted) has no notion of "user opts in at roll time" (it's pure conditional). midi's `flags.midi-qol.optional.*` system requires user confirmation — does Rule AE gain an opt-in flag, or does midi keep its dialog-confirmation system on top of Rule AE values?
3. **Filter syntax compatibility**: midi's filter system on the flag path (`flags.midi-qol.advantage.attack.<filter>`) uses its own segmented-key syntax. The Rule AE filter (whatever syntax dnd5e adopts) won't match. Translation requires a syntax mapping table.
4. **`grants.*` / target-side**: midi's grants flags affect rolls *targeting* the actor. Rule AE design comments don't yet address target-side application. Watch.

### Reconciliation plan (act when #6315 PR appears)
1. **DAE**:
   - Register new change modes in the mode dropdown (one-line additions per mode).
   - Add Rule AE key list to the field-editor (separate registry; ~30 lines).
   - Verify `daeApplyChange` wrap doesn't fight whatever apply path dnd5e adopts.
2. **midi (tracked separately)**:
   - Read Rule AE changes at the same hook points midi already uses for `flags.midi-qol.*` resolution (`Workflow.ts` advantage/disadvantage/bonus collection sites).
   - Decide coexist/translate/migrate per area (likely *translate* for most categories — read Rule AE changes, feed them through midi's existing bonus/advantage merging).
   - Keep the `flags.midi-qol.optional.*` user-confirmation system intact (Rule AE doesn't replace it).
   - Document the overlap so users don't double-stack equivalent bonuses (e.g. same effect with both a Rule AE change and a `flags.midi-qol.bonuses.attack` flag).
3. **dependencies on prior items**: none. The new modes are orthogonal to #5941's data model and #6800's profile changes.

### Open questions / decisions needed
- Will Rule AE ship in 6.0, or slip to 6.x? (Affects whether we need parallel-system planning now or later.)
- What filter syntax does dnd5e adopt without the core DSL? (Determines translation feasibility.)
- Target-side rules (affecting rolls *against* the actor)?
- Optional/dialog opt-in semantics?
- Does Rule AE apply via `ActiveEffect.applyChange` (DAE's wrap sees it) or via a custom roll-time channel (DAE's wrap doesn't)?

### Net assessment
- **DAE**: minor cosmetic/registry work once shipped; no urgent action.
- **midi**: large strategic question — the design literally overlaps the use cases midi's optional-bonus flag system was created to handle. Whatever direction dnd5e takes, midi will need a *deliberate* coexistence strategy. Not yet actionable (no PR, design still moving), but worth flagging on every sprint until a PR appears.

---

## Item 6: AE phases + item-derived props + token-size sync (#6439, #4437, #6676)

Three related but independent issues, all **open with no PR**. Grouped because they share an "AE application timing/derivation" theme.

### #6439 — Additional AE application phases
- **Foundry core dependency: already shipped.** Foundry #13426 closed `completed` in V14 Prototype 2 / 14.352 (2025-11-06). Core now exposes `Actor#applyActiveEffects(phase)` with two phases registered by default: **`initial`** (the legacy V13 point — end of `prepareEmbeddedDocuments`) and **`final`** (after `prepareDerivedData`). Each change carries a `phase`. Systems can register additional phases but must then invoke `applyActiveEffects(<phase>)` themselves at the right moment.
- **dnd5e #6439** is the inventory task: decide where dnd5e would benefit from additional phases. No design yet, no PR.

**DAE-14x is already phase-aware** (`Systems/DAESystem.ts`):
- `SpecPhase = "initial" | "final" | "none"` defined at line 14.
- Every `ValidSpec` carries a phase. baseValues get `"initial"`; specials/derived specs and all token.*/ATL.* specs get `"final"` (lines 112-122, 596-606).
- `daeApplyActiveEffects` is registered as a `libWrapper` WRAPPER on `Actor.applyActiveEffects` (line 529) and runs **per phase**, with the comment "Core handles: phase validation, change collection, sorting, applyChange, overrides. DAE adds: phase correction for missed changes (ValidSpec), showIcon deprecation."
- Phase labels surface in the field-editor (`(*)` for `final`, `(ui)` for `none` — line 227-228).

**DAE touch-points if dnd5e #6439 lands:**
1. **New system-registered phase**: if dnd5e adds e.g. a `"roll"` phase (per the Rule AE design in item 5), DAE's `SpecPhase` union must extend (`"initial" | "final" | "none" | "roll"`), and the `daeApplyActiveEffects` WRAPPER needs to forward the new phase correctly. Mechanical change; matches the existing pattern.
2. **ValidSpec phase reassignment**: dnd5e may move some keys from `initial` to `final` (or to a new phase). DAE's specs already favour `final` for token/ATL/special derived fields, so most moves should align. Specs that need explicit reassignment are identified by which `prepareData` step they depend on.
3. **No data model break** — `phase` is per-change and the schema is unchanged. DAE doesn't need migration here.

**midi impact (tracked separately):** minimal. midi doesn't directly hook `applyActiveEffects`; it relies on DAE/Foundry for AE application timing. If dnd5e adds a roll-phase for Rule AE, midi's interest is via the Rule AE path (item 5), not via phase mechanics directly.

### #4437 — Derive AE properties from originating item upon application
- **Status:** open, `priority: medium`, no PR. References **#4465** "Special notation for roll data to be evaluated during Effect transfer" (also open, no PR).
- **Use case:** an item with a scaling duration (e.g. "1 minute per spell level") should produce an applied effect whose `duration` reflects the resolved scaling, not a static value baked at item-author time.
- **Proposal direction:** either a flag/system-data convention on the effect or a special roll-data notation (`@item.duration` / similar) that's evaluated at apply time.

**DAE position:** DAE already evaluates change *values* with full rollData substitution (`@…` references), via its `daeApplyChange` wrapper. The gap dnd5e is closing is in the effect's **non-change fields** (duration, statuses, transfer flag) where evaluation isn't currently supported. **DAE doesn't apply effects** — it intercepts changes and adjusts schema. Effect-level field derivation at creation time happens earlier in the pipeline (dnd5e activity → effect creation in `ActivityMixin`/`AppliedEffectField`).

**DAE touch-points if #4437 lands:**
- DAE's `evalArgs` helper (used for transferring `@…` references on creation) may want to extend to whatever notation dnd5e adopts (CLAUDE.md item 9 already documents an `evalArgs` quirk where hyphens in activityOverTime identifiers get treated as subtraction). Watch for the chosen syntax.
- The CLAUDE.md item 13 spell-level scaling (`usageConfig.spell.slot = "spell${midiOptions.spellLevel}"`) is a midi-side workaround for the same need. If dnd5e formalises a scaling notation that drives `dnd5e._prepareUsageScaling` from declarative effect data, midi could retire that workaround.
- **No data-model break.** Cosmetic / additive feature.

### #6676 — Sync token size/scale with actor size
- **Status:** open, `priority: high`, no PR. Related to **#6344** "Change the way a creature's Size is done to allow for modifying it via active effects" (also open, no PR). Comment confirms the implementation will leverage V14's `tokenOverrides`.
- **Design:** setting-gated (either world setting or per-actor flag). When enabled, token size derives from actor size, presumably with AEs targeting actor size driving the token's width/height/scale through `tokenOverrides`.

**DAE-14x current state** (very relevant): the ATL→token.* migration in `atlMigration.ts:14-16, 96-105` explicitly *does not migrate* `ATL.width`, `ATL.height`, `ATL.depth`, `ATL.shape`, `ATL.elevation`, `ATL.hidden`, `ATL.rotation`. The reason, called out verbatim in the migration source and the 14.0.10 changelog:

> *Not migrated (require ATL on v14 until core or dnd5e fills the `_onOverrideSize` gap)*

`TokenDocument._onOverrideSize` was added by core's tokenOverrides work but left as an **empty hook**, so width/height/depth changes silently fail. ATL still implements its own width/height handling, which is why DAE keeps recommending users keep ATL installed for those keys.

**DAE touch-points when #6676 + the upstream `_onOverrideSize` implementation land:**
1. **Remove the migration exemption** for `ATL.width`/`ATL.height`/`ATL.depth`/`ATL.shape` (and possibly `ATL.elevation`/`ATL.hidden`/`ATL.rotation` if those gain coverage in the same wave). The one-shot console warning at `atlMigration.ts:96-100` can be deleted.
2. **Extend the `atlChangeToTokenChanges` mapping table** (`atlMigration.ts:37-57`) with `ATL.width → token.width`, etc., once the targets are real.
3. **Decide migration policy**: actor-driven sizing means *user content* with `ATL.width = 2` should still work, but the canonical authoring path becomes actor-size + auto-sync. The DAE setting `atlCompatibility` already differentiates `legacy`/`runtime`/`migrate`/`full`; this naturally extends.
4. **Setting interaction**: dnd5e's planned "actor-size→token-size" toggle will probably override raw width/height AE writes. DAE should document the precedence so users know which path wins.

**midi impact:** none direct. midi doesn't write token width/height.

### Reconciliation plan (act when each lands)
1. **#6439 (phases)** — extend `SpecPhase` and the field-editor labels for any new phase dnd5e registers; verify `daeApplyActiveEffects` forwards the phase arg correctly.
2. **#4437 (item-derived props)** — wait for syntax; align DAE's `evalArgs` extension with whatever dnd5e adopts.
3. **#6676 (size sync)** — remove the ATL.width/height/depth migration exemption, extend the mapping table, retire the one-shot console warning at `atlMigration.ts:96`. Re-enable cross-version migration for those keys in `migrateEffectData`. Update Changelog to retract the "*Not migrated*" entries for those keys.

### Open questions / decisions needed
- **#6439**: which dnd5e operations need a new phase (or will the existing initial/final suffice)? Will Rule AE (item 5) introduce a `roll`-time phase?
- **#4437**: notation choice — flag-based, special roll-data notation (`@duration`/`@scaling`), or a new effect-field type?
- **#6676**: setting scope (world vs actor flag)? Does enabling it disable manual `width`/`height` AE writes, or merge them additively?

### Net assessment
- **#6439 — DAE-ready.** Phase machinery already in place. Cosmetic extension when dnd5e ships specifics.
- **#4437 — DAE-passive.** No DAE-side blocker; benefits flow through whenever dnd5e formalises the notation.
- **#6676 — Tangible cleanup win.** Once the upstream `_onOverrideSize` gap closes, DAE retires the ATL.width/height migration exemption and the user-facing "keep ATL for size" caveat. Direct improvement to the v14 ATL→token migration story.

All three are **non-urgent** — none has a PR, and DAE's existing architecture is well-positioned.

---

## Item 7: Consumable AEs (#6618) + Rest-based expiry (#6619)

Both **open issues, no PRs**, both explicitly blocked by upstream/sibling work. Grouped because they're symmetric "AE end-of-life via non-time events" features that midi/DAE already handle through ad-hoc mechanisms.

### #6618 — Consumable / opt-in AEs
- **Status:** open, `priority: low`, **explicitly blocked by #4692 + #6315** (Rule AE — item 5). 1 comment.
- **Use case:** features like Bardic Inspiration — an applied buff that should be *consumed* (removed) when the recipient uses it on a roll, with optional roll-dialog opt-in. Could also support limited-use counters (apply N times before expiring).
- **Direction:** the issue author flags this as needing "Opt-In Bonus" infrastructure (the Rule AE work in item 5), so it can't land before that.

### #6619 — Short/Long rest expiry
- **Status:** open, `priority: high`, **labelled `blocked`**. Comment from Fyorl (2026-01-08): *"This is blocked on v14 custom AE expiry events."* No PR.
- **Upstream V14 status:** core's AE-expiry registry work *has* shipped (closed: #13667 registry, #13332 non-seconds time units, #13752 expiry-event matching, #13873 deletion-error fix, #13875 turn-end interactions). What's still missing (per Fyorl's comment) is **system-registerable custom expiry events** — the hook that lets dnd5e register `"shortRest"`/`"longRest"` as first-class expiry triggers and have core fire them at the right moment.
- **Direction:** once core exposes custom event registration, dnd5e adds `shortRest`/`longRest` as native expiry options and fires them from the rest workflow. Effects with those expiry events are auto-handled.

### Existing midi/DAE coverage of both use cases

**#6619 (rest expiry) — already implemented end-to-end via DAE special durations + midi's rest manager:**
- DAE registers `daeSpecialDurations["longRest"]` / `["shortRest"]` (`Systems/DAEdnd5e.ts:656-657`) — these appear in the DAE config UI's special-duration multi-select.
- midi owns the runtime: `Hooks.on("dnd5e.restCompleted", restManager)` (`midi-qol-14x/Hooks.ts:393`). `restManager` (`:412-428`) filters actor effects by `flags.dae.specialDuration` and calls `expireEffects(...)` with `"expiry-reason": "midi-qol:longRest"` or `"midi-qol:shortRest"`. `newDay` is honoured (newDay-tagged effects get a different code path).
- The DAE registry-refresh interception already injects `expiry-reason` into expiry deletes; the migration table in item 1 maps the legacy reason strings.

**#6618 (consumable / count-limited bonuses) — already implemented via midi's optional-bonus count system:**
- `flags.midi-qol.optional.<id>.{attack|damage|save|check|skill}` paired with `flags.midi-qol.optional.<id>.count` (or `.countAlt`).
- Consumption logic: `utils.ts:5384-5415` finds the matching `count`/`countAlt` change on the effect; if `≤1` the effect is deleted, otherwise the count is decremented (string-valued, e.g. `"3"` → `"2"`). `countAlt` supports special tokens `"ItemUses.<id>"` and `"ActivityUses.<id>"` to chain consumption against item/activity uses instead of a bare counter.
- `getOptionalCountRemaining` (`utils.ts:5254`) gates whether the bonus is offered in the roll dialog at all — when count drops to zero, midi suppresses the option. Direct match for #6618's "leave players with less book-keeping" goal.

### DAE impact

**#6619 (when it ships):**
- DAE's `daeSpecialDurations["shortRest"]` / `["longRest"]` entries become **legacy** once dnd5e exposes native expiry events with the same semantics. DAE should:
  1. Keep registering them under `flags.dae.specialDuration` for backward-compat with existing world content (delete-after-N-versions).
  2. Add a **migration path** in `migrateEffectData` to rewrite `flags.dae.specialDuration: ["shortRest"]` → dnd5e's native `duration.expiry` event (whatever string dnd5e adopts — likely `"dnd5e.shortRest"` / `"shortRest"`). Mirrors the existing turnStart/turnEnd migration (CLAUDE.md item 1 / `getDeprecatedSpecialDurMap` in `specialDurations.ts:257`).
  3. Update the `expiry-reason` injection mapping (DAE-14x Changelog 14.0.6 table) to include the new rest event strings so macros consuming `expiry-reason` know "rest" was the trigger.

**#6618 (when it ships):**
- DAE's involvement is minimal. midi owns the optional/opt-in dialog plumbing; dnd5e's native consumable AE would be an alternative API surface for the same problem.
- If dnd5e's "consume on use" mechanism interacts with `flags.dae.deleteUuid` / `flags.dae.deleteOrigin` / DAE's transfer-effect-disable semantics (item 1), reconcile so that DAE doesn't try to disable a transfer effect that dnd5e already chose to delete.

### midi-qol impact (tracked separately)

**#6619:**
- midi's `restManager` becomes **redundant** for effects authored against dnd5e's native rest expiry. Reconciliation: keep `restManager` running for legacy `flags.dae.specialDuration` content; let dnd5e's native path handle effects authored with the new expiry.
- Move toward emitting dnd5e's native expiry on new midi content (sample items, CPR coordination).

**#6618:**
- High overlap with midi's `flags.midi-qol.optional.<id>.count`/`countAlt` system. Three options mirroring item 5's Rule AE coexistence question:
  1. **Coexist** — leave both systems running; user picks whichever.
  2. **Translate** — at roll time, midi reads dnd5e-native consumable AEs and feeds them into the same opt-in dialog used for `flags.midi-qol.optional.*` (preferred — preserves midi's UI investment).
  3. **Migrate** — emit dnd5e-native consumable AEs from new midi content; deprecate the flag system long-term.
- midi's `countAlt: "ItemUses.<id>"` / `"ActivityUses.<id>"` chaining is more expressive than #6618's brief proposal. midi should preserve this regardless.

### Reconciliation plan (act when each lands)
1. **#6619 PR appears →** (a) add dnd5e-native rest-expiry events to DAE's `getDeprecatedSpecialDurMap` migration table, (b) add corresponding entries to DAE's `expiry-reason` injection mapping, (c) keep midi's `restManager` as a back-compat handler for legacy `flags.dae.specialDuration` content, (d) Update CLAUDE.md item 14 (duration management moved to DAE) to note the rest-expiry split.
2. **#6618 PR appears →** (a) decide coexist/translate/migrate for the optional-bonus overlap, (b) verify DAE's transfer-effect-disable logic doesn't fight dnd5e's consume-on-use deletion, (c) decide whether to expose midi's richer `ItemUses.`/`ActivityUses.` chaining as a Rule AE / consumable extension or keep it midi-only.

### Open questions / decisions needed
- **#6619**: exact event string dnd5e adopts (`"shortRest"` vs `"dnd5e.shortRest"`)? Interaction with `newDay` (midi handles it; will dnd5e)?
- **#6618**: design depends on Rule AE (item 5) which itself is in flux. Will consumption be a generic AE flag, a Rule AE mode, or both?
- **Both**: how does dnd5e's native handling interact with DAE's transfer-effect-disable-not-delete policy (item 1, key risk #4)?

### Net assessment
- **#6619 — straightforward when it lands.** DAE/midi already implement the user-visible feature; the work is a migration table + rest-handler back-compat. Low risk, well-understood.
- **#6618 — blocked behind Rule AE (item 5), and Rule AE is itself in design flux.** No actionable work until both upstream items move. The overlap analysis with midi's optional/count system is identical to the Rule AE strategic question — they'll be answered together.

Neither is urgent. Both are well-positioned for graceful reconciliation when they ship.

---

## Item 8: FiltersField (#6671/#6672/#6821) + stock effects compendium (#6679)

Foundational schema/UI work plus a content compendium. Three related issues:
- **#6672** "Create `FiltersField` for storing filters data" — open issue, no direct PR (closed by #6821).
- **#6821** "[#6672] Implement `FiltersField`, `FiltersEditor`, and input" — **open PR**, has full implementation. Closes #6672.
- **#6671** "Add conditional for active effects and changes" — open issue, **blocked by #6672**. The umbrella feature that consumes FiltersField.
- **#6679** "Add active effects compendium with stock effects" — open PR, **100 effect files, content only**, no code.

### #6672/#6821 — FiltersField implementation (PR has code)

**`FiltersField`** (`module/data/fields/filters-field.mjs`) — extends `foundry.data.fields.JSONField`. Stores filter data as a JSON string, but `initialize()` parses and wraps it in a `Filter` instance with cached evaluation. Default value: `"{}"`. `_toInput()` returns a `FiltersInputElement`.

**`Filter` class** (`module/filter.mjs`) — runtime evaluator:
```js
filter.check(data)    // boolean, cached
filter.recheck(data)  // boolean, clears cache and re-runs
```

**Filter data shape (`FilterDescription`)**: `{ k: <key>, o: <operator>, v: <value> }`. Operators split into:
- `OPERATOR_FUNCTIONS` — boolean combinators (`AND`/`OR`/`NAND`/`NOR`, prefix-`N` for negation). Value is an array of sub-filters; nodes recurse.
- `COMPARISON_FUNCTIONS` — leaf comparisons (`exact`, plus more — set inferred from the breakdown UI).

**UI:** `<filters-input>` custom element shows a human-readable breakdown of the filter tree plus a button that opens `FiltersEditor` — a code-mirror modal (intentionally raw JSON; "will be replaced with a proper UI in the future" per PR body).

### #6671 — Conditional AE/changes (consumer of FiltersField)
Per body: "Add conditions to active effects ... available for the effect as a whole as well as for each individual change." No PR yet; needs FiltersField (#6672/#6821) to land first. Almost certainly will add a top-level AE `filters` field and a per-change `filters` field.

### #6679 — Stock effects compendium
PR adds 100 effect JSONs under `packs/_source/effects/` (advantage/disadvantage on ability checks/saves/skills; damage resistance/immunity/vulnerability; condition immunities/applications; speed-equal-to-base bonuses). Content-only. No data-model or code changes.

### Position in the v6 picture
This is the **infrastructure layer** for the conditional-AE features that several Items already touched:
- **Item 5 (Rule AE)** — explicitly listed as a FiltersField consumer (per #6672 body).
- **Item 7 (#6618 consumable AEs)** — blocked by Rule AE / #4692, which themselves consume Filters.
- **#6671 here** — generic AE/change conditional application; same dependency.

Whatever DAE/midi decide for one of these, they decide for all three.

### DAE impact

**Filter evaluation path:** Filters are checked against an arbitrary `data` object at consumer-defined points. The expected integration in dnd5e v6 is that `ActiveEffect5e#isSuppressed` (or a similar getter) inspects `system.filters` against the actor, and the per-change Filter inspects against per-change context — both **inside dnd5e's effect application code**. DAE's `daeApplyChange` WRAPPER runs on top — meaning **filtered-out changes never reach DAE** (because dnd5e's `applyChange` won't be called for them, or will short-circuit). **No DAE behaviour change needed**; the filter logic is transparent.

**Schema-walking / ValidSpec:** Once dnd5e adds `filters` to the AE schema (top-level and/or per-change), DAE's schema-walker should expose it automatically since `FiltersField` is a regular `JSONField`. Worth verifying that DAE doesn't try to render it as a plain text/JSON field — the field has a custom `_toInput()` returning `<filters-input>`, which DAE should defer to via the standard `field.toFormGroup()` path.

**Field-editor render:** DAE's `DAEActiveEffectConfig` builds change-row UIs. When dnd5e adds a per-change `filters` field, DAE has three options:
1. **Defer to dnd5e's input** — call `field.toFormGroup()` for the filter cell. Cleanest; no DAE code to maintain.
2. **Don't expose at all** — DAE-edited effects can't have per-change filters; users must use dnd5e's effect config sheet for those.
3. **Render a custom widget** — duplicate effort; not justified.

Recommendation: option 1. Verify when the PR lands.

**Cross-effect concerns:**
- **`isSuppressed` interaction** — DAE's group-actor `isSuppressed` logic (in `DAEdnd5e.ts`) layers on top of the document's `isSuppressed` getter. If dnd5e v6 makes `isSuppressed` consult `system.filters.check(this.actor)`, DAE inherits the new behaviour for free. Sanity-check there are no double-checks or conflicts.
- **Per-change filters and stacking** — DAE's stacking policy compares effects by name/origin (`stackingPolicy.ts`). Filters don't affect stacking semantics; orthogonal.
- **`isAppliedEnchantment` / `applicableType`** — orthogonal to filters (different concept).

### midi-qol impact (tracked separately)

**The strategic question is the same as Item 5 (Rule AE).** midi has its own filter-shaped flag system:
- `flags.midi-qol.advantage.{attack,save,check,skill}.<segment>`
- `flags.midi-qol.optional.<id>.<scope>.<segment>`
- `flags.midi-qol.bonuses.{attack,damage,...}.<scope>`
- `flags.midi-qol.fail.<scope>`, `flags.midi-qol.grants.*`

midi's "filter" is a segmented-key URL-style string; dnd5e v6's is a JSON `{k,o,v}` tree with full boolean composition. They're incomparable in expressiveness — dnd5e's is strictly richer for non-trivial cases.

**Three options** (mirroring Item 5):
1. **Coexist** — both systems run; users pick the one that fits.
2. **Translate** — at roll time, midi reads dnd5e filter-gated effects and feeds the matching changes into its existing bonus/advantage pipeline.
3. **Migrate** — emit filter-tagged effects from new midi content; long-term deprecate the flag system.

**Most pragmatic:** *translate*. midi's collection sites already accumulate bonuses from many sources; adding a "read changes whose filter passes" pass is additive. The dialog-based opt-in for `flags.midi-qol.optional.*` is preserved.

### Stock effects compendium (#6679)
**No DAE or midi action.** These are vanilla dnd5e AEs using standard change keys. DAE's apply path is transparent; midi's automation reads them as ordinary effects (advantage on saves, etc.). One **opportunity**: future midi sample items can `dependsOn` / reference the stock-effects compendium for common buffs/debuffs instead of authoring duplicates. Worth a follow-up review of midi sample items once dnd5e ships 6.0 to see which can be replaced.

### Reconciliation plan (act when #6671 lands; #6821 is the prerequisite)
1. **DAE**: verify FiltersField renders correctly via `field.toFormGroup()` in DAE's effect config; do not duplicate the input. Sanity-check `isSuppressed` interaction. No data migration.
2. **midi**: translate filter-gated effect changes at the existing advantage/bonus collection sites (`Workflow.ts` etc.). Document overlap with `flags.midi-qol.*` to avoid double-stacking.
3. **Sample items (post-6.0)**: identify midi sample items whose effects are now in the stock compendium; consider referencing instead of duplicating.

### Open questions / decisions needed
- Where does dnd5e put the filter — top-level AE, per-change, or both?
- Filter check timing: `isSuppressed` (effect-level) vs custom apply hook (change-level)?
- Does `FiltersField` ever evaluate during prep, or only on demand (e.g., at roll time)? Determines whether DAE's prep-time apply path sees filtered effects at all.
- Filter context shape — what `data` is passed to `filter.check()`? Determines what midi can feed into the check at roll time.

### Net assessment
- **DAE — likely zero code change.** Filters are JSON-stored + `Filter`-wrapped via FiltersField's `initialize()`; dnd5e applies them transparently inside its existing effect machinery; DAE's WRAPPER stays on top of `applyChange` and sees only the changes that pass. Verify the editor input renders correctly via the standard form-group hook.
- **midi — strategic, not urgent.** Same coexist/translate/migrate question as Rule AE; *translate* is the natural answer. Wait for #6671 PR to crystallise.
- **Stock effects — content opportunity.** Reduce midi sample-item duplication post-6.0.

The infrastructure (#6821) is closest to ready; the consumers (#6671, #6315) follow once it lands.

---

## Item 9: Auras / emanations / apply-effect behaviors (#5559, #6798, #6154, #6822, #6783, #6436)

**The biggest cluster of midi-qol overlap in v6.** dnd5e is shipping a system-level version of ActiveAuras / midi's region-behavior / emanation-attach machinery. Three PRs (#6798, #6822, #6783) close two issues (#6154, #6436) and partially address the umbrella #5559. midi has working parallel implementations of *all three* features.

### Cluster map
| issue/PR | status | role |
|---|---|---|
| **#5559** | open issue, no PR | epic: "ActiveAuras in core dnd5e". Umbrella for everything below. |
| **#6436** | open issue, was blocked by #6763 | "Switch to v14 emanation shape" — **closed by #6783** |
| **#6783** | **open PR** | Implements emanation-shape switch + **auto-attach to mouse-overed token at placement time** |
| **#6798** | **open PR** | New activity behavior wrapping core's "Apply Active Effect" region behavior |
| **#6154** | open issue | "Filtered Apply Effect region behavior" — **closed by #6822** |
| **#6822** | **open PR** | Implements filtered Apply Effect region behavior (disposition/size/type filters; TODO: FiltersField for arbitrary filters once #6672 lands) |

### #6783 — Native emanation-attach (direct overlap with today's midi work)

Changes `DND5E.areaTargetTypes.radius.template` from `"circle"` to `"emanation"` (v14's new emanation shape). The placement code:

```js
// canvas/template-placement.mjs
const attachToToken = this.config.shapes.some(s => s.type === "emanation");
await canvas.regions.placeRegions(/* ... */, { attachToToken, /* ... */ });
// preConfirm captures obj.attachment.token from the placement
// regionData built with:
attachment: { token: target.stationary ? undefined : shapes[0].token }
```

**Behaviour shipped:**
- Emanations get the new `emanation` shape (token-anchored, base sized to the token).
- During placement, mousing over a token attaches the emanation to *that* token.
- `target.template.stationary` (the existing dnd5e field) suppresses attach.
- Multiple shapes split — attached emanations become one region per shape.

**Direct overlap with the midi `attachToken` feature shipped earlier this session.** Two different UX models for the same conceptual feature:

| | midi `attachToken` | dnd5e #6783 |
|---|---|---|
| When chosen | At item-author time (activity sheet dropdown) | At cast time (player mouses over a token) |
| Possible targets | Caster, target (with picker), or none | Any token the player hovers (incl. caster, targets, bystanders) |
| Default | Stationary (per today's user decision) | Auto-attach to hovered token unless `stationary` |
| Per-shape control | Single attach decision per template | Per-shape attach (each shape becomes its own region) |
| Stationary opt-out | `attachToken: "none"` | `target.template.stationary: true` |

### #6798 — Activity-attached Apply Effect behavior (overlaps midi's RegionBehavior)
Adds `ApplyActiveEffectActivityBehavior` — an activity behavior carrying a `Set<DocumentUUIDField>` of effects. `createBehaviorData()` returns `{ system: { effects }, type: "applyActiveEffect" }` — i.e. it spawns core's stock Apply Effect region behavior whose effects fire on token-enter. **Equivalent of midi's "apply effect" rule** in `RegionBehaviorEditor`/`MidiRegionActivityBehaviorType`, but simpler.

### #6822 — Filtered Apply Effect Region Behavior (overlaps midi's `MidiRegionActivityBehaviorType` directly)

```js
// data/region-behavior/apply-active-effect.mjs
static defineSchema() {
  return {
    effects: new SetField(new DocumentUUIDField({ type: "ActiveEffect" })),
    dispositions: new SetField(new NumberField(...)),
    sizes: new SetField(new StringField({ choices: () => CONFIG.DND5E.actorSizes })),
    types: new SetField(new StringField({ choices: () => CONFIG.DND5E.creatureTypes }))
    // TODO: Add FiltersField once #6672 is done
  };
}
// onTokenEnter: filter by disposition/size/type, then apply
// onTokenExit: delete effects whose origin === this.parent.uuid
```

**Side-by-side with midi's `MidiRegionActivityBehaviorType`:**

| feature | dnd5e #6822 | midi `MidiRegionActivityBehaviorType` |
|---|---|---|
| Apply effect on enter | ✅ | ✅ |
| Delete on exit | ✅ (matched by `origin`) | ✅ (configurable per rule) |
| Disposition filter | ✅ | ✅ |
| Size filter | ✅ | ❌ |
| Creature type filter | ✅ | ❌ |
| Disposition + size + type combined | ✅ (AND) | partial |
| Once-per-turn gate | ❌ | ✅ |
| Trigger choices (entry/exit/turnStart/turnEnd) | ❌ (enter+exit only) | ✅ |
| Apply effect / remove effect / use activity actions | only apply | ✅ all three |
| Wall restriction | ❌ | ✅ |
| Filter by arbitrary conditions (FiltersField) | TODO | ❌ |
| oncePerTurn for repeated entries | ❌ | ✅ |

**midi is a superset for most existing rules.** dnd5e is more disciplined (one effect per behavior) and will gain FiltersField for arbitrary conditions later.

### Position vs other items
- Filters (Item 8 / #6672/#6821) — direct dependency for the TODO in #6822 (richer filters).
- Rule AE (Item 5 / #6315) — different layer (per-AE-change), not per-token-entry.
- Item 6 (#6676 token-size sync) — independent; uses v14's `tokenOverrides`.

### DAE impact

DAE doesn't manage emanations or region behaviors directly — it manages active effects. The changes here are *upstream* of DAE.

**Indirect touch-points:**
1. **Effect creation hooks:** #6822's `onTokenEnter` calls `actor.createEmbeddedDocuments("ActiveEffect", [...])`. DAE's create/update hooks (`_preCreateActiveEffect`, registry-refresh interception) fire as normal. **No new behaviour required.**
2. **`origin` field:** #6822 sets `data.origin = this.parent.uuid` (the region behavior's UUID, not the source item). DAE's many `effect.origin` consumers (Item 4 inventoried ~35 sites) read this as an opaque string and resolve via `fromUuid`. Region-behavior UUIDs are valid foundry UUIDs (`<sceneUuid>.RegionBehavior.<id>`), so existing DAE code paths work. **Worth confirming `getItemFromEffectOrigin` regex chain (`Systems/DAEdnd5e.ts:1367`) doesn't choke on the new origin shape** — current regexes assume Item/Actor paths; a RegionBehavior origin probably falls through to `undefined`, which is fine for most DAE consumers but may break macro-resolution paths that expect an Item.
3. **Compendium-sourced effects:** #6822 stamps `_stats.compendiumSource`/`duplicateSource` (matching #6800 pattern). DAE doesn't consume `_stats`, so transparent.

**Action items: zero or one.** Verify `getItemFromEffectOrigin` gracefully handles `RegionBehavior` UUIDs (likely already returns undefined → consumer falls back). If it throws, add a `RegionBehavior` branch that returns the source item via the region's flags/behavior config.

### midi-qol impact (the strategic call)

This is **the largest single overlap with midi's automation surface in v6**. Three pieces of midi infrastructure shipped/extended today directly overlap with v6 PRs:

**1. `attachToken` (shipped this session) vs #6783**
- Current state: midi's per-activity dropdown lets the *author* preconfigure attach-to-caster/target.
- v6: dnd5e attaches based on what the *player* hovers during placement; emanation shape adapts to the hovered token.
- **Options when #6783 lands:**
  - **(a) Coexist** — both run. Risk: double-attach (midi sets `attachment.token`, dnd5e also tries to set it). The merge order in `writeRegion` likely makes midi's write win, but unpredictable.
  - **(b) Detect & defer** — when running on dnd5e ≥ 6.0, midi's `_placeEmanationTemplate` skips the attach step entirely; dnd5e's placement-time attach takes over. midi's dropdown becomes a "hint" or is hidden for emanations.
  - **(c) Replace** — retire midi's `attachToken` entirely on v6; rely on dnd5e's UX. Existing item authors lose the pre-set behaviour but gain the more flexible placement-time UX.
- **Recommendation:** option (b). midi's `attachToken` adds value for **non-emanation** templates (where dnd5e's auto-attach doesn't fire — only `emanation` shape triggers it). For emanations specifically, defer to dnd5e once 6.0 is the minimum. Add a version gate.

**2. `MidiRegionActivityBehaviorType` (in midi today) vs #6822**
- midi's behavior is a superset feature-wise (multiple rules, turn triggers, oncePerTurn, wall restriction, action types beyond "apply").
- dnd5e's is simpler but first-class with system UI.
- **Options:**
  - **(a) Coexist** — midi's behavior stays; users choose which to attach. Current pattern; works.
  - **(b) Wrap** — midi's behavior detects v6 and, for the simple "apply effect on enter" case, emits dnd5e's behavior instead. Complex cases (turn triggers, multiple rules) stay midi-specific.
  - **(c) Migrate** — retire midi's behavior; rebuild the missing pieces on top of dnd5e's. Most disruptive.
- **Recommendation:** option (a). midi's behavior carries gameplay semantics (oncePerTurn, turn-end triggers, useActivity actions) that dnd5e's #6822 doesn't address. Keep midi's distinct. When dnd5e adds FiltersField support to #6822, **midi's `RegionBehaviorEditor` should consider exposing the same filter UI** for consistency — but that's a follow-up.

**3. `RegionBehaviorEditor` UI vs #6822 sheet**
- midi has its own modal editor for region behavior rules.
- dnd5e ships a stock config sheet for #6822's behavior type (screenshot in PR shows a tidy panel with effect picker, disposition checkboxes, size/type selects).
- **No conflict** — they edit different behavior types (`midi-qol.regionActivity` vs dnd5e's `applyActiveEffect`). They sit side-by-side in the region's behavior list.

**4. Sample items**
- Spirit Guardians (updated this session with `attachToken: "caster"`) will work fine under either system, but the **right authoring path on v6** is: use dnd5e's emanation type (auto-attaches via #6783), drop midi's `attachToken` setting. Re-review sample items at the v6 cutover.

### Reconciliation plan (act when these PRs land)
1. **midi `_placeEmanationTemplate`**: gate the attach-set on `game.system.version < "6.0.0"`. On v6+, skip it; let dnd5e own placement-time attach.
2. **midi activity-sheet dropdown**: keep for non-emanation templates (still useful); for emanation templates on v6, either hide it (deferring to dnd5e) or relabel as "explicit override of dnd5e placement attach".
3. **midi `MidiRegionActivityBehaviorType`**: keep. Document that it complements (not replaces) dnd5e's `applyActiveEffect` behavior.
4. **midi `RegionBehaviorEditor`**: when FiltersField (Item 8) lands and #6822 adds it, expose the same filter UI in midi's rule editor for consistency.
5. **Sample items**: re-audit emanation sample items on v6 cutover; drop `attachToken: "caster"` for items whose authoring should defer to dnd5e's placement attach (especially Spirit Guardians — the canonical case dnd5e is building this feature for).
6. **DAE**: verify `getItemFromEffectOrigin` handles RegionBehavior UUIDs without throwing. Minor.

### Open questions / decisions needed
- Final shape of dnd5e's `target.template` field — does `stationary` stay as-is, or does it gain a per-shape variant?
- Does #6783's mouse-over heuristic have a "no token under cursor" fallback to caster, or no attach?
- Does dnd5e plan a follow-up to add "always attach to caster" as a per-activity flag (which would entirely replace midi's `attachToken: "caster"` configuration)?
- FiltersField integration with #6822 — will the filters live on the region behavior or on the effect?

### Net assessment
- **midi**: a substantial reconfiguration in the v6 cutover. **The feature I built today (`attachToken`) overlaps directly with #6783 for emanations specifically.** Recommendation: gate midi's emanation-attach to dnd5e < 6.0, defer to native on v6+, keep `attachToken` for non-emanation templates (still a gap dnd5e doesn't fill). midi's `MidiRegionActivityBehaviorType` stays distinct (superset).
- **DAE**: minimal. One verification (`getItemFromEffectOrigin` on RegionBehavior UUIDs).
- **Sample items**: re-audit emanation items at the v6 cutover. Spirit Guardians is the canonical case dnd5e is building #6783 for; should defer to native attach on v6.

This is the cluster most likely to **change midi's UX surface area** in the v6 cutover.

---

## Item 10: Canvas / templates / region behaviors (#6763, #6778, #6438, #6784, #6722, #6761)

**The infrastructure layer underneath Item 9.** Three issues + three closing PRs. Mostly midi-impacting (migration to new APIs); DAE-neutral.

### Cluster map
| issue/PR | status | role |
|---|---|---|
| **#6763** | open issue | Re-write `AbilityTemplate` as `TemplatePlacement` — **closed by #6778** |
| **#6778** | **open PR** | `TemplatePlacement` API + deprecated `AbilityTemplate` shim |
| **#6438** | open issue | Add ring-wall AoE type — **closed by #6784** |
| **#6784** | **open PR** | "Wall (ring)" template type using v14 ring shape |
| **#6722** | open issue | Method for attaching behaviors to activity-created regions — **closed by #6761** |
| **#6761** | **open PR** | Activity Behaviors framework — auto-attaches region behaviors to placed templates |

### #6778 — `AbilityTemplate` → `TemplatePlacement`

Replaces `AbilityTemplate` (a `MeasuredTemplate` subclass) with `TemplatePlacement` (a new API mirroring `TokenPlacement`). The old `AbilityTemplate` survives **as a deprecation shim until DnD5e 6.2**:

```js
// module/canvas/ability-template.mjs (post-#6778)
constructor(...args) {
  super(...args);
  foundry.utils.logCompatibilityWarning(
    "The `AbilityTemplate` class has been deprecated in favor of the `TemplatePlacement` API.",
    { since: "DnD5e 6.0", until: "DnD5e 6.2" }
  );
}

static fromActivity(activity, options={}) {
  foundry.utils.logCompatibilityWarning(
    "`AbilityTemplate.fromActivity` has been deprecated in favor of `TemplatePlacement.fromActivity`.",
    { since: "DnD5e 6.0", until: "DnD5e 6.2" }
  );
  // ... legacy implementation retained
}
```

Internal dnd5e callers migrated to:
```js
const result = await TemplatePlacement.fromActivity(this);
if ( result ) templates.push(...result);
```

Shape changes:
- `AbilityTemplate.fromActivity` returned an array of `AbilityTemplate` instances; callers then `.drawPreview()` per template.
- `TemplatePlacement.fromActivity` is async and returns the placed templates directly (no separate `drawPreview` step).

`TokenPlacement` was refactored — much logic moved into a new shared `BasePlacement` superclass.

### #6761 — Activity Behaviors framework

Introduces a system-level pattern for **activity-attached region behaviors** that auto-fire when a template is placed:

- New `BaseActivityBehavior` data model.
- New `AppliedBehaviorField` schema field added to activities (`module/data/activity/fields/applied-behavior-field.mjs`).
- Activity sheet gains a behaviors panel (templates added under `templates/activity/parts/activity-behaviors.hbs` etc.) — UI for the activity author to pick + configure behaviors.
- Stock behaviors shipped initially:
  - **Difficult Terrain** (`difficult-terrain.mjs`) — auto-sets `magical` based on item's magical property; includes terrain types config.
  - **Rotate Area** (`rotate-area.mjs`) — for rotating-template effects.
  - **Apply Active Effect** (from #6798, plugged into this framework).
- Includes a `activity-behavior-level-limit.hbs` template — so behaviors can be gated by spell level.

The framework solves the "players can't create region behaviors" problem: the active GM creates the behaviors after the player places the template.

### #6784 — Ring-wall AoE type

Adds "Wall (ring)" alongside the existing "Wall (straight)" (renamed). Uses v14's `ring` shape with `outerWidth`. Lightweight — three files (`lang/en.json`, `template-placement.mjs`, `config.mjs`).

### DAE impact: **zero**

These changes are entirely template/region-placement infrastructure. DAE doesn't manage templates or activity behaviors. The deprecation of `AbilityTemplate` is invisible to DAE. The ring-wall AoE type is invisible to DAE. The activity behaviors framework is invisible to DAE.

**One indirect note:** when activity behaviors create region behaviors that subsequently apply effects (e.g., Difficult Terrain may not, but the Apply Effect behavior from #6798 does), DAE sees those as ordinary effect creations — same as Item 9 covered. No action.

### midi-qol impact

#### 1. `AbilityTemplate.fromActivity` reference must migrate

In `MidiActivityMixin.ts:1839`:
```ts
let templates = game.system.canvas.AbilityTemplate.fromActivity(this, templateOptions) as foundry.canvas.placeables.MeasuredTemplate.Implementation[];
```

Under v6:
- Calling `AbilityTemplate.fromActivity` triggers a deprecation warning in console (per call!).
- The shim returns the legacy result for the 6.0–6.2 window.
- Migration target: `game.system.canvas.TemplatePlacement.fromActivity(this, templateOptions)` — but verify the `templateOptions` shape is still accepted (midi passes `distance`, `x`, `y`, `flags.{actorUuid,tokenId,workflowId,itemUuid}`).
- Action: gate on `game.system.version >= "6.0.0"` to use `TemplatePlacement`; otherwise keep `AbilityTemplate`. Or just adopt `TemplatePlacement` if v6 becomes minimum dnd5e.

**Risk:** if midi's caller assumes the old return shape (an array of MeasuredTemplate instances) and the new one returns differently-shaped objects, downstream code (`templateDocuments[0]`, `td.object?.refresh()`, `canvas.scene?.regions.get(td._id)`) may break. Needs runtime verification against the v6 build.

#### 2. Activity Behaviors framework (#6761) — strategic question

dnd5e's framework introduces a generic "activity has these behaviors that fire when its template lands". midi already implements two specific cases of this:
- **`MidiRegionActivityBehaviorType`** — applies effects/uses activities with disposition/oncePerTurn/turn-trigger/wall-restriction rules
- **`regionLight`** — creates an ambient light at the region's center

**Three options for midi:**

(a) **Coexist** — midi's behaviors stay distinct from dnd5e's framework. midi's `RegionBehaviorEditor` opens a separate config panel. The system's "Activity Behaviors" panel and midi's "Region Behaviour" panel both appear on the activity sheet, doing similar things via different UIs. Current pattern; works.

(b) **Register midi behaviors under #6761's framework** — implement `MidiRegionActivityBehaviorType` and `regionLight` as `BaseActivityBehavior` subclasses. They show up in dnd5e's activity-behaviors panel. Pros: consistent UX, native level-limit support, less midi UI to maintain. Cons: midi's behaviors carry richer config (multi-rule editor, disposition/turn/wall settings) that may not fit cleanly into the simpler `BaseActivityBehavior` shape — may need to drop or rework features.

(c) **Hybrid** — surface midi's behaviors in dnd5e's activity-behaviors picker as one entry each ("midi: region rules", "midi: region light"); clicking opens midi's existing editor as a sub-modal. Best of both worlds, more code.

**Recommendation:** (a) initially, evaluate (c) after #6761 ships and the activity-sheet UX is observable. Option (b) is too lossy for midi's richer rule model.

#### 3. Ring-wall template type (#6784)

dnd5e adds `Wall (ring)` to `DND5E.areaTargetTypes`. midi's `activityHasAutoPlaceTemplate` predicate (`utils.ts:8764`) doesn't gate on wall types, so behaviour is unchanged. But:
- midi's autocomplete (`midiCompletions.ts`) may want to surface the new type for sample-item authors.
- midi sample items can now author ring-wall spells (e.g., Wall of Stone with ring topology).
- No required code change. Optional content/autocomplete update.

### Reconciliation plan (act when each PR lands)

1. **#6778 (TemplatePlacement)**: migrate midi's `_placeEmanationTemplate` to call `TemplatePlacement.fromActivity` on dnd5e ≥ 6.0. Verify the option shape and return-value shape. Likely a small adapter helper. **Compat window: 6.0 → 6.2** — beyond 6.2 the shim is removed and migration is mandatory.
2. **#6761 (Activity Behaviors framework)**: decide coexist vs hybrid. Document the parallel system in midi docs. Initially coexist.
3. **#6784 (ring-wall)**: optional autocomplete refresh and sample-item-author awareness. No required code change.

### Open questions / decisions needed

- **#6778**: does `TemplatePlacement.fromActivity` accept the same `templateOptions` keys midi passes (`distance`, `x`, `y`, flags)? Or is the option shape different?
- **#6761**: how cleanly can midi's `RegionBehaviorEditor` config (multi-rule, turn triggers, oncePerTurn, wall restriction, action types) map onto `BaseActivityBehavior`'s data model? Worth a deep look at `difficult-terrain.mjs` to see how config-by-data-model is patterned.
- **Compat window discipline**: midi-qol-14x supports a range of dnd5e versions. The shim window for `AbilityTemplate` is 6.0 → 6.2 — midi should migrate before 6.2 to avoid hard breakage. (Same discipline for the #6800 `applicableEffects` deprecation from Finding 0.)

### Net assessment
- **DAE — zero impact.** Pure template/region infrastructure.
- **midi — three migration items, none urgent:**
  - One required: `AbilityTemplate.fromActivity` → `TemplatePlacement.fromActivity` before DnD5e 6.2.
  - One strategic: activity-behaviors framework coexistence with `MidiRegionActivityBehaviorType` and `regionLight`.
  - One optional: ring-wall AoE awareness for autocomplete + sample items.

The infrastructure changes themselves are clean. The strategic question (Item 9's competitor analysis for emanation-attach + apply-effect behaviors) is the larger overlap; this Item is mostly the plumbing midi calls into.

---

## Item 11: Auto-sync actor senses to prototype token vision (#4698, closed by #6864)

**Significant cross-reference with DAE's own visionMode picker work in 14.0.10.** This item is the v6 system-level mechanism that overlaps with what DAE was building for ad-hoc effect-driven vision configuration.

### Cluster map
- **#4698** — original feature request (Nov 2024, no PR initially, milestone D&D5E 6.0.0, priority: high).
- **#6864** — **open PR** that closes #4698. Comprehensive implementation: schema, hooks, settings, migration.

### #6864 implementation

**`CONFIG.DND5E.senses` schema restructured** from `{key: "label"}` strings to objects:

```js
DND5E.senses = {
  blindsight:  { label: ..., detectionMode: "blindsight" },
  darkvision:  { label: ..., grantsSight: true, visionMode: "darkvision" },
  tremorsense: { label: ..., detectionMode: "feelTremor" },
  truesight:   { label: ..., detectionMode: "seeAll", grantsSight: true, visionMode: "darkvision" }
};
```
Modules can extend. Each sense optionally maps to a token **detection mode** and/or grants **sight** (with a configured **vision mode**).

**Sight-range rule:** sight.range = max(range of senses with `grantsSight`); sight.visionMode = the winning sense's configured visionMode. So `darkvision 10 + truesight 30 + tremorsense 60` → `sight.range = 30`, `visionMode = "darkvision"` (from truesight), detection modes = `[feelTremor (60), seeAll (30)]`.

**Sync points:**
- `TokenDocument5e.prepareBaseData()` → `_prepareSenseOverrides()` → `applySenseOverrides()`. Mutates token's sight + detectionModes during prep. **Runs BEFORE v14 core's AE token changes** (per PR body).
- `AttributesFields.preCreateSenses` — on actor creation, writes initial prototype token.
- `AttributesFields.preUpdateSenses` — on direct sense edits, writes prototype token.
- `Actor5e._syncTokenSenses()` — called from `_onCreateDescendantDocuments` / `_onUpdateDescendantDocuments` / `_onDeleteDescendantDocuments`. So **item/effect add/remove/update on the actor triggers a prototype-token resync**.
- Diff check: skips the update if nothing changed.

**Setting:** new world setting `senseVisionSync`, default `true`. Opt-out for users who manage token vision externally (DAE/midi, Vision5e, custom setups).

**Migration:** `_migrateActorTokenSenses` runs on `systemVersion < 6.0.0`. Computes overrides from existing senses → writes to prototype token. **Preserves non-sense detection modes** the user has configured manually (`userModes = existing.filter(m => !senseDetectionModeIds.has(m.id))`).

**Non-sense detection modes always preserved** at runtime via the same `senseDetectionModeIds` filter in `_syncTokenSenses` and `preUpdateSenses`.

### DAE impact

DAE-14x has extensive visionMode / detectionMode wiring already (shipped 14.0.10). The interaction split is:

**Where DAE already operates (`atlMigration.ts`, `DAEActiveEffectConfig.ts`):**
1. **Field-editor visionMode picker** — surfaces `token.sight.visionMode` and `ATL.sight.visionMode` as choices from `CONFIG.Canvas.visionModes`.
2. **`_expandVisionMode`** — when an AE sets `token.sight.visionMode`, DAE expands to sibling `token.sight.{brightness,contrast,saturation,attenuation}` overrides from `CONFIG.Canvas.visionModes[mode].vision.defaults`. Runs at apply time.
3. **ATL→token migration** — maps `ATL.sight.*` legacy keys onto `token.sight.*`, with visionMode default-expansion baked in.
4. **`token.detectionModes.<id>.range`** — paired with `token.detectionModes.<id>.enabled = true` so the TypedObjectField entry materialises correctly.
5. **DAE's apply layer** (`dae.ts:294-296`) — special-cases `sight.visionMode` to look up `CONFIG.Canvas.visionModes`.

**How #6864 interacts with each:**

1. **`system.attributes.senses.<key>` AEs (e.g., +60 darkvision):** dnd5e's `_syncTokenSenses` reads actor.system.attributes.senses, recomputes overrides, writes to prototype token. **An AE that bumps darkvision range now auto-propagates to token.sight.range + sight.visionMode + detectionModes WITHOUT DAE doing anything.** Clean win — fewer hand-rolled `token.*` effects needed in sample items. DAE's apply path doesn't fight this; the descendant-document hook (`_onUpdateDescendantDocuments`) fires AFTER DAE's apply, and `_syncTokenSenses` reads the prepared `system.attributes.senses.ranges` (which reflect DAE's applied changes).

2. **Direct `token.sight.*` / `token.detectionModes.*` AEs:** dnd5e's overrides apply in `prepareBaseData()`; **then v14 AE token changes apply on top** (per PR body). So DAE effects targeting these keys still win the final word. **No regression.**

3. **`_expandVisionMode` (DAE's CONFIG.Canvas.visionModes default-expansion):** unaffected. Only fires when an AE explicitly targets `token.sight.visionMode`. dnd5e's path writes visionMode directly (not via change), so DAE's expander isn't triggered for sense-derived vision. **Sense-driven darkvision will use core's visionMode defaults (basic Foundry behaviour); ad-hoc AE-driven visionMode keeps DAE's expander.** Likely no user-visible difference; sane.

4. **Detection-mode IDs:** dnd5e uses `"blindsight"`, `"feelTremor"`, `"seeAll"` for the senses-mapped detection modes. No `"basicSight"` (darkvision is a *vision mode*, not a detection mode, in v14 — already noted in DAE design). DAE's atlMigration paired-key logic (`token.detectionModes.<id>.enabled = true` siblings) keeps working for ad-hoc detection mode effects; sense-driven entries follow dnd5e's pattern.

5. **`senseVisionSync` opt-out:** users with heavy DAE token-vision customisation may want to disable to avoid prototype-token churn. **DAE documentation should mention this setting** when describing v14 token vision effects.

### midi-qol impact

**Minimal direct impact.** midi doesn't manage senses-to-vision sync. midi's `initializeVision` (in `patching.ts:225-268`) is about runtime vision computation, not field writes — no conflict.

**Indirect benefits:**
- Sample items that grant darkvision/blindsight/etc. via AE changes on `system.attributes.senses.<key>` no longer need a sibling `token.sight.range` change (or ATL.sight.range, etc.). **Simplifies authoring**.
- midi's setup wizard / docs may want to recommend the senses-only authoring pattern.

### Cross-effect concerns

**Migration order with DAE's own migration (Item 3 cleanup, Item 6 ATL.width gap):**
- `_migrateActorTokenSenses` runs on `systemVersion < 6.0.0` — once per actor at upgrade time.
- DAE migrations (CLAUDE.md item 14, atlCompatibility migrate mode) operate at module load time and target ATL→token rewrites.
- Order isn't deterministic between the two systems' first-load migrations, but they touch different fields (DAE writes effect changes; dnd5e writes prototype tokens). **No conflict expected.**

**Compendium imports:** dnd5e's `preCreateSenses` skips items with `_stats.compendiumSource` starting with `"Compendium."`. So importing actors from packs won't auto-write prototype tokens. Authors of pack-source actors should set the prototype token explicitly to match the intended senses.

**Non-sense detection modes:** dnd5e explicitly preserves these. Users with custom detection modes (e.g., Vision5e adds detection modes like `"seeInvisibility"`) keep them untouched. Good for ecosystem compatibility.

### Reconciliation plan (act when #6864 lands) — applies the cross-cutting principle

Per the principle: default = migrate to native; coexistence requires strict-superset justification.

**The split for vision authoring on v6:**
- **Sense-derived vision** (darkvision, blindsight, tremorsense, truesight — anything in `CONFIG.DND5E.senses`): **native is the only path.** AEs on `system.attributes.senses.<key>` auto-sync to the token via #6864. Sibling `token.sight.range` / `token.detectionModes.*` AEs become redundant and should be removed during sample-item authoring.
- **Non-sense vision** (custom vision modes not registered as a sense; ad-hoc visibility tweaks; brightness/contrast/saturation/attenuation tuning): **DAE's `token.sight.*` AE path stays.** This is the strict-superset case — dnd5e's sense sync only writes the four fields it derives from senses (`enabled`, `range`, `visionMode`, sense-id detection modes); everything else needs the direct-AE path. Module-extended senses (per #6864's "modules can extend `CONFIG.DND5E.senses`") shift content into the native path on a case-by-case basis.

**Steps:**
1. **DAE — no code changes (parallel survives on superset grounds).** The `token.sight.visionMode` picker, `_expandVisionMode` default-expansion, ATL→token migration, and direct `token.detectionModes.*` handling are all in the non-sense bucket and keep their place.
2. **midi — no code changes.** Doc pass: senses-only is the recommended authoring pattern for vision-granting items on v6.
3. **Sample items — actively migrate, not "optional cleanup":** at the v6 cutover, audit every sample item that has both `system.attributes.senses.<x>` AND `token.sight.range` (and/or sibling `token.detectionModes.<id>.*`) changes. The sibling should be **removed** so the native sync owns it. The audit is the migration trigger, not a follow-up.
4. **`senseVisionSync` opt-out documentation**: relevant for users layering Vision5e / heavy custom setups. DAE / midi docs should mention it as the standard escape hatch when describing the v14 vision model.
5. **DAE-14x ATL→token migration story**: independent (Item 6's `_onOverrideSize` caveat). No change.

**What this looks like in code over time:**
- Today, a Goggles-of-Night sample item might author both `system.attributes.senses.darkvision UPGRADE 60` AND `token.sight.range UPGRADE 60` for back-compat against systems that didn't sync. On v6 the second change is removed; the first carries the whole behaviour through dnd5e's `_syncTokenSenses`.
- A custom "spectral vision" mode that isn't in `CONFIG.DND5E.senses` continues authoring as `token.sight.visionMode OVERRIDE "spectral"` via DAE's direct path — that's the superset case.

### Exception justification (per the principle)
**DAE's `token.sight.*` AE path is kept as a strict superset:** native covers only fields derived from `CONFIG.DND5E.senses` entries. Effects that target non-sense fields (visionMode for a custom mode, brightness/contrast/saturation/attenuation for visual tuning, detection modes not registered to a sense) have no native equivalent. Coexistence is justified.

### Open questions / decisions needed
- Will dnd5e ever ship a "visionMode override" sense field (so blindsight could explicitly give monochrome vision instead of inheriting from another grantsSight sense)? Affects whether the `darkvision`/`truesight` overlap (both grantsSight, both visionMode="darkvision") is the final word.
- Does the `senseVisionSync` setting get migrated for existing worlds, or do users have to know to flip it? Default true is the safer choice for new content; existing complex setups may want false.
- Will `system.attributes.senses` schema gain a `visionMode` override per actor (rather than per CONFIG entry)? Would let one actor have darkvision-with-grayscale and another with full-colour darkvision via the same sense.

### Net assessment
- **DAE — zero code changes** (parallel survives as strict superset for non-sense vision). Documentation: native sense-sync is the recommended path for sense-derived vision; DAE's `token.sight.*` AE pathway is the path for custom-vision-mode / brightness / contrast / saturation / attenuation tuning.
- **midi — zero code changes.** Doc note: senses-only authoring for vision-granting items on v6.
- **Sample items — active migration, not optional cleanup.** At the v6 cutover, audit and remove redundant `token.sight.range` / `token.detectionModes.*` AEs from items that also set `system.attributes.senses.<x>`. The native sync owns those fields on v6+.

The split is clean: **native owns sense-derived vision; DAE's path owns everything else.** No long-term parallel competing for the same field set.

---

## Item 12: Dice / damage — crit, modifiers, AC formulas (#6538, #6261, #6834, #6121, #6646, #6658)

Three independent sub-clusters; all three have open PRs with code. Mostly transparent to DAE; some midi verification work.

### Sub-cluster A: Critical damage fixes (#6538)
**Open PR with code.** Labelled `bug`, `system: dice`, `strategic`. Fixes #4910/#4752/#5060/#5726.

Rewrites how `BasicRoll` and `damage-roll.mjs` handle critical transformation for complex damage terms:
- Simple `NumericTerm`s and `DiceTerm`s with no modifiers → existing logic (double the dice count).
- `NumericTerm`s with modifiers and any non-deterministic term → **duplicated** (added to the formula multiple times per the critical multiplier and bonus-dice count).
- Maximization on bonus crit dice now works correctly.
- `BasicRoll` gains sync-evaluation of maximized pool terms with modifiers.

Examples:
- `2d6 + 3` → `4d6 + 3` (unchanged)
- `2d6kh + 3` → `2d6kh + 3 + 2d6kh`
- `floor(3d6/2) + 1` → `floor(3d6/2) + 1 + floor(3d6/2)`
- `2d6kh + 3`, 2 bonus dice + powerful → `2d6kh + 3 + 18`
- `{1d10,3d4}kl + 2`, ×2 numeric + powerful → `{1d10,3d4}kl + 4 + 10`

### Sub-cluster B: Damage `modifiers` field (#6261/#6834)
**Open PR (#6834) with code; closes #6261.**

`DamageData` gains a `modifiers: SetField<StringField>` field. Modifiers are auto-applied to the formula:
- Automatic formula: appended to the dice term — `{n}d{denomination}{modifiers}`.
- Manual (custom) formula: regex-injected after the first dice term match.
- `scaledFormula(increase, { modifiers })` accepts additional caller-supplied modifiers (the hook for Rule AE-driven modifiers like Elemental Adept's `min2`).

Example use cases: enchantment authors add `min2` modifier instead of switching to a custom formula; Elemental Adept-style features can inject modifiers via Rule AE without overwriting the existing formula.

### Sub-cluster C: AC overhaul (#6121/#6646/#6658)
**Open PR (#6658) with code; closes #6121 and #6646.** The biggest of the three.

Replaces the single-formula AC model with a multi-formula architecture:

```js
// Old (deprecated):
calc: StringField("default")              // "natural"/"unarmored"/"default"/"custom"/"flat"
flat: NumberField                          // baseline AC
formula: FormulaField                      // single custom formula

// New:
flat: NumberField                          // player-entered baseline (unchanged)
formulas: ArrayField<{
  armored: BooleanField (nullable),       // null = no constraint; true = requires armor; false = forbidden when armored
  formula: FormulaField,
  label: StringField,
  shielded: BooleanField (nullable)       // analogous for shields
}>
selectedFormulas: SetField<StringField>    // IDs of CONFIG.DND5E.armorClasses formulas to include
override: NumberField                      // hard override (replaces "calc: flat" semantics)
```

**Multi-formula evaluation:** all enabled formulas evaluate; the one that yields the highest base AC wins. Per-formula `armored`/`shielded` flags decide eligibility — fixes #6121 (Unarmored Defense no longer applies when wearing a shield, where appropriate).

**`ac.min` baseline fix (#6646):** now treats `ac.min` as a true baseline that **doesn't suppress additive bonuses** (shield, cover, magic bonuses). Previously `ac.min` could mask later additions until the underlying AC exceeded the minimum.

**Migrations and shims:**
- `_migrateArmorClass` (in `attributes.mjs`): on first 6.0 load, migrates `calc`+`formula` → `formulas`/`selectedFormulas`/`override` per the old `calc` value (custom → push into formulas; flat → override; natural → keep flat; default → no-op; other → push id into selectedFormulas).
- `ActiveEffect5e.SHIM_FIELDS` (in `active-effect.mjs`): gains entries for `system.attributes.ac.calc` → `system.attributes.ac.selectedFormulas` (mode: ADD) and `system.attributes.ac.formula` → `system.attributes.ac.formulas` (mode: ADD). Old AEs targeting the deprecated keys auto-redirect with a compatibility warning.
- `ac.base = -Infinity` initial — winning formula populates.

### DAE impact

**Sub-cluster A (#6538) — zero impact.** DAE doesn't roll dice or handle criticals.

**Sub-cluster B (#6834) — zero impact.** `DamageData.modifiers` lives on activity damage parts, not on actor schema. DAE's apply path doesn't touch damage formulas.

**Sub-cluster C (#6658) — small cleanup opportunity:**
1. **Existing DAE ValidSpec entries for AC fields** (`Systems/DAEdnd5e.ts` from Item 3 analysis): `ac.bonus`, `ac.armor`, `ac.shield`, `ac.cover`, `ac.min` — all are runtime-derived prep fields that still exist post-#6658. **Still valid.**
2. **DAE override at `DAEdnd5e.ts:375`** — `baseValues["system.attributes.ac.calc"] = [new StringField(), "override"]`. **`ac.calc` is removed** in v6 (only the shim survives). DAE can either:
   - Keep the override (the shim redirects to `selectedFormulas`, mode forced to ADD per the SHIM_FIELDS table — so DAE's old "override" preset becomes wrong on v6).
   - **Remove the entry on v6** and let the schema walker pick up the new fields (`selectedFormulas`, `formulas`, `override`).
   - Recommended: gate by version. On dnd5e ≥ 6.0, drop the manual `ac.calc` entry; expose `system.attributes.ac.override` instead.
3. **New schema fields DAE should expose:** `ac.override` (NumberField), `ac.formulas` (ArrayField), `ac.selectedFormulas` (SetField). Schema walker should pick up automatically. Worth verifying the field-editor renders the ArrayField sensibly (users will rarely write to `formulas` directly via AE — most authoring is on the actor sheet).
4. **`ac.min` semantics changed for the better.** Existing DAE-authored "min AC" effects (e.g., Barkskin) start working correctly. No code change; sample-item authors of `ac.min` AEs benefit automatically.

### midi-qol impact (per cross-cutting principle)

**Sub-cluster A (#6538) — verification only.** midi sets `workflow.isCritical` and passes through to dnd5e's roll APIs (per the grep at `MidiActivityMixin.ts:574-986`); dnd5e applies the new crit transform. midi reads the result. **Risk: any midi code that re-transforms post-crit dice strings may need adjustment.** Recommend a smoke-test pass on critical damage for weapons with `kh`/`kl` modifiers, powerful criticals, bonus crit dice. No structural code change expected.

**Sub-cluster B (#6834) — opportunity, not requirement.** midi sample items can author cleaner damage formulas using the new `modifiers` field (e.g. `min2` for guaranteed minimum-2 damage). midi runtime doesn't need to know — dnd5e bakes modifiers into `formula` before midi sees it. **Future Rule AE integration** (per the PR body) maps onto Item 5's strategic translate path.

**Sub-cluster C (#6658) — small inventory:**
- midi's AC reads (`Workflow.ts:4781,5040,7151,…` and `utils.ts:5801,5814`) all consume `actor.system.attributes.ac.value` (final computed AC). **Transparent to the new shape.**
- `ac.flat` read at `Workflow.ts:7249` for vehicle override — `flat` is retained. **Transparent.**
- No reads of deprecated `ac.calc` / `ac.formula` in midi. **No migration burden.**
- `ac.value` may compose differently post-#6658 for edge cases (multiple selected formulas, `ac.min` baseline correctly composing). Worth a smoke test for vehicle/group actors and unarmored-defense + shield combinations.

### Cross-cutting principle application

| feature | parallel? | direction |
|---|---|---|
| #6538 critical | No DAE/midi parallel | n/a — pure upstream improvement; verify no regression |
| #6834 damage modifiers | No DAE/midi parallel; midi may *consume* via Rule AE later | n/a now; Rule AE integration covered by Item 5's translate path |
| #6658 AC overhaul | DAE's `ac.calc` override (line 375 of `DAEdnd5e.ts`) is parallel to the new `selectedFormulas` schema | **migrate** — remove the manual `ac.calc` override on dnd5e ≥ 6.0; let the schema walker expose `override`/`formulas`/`selectedFormulas` |

No strict-superset exceptions in this Item. All three sub-clusters are *strict improvements* over what midi/DAE worked around; converge cleanly.

### Reconciliation plan (act when each PR lands)
1. **DAE on v6 cutover**: gate the `system.attributes.ac.calc` override (`DAEdnd5e.ts:375`) by `game.system.version < "6.0.0"`. On v6+, drop the manual entry; verify schema walker exposes `ac.override` / `ac.formulas` / `ac.selectedFormulas`; add labels/hints to field-editor i18n.
2. **midi smoke tests**: critical damage on complex damage formulas (kh/kl, powerful crit, bonus dice); AC computation on unarmored-defense + shield, vehicle, group actors; `ac.min` baseline + shield combo (the #6646 regression case).
3. **Sample items — opportunity**: existing items authoring custom damage formulas just to add modifiers (`min2`/`r1`/etc.) can switch to the new `DamageData.modifiers` field. Optional cleanup post-cutover.
4. **DAE shim sweep before DnD5e 6.2**: the `SHIM_FIELDS` entries for `ac.calc`/`ac.formula` log compat warnings. Existing world content using those keys will spam the console. DAE's migration system (CLAUDE.md item 14) could include these in its auto-migration sweep.

### Open questions / decisions needed
- Will dnd5e expose any helper to add a `selectedFormula` entry from a feat/item without touching AEs (e.g., a class feature config)?
- Does `formulas[].label` get auto-translated for stock entries, or always literal?
- Will dnd5e add a `formulas[].priority` for tie-breaking when multiple formulas produce the same base AC?
- How does `ac.override` interact with `ac.min` (does the override floor honor the minimum, or short-circuit everything)?

### Net assessment
- **DAE — one small cleanup (#6658)** in `DAEdnd5e.ts:375`; remove on v6. Optional auto-migration of legacy `ac.calc`/`ac.formula` effect keys via DAE's migration framework before 6.2.
- **midi — verification work** (critical regression smoke tests, AC composition smoke tests); no structural change.
- **Sample items — modest cleanup opportunity** (use `DamageData.modifiers` instead of custom formulas where applicable).

Per the principle: all three sub-clusters converge cleanly to native; no superset exceptions worth carrying.

---

## Item 13: Compatibility removal (#6888)

**Open PR; large** (~70 files, mostly removals). The "shim sweep" PR for v6. Removes deprecated APIs/CONFIG/fields and the V13/V14 cross-compat branches accumulated through 5.x.

### What's removed (relevant to DAE/midi)

**Whole files deleted:**
- `module/data/abstract.mjs` (-44) — old abstract base; v6 uses Foundry's native pattern.
- `module/applications/accordion.mjs` (-214) — custom widget; replaced by Foundry's native accordion in v14.
- `module/module-art.mjs` (-151) — module-art mapping system consolidated upstream.
- `templates/apps/module-art-config.hbs` — paired template.
- `templates/shared/sheet-config.hbs` — paired template.

**`ActiveEffect5e` (`module/documents/active-effect.mjs`, -135 net):**
- `apply()` instance method — the v13 compat shim; **gone**. v6 only uses `applyChange()` (the v14 path).
- `addDependent(...effects)` instance method — deprecated since 5.2; **gone**. Use `setFlag("dnd5e", "dependentOn", uuid)`.
- The full V13 compat block (`if ( !("applyChange" in ActiveEffect) )` ~130 lines) — gone. No more `applyField`/`_applyLegacy`/`_applyAdd`/`_applyUpgrade` overrides.
- All `game.release.generation < 14` branches inside the class — gone.
- `change.mode = CONST.ACTIVE_EFFECT_MODES.ADD` replaced with `change.type = "add"` (v14 naming everywhere).

**`CONFIG.DND5E` removals (`module/config.mjs`, -61):**
- `DND5E.spellPreparationModes` Proxy — deprecated 5.1; **gone**. Use `DND5E.spellcasting`.
- `DND5E.spellcastingTypes` Proxy — deprecated 5.1; **gone**. Use `DND5E.spellcasting`.
- `DND5E.spellProgression` Proxy — deprecated 5.1; **gone**. Set on `DND5E.spellcasting` instead.

**`SpellData` deprecated getters (`module/data/item/spell.mjs`, -27):**
- `SpellData#sourceClass` — deprecated 5.3; **gone**. Use `SpellData#sourceItem`.
- `SpellData#preparation` — deprecated 5.1; **gone**. Use `SpellData#method` (mode) and `SpellData#prepared` (state).

**Enchantment compat (`module/data/active-effect/enchantment.mjs`, -22):**
- `applyField`/`applyChangeField` version-branch — gone.
- `system.preparation.mode` change-key redirect — gone (use `system.method`).
- `system.preparation.prepared` change-key redirect — gone (use `system.prepared`).

**Other:**
- `module/data/shared/movement-field.mjs` (-30) — deprecated movement getters/setters.
- `module/data/region-behavior/rotate-area.mjs` (-97) — significant rework, likely shedding V13 fallbacks.
- `module/applications/components/effects.mjs` (-25 net) — context-menu cleanup.

### DAE / midi inventory

I grepped both modules for every removed API:

| removed API | dae-14x usage | midi-qol-14x usage |
|---|---|---|
| `ActiveEffect.addDependent` | **none** | **none** |
| `ActiveEffect.apply` (instance v13 shim) | **none** | **none** |
| `applyField` / `_applyLegacy` / `_applyAdd` / `_applyUpgrade` overrides | **none** | **none** |
| `game.release.generation < 14` / `> 13` branches | **none** | **none** |
| `CONFIG.DND5E.spellPreparationModes` | **none** | **none** |
| `CONFIG.DND5E.spellcastingTypes` | **none** | **none** |
| `CONFIG.DND5E.spellProgression` | **none** | **none** |
| `SpellData#sourceClass` | **none** | **none** |
| `SpellData#preparation.mode` / `.prepared` | **none** | **none** |

**Both modules are entirely clean.** DAE-14x uses `change.type` (the v14 native naming) throughout (`migration.ts:70`, `DAEActiveEffectConfig.ts:338,343,352`, `atlMigration.ts:231`, `dae.ts:450,454,460,519,956,958`, etc.). No deprecated dnd5e API consumers.

### Sample-item exposure

Sample-item JSONs **could** still reference deprecated keys (e.g., a spell sample that targets `system.preparation.mode` via an AE change). Worth a one-time grep of `pack-src/sampleitems/` at the v6 cutover:

```bash
grep -rn 'system\.preparation\.\|sourceClass\|spellPreparationModes\|spellcastingTypes' pack-src/
```

If any sample items use those keys in effect changes, they need updating to the replacement keys (`system.method` / `system.prepared` / `DND5E.spellcasting`).

### Cross-cutting principle application

| removed API | DAE/midi parallel? | direction |
|---|---|---|
| All removed APIs | **No parallel implementations** | **n/a — nothing to converge.** Both modules already aligned with v6's native API surface. |

This is the **cleanest** application of the principle in the whole review: no convergence work, just verification. The discipline DAE/midi maintained over 5.x (avoiding deprecated APIs as they were marked) pays off entirely at the 6.0 cutover.

### Reconciliation plan (act when #6888 lands)

1. **DAE — none required.** No deprecated API consumers; no code changes.
2. **midi — none required.** Same.
3. **Sample items — one-time grep**: at v6 cutover, scan `pack-src/sampleitems/` for the deprecated keys listed above. Likely zero hits given the modules' general cleanliness, but worth confirming. If any hits, update to native keys.
4. **DAE migration framework** (CLAUDE.md item 14, `migrateEffectData`): consider adding the deprecated change keys (`system.preparation.mode` → `system.method`, `system.preparation.prepared` → `system.prepared`) to DAE's auto-migration table for user worlds that still have these effects authored. Even though dnd5e removed the runtime shims, DAE's migration sweep can clean stored data on first load. Optional convenience.

### Related: shim windows from prior items

This Item closes the loop on shim-window deprecations called out in prior Items:

| from Item | deprecated API | window | #6888 removes? |
|---|---|---|---|
| Finding 0 / #6800 | `Activity#effect` getter | DnD5e 6.0 → 6.2 | **No** — still in 6.0; removed in 6.2 |
| Item 5 / #6315 | (no compat — new feature) | — | — |
| Item 9 / #6783 | (no compat — new feature) | — | — |
| Item 10 / #6778 | `AbilityTemplate.fromActivity` | 6.0 → 6.2 | **No** — still in 6.0; removed in 6.2 |
| Item 12 / #6658 | `system.attributes.ac.calc`/`ac.formula` change keys | 6.0 (SHIM_FIELDS) | **No** — runtime shim stays, no compat-window stated |

**So a follow-up cleanup PR for DnD5e 6.2 will likely repeat this pattern** — removing the 6.0-introduced shims (`AbilityTemplate.fromActivity`, `Activity#effect` getter). midi has known migration items for both (see Item 10 and Finding 0). DAE has nothing to migrate.

### Open questions / decisions needed

- Will the `region-behavior/rotate-area.mjs` rework (-97 lines) affect any midi region-behavior code? midi's `MidiRegionActivityBehaviorType` is a separate type — likely unaffected, but worth a spot-check.
- Does the accordion removal (replaced by native v14 accordion) cascade into any DAE/midi UI that referenced the dnd5e widget? Both grepped clean.

### Net assessment

- **DAE — zero impact.** Already on v14 native APIs. No code changes.
- **midi — zero impact.** Same.
- **Sample items — one grep at cutover.** Optional auto-migration hook in DAE's framework for user-authored deprecated change keys.
- **Pattern signal:** the discipline of staying ahead of deprecation warnings paid off — `#6888` is a non-event for the modules.

This is the **simplest** item in the review.

---

## Item 14: Misc — spellcastingAbility / scale values / calendar / bastions (#6183, #6233, #5845, #5210, #5209, #2187, #2291, #5647, #6591)

Four loosely-related sub-clusters, all touching utility/quality-of-life surface area outside the AE/region core that prior items covered. Almost all have open PRs.

### Sub-cluster A: `spellcastingAbility` highest (#6183)
**Open PR, closing nothing directly; unblocks #4934 and #5092.**

Adds `Actor#spellcastingAbility` property returning the **highest spellcasting ability** across all spellcasting classes (or the actor's spellcasting attribute if no classes). Convenience helper — no data-model change, no migration.

### Sub-cluster B: Scale values — sparse storage + uses type (#5209, #5210, #2187, #5845)
**Three open PRs, one open issue.**

- **#5209** (PR): scale value data stored sparsely (only level-deltas) instead of full keys per level. Migration included. Easier authoring (e.g., a `2d6` → `3d6` change at level 5 only requires changing one entry).
- **#5210** (PR): new "uses" scale value type for tracking item uses + recovery period.
- **#2187** (issue): the umbrella for the uses scale value type.
- **#5845** (PR): recovery periods on items/activities can reference scale values (e.g., `@scale.fighter.indomitable` as recharge formula).

### Sub-cluster C: Calendar-driven recovery (#6233, #2291)
**One open PR closes both #2291 and #5770.**

`world time advancement` now triggers recovery for periods `day` / `dawn` / `dusk` without needing the rest dialog. Gated by a setting (default = tied to calendar enablement, can switch to manual for module-driven calendars).

When time advances:
1. System scans world+actor items for recovery periods matching elapsed time.
2. Triggers recovery for all matching items.
3. Posts a chat message with the time-passage description ("The sun has risen.", "Two days have passed.") and per-actor deltas (gated by observer permissions).

Notable: `recoverUses` API extended to handle multi-period passage (advancing past both `dawn` and `dusk` in one update). Selection currently picks the first matching recovery profile per period.

Also includes the gritty-realism short-rest bug fix.

### Sub-cluster D: Bastion calendar advancement (#6591, #5647)
**Open PR closes #5647.**

Bastion orders advance automatically based on calendar. Each facility tracks the time of its last update; calendar advancement triggers completion. TODO: prompt for bastion turns on regular interval.

Highly bastion-specific; not relevant to DAE/midi.

### DAE impact

**Across all four sub-clusters: zero.** DAE doesn't manage spellcasting ability, scale values, item uses recovery, or bastion orders. All changes are dnd5e-internal feature additions.

One potential cross-touch: **calendar-driven recovery (#6233) fires when world time advances.** DAE has its own `_syncTokenSenses`-style descendant-document hooks (Items 11, 7), and DAE's special-duration `joinCombat` hook fires on combatant create. None of those overlap with item-uses recovery — they manage **effect expiry**, not **item-uses recovery** (different system). No conflict expected.

### midi-qol impact

**Sub-cluster A (#6183) — opportunity, not requirement.** midi computes spell DC and spell-attack bonuses in several places via `actor.system.attributes.spellcasting`. The new `Actor#spellcastingAbility` getter is a cleaner helper for "what's the effective ability when the actor has multiple spellcasting classes". midi could switch to it for cases where the active class isn't unambiguous, but the current path works.

**Sub-cluster B (scale values, #5209/#5210/#5845) — sample-item opportunity.** midi sample items that author class features with limited uses can use the new uses scale value type for cleaner advancement integration. The sparse storage change (#5209) is dnd5e-internal — handled by core migration. midi runtime never touches scale-value storage shape. **No required code change.**

**Sub-cluster C (calendar recovery, #6233) — verification cluster:**
- **midi's `restManager`** (`Hooks.ts:393,412-428`) fires on `dnd5e.restCompleted` and expires effects whose `flags.dae.specialDuration` includes `shortRest`/`longRest`. **Calendar-driven recovery does NOT fire `dnd5e.restCompleted`** — it triggers item recovery directly via `recoverUses`. So midi's rest-based effect expiry **doesn't auto-fire on calendar advancement**. That's a behaviour gap worth flagging: an effect set to expire on long rest will stay around if the player just advances world time without using the rest dialog.
- **Decision needed:** should midi's rest-based effect expiry hook into calendar day-advancement too? Probably yes for `longRest` (a "long rest until tomorrow morning" effect should expire when tomorrow arrives via time advancement). Likely no for `shortRest` (those are explicit player actions).
- **Implementation sketch:** when #6233 lands, midi listens for the calendar-recovery chat message hook (or whatever event dnd5e fires) and runs `restManager`'s `longRest` branch when calendar advances `day`.
- This is **not** a "principle / converge" question — it's filling a gap, not consolidating a parallel implementation.

**Sub-cluster D (bastions, #6591/#5647) — zero impact.** midi doesn't manage bastions.

### Cross-cutting principle application

No parallel implementations to converge:
- **Spellcasting helper, scale values, bastions** — pure additions, no midi/DAE parallel
- **Calendar recovery** — a *gap* to fill, not a parallel to converge. midi needs a new hook into a system area it doesn't currently cover (effect expiry on calendar-driven day-advancement), not consolidation of duplicate code.

The principle isn't applicable here because nothing was being duplicated.

### Reconciliation plan (act when each PR lands)

1. **DAE — none.** No code changes for any sub-cluster.
2. **midi — one substantive item:** when #6233 lands, decide whether to extend `restManager` (or add a parallel `calendarManager`) to handle effect expiry on calendar day-advancement. Hook into dnd5e's time-passage trigger and run the `longRest` branch (and possibly `newDay` branch) of the existing expiry pipeline. Document the behavior clearly so users understand which expiry events fire from rest dialog vs world time advancement.
3. **Sample items:**
   - When #5210/#5845 ship, audit sample items using item uses with recovery periods — opportunity to use the new uses scale value type for cleaner authoring.
   - When #5209 ships (sparse scale values), dnd5e's migration handles existing pack-source data; no manual work needed but verify pack-recompilation post-migration produces clean output.
4. **DAE migration framework** (CLAUDE.md item 14): no new entries needed for this Item.

### Open questions / decisions needed

- **#6233 hook surface:** what event/hook does dnd5e fire when calendar-driven recovery runs? midi needs a name to listen on.
- **#6233 ↔ midi rest manager interaction:** does dnd5e's calendar recovery emit a `dnd5e.restCompleted`-equivalent event for `longRest` semantics, or only item-recovery deltas? Affects whether midi's hook is "listen to dnd5e's event" vs "register a separate world-time listener".
- **#5845 recovery formulas referencing scale values:** does midi's any-rest-mocked-out test path correctly resolve `@scale.X.Y` references in recovery formulas? Likely yes (rolling uses `actor.getRollData()` which includes scale values), but worth a smoke test.
- **#2291 "new day without rest":** related; covered by #6233's calendar driver.

### Net assessment
- **DAE — zero impact.** None of the four sub-clusters touch DAE territory.
- **midi — one substantive item** (calendar day-advancement → rest-based effect expiry hook for `longRest`), plus opportunities (use scale values in new sample items; optionally adopt `Actor#spellcastingAbility` helper).
- **Sample items — small opportunities** (uses scale value type for class features; sparse-storage migration auto-handled).

The four sub-clusters together are the cleanest in the review after Items 11 and 13 — no parallel-implementation reconciliation, one minor gap-fill item, no behavioral conflicts.

---

# Review complete — synthesis

**All v6 milestone items grouped under #122 are now analysed.**

### Summary by Item

| Item | Topic | DAE impact | midi impact |
|---|---|---|---|
| Finding 0 | Async `Activity#getApplicableEffects` (#6800) | none (different API) | concrete touch-points; migrate by 6.2 |
| 1 | Auto-expire AEs (#6837) | already version-gated; transfer-effect risk to verify | minimal |
| 2 | Base AE data model + rider statuses (#5941) | one-line guard generalisation | re-evaluate `isAppliedEnchantment` patch |
| 3 | Non-persisted base fields (#6631/#6687) | guard the unguarded encumbrance overrides | autocomplete refresh |
| 4 | AE origins on system data (#6626) | depends on compat shim | depends on compat shim |
| 5 | Rule AE / conditional changes (#6315) | low (mode dropdown) | **high — strategic translate** |
| 6 | Phases + item-derived props + token-size sync | DAE already phase-aware; #6676 retires ATL.width caveat | none |
| 7 | Consumable + rest expiry (#6618, #6619) | small migration table additions | minor (existing system already covers both) |
| 8 | FiltersField + stock effects | zero (defer to native input) | strategic translate (same as Item 5) |
| 9 | Auras / emanations / apply-effect behaviors | one verification (`getItemFromEffectOrigin` regex) | **biggest reconfig** — gate today's attachToken to <6.0, defer to native #6783 |
| 10 | Canvas/templates/region-behaviors infrastructure | zero | required: `AbilityTemplate` → `TemplatePlacement` before 6.2 |
| 11 | Sense-driven token vision (#4698/#6864) | zero (strict-superset split) | zero (encourage sense-only authoring) |
| 12 | Dice/damage/AC overhaul | one cleanup (`ac.calc` override) | verification (crit + AC) |
| 13 | Compatibility removal (#6888) | **zero (already clean)** | **zero (already clean)** |
| 14 | Misc (spellcasting/scale/calendar/bastions) | zero | one new hook (calendar→rest expiry) |

### Where the work concentrates

- **midi-qol — Items 5, 8, 9 carry the strategic decisions.** All three involve dnd5e shipping infrastructure that overlaps midi's existing flag/behavior systems. The cross-cutting principle (added 2026-05-31) commits to *translate / defer to native / migrate* over indefinite coexistence; per-item analyses already align with the principle.
- **midi-qol — Items 10 and 12 carry the required code migrations.** `AbilityTemplate.fromActivity` → `TemplatePlacement.fromActivity` (before 6.2); `DAEdnd5e.ts:375` `ac.calc` override version-gate.
- **midi-qol — Item 14 carries the gap-fill.** Calendar-driven recovery doesn't fire `dnd5e.restCompleted`, so midi's rest-based effect expiry needs a calendar hook for `longRest` semantics.
- **DAE — Items 2, 3, 12 carry the minor cleanups.** Each is a single-line change once the relevant PR lands.
- **DAE — Item 9 carries the verification.** `getItemFromEffectOrigin` regex against RegionBehavior UUIDs.
- **Items 6 (#6676), 11 (#6864), 13 (#6888) are unambiguous wins** — retire DAE's ATL.width exemption, simplify vision authoring, validate v5.x deprecation discipline.

### Action queue ranked by urgency

1. **Track #6783 and #6822** (Item 9) — direct overlap with today's just-shipped midi `attachToken` feature. Plan version-gate when PR is close to merge.
2. **Track #6837** (Item 1) — verify shipped transfer-effect deletion semantics against DAE's disable-not-delete policy.
3. **Track #6800 and #6778** (Finding 0, Item 10) — both have 6.0→6.2 compat windows; midi must migrate before 6.2.
4. **Track #6315 and #6671/#6672/#6821** (Items 5, 8) — strategic translate plan, no rush, but plan UX.
5. **Track #6864** (Item 11) — sample-item authoring guidance shift; zero code work.
6. **Track #6888** (Item 13) — confirm DAE/midi remain clean as final shape stabilises; no code work expected.

### Process notes for next pass

- The cross-cutting principle table near the top is the index. When v6 ships, walk that table to drive the convergence work.
- Each Item's "Reconciliation plan" subsection is the concrete checklist for that area.
- Each Item's "Open questions / decisions needed" lists what needs clarification from the shipped PR before code changes can land.
- Memory pointer at `~/.claude/projects/.../memory/project_dnd5e_v6_impact_review.md` carries the doc location and the principle for cross-session continuity.

This document is **dormant** until v6 ships. On the v6 cutover, walk the table, address open questions, then act on each Item's reconciliation plan in priority order.
