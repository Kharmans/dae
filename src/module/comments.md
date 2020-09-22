Okay, I struggled with wokring out what level of comments to make, so apologies if these are all at the wrong lebel.

**Actor Effects:**
* If the order is prepareBaseData, then applyActiveEffects what does +1 strength as an active effet mean? It should impact the calculated modifiers but in the proposed order it wont - I think.
* It should be possible to refer to fields in the actor when evaluating effects, since that is where much of the power comes, e.g. 
```
attributes.ac.value = 13 + @abilities.dex.mod.
```
The @notation works well. The downside is that it introduces an implied hierarchy of calculations, e.g.
```
Consitution -> Consitution Mod -> HP max. 
```
The order of application should probably reflect that, either via a derived dependency tree (probably overkill) or some tagging of attrbutes as base (abilities.str) or derived (abilities.str.mod), which is what dynamiceffects does, sort of. The dynamiceffects approach is to define several passes for application of effects and to tag effects with which pass they are calculated in, the same should be extended to "core/system" calculations; so pass 0 = changes to base level data, like raw ability scores, pass 1 is modifiers/base dervied values (and effects on those values), pass 2 active effects that depend on the output of pass 1, pass 3 skills/HP/AC, i.e. the end of the food chain, or some such. [There are some tricky cases like spell slots that cause de to have an extra fixup pass, but the calculation order would be system specific]. I know it is messy to have multiple passes but I don't think you get enough flexibility from a prepdareBaseData then apply ActiveEffects approach.  
* Is the output specifier for an actor effect a field that exists in the template.json? I assume not since you could not reference str.mod otherwise. 
One way to look at it is a system is a set of base attribues and a set of rules to calculate useful things in game. You could rewrite all of the system derived fields into active effects. arugably quite appealing, a system is a set of base attribues and a set of rules to calculate useful things in game.

* Order of application of effects according to mode. I.e. = first, then adds then multiply or vice versa.

* Destination field type. For example str.mod is numeric, what would an effect on that mean if the effect was +1d4? Is it rolled in prepareData or carried through until the modifier is used in a calculation and what does accesing str.mod mean? presumably 3 + 1d4, but it is not very numeric.
* Conditions - application of conditions is a significant part of applied effects so there needs to be a solution for these, but they don't have any actor data to be modified, only token data. (de defines a set of actor flags for conditions, in lieu of any actor data)
* Fields like, hp.value. What does an effect on that mean? i.e. hp + 5. In dynamic effects it means add 5 to whatever base data is stored in the character, which in turn implies hp will always be 5 or greater. The user will see a creture with 5 hp, and apply 5 hp of damage. If the user types in 0 as the new hp level (rather than -5), what does that mean? Is hp.value 0+5 (via the active effect application) or is it somehow worked out to be 0 = (-5 + 5). It might make sense to say that some fields are not modifiable via active effects.

What about systems like simple world building, where atrributes don't exist until they are defined in the game world. What sort of error checking/validation could/should be applied to the effects data. DE knows all of the fields that are valid to modify (breaks for simple world building), from the template data and the actor.getRollData() return values.
**Owned Item Effects.**
An interpretation is that an effect is a set of transformations applied in the scope of a source and destination context, where the source context is one set of actor data (actor.getRollData()?) and the destination context is the Actor.data. For actor effects the source and desination contexts are always trivially implied. For item effects the context depends on whether the item applies its effects to the actor holding the item, or the target of the actor holding the item. 
That suggests that item effects are based on option 1 and when applying the item effect to a destination actor it is converted to a "full" effect.
Under what conditions are owned item effects triggered? It seems that the equipped/attuned, equipped, always active model seems to cover the required cases with the exception of on use. If there is a more general source/target for owned item effects then on use could be an extra activation condition, applyToTarget.
Base Data preparation:
* What is displayed on the character sheet for derived values (currently it is the total value, but should it provide feedback on the source of calculation)

Effects sourced from 1 actor that apply to a 2nd actor. E.g. 
UI
What is displayed on the character sheet? Modified or pre-effects values and what does editing the field mean (presumably chages the base data)
Updates that don't do a diff.
**Key Events and Workflow**
Timeouts: there should be an option that second applications of effects extend the current effect rather than adding a second copy, e.g. potion of fire-resistance.
Timeouts - I am sure you know I'm going to say a real time timeout is not ideal, it should be a game time timout. Even if you don't want to model game time explicitly there needs to be some solution for "you take a long rest" and 8 hours passes. I have a game clock module going cheap.