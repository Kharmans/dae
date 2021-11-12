

### v0.9.1
* Actors that are imported into foundry, or are duplicated, that have transfer effects (passive) will have the link between the effect and the item broken, which means that toggling equip/unequip will not work on the imported/duplicated actor. DAE.fixTransferEffects(actor) will restore item links.

### 0.8.64
* Fixes for various DAE.functions which I inadvertantly broke when migrating to libsocket.

### 0.8.63
Small fix for transfer effects having the flag set correctly.

### 0.8.62
* Added ATL. fields, including ATL.preset - processing ATL effects is handled by the ATL module - DAE just sets up the data for it.
* Added all flags.midi-qol to drop down list so that you can see all the supported flags.midi-qol fields.

### 0.8.61
* **BREAKING** DAE now requires socketlib as a dependency. This means that DAE.GMAction is no longer available, if that causes any problems please DM me and I'll see what can be done.
* @fields can include "-" in the field name for passing as arguments in active effects.
* Added flags.dae.deleteOrigin, which if present as a change in an active effect will, when the effect is deleted from the actor, attempt to delete the item pointed to by the effect's origin. The change value does not matter. Only delete owned items of an actor (any actor) will be deleted, and wont delete World Items or Compendium Items, can be useful for one shot items that you want to remain until the effect they created expires.
* Added flags.dae.deleteUuid whose value is an ownedItem uuid or token uuid, when the effect is removed the entity pointed to by the change.value's uuid will be removed. Only tokens/ownedItems are supported. This is useful for summoning and gives an easy way to remove the summoned token when the effect/spell expires, or for spells/features that create temporary items on the actor which need to be removed on effect expiry.
* Updated ja.json - thanks @Brother Sharp

### 0.8.60
* Added config setting to disable the warning messages about deprecated fields.
* Some cleanup functions to get rid of the deprecated fields in active effects for actors and items. Please backup your world first - I have run these over my worlds without problems, but there could be lurking bugs.
async DAE.fixDeprecatedChangesActor(actor) - e.g. 
```await DAE.fixDeprecatedChangesActor(game.actors.getName("fred"));```
async fixDeprecatedChangesItem(item) - e.g. 
```await DAE.fixDeprecatedChangesItem(game.items.getName("Fireball"))```
async fixDeprecatedChanges() - fix all actors/tokens/items
```await DAE.fixDeprecatedChanges()```

### 0.8.59
* Getting ready for dnd5e 1.5. This dnd5e release means some of the features of DAE are no longer required which is great. Once you upgrade to dnd1.5e some features in DAE will change - most are not breaking (I hope).

**Most derived fields now have .bonuses values available:**
data.abilities.str.bonuses.save/.check. This field supercedes the DAE support of data.abilities.str.save and data.abilities.str.mod, in much the same way data.attributes.ac.bonus means changes to data.attributes.ac.value are no longer required.

values that have .bonuses available:
  - abilities.str/dex/cha etc, bonusess.check, bonuses.save
  - skills.acr/per/prc etc. have a bonuses.check and bonuses.passive.
  - attributes.ac.bonus
These fields support the the use of @values and dice expressions when specifying the bonus - and this is a core dnd5e effect - dae is not required for this.

Global bonuses have been enhanced to accept @fields for all bonues, instead of just the rwak/mwak/rsak/msak fields. As far as I am aware the new fields are supported in DAE immediately.

Accordingly effect changes to the derived values for abilities, skills and ac are deprecated and will generate an error in the console if used, whilst still working. A later version will make this a notification in game and subsequently they will be disabled entirely.

 Effects to change (they will eventually be removed from dae)
 data.abilities.str/dex/cha.save -> data.abilities.str.bonuses.save
 data.abilities.str/dex/cha.mod -> data.abilities.str.bonuses.check
 skills.acr/per/prc/etc.bonus (use skills.prc.bonuses.check) and skills.rpc.passive (use skills.bonuses.passive instead).

