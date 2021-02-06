## What does DAE do?
First off you probably don't need DAE. The core foundry system has active effects that do at least 80+% of what you might want. I encourage you to try using just the core active effects and using DAE only if you run into a roadblock on what you want to do.

DAE does add some features to core Active Effects, so if the following features might be useful go ahead and use DAE. DAE builds on the core active effects so any core active effect is also a DAE active effect. Any place you edit a core active effect you can use the expanded active effects features.
0. A DAE editor button is added to the title bar for Actors and Items. Owned items allow modification of existing effects but not addition/deletion.
1. Transfer effects (from an item) are enabled/disbled according to the following rule which overrides the default behaviour
* Transfer effects for feats and spells use the "disabled/suspended" setting. You can toggle from the effects tab on the item/character sheet.
* Anything else follow the obvious dnd5e rule that transfer effects for an item apply if the item is equipped and attuned/does not require attunement. If you modify the enable/disable flag (suspended) on the actor effect, that will override the rule until the item is updated.
2. The ability to reference actor data in active effects data fields. i.e. @abilities.str.value, core restricts you to numbers and strings.
3. An extended set of fields you can modify, some of which are custom only fields to support drop down lists of possible value, like all of the traits, immunities which you cannot edit in core active effects.
4. The ability to update derived fields, such as abilities.dex.mod. (Work in progress some of these do not do what you might expect, good example initiative mod/bonus).
5 The ability to perform arithmetic in field data definitions, like 
```
ceil(@classes.rogue.levels/2)
```
6. A slightly extended active effect editor that provides a list of valid fields, a drop down list of options and drop down lists for restricted field values and the ability to set the priority of an effect.

## Quick start for dynamic effects users - who are migrating from dynamic effects.
Pick an actor and do
```
DAE.migrateActorItems(game.actors.getName("The name of the actor")).
```
The actor should have the items migrated (and the transferred effects applied). You should be able to see the values on the actor correctly calculated. (Also see the section **Migrating from DynamicEffects**)

To see the effects active on the actor use (as a macro or from the console)
```
new DAE.ActiveEffects({actor: game.actors.getName("Actor's name")}, {}).render(true)
```
or choose "DAE" from the character sheet title bar. Or you can do (from the console)
```
game.actors.getName("Actor Name").effects
```

Functions that previously started with "DynamicEffects." are now "DAE.".  

## Active Effect Expiry
Expiry of effects requires additional modules to be installed.
* about-time provides time based expiry (i.e. duration in seconds/minutes and rounds converted to seconds).
* times-up supports time based expry plus knows about rounds/turns and links to the combat tracker. 
* midi-qol supports a handful of special expiries (see below) that are otherwise tricky to support.
* Any/all of the modules can be installed and play nicely together. If times-up is installed it takes over the expiry of timed effects. 
* When entering the start time on the DAE duration tab the value is interpreted as an offset from the current game time. So 0 means now, +60 means in 1 minutes time, -30 means 30 seconds ago

* [Requires midi-qol 0.3.35+ and does not depend on about-time/times-up] Effects support additional expiry options (available on the DAE effect duration screen) that can be chosen:
  * 1Attack: active effects last for one attack - requires workflow automation
  * 1Action: active effects last for one action - requires workflow automation 
  * 1Hit: active effects last until the next successful hit - requires workflow automation 
  * turnStart: effects last until the start of self/target's next turn (check combat tracker)  
  * turnEnd: effects last until the end of self/target's next turn (checks combat tracker)  
  * isAttacked: the effect lasts until the next attack against the target. Requires workflow automation.
  * isDamaged: the effect lasts until the target takes damage. Requires workflow automation.
All of these effects automatically expire at the end of the comabt.

## Major Features not implemented
* Sample compendia. Only has a few items. I reccommend the excellent DAE SRD module that has many items/spells created
* From at least dnd 0.95 up to dnd5e 0.98 there is a problem will all monsters in the monster compendium and the data.data.bonuses.mwak/rwak/msak/rsak bonuses. The problem manifests as an error when creating an Active Effect to update these bonuses. A supplied function, 
```
DAE.fixupBonuses()
```
 will correct the problem in the Monsters SRD compendium and for all actors in the world.  

 ## Useful bits.
 * One of the most common things to do with dynamic effects is to create a damage bonus as a number of dice based on level. For DAE this requires a specific syntax in the damage bonus field. **in 0.7.3** this seems to cause a problem with critical hit resolution in dnd5e, so the DAE bonus is converted when applied to the actor.  
 To roll a number of d6 equal to 1/2 the rogue level rounded up use, in any of the damage bonus fields.
 ```
 (ceil(@classes.rogue.levels/2))d6
 ```
