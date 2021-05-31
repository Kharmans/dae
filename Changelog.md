## 0.8.6
* Fix about-time effect only expriy when there is an effect duration specified (rather than an item duration) which would expire next round. This was not a problem if times-up was installed.

## 0.8.5
* Added support for flags.dnd5e.initiativeDisadv which forces disadvantage on initiative rolls
* Fix for data.attributes.prof effects.
* fix for spellcasting dc not being set when updating abilitiy.dc
* Fix for adding spaces to roll expression on effect apply.
* Note. With 0.8.x if an attribute is being modified by an active effect the underlying can't be changed. This is a foundry feature not a dae one.
* Fixed a bug in dae such that once an attribute was modified by an active effect it could no longer be changed even if the effect was removed.

## 0.8.4
* fix for window reload loop when use ability save setting is false.

## 0.8.3
* remove some left over debug.

Issues: 
* Occascional problem when expiring concentration effects (versus removing concentration) via times-up/about-time which leaves an effect present after reload. Should not happen with CUB when that is available for 0.8.x

## 0.8.2
* Fix for activating items dragged from compendiums to an actor.
* Improve duration display for item effects before they are transferred from the item to the actor.

## 0.8.0/1
* Updated for new foundry version 0.8.3 and dnd 1.3.1 (both required).
* Armor updates now recognise the armor dex value if present, which overrides light/medium/heavy.
* Editing an owned item's transfer effects will update both the item and the actor effects.
* Updated concentration to remove requirement for CUB concentration. Will use CUB concentration if present, otherwise will use MQ internal version. Different icon so you can tell which is active. Will work standalone until CUB is 0.8.x compatible.  
* Needs to be side loaded from:  
https://gitlab.com/tposney/dae/raw/08x/package/module.json

## 0.2.62
* Fix to make flags data available in actor.getRollData()
* Some more sw5e tidy up in dae editor to support SW5E specific CONFIG.