**BREAKING in 1.5.1 of dnd5e**
 * Now that you can specify a save.bonus field for each ability you no longer need the DAE saving throw replacement roll. I will disable the dae replacement saving throw which uses ability.save rather than ability.mod. This will be disabled when dnd5e reaches 1.5.1.
* **You should switch off this flag in DAE (and disable the DAE saving throw) as soon as practical since the new abilities.bonuses.save are not compatible with the DAE version.**
* I have decided to disable this sooner, rather than later, since the new bonuses.save fields are a better alternative and I don't want DAE getting in the way of the new mechanic.
 
### 0.8.58
* Add healing/temp hp as damage types for resistance/immunity/vulnerability.
* Fix for some spurious token magic effect application.
* Fix for duplication of proficiency bonus when using dae saving throw patch.

### 0.8.57
* StatusEffect is now supported for both transfer and non-transfer effects. With this change it is now the strongly preferred way to apply status conditions to targets.

* data.abilities.str/wis/dex.dc now supports expressions. This was introduced to provide a very hacky solution to the problem of setting a fixed spell dc for a characteer. If you have a spellcasting ability of int then setting an active effect as 
```
data.abilities.int.dc CUSTOM 30 - @abilities.int.dc
```
will end up setting the int spell dc to 30 and the overall character spell dc to 30.

### 0.8.56
* dnd5e 1.5.0 initiative roll compatability fix.
* added en.json fields for new times-up expiry options

### 0.8.55
* Fix for some actors having traits custom === null instead of "".
* Some effect creation/deletion cleanup to be ready for 0.9

### 0.8.54
* improved condition immunity behaviour. conditions to which you are immune (same name) will not have their effects applied.
* Fix for status effects drop down list.
* Fix for empty active effects not being applied to targets.


### 0.8.52
* [BREAKING] Looking at the coming changes in foundry 0.9.2 I've decided to remove the linking of item equipped and effect enabled.disabled in DAE and leave this entirely to foundry/dnd5e. This will cause ATL and Token HUD to misbehave. Further you cannot toggle an unavailable effect to active without equipping the item.
  * ATL currently ignores unavailable looking only at active/inactive - so toggling equipped to enable/disable lights won't work, you have to toggle the effect. 
  * Token HUD toggles active/inactive when you choose an effect so if the item is equipped toggling will work, but if not equippd it won't change anything.
* Added new CUSTOM effect StatusEffect which allows you to choose any configured status effect (core/CUB/Convenient Effects). When applied the changes from the status effect are added to any other changes for the effect. If the status effect is the only change in the effect it is applied instead of the defined effect. So a spell which has a single effect - poisoned - will create the poisoned effect on the target and there will be no extra effect. This applies for core, cub and convenient effects. This means you won't need to use macro.CE most of the time. Lastly since the changes are copied there is no extra apply confition step so this should dramatically reduce the "cannot find embedded entity errors" - reommended for most cases.
* Fix for deleting items with passive effects which call an ItemMacro. This was causing a macro not found error since the item was deleted before the attempting to call the macro.
* Tweaking of creating/deleting effects. Result is macro.execute/args[0]==="on" may executate AFTER midi-qol.RollComplete is sent.

## 0.8.51
* Turns out I don't like the dnd5e suppression mechanic. Added a new config option - handle equipped which overrides the supression mechanic in DND5E and uses the DAE one of enable/disable on equip/unequip and vice versa.
* Short term patch for ATL equip/unequip
* Support for midi-qol OverTime effects named/unnamed (avoids a bug when mixing named and unnamed overtime effects).
* [POSSIBLY BREAKING] bonuses.anything no longer have values replaced by DAE - it is left for the actual roll to do that. This should fix a long standing issue with bonuses and derived values. Any problems ping me @tposney since it touches lots of possible areas.
* An enhancement to active effects and condition immunities. If you have a condition immunity and a condition is applied with the same name (core/cub/convenient effects) the condition will be marked as disabled on the character.

