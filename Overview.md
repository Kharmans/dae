### Intro ###
This document is intended to give an overview of how dynamiceffects works and what you can and can't do with it and answer some of the why does this not work questions. If you are just looking for a howto use the module this may not be the document for you.

### Background ###
To understand how dynamiceffects works you need to understand a little bit about the foundry model of actors.
The data for an actor is specified in a file called "template.json" that can be different for every game system. The template.json file specifies what values are stored (by default) for the actor in the database.

In game you can see what values are sepcified by looking at (for example) game.system.model.Actor.character (for dnd5e). These are the feilds thare are stored to the database. 

Everything else is calculated when the actor is loaded. This includes ability mods, saves, skill values and so on. This calculation occurs in a function called prepareData.

Dynamiceffects augments the prepareData process. It also means that changes made by dynamiceffects are not "permanent", i.e. they are not committed to the database and if you disable the module the data all reverts back to the default numbers.

### Dynamiceffects behaviour ###
The first stage is to examine the template.json data (by looking at game.system.model.Actor.chararcter) and noting every field listed there and its type. Then a game system specific set of fields is added to this list. The combined list is all of the things that you can modify in a dynamiceffects effect.
For eample (in dnd5e): There is a field called abilities.str specified in game.system.model.Actor.character with fields value and proficient, the game specific code adds abilities.str.mod, abilities.str.save and abilities.str.min (all of type number) since the standard prepareData adds these fields to the character.

These are the fields you see in the pull down list of modifiers for item effects.

An effect is a combination of a field specifier and a change (add "+" or replace "=") and some value. The value can reference other fields, functions and dice rolls as well as fixed numbers or strings. Other actor fields are referenced as @abilities.str.value for example. An example specifier might be
```
"Bonuses Melee Weapon Damage" + (ceil(@classes.rogue.levels/2))d6
```
which adds 1/2 the rogues level d6 to the melee weapon damage bonus.

**prepareData**
During any call to preparedData (rendering a character sheet, updating the actor, etc) dynamiceffects takes over. During this process it calls the system prepareData and augments the reults with its own calculations. If the field type is a number or boolean all of the calculations must complete (i.e. lookups done and dice rolled) during prepareData since the rest of the game system expects to be able to access those fields as numbers. That explains the ongoing concern that ability modifiers have the dice rolled during preparedata. It requires a different approach to the fields in the dnd5e system for those to be added when an ability roll is made, dynamiceffects can only put a number in those fields. 

Dynamiceffects tries to order the application of modifiers to produce a sensible result. Fields mentioned in the template are "base" fields and any changes to those values are exectued before the game system preparedata is called. All others are after that. Some fields, like HP and AC are calculated in a special "final" pass so that everything else has been calculated first. Assignments to fields are applied before additions to fields.

**Editing fields**
If you edit any field on the character sheet you are changing the base value (i.e. the one stored in the database) and then when the update completes prepareData is called which applies the modifiers to the new value. For example:

Assume you have a base strength of 16 and wear an item that gives +1 to strength. The character sheet will display a strength of 17 (16+1) and 16 will be stored in the database. If you type 18 into the strength field then the base value will be updated to 18 (and stored) and the character sheet display will become 19, (18+1).

**Case Study - Aromor class**
Armor class causes much confusion about how it operates. Dynamic effects calculates the AC for various items as follows.
For equipment marked as armor or natural armor is SETs the AC to the ac value of the armor plus applicable dex mod. For shields it ADDs the armor value to the armor class.

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

## Passive Effects ##
Passive effects are applied based on the status of an item in the characters inverntory that has the effect. Soe examples are discussed below,
The effects are applied during prepareData in 3 specfic cases
1. The item is BOTH equipped and attuned.
2. The item has "Active when equipped" checked and the item is equipped.
3. The item has "Always active" checked.

You make the item apply its effects by causing one of those conditions to be true (you can edit the item, equip it or whatever).

As well as those direct mechanisms there are a number of other ways to activate items with passive effects.


