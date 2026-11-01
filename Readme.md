![](https://img.shields.io/badge/Foundry-v14-informational)
![](https://img.shields.io/badge/dnd5e-informational)
![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fdae&colorB=4aa94a)

Discord <a href="https://discord.gg/Xd4NEvw5d7"><img src="https://img.shields.io/discord/915186263609454632?logo=discord" alt="chat on Discord"></a>

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/tposney)

# Dynamic effects using Active Effects (DAE)

This is the readme for the **Foundry v14** release of DAE (the `v14` branch). The dnd6 release (the `dnd6` branch) is written only for dnd5e 6 and has its own readme.

If you have a problem, please read the [Issues](#issues) section before reporting a bug. There is a discord server for my modules where you can get lots of help: https://discord.gg/Xd4NEvw5d7

## Contents
- [Installation](#installation)
- [What does DAE do?](#what-does-dae-do)
- [Active effect basics](#active-effect-basics)
- [Editing effects](#editing-effects)
- [How changes are applied](#how-changes-are-applied)
- [Applied effects: values from the caster](#applied-effects-values-from-the-caster)
- [Maximum hit points](#maximum-hit-points)
- [Stacking](#stacking)
- [Effect expiry](#effect-expiry)
- [Enable and disable conditions](#enable-and-disable-conditions)
- [Macros](#macros)
- [Special DAE keys](#special-dae-keys)
- [dnd5e key notes](#dnd5e-key-notes)
- [Settings](#settings)
- [API and hooks](#api-and-hooks)
- [Module integrations](#module-integrations)
- [Issues](#issues)

## Installation

Install DAE from the in-game add-on browser. To install it by hand, paste this manifest URL into *Install Module*:

`https://github.com/tposney/dae/releases/download/latest-v14/module.json`

Requirements:
- Foundry **14.368** or later (v14).
- The **libWrapper** and **socketlib** modules. Foundry offers to install them with DAE.
- The dnd5e system.

There is also a release written only for dnd5e 6: `https://github.com/tposney/dae/releases/download/latest-dnd6/module.json`.

DAE is written for dnd5e and other systems are not supported. The *Load DAE for untested game systems* setting lets it load in another system anyway, at your own risk; systems known to be incompatible (e.g. pf2e) never load it.

## What does DAE do?

Foundry's own active effects do most of what many games need, so try them first: you may not need DAE at all. DAE builds on them. Every core effect is also a DAE effect, and DAE adds:

- **Calculated values.** A change can use `@` references to the actor's data, arithmetic and dice, e.g. `@abilities.wis.mod` or `ceil(@classes.rogue.levels/2)`.
- **Help with keys.** A field browser and autocomplete for change keys, which also sets the right change type and the right moment to apply each one.
- **Effects applied to targets.** With midi-qol, using an item or activity applies its effects to the targets, with values taken from the caster.
- **Macros.** Run a macro when an effect starts or ends, or at the start or end of each turn.
- **Special durations** such as "until the next attack" or "until damaged" (most need midi-qol).
- **Stacking rules**, so a second application can replace, count or add to the first.
- **Conditions** that disable or end an effect when an expression changes.
- **Temporary items** that exist only while an effect lasts, and **actor links** that react when one linked actor changes.

## Active effect basics

If you already know Foundry's active effects, skip to [Editing effects](#editing-effects). For more detail:
- [Active Effects](https://foundryvtt.com/article/active-effects/): Foundry's knowledge base article;
- [Active Effects](https://github.com/foundryvtt/dnd5e/wiki/Active-Effects): the dnd5e system wiki, how dnd5e uses effects;
- [Active Effect Guide](https://github.com/foundryvtt/dnd5e/wiki/Active-Effect-Guide): the dnd5e wiki's list of keys and the values they take;
- [Active Effects Primer](https://foundryvtt.wiki/en/development/guides/active-effects): the community wiki, aimed at macro and module authors.

**An effect** is a set of **changes** applied to an actor. Each change has:
- a **key**: the data it changes, e.g. `system.abilities.str.value`;
- a **type**: how it changes it, e.g. *add* or *override*;
- a **value**: e.g. `2`, or `@abilities.dex.mod`;
- a **priority**: the order changes are applied in.

The change `system.abilities.str.value` *add* `2` raises Strength by 2 while the effect is active. The actor's stored data is not altered, so removing the effect restores the original value.

**Where effects live.**
- An effect on an **actor** applies to that actor.
- An effect on an **item** is either:
  - a **transfer** (passive) effect, which applies to the actor that owns the item. A Ring of Protection's +1 to AC is a transfer effect.
  - an **applied** (non-transfer) effect, which does nothing until something applies it to a target. Bless is an applied effect: casting it copies the effect onto each target. midi-qol does this when you use an item or activity.

**Origin.** Each effect records its **origin**: the item (or actor) it came from. DAE uses it to find the caster for applied effects, for stacking, and for macros.

## Editing effects

### The effect sheet

DAE's effect sheet replaces the default active effect sheet. It has the core tabs and a **DAE** tab with:

- **Enable condition** (applied effects) and **Disable condition**. See [Enable and disable conditions](#enable-and-disable-conditions).
- **Stackable** (item effects): what happens when the effect is applied again. See [Stacking](#stacking).
- **Icon overlay**: show the effect's icon as a large overlay on the token.
- **Expiry mode**: delete or suppress this effect when it expires. *Default* follows the world setting. See [Effect expiry](#effect-expiry).
- **Duration expression**: a roll expression, in seconds, rolled for the effect's duration when it is created.
- **Macro repeat**: run the effect's macros at the start and/or end of each turn. See [Macros](#macros).
- **Special durations**: end the effect on an event, e.g. the next attack. See [Effect expiry](#effect-expiry).
- With midi-qol active:
  - *Apply to self when item applies target effects*;
  - *Apply to self when item is rolled*;
  - *Don't apply the effect*;
  - *Effect disabled if actor incapacitated*.

On the **changes** tab:
- The key field has autocomplete, and a field browser lists every key DAE knows, with a description. Picking a key sets its change type.
- Each change shows the **phase** it is applied in. This is read-only; see [How changes are applied](#how-changes-are-applied).

On the **duration** tab, *Reset start to now* restarts the effect's duration from the current time.

### Header controls

Actor and item sheets get entries in their header menu:
- **DAE** (actors and items): a list of all effects on the actor or item, including transfer effects from its items, with whether each is active and its remaining duration.
- **DIME** (items): the editor for the item's macro, used by `macro.itemMacro`.

Related settings:
- *DAE Title Bar* and *DIME Title Bar* show or hide the entries.
- *DAE Colorful Title Bar* turns them green when the document has effects or a macro.
- tidy5e item sheets get the same controls.

The actor's effects tab also gets a **Delete Expired Effects** button (a trash icon on its suppressed-effects section), which deletes the effects marked expired.

## How changes are applied

### Change types and priority

Foundry v14's change types, with their default priority:

| Type | Default priority | What it does |
|---|---|---|
| custom | 0 | handled by the system or a module; DAE handles many custom keys |
| multiply | 10 | multiplies a number |
| add | 20 | adds to a number; appends to a string or set |
| subtract | 20 | subtracts from a number |
| downgrade | 30 | keeps the lower of the current value and the change |
| upgrade | 40 | keeps the higher of the current value and the change |
| override | 50 | replaces the value |

Within each phase (see below), the changes on an actor are sorted by priority, lowest first, and applied in that order. For example, with Strength 15:
- `system.abilities.str.value` *add* `2` and *override* `19`, default priorities: the add (20) runs first, then the override (50). Strength is **19**.
- Give the add priority 100 and the override priority 10: the override runs first, then the add. Strength is **21**.

### Phases: before and after derived data

dnd5e calculates many values from others: ability modifiers from scores, skill totals, AC, spell DCs. Foundry v14 applies changes in two **phases** around that calculation:
- **initial**: before the calculation, on the actor's stored data (ability scores, bonuses, `ac.flat`, ...). A change here feeds into everything calculated from it, but it cannot use calculated values.
- **final**: after the calculation, for keys that need calculated values or are not stored data, such as DAE's own keys (e.g. `system.traits.di.all`, `system.attributes.movement.all`) and `system.spells.pact.level`. A change here can use calculated values, but nothing is recalculated from it.

You don't choose the phase: DAE knows which one each key needs and applies the change then. The effect sheet shows it, and the field list marks final-phase keys with `(*)`. A few old final-phase keys, such as `system.abilities.<abl>.mod` and `system.attributes.ac.value`, are marked `(Deprecated)` instead: use the bonus keys described in [dnd5e key notes](#dnd5e-key-notes).

### Values

A change value can be more than a plain number:

- **`@` references and arithmetic** are evaluated against the actor:
  - `system.abilities.str.value` *add* `@classes.barbarian.levels`
  - `system.bonuses.mwak.damage` *add* `(ceil(@classes.rogue.levels/2))d6`
- **Number fields** are evaluated when the actor's data is prepared.
- **Dice in a number field** are rolled **once**, when the effect is created or edited. This also applies to formula fields dnd5e works out without dice (AC bonus, HP bonuses, spell DC, movement). DAE turns `+2d8` into `+[[[2d8]]]`, an inline roll, so the total is fixed rather than rolled every time the actor is prepared.
- **Roll-time formula fields** keep their formula. Dice and `@` references are evaluated when the roll is made, against the rolling actor. Example: `system.bonuses.mwak.damage` *add* `1d4` adds a fresh 1d4 to each melee weapon damage roll.
- **Inline rolls** are rolled once:
  - `[[1d4+2]]` posts the roll to chat;
  - `[[[1d4+2]]]` rolls silently.
  
  In a transfer effect the formula stays in the effect and the total is stored for each actor, so every actor the item reaches rolls its own.
- **Expressions a roll formula can't handle**, such as `a ? b : c`: use `dae.eval(expression)`. (`dae.roll(expr)` is deprecated and becomes `[[[expr]]]`.)
  In a number field `dae.eval` is evaluated when the change is applied, so it can use stored values only (`@abilities.str.value`, not `@abilities.str.mod`). In a formula field (an HP, attack or save bonus) it is evaluated when dnd5e evaluates the field, so calculated values work: `dae.eval(@abilities.dex.mod > 2 ? 2 : 0)`. The effect sheet marks a bare `? :` in a number or formula field.
- **Numeric flags**: in a `flags.*` value that holds a number, `@` references and arithmetic are evaluated too.
- **`@tokenUuid` and `@actorUuid`** are replaced with the uuid of the actor's token and of the actor.

### Custom changes

A *custom* change on a key DAE does not handle goes to Foundry's `applyActiveEffect` hook, so you can add your own behaviour. For example, to put the average of the Strength and Dexterity scores into a flag:
```js
Hooks.on("applyActiveEffect", (targetDoc, change, current, delta, changes) => {
  if (change.key !== "flags.world.averageStrDex") return;
  const { str, dex } = targetDoc.system.abilities;
  foundry.utils.setProperty(targetDoc, change.key, Math.ceil((str.value + dex.value) / 2));
});
```
- `targetDoc` can be an actor, an item or a token document.
- A key like this is applied in the initial phase, before dnd5e calculates ability modifiers, so the example uses the scores (`.value`), not `.mod`.

## Applied effects: values from the caster

When an applied effect is copied onto a target, by midi-qol when an item is used or by `DAE.doEffects` / `DAE.doActivityEffects`, its values are worked out against the actor **applying** it (the caster), not the target:

- `@field` takes the value from the caster. A caster with Strength 18 applying `@abilities.str.mod` gives `4`, whatever the target's Strength.
- `##field` is not evaluated. It becomes `@field` on the target, so it refers to the target's own data.
- `@stackCount` (or `##stackCount`) is the effect's stack count; see [Stacking](#stacking).

For example, a curse applying `system.attributes.ac.bonus` *add* `-@abilities.cha.mod` lowers the target's AC by the **caster's** Charisma modifier. Written `-##abilities.cha.mod`, it would use the target's own.

An applied effect with no duration of its own takes the duration of the activity or item that applied it; see [Effect expiry](#effect-expiry).

## Maximum hit points

dnd5e works out a character's maximum hit points from class hit dice, Constitution and `system.attributes.hp.bonuses`, unless the character has a fixed maximum. NPCs and vehicles store their maximum. Which key to use:

| To | Use |
|---|---|
| Raise max HP on any creature, e.g. Aid | `system.attributes.hp.tempmax` *add* |
| Raise a character's calculated max HP, e.g. Tough | `system.attributes.hp.bonuses.overall` *add*, or `hp.bonuses.level` for a bonus per level |
| Give an NPC extra hit points when its token is placed | `system.attributes.hp.formula` *add*, e.g. `+ 2d8` |
| Set a fixed maximum | `system.attributes.hp.max` *override* |

Notes:
- `hp.formula` is rolled into max and current HP when an unlinked token is placed, if dnd5e's NPC *Hit Points* setting rolls them.
- `system.attributes.hp.max` *add* is **not** a bonus. On a character whose maximum is calculated it replaces the calculated value: a character with 12 max HP and `+5` ends up with **5**. Use the keys above instead.
- Dice in these fields (e.g. `+2d8` on `hp.tempmax`) are rolled once: when an applied effect is created, or when a transfer effect's item reaches an actor. All tokens of the same sidebar NPC share that roll; for a bonus rolled for each token, use `hp.formula`.

### Also raising current HP

Normally an effect that raises maximum HP leaves current HP where it is: a character at 20/20 who gets +5 maximum HP is at 20/25. Spells like Aid raise both, so the character ends up at 25/25.

To get that, add the change's key to the effect flag `flags.dae.raiseCurrentHp` (a list of keys). For example, Aid's effect has the change `system.attributes.hp.tempmax` *add* `5` and the flag `flags.dae.raiseCurrentHp` set to `["system.attributes.hp.tempmax"]`. The midi-qol Aid sample item is set up this way. It works only for *add* changes on `system.attributes.hp.tempmax` or `system.attributes.hp.max`.

What happens, using Aid (+5) on a character with 20 maximum HP:

| Situation | HP |
|---|---|
| Aid is applied at 20/20 | 25/25 |
| Aid is applied at 12/20 | 17/25 |
| Aid ends at 25/25 | 20/20: the extra hit points are lost |
| Aid ends at 14/25 | 14/20: damage already taken stays taken |

- The extra current HP is given **once** per effect. Turning the effect off and on again, or unequipping and re-equipping the item that carries it, does not give it again; otherwise you could heal by toggling it.
- Applying the effect never lowers current HP.
- For an unlinked NPC whose hit points are rolled when its token is placed, the extra hit points are added on top of the roll.

## Stacking

"Stacking" is what happens when an effect lands on an actor that already has a copy of it. Foundry itself doesn't check: cast Bless on the same target twice and it gets two Bless effects, so its attack rolls get +2d4 instead of +1d4. Usually you want the second casting to replace the first. For some effects, such as poison that gets worse with each dose, you want a single effect that counts how many times it has been applied.

DAE's **Stackable** setting, on the effect's DAE tab, says which of these you want:

| Setting | What happens when the effect is applied again |
|---|---|
| multi | Another copy is added; nothing is replaced. This is also what happens when no setting is chosen. |
| noneName | The new effect replaces an existing effect with the same name **from the same item** (origin). Bless from two different clerics gives two effects; the same cleric casting twice gives one. |
| noneNameOnly | The new effect replaces any existing effect with the same name, wherever it came from. Bless from two different clerics gives one effect. |
| none | The new effect replaces any existing effect from the same item, whatever its name. Useful when one item can apply several different effects and only the latest should remain. |
| count | No second effect is created. The existing one gets a stack count, shown in its name (e.g. `Poisoned (3)`), and its changes apply once per stack. Deleting it removes all the stacks. |
| countDeleteDecrement | As *count*, but deleting the effect removes one stack at a time; the effect goes when the last stack is removed. |

`noneName` and `none` only match effects that record the item they came from, so an effect added by hand (with no origin) is never replaced by them. `noneNameOnly` does replace it.

`@stackCount` in a change's value is the number of stacks, so a bonus can grow with them, e.g. `system.bonuses.mwak.damage` *add* `@stackCount`.

**Only the arriving effect's setting counts.** When an effect is applied, DAE looks at *its* Stackable setting to decide whether to replace what is already there. The settings of the effects already on the actor are ignored. So if the actor already has a *noneNameOnly* effect called Bless and a *multi* Bless arrives, the actor ends up with both: the new effect's *multi* says "keep the old one". Give every copy of an effect the same setting and this never comes up.

**Effects created together are all kept.** The check runs against effects already on the actor. If several matching effects are created in one go (for example by one macro call), none of them replaces the others.

## Effect expiry

DAE adds to Foundry's built-in effect expiry.

### Duration and expiry event

An effect's **duration** tab has:
- a **duration**: a number and its units (seconds to years, or rounds and turns);
- an **Expiry** event: when the expiry is checked.

When the effect is created on an actor, its start is recorded: the world time and, if a combat is running, the combat, round and turn, and the combatant whose turn it is.

How durations count down:
- Time units (seconds and up) count down as world time advances.
- Rounds and turns count down in combat.
- Outside combat a round counts as 6 seconds of world time (dnd5e). A duration in turns has no time equivalent outside combat, so it ends as soon as world time advances.

An effect expires when **its duration has run out and its expiry event happens**:

| Expiry | The effect expires |
|---|---|
| none | as soon as the duration runs out |
| Turn Start / Turn End | at the start or end of the turn of whoever was acting when the effect was created (usually the caster), once the duration has run out. An effect created outside combat, or before the combat started, uses the affected actor's own turn |
| Round Start / Round End | at that point in the round, once the duration has run out. Foundry counts the new round before Round End fires, so *1 round, Round End* ends at the end of the round it was created in |
| Combat Start / Combat End | when combat starts or ends, once the duration has run out. Use Combat Start without a duration: with one, the combat has already started before the duration runs out, so the effect never expires |
| Elapsed Time (DAE) | as soon as the duration runs out, in or out of combat |
| Source Turn Start / End (DAE) | at the start or end of the turn of the actor that applied the effect |
| Target Turn Start / End (DAE) | at the start or end of the affected actor's turn |

Details:
- When a duration is set, the expiry defaults to *Turn Start*. For the affected actor's own turn, use *Target Turn Start/End*.
- An effect created in combat with a duration in rounds or time units and no expiry event is given *Turn Start* (as dnd5e 6 does), so a 1-round effect lasts until that turn in the next round rather than ending as the round turns over.
- An expiry event **without a duration** ends the effect at the first such event. Example: "until the start of your next turn" on a target is no duration, *Source Turn Start*.
- The Source and Target events skip the turn the effect was applied in.
- Outside combat, time passing counts as every expiry event except Combat Start: the effect ends once its duration has run out, or as soon as time passes if it has no duration.
- Expiry is checked by the GM's client, when world time advances and at each combat event.

Which effects have durations:
- **Applied effects** with no duration of their own take the activity's or item's duration, with no expiry event (so *Turn Start* in combat).
- **Transfer effects** stay passive: a duration on a transfer effect does not count down. Put durations on applied effects.

### Special durations

A special duration ends an effect when something happens, as well as (or instead of) its duration; whichever comes first. Choose them on the DAE tab.

DAE provides *Joins Combat*: the effect ends when the actor joins a combat.

midi-qol adds the rest:
- **Actions**: 1Action, Bonus Action, Reaction, Turn Action, 1Spell, 1Reaction.
- **Attacks by the actor**: 1Attack, 1Hit, 1Miss (also per attack type), 1Critical, 1Fumble.
- **Things done to the actor**: isAttacked, isHit, isHitCritical, isMissed, isDamaged (also per damage type), isHealed, zeroHP.
- **Damage dealt**: DamageDealt.
- **Rolls**: isSave, isSaveSuccess, isSaveFailure, isCheck (also per ability), isSkill (also per skill), isInitiative, isConcentrationSave, isConcentrationSaveSuccess, isConcentrationSaveFailure.
- **Other**: isMoved, Long Rest, Short Rest, New Day.

Without midi-qol only *Joins Combat* is available.

**Older effects.** Effects made with the old special durations turnStart, turnEnd, turnStartSource, turnEndSource or combatEnd are converted when they are created:
- The first one becomes the expiry event: *Target Turn Start*, *Target Turn End*, *Source Turn Start*, *Source Turn End* or *Combat End*. This is skipped if the effect already sets an expiry event.
- Only one fits the expiry slot. A leftover combatEnd is still honoured.

### What happens on expiry

Three settings control what happens to an effect when it expires:

| Setting | Options | Applies to |
|---|---|---|
| *Effect Expiry Action* (world) | **Mark Expired** (default), Delete, Do Nothing | durations and expiry events |
| *Special Duration Expiry Action* (world) | **Default** (same as above), Delete, Mark Expired | special durations |
| *Expiry mode* (each effect, DAE tab) | Default, Delete, Suppress | this effect; overrides both |

What the options mean:
- **Delete** removes the effect.
- **Mark Expired** and **Suppress** both keep the effect on the actor but stop it applying:
  - *Mark Expired* on a duration that runs out flags the effect as expired (Foundry's own expiry), as dnd5e 6 does: it is kept while its actor is in the combat it expired in, and deleted when the actor leaves that combat or the combat ends. An effect that expires outside combat is deleted at once. The **Delete Expired Effects** button on the actor's effects tab clears expired effects by hand.
  - Otherwise the effect is disabled, so it can be enabled again: an effect whose own *Expiry mode* is *Suppress*, or one ended by a special duration or enable condition.
- Transfer effects that DAE expires are disabled, never deleted (applied enchantments are the exception).

Related:
- When a combatant leaves the combat, or the combat ends, its *Source/Target Turn* expiry effects from that combat are removed (as dnd5e 6 does).
- A *Turn Start/End* effect whose combatant has left the combat ends at the first turn edge once its duration has run out.
- *Expire Round Effects on Combat End* (world setting): when combat ends, or a combatant is removed, applied effects with a round or turn expiry event end too, unless their duration is in time units (minutes, hours...).
- When an effect expires its macros are called with `"off"`, and `lastArg["expiry-reason"]` says why, e.g. `duration-expired:turnStart`, `combat-end`, `join-combat`.

## Enable and disable conditions

Two expressions on the DAE tab turn an effect on and off as the actor changes:

- **Disable condition**: while the expression is true the effect is disabled, and it comes back when the expression is false. Example: `@attributes.hp.value < @attributes.hp.max / 2` disables a "fresh" bonus once the actor is below half health.
- **Enable condition** (applied effects): when the expression becomes false the effect ends, as an expired effect does. Under *Mark Expired*/*Suppress* (the default) it is disabled, and enabled again when the expression is true; under *Delete* it is deleted.

Conditions are evaluated by the GM's client against the actor's data, when the actor, its token, its items or its effects change (character and NPC actors).

## Macros

A macro change runs a script when its effect starts and again when it ends. Use it for things changes alone can't do: summoning, visual effects, damage over time, or updates that must not be locked by an effect.

### Macro keys

All macro keys use the *custom* change type.

| Key | Value | What it does |
|---|---|---|
| `macro.execute` | `"Macro name" args` | runs a world macro, by name or uuid (a Macro or Item uuid also works) |
| `macro.itemMacro` | `args` | runs the macro stored on the effect's item (edit it with DIME) |
| `macro.activityMacro` | `args` | runs the macro stored on the activity that applied the effect |
| `macro.actorUpdate` | see [below](#macroactorupdate) | updates an actor field, optionally undone when the effect ends |
| `macro.createItem` | `uuid` | creates the item on the actor; it is removed when the effect ends (add `, permanent` to keep it) |
| `macro.createItemRunMacro` | `uuid` | as *createItem*, then runs the created item's macro with `"onCreate"` |
| `macro.tokenMagic` | `filterName` | applies a Token Magic FX filter to the actor's tokens |
| `macro.CE` | effect name | applies a Convenient Effects effect |
| `macro.StatusEffect` | status id | applies a status condition (e.g. `prone`) while the effect applies. `StatusEffect` is a deprecated alias |

More options:
- A value of `function.path.to.fn` calls a global function instead of a macro.
- `macro.execute` and `macro.itemMacro` run on the client of the user applying the effect if they own the target, otherwise on the GM's. Add `.local` or `.GM` to the key (e.g. `macro.execute.GM`) to choose.
- DAE stores item macros in the item's `flags.dae.macro`, so the Item Macro module is not needed. Macros saved by Item Macro are still read.

### When macros run

The macro is called with `args[0]` set to:
- `"on"`: the effect starts applying (created, enabled, or its item equipped);
- `"off"`: it stops applying (deleted, expired, disabled, or its item unequipped);
- `"each"`: at the start and/or end of each turn, when *Macro repeat* is set. `lastArg.turn` is `"startTurn"` or `"endTurn"`;
- `"init"`: when the world loads, if the *Init Macros on World Load* setting is on;
- `"onCreate"`: for `macro.createItemRunMacro`, after the item is created;
- `"onUpdateActor"`: for `flags.dae.onUpdateTarget` / `onUpdateSource` macros.

### What the macro receives

- **`args`**: `args[0]` is the action above. The values from the change follow.
- **`lastArg`** (`args[args.length - 1]`) describes the call:
  - `effectId`, `effectUuid`, `efData`: the effect;
  - `origin`: its origin's uuid (usually an item);
  - `actorId`, `actorUuid`, `tokenId`, `tokenUuid`: the actor and token the effect is on;
  - `activity`: the uuid of the activity that applied it;
  - `expiry-reason` (on `"off"`): why it ended, e.g. `effect-deleted`, `effect-disabled`, `effect-suppressed`, `duration-expired:turnStart`.
  
  Prefer the uuids, e.g. `fromUuidSync(lastArg.actorUuid)`: they always work, including for unlinked tokens.
- **Variables** available in the macro: `actor`, `token`, `item`, `effect`, `macroItem`, `macroActivity`.
- An argument written `name=value` becomes a variable `name` in the macro.

### Argument substitutions

In an applied effect, macro arguments are worked out when the effect is applied:

| Argument | Becomes |
|---|---|
| `@target`, `@targetUuid`, `@targetActorUuid` | the target token's id or uuid, the target actor's uuid |
| `@token`, `@tokenUuid` | the token using the item: id, uuid |
| `@actor`, `@actorUuid` | the actor using the item: id (not its data), uuid |
| `@itemData` | the item used, as plain data (use `@itemUuid` or the `macroItem` variable for the item itself) |
| `@itemId`, `@itemUuid`, `@itemCardUuid` | the item's id, uuid, and its chat card's uuid |
| `@spellLevel`, `@itemLevel` | the level the spell was cast at (midi-qol) |
| `@damage`, `@critical`, `@fumble` | the damage total; whether the attack was a critical or a fumble (midi-qol) |
| `@scene`, `@unique`, `@whisper` | the scene id; a random id; the whisper setting |
| `@stackCount` | the effect's stack count |
| `@field` | any value from the actor using the item, e.g. `@abilities.str.mod` |
| `##field` | worked out against the target, once, when the effect is applied to it |

Example: the change `macro.execute` *custom* `"My macro" 5 @abilities.str.mod`
- when applied, runs *My macro* with `args = ["on", 5, <the caster's Strength modifier>, lastArg]`;
- when the effect ends, runs it again with `args = ["off", 5, <the same value>, lastArg]`.

Arguments are split at spaces and also at `+ * / % , ( ) ^ !` and comparisons, so `+5` arrives as two arguments, `+` and `5`. Quote a value to keep it whole: `"+5"`.

### macro.actorUpdate

A normal change locks its field: it can't be updated while the effect applies, and is restored when the effect ends. `macro.actorUpdate` instead **updates** the field, like a macro would, and can undo the update when the effect ends. Use it for values like temporary hit points.

```
macro.actorUpdate custom <actorUuid> <type> <expression> <targetField> [undo]
```
- **actorUuid**: whose field, e.g. `@actorUuid` (the caster) or `@targetUuid` (the target).
- **type**: `number`, `boolean` or `string`, matching the field.
- **expression**: in quotes, e.g. `"@abilities.dex.mod * 2 + 10"`. Starting it with `+`, `-`, `*` or `/` applies it to the current value.
- **targetField**: e.g. `system.attributes.hp.temp`.
- **undo** (optional), when the effect ends:
  - missing, `true` or `restore`: restore the original value;
  - `remove`: subtract this change only, keeping changes from other sources;
  - `+value` (or `-`, `*`, `/`): apply that to the current value;
  - `value`: set the field to it;
  - `undefined`: unset the field;
  - `false`: don't undo.

An `@field` in the expression is worked out against the caster when the effect is applied; write `**field**` to use the updated actor's own value.

Example: give the target 5 temporary hit points, and take them away again when the effect ends:
```
macro.actorUpdate custom @targetUuid number "+5" system.attributes.hp.temp remove
```

## Special DAE keys

| Key | What it does |
|---|---|
| `flags.dae.deleteOrigin` | when this effect is deleted, delete the item in its origin (owned items only) |
| `flags.dae.deleteUuid` | value: a token, owned item, effect or template uuid, deleted when this effect is deleted (e.g. a summoned creature) |
| `flags.dae.suspendActiveEffect` | value: an effect uuid, suspended when this effect is deleted |
| `flags.dae.onUpdateTarget` / `onUpdateSource` | links the target and the caster; see below |
| `flags.dnd5e.DamageBonusMacro` | a damage bonus macro (midi-qol); use bare `ItemMacro` or `ActivityMacro` |

### Removing summoned creatures

**With midi-qol and a dnd5e summon activity**, turn on midi-qol's *Auto remove summoned creatures on item expiry/concentration removal* setting:
- If the activity needs **concentration**, each summoned token is made dependent on the concentration effect, so ending concentration (or failing a concentration save) removes the creatures.
- Otherwise midi-qol adds an effect, lasting the activity's duration, and the creatures are removed when that effect is deleted.

**From your own macro**, create an effect with `flags.dae.deleteUuid` set to the summoned token. When the effect is deleted, the token is deleted too:
```js
const [token] = await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
// The caster's concentration on this item, if there is one
const concentration = [...(caster.concentration?.effects ?? [])].find(e => e.getFlag("dnd5e", "item")?.id === item.id);
await caster.createEmbeddedDocuments("ActiveEffect", [{
  name: "Flaming Sphere Summon",
  img: "icons/magic/fire/orb-vortex.webp",
  origin: item.uuid,
  duration: { value: 1, units: "minutes" },
  flags: { dnd5e: { dependentOn: concentration?.uuid } },
  system: { changes: [{ key: "flags.dae.deleteUuid", type: "custom", value: token.uuid }] }
}]);
```
Setting `flags.dnd5e.dependentOn` to the concentration effect makes this effect dependent on it: when concentration ends, dnd5e deletes the effect, and DAE then deletes the token.

`deleteUuid` acts when its effect is **deleted**. With the default *Effect Expiry Action* (Mark Expired) an expired effect is kept, not deleted, so the token stays until the effect is removed. Set the effect's *Expiry mode* to Delete if the duration running out should remove the creature.

### Linking actors: onUpdateTarget and onUpdateSource

These keys link the target and the caster, so one can react when the other changes. midi-qol's Warding Bond and Arcane Ward sample items use them.

**The value** is `Label, macroReference, filter, args...`; everything after the label is optional.

**What it records.**
- `flags.dae.onUpdateTarget` records the link on the **target**.
- `flags.dae.onUpdateSource` records it on the **caster**. It is always created on the caster, never on the target.
- Either way the link holds the origin item, the target token, and the caster's token and actor.
- To link both ways, use one change of each.

**With a macro**, it is called with `"onUpdateActor"` whenever the linked actor is updated in a field matching *filter* (default `system`), before the update is applied.
- `lastArg` then also has:
  - `updates`: the update, which the macro may change (only changes made before the macro's first `await` take effect);
  - `options` and `user`;
  - `sourceActor`, `sourceToken`, `targetActor`, `targetToken`, `originItem`.
- A macro that updates the other linked actor should pass `{onUpdateCalled: true}` in the update, so the two don't keep triggering each other.

**Without a macro** the link is just recorded, for other macros to read (e.g. a damage bonus that only applies against the linked target).

## dnd5e key notes

The field browser lists every key DAE offers, with its change type and phase, and the dnd5e wiki's [Active Effect Guide](https://github.com/foundryvtt/dnd5e/wiki/Active-Effect-Guide) describes the system's keys. These notes cover the ones that are easy to get wrong.

**Attack and damage bonuses**
- `system.bonuses.<mwak|rwak|msak|rsak>.<attack|damage>` are evaluated at roll time.
- DAE shortcuts:
  - `system.bonuses.All-Attacks` / `All-Damage`: all four attack types;
  - `system.bonuses.weapon.attack|damage`: mwak and rwak;
  - `system.bonuses.spell.attack|damage`: msak and rsak.

**Abilities**
- Ability scores: `system.abilities.<abl>.value`.
- Check and save bonuses: `system.abilities.<abl>.bonuses.check|save`.
- `system.abilities.<abl>.mod` is deprecated: it changes the final value but does not flow into saves and skills. Use the bonuses instead.

**Skills and tools**
- `system.skills.<skill>.value` (*custom*: adds a proficiency level), `.ability`, `.bonuses.check|passive`.
- `system.tools.<tool>.prof|ability|bonuses.check`.

**Traits** (damage immunity/resistance/vulnerability, conditions, languages, weapon and armor proficiencies) take:
- `.value`: add one, e.g. `system.traits.dr.value` *custom* `fire`;
- `.custom`: append text;
- `.all`: all of them, e.g. `system.traits.di.all`.

**Armor class**
- `ac.calc` (*override*), with `ac.formula` for a custom calculation.
- `ac.flat` (used when the calculation is flat).
- `ac.bonus`: a formula dnd5e evaluates with the actor's data, so `@abilities.wis.mod` works.
- `ac.min`, `ac.cover`.

**Other**
- **Initiative**: `system.attributes.init.bonus` accepts formulas like `@abilities.wis.mod`, and shows on the sheet and in the roll.
- **Proficiency**: `system.attributes.prof` *add* raises the proficiency bonus, and skills, saves and DCs follow.
- **Movement**: `system.attributes.movement.<type>`, `movement.all` (*custom*: every type), `movement.hover`.
- **Spell slots**: `system.spells.spell<N>.override` (before derived data) or `.max` (after); `system.spells.pact.override`, `pact.level`.
- **Special traits**: `flags.dnd5e.<trait>`, e.g. `elvenAccuracy`, `halflingLucky`, `jackOfAllTrades`, `reliableTalent`, `remarkableAthlete`, `powerfulBuild`, `diamondSoul`, `observantFeat`, `enhancedDualWielding`, `tavernBrawlerFeat`.
- **Criticals**: `flags.dnd5e.weaponCriticalThreshold`, `spellCriticalThreshold`, `meleeCriticalDamageDice`.
- **Tokens**: `token.*` keys change the actor's tokens (Foundry v14). `ATL.*` keys need the ATL module, or see the *ATL → token.\* migration policy* setting.
- **midi-qol** adds its own keys (`flags.midi-qol.*`, `system.traits.dm`, ...), listed in the field browser when it is active.

## Settings

All are world settings.

| Setting | Default | What it does |
|---|---|---|
| Effect Expiry Action | Mark Expired | what happens to expired effects: mark expired, delete, or nothing (reload) |
| Special Duration Expiry Action | Default | the same for special durations; *Default* follows the setting above |
| Expire Round Effects on Combat End | off | end applied effects with round/turn expiry when combat ends |
| Init Macros on World Load | on | run effect macros with `"init"` when the world loads (reload) |
| Dependent Conditions | on | statuses add their dependent conditions, e.g. paralysed adds incapacitated |
| No Duplicate Damage macros | off | ignore a DamageBonusMacro that is already present |
| Add Half Health Effect | off | add a status effect that halves max HP (reload) |
| DAE Title Bar / DIME Title Bar | on | show the DAE and DIME header menu entries |
| DAE Colorful Title Bar | on | green icons when the document has effects or a macro |
| Just Icon | off | show the header entries as icons only |
| ATL → token.* migration policy | legacy | how `ATL.*` keys are handled (reload) |
| Auto-migrate on update | off | migrate effects when DAE is updated (there is also a *Migrate Now* button) |
| Disable all active effect processing | off | turn DAE's effect processing off, e.g. for troubleshooting (reload) |
| Load DAE for untested game systems | off | let DAE load in systems other than dnd5e (reload) |
| Amount of debug to show | none | console logging level |

## API and hooks

The API is `DAE`, also available as `game.modules.get("dae").api`.

**Applying effects**
- `DAE.doEffects(item, activate, targets, options)`: apply an item's applied effects to target tokens (or remove them, with `activate` false).
- `DAE.doActivityEffects(activity, activate, targets, effectUuids, options)`: the same for an activity.

**Effects and durations**
- `DAE.ActiveEffects(document).render({force: true})`: open the effects list for an actor or item.
- `DAE.expireEffect`, `isEffectExpired`, `isTransferEffect`, `hasDuration`, `hasExpiry`: duration helpers.

**Extending DAE**
- `DAE.registerChangeHandler(key, {on, off, destination})`: handle a custom key with your own on/off functions; `destination` is `"local"`, `"GM"` or `"mixed"`.

**Migration**
- `DAE.migrateWorld()`, `migrateActor`, `migrateItem`.

**Token and flag helpers**
- `blindToken`, `restoreVision`, `setTokenVisibility`, `moveToken`, `teleportToken`, `renameToken`, `createToken`.
- `setFlag` / `unsetFlag`, `deleteActiveEffect`.

**Hooks**
- `dae.setupComplete` (during Foundry's `setup`) and `dae.ready` (during `ready`): DAE has set up; both receive the API.
- `dae.addSpecialDurations(specialDurations)`: add special durations (midi-qol uses this).
- `dae.modifySpecials(specKey, specials, characterSpec)`, `dae.modifySpecs`, `dae.modifyBaseValues`, `dae.modifyDerivedSpecs`, `dae.addFieldMappings`, `dae.addAutoFields`: add or change keys in the field browser.
- `dae.suppressionChanged(effect, suppressed)`: an effect was suppressed or unsuppressed.
- `dae.settingsChanged`: DAE's settings changed.

Example: adding a key to the field browser:
```js
Hooks.on("dae.modifySpecials", (specKey, specials) => {
  if (!["character", "npc"].includes(specKey)) return;
  specials["system.attributes.myField"] = [new foundry.data.fields.NumberField({ label: "My Field" }), "add"];
});
```
- `specKey` is the actor type.
- Each entry is `[DataField, changeType, phase?]`; the phase defaults to final.

## Module integrations

- **midi-qol**:
  - applies item and activity effects to targets;
  - provides most special durations;
  - adds `flags.midi-qol.*` keys and `DamageBonusMacro`;
  - adds the self-target options on the DAE tab.
- **Convenient Effects**: `macro.CE`.
- **Token Magic FX**: `macro.tokenMagic`.
- **GM Notes**: `flags.gm-notes.notes`.
- **ATL** (Active Token Effects): `ATL.*` keys; see the *ATL → token.\* migration policy* setting. Foundry v14's own `token.*` keys need no module.
- **Sequencer**: Sequencer effects tied to a DAE effect end with it.
- **tidy5e**: the header controls.

No longer needed: about-time, Item Macro, Combat Utility Belt.

## Issues

Please read the [Changelog](./Changelog.md) first: it often explains a change in behaviour.

When filing an issue, include:
- your Foundry, dnd5e and DAE version numbers ("latest" doesn't tell me which);
- other modules and their versions, especially midi-qol. Please try to reproduce the problem with as few modules as possible;
- with midi-qol, your midi-qol settings, exported from its misc tab;
- what you did, what you expected, and what happened.

Report issues at https://github.com/tposney/dae/issues, or ask on discord.

## Building

```bash
npm install
npm run build     # type check and build into dist/
npm run package   # zip dist/ into package/
```

## License

This package is under an [MIT license](LICENSE) and the [Foundry Virtual Tabletop Limited License Agreement for module development](https://foundryvtt.com/article/license/).
