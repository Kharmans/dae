0.2.20
Added confirmation dialog and config setting when deleting active effects and changes.
0.2.19
* Move saving throw bonus to base values pass so it can be picked up by dnd5e derived data pass. Should fix the bonus ignored problem.
* Added overload of rollSkill and rollAbilityTest so that @values can be looked up.
* Fix for base AC calculation on polymorphed characters.
0.2.18
Fix for needing to toggle equipment on first equip to set active status correctly.
If times-up is not active, don't convert durations to rounds/turns, leave in seconds for about-time to process.
0.2.17
Limit conversion of minutes -> rounds for up to 10 rounds, longer will stay in seconds.
0.2.16
* Corrected handling of traits.size
* Fixed not setting up CONFIG.statusEffects correctly.
* first steps to no n-dnd5e compatibility.
* some changes to effect duration setting to support times-up
* Fixed an edge case for effects on tokens being removed and calling macros/token magic effects.
* made data.abilities.save/check/skill into custom effects to reduce errors on data entry.
Known Bug: Active Effects on tokens are not removed from the active effects display, but are actually removed from the token.
0.2.14
* fix a bug in deciding to apply effects if dynamic effects is installed.
* add custom option for abilities.save,check,skill fields to handle the string vs number issue.
* Bring back support flags.dnd5e for special traits/weapon critical threshold
* Add a start/end time display for timed effects
* Add a stackable flag for NON-TRANSFER active effects to allow additive application of effects. A stackable effect will add a second copy of the active effect when applied to a target token, rather than replacing it with a reset start time. Settable form the active effect config screen. TRANSFER effects are already stackable.
* Reduced the proliferation of active effects/configure active effects windows.
* Started fixing up some field definitions to enforce modes where approriate.
* added DAE.setTokenFlag(token,flagName, flagValue) and DAE.getTokenFlag functions to allow non-GM users to set/get flags.dae.flagName on a token. Useful to record state on things like traps.
* Maybe an inmprovment on the effect config tab.
* Config option to switch between the Core active effect config shett and the DAE config sheet. It is easier to create effects that don't work with DAE using the default sheet.
* 1/2 of a fix for fastforward of ability saving throws incompatibility with midi-qol.
* Updated cn.json. Thanks Mitch Hwang
* Updated pt-BR.json. Thanks @innocenti
* A little patch for the SW5E guys, it appears they don't like halflings.

0.2.13
* Duration setting on applied effects should be correct now.
Rules are:
If the active effect specifies a duration use that;
ELSE if the item specicfies a duration use that;
Otherwise do not set a duration (which means the status will bot attack to the token).
Instantaneous spells attract a duration of 1 second/turn.
You don't have to be in combat to apply effects anymore.
* Experimental support for editing effects on owned items. YOu cannot add effects to an item only change/delete those already there.
* You can have more than one active effects window open at a time.
0.2.12 
fix for non-string being entered into string
0.2.11
* Fix for eval of non-transfer effect arguments incorrectly adding spaces between terms.
* Added back the ability to reference @values in bonuses.heal.damage.
**Chaged duration setting** for applied non-transfer effects.
* If the active effect specifies a duration then the effect duration is used, if there is no duration specified in the effect the item duration is used, otherwise no duration is set. A duration of instantaneous is either 1 turn if in combat or 1 rounds worth of seconds otherwise.
* When applying an item effect during combat an item duration in minutes is converted to rounds/turns.
* If times-up is installed DAE will not schedule the automatic removal of effects, but leave it to times-up.
* When applying active effects only effects you don't have owner permission on will be applied by the GM. This means that macros will run either in the players client (if they own the target) or on the GM client (if they don't)
0.2.10 
* Fix for very fast timeouts if active effects not installed. A subsequent release will clean up the whole timeout piece.
* Support for new CUB version. When creating an active effect from the acitve effects sheet (item or actor), you can choose one of the CUB effects from the drop down list (left of the + button). This will prepopulate with the CUB data, so equipping (if transfer) or applying if non-transfer will trigger the cub condition. Removal will work as well.
* "Fix" so that subsequent applications of the same active effect on the same target don't stack but extend duration. 
* Support multiple non-transfer effects on an item. E.g. A spell that does +1AC for 120 seconds and a CUB condition (Invisible say) 180 seconds. Each effect expires individually.
* Fix for armor migration. Shields now have priority 7 and base armor priority 4, so there should be no conflict. If you have not editied effects you can rerun migration with no problems.
0.2.9 cant remember
v0.2.8 bugfix for transferred effects
v0.2.7
Remove dnd5e class/module references so that it should work out of the box for sw5e
v0.2.6
Added support for itemCardId being passed through the eval stage, added ciritcal and fimble as @parameters.

v0.2.5 packaging
v0.2.4 fixes a bad bug in item creation with transfer effects
v0.2.3 packaging issue
v0.2.2
Display error message if macro not found and don't throw error.
Some support work for DamageOnlyWorkflows in midi-qol
v0.2.1
* Due to a brain spasm I completely messed up the implementation of conditions. Now, DAE uses CONFIG.statusEffects to apply conditions. You can add a condition effect to an item/actor by selecting from the drop down list next to the add effect button which will create a prepopulated effect for you. 

For actors it is easier just to use the status effects toggle from the HUD (core functionality). 