**effects() Macro**
There is a useful function supplied with dynamiceffects
```
DynamicEffects.effects() or DynamicEffects.effects(true);
```
The macro applies to the currently selected token - no selection = no output.
This will display a chat message list of items, buttons to turn on/off the effects, whether they are active and the effects they provide.
DynamicEffects.effects(false)
This will display a list of items plus buttons, but not the detailed list.

I always have a hotbar macro defined with
```
DynamicEffects.effects(event.shiftKey)
```
which will display the short list when clicked and the detailed list when shift clicked.
The enable/disable buttons call the togglePassive function explained below.
**PLEASE** when reporting problems with dynamiceffects at least look at the output of the effects macro to see what dynamiceffects thinks is going on. It will ofter answer your query.

**Calling a function**
Dynamiceffects provides a number of functions to support hotbar macros/macro functions for passive effects,
```
	DynamicEffects.togglePassive(itemName, itemType)
  DynamicEffects.setPassive(itemName, setOnOff, itemType)
```
These operate on the selected token and take the following parameters
* itemName which is the name of the item to use, eg "Ring Of Protection"
* itemType if specified is the type, eg "spell" or "weapon", in case you have more than one item of the same name. If itemType is not specified dynamiceffects uses the first item found.
* setOnOff is a boolean with true = enable the effects, falise = disable the effects.

If the item is a feat or spell the function will check/uncheck the "Always active property", Otherwise the function will mark as equipped/unequipped.

In additon.
1. If the item specifies charges then activating the item via the macro functions will consume a charge.
2. If the item is enabled and specifies a duration AND about-time is both installed and enabled then an event will be scheduled at the end of the duration to disable the activation.

If you are not using about-time you have to disable effects yourself. If you are using about-time and you specify durations in the item you don't need to worry about disabling items, it will just happen automatically.

Do note that toggling equipped or always active from the character sheet will NOT use charges or schedule timeouts when using about-time.

### Some examples ###
* **Fighters Improved Critical** This could be a feat whose passive effects is "Flags Critical Threshold" = 19 and the feat is marked as always active. Dropping this feat onto a character will update the critical threshold. 
* **Ring of Protection** An "Equipment Item" of type trinket (like the one in the SRD Items compendium) with passive offects of "Attributes Armor Class" + 1, and "Bonuses Abilities Save" + 1. Since it requires attunment leave the "active when equipped" and "always active" fields unchecked. When the character attunes to the item and equips it, it becomes active. 
* **Sneak Attack**. A feat whose passive effect is "Bonuses melee weapon damage" + "(ceil(@classes.rogue.levels/2))d6". The brackets are required for dynamiceffects to recognise this as a dice specifier and evaluate the inner portion - otherwise you will get an error when doing the roll. Unfortunately about-time only knows about times (as yet) so a duration can only be 1 round or longer. Eventually it will know about turns/attacks.

The key things to remember are that passive effects are active based on having the item in you inventory. If the item is removed the effect goes away. If enabled by the supplied functions (or the effects chat card) they will timeout if they have a duration.

### Spell slots ##
Spell slots are a special case. If you want to use the detault slots behaviour you can only meaningfully change spell slot override and pact level. If you don't have classes that set spell slots then you can use dynamic effects to manage the slots for you.
* An increase to spell slots will ALWAYS add the modifier to the spell slot value. This means that the displayed value will NEVER be less that the addition, no matter what you type in.
* An increase to spell max will "work" but will not be recognised during long rests.
* Spells override. You can only set this to a value the + mode is exactly the same as =. Changes to override will be reflected in long rests/slot numbers.
This behaviour is a side effect of the default prepareData behciour which both calculates the spell slot max and clamps the number of slots to between 0 and max. In addition Long Rests redo the prepareData calculations and hence clamp to the class bases numbers, rather than the udpated numbers unless you specify spell slots override.

Override slot dynamiceffects are applied before the default prepare and will be included in the calculation of spell slot max.
Slots and slots max are processed after the default prepare data which means actions.

## Active Effects ##

