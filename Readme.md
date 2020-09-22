## Dyanamic Effects ###
**TeleportToToken** If you are looking to install dynamiceffects just to use the teleportToToken macros see the Overview.md document.
Dynamic effects is a replacement for dynamic items. It has been completely rewritten see **New Features** for changes
* Dynamic effects lets you apply item based effects to your character or **targeted tokens**, adding/decreasing attack/damage bonuses, increasing/decreasing maximum hit points, changing alignment, in fact almost any field on the character sheet can be adjusted by dynamiceffects.
* The module is not dnd5e dependent, although there is additional support for dnd5e.
* All of the changes exist in game only, the saved version of the actor remains unchanged, with the excpetion that active effect modifiers are stored in a flag so they can be reapplied when the game reloads.
* Effects are created/edited from the item sheet which has an additional tab, Effects.
* An effect is just an actor field specifier (i.e. Attributes HP Max) a mode +/= (add value or set value) and a value. A value can be any valid value for the field with some additional options.
1. You can specifiy a dice specifier in any numeric field or bonus field. So (Bonuses Melee Weapon Damge) "+" 1d4 would add 1d4 to the melee weapon damage bonus. 
2. You can specify @actorField as a value, so (Attributes HP Max) "+" @abilities.con.mod would add the value of the characters con mod to the max HP for the character.
3. You can simple addition/multiplication formules for the value. So (Attributes HP Max) "+" @abilities.con.mod * @details.level would add you con mod * level to max HP.
4. For numeric fields the values are computed completely during application. So (Abilities Strength) "+" 1d4 would roll 1d4 and add it to your strength. The dice is rerolled each time the character is updated. @fields are always looked up during the evaluation phase. If you strength mod is 5, (Bonuses Melee Weapon Damage) "=" @abilities.str.mod would set the melee weapon bonus damage to 5.
5. For string fields, in particular bonus fields, the dice modifier is not rolled. So when the string field is used in a roll the dice will be rolled. If you set the melee weapon damage bonus to 1d4, 1d4 will be added every time you roll for damage.
There are 2 types of effects, Passive and Active.
* **Passive Effects** Passive effects apply to the actor that has the item in its inventory and can be triggered in 3 ways. 
1. They can be marked "Always Active" in which case having the item in you inventory is enough to have the effects apply. Think innate ability, class feature cursed item.
2. They can be marked "Active when equipped" applying the passive effects when the item is in the actors inventory and equiped. Think magic item that does not require attunement.
3. No special flags set, the effects will applly if the item is equipped and attuned. Think classic magic item.

For passive effects the various functions/macros to activate/deactivate them apply the following rule:
If the item is a spell, feat or class the always active flag is toggled, for all other item types the equipped flag is toggled.
If you item is set to active on equip OR it is attund this will toggle the effects. Items without the active on equip flag must be attuned for the toggle functions to work - which is what you want you cannot enable unattuned items.

* **Active Effects** This is the main new feature of dynamiceffects. Active effects are applied to other tokens, not necessarily the actor that has the item in its inventory. The effects are usually applied to the **targeted** tokens for a player. If the item definition specifies a target of self then the effects apply to the token holding the item when it is activated. Active effects persist, even if the item is discarded, until disabled or the effect expires (see Integration with about-time).

* **Armor** The system applies standard DND rules for calculating armor class based on what armor you have eqipped (for natual armor the armor does not need to be equipped). Shield type items add to the armor class. "Effects" can alter armor class as well.

