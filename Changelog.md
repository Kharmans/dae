### 14.6.8
* Fixed: with Dependent Conditions on, updating an existing monster or character in ddb-importer could stop with "ActiveEffect dnd5einvisible00 does not exist": DAE adds and removes the conditions within the change that causes them, so they are in place when it completes. An actor created with items carrying a status (imported, dragged from a compendium) now gets their conditions.
* Fixed: a condition immunity set on the actor itself (not by an effect) didn't remove a condition DAE added; it does now.

### 14.6.7
* Added: a field mapping key may have `*` for one path segment, which the new key takes (`flags.midi-qol.optional.*.ac` → `flags.midi-qol.optional.*.acOnAttack`).

### 14.6.6
* Changed: DAE has moved to GitHub (https://github.com/tposney/dae): updates and downloads come from its releases, and issues are reported there. Installed copies move over with this update. Manifest URL: https://github.com/tposney/dae/releases/download/latest-dnd6/module.json.
* Updated: Brazilian Portuguese translation (thanks Kharmans).

### 14.6.5
* Changed: updates are served from GitLab Pages, so update checks no longer fail when GitLab rate-limits repository files. Installed copies move over with this update. Manifest URL: https://tposney.gitlab.io/dae/dnd6/module.json. Changelog: https://tposney.gitlab.io/dae/dnd6/changelog.html.

### 14.6.4
* Added: an effect can give the conditions its statuses cause values: `flags.dae.conditionFlags.<statusId>` holds flags that *Dependent Conditions* creates the condition with (merged from every active effect carrying that status) and keeps a condition it created in step with, e.g. `{ hiding: { "my-module": { dc: 17 } } }`.
* Fixed: DAE's API (`DAE`, `game.modules.get("dae").api`) was set in `setup`, after Foundry prepares world documents, so a module calling it during that first preparation got `DAE is not defined` (midi's `flags.midi-qol.optional.*` `ItemMacro`); it is now set in `init`.
* Fixed: the description of `system.attributes.concentration.roll.min` said maximum instead of minimum.
* Fixed: passive skills counted advantage from midi's flags on top of dnd5e's, so advantage from both added 10; missed `advantage.check.<ability>`; read the retired `advantage.ability.check.*`; and counted a flag holding a condition as true. Passive scores now combine midi's flags with dnd5e's roll modes as a skill roll does (once each way, with suppression and cancelling), counting only plainly true flags.

**Effect application**
* Changed: the compendium menu's three effect application entries and the item *Effect application* dialog are replaced by *DAE: Convert changes to Origin replacement* (Item and Actor packs, item and actor sheets): every change with no Replacement in an item's applied effects (not transfer effects or enchantments) is set to Origin, so it is filled from the caster as Legacy DAE did, after a confirmation. API `DAE.convertToOriginReplacement(document, { dryRun })`.

**Applied and item effects**
* Fixed: a `system.traits.size` change could only be Override; dnd5e 6's Add and Subtract (size steps, e.g. Add `1` turns Medium into Large) and Upgrade/Downgrade are now offered, with a number field for Add/Subtract and the size list otherwise.
* Fixed: a vehicle tool's proficiency (`system.tools.air/land/space/water.value`) could only be Override; Add, Upgrade and the other types are offered, as for other tools.
* Fixed: in dnd5e application, a change with no Replacement left DAE's workflow references for the target: `@itemUuid`, `@itemId` and `@utilityRollTotal` stayed as text, and `@tokenUuid`, `@token` and `@actorUuid` were the target's. They are now filled from the caster and the workflow when the effect is applied, as with Origin or Legacy; `##tokenUuid` and `##actorUuid` are the target's, as written.
* Fixed: a change using `@targetUuid` more than once had only the first replaced, and `@targetActorUuid` (or any reference starting `@target`) was corrupted into the target's token id; every target reference is now replaced and `@targetActorUuid` is the target actor's uuid.
* The effect editor no longer reports DAE's workflow references (`@itemUuid`, `@utilityRollTotal`, ...) as unknown.
* Fixed: an effect added to or duplicated on an item had its `##` references turned into `@` at once, so they were later filled from the caster (Legacy, Origin) instead of left for the target; `##` is now converted only on an effect being applied (to an actor, or an applied enchantment).
* Fixed: an item change (an enchantment, e.g. `system.description.value`) turned `@UUID[...]` links into `##UUID[...]`; the links are now kept.
* Fixed: an effect expired under *Mark Expired*/Suppress (disabled, kept) gave its macro's "off" call `expiry-reason` `effect-disabled`; the call now gets the expiry's own reason (a special duration, `duration-expired:<event>`), as a deleted effect's does.
* Fixed: creating an effect on a creature whose token isn't drawn (another level, a scene not being viewed) logged `_preCreateActiveEffect Cannot read properties of null` and skipped preparing the effect's change values; DAE now prepares them without a drawn token.
* Fixed: an effect whose duration ran out with time passing outside combat reported `expiry-reason` `duration-expired:turnStart` (the Turn Start expiry dnd5e gives every finite duration); the reason is now `duration-expired:updateWorldTime`.