* Active effects use exactly the same specification syntax/fields as passive effects but they are applied differently. There is one additional effect specifier; "macro.execute" which takes the name of the macro and optional arguments. 
* Active effects are **always** applied to the "targets" (tokens) of the currently selected user NOT the charcter that posesses the item. * If the item specifies "self" as the target effects will be applied to the selected token. Since active effects are applied when you "use" the item they can be a more natural way to specify some effects. Sneak attack is a good example. It is satisfying to click on the feat and have it apply the effect (the damage bonus) rather than going through the effects() macro and enabling it [although this works perfectly well and does give you a nice coloured chat log view of what is enabled].
* Bless is a good example of a game effect best implemented as an active effect. (You can implement bless as a passive effect and have an item that every character has in their inventory and activates when blessed). The active item approach is to represent bless as a spell (which it is) and with an active effect that specifies the bonuses to be applied. When cast the active effects will be applied to the target tokens and they do not need to have any item in their inventory.
* Many game effects can be represented as an item you have in the character inventory that you enable/disable or as an active effect applied to targets. It is entirely up to you which you prefer - there is no **right** way, nor are there standard foundry dnd5e ways to do this.
* Once applied active effects **remain enabled** until either they time out (requires about time and must specify a duration in the item) or are explicitly removed (effects() macro or special function - see below). There is no item associated with the effect so nothing to enable/disable.

The effects macro lists active effects on the token at the end of the list and has a trashcan icon which you can click to remove the effect.  
There are also some functions provided to assist in activating items (intended to be called from a macro or module). My intent was always to have effects applied via minor-qol so you might have to do some poking to make these work the way you want.
```
DynamicEffects.activateItem()
```
This presents a dialog with all items, that have active effects defined, as a drop down list and the option to apply/remove the effect. If the item specifies a duration and about-time is enabled and active the effect will be turned off after the duration elapses.

```
DynamicEffects.applyActive(itemName, activate, itemType) 
```
Active effects for a specific item. If the item specifies a duration and about-time is enabled and active the effect will be turned off after the duration elapses.

Note that these will apply effects to targeted tokens. If the item specifies a target of self then the effects will be a applied to self.
If the item specifies a duration and about-time is installed and active, the effect will be removed at the end of the duration.

```
DynamicEffects.removeAllEffects()
```
This remove all active effects from the selected tokens. Sort of a clean up everything button

### minor-qol ###
If you use minor-qol then minor-qol will automatically apply active effects to targets as follows (if auto apply effects is enabled):
1) If the item has an attack and auto checking hits, then applied if the attack hits. No other checks on miss.
2) If the item specifies a save and autochecking saves, then applied if the target fails to save. No Other checks on save
3) If the item does damage and auto applying damage then effects applied. No other checks.
4) If none of the above are true AND speed item rolls are enabled rolling the item will apply effects to the target or self.

### Macro Effects ###
You can call a macro as an effect to implement specialist effects not supported by the standard dynamiceffects actions.

These can be as complicated as you can write. One common use is to apply permanent effects to tokens as the result of an action. The macro is called with the first argument being "on" when the effect is activated, and if a duration is specified and about-time is active then it is called with the first argument being "off" after the duration passes.

I'll give two examples below. As well as the standard fields supported by dynamiceffects you can specify the following as parameters:
* ```@target``` - passes the token.id of the of the target token
* ```@scene``` passes the id of the active scene of the user that applied the effect (see furnace discussion below)
* ```@actor``` passes the id of the actor that caused the effect to be applied.
* ```@token``` passes the token id of the user selected token that applied the effect
* ```@item``` passes item.data to the macro
* ```@spellLevel``` passes the spell level of the cast spell

### Macro.itemMacro ###
There is a new macro call, macro.itemMacro. Items can now have their own macro stored with them and that can be called when activating the item. This makes items completely self contained and there is no need to ship the macro along with the item.