## New Features ##
* The module examines the system description to decide what fields can be modifed. In essence any field specified in template.json can be modified by dynamieffects. For dnd5e additional fields are created, e.g. ability modifiers and so on. This process is not limited to dnd5e but should work with other systems.
* Because there are so many fields that can be adjusted (240+ for dnd5e) the UI for creating effects has been reworked to provide categories which are dnd5e specific. For some/most of the fields that have defined values (languages, damage immunities and so on) a drop down of possible values is displayed when creating such an effect - dnd5e only.
* If about-time is installed the item is examined for a duration and active effects are removed automatically after that amount of gametime passes. If about-time is not installed the effects have to be removed manually.
* Integration with minor-qol so that active effects are automatically applied to targets when attacking if the attack hit, doing damage, consuming (self only), casting a spell if the spell hit or the saving throw fails.
* If the field to be modified is a string, modifiers will be evaluated at the time the effects is used. E.g. bonuses.mwak.attack is a string and 1d4 will be rolled when an attack is made. Dexterity Modifier is a numeric field and the modifer is calculated at the time the characters is "prepared".
* @lookups are supported for almost all fields and @abilities.dex.mod rather than dynamicitems @data.abilities.dex.mod is the preferred format from now on. Hit points, AC and bonuses are calculated last, so that effects that modify dex, will in turn affect dex modifier will in turn affect AC, or if you modify constitution, this will flow into constituion modifier will flow into HP MAX if you create an effect to add the con mod to HP Max.
* Language localization is currently targeted towards dnd5e. However other systems can be supported.
* Not all fields are sensible candidates to modify with dynamiceffects so you might have to experiment to see what makes sense.

#
### Effect Specifiers ##
You can modify most fields on the character using dynamic effects. 
* A simple example might be a ring of protection. This is active if equipped and attuned. To create the item create a ring (trinket is a good choice for item type or copy it from the premade items compendium). On the effects tab leave active when equippped unchecked (this is for item that are active when you have equipped them without requiring attunement) and always active unchecked (this is for features/items that are always active - for example improved critical that sets weapon critical threshold to 19 instead of the default 20) and create two passive effects, +1 to all saves and +1 to AC. Once you save the tiem whenever it is both attuned and equipped you will gain the specified benefits to your character.
* The bless spell is another good one to try. Find the bless spell in your spellbook and add active effects of ("Bonuses All Attack Bonuses" +1d4 and "Bonuses Abilities Save" +14d) - make sure they have the active flag checked (or copy it from the premade items compendium). You can now apply those effects to targeted characrters. The simplest way to apply the effects is to target some friends and run the function DynamicEffects.activateItem() [perhaps from a macro] and you will be presented with a dialog to select the item effects to apply to the characters. The effects will apply until you remove the effects from the targets by running the function again. However, see the notes below for integration with minor-qol and about-time, which just require you to cast the spell.
* Passive effects are removed when the item/feat that applied them is deactivated or removed from the inventory. Active effects apply to the character until removed, either by user interaction, e.e DynamicEffects.activateItem(), or timeout if about-time is active. 
* You can edit fields on the character sheet and the module will apply effects to the newly entered values. One caveat however applies for string fields. The module will take whatever is in the field as the base value. So if you have @bonuses.mwak.damage + 1d4 as an applied item specifier and you want to put an extra 3 bonus. You must edit the field to be "just" 3 (i.e. remove the text of the auto applied bonus) then save. The auto bonus will be reapplied. If you just add a 3 to the field, you will get +1d4 +3 +1d4, i.e. the bonus will be applied to the saved field which is now +1d4 +3. For numeric fields there is no need to do this, just type in the newe value.

### Macro Active Effects ###
An active efffect can be a macro call. To specify select macro execute effect. Macro effects are always active effects. You must have the module **furnace** installed and advanced macros turned on for arguments to be passed to macros you write.
The syntax for the macro effect is, for arguments to be passed to the macro you must have furnace advanced macros enabled.
```
macroName arg1 arg2 arg3 ...
```
macroName is the name of the macro to call and args can be any value (including @values). 

The macro will be called with it's first parameter, args[0], being "on" when activated and if the spell has a duration the macro will be called again (with the same arguments) but with args[0] set to "off"

in addition the usual macro variables, token, actor exist and don't need to be passed as parameters. Here is an example of what invisibility might look like:
The macro effect specifier is -
```
Invisible @target @scene
```
And the "Invisible" macro could be
```
let hide = args[0] === "on"
game.scenes.get(args[2]).updateEmbeddedEntity("Token", {"_id": args[1], "hidden": hide})
```

