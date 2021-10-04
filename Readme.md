If you have a problem please read the [Issues section](#Issues) before reporting a bug.

## BREAKING
**My lights do not go off when I unequip an item** **I can't toggle an effect from Token HUD**
As of DND5E 1.4.3 and/or foundry 0.9.2 unequipping an item makes it unavailable **EVEN** if it is active. DAE understands about unavailable effects and won't apply effects that are marked as unavailable.

DAE makes no changes to active effects when equipping/unequipping, in 1.4.3 and/or foundry 0.9.2 (which it used to do) so that there is no confusion about who is toggling effects it is all foundry/DND5E.

This will negatively impact ATL and Token HUD (at least) both of which used to rely on DAE sending out an updateEffect notification when items were equipped/unequipped. DND5E 1.4.3/foundry 0.9.2 do not notify of changes to item equipped satus via updateActiveEffect. 
  * ATL currently ignores unavailable looking only at active/inactive - so toggling equipped to enable/disable lights won't work, you have to toggle the effect. 
  * Token HUD toggles active/inactive when you choose an effec so if the item is equipped toggling will work, but if not equippd it won't change anything.

[TOC]

Dynamic Active Effects (DAE) is a replacement for Dynamic Effects (which will *NOT* work in 0.71+, and won't be ported).

Much of the functionality of Dynamic Effects is now included in the Foundry core active effects system. DAE augments the core functionality with some of the features from Dynamic Effects. 

Core active effects allow you to modify a base value (defined in template.json - most fields you can edit in the character sheet) and apply a fixed value or string to it. There are additional options in core that were not present in Dynamic Effects, see: [Calculations](#Calculations).

Foundry core active effects attach to an item and are designated as transfer or non-transfer.  
Transfer Effects are transferred to the actor that owns the item when the item is added to the actor's inventory and removed when the item is removed. 
Non-transfer Effects are not moved from the item to any actor without additional functions, which DAE/Midi-QOL provide.

You can also create active effects directly on an actor and bypass the whole transfer/non-transfer question.

## What does DAE do?
First off you probably don't need DAE. The core Foundry system has active effects that do at least 80+% of what you might want. I encourage you to try using just the core active effects and using DAE only if you run into a roadblock on what you want to do.

If you've come here because someone said you should use the module, here's a little bit of background:

This module modifies how active effects behave over and above what is supported in core. An active effect allows you to modify values on an actor (e.g. Strength). You can create effects directly on an actor or create them on an item and have them transfer to the actor when the item is added to the actor.

DAE does add some features to core active effects, so if the following features might be useful go ahead and use DAE. DAE builds on the core active effects so any core active effect is also a DAE active effect. Any place you edit a core active effect you can use the expanded active effects features.  
1. A DAE editor button is added to the title bar for Actors and Items. Owned items allow modification of existing effects but *not* addition/deletion.
2. Transfer effects (from an item) are enabled/disabled according to the following rule which overrides the default behaviour
    * If the item that the effect came from (transfer effect) and the item can't be equipped simply use the "disabled/suspended" setting. You can toggle from the effects tab on the item/character sheet.
    * Anything else follows the obvious dnd5e rule that transfer effects for an item apply if the item is equipped and attuned/does not require attunement. For items that can be equipped you CANNOT override the enabled/disabled status for transfer effects (change in 0.8.47 of DAE). As of dnd5e 1.4.3, core dnd5e provides this functionality and it is disabled in dae if dnd5e 1.4.3 or later is installed.
3. The ability to reference actor data in active effects data fields like `@abilities.str.value` where core restricts you to numbers and strings. If an active effect modifies a field that will be used in a roll like `data.bonuses.mwak.attack` (and soon to be .bonus fields - dnd1.5), a string field like `@abilities.dex.mod` will get looked up when the roll is made.
4. The ability to update derived fields, such as `abilities.dex.mod`. (Work in progress some of these do not do what you might expect, good example initiative mod/bonus).
    * Most/Some of these will be redundant after dnd1.5.
5. The ability to perform arithmetic in field data definitions, like `ceil(@classes.rogue.levels/2)`
6. Support for an API that allows non-transfer effects to be applied to a target token. In combination with Midi-QOL it allows you to have spells/weapons/features apply non-transfer effects to other tokens.
7. An extended active effect editor that provides `CUSTOM` fields, a list of valid fields, a drop down list of options, drop down lists for restricted field values, and the ability to set the priority of an effect.
8. The ability to call macros when active effects are applied to an actor.

## Active Effect Expiry
Expiry of effects requires additional [modules](#Module Integrations) to be installed. All of the modules play nicely together. If times-up is installed it takes over the expiry of timed effects.
* about-time provides time based expiry (i.e. duration in seconds/minutes and rounds converted to seconds).
* times-up supports time based expiry plus knows about rounds/turns and links to the combat tracker. 
* Midi-QOL supports a handful of special expiries (see below) that are otherwise tricky to support.

When entering the start time on the DAE duration tab the value is interpreted as an offset from the current game time. So 0 means now, +60 means in 1 minutes time, -30 means 30 seconds ago  

If you use the special durations listed below be aware that any temporary effect must have a time duration as well. If you don't specify one (in the item or the effect) it will be assumed to be 6 seconds, which means it will expire at the start of the next round. If you want to make sure the special duration will work (i.e. start of the actors next turn) put in a dummy duration that is certain to be long enough, i.e. 2 rounds.

 $`\textcolor{#e67300}{\textsf{\small{Requires Midi-QOL 0.3.35+}}}`$ and does *not* depend on about-time/times-up  
Effects support additional expiry options (available on the DAE effect duration screen) that can be chosen:
  * 1Attack: active effects last for one attack - requires workflow automation
  * 1Action: active effects last for one action - requires workflow automation 
  * 1Hit: active effects last until the next successful hit - requires workflow automation 
  * isAttacked: the effect lasts until the next attack against the target. Requires workflow automation.
  * isDamaged: the effect lasts until the target takes damage. Requires workflow automation.
  * 1Save: the effect lasts until the target makes a save roll. Requires workflow automation.  
  All of these effects automatically expire at the end of the combat.
  * Long Rest/Short Rest/New Day
  * There are lots of variations on the above to support different damage types/saves  

Requires times-up installed and active:
  * turnStart: effects last until the start of self/target's next turn (check combat tracker)  
  * turnEnd: effects last until the end of self/target's next turn (checks combat tracker)
  * If you want an effect on a target that expires at the start of the caster's next turn set the duration to 1 round
  * If you want an effect on a target that expires at the end of the caster's next turn set the duration to 1 round + 1 turn.  

## Editing Active Effects
A preliminary edit function is supplied, which may change in the future.  
Active effects for Actors and Items can be edited. Owned Item active effects cannot be edited.

### Actor Active Effects
On the title bar of the character sheet is a button for "DAE" that will display a form showing all of the active effects on the actor (transfer and non-transfer). You can change the actor effects to your heart's content - HOWEVER changing the effects on the owned item will overwrite the corresponding active effects on the actor. You are free to create active effects on the actor that are not linked to any item.

Active effects that are transfer effects are displayed with a down arrow. Non-transfer effects are displayed with a right arrow.

If the effect has a duration, the remaining duration is displayed in rounds/turns or seconds.

### Calculations
Core system active effects are calculated before the game system specific calculation of "derived" fields (prepareDerivedData). For dnd5e prepareDerivedData calculates all the ability modifiers, skill totals, and spell slots available. DAE adds an additional effect application pass that occurs after the system specific prepareDerivedData() completes.

Active Effects define the following calculations:
* `CUSTOM`: system/module specific calculation. DAE specifies lots of CUSTOM effects.
* `ADD`: Add a value to the field (if it is numeric) or concatenate if the field is a string.
* `MULTIPLY`: for numeric fields only, multiply the field by a value.
* `OVERRIDE`: replace the field with the supplied value.
* `UPGRADE`: for numeric fields replace the field with the supplied value if it is larger than the field. 
* `DOWNGRADE`: for numeric fields replace the field with the supplied value if it is smaller than the field.  

Additionally, there is a priority that can be given to each change within an effect. The priority determines the order in which changes will be applied during the applyEffects stage. All changes across all effects are collected and sorted by priority before application (low to high). The default priority for changes are 
  * `CUSTOM:     0`
  * `MULTIPLY:  10`
  * `ADD:       20`
  * `DOWNGRADE: 30`
  * `UPGRADE:   40`
  * `OVERRIDE:  50`  
So if an actor has the following changes, `data.attributes.hp.max   ADD 10`, and `data.attributes.hp.max   OVERRIDE 20` then with default priorities hp.max will be 20, since overrides comes after ADD. If priorities are assigned `data.attributes.hp.max   ADD 10   Priority:100`, and `data.attributes.hp.max   OVERRIDE 20   Priority:10` hp.max will become 30.  

DAE allows you to use expressions as well as fixed values. So for example you could have the following
  * `data.attributes.hp.max   ADD "@classes.paladin.levels * @abilities.con.mod"   Priority:100`, and `data.attributes.hp.max   OVERRIDE "10 + 5 + 6 + 10"   Priority:10` where hp.max will be set to `31 + con.mod * paladin levels`

**Number** fields are fully evaluated during the applyEffects pass.   
**String** fields are not evaluated at all. So setting `data.bonuses.mwak.attack   ADD "@data.abilities.str.mod * 2"` will be evaluated when the attack is rolled, NOT during the prepare data phase, since `data.bonuses.mwak` is a string field.
* Recognizing what are base and derived values is important, since during the first applyEffects phase ONLY base data values are available. If the target field is a string field it does not matter which pass it is in, since evaluation only occurs when the field is used to do a roll.

DAE defines a game system specific set of "derived" values, which are calculated after the system specific prepareDerivedData is called. For DND this means after all modifiers etc are calculated. 

<details><summary>The current list of derived fields for dnd5e</summary>
<br>
Fields that have a mode specified below means that ONLY that mode is supported for the effect (and the editor will set the mode when the change is saved)
<br><br>
<details><summary>data.attributes</summary>

| Attribute Key	| Change Mode	| Details 	|
|-----	|:-----------:	|-----	|
| `data.attributes.ac.bonus`            	|            	| This is applied before prepared data so CANNOT include derived fields.	|
| `data.attributes.ac.value`	|            	| This is applied after prepare data so can include derived fields like dex.mod and so on.	|
| `data.attributes.death.failure`          	|            	| 	|
| `data.attributes.death.success`          	|            	| 	|
| `data.attributes.encumbrance.max`          	|            	| 	|
| `data.attributes.exhaustion`          	|            	| 	|
| `data.attributes.hd` 	| 	| Hit dice modifier	|
| `data.attributes.hp.max`              	|            	| 	|
| `data.attributes.hp.min`              	|            	| 	|
| `data.attributes.hp.temp`          	|            	| 	|
| `data.attributes.hp.tempmax`          	|            	| 	|
| `data.attributes.hp.value`          	|            	| 	|
| `data.attributes.init.bonus`          	|            	| 	|
| `data.attributes.init.mod`          	|            	| 	|
| `data.attributes.init.total`          	|            	| 	|
| `data.attributes.init.value`          	|            	| 	|
| `data.attributes.inspiration`          	|            	| 	|
| `data.attributes.movement.all`          	|    CUSTOM   	| 	|
| `data.attributes.movement.TYPE`          	|            	| TYPE: burrow/climb/fly/hover/swim/walk	|
| `data.attributes.movement.units`          	|            	| 	|
| `data.attributes.prof`                	|    CUSTOM   	| Allows addition of a numeric value to `data.abilities.prof`. You can use a negative value to reduce proficiency.<br>When updated, skills, spelldc and saves are updated accordingly (this calculation should be considered beta and if you find something missing let me know).	|
| `data.attributes.senses.TYPE`          	|            	| TYPE: blindsight/darkvision/special/tremorsense/truesight	|
| `data.attributes.senses.units`          	|            	| 	|
| `data.attributes.spellcasting`          	|            	| 	|
| `data.attributes.ac.base`	|	| [- Deprecated as of dnd5e 1.4.x -]	|
| `data.attributes.ac.calc`	|	| [- Deprecated as of dnd5e 1.4.x -] 	|
| `data.attributes.ac.cover`	|	| [- Deprecated as of dnd5e 1.4.x -]	|
| `data.attributes.ac.flat`	|	| [- Deprecated as of dnd5e 1.4.x -]	|
| `data.attributes.ac.formula`	|	| [- Deprecated as of dnd5e 1.4.x -]	|
| `data.attributes.ac.min`	|	| [- Deprecated as of dnd5e 1.4.x -]	|

</details>
<details><summary>data.details</summary>

| Attribute Key	| Change Mode	| Details 	|
|-----	|:-----------:	|-----	|
| `data.details.alignment`          	|            	| 	|
| `data.details.appearance`          	|            	| 	|
| `data.details.background`          	|            	| 	|
| `data.details.biography.public`          	|            	| 	|
| `data.details.biography.value`          	|            	| 	|
| `data.details.TYPE`          	|            	| TYPE: bond/flaw/ideal	|
| `data.details.level`          	|            	| 	|
| `data.details.originalClass`          	|            	| 	|
| `data.details.race`          	|            	| 	|
| `data.details.trait`          	|            	| 	|
| `data.details.xp.max`          	|            	| 	|
| `data.details.xp.min`          	|            	| 	|
| `data.details.xp.value`          	|            	| 	|

</details>
<details><summary>data.traits</summary>

| Attribute Key	| Change Mode	| Details	|
|---------------------------------------	|:----------:	|-------- 	|
| `data.traits.languages.all`	|    CUSTOM	| The actor will be given all languages specified in `CONFIG.DND5E.languages` 	|
| `data.traits.languages.value`	|    CUSTOM	| The value will be added the known languages 	|
| `data.traits.languages.custom`	|    CUSTOM	| The specified string will be appended to the custom language field 	|
| `data.traits.size`	|   OVERRIDE	| Overrides the size setting on the character sheet 	|
| `data.traits.di.all`	|    CUSTOM	| 	|
| `data.traits.dr.all`	|    CUSTOM	| 	|
| `data.traits.dv.all`	|    CUSTOM	| The actor will be given immunity/resistance/vulnerability to all damage types specified in `CONFIG.DND5E.damageResistanceTypes` 	|
| `data.traits.di.custom`	|    CUSTOM	| 	|
| `data.traits.dr.custom`	|    CUSTOM	| 	|
| `data.traits.dv.custom`	|    CUSTOM	| The actor will have the specified string appended to the list of custom immunities/resistances/vulnerabilities. 	|
| `data.traits.di.value`	|    CUSTOM	| 	|
| `data.traits.dr.value`	|    CUSTOM	| 	|
| `data.traits.dv.value`	|    CUSTOM	| The actor will be given immunity/resistance/vulnerability to the specified damage type 	|
| `data.traits.ci.all`	|    CUSTOM	| 	|
| `data.traits.ci.custom`	|    CUSTOM	| 	|
| `data.traits.ci.value`	|    CUSTOM	| Same as above but for `CONFIG.DND5E.conditionTypes` 	|
| `data.traits.armorProf.all`	|    CUSTOM	| 	|
| `data.traits.armorProf.custom`	|    CUSTOM	| 	|
| `data.traits.armorProf.value`	|    CUSTOM	| Same as above but `CONFIG.DND5E.armorProficiencies` 	|
| `data.traits.toolProf.all`	|    CUSTOM	| 	|
| `data.traits.toolProf.custom`	|    CUSTOM	| 	|
| `data.traits.toolProf.value`	|    CUSTOM	| Same as above but `CONFIG.DND5E.toolProficiencies` 	|
| `data.traits.weaponProf.all`	|    CUSTOM	| 	|
| `data.traits.weaponProf.custom`	|    CUSTOM	| 	|
| `data.traits.weaponProf.value`	|    CUSTOM	| Same as above but `CONFIG.DND5E.weaponProficiencies` 	|
</details>
<details><summary>data.resources</summary>

| Attribute Key	| Change Mode	| Details	|
|---------------------------------	|:-----------:	|----------------	|
| `data.resources.legact.max`	|	| Legendary Actions	|
| `data.resources.legres.max`	|	| Legendary Resistance	|
| `data.resources.RES.label`	|   OVERRIDE	|	|
| `data.resources.RES.max`	|	|	|
| `data.resources.RES.lr`	|	| lr/sr = long/short rest	|
| `data.resources.RES.sr`	|	| RES: primary/secondary/tertiary	|


</details>
<details><summary>Attributes and Skills</summary>

| Attribute Key	| Change Mode	| Details	|
|---------------------------------	|:-----------:	|----------------	|
| `data.attributes.ABILITY.dc`	|    CUSTOM	| Adds the value (must be numeric) to the field and recomputes items saving throw dcs.	|
| `data.attributes.ABILITY.min`	|    CUSTOM	| 	|
| `data.attributes.ABILITY.mod`	|   A/M/D/U/O	| Allows modification of the ability modifier.	|
| `data.attributes.ABILITY.proficient`	|     ADD	| Multiplies character proficiency by this amount and adds it to the current value for the ability.	|
| `data.attributes.ABILITY.save`	|   	| Provides a bonus to ability saves. This is only active if the "Use ability save field when rolling saving throws" module setting is enabled. <br>This will use the save plus rather than the ability modifier when rolling saving throws.	|
| `data.attributes.ABILITY.value`	|   	| ABILITY: cha/con/dex/int/str/wis	|
| `data.bonuses.abilities.check`          	|            	| 	|
| `data.bonuses.abilities.save`          	|            	| 	|
| `data.bonuses.abilities.skill`          	|            	| 	|
| `data.skills.SKILL.ability`	|   OVERRIDE	| Dropdown: Strength/Dexterity/Constitution/Intelligence/Wisdom/Charisma	|
| `data.skills.SKILL.mod`	|	| SKILL: acr/ani/arc/ath/dec/his/ins/inv/itm/med/nat/per/prc/prf/rel/slt/ste/sur	|
| `data.skills.SKILL.passive`	|	| This affects the specified skill adjusting modifier or passive value for the skill. <br>Changes to modifier are only reflected when rolling the skill, not on the character sheet.	|
| `data.skills.SKILL.value`	|	| Dropdown: Not Proficient/Proficient/Expertise/Half Proficiency	|

</details>
<details><summary>Spells and Attacks</summary>

| Attribute Key	| Change Mode	| Details	|
|---------------------------------------	|:----------:	|-------- 	|
| `data.bonuses.All-Attacks`	|    CUSTOM	| The specified string field will be appended to `bonuses.mwak.attack`, `bonuses.rwak.attack`, `bonuses.msak.attack`, `bonuses.rsak.attack`	|
| `data.bonuses.All-Damage`	|    CUSTOM	| The specified string field will be appended to ?	|
| `data.bonuses.abil.damage`          	|            	| 	|
| `data.bonuses.TYPE.attack`          	|    CUSTOM  	| 	|
| `data.bonuses.TYPE.damage`          	|            	| TYPE: heal/msak/mwak/rsak/rwak/spell/weapon 	|
| `data.bonuses.save.damage`          	|            	| 	|
| `data.bonuses.spell.dc` 	|     ANY 	| Always numeric, so any dice expression will be evaluated once when prepareData is called and **NOT** on each spell cast.<br>You cannot do lookups of derived fields for spell.dc calculations. 	|
| `data.spells.pact.level`	|	|	|
| `data.spells.pact.override`	|	| `spellslots.value` and `spellslots.max` are not able to be modified with DAE.	|
| `data.spells.spell[1-9].override`	|	| e.g. `data.spells.spell3.override`	|

</details>
<details><summary>Special Traits Flags</summary>
<br>
These fields accept 0 off, or 1 on.

| Attribute Key                    	| Change Mode 	|
|-----	|:-----------:	|
| `flags.dnd5e.diamondSoul`      	|   OVERRIDE 	|
| `flags.dnd5e.elvenAccuracy` 	|   OVERRIDE 	|
| `flags.dnd5e.halflingLucky`      	|   OVERRIDE 	|
| `flags.dnd5e.initiativeAlert`    	|   OVERRIDE 	|
| `flags.dnd5e.initiativeHalfProf` 	|   OVERRIDE 	|
| `flags.dnd5e.jackOfAllTrades`    	|   OVERRIDE 	|
| `flags.dnd5e.observantFeat`      	|   OVERRIDE 	|
| `flags.dnd5e.powerfulBuild`      	|   OVERRIDE 	|
| `flags.dnd5e.reliableTalent`     	|   OVERRIDE 	|
| `flags.dnd5e.remarkableAthlete`  	|   OVERRIDE 	|

</details>
<details><summary>Misc Fields</summary>

| Attribute Key	| Change Mode	| Details	|
|---------------------------------------	|:----------:	|-------- 	|
| `data.currency.TYPE`          	|            	| TYPE: cp/ep/sp/gp/pp	|
| `flags.dnd5e.meleeCriticalDamageDice` 	| 	| How many dice to roll on melee critical hits.      	|
| `flags.dnd5e.spellCriticalThreshold` 	| 	| Sets the threshold range for spell critical hits.       	|
| `flags.dnd5e.weaponCriticalThreshold` 	| 	| Sets the threshold range for weapon critical hits.       	|
| `flags.dnd5e.initiativeAdv`	| 	| Gives advantage on initiative rolls.	|
| `flags.dnd5e.initiativeDisadv`	| 	| Gives disadvantage on initiative rolls.	|
| `flags.dae`	|   CUSTOM	| 	|
| `flags.dnd5e.DamageBonusMacro`	| 	| 	|

</details>
<details><summary>Macro Fields</summary>
<br>
Macros are called when the effect is transferred to the character (with `args[0] === "on"`) and called again when the active effect is removed (with `args="off"`).

| Attribute Key	| Change Mode	| Details	|
|---------------------------------	|:-----------:	|----------------	|
| `macro.execute`	|    CUSTOM	|	|
| `StatusEffect` | CUSTOM | Applies/removes default/CE/CUB status effects/conditions. ** Strongly Preferred** |
| `macro.CE`	|    CUSTOM	| Applies/removes CE Coditions	|
| `macro.CUB`	|    CUSTOM	| Applies/removes CUB Conditions.	|
| `macro.itemMacro`	|    CUSTOM	| 	|
| `macro.tokenMagic`	|    CUSTOM	| Applies/removes the Token Magic affects.	|

</details>
</details>

## Macros

Macros have changed substantially in their implementation. When you have a non-transfer effect that includes a macro, the macro is transferred to the target actor and runs when created on the actor. Deletion of the active effect from the target actor calls the macro again with `args[0] = "off"`.
Since the macro attaches to the target actor the macro can schedule itself to be activated on other events, such as combat updates to support damage over time effects.

Using macros with arguments requires that you have the Furnace module installed and advanced macros enabled. That is the only setting you will want to enable.  
Furnace is now deprecated, the module Advanced Macros is a direct replacement and DAE will work with it if installed and active.

```
macro.execute "macro_name" args
```
This will call the macro "macro_name" with `args[0] = "on"` and the rest of ...args passed through to the macro when the effects are applied to a target token. It will be called with `args[0] = "off"` when the active effect is deleted from the target actor.  

In addition to the standard `@values` the following are supported (only as macro arguments):

`@target` will pass the token id of the targeted token.  
`@targetUuid` will pass the Uuid of the targeted token.  
`@scene` will pass the scene id of the scene on which the user who activated the effect is located.  
`@item` will pass the item data of the item that was used in the activation.  
`@spellLevel` if using Midi-QOL this will be the spell level the spell was cast at.  
`@item.level` if using Midi-QOL this will be the spell level the spell was cast at.  
`@damage` The total damage rolled for the attack.  
`@token` The id of the token that used the item.  
`@actor` The actor.data for the actor that used the item.  
`@FIELD` The value of the FIELD within the actor that used the item, e.g. `@abilities.str.mod`.  
`@unique` A randomly generated unique id.  
`##field` The `##` means the argument will not be evaluated using caster values, but will be replaced with `@field` when it is applied to the target.  

An additional argument (in addition to those specified in the `macro.execute` definition) is `lastArgs`, which includes a lot of information for executing the macro.

For example, if the `macro.execute` definition is `macro.execute CUSTOM "My macro" 5 @abilities.str.mod` then, when the effect is transferred to the target token the macro will be called with `args = ["on", <strength mod of the actor that used the item>, <actor.data of the target token>]`  
When the effect is deleted from the target actor (either by expiry or explicit deletion) the macro will be called again with `args = ["off", <strength mod of the actor that used the item>, <actor.data of the target token>]`  

#### Macros and transfer effect
The above discussion applies to non-transfer effects. Transfer effects are applied when the item is equipped by a character.

**macro.itemMacro "macro_name" args**  
The same as `macro.execute`, but the item is inspected to find the item macro stored there. You can create item macros with the [Item Macro](https://github.com/Kekilla0/Item-Macro) module.

If you are using `macro.itemMacro` please make sure you disable the Item Macro config settings:
* "character sheet hook" else when you use the item the macro will get called bypassing Midi-QOL/DAE completely and none of the arguments will get populated.
* "override default macro execution"  IF this is enabled the hotbar hooks will directly call the item macro and won't work as expected for DAE/Midi-QOL.

The setting is per player so each player needs to change the setting to disabled.  

**macro.tokenMagic "filterName"**  
Will apply the specified Token Magic filter to each targeted actor when the active effect is applied to the actor and removed when the effect is deleted.

**Example**  
This is a programmatic way to create items with effects.  
``` js
const EXAMPLE_TRANSFERRED_EFFECT = {
    label: "Ring of Protection",
    icon: "icons/mystery-man.svg",
    changes: [
      {key: "data.bonuses.abilities.save", value: "+1", mode: EFFECTMODES.ADD},
      {key: "data.attributes.ac.value", value: 1, mode: EFFECTMODES.ADD},
    ],
    transfer: true,
  };
  const item = await Item.create({
    name: "Ring of Protection",
    type: "consumable",
  })
  await item.createEmbeddedDocuments("ActiveEffect", [EXAMPLE_TRANSFERRED_EFFECT]);

  let actor = game.actors.getName("My actor")
  await actor.createEmbededDocuments("Item", [item.data])

  ```
Or just drag the supplied Ring of Protection from the sample items compendium to the actor of you choice.

### Macro Functions 
Because dropping an item onto a character transfers the active effects to the actor many of the activation functions have been scrapped.

The macro functions in dynamicitems have been replaced in DAE with the following (and you will need to modify any macros you have created):
* Show all the active effects on an actor, marked as active/inactive.
  ```
  new DAE.ActiveEffects(actor, {}).render(true)
  ```
* Display a form with enabled/disabled passive and active effects for the selected token. 
  ```
  DAE.doEffects(item, activate, targets, {whisper = false, spellLevel = 0, damageTotal = null})
  ```
  This will transfer the non-transfer effects from the item to the targets.  
  `activate` (boolean) enables/disables the actor effects.  
  `targets` is an array of target tokens or token ids.

## Really cool Core functionality that you can use....
You can add your own custom effects without needing any DAE module changes. Say you want to add the average of str.mod and dex.mod to AC (and DAE does not support it) and the expressions don't work...  

Core active effects has the idea of CUSTOM effects. If one is encountered when processing the active effects on an actor the system calls Hooks.call("applyActiveEffect")

Write a function that does
``` js
  Hooks.on("applyActiveEffect", myCustomEffect)
  
  function myCustomEffect(actor, change) {
    // actor is the actor being processed and change a key/value pair
    if (change.key !=== "data.attributes.ac.value") return;
    // If your active effect spec was 
    // data.actor.attributes.ac.value (change.key) CUSTOM value (the value is not relevant here, but it gets passed as change.value)
    const actorData = actor.data.data;
    actorData.attributes.ac.value += Math.ceil((actorData.abilities.str.mod + actorData.abilities.dex.mod) / 2);
    // Although you can change fields other than the change.key field you should not as the core active effects tracks all changes made.
  }
```

Your custom effects can create new fields on the actor as well (DAE does this for flags.dnd5e.conditions for example). Just reference the field in the active effect spec and it will be created on the actor when the custom effect updates the value. There is no support for "arbitrary" field specification in the DAE UI (yet) so you would have to create the effect on the actor yourself.

## Useful bits.
 * One of the most common things to do with dynamic effects is to create a damage bonus as a number of dice based on level. For DAE this requires a specific syntax in the damage bonus field.
     ```
     (ceil(@classes.rogue.levels/2))d6
     ```
* Changing actor spellDC. The way that works is to use Bonuses Spell DC. Anything else won't do what you want.
* Ability Saving Throw bonuses. The supplied DND5E system does not use the ability save field that you see on the character sheet when rolling saves. Changing that value (which you can do in DAE) will not affect rolls. If you want to be able to change individual ability saving throws you must enable the module setting "Use ability save field when rolling ability saves".
* Some fields are designated as CUSTOM, either they are "special" DAE fields (All-Attacks for example) or the core Active Effect rules don't work for them (damage immunities/languages etc). Generally DAE Custom fields (see list below) add the specified value to the existing data.
* Spell slots. The only way to modify the number of spell slots (that works correctly) is to use the spell slots override field. This is calculated BEFORE any derived values are calculated, so you cannot use ability modifiers or spell slot max in the calculation.

### Initiative
Changes to initiative are challenging due to the way it is calculated and rolled in the dnd5e system. Here is a quick guide to what you can do.
  * `init.value` is now set before prepareDerived data is run, so it appears on the character sheet (in the "mod" field and in the total), but cannot reference dex.mod etc.
  * `init.bonus` is set after prepareDerivedData so will not show up on the character sheet but CAN reference fields like dex.mod
  * `init.total` can be updated and will show up on the character sheet but will NOT be included in rolls.
  
## Sample Items/Macros 
  There is a compendium of items that have been setup to work with DAE. All active effects work best if both Midi-QOL and about-time/times-up are installed and active, but will still function without them.

  The sample macros compendium has been updated. It is very limited but should provide some help in getting started. You should definitely look at the excelled DAE SRD compendia from @Kandashi for a wealth of pre-configured items/spells/macros.

## Module Integrations

### [Midi-QOL](https://gitlab.com/tposney/midi-qol)
When rolling an item (weapon, spell, feature, tool, consumable) using Midi-QOL, non-transfer active effects are applied to the targeted tokens. If the definition of the item indicates that it is self then effects are applied to self. So, a bless spell when cast will apply the active effects to the targeted tokens. 

Midi-QOL uses the Foundry targeting system to decide who to apply effects to. If a spell is marked as target self then the effects are applied to the casting/using actor. 

If you have a feat "sneak attack" then rolling the feat will apply the non-transfer active effects to the token (i.e. weapon attacks do extra damage). For items with a saving throw active effects are applied if the save fails. Other items apply their effects when applying damage/casting a spell (if no saving throw) or consuming an item (e.g. potion).

### [about-time](https://gitlab.com/tposney/about-time)
If the underlying spell, weapon, feat, consumable etc has a duration then the active effects for that item will be applied to the targeted tokens (or self if the item is specified as self) and after the duration specified in the item the effects will be removed. So a bless spell with a duration of 1 minute will apply the active effect bonuses for 1 minute of gametime. A potion of giant strength will apply the new strength for the duration specified in the potion consumable. There are a few sample items in the premade compendium to get you started.

### [times-up](https://gitlab.com/tposney/times-up)
Times-up is the preferred way to expire effects, since as well as time based expiration it support duration in rounds/turns.

In addition times-up provides some special expirations for effects, turn start and turn end which will cause the effect to expire at the start/end of the character's turn.

Times-up also provides 2 macro repeat settings (turn start/turn end). If set for an effect that has a `macro.execute`/`macro.itemMacro` setting, the macro will be called at the start/end of the characters turn, with `args[0] === "each"`. You can use this setting for damage over time effects.

### [GM-Notes](https://github.com/syl3r86/gm-notes)

If the module is installed and active effects can update the actors gm-notes field. A useful place to track info that can't be applied to the character sheet.

### [Combat Utility Belt](https://github.com/death-save/combat-utility-belt)
**as of 0.3.50 the integration with Combat Utility Belt has changed.**  
You create an active effect that takes it's changes from CUB via the drop down list in the DAE Active Effects Screen. "new" is pre-selected but you choose various items from that list, including CUB conditions.

CUB conditions are applied in 2 ways:  
* If you select condition (CUB) from the drop down list DAE will copy the active effect from CUB into the actor/item. From then on it won't change, any changes you make in condition lab will NOT be reflected in actors who have the condition applied via DAE/Midi-QOL.
* Using macro.CUB to apply a condition that is looked up from CUB when applied.


## Issues

### My DAE does X and I think it should do Y. Or it stopped doing X when I updated.
Did you read the [Changelog](Changelog.md)? It often has information that might be relevant to problems.  
When filing an issue **PLEASE PLEASE PLEASE** include at least the following:
* Foundry Version
* DAE version (latest version does not mean anything to me)
* Other modules you are using and their version, especially things like, Midi-QOL and Better Rolls. And if you routinely use more than 10 modules, please make sure you can reproduce the problem with only a few modules loaded. The problem might be a module interaction. I don't have time to investigate the combination of a 100 modules and their interactions with DAE so it has to be narrowed down.
* Try and give a more complete description than X stopped working.

### I get lots of OwnedItem is deprecated when I open a character sheet.
This is not a problem of the character sheet, but rather of the change in item Uuids in 0.8.x.
DAE/Midi-QOL store a reference to the item that created an active effect in the active effect and the created effect will have Actor.id.OwnedItem.id instead of the required Actor.id.Item.id.

There is a script `DAE.cleanEffectOrigins()` which will fix up item origins which include OwnedItem on all actors and tokens in the game. It can be run multiple times either from the console or as a macro.

Needs to be run as a GM.

### My armor class is not calculating correctly
If you have not updated to dnd 1.4.x do so now. The 1.4.x release stream for dnd5e takes over the AC calculation so do the update and then see if you have a problem still.

DAE will run a migration script the first time that you start your world after moving to 1.4 which should remove all DAE related AC features from you actors. If you see any active effects that were generated by DAE after running the script just delete them.

After clean up you will need to check any actors with armor and look at the AC tooltip, if it shows AC Flat and a value edit the AC and change the calculation type to one of the supplied options (normally equipped armor).

You can run `DAE.cleanArmorWorld()` at any time, from the console or as a macro, in case you have actors which did not get cleaned the first time. Needs to be run as a GM.

After dnd5e 1.4.0 you can still use DAE to modify armor class.  
`data.attributes.ac.bonus` is the dnd5e supported field to modify AC and can be used without DAE loaded. It is evaluated BEFORE prepareData is run so no derived fields can use used, i.e. no dex.mod, flags.anything and so on.  
`data.attributes.ac.value` requires DAE to be effective, without DAE changes to ac.value will have no effect. Changes to ac.value are applied AFTER prepareData so can use any field. 

#### After updating to dnd5e 1.4.2 my characters AC is wrong. 
dnd5e 1.4.2 **removed** the magical bonus equipment type and so anything that had a type of magical bonus will stop working. The quickest solution is to create an active effect on the item which sets the ac.bonus to the value that used to be in the magical bonus.

### dnd5e 1.4.3
As of dnd5e 1.4.3 toggling effects based on item equip/attuned is supported directly, so thsi functionality has been disabled in dae if you are on dnd5e 1.4.3 or above. Toggling an active effect will NOT toggle equiping the item.

### dnd5e 1.5
DND5e version 1.5 will have significant impact on DAE. The mechanism for applying bonuses in dnd5e for ability saves, checks and skills will be enhanced to include .bonus field on most of these modifiers. The .bonus field is evaluated when the item is rolled which means that the DAE processing to apply bonuses is no longer required, since the bonus will be looked up at the time the roll is made. After the release of dnd5e 1.5 DAE will provide an automatic mapping for some fields (details to be determined, but will include ability.mod, ability.save and skills) and a deprecation warning. At a future stage the deprecation will change to a not supported. 

**DND5E 1.5 changes**
* New fields str.bonuses.check/str.bonuses.save which are string fields supporting expressions like 1d4 or @abilities.dex.mod (@field lookups to be confirmed).