### 14.6.3

**Applied and item effects**
* Fixed: an effect applied from a temporary item (a CAT/CPR synthetic roll, a used-up consumable) lost its macro changes (`macro.actorUpdate`, `macro.itemMacro`, …).
* Fixed: an applied effect with an expiry event but no duration took the activity's duration (a Turn End effect from a 1-minute spell lasted a minute); it now inherits only when it has neither.

**Effect expiry**
* Fixed: an effect whose own *Expiry Mode* is Suppress was flagged expired under *Mark Expired*, so dnd5e deleted it once out of combat; it is disabled instead.
* Fixed: an effect's own *Expiry Mode* was missed or misapplied when expiry refreshes overlapped (a combat turn also advances world time), and a delete or update made during a refresh could be taken for an expiry; it now applies to just the effects that refresh expires, and also under *Do Nothing*; a dependent ending with its concentration is deleted, not suppressed.
* Fixed: a duration in rounds or turns ending at Round End, or at a Turn End on the round's last turn, ended a round (or turn) early: the new round's world time advance counted first. A 1-round Round End effect ends at the end of the round after its duration has run out.
* Fixed: migrating deprecated special durations gave the expiry to combatEnd over a source/target entry, which was then left doing nothing; and kept an entry the expiry already held (combatEnd on an effect with a duration stays).
* Fixed: opening an effect in the editor replaced its expiry event with a deprecated special duration (Target Turn Start + combatEnd became Combat End).
* Fixed: a deprecated combatEnd became the expiry event of an effect with a duration, so 1 minute + combatEnd lasted until the combat ended; it stays a special duration.
* Fixed: a special duration didn't end an effect under concentration when the two durations were in different units (rounds and minutes).
* Fixed: `hasExpiry`/`hasDuration` were false for an effect with only an expiry event and true for one with no duration.
* Fixed: *Expire Round Effects on Combat End* could delete an effect dnd5e was already deleting, and ended round effects from another combat when a combatant left.
* Fixed: an applied effect storing Elapsed Time and no duration never ended; it takes the activity's duration.
* Fixed: a source/target expiry without a duration lost its label ("Your Turn Start") in effect lists and tooltips.
* Fixed: an applied effect with no duration or expiry event didn't take the activity's expiry event, as dnd5e does.

### 14.6.2