## 0.8.50
* Since dnd5e 1.4.3 and later supports enabling/disabling transfer effects when items are equipped/unequipped this functionality is disalbed in DAE if the game system version is 1.4.3 or greate. The dnd5e core functionality is not identical to the dae functionality but it is at least as good and it makes no sense to have both the system and a module trying to handle the same thing.
* Fix for double counting numeric global save bonuses.
* Major overhaul to Readme.md - many thanks to @dianne#4667 (discord) @diannetea (gitlab)

## 0.8.49
* Slight change to active effect macro calling to try and reduce problem cases - macros which create items.
* Changes to DAESRD item replacement macros: (to fix significant item/effect duplication)
  * requires you to set "DAE disable all effect processing" before running the macros. 
  * Adds items one at a time, since adding all at once seemed to cause foundry problems with active effects additions.

## 0.8.48
* Fix for ATL not triggering when items equipped/uneqipped.
* Added skill.value CUSTOM, Adds the specified prociencny (1/2 prof, prof, expertise) to the exisiting proficiency for the skill. The resulting proficiency is constrained to (1/2 prof, prof, expertise) with proficient + 1/2 proficient => proficient.

### 0.8.47
* Update for migrateActorDAESRD etc to use the new DAE SRD midi specific packs.
* Change to handling equip/unequip for items. This means that for weapon/equipment/etc effects you cannot override the active/inactive status for transfer effects, you must equip/unequip. I've changed this because of interactions with some other modules and also it saves a db transaction on equip/unequip.
* For feats/spells you can still activate/deactivate as before.

### 0.8.46
* Fix for "Cannot destructure property 'missing' of 'undefined' as it is undefined." error

## 0.8.45
* Tidied up/improved special duration text.
* Fixed a bug where dae was causing midi-qol to hide the onUse macro field.
* Fixed a bug in duration conversion => rounds.

## 0.8.44
* Added data for special durations of Long Rest, Short Rest and New Day.
* Some fiddling to try and reduce the incidence of race conditions resulting in cannot delete embedded effect.
* Swapped text for 1 Spell/1 Action special durations that were the wrong way round

## 0.8.43
* Added in special durations for ability specific saving throw success/failure
* Moved "removeConcentration" to midi-qol

## 0.8.42 
* Fix for wrong fetching to token uuid

## 0.8.41
* Fix for broken migration script in 0.8.39

## 0.8.40
* Fix for broken migration script in 0.8.39

## 0.8.39
* Update for effects creating proficiencies to pick up individual proficiencies.
* Remvoed deprecated AC calculation code
* Fix for ac.value effects being displayed for disabled effects.

## 0.8.38
* Added ```DAE.cleanEffectOrigins()``` which will fix up item origins which include OwnedItem (which is deprecated). If you see lots of OwnedItem is deprecated messages, this is probably the cuase. Can be run multiple times, from the console or as a macro, needs to be run as a GM.

## 0.8.37
* Update for new convenient effects release - requires convenient effects 1.8.0.
* Added option to disable DAE title bar buttons.

## 0.8.36 
* Fix for concentration with non-english installs

## 0.8.35
* Update for convenient effects version 1.6.2
* updated ko.json, ja.json, thanks @klo, @Brother Sharp

## 0.8.34
* DAE now **requires** libWrapper 1.8.0 as a dependency.
* Update AC attribution for NPC and Vehicles.

## 0.8.33
* Fix for ac.bonus not being refelected in ac calculations.
* Update the ac attribution to include effects that modify data.attributes.ac.value
* Requires dnd 1.4.0 or later

## 0.8.32
* Added check for dnd5e 1.4.0 to remove all DAE armor calculations since 1.4.0 takes over AC calculations. Differences to note:
  * With dnd5e 1.4.0 dae will do NO ac changes except those setup as active effects.
  * A one off migration is run the first time the world is started after dnd5e 1.4 is isntalled:
    * removes all dae generated armor active effects
    * removes all dae calculation items (Default AC etc).
    * disables all dae ac calculation options.
  * dnd5e 1.4.0 does not manage items of type magical bonus, so those will have to be redone as active effects.
  * dnd5e 1.4.0 does not choose the best armor if you have more than one equipped, so you will need to check equipped items.
  * because of the way that dnd5e calculates AC changes in AC due to dex mod changes will NOT be reflected in the final AC.