* Changing actor spellDC. The way that works is to use Bonuses Spell DC. Anything else won't do what you want.
* Ability Saving Throw bonuses. DND5e does not use the ability save field that you see on the character sheet when rolling saves. Changing that value (which you can do in DAE) will not affect rolls. If you want to be able to change individual ability saving throws you must enable the module setting "Use ability save field when rolling ability saves".
* Some fields are designated as CUSTOM, either they are "special" DAE fields (All-Attacks for example) or the core Active Effect rules don't work for them (damage immunities/languages etc). Generally DAE Custom fields (see list below) add the specified value to the existing data.
* Spell slots. The only way to modify the number of spell slots (that works correctly) is to use the spell slots override field. This is calculated BEFORE any derived values are calculated, so you cannot use ability modifiers or spell slot max in the calculation.

### Initiative
Changes to initiative are challening due to the way it is calculated and rolled in the dnd5e system. Here is a quick guide to what you can do.
  * init.value is now set before prepareDerived data is run, so it appears on the character sheet (in the "mod" field and in the total), but cannot reference dex.mod etc.
  * init.bonus is set after prepareDerivedData so will not show up on the character sheet but CAN reference fields like dex.mod
  * init.total can be updated and will show up on the character sheet but will NOT be included in rolls.

## Dynamic Active Effects Blurb
Dynamic Active Effects (DAE) is a replacement for Dynamiceffects (which will NOT work in 0.71+, and won't be ported).

### Background
With the release of 0.7.1+ much of the functionality of Dynamiceffects has been included in the foundry core Active Effects system. DAE implements most of the funcitonality of Dynamic Effects built using the new core Active Effects and augments the core functionality with some of the features from dynamiceffects. 

The foundry Core Active Effects allow you to modify a base value (defined in template.json - most fields you can edit in the character sheet) and apply a fixed value or string to it. There are additional options in core that were not present in dynamic effects, see **Calculation** below.

Foundry core Active Effects attached to an item and are designated as transfer or non-transfer. Transfer effects are transferred to the actor that owns the item when the item is added to the actor's inventory and removed when the item is removed. 

Non-transfer effects are not moved from the item to any actor without additional functions, which DAE/midi-qol provide.

You can create active effects directly on an actor and bypass the whole transfer/non-transfer question.

### Editing
A preliminary edit function is supplied, which may change in the future.
Active effects for Actors and Items can be edited. Owned Item active effects cannot be edited.

### Actor Active Effects
On the title bar of the character sheet is an option "DAE" that will display a form showing all of the active effects on the actor (transfer and non-transfer). You can change the actor effects to your hearts content - HOWEVER changing the effects on the owned item will overwrite the corresponding active effects on the actor. You are free to create active effects on the actor that are not linked to any item.

Active effects that are transfer effects are displayed with a down arrow. Non-transfer effects are displayed with a right arrow.

If the effect has a duration the remaining duration, in rounds/turns or seconds is displayed.

### Calculations
Core system active effects are calculated before the game system specific calculation of "derived" fields (prepareDerivedData). For dnd5e prepareDerivedData calculates all the ability modifiers, skill totals, and spell slots available. DAE adds an additional effect application pass that occurs after the system specific prepareDerivedData() completes.

Active Effects define the following calculations:
* CUSTOM: system/module specific calculation. DAE specifies lots of CUSTOM effects.
* ADD: Add a value to the field (if it is numeric) or concatenate if the field is a string.
* MULTIPLY: for numeric fields only, multiply the field by a value.
* OVERRIDE: replace the field with the supplied value.
* UPGRADE: for numeric fields replace the field with the supplied value if it is larger than the field. 
* DOWNGRADE: for numeric fields replace the field with the supplied value if it is smaller than the field.  

Additionally, there is a priority that can be given to each change within an effect. The priority determines the order in which changes will be applied during the applyEffects stage. All changes across all effects are collected and sorted by priority before application (low to high). The default priority for changes are 
  * CUSTOM: 0
  * MULTIPLY: 10
  * ADD: 20
  * DOWNGRADE: 30
  * UPGRADE: 40
  * OVERRIDE: 50
  So if an actor has the following changes,
  * data.attributes.hp.max ADD 10, and
  * data.attributes.hp.max OVERRIDE 20  
then with default priorities hp.max will be 20, since overrides comes after ADD. If priorities are assigned  
  * data.attributes.hp.max ADD 10 Priority:100, and
  * data.attributes.hp.max OVERRIDE 20 Priority:10
  hp.max will become 30.  

DAE allows you to use expressions as well as fixed values. So for example you could have the following
  * data.attributes.hp.max ADD "@classes.paladin.levels * @abilitiies.con.mod" Priority:100, and
  * data.attributes.hp.max OVERRIDE "10 + 5 + 6 + 10"   Priority:10
hp.max will be set to 31 + con.mod * paladin levels

**Number** fields are fully evaluated during the applyEffects pass.   
**String** fields are not evaulated at all. So setting
```
data.bonuses.mwak.attack ADD "@data.abilities.str.mod * 2" 
```
will be evaulated when the attack is rolled, NOT during the prepare data phase, since data.bonuses.mwak is a string field.
* Recognising what are base and derived values is important, since during the first applyEffects phase ONLY base data values are available. If the target field is a string field it does not matter which pass it is in, since evaluation only occurs when the field is used to do a roll.

DAE defines a game system specific set of "derived" values, which are calculated after the system specific prepareDerivedData is called. For DND this means after all modifiers etc are calculated. Fields that have a mode specified in the list below means that ONLY that mode is supported for the effect (and the editor will set the mode when the change is saved)

* The current list of derived fields for dnd5e are:
This group are all special traits that can be set.
* "flags.dnd5e.initiativeAlert"       OVERRIDE
* "flags.dnd5e.initiativeHalfProf"    OVERRIDE
* "flags.dnd5e.powerfulBuild"         OVERRIDE
* "flags.dnd5e.savageAttacks"         OVERRIDE
* "flags.dnd5e.elvenAccuracy"         OVERRIDE
* "flags.dnd5e.halflingLucky"         OVERRIDE
* "flags.dnd5e.jackOfAllTrades"       OVERRIDE
* "flags.dnd5e.observantFeat"         OVERRIDE
* "flags.dnd5e.reliableTalent"        OVERRIDE
* "flags.dnd5e.remarkableAthlete"     OVERRIDE  
These fields accept 0 off, or 1 on.

* "data.bonuses.spell.dc"             ANY  
This field is always a number, so any dice expression will be evaluated once when prepareData is called and **NOT** on each spell cast. You cannot do lookups of derived fields for spell.dc calculations.  

These fields exist in template.json but are moved to the derived phase so that all the derived fields are available when computing the value.
* "flags.dnd5e.weaponCriticalThreshold
* "data.attributes.ac.value"
* "data.attributes.ac.min"
* "data.attributes.hp.max"
* "data.attributes.hp.tempmax"
* "data.attributes.hp.min"
* "data.attributes.init.total"
* "data.attributes.hd"

* "data.attributes.prof"              CUSTOM
Attributes prof allows addition of a numeric value to data.abilities.prof. When updated, skills, spelldc and saves are updated accordingly (this calculation should be considered beta and if you find something missing let me know). You can use a negative value to reduce proficiency.

These are custom fields
"data.abilities.str.dc"
"data.abilities.dex.dc"
"data.abilities.con.dc"
"data.abilities.wis.dc"
"data.abilities.int.dc"
"data.abilities.cha.dc"               CUSTOM
adds the value (must be numberic) to the field and recomputes items saving throw dcs.
* "data.bonuses.All-Attacks"          CUSTOM  
The specified string field will be appened to bonuses.mwak.attack, bonuses.rwak.attack, bonuses.msak.attack, bonuses.rsak.attack

* "data.traits.languages.all"         CUSTOM
The actor will be given all langauages specified in CONFIG.DND5E.languages
* "data.traits.languages.value"       CUSTOM
The value will be added the known language
* "data.traits.languages.custom"      CUSTOM
The specified string will be appended to the custom language field
* "data.traits.di.all"                CUSTOM
* "data.traits.dr.all"                CUSTOM
* "data.traits.dv.all"                CUSTOM
The actor will be given immunity/resistance/vulnerability to all damage types specified in CONFIG.DNE5E.damageResistanceTypes
* "data.traits.di.value"              CUSTOM
* "data.traits.dr.value"              CUSTOM
* "data.traits.dv.value"              CUSTOM
The actor will be given immunity/resistance/vulnerabliltiy to the specified damage type
* "data.traits.di.custom"             CUSTOM
* "data.traits.dr.custom"             CUSTOM
* "data.traits.dv.custom"             CUSTOM
The actor will have the specified string appended to the list of custom immunities/resitances/vulnerabilities.
* "data.traits.ci.all"                CUSTOM
* "data.traits.ci.value"              CUSTOM
* "data.traits.ci.custom"             CUSTOM
Same as above but for CONFIG.DND5E.conditionTypes
* "data.traits.toolProf.all"          CUSTOM
* "data.traits.toolProf.value"        CUSTOM
* "data.traits.toolProf.custom"       CUSTOM
Same as above but CONFIG.DND5E.toolProficiencies
* "data.traits.armorProf.all"         CUSTOM
* "data.traits.armorProf.value"       CUSTOM
* "data.traits.armorProf.custom"      CUSTOM
Same as above but CONFIG.DND5E.armorProficiencies
* "data.traits.weaponProf.all"        CUSTOM
* "data.traits.weaponProf.value"      CUSTOM
* "data.traits.weaponProf.custom"     CUSTOM
Same as above but CONFIG.DND5E.weaponProficiencies
* "data.resources.primary.max"
* "data.resources.primary.label"      OVERRIDE
* "data.resources.secondary.max"
* "data.resources.secondary.label"    OVERRIDE
* "data.resources.tertiary.max"
* "data.resources.tertiary.label"     OVERRIDE
* "data.resources.legact.max"
* "data.resources.legres.max"
* "data.skills.SKILL.mod"
* "data.skills.SKILL.passive"
These affect the specified SKILL adjusting modifier or passive value for the skill. Changes to modifier are only reflected when rolling the skill, not on the character sheet.

* "data.abiitiies.ABILITY.mod"
Allows modification of the ability modifier.
* "data.abilities.ABILITY.save"
Provides a bonus to ability saves. This is only active if the "Use ability save field when rolling saving throws" module setting is enabled. This will use the save plus rather than the ability modifier when rolling saving throws.
* "data.spells.pact.level"
* "data.spells[1-9].override"
* "data.spellspact.override" 
Spell slots.value and spellslots.max are not able to be modified with DAE.

* "macro.execute"                     CUSTOM
* "macro.itemMacro"                   CUSTOM
* "macro.tokenMagic"                  CUSTOM

These are custom flags. The macros are called when the effect is transferred to the character (with args[0] === "on") and called again when the active effect is removed (with args="off). macro.tokenMagic applies/removes the token magic affects.

Macros have changed substantially in their implementation. When you have a non-transfer effect that includes a macro, the macro is transferred to the target actor and runs when created on the actor. Deletion of the active effect from the target actor calls the macro again with args[0] = "off".
Since the macro attaches to the target actor the macro can schedule itself to be activated on other events, such as combat updates to support damage over time effects.

**macro.execute "macro_name" args**  
This will call the macro "macro_name" with args[0] = "on" and the rest of ...args passed through to the macro when the effects are applied to a target token. It will be called with args[0] = "off" when the active effect is deleted from the target actor.
In addition to the standard ```@values``` the following are supported (only as macro argruments)  
```@target``` will pass the token id of the targeted token  
```@scene``` will pass the scene id of the scene on which the user who activated the effect is located.  
```@item``` will pass the item data of the item that was used in the activation  
```@spellLevel``` if using midi qol this will be the spell level the spell was cast at.  
```@item.level``` if using midi qol this will be the spell level the spell was cast at.  
```@damage``` The total damage rolled for the attack
```@token``` The id of the token that used the item
```@actor``` The actor.data for the actor that used the item.  
```@FIELD`` The value of the FIELD within the actor that used the item, e.g. @abilities.str.mod.  
```@unique``` A randomly generated unique id.  

An additional argument (in addition to those specified in the macro.execute definition) is the actor data for the target token appended to the argument list.  
For example, if the macro.execute definition is
```
macro.execute CUSTOM "My macro" 5 @ailities.str.mod
```
then, when the effect is trasnferred to the target token the macro will be called with  
args = ["on", <strength mod of the actor that used the item>, <actor.data of the target token>]  
When the effect is deleted from the target actor (either by expiry or explicit deletion) the amcro will be called again with   
args = ["off", <strength mod of the actor that used the item>, <actor.data of the target token>]  

**Macros and transfer effect**
The above discussion applies to non-transfer effects. Transfer effects, which are applied when the item is equipped by a character.

**macro.itemMacro "macro_name" args**  
The same as macro.execute, but the item is inspected to find the itemacro stored there. You can create itemMacro macros with the **itemmacro** module.

If you are using macro.itemMacro please make sure you disable the ItemMacro config settings "character sheet hook" and "hookbar hook" or when you use the item the macro will get called bypassing the data settings from midi-qol/dae and won't work. The setting is per player so each player needs to change the setting to disabled.

**macro.tokenMagic "filterName"**
Will apply the specified token magic filter to each targeted actor when the active effect is applied to the actor and removed when the effect is deleted.

**Example**
This is a programatic way to create items with effects. 
```
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
  await item.createEmbeddedEntity("ActiveEffect", [EXAMPLE_TRANSFERRED_EFFECT]);

  let actor = game.actors.getName("My actor")
  await actor.createEmbeddedEntity("OwnedItem", item.data)

  ```
Or just drag the supplied Ring of Protection from the sample items compendium to the actor of you choice.

**Armor** The system applies standard DND rules for calculating armor class based on what armor you have eqipped (for natual armor the armor does not need to be equipped). Shield type items add to the armor class. "Effects" can alter armor class as well.

Armor behaves slightly differently to other items. The active effect for the armor is created when the armor is added to the character and then the effect is transferred to the Actor. (This means you do not need to edit every piece of armor to create the active effects)

### Macro Functions ##
Because dropping an item onto a character transfers the active effects to the actor many of the activation functions have been scrapped.

The macro functions in dynamicitems have been replaced in DAE with the following (and you will need to modify any macros you have created):
* Show all the Active Effects on an actor, marked as active/inactive.
  ```
  new DAE.ActiveEffects(actor, {}).render(true)
  ```
  * Display a form  enabled/disabled passive and active effects for the selected token. Effects cannot be edited but deleted **TODO** allow edits

```
DAE.doEffects(item, activate, targets, {whisper = false, spellLevel = 0, damageTotal = null})
```
Transfer the non-transfer effects from the item to the targets.
activate (boolean) enables/disables the actor effects.
targets is an array of target tokens or token ids.

### Integration with midi-qol ###
When rolling an item (weapon, spell, feature, tool, consumable) non-transfer active effects are applied to the targeted tokens. If the definition of the item indicates that it is self then effects are applied to self. So, a bless spell when cast will apply the active effects to the targeted tokens. 

midi-qol uses the foundry targeting system to decide who to apply effects to. If a spell is marked as target self then the effects are applied to the casting/using actor. 

If you have a feat "sneak attack" then rolling the feat will apply the non-transfer active effects to the token (i.e. weapon attacks do extra damage). For items with a saving throw active effects are applied if the save fails. Other items apply their effects when applying damage/casting a spell (if no saving throw) or consuming an item (e.g. potion).

https://gitlab.com/tposney/midi-qol 

### Integration with about-time ### 
If the underlying spell, wepaon, feat, consumable etc has a duration then the active effects for that item will be applied to the targeted tokens (or self if the item is specified as self) and after the duration specified in the item the effects will be removed. So a bless spell with a duration of 1 minute will apply the active effect bonuses for 1 minute of gametime. A potion of giant strength will apply the new strength for the duration specified in the potion consumable. There are a few sample items in the premade compendium to get you started.

https://gitlab.com/tposney/about-time  

### Integration with GM-Notes.

If the module is installed and active effects can update the actors gm-notes field. A useful place to track info that can't be applied to the character sheet.

https://github.com/syl3r86/gm-notes

### Integration with Combat Utility Belt
**as of 0.3.50 the integration with Combat Utility Belt has changed.**
You create an active effect that takes it's changes from CUB via the drop down list in the DAE Active Effects Screen. "new" is pre-selected but you choose various items from that list, including CUB conditions.

CUB conditions are applied in 2 ways:
If you select condition (CUB) from the drop down list DAE will copy the active effect from CUB into the actor/item. From then on it won't change, any changes you make in condition lab will NOT be reflected in actors who have the condition applied via DAE/midi-qol.

Alternatively use macro.CUB to apply a condition that is looked up from CUB when applied.

### Really cool Core functionality that you can use....
You can add your own custom effects without needing any DAE module changes. Say you want to add the average of str.mod and dex.mod to AC (and DAE does not support it) and the expressions don't work...  

Core active effects has the idea of CUSTOM effects. If one is encountered when processing the active effects on an actor the system calls Hooks.call("appyActiveEffect")
  * Write a function that does
```
  Hooks.on("applyActiveEffect", myCustomEffect)
  
  function myCustomeEffect(actor, change) {
    // actor is the actor being processed and change a key/value pair
    if (change.key !=== "data.attributes.ac.value") return;
    // If your active effect spec was 
    // data.actor.attributes.ac.value (change.key) CUSTOM value (the value is not relevant here, but it gets passed as change.value)
    const actorData = actor.data.data;
    actorData.attributes.ac.value += Math.ceil((actorData.abilities.str.mod + actorData.abilities.dex.mod) / 2);
    // Although you can change fields other than the change.key field you should not as the core Active Effects tracks all changes made.
  }
```

Your custom effects can create new fields on the actor as well (DAE does this for flags.dnd5e.conditions for example). Just reference the field in the active effect spec and it will be created on the actor when the custom effect updates the value. There is no support for "arbitrary" field specification in the DAE UI (yet) so you would have to create the effect on the actor yourself.

### Sample Items/Macros 
  There is a compendium of items that have been setup to work with DAE. All active effects work best if both midi-qol and about-time/times up are installed and active, but will still funciton without them.

  The sample macros compendium has been updated. It is very limited but should provide some help in getting started. You should definitely look at the excelled DAE SRD compendia from @Kandashi for a wealth of pre-configured items/spells/macros.

## Migrating from DynamicEffects ##
### DAE.migrateItem(item)
Migrates dynamiceffects to DAE for all effects on the item, both active and passive, for example:
```
DAE.migrateItem(game.items.getName("My item"))
```
### DAE.convertAllItems()
Migrate all dyamiceffects on all items in the world. Does not include owned items.
### DAE.migrateActorItems(actor)
Migrate all effects for owned items on the actor, for example
```
DAE.migrateActorItems(game.actors.getName("actor name"))
```
### DAE.migrateAllActors()
Migrate all actor items, does not include tokens. Linked tokens will be upgraded
### DAE.removeActorEffects(actor)
Remove all ActiveEffects from the actor, both transfer and non-transfer, for example:
```
DAE.removeActorEffects(game.actors.getName("ActorName"))
```


##**Case Study - Aromor class**
Armor class causes much confusion about how it operates. 
If you enable auto base AC it sets the AC of the character equal to 10 + dex mod before doing any armor calculations. If this is NOT set calculation use the value typed into the AC fields as the base AC value.

DAE calculates the AC for various items as follows:
For equipment marked as armor or natural armor DAE creates an active effect when the item is added to the inverntory that sets the AC equal to the items AC value plus applicable dex mods. For shields it ADDs the armor value to the armor class. These effects are ONLY created when the item is added to the invenroty (or the migrateAllActors script is run).

Recall that there is a "base" AC number stored in the character. If you are wearning armor this number is not used since the AC is set to the armor value plus dex modifier. Say you have leather armor whose AC is 11 plux dex mod (and a dex mod of 3). When the aromor is worn the character AC will be set to 14 no matter what the base value of AC is. If you type 15 into the base AC field (setting the base character value) the displayed AC will not change. If you then unequip the armor the displayed AC will go from 13 to 15.  

    +----------+----------+-----------+  
    | Base AC  | Item  AC | Displayed |  
    +----------+----------+-----------+  
    |   10     |  14      |   14      | Armor Item is equipped  
    +----------+----------+-----------+  
    |   10     |  14      |   10      | Armor Item is NOT equipped  
    +----------+----------+-----------+  
    |   15     |  14      |   15      | Armor Item is NOT equipped  
    +----------+----------+-----------+  
    |   15     |  14      |   14      | Armor Item is equipped  
    +----------+----------+-----------+ 

Shields add to the calculated AC.

    +----------+----------+-----------+-----------+  
    | Base AC  | Item  AC | Shield AC | Displayed |  
    +----------+----------+-----------+-----------+  
    | 17       |   14     |    2      | 16        | Armor equipped & shield equiped  
    +----------+----------+-----------+-----------+  
    | 17       |   14     |    2      | 14        | Armor equipped & shield NOT equiped  
    +----------+----------+-----------+-----------+  
    | 17       |   14     |    2      | 19        | Armor NOT equipped & shield equiped  
    +----------+----------+-----------+-----------+  
    | 17       |   14     |    2      | 17        | Armor NOT equipped & shield NOT equiped  
    +----------+----------+-----------+-----------+  

A number of sample characters etc come with their armor class base value set (assuming there is no dynamic effects). Once dynamiceffects is enabled the displayed AC may be different to the base value, if the armor, shield or dex does not match the expected stored value.

Armor calculations are applied whenever the item is equipped.