**Breaking for macro and item authors** (details and examples: README, [Upgrading to 14.6.2](https://gitlab.com/tposney/dae/-/blob/dnd6/Readme.md#upgrading-to-1462))
* An applied effect's `origin` is the caster's concentration effect, else the activity, not the item. Use `DAE.getEffectSource(effect)`, `DAE.getEffectItem(effect)` or `DAE.effectMatchesSource(effect, uuid)`.
* Applied effects no longer carry `flags.dae.itemData`; use `DAE.getEffectItemData(effect)`. `flags.dae.applicationData` keeps only damage, critical and fumble.
* During data preparation use `DAE.getEffectItemData`; `DAE.getEffectItem` returns `undefined` there for a deleted item.
* `lastArg.origin` is deprecated: use `lastArg.source`.
* `DAE.doActivityEffects`/`doEffects`: pass concentration as `concentrationUuid`; an `origin` goes in the `system.origin` slot for its type.
* `flags.dae.deleteOrigin` applies only to transfer effects; `deleteActiveEffect`, `deleteItemActiveEffects` and *Unique by origin* match by the effect's source.

**Applied and item effects**
* Fixed: `ATL.width`, `height`, `depth` and `shape` were deleted from effects; they become `token.*` size changes, which dnd5e 6 applies. `ATL.elevation`, `hidden` and `rotation`, which Foundry v14 can't apply, are kept instead of deleted.
* Added: `dae.eval(…)` in a dnd5e formula field (HP bonuses, roll bonuses and the like) is evaluated when dnd5e evaluates the field, with its full roll data, so it can use derived values such as `@abilities.dex.mod` (e.g. `dae.eval(@abilities.dex.mod > 2 ? 2 : 0)` in an attack bonus). In number fields and flags it is still evaluated when the change is applied. `dae.eval` works in any formula (midi-qol [#1565](https://gitlab.com/tposney/midi-qol/-/issues/1565)).
* Added: the effect editor flags a conditional (`? :`) in a number or formula field, pointing to the change's conditions or `dae.eval(…)`; on Foundry 14 a bare conditional is not a valid formula (midi-qol [#1565](https://gitlab.com/tposney/midi-qol/-/issues/1565)).
* Fixed: the effect editor offered dnd5e 5's `system.attributes.concentration.bonuses.save` for the concentration save bonus; it offers `system.attributes.concentration.roll.bonus`.
* Fixed: an activity whose item is not on the actor applied none of its effects on dnd5e 6: a consumable used up by its last use (e.g. a potion), and cloned or temporary items (contested grapple, metamagic casts).
* Fixed: effects with the pre-release `flags.dae.legacyApplication` (midi's sample items in 14.6.0–14.6.2) were applied in dnd5e mode; they are now applied in legacy mode, with a deprecation warning. Use `flags.dae.applicationMode`.
* Fixed: a boolean `flags.dae.stackable` (DAE's original checkbox) was treated as stacking; `false` now means *none* and `true` *multi*, with a deprecation warning.
* Fixed: a deprecated (mapped) change key was reported every time an actor was prepared; it is reported once per key.
* Added: the change dialog marks a deprecated key with the key to use and a Convert link.
* Removed: the custom handling of `system.traits.sdi/sdr/sdv.all` (dnd5e has no such traits) and of `system.traits.da.all`, which midi now maps to `system.traits.da.value` ALL. `system.traits.di/dr/dv.all` remain deprecated keys that add ALL to `….value` whatever their change type, and are no longer offered in the field browser.

**Effect source**
* Changed: applied effects record their source in `system.origin` as dnd5e 6 does (the activity, or the item without one; the caster's concentration; the card; the effect profile), so their `origin` is the concentration effect, else the activity. Pass concentration as `concentrationUuid`; an `origin` passed to `doActivityEffects`/`doEffects` goes in the slot for its type.
* Changed: applied effects no longer carry a copy of their item (`flags.dae.itemData`); its data comes from the live item, else from the card: dnd5e's copy of an item the use consumed, or one DAE adds when an item that applied effects is deleted later. `flags.dae.applicationData` keeps only damage, critical and fumble.
* Added:
  * `DAE.getEffectSource(effect)` → `{ actorUuid, itemUuid, activityUuid, controllingEffectUuid, sourceEffectUuid, messageUuid }`
  * `DAE.getEffectItem(effect)` → the effect's Item: the live item, else one built from its data (a few ms the first time, then cached). Use it for the item's prepared values or methods. Not during data preparation: building an item there re-enters it, so a deleted item not yet built gives `undefined` (with a console warning); use `getEffectItemData`.
  * `DAE.getEffectItemData(effect)` → the item's stored data (a copy while the item exists). Never builds a document: use it when stored values are enough, and always during data preparation, where building an item re-enters preparation and prepared values aren't final.
  * `DAE.getMessageItemData(message)` → a card's item data (`message` a ChatMessage or its uuid)
  * `DAE.getActorItemData(actor, uuid)` → the data of an item (by its uuid or one of its activities' or effects') from the effects it applied to the actor
  * `DAE.effectMatchesSource(effect, uuid)` → whether the effect came from that item, activity, item effect or concentration effect
* Added: macro `lastArg.source` and `lastArg.systemOrigin`. Deprecated: `lastArg.origin`, which keeps its old value.
* Changed: `deleteActiveEffect` and `deleteItemActiveEffects` match an effect's item, activity, source effect or concentration effect (Slayer's Prey left the old target marked).
* Changed: *Unique by origin* stacking matches the item effect an effect was copied from.
* Changed: `flags.dae.deleteOrigin` applies only to transfer effects.
* Changed: an effect applied without a chat card has its `@item` references filled in when applied.

Cost per call (µs, dnd6, Bless applied):

| | Item exists | Item deleted |
|---|---|---|
| `getEffectSource` | 0.3 | the same (reads only uuids) |
| `getEffectItem` | 2.4 (the live item) | 3,600 the first time (builds the Item), then 1.75 (cached) |
| `getEffectItemData` | 32 (copies the data) | 2.1 (the card's copy) |

### 14.6.1
* Requires Foundry 14.369 and dnd5e 6.0.6.

**Breaking**
* Breaking: midi-qol optional bonus keys without a roll type suffix (`flags.midi-qol.optional.NAME.save`) are no longer changed to `.save.all`; edit such effects to use `.all`.
* Breaking: `@data.` in effect values and inline rolls is no longer read as `@` (deprecated since Foundry 0.8); use `@abilities…` etc.

**Effect keys and macros**
* Fixed: a `macro.itemMacro`, `macro.activityMacro` or `StatusEffect` change was dropped when another change in the same effect had an inline roll or `@actorUuid`/`@tokenUuid` replaced.
* Fixed: `macro.actorUpdate` ignored a value of 0 or false; did not restore the original value on removal unless an undo argument was given; `each` lost the original value and ignored the current one; and dice in the value were not rolled.
* Fixed: `macro.createItemRunMacro` called the created item's macro with `on` instead of `onCreate`.
* Fixed: `system.attributes.movement.hover` with the text `false` turned hover on.
* Fixed: `system.tools.all` added entries for tool categories, which stopped the actor preparing.
* Fixed: a `DamageBonusMacro` of `ActivityMacro` used the item's macro instead of the effect's activity.
* Removed: copies of the activity macro into effect flags that nothing read.
* Fixed: `token.*` keys (light, sight, texture, disposition, ring…) were missing from DAE's change key list on Foundry 14; detection modes other modules register also get `.enabled` as well as `.range`.
* Fixed: a `bonuses.abilities.check has moved` warning on every actor update.
* Fixed: custom `system.abilities.<id>.bonuses.save/check` changes threw and did not apply; custom `system.tools.*` changes stopped the actor preparing.
* Condition builder presets use dnd5e 6's `movement.speeds.walk` and `senses.ranges.darkvision`.

**Applied and item effects**
* Fixed: applied effects were marked dependent on their source item's effect, so dnd5e 6 did not remove them on a rest or when their actor left combat. They are now dependent only on an effect on an actor (such as concentration), and are no longer removed when the source item is deleted.
* Fixed: an effect applied with an activity as its origin lost `system.origin.activity`, which dnd5e uses to find what an activity applied.
* Fixed: adding or removing an item with an Active Auras aura set to ignore its source stopped DAE processing that item's remaining effects.

**Enchantments**
* Removed: the times-up check before setting an applied enchantment's start time (times-up does not run on Foundry 14).
* Fixed: saving an applied enchantment in DAE's effect editor turned *Apply Enchantment to Item* off, removing it from the item.
* Fixed: an applied enchantment whose special duration expired (e.g. *Join Combat*, *Combat End*) was disabled instead of deleted.
* Fixed: with dnd5e 6, an applied enchantment's macro and status changes acted on its item's owner; as on dnd5e 5.x, it now changes only its item.
* Fixed: an enchantment's change whose key DAE applies to actors in the final phase (e.g. `flags.midi-qol.onUseMacroName`) was skipped on the item unless the change's phase was set to final.

**Expiry and durations**
* Fixed: DAE warned that an effect's `combatEnd` special duration was deprecated even when the effect's expiry was already set to another event, which leaves `combatEnd` nowhere else to go (midi's reaction and bonus action markers).
* Changed: outside combat, time passing now ends an effect whose expiry event has no duration (e.g. *Turn Start*, or dnd5e's *Target Turn End*), as Foundry does; only *Combat Start* waits for a combat.
* Changed: the *Elapsed Time* expiry is retired. Applied effects that take the activity's duration get no expiry event, so dnd5e 6 gives them *Turn Start* in combat; an effect that stores Elapsed Time is treated as having no expiry event.
* Fixed: a *Turn Start* or *Turn End* effect never expired once the combatant whose turn it waited for had left the combat.
* *Expire Round Effects on Combat End* no longer ends effects whose duration is in time units (minutes, hours...).
* Changed: *Source/Target Turn* expiries keep a duration, which dnd5e 6 drops: "3 rounds, *Target Turn Start*" ends at the target's turn once 3 rounds have passed, as on dnd5e 5.x. With no duration it is still the next such turn. The effect list and tooltip show the rounds left ("2 Rounds, then Start of Your Next Turn").

**Effect editor**
* Fixed: DAE's effect editor would not open for a change whose key has a numeric forced mode (such as midi's ActivityOverTime, registered with -1).
* Fixed: DAE's effect editor skipped its base sheet's render step, so read-only viewers got an editable-looking form and dnd5e's sheet handling (such as hiding duration fields an expiry cannot use) did not run.

**Foundry 14 compatibility**
* Deletions use Foundry 14's `ForcedDeletion` instead of the `-=` key syntax, which Foundry 14.369 warns about.

**Removed**
* Removed: warnings for pre-v10 `data.` change keys, and the fix for pre-v10 `OwnedItem.` effect origins.
* Removed code that could not run on Foundry 14 / dnd5e 6 (no behaviour change).
* Removed the unused *Just Icon* setting.

### 14.6.0 (dnd6 branch)

**Requirements**
* dnd5e 6.x only: `module.json` declares dnd5e 6.0.0 to 6.999 (verified 6.0.5), and support for every other system has been removed.
* Requires Foundry 14.368 (verified 14.368).

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
* An effect on an item (other than an enchantment) gets the actor field list again; the sheet reported "No valid specs found" and offered no keys.
* Bare dice in a field that is worked out without dice when the actor is prepared - a number field, or a deterministic formula field such as `system.attributes.ac.bonus` or `system.attributes.hp.bonuses.overall` - are changed to a silent inline roll (`+1d8` becomes `+[[[1d8]]]`), so they are rolled once: when an applied effect is created, or for a passive effect when its item reaches an actor. This happens in the change dialog (with a note saying so) and when an effect is created or edited on an actor or owned item, so stored values such as `+2d8` on max HP work too; previously they counted as 0. Only the dice term is wrapped, so references stay live. Dice that cannot be wrapped, such as `(@details.level)d6`, are kept with a warning. Roll-time formula fields (attack, damage, check and save bonuses) keep their dice.
* New per-change option "Also raise current HP" for `system.attributes.hp.tempmax` and `system.attributes.hp.max` add changes (change dialog): when the change starts applying - the effect is created on a token's actor, or its item is gained - current HP rises by the same amount (an inline roll's rolled total), once per effect, so re-enabling or re-equipping does not heal again. When it stops applying, current HP above the new maximum is lost; damage taken meanwhile stands. It never lowers current HP. An unlinked NPC token placed with its hit points rolled (dnd5e's *Roll NPC hit points*) starts at the roll plus its marked bonuses.
* Readme: a *Maximum hit points* section - `hp.tempmax` for any creature, `hp.bonuses.overall` for a character's calculated max, `hp.formula` for an NPC's rolled hit points, `hp.max` OVERRIDE for a fixed max; `hp.max` ADD replaces a calculated max.
* `system.attributes.hp.bonuses.overall` and `.level` are dnd5e's formula fields again; DAE had replaced them with a text field. The change dialog notes on `system.attributes.hp.max` that a change there replaces a character's calculated max, and points to `hp.tempmax` (any creature, as dnd5e's Aid does), `hp.bonuses.overall` (a character's calculated max) and `hp.formula` (extra rolled hit points when an NPC token is placed).
* The effect sheet is dnd5e's own, with a DAE tab: the effect-level and per-change Conditions fields, its header and its changes UI are back.
* Changes are edited in dnd5e's change dialog, with DAE's field browser, value lists and mode restriction added to it.
* The change value field offers `@` references when you click into it empty or press Ctrl+Space (with formula functions in a number or formula field), and notes under the field a reference no actor's data has (e.g. `@abilites.str.mod`) or, for a number or formula field, a value that is not a formula. Saving is not blocked; references that depend on the item, activity, classes, flags or the roll (`@item`, `@scale`, `@mod`, ...) and enricher links are not checked.
* Condition builder: a button beside dnd5e's filter button on per-change and effect-level conditions opens a form of nested groups (All of, Any of, None of, Not all of, XOR) with comparison rows, path autocomplete, a common fields menu (statuses, creature, ability scores and modifiers, attributes, health, defences, level, and the item for item effects), value pickers from dnd5e's lists (statuses, creature types, sizes, damage types, spell schools...) and a live pass/fail on the actor. It writes dnd5e's filter JSON and declines conditions it cannot show.
* Change keys and values autocomplete in Foundry's own menu: keys by category with their name and description; values complete `@` references a segment at a time, and formula functions for number and formula fields. The full-width field browser with category tabs is gone.
* The change dialog offers the registered value editors (DIME for macros, midi's OverTime and condition editors), and edits macro source in a multi-line box that keeps its line breaks.
* The change dialog shows the phase a change is applied in, read-only, under dnd5e's label and hint; saving leaves the stored phase as it was.
* Set-based fields on an actor's effects (`system.damage.base.types` and other item/activity Set fields) are no longer locked to override - they default to add with every mode selectable. 14.0.13 fixed this for item and enchantment effects only.
* Change modes are no longer restricted for fields with a value picker; v14 implements all six modes on Set fields, so only the default is set.

**Special durations**
* An effect whose `flags.dae.enableCondition` becomes false ends as an expired effect does: deleted, or under the *suppress* expiry mode (world setting, or the effect's own) disabled, and enabled again when the condition holds. An effect disabled by hand is not re-enabled.
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
* Dependent effects (e.g. of concentration) follow their parent being disabled or suppressed when the parent's actor has no token on the scene, and when a player toggles their own effect whose dependents they cannot update (the GM updates those).

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
* Fix TypeError when `customStats` is not iterable in `isSuppressed` for Group actors without `system.traits.ci.custom` (MR [!157](https://gitlab.com/tposney/dae/-/merge_requests/157), thanks @thatlonelybugbear).
* Correct descriptions for shimmed enchant keys — swap `system.damage.bonus`/`system.damageBonus` descriptions and replace "Should use … instead" with "Equivalent to …" for attack shim keys (MR [!159](https://gitlab.com/tposney/dae/-/merge_requests/159), thanks @Michael Roth).
* `@activity` is now available in AE change value formulas when effects are applied via an activity (inspired by MR [!156](https://gitlab.com/tposney/dae/-/merge_requests/156), thanks @thatlonelybugbear).
* Fix for token.xxxx effects not working.

### 14.0.0
* Added ability to specify source or target combatant in effect duration fields
* Foundry v14 showIcon replaces dae's show icon on active effects.