* preliminary support for convenient effects via macro.CE (definitely experimental).

## 0.8.31
* updated ko.json
* added special duration definition for isMoved.
* Fix for auto disabling effects attached to class items.
* Added special duration 1Spell

## 0.8.30
* Re-organise application of macro.CUB to reduce incidence of cub condtions not being applied/removed. More than one macro.CUB on an effect is likely a problem.

## 0.8.29
Add new DDB AC item to premade items pack

## 0.8.28
* Added DAE.fixupDDBAC() which fixes up the AC calcs for the new AC scheme for characters imported from DDB via ddbimporter. The newly applied effect will use the baseAC from the imported character together with any armor/shields/bonuses. It can be run multiple times and won't cause any problems, so you can run this each time you import via ddbImporter. This is only relevant to those using ddb importer.
* Change to stackable effects. Support the current implementation (option multi) or instead of applying the same effect multiple times maintain a count of how many times the effect has been stacked (count), stored in effect.data.flags.dae.stacks. This  makes stacking effects like wounds very easy to implement. Thanks @Seriousness for the PR.
* Modification to stacking to support both the old mechanic (multiple copies of the effect) and the new stacks count. 
* You will need to reset the stacking field for any stackable effects you have.
* Included a sample Devil's Glaive in the midi-qol compendium.
* Fix for cub labels for that would get translated via lang.json and therefore not get matched when creating effects.

## 0.8.27
* Updated premade items compendium to be correct for AC calcs

## 0.8.26
* Fix for DAEDeleteActiveEffect causing an error.