Conditions can be transfer/non-transfer and should just work, over time I will add actual effects for conditions. There are some oddities with conditions and immunities, but sort of work.
* Cub condition support will require the next release of CUB (my implementation was just too broken).
* The filter feature on Actor/Item Active sheets was stupid and I've cleaned that up to be more obvious.
* Fix for simple bonuses like the number 1 not working.
* Fixed a bug in the non-transfer active effect code that ignored @spellLevel and @item.level
* Fixed a few bugs with disabled/enabled effect settinngs.

In dynamic effects there were passive and active effects. As of 0.7.4 the rule is
* transfer effect === passive effect (in dynamic effects)
* non-transfer effect === active effect (in dynamic effects)l not to be confused with 0.7.4 "Active Effects" which covers both transfer and non-transfer effects.

So changes to AC from having armor is a transfer effect (applied to the actor hen the item is equpped) is a passive effect.
A bless spell that adds to the target saves/AC when cast is a non-transfer effect, and requires application to be applied to the target. Having the spell in your inventory does not increase your AC, but casting the spell on something increases the something's AC/Save. This is a non-transfer effect.

Unlike dynamic effects, you can create (0.7.4) "Active Effects" directly on an actor, e.g. +1 damage bonus, even if there is no item that created the effect.

## v0.2.0
Quite a lot of changes under the hood in this one.
DAE is compatible with and requires 0.7.4 and in anticipation of changes in 0.75 there are lots UI changes.
1. **The effects tab has been removed** (0.7.5 will add one back) Actors and Items now have a title bar option "Active Effects" that brings up a list of effects which you can edit to your hearts content and it uses the new 0.7.4 edit screen with some extra wrinkles to list availabe fields, restrict the available modes and provide a dropdown for fields that have defined values.
2. **Editing Owned Item effects has been disabled** (pending resolution in the 0.7.5 release). So if you want to change the Active Effects definition of an owned item you must drag it to the sidebar, edit it and drag it back.

* All automatic armor effects are active only if "calculate armor" is anabled. You can still have effects that modify armor class.
* Added base AC = 10 + dex mod for characters (so generic npcs won't have a base armor class). If you have actor enemies configured as characters you will need to set their armor or disable armor effects. The base AC is priority 1 so anything else will override it.
* Corrected armor effects, 
  * heavy armor ALWAYS just uses the armor value and the dex mod field is ignored.
  * medium armor defaults to a max dex mod of 2, but will use whatever is entered.
  * light armor defaults to a max dex mode of 99, but will use whatever is entered.
* Chnages to armor items automatically update the actor effects.

* First pass support for conditions, considered experimental. Config setting active conditions => none/CUB/default. You can specify an effect (Flags Condition) which adds the condition to flags.dnd5e.conditions (a DAE only field).
  * If CUB is active and active conditions = "Combat utility belt" DAE will apply the CUB condition to the target.  
**Be aware that having the CUB module active disables the default behaviour of adding the active effect icon to the character and the default**
  **Cub also disables the default creation of active effects when setting a condition from the HUD**  
  * If active conditions is set to default DAE will toggle the condition on the target token and apply cany conditions specified in CONFIG.statusEffects. (Over time I will implement a few/some/many of the actual condition effects in DAE/midi-qol).

* Support for quick entry items. There is a problem with quick entry adding the item, rather than the item data.

* Initial support for SW5E, there will be bugs - I promise. If there are other systems out there that are dnd5e with wrinkles they are pretty easy to support in DAE - just ping me.

* Corrected some migration issues not properly bringing acroos always active/active when equipped.

### Known Bugs:
Token status effect application for non-linked tokens has some bugs so be warned.

* Note for macro/module users. You can add your own custom effects without needing any DAE module changes. Say you want to add the average of str.mod and dex.mod to AC (and DAE does not support it) and the expressions don't work...
Core active effects have the idea of CUSTOM effects. If one is encountered when processing the active effects on an actor the system calls Hooks.call("appyActiveEffect")
  * Write a function that does
```
  Hooks.on("applyActiveEffect", myCustomEffect)
  
  function myCustomeEffect(actor, change) {
    // actor is the actor being processed and change is the target field
    // If your active effect spec was 
    // data.actor.attributes.ac.value (change.key) CUSTOM value (the value is not relevant here, but it gets passed as change.value)
    actor.data.data.attributes.ac.value += Math.ceil((actor.data.data.abilities.str.mod + actor.data.data.abilities.dex.mod) / 2);
  }
```
Your custom effects can create new fields on the actor as well (DAE does this for flags.dnd5e.conditions for example). Just reference the field in the active effect spec and it will be created on the actor when the custom effect updates the value.

## v0.1.8
Support add/remove macro/token magic effects for non-linked tokens.
Added compendium/actor fixup for data.bonuses.mwak/rwak/msak/rsak. See Readme.md
Fix data.spells.spelln.override active effects.
Fix for item migration not bringing across activeEquipped/AlwaysActive flags from dynamiceffects.
Fix for dice-so-nice integration not working properly with combo-cards.
Added a few other damage/attack bonus combinations custom fields.
Interim timeout was broken. Fixed version does the following:
* If about-time is installed, non-transfer effects are auto removed after game time duration as specified in the spell details. If no spell details exist they are removed after 6 real time seconds.
* If about-time is not installed effects are removed after spell details duration real time elapses or 6 real time seconds if no duration is specified.
* If about-time is not installed timeouts are not persistent across reloads.