In addition to the standard ```@values``` the following are supported (only as macro argruments)  
```@target``` will pass the token id of the targeted token  
```@scene``` will pass the scene id of the scene on which the user who activated the effect is located.  
```@target.Actor``` will pas the id of the actor associated with the token  
```@item``` will pass the item data of the item that was used in the activation  
```@spellLevel``` if using minor qol this will be the spell level the spell was cast at.  

For this macro to work the user must have permission to update the token. For non-GM users this will generally not work. If furnace advanced macros is enabled and the macro is marked as "run as GM" (soon to be released Furnace feature) then the casting user does not require ownership of the token.

### Macro Functions ##
The macro functions in dynamicitems have been replaced in dynamiceffects with the following (and you will need to modify any macros you have created):
  ```
  DynamicEffects.effects(false/true)
  ```
  * Display a chat message with all enabled/disabled passive and active effects for the selected token. If the paramater is true a detailed list is provided otherwise just the name of the item that is enabled/disabled. Passive effects (those you get from having the item in your inventory) can be toggled on/off. In addition any "active effects" that have been applied to the actor will be displayed, but these cannot be toggled off/on (yet).
  ```
  DynamicEffects.togglePassive(itemName, itemType)
  ```
  * This will enable/disable passive effects for the selected/current actor/token. itemName is the string name of the item, e.g. "Bless". itemType is the type e.g. "feat" and defaults to match the first item that matches by name. Other options are "feat", "weapon", "spell", "equipment", "consumable", "backpack", "class", "tool", "loot". 
  
  ```
  DynamicEffects.setPassive(itemName, true/false, itemType)
  ```
  * Enable/disable the passives for the specified item. enable=true, disable=false. If itemType is not spcified the first item matching itemName will be used. If itemType is specified the matched item must be of the correct type.

  For passive effects, if the item specifies a duration and about-time is installed the effects will be removed after the duration passes in gametime. This is the only way passive effects can be automatically expired.
  ```
  DynamicEffects.activateItem()
  ```
  * This will present a dialog with a list of all items the character possesses with "active affects". You can activate or deactivate the effects. Remember this applies to targeted tokens. If the spell/feature/weapon/tool is denoted as having a target or range of "self" the effect will be applied to user's controlled token/actor instead. If about-time is installed and active and a duration is present in the item definition the effect will automatically be cancelled after the appropriate amount of gametime.

  ```
  DynamicEffects.applyActive(itemName, activate, itemType)
  ```
  * This is the same as activateItem, but acepts parameters for each of itemName, itemType and wheter to activate/deactivate the item effects to the tageted actors/token. If itemType is not spcified the first item matching itemName will be used. If itemType is specified the matched item must be of the correct type.
  ```
  DynamicEffects.removeAllActiveffects()
  ```
  * This removes all active effects from the selected tokens. Useful when something has gone wrong. You need to be a GM to run this. Can be a macro.
  ```
  DynamicEffects.getEffects(token)
  ```
  * This returns {passive: ```[{name, id}], active:[effect]}```
  passive is an array of item name and ids (owned item id) whose passive effects are currently active on the token  
  active is an array of active effects currently active on the token.
  For example:  
  ```
  passive: Array(5), active: Array(1)}
    active: Array(1)
      0: {modSpecKey: "data.traits.dr.value", value: "fire", mode: "+", targetSpecific: false, id: 1, …}
    passive: Array(5)
        0: {name: "Splint, +2", id: "4z7Yey93pAsBkAUQ"}
        1: {name: "Paladin", id: "jly7N2VgEp5CDdWk"}
        2: {name: "Longsword", id: "IzrDawkvut292HkX"}
        3: {name: "Greataxe", id: "0FyPzlINQbgiZxlj"}
        4: {name: "Divine Health", id: "QYnxSEowiT9QzJP4"}
```
### Utility Functions ###
There are a couple of utility functions that might be useful

```
async DynamicEffects.teleportToToken(tokenToTeleport, NameOfTokenToTeleportTo, xoffset, yoffset)
```
This function will "teleport" tokenToTeleport to the location of the target token offset by xoffset/yoffset in grid units. The token is deleted from the current scene and recreated next to the target token. If the target token is in a different scene the users view is switched to that scene. The idea is that each player only has one instance of their character token at any one time. This is primarily intended for use with Trigger Happy to allow teleporting from one place to another (e.g. going upstairs). 
The x and y offsets are in grid units.

```
DynamicEffects.setTokenVisibility(tokenId, true/false)
```
This will show/hide the specified token even if not owned by the player. Useful for when they trigger traps and you want to make the trap token appear.

### Integration with minor-qol ###
When rolling an item (weapon, spell, feature, tool, consumable) active effects are applied to the targeted tokens. If the definition of the item indicates that it is self then effects are applied to self. So, a bless spell when cast will apply the active effects to the targeted tokens. 
minor-qol uses the foundry targeting system to decide who to apply effects to. If a spell is marked as target self then the effects are applied to the casting/using actor. 
If you have a feat "sneak attack" then rolling the feat will apply the active effects to the token (i.e. weapon attacks do extra damage). For items with a saving throw active effects are applied if the save fails. Other items apply their effects when applying damage/casting a spell (if no saving throw) or consuming an item (e.g. potion).

https://gitlab.com/tposney/minor-qol 

### Integration with about-time ###
If the underlying spell, wepaon, feat, consumable etc has a duration then the active effects for that item will be applied to the targeted tokens (or self if the item is specified as self) and after the duration specified in the item the effects will be removed. So a bless spell with a duration of 1 minute will apply the active effect bonuses for 1 minute of gametime. A potion of giant strength will apply the new strength for the duration specified in the potion consumable. There are a few sample items in the premade compendium to get you started.

https://gitlab.com/tposney/about-time  

### Integration with trigger happy ###
Whilst there is no specific integration with trigger happy adding active effect items to trigger tokens allows traps etc to apply effects to characters when they walk onto the trap.

One sample usage is triggering characters to go up and down stairs.
If you create a script macro TeleportToToken whose contents are
```
DynamicEffects.teleportToToken(token, args[0], args[1], args[2])
```
and your trigger happy journal entry contains a line like
```
@Token[L3MainStairsDown] @Trigger[capture move] @ChatMessage[/TeleportToToken L4MainStairsUp -1 0]
@Token[L4MainStairsUp] @Trigger[capture move] @ChatMessage[/TeleportToToken L3MainStairsDown -1 0]
```
Where L3MainStairsDown and LM4MainStairsUp are invisible tokens placed on the map at the right locations on the scense. Then players will switch maps and locations to the designated tokens when traversing the stairs.

https://github.com/kakaroto/fvtt-module-trigger-happy  

### Integration with GM-Notes.

If the module is installed and active effects can update the actors gm-notes field. A useful place to track info that can't be applied to the character sheet.

https://github.com/syl3r86/gm-notes

### Sample Items/Macros ###
  There is a compendium of items that have been setup to work with dynamiceffects. All active effects work best if both minor-qol and about-time are installed and active, but will still funciton without them. There is a compendium of sample macros included as well.

### Skills-customization ###
the skills-customization-5e module blocks dynamiceffects from updating passive skills.

## Migrating from dynamiciems ##
Disable dynamicitems/enable dynamiceffects.
from the console or macro run:
```
DynamicEffects.migrateAll(true, true)
```
The first parrameter determines if migration actions are comitted to the database. false means only the in memory version is adjusted. However, if you then make changes to the actor/item the changes will be commited for that actor. It is redcommended that if you run the migration without saving changes, you inspect the actors/items to confirm things are ok then reload and run it the first paramater set to true.
* The second paramater, if true, provides console output indicating all of the changes made.
* The migration will update all world actors and world items, but does not adjust any compendium entries. You will need to import those to your world and then run the migration to get them updated.
* You can run migrateAll multiple times without creating problems.
* Once the migration has been run with the first paramater set to true has been run, there is no going back to dynamicitems as the old data is removed from the character. So if you think you might want to go back **PLEASE MAKE A BACKUP OF YOUR WORLD**. In fact make a backup even if you think you wont go back.

This module makes dynamicitems obsolete and dyanmicitems will not receive further delopment.

### Bugs ###
* Dynamiceffects interferes with the short rest dialog. It *always* displays 0 hit points recovered and 0 hit dice spent, even though it correctly performs the action.
* If the effect duration is specificed in turns it will be converted to round's worth of seconds, rather than checking the combat tracker. (this will be improved in a subsequent release)
* If the effect duration is specified in rounds it is converted to an equivalent number of seconds. (using the about-time value if there is one, otherwise 6 seconds per round). If about-time is installed this will be correct since about-time advances the gametime clock by the correct number of seconds each round.
* For this release durations are best expressed as times.
* Instantaneous effects are not properly supported and will instead apply for 1 round. A future release will make these permanent on the actor/token. The best way to do this is to create a macro to do the update.
*  **PLEASE** backup you world before playing with this module.

### Roadmap ###
The next items to be included will be (in no particular ordeer)
* Spell effects that require concentration to automatically cancel if the casters loses concentration.
* Support for advantage/disadvantage for specific rolls will require minor-qol.
* ~~Token effects so that you can apply specific token changes, e.g. improved vision, blindness and so on.~~ This is supported via macros
* Support for effects that last until end of/start of this/next turn.

## For module/system writers ##
Dynamiceffects overrides the actor.preparedata calls to apply effects. All of the effects are in memeory and not comitted to the database. When applying effects actor.getRollData is used to generate the context against which modifications are applied. The order of application is 
1. Base values (i.e. values that users can modify from the character sheet)
2. normal actor prepareData to calculate first derived effects, e.g. ability modifiers
3. dereived effects for dynamiceffects which include all fields not present in template.json but present in a normal character.
4. The final pass adjusts hp, ac and string saving/roll throw bonuses, like mwak etc.

If a target field is numeric the entirety of the bonus is evaluated in the appropriate pass. So abilities strength.mod + 1d4 will roll the 1d4 during the preparation phase since there is nowhere to store the intermediate state of +1d4. If the target field is a string, e.g. bonuses.mwak.attack + 1d4 the 1d4 is evalulated when the weapon attack is rolled and the bonus field will appear as +1d4 on the character sheet. @values are resolved during the apporpriate pass, so if a character has a dex mod of 4 and you have bonuses.mwak.attack + @abilities.dex.mod, the mwak field will display +4 when examined from the character sheet.

To adapt dynamiceffects to other systems the function ModSpec.createValidMods needs to be adapted to the target system. In addition the dynamiceffectsSelector class wil require modification. However, dynamiceffects should work out of the box with other systems, but not be as useful as it might otherwise be. The integration with about-time is not system specific so should work out of the box. The integration with minor-qol is very dnd5e specific.

The GMAction component is a tool for requesting GMs to execute functions on players behalf. It can be used standalone in other modules without problem.

The module is written in typescript using the procject creator tool from @NickEast and many thanks to him for providing such a good tool.

# Change Log ##
v0.5.4 compatible with foundry 0.5.4  
v0.5.5 fixed dnd 5e issue where clothes acted as shields  
v0.5.6 add support for GM-Notes module. Effects can update the actor gm-notes field if the GM-notes module is installed and active.
       add additional config flag "players can see effects". If false non-gm players will not see the effects tab on the item sheet and effects listing will be summary only for items. Effects are still active  
       improve @field replacement for text fields.  
v0.5.10 added kr.json  
        added experimental feature for actors to see/control their invisible tokens  
v0.5.12 fixed error when attempting to assign values to empty field, such as AC  
        improved @value lookup  
        added special case formula evaluation for (expression)dN. expression will be completely evaluated and the field will be replaced with XdN when X is the result of evaluating expression. This is specifically targeted to damage bonus fields where you need to be able to roll double damage on criticals.  
v0.5.13 added a few macros that are sort of useful
v0.5.14 fix bug when importing characters (json/dnd beyond) and incompatibiltiy with better npc sheet.
v0.5.15 Added DynamicEffects.setTileVisibility() function 
v0.5.16 fix another bug on empty fields. Only add "+" on string effects on second and subsequent fields
v0.5.17 Included PR from @shads2 that allows and additional parameter to teleportToToken being the scene name. This allows you to reuse token names on different scenes.
v0.5.18 added moveToken function (similar to teleportToToken, but just deletes and recreates the token).
v0.5.19 Cleaned up the presentation of skills abilities to display the list of available abilities - rather than a text field which could break actors quite badly. 
        Removed unusable check_all specifier.  
        Cleaned up initiative specifiers a bit.   
        Put back Skills All to add a numeric bonus to any skill roll.  
v0.5.20 Add fix for corrupted abiities.  
v0.5.21 spell slot max/current updates now work with 0.88  
        remove spelllevel.override from dyanmiceffects setting  
v0.5.22 undid breakage for pf1/pf2 - still does not work all that well - but does not fail completely  
v0.5.23 fix for spellDC calculation - thanks  @kiovml / removed some debug that was left behind  
v0.5.24 improved handling of numeric fields  
v0.5.25 changed player can see effects to none/view/edit. If the player is trusted and edit is true players can edit dynamiceffects details.  
v0.5.27 Added macro.execute active effect - see not below  
Improved actorEffect chat card - note macro effects do not (currently) show up as active effects.  
incorporated @kiov PR  
Put back convert loot to equipment function.  
v0.5.28 added PRs from @kiov and @ohporter 
Put back convert loot to equipment function.  
v0.5.29 remove dependency on furnace for dynamiceffects to load  
v0.5.30 added armor proficiencies as a drop down list  
v0.5.31 remove extra debug line left in  
v0.5.32 allow trusted players to edit all fields of an item  
0.5.33 foundry 0.5.6 compatibile  
v0.5.34 support text duration fields (uses item.data.data.duration) for scheduleing active effect removal if about-time installed.  
Do not schedule removal if no duration is present.    
v0.5.3.39 fixes for duration fields (multiple iterations).  
Fix for duplication of bonuses application and inability to change flag fields.  
Patch dnd5e to use ability.save rather than ability.mod + prof for rolling saving throws.  
v0.5.5.41 fixed various oddities when updating actors due to a previous patch.  
0.5.5.43-0.5.45 v0.9 compatibility, update ko.json from kr.json YOU MUST BE ON DND 0.9 to use this version  
v0.5.48 fix for some aargument expressions not being properly evaluated when passed as active effects
update ko.json  
0.5.55 Added additional flags dnd5e.forceCritical and dnd5e.attackAdvantage which work with minor-qol - see minor-qol release notes.  
Updated ja.json  
0.5.57 fix for procifiency being added as dynamic effect.  
0.5.58->0.5.61 added conditions as effects.  Dynamic effects requires combat-utility-belt version 1.1.2 or later for conditions to work.
v 0.5.62/63 Fixed bug with applying damage that applied when 2 or more GMs logged in. Seen most often id doTraps.
Added fix so that dndbeyond imported characters have AC correctly calculated.
Added config flag to disable automatic AC calculation. Applies to Armor and shields, passive/active effects are still applied.
See overview.md for item macros.
0.5.64-70
Improved condition support (fixes some token edge cases)
Check the version of CUB installed.
updated ko.json and ja.json
fix bug for duration in rounds/turns where previously any duration in rounds would be 1 round.
0.5.71-0.5.75 bug fixes for saving throws, conditions, module checking and other omissions in previous releases
V0.5.76-80 various bug fixes:
changes for premade items and macros - cleaned up.  
fix for tokens that are invisible and have no actor and experimental control visible mod turned on.  
put back default dnd5e conditions for condition immunities  
merge pt-BR  
pass total damage to macros so they know what was applied. If a single token is target the actual damage is passed.  
fix self targeting issues  
added fr.json  
improvements to invisiable token management - seems to work fine now - may even remove experimental tag.  
0.5.81 Fix for item macros  
v0.5.82 Added @unique tag to item macros to allow saving of state between "on" and "off" calls to macro  