To create an item macro you require the module Item-macros installed.  (https://github.com/Kekilla0/Item-Macro). Once the macro is created the macro can be run even if the module is not installed. All of the above parameters are available in the call. The Divine smite macro example below can be directly created as a divine smite item macro for the spell and once saved it included with the item when saved, exported or pushed to compenida making it completely self contained and can simply be dragged onto the character sheet.

### Active Effects and targeting ###
For active effects to be applied there must be a target (either targeted on screen or self) and the item must specify the sort of target affected. There are several cases to look at:
If you are activating the effect from a hotbar macro there must be a selected token and the token must have the feat/weapon/spell in the token actor's inventory.
If you are casting from a sheet some extra checks are done.

Item Target is blank or "creature".
* If the Dynamic effects setting "Require item targets" is on and if no target specified in the item no effects are applied.
* Otherwise, all targeted tokens have the effect applied to them.

Item target specified as self.
1. If a token on the map is selected and the token actors type is the same as the actor sheet being used to activate the item then the selected token is used as the target. (Effects activated by hot bar macros will always be in this catefory).
2. If a token on the map is selected and the token actor's type is not the same as the actor sheet or if no token is selected. 
2.1 If ChatMessage.getSpeaker can determine the speaker then that token is used.
2.2 If the actor specifies a token (i.e. non-linked sheet or a token sheet) the specified token will be used.
2.3 If the actor has no token referenced the first active linked token for the sheet will be used. (dynamic effects finds a token on the map that is linked to the actor sheet).

### Example Macros ###

### Divine Smite ###
The first example is the Divine Smite ability for Paladins (the descriptio covers how the effect works when using minor-qol).
The item is specified as having an activation of 1 bonus action, no attack, damage or save.
The active effect is 
```
"Macro.execute" = "Divine Smite" @target @spellLevel
```
If you are activating the effect without minor-qol you will have to pass in those paramaters to the macro.
The Smite macro is
```
if (args[0] === "on") {
  let target = canvas.tokens.get(args[1])
  let numDice = 1 + (Number(args[2]) || 1)
  let undead = ["undead", "fiend"].some(type => (target.actor.data.data.details.type || "").toLowerCase().includes(type));
  if (undead) numDice += 1;
  new Roll(`${numDice}d8`).roll().toMessage({flavor: "Divine Smite - Damage Roll (Radiant)", speaker, flags: {noDynamicEffects: true}})
}
```
The target token is fetchd from the curent scene, the number of dice to roll is calculated based on level and if the target is undead or a fiend then an additional dice is added.
A new roll is created with the damage roll flavor specified. An additional parameter is passed (noDynamicEffects) to indicate that this roll should not generated additional calls to dynamiceffects, otherwise infinite call loops are possible.

Minor-qoll will pick up the damage roll and add damage buttons and auto apply damage as required. There is nothing to do if called with "off".

### Aid ###
The aid spell is a little bit tricky to implement properly in dynamiceffects (or for that matter base dnd). Since it updates some fields and then somtime later turns some of them off.

The effect is specified as 
```
"Macro.execute" Aid @target @spellLevel
```
It is specified as 30 foot range affecting ally. (This is relevant for minor-qols auto-targeting of ranged effects, but you could easily just select 3 targets and ignore setting up the range effect).

The macro is 
```
let target = canvas.tokens.get(args[1]);
console.log("aid macro", ...args);
if (!target) {
  ChatMessage.create({content: `Token ${args[1]} is no longer in scene`, whisper: ChatMessage.getWhisperIDs("GM")})
  return;
}

let increment = 5 * (args[2] - 1);
let origHPMax = target.actor.baseData().data.attributes.hp.max;
let hpMax = target.actor.data.data.attributes.hp.max;
let hp = target.actor.data.data.attributes.hp.value;

if (args[0] === "on") {
  target.actor.update({"data.attributes.hp.max": origHPMax + increment, "data.attributes.hp.value": hp + increment})
  ChatMessage.create({content: `Aid Spell: ${target.name} received ${increment} HP`})
} else {
  target.actor.update({"data.attributes.hp.max": origHPMax - increment, "data.attributes.hp.value": Math.min(hp, hpMax - increment)})
  ChatMessage.create({content: `Aid Spell Expiry: ${target.name} Max HP reduced by ${increment}`})
}
```

It calculates how many points to add. (increment)
The next line highlights a new feature in DynamicEffects. actor.baseData() returns the base data of the character (i.e. before dynamic effects calculations are applied). 

Typically you might choose to update the maxHP via dynamic effects by adding some per level amount in a passive effect.  
If you calculation use that as the basis for the new maxHP effect you will set the base character HP to the dynamiceffects modifier value. This ends up setting the base to the modified value, then adding the modifiers again creating an invalid number.
For example, if you specified had a passive effect
```
maxHP + @abilities.con.mod * 4
``` 
on your character (for a 4th level character and con mod of 3) and the base HP was 20, the sheet would display 32 (20 + 12) as the MaxHP.  

If you used this value to update the base HP Max, the base HP Max would be set to 32 + increment and the sheet would display HP Max as 32 + increment + 12. 

By using baseData().attributes.hp.max the update would become 20 + increment and the final sheet value for max HP will be 20 + 12 + increment which is what you want.

## Module Settings ##

**Consume Charge**
If enabled dynamiceffects will consume a charge as outlined above. If you don't want to do this set it to false. It applies to all connected clients.
 
**Require Item Target**
This setting when enabled requires an item to sepcify targets in the item definition before effects are applied. It applies to all connected clients.

**Players can see effects**
This takes 3 values:
* **none** non-gms will never see the details of an items effects, in the effects macro or in the effects edit dialog. They also cannot edit effects specifications in items. 
* **view only** They can see but not edit effects
* **edit** full control of item effects for trusted users.

## Teleport Addendum ##
dynamiceffects supplies a teleportToToken function that you are free to use. However, if you are only looking to use dynamiceffects for teleport here are 3 macro's that mean you do not need dynamiceffects and are plug compatible with the tutorial. You must have furnace insttalled and advanced macros turned on.
You will need to create 3 macros, **TeleporToToken**, **createToken and deleteToken**. They must be named exactly as shown.
### TeleportToToken ###
```
let targetScene;
if (!token) return ChatMessage.create({content: `No token selected`})
for (let scene of game.scenes.entities) {
  var targetToken = scene.data.tokens.find(t => t.name === args[0]);
  if (targetToken) {
   targetScene = scene;
   break;
  }
}
if (!targetScene) return ChatMessage.create({content: `Could not find token ${args[0]} in any scene`});
CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);

let x = targetToken.x + targetScene.data.grid * (args[1] || 0);
let y = targetToken.y + targetScene.data.grid * (args[2] || 0);
let startScene = canvas.scene.id;

await game.macros.getName("createToken")?.execute(targetScene.id, x, y, token.data)
if(targetScene.id === startScene) {
  await game.macros.getName("deleteToken")?.execute(startScene, token.id)
} else {
  Hooks.once("canvasReady", () => {
    game.macros.getName("deleteToken")?.execute(startScene, token.id)
  })
  await targetScene.view();
}
canvas.pan(x,y)
```
TeleportToToken requires some arguments to be passed, targetTokenId, x offset in grid units, y offset in grid units.
When run the selected token, will be removed from the current scene and recreated at x,y units from the location of the target token (on the first scene that is found that includes the target token).
You would normally activate the macro from a Trigger Happy (another module) script, for example:
```
@Token[Target1] @Trigger[move capture] @ChatMessage[/TeleportToToken Target2 -1 0]
```
which says, when the player moves their token over the token (whose token name is Token1 NOT the actor name) move the token to the location of the token whose name (not actor name) is Target2 and place it 1 grid unit to the left and at the same vertial offset.
The x and y arguments are optional and will be assumed to be 0 if omitted.

### createToken ### This must have execute macro as GM checked.
```
let targetScene = game.scenes.get(args[0])
if (!targetScene || !args[3]) return;
await targetScene.createEmbeddedEntity('Token', mergeObject(duplicate(args[3]), { "x": args[1] || 0, "y": args[2] || 0}, { overwrite: true, inplace: true }));
```
### deleteToken ### This must have execute macro as GM checked.
```
let startScene = game.scenes.get(args[0]);
if (!startScene || !args[1]) return;
await startScene.deleteEmbeddedEntity("Token", args[1]);
```