## 0.2.61
* Updated for change in MidiQOL.configSettings
## 0.2.60  
* Added config flags noDupDamageMacro which if set will remove duplicates of the same damage macro from the actor traits. Useful if you have an omnibus damage macro that covers several effects.
* Allow flags.dae CUSTOM flagName @flags.dae.flagName + 1, without throwing undefined warning
## 0.2.59  
* Added  support for 1Attack:mwak, 1Attack:rwak, 1Attack:msak and 1Attack:rsak special durations.
## 0.2.58  
* Added export of Dae.deleteActiveEffect(tokenId, uuid) to remove effects identified by uid from the token identified by tokenId. Will pass to a GM client if required/available.
## 0.2.57  
Support for some more expiry modes for midi-qol.
## 0.2.56  
* First pass cleaning up special duration editing.
* Added damage dealt special duration expiry.
* Changed flags.dnd5e.... to allow any mode. Unless you know what you are doing CUSTOM mode is recommended.
## 0.2.55  
* Fix for double adding global save bonus.
## 0.2.54  
* Fix for special durations not displaying if times-up not installed.
* Fix for creation of enormous durations when updating existing duration.
## 0.2.53  
Support for skill-customization-5e so that you can add roll bonuses (like 1d4) to skills via dae. Requires skill-customization-5e to be installed. Remember to put a + in fromt of the bonus, otherwise it will simply concatenate with the existing field.
* support for sw5e A4 release.
* Fix for double adding global save bonus.
* [BREAKING] For all of the core dnd5e bonus fields, the allowed modes have been changed to allow any mode type. **Unless you have a specific need for non custom** you should choose CUSTOM for these fields, which acts like a smarter ADD. If you don't do custom you will need to make sure that you add the + in front of the field as required and @field lookups will only be done at roll time, not before.
## 0.2.52  
* added support for attributes.movement.hover
* added support for new special duration fields
## 0.2.51  
* Added bug reporter support.
* Reenabled handling of missing fields in damage rolls. (won't affect most people).
* Fix for ignoring single simple numeric bonuses.abilities.save when using DAE modified saving throw.
* updated ja.json, thanks Brother Sharp and @louge
## 0.2.50  
* Fixed a bug in conditional visibility setting
* [BREAKING] Moved data.attributes.prof to prepare data phase. No referencing derived values (abilities.cha.mod etc) in effects that modify data.attributes.prof. Should now correctly update those things that depend of data.attributes.prof.
* [MAYBE-BREAKING] Change to string fields. @fields that can be evaluated when doing prepare data will be looked up. So a damage bonus of (@classes.rogue.levels)d6[fire] will be replaced with (3)d6[fire] when applied to the damage bonus field. Dice rolls and fields that do not exist when the evaluation is done (1d4, or @item.level) will be left unchanged.
* Minor changes to the special handling of (expr)d6 effects. Any problems ping me.
* Added handy dandy spreadsheet for flags.midi-qol settings thanks (dstein766)
https://docs.google.com/spreadsheets/d/1Vze_sJhhMwLZDj1IKI5w1pvfuynUO8wxE2j8AwNbnHE/edit?usp=sharing
* updated ko.json, cn.json many thanks @klo and Mitch Hwang

## 0.2.49  
* Fixed an error in passing parameters to macro.execute/macro.itemMacro when there are no @parameters.
* A little re-ordering of actions when adding/removing concentration that hopefully will remove a DAE/CUB race condition.
* Deprecation of @actor as a macro parameter.
* Added an additional special trait, Damage Bonus Macro (flags.dnd5e.DamageBonusMacro), which is a comma separated list of macro names that midi-qol will call wehen calculating damage for a successful damage applicaiton. See midi-qol for details.
* When set via CUSTOM mode, dae will handling creating the comma separated list. 
* Appears on the special traits page and can also be set by hand there.
* Adding damage this way is expensive since it requires a macro compilation and execution each time you do damage. If you can add the damage via bonuses.mwak.damage you should do so.
## 0.2.48  
* Updated ja.json
* Ensure that tokenId is set in lastArg for macro calls.
* Make multi select more visible.
## 0.2.47  
* Fix for @target not being correctly set with multiple targets.
* Remove dependency on game.Gametime, uses window.Gametime instead.
## 0.2.46  
* Fix for sw5e non-equipped items not setting disabled correctly on transferred effects.
## 0.2.45  
* Fix for multiple GMs logged in and concentration
* Fix for broken multi effect application.
## 0.2.44  
Packaging issues.
## 0.2.43  
* Fix for editing conditions if CUB installed but active conditions not defined.
* A couple of fixes for sw5e.
* Many changes to support concentration automation in midi-qol.
* [BREAKING] Sort of, well not much, actually much better. The item flags active for equipped/always active for transfer effects have been removed and replaced with a new rule and no checkboxes.
* **Transfer effects** for feats and spells are toggled from the dnd5e effects tab.
* Anything else follows the rule that transfer active effects for the item are enabled if it is equipped and is not "requires attunement" using the data from the item itself.  

This make much more sense. Feats you enable/disable from the actor/item effects tab.
Things, rings, weapons etc, must be equipped and either be attuned or  attunment not required for the effects to be enbled.

With this change the DAE Actor/Item effects window is only required for editing owned items. Everything else can be done from the standard dnd5e actor/item effects tab. If youenable the DAE active effect editor as the default editor you really never need to click on the DAE button on the title bar.

* When an item is first added to an actor the "suspended" flag on the item is used to set the initial enabled/disalbed state.
* And, as has always been the case, you can override item **transfer effects** enabled/disabled status form the actor effects tab and will remain enabled/disabled until the item updates (e.g. equipped/unequipped).

## 0.2.42  
* Remove accidental dependency on midi-qol.
* supply awesomeplete.css.map
## 0.2.41  
* Fix for mods to data.attributes.prof calling of _computeSpellCastingProgression being undefined.
* Fixed a couple edge cases in dae.setFlag/dae.getFlag/dae.unsetFlag if you were passing a token instead of an actor.
* In the effects drop down list any effects that are influenced by DAE behaviour are marked with (*). This means that either it is only supported via DAE, or that it is a DAE CUSTOM field, or the change is applied after prepareData would normally apply the change. This gives you an idea of what effects will work if there is no DAE installed. iN particular all the flags.midi-qol fields WILL work without DAE.
* [BREAKING] when transfering a non-transfer effect the suspended value in the effect definition will be used, rather than the previous behaviour of it always being false.
* Allow removal of weapon/armor/tool profs ci/dr/di/dv via the CUSTOM field (-value in drop down list).
* Added auto complete for change target field. Do choose from the yellow list when using the auto-complete it will set the valid Modes and populate data as appropriate, at most ten matches are displayed, you can match on any part of the string. (The list of midi-qol flags is partially hand generated and it would be a mircale if there is not a typo in there somewhere so be warned, also in the first pass I include everything that dae knows about so it's possible something that should not be there is).
* All of the flags.midi-qol fields are set to force override.
* added macro.CUB to apply CUB conditions to target actors. Effects applied via cub.addCondition() and removed via cub.removeCondition() so applied effects will match current CUB definitions.  (Requires combat-utility belt). This is probably the better way to apply cub conditions to tokens.
* added macro.ConditionalVisibility that lets you set conditional effects onto tokens. (Requires conditional-visibility) For example if you specify macro.ConditionVisibility CUSTOM invisible the token will be come invisible and disappear for actors that don't have seee invisible (see below).
* added macro.ConditionalVisibilityVision that lets you set conditional visibility vision effects onto tokens. (Requires conditional-visibility active) maacro.ConditionalVisibilityVision seeinvisible will let the recipient see invisible tokens.

* Clarification: any of the macro effects ONLY work if transferred from an item to an actor (either transfer or non-transfer) but will not work if the effect is manually created on the actor. The effect is applied on effect creation (macros called with "on") and removed on effect deletion (macros called with "off"). Suspending the effect has no effect on these, only creation and deletion.

## 0.2.40  
* Support data.arritbutes.movement.all (CUSTOM EFFECT ONLY) supporting
  * value => replace current with value
  * +value => add value to current
  * -value => subtract value from current
  * *value => multiply current by value
  * /value => divide current by value
The leading character in the string is what effects the overall evaluation, so +5 is NOT the same as 5.
* Fix a subtle bug in the data.bonuses.All-Attacks etc custom effects, which would double apply if using the DAE alternate special traits page.
* SpecialDuration is now a multi select field. All options chosen will be checked to see if the effect should expire, if you make silly combinations be it on your head. (ctl/shift to multi select)
* A lot of rework to make things more sw5e compatible.
* Boolean flags values (Halfing Lucky, Elven Accuracy and so on) now support ONLY CUSTOM as an action type and accept 1 or true to turn flag on, anything else turns it off.
* Fixed a bug in effect editing where the changes to actor effects would only show up when the actor prepareData is called.

* [macro.execute] It turns out that the orgin passed in lastArg ALWAYS refers to the world actor, not the token actor that caused the macro to be run. So if you want the actual item refer to lastArg.efData.flags.dae.itemData instead.
* If using DAE.setFlag(actor, flag, value)/DAE.getFlag(actor, flag) or DAE.unsetFlag(actor, flag) it would always affect the world acotr. You can now pass a token/tokenId to the function and it will affect the actor associated with the token, rather than the world actor.
* ~~Some~~ Lots of fiddling with macro.execute behaviour to try and make item data more reliable. Smallish, but non-zero chance that some macro.execute behaviour got broken.
* A fix for created ownedItems having the correct origin set for contained active effects.

## 0.2.39  
* Bugfix for @item returning item.data.data instead of item.dat
## 0.2.38  
* Bugfix for spaces in token magic effect application
## 0.2.37  
* Bugfix for vanishing effect values when applied  
## 0.2.36  
* Fix for TrapWorkflow not auto fast forwarding rolls.
* Fix? for changes to proficiency bonus.
* **special durations/macro repeats only shown if the required modules loaded (midi-qol/times-up)**.
* Part of a co-ordninated release with times-up (required) to support calling a macro at the start/end of a tokens turn. This allows most effects that do something each turn.
  * Create an effect, macro repeat set to startEachTurn or endEachTurn and any macros on the effect will get called each turn (requires times-up), with args[0] set to "each". 
    * You can delete the effect as part of the macro. There can be other changes in the effect and they will remain active until the effect is deleted. 
    * You can specify a time based expiry as well.
    * See times up for some sample macros that you can use for these sorts of effects
* Pass an additional argument to each macro with some useful information (see the times-up readme for sample usage of the fields):
```
  {
    effectId,
    origin,
    efData,
    actorId,
    tokenId
  }
```

## 0.2.35  
* Support @@... fields in macro arguments, to defer evaluation. Specifically for some edge cases in Active Auras.
* There are too many bugs in the current CUB:Condition code - so I'm going to disable it for now.
## 0.2.34  
* Fixes for CUB: conditions editing. Both runtime lookup via CUB:Condition and effect creation time copy of active effects are supported at the same time.
* fix for not creating status icon for CUB:Condition.
* new effect list now displays "CUB:Condtion" for runtime lookup and "Condition (CUB)" for creation time copy effects.
* you can disable CUB: via the config setting flag.
* [BREAKING] migrateActorDAESRD now copies the existing items equipped/attuned flag.
* Updated Readme.md with a description of Cub conditions and how they work.

## 0.2.33  
* Change to flags.DAE CUSTOM flagName rollExpression. Values set this way are available to other roll expressions via @flags.dae.flagName, for example in attack/damage rolls or whatever.
* Support for CUB: active effects. If the effect label is CUB:conditionName (e.g. CUB:Blinded) the active effect will be loaded from CUB during perpareData, the CUB condition activeEffect will REPLACE ALLL data in the active effect (don't put other changes with the CUB:condition). The link between cub conditions and DAE will be "live", except that changing CUB conditions does not trigger prepareData you will need to edit the actor or reload for changes made to cub conditons to take effect.
* New config flag. If lookup CUB is set the DAE create effect for CUB conditions will create a lookup effect.
* Removed extra call to _prepareOwnedItems in dae prepareData as it caused some problems. This will break active effects that change item properties until I can find a fix.

## 0.2.32  
* Added it.json thanks @Simone [UTC +1]#6710 
* Fix for token magic effects on unlinked tokens  
* flags.dae custom field format remains flagname values, but values are now evaluated.
  So flags.dae CUSTOM test @abilities.dex.mod will set the flag to the value of the modifier.

## 0.2.31  
* Fix for data.bonuses.weapon.attack not working.
* updated ja.json thanks @louge

## 0.2.30  
* fix for creating new equipment on character sheet throwing an error.
* Incorporated libwrapper thanks dev7355608
* [BREAKING] Change module.json to work with dnd5e/sw5e only, due to silent incompatibilities with other systems. If you want others added let me know.

## 0.2.29  
* Interim solution to display post active effects values in special traits page. This will last only unitl there is a dnd5e core solution to seeing what the post active effect application bonsues/flags are. Enable via config setting, requires reload.
* update ja.json. Thans @touge
* fix for spellCriticalThreshold active effect
* fix for sw5e and proficiency mods, save mod rolls, damage bonuses.

## 0.2.28  
* fix for effects not being removed from DAE Active Effects when displaying a token's effects.
* Fix for 1.2.0 attunement changes (which should fix the equip item active effect problem)
* support the new attributes.senses changes
* Added new senses darkvision etc text.
* [Experimental] First stage of active effects that support changes to actor owned items. This is definitely experimental, use at your own risk. Reference the item as:
* items.name,(or items.index;
*  items.Longsword.data.attackBonus (the first item named Longsword)  
  items.Longsword.data.attackBOnus ADD 2
* items.5.data.attackBonus (for the 5th item - not very useful)
* items.actionType..... where action type is one of:
    ["mwak", "rwak", "msak", "rsak", "save", "heal", "abil", "util", "other"]

to change all melee weapons to use cha mod instead do:
```
items.mwak.data.ability OVERRIDE cha
```
```
items.mwak.data.damage.parts[0][1] ADD +1d4
```
all melee weapons do an extra 1d4 damage.(You would not do this since there is already a bonuses field that does this)

## 0.2.27  
* [BREAKING] change to special expiry effects:
* removed from item duration (too cluttered)
* added as optional field in Effect Duration panel. (You must use DAE effect editor)
* If about-time is installed and enabled and a temporary effect has a duration in seconds, the remaining time in the DAE effects window will show the remaining time in H:M:S.
* Added support for isAttacked and isDamaged expiry conditions.
* When entering the start time on the DAE duration tab the value is interpreted as an offset from the current game time. So 0 means now +60 means in 1 minutes time, -30 means 30 seconds ago.

Example: Guiding Bolt. Start with the SRD guiding bolt spell  
* Bring up the DAE editor for the item and add an effect.
* On the duration tab, set the duration to be 1 round + 1 turn and the special expiry isAttacked.
* On the effects tab add an effect
flags.midi-qol.grants.advantage.attack.all OVERRIDE 1.  
Now when you cast the spell at a target and hit, the effect will be applied that grants advantage on the next attack.

## 0.2.26 remove setupDAE macro errors  
## 0.2.25  
* added 3 DAE.functios, 
```
DAE.setFlag(actor, flagName, value)
DAE.unsetFlag(actor, flagName, value)
DAE.getFlag(actor, flagName)
```
to allow setting/getting/unsetting flags in the dae scope even if the actor is not owned by the caller.

* [BREAKING[ Initiative changes
  * init.value is now set before prepareDerived data is run, so it appears on the character sheet (in the "mod" field and in the total), but cannot reference dex.mod etc.
  * init.bonus is set after prepareDerivedData so will not show up on the character sheet but CAN reference fields like dex.mod
  * init.total can be updated and will show up on the character sheet but will NOT be included in rolls.


* [Requires midi-qol 0.3.34+] Items support additional active effect durations that can be specified:
  * 1Attack: active effects last for one attack - requires workflow automation
  * 1Action: active effects last for one action - requires workflow automation 
  * 1Hit: active effects last until the next successful hit - requires workflow automation 
  * turnStart: effects last until the start of self/target's next turn (check combat tracker)  
  * turnEnd: effects last until the end of self/target's next turn (checks combat tracker)  
  All of these effects expire at the end of combat

  * new settings flag to enable/disable real time expriy of effects if no about-time/times-up installed.

## 0.2.24  
* Reduce restriction on some of the the custom fields.
* Fix for armor/weapon proficiences active effects if the list was empty
* Fix for forced mode effects not picking up the mode correctly.
* Added functions to migrate actor owned items to Dynamic-Effects-SRD items. The function will look through an actor and replace items that have analogues in the Dynamic-Effects-SRD (and optionally the DND5E SRD). This is useful for characters that have been imported with vtta-beyond. Or any actors whose items could do with a refresh.
```
DAE.migrateActorDAESRD(actor, includeSRD)
```
actor is any actor, includeSRD is a boolean, if true will also use the DND5E compendia for migation.
This is a new feature and might have bugs - I managed to trash one test world with an earlier version - so MAKE A BACKUP OF YOUR ACTOR FIRST!!!!!.
Example
```
DAE.migrateActorDAESRD(game.actors.getName("The name of the actor"), false)
```
Update ko.json thanks @KLO
## 0.2.23  
* Added disable base AC calc (10+dex.mod). Use this wwith care since disabling it means the base AC for the character will be whatever you type into the AC field.
* A few tidy ups on the ActiveEffects screen. Show effect source, show fields that do not have labels instead of None.
* Changed auto created AC effects to show the effect as the name.
* Updated ko.json thanks @KLO
## 0.2.22  
* Modify DAE config to support both pull down list of fields and direct enttry of fields. There is no checking done for direct entry fields so you are on your own if you type in the wrong thing.
* DAE window for actors/items ALWAYS use DAE active config. Opening an active effect from the actor/item effects tab on the item/actor is now configured via the config setting.
* Fix bug for negative DEX mod in AC calc for imported items. This will require you to remove from the actor inventory and readd the armor that is causing problems to the actor inventory.
* [BREAKING] Effects that modify derived fields, like dex.mod, would not be included in later active effects if the target field is numeric. e.g. a change to dex.mod would not impact AC (which uses dex.mod for light/medium armor). They now affect the later calculations provided there priority # is less than that of the later calc. So setting dex.mod + 5 prioirty 1, will impact AC calculations which run at priority 7 by default.
## 0.2.21  
* Updated to support new critical hit flags.
* Move other flags to base data pass to ensure derived fields are processed.
* Fix for 0.99 bug that duplicates applicaiton of bonuses.
## 0.2.20  
* Added confirmation dialog and config setting when deleting active effects and changes.
* Added new data.abilities.ABL.dc to modifgy individual saving throw dcs.
* Put back support for @damage, @fumble, @critical, @whipser in non-transfer effects that are not macros. If this affected you you'll know.
## 0.2.19  
* Move saving throw bonus to base values pass so it can be picked up by dnd5e derived data pass. Should fix the bonus ignored problem.
* Added overload of rollSkill and rollAbilityTest so that @values can be looked up.
* Fix for base AC calculation on polymorphed characters.
## 0.2.18  
Fix for needing to toggle equipment on first equip to set active status correctly.
If times-up is not active, don't convert durations to rounds/turns, leave in seconds for about-time to process.
## 0.2.17  
Limit conversion of minutes -> rounds for up to 10 rounds, longer will stay in seconds.
## 0.2.16  
* Corrected handling of traits.size
* Fixed not setting up CONFIG.statusEffects correctly.
* first steps to no n-dnd5e compatibility.
* some changes to effect duration setting to support times-up
* Fixed an edge case for effects on tokens being removed and calling macros/token magic effects.
* made data.abilities.save/check/skill into custom effects to reduce errors on data entry.
Known Bug: Active Effects on tokens are not removed from the active effects display, but are actually removed from the token.
## 0.2.14  
* fix a bug in deciding to apply effects if dynamic effects is installed.
* add custom option for abilities.save,check,skill fields to handle the string vs number issue.
* Bring back support flags.dnd5e for special traits/weapon critical threshold
* Add a start/end time display for timed effects
* Add a stackable flag for NON-TRANSFER active effects to allow additive application of effects. A stackable effect will add a second copy of the active effect when applied to a target token, rather than replacing it with a reset start time. Settable form the active effect config screen. TRANSFER effects are already stackable.
* Reduced the proliferation of active effects/configure active effects windows.
* Started fixing up some field definitions to enforce modes where approriate.
* added DAE.setTokenFlag(token,flagName, flagValue) and DAE.getTokenFlag functions to allow non-GM users to set/get flags.dae.flagName on a token. Useful to record state on things like traps.
* Maybe an inmprovment on the effect config tab.
* Config option to switch between the Core active effect config sheet and the DAE config sheet. It is easier to create effects that don't work with DAE using the default sheet.
* 1/2 of a fix for fastforward of ability saving throws incompatibility with midi-qol.
* Updated cn.json. Thanks Mitch Hwang
* Updated pt-BR.json. Thanks @innocenti
* A little patch for the SW5E guys, it appears they don't like halflings.

## 0.2.13  
* Duration setting on applied effects should be correct now.
Rules are:  
If the active effect specifies a duration use that;  
ELSE if the item specicfies a duration use that;  
Otherwise do not set a duration (which means the status will bot attack to the token).  
Instantaneous spells attract a duration of 1 second/turn.  
You don't have to be in combat to apply effects anymore.  
* Experimental support for editing effects on owned items. You cannot add effects to an item only change/delete those already there.  
* You can have more than one active effects window open at a time.  
## 0.2.12  
* fix for non-string being entered into string
## 0.2.11  
* Fix for eval of non-transfer effect arguments incorrectly adding spaces between terms.
* Added back the ability to reference @values in bonuses.heal.damage.
**Changed duration setting** for applied non-transfer effects.
* If the active effect specifies a duration then the effect duration is used, if there is no duration specified in the effect the item duration is used, otherwise no duration is set. A duration of instantaneous is either 1 turn if in combat or 1 rounds worth of seconds otherwise.
* When applying an item effect during combat an item duration in minutes is converted to rounds/turns.
* If times-up is installed DAE will not schedule the automatic removal of effects, but leave it to times-up.
* When applying active effects only effects you don't have owner permission on will be applied by the GM. This means that macros will run either in the players client (if they own the target) or on the GM client (if they don't)

## 0.2.10  
* Fix for very fast timeouts if active effects not installed. A subsequent release will clean up the whole timeout piece.
* Support for new CUB version. When creating an active effect from the acitve effects sheet (item or actor), you can choose one of the CUB effects from the drop down list (left of the + button). This will prepopulate with the CUB data, so equipping (if transfer) or applying if non-transfer will trigger the cub condition. Removal will work as well.
* "Fix" so that subsequent applications of the same active effect on the same target don't stack but extend duration. 
* Support multiple non-transfer effects on an item. E.g. A spell that does +1AC for 120 seconds and a CUB condition (Invisible say) 180 seconds. Each effect expires individually.
* Fix for armor migration. Shields now have priority 7 and base armor priority 4, so there should be no conflict. If you have not editied effects you can rerun migration with no problems.

## 0.2.9 cant remember  
v0.2.8 bugfix for transferred effects  
v0.2.7  
* Remove dnd5e class/module references so that it should work out of the box for sw5e
v0.2.6  
* Added support for itemCardId being passed through the eval stage, added ciritcal and fimble as @parameters.

v0.2.5 packaging  
v0.2.4 fixes a bad bug in item creation with transfer effects  
v0.2.3 packaging issue  
v0.2.2  
* Display error message if macro not found and don't throw error.
* Some support work for DamageOnlyWorkflows in midi-qol

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