## 0.8.25
* Rework of adding cub/tokenmagic etc logic - hopefully more reliable and may reduce conflicts between various effects. Removing multiple TMFX effects should work now. (Don't update 5 minutes before game time).
* Changes so that concentration removal (in tandem times-up/midi-qol) is cleaner and hopefully does not produce "No such entity in collection messages"
* Some changes for sw5e.

## 0.8.24
* Added special duration 1Reaction.
* Fix for data.bonuses.spell.dc

## 0.8.23
* Fix for new bug when removing concentration with spell templates not set.

## 0.8.22
[EXPERIMENTAL] Which means don't upgrade to this version 5 minutes before game time. 0..8.21 remains available via manifest link.
* Possible fix for longstanding error when apply CUB conditions in tandem with other effects

## 0.8.21
Fix for @item.level throwing an error.
Fix for broken repeated replace in replace @ fields.

## 0.8.20
* Fix for deleting expired effects

## 0.8.19
* Fix for effect expriy calculation

## 0.8.18
* Fix for some deprecation warnings.
* Added DAE.addAutoFields(srring[]) which adds to the auto complete list for active effect edits.
* New option for argument evaluation when applying effects. If you apply an effect to a target token, by default @values are evaluated in the context of the caster/attacker and then the effect is created on the target. If you specify ##field, the evaluation will be deferred and evaluated on the target token.

## 0.8.17
* Fix for saving throws when use ability.save instead of ability.mod is set.
* Fix for item data passed via macro arguments.
* Switch to use SimpleCalendar for time/date calculations.
* Disabled support for conditional visibility - until an updated version is released

## 0.8.16
* Fix for tokenMagic effect application
* Fix for @item parameters to macros
* Updated ko.json - thanks @klo

## 0.8.15
* Hopefully the last fix for set/get flag DAE call.

## 0.8.14
* Fix for set/get flag.
* Fix for updates with no effects defined.
* Some fixes for using uuids instead of ids.
* Fix for adding/removing token magic effects.
* Fix for removing effects that are created by other active effects.
* Fix for concentration checks on unlinked tokens.
* Experimental - change effect value entry field to a text area rather than text field.

## 0.8.13
* Patch to avoid DAE/Active Aura's libwrapper conflict.

## 0.8.12
* Fix for roll expressions in numeric field evaluation.
* Fix for concentration removal.
* Fix for a bug when removing multiple effects from the same item were present (tried to remove one effect twice and ignored the other) resulting in an effect not present on actor message.
* Allow limited recursion of @field lookups, so you can define have @flags.mymodule.specialBonus = @abilities.dex.mod and get back the dex mod in your expressions.
* In the new AC calculation, add magical bonus to computed AC for equipment of type "magical bonus" - always added if equipped and attuned. So if you want a +1 to AC "something" you can set it as magical bonus and enter a 1 into the Armor Class value.

## 0.8.9
* Change base AC calcs to override so that negative dex mods are applied.
* Change heavy armor calcs to always ignore dex mod.
* If you have already implemented the AC calcs in 0.8.7 you will need to delete the AC calc feature on any actors that have it and replace it with the new item from the premade-items compendium. (Will only affect characters with negative dex mods)

## 0.8.8
* Fix for macro.execute failures.

## **0.8.7** This is a big one. DO NOT UPDATE JUST BEFORE GAME TIME>
* Fix for not detecting a token in combat when setting the expiry for item duration based effects.
* removed dynamiceffects migration code.
* Fixed an effect creation bug that would throw an error when creating a new active effect.
* Sort of fix for some expressions that the new Roll parser rejects - see below.
* Fix for AC calculation on heavy armor in old calculations. See below.
* Support advanced-macros as well as Furnace for macro application.
* New flag disable active effects. When set NO active effects are evaluated on an actor. It's convenient if you want to edit base values that have effects on them.
* There have been extensive changes to the code that evaluate arguments passed to macros. There are no intended changes to the behaviour but bugs are possible.

[BREAKING] Due to changes in the way Rolls are evaluated in 0.8.6+ the following rules will apply:
  1. If the target field is numeric then it will be fully evaluated when active effects are applied. **NO** dice expressions are supported. (A temporary work around is supported until foundry 0.9)
  2. If the target field is a string no evaaluation will be performed and it will be left to foundry to do the roll, if any. This means that conditional operators (a < b ? c : d) won't work in bonus fields or similar.

[BREAKING] A new mechanism for calculating AC that should be much more reliable. You configure auto ac calculation per actor. So if you import from DND Beyond and the ac is correct you can just leave it the way it is.
* To use: BACKUP YOUR WORLD FIRST. I have run this on my actual game and it worked fine, but anything is possible.
  - Enable "disable active effects" setting in dae. This will stop any auto creation of effects.
  - First remove the old effects used to calculate AC. Do this by running the following command in the console or in a macro
  ```
  await DAE.cleanArmorWorld()
  ```
  This will remove all existing armor effects from actors/tokens and items, but not compendia.
  - If you dont' want any of the AC calculations to be automatic do nothing else. (The cleanup clears the DAE settings for auto armor calculation).
  - Re-enable active effects by changing Disable Active Effects to off in the settings.
  - Auto armor class calculation is now enabled per actor by features that can be dragged to the character/token.
  - Choose an ac calc feature: (if armor/shields are equipped the best armor and shield will be used instead).
    - Default AC - 10 + dex mod
    - Barbarian's AC - 10 + dex mod + con mod
    - Monk's AC - 10 + dex mod + wis mod
    - Draconic Resilience - 13 + dex mod.
  and drag it to the character sheet. You can disable automatic armor calculation by toggling the effect or removing the feature from the actor. 
  - Any armor bonuses from spells/items should be set with a priority > 5 or they will be overwritten. (Add defaults to 20 so it should gernerally not be a problem).
  - You can create calcs with different base AC formula quite easily by copying one of the existing supplied calculations.
  - The name of the feature does not matter, so you can rename them to whatever you want.
  
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
