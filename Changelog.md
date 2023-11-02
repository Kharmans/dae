### 11.0.22
* Fix for toggle effect not working with noneName stackable effects.
* Added new config setting, DIME sync Itemacro (default enabled). If enabled dae will keep the Itemacro macro command and the DIME macro command synchronised, changes to either will be reflected in both. If disabled DIME/Itemacro edits will be maintained separately.
  - If there is a DIME macro (even with an empty command) present that will be used preferentially over any Itemacro macro.
  - Only disable the setting if you ONLY use DIME or ONLY use Itemacro. If you might/do use both leave it enabled.
  - The setting is really only provided in case there is some divergence between Itemacro and dae's expecations of the data stored.

### 11.0.21
* Fix for dae getRollData adding fields to actors when not using dnd5e
* Fix for being unable to edit item onUse macros from the character sheet.

### 11.0.20.1
* Fix for @values being replaced with "undefined" when applying effects
* DIME will now play nicely with monaco-macro-editor

### 11.0.20
* Various (lots of) changes to support CONFIG.ActiveEffect.legacyTransferral = false as well as true. There may be inadvertent breaking changes in this release so v11.0.19 is still available via https://gitlab.com/tposney/dae/raw/v11/package/module11019.json
* First pass to support effects that are disabled when a character is incapacitated.
* Fix for error thrown during getRollData if the actor already has a token.
* Fix for an edge case in dnd5e display of armor calculations being incorrect in the armor config panel. This is most noticeable if using challenge mode armor.
* Fix for incorrect permissions setting in DIME.
* Fix for updating actor effects which have a macro.execute/tokenMagic/creatItem/CE/CUB effect.
* Changes to DAE with the incorporation of an explicit API for dae - thanks @p4535992
* Enhanced ability for user creation of effects.
```js
  Hooks.on("dae.modifySpecials", {specKey, specials, charaterSpec} => {
    specials["system.attributes.my.test.field = [ // the actor key that will be set
      "", // A sample value to know the type of the field, typically "", 0, false
      0, // valid mode for the field 0 = custom, -1 = all
      "My Test Field", // the label to display in the dae editor drop down list
      {a: "Option A", "b", "Option B"} // the values and label to be used in the value drop down list
    ]
  })
```
  - The hook will be called during the init phase so you should make the Hook.on call during script load.

* Updated handling of uuid -> entities in DAE
  - DAE.actorFromUuid(uuid) will return the actor pointed to by the uuid, tokenDocument.actor if the uuid points to a tokenDocument.
  - DAE.DAEfromUuid is deprecated in favor of foundry.utils.fromUuidSync
  - DAE.getToken(uuid) will return the token pointed to by the uuid (if it's a tokenDocument uuid) or find a token on the scene if the uuid points to an actor.
  - DAE.getTokenDocument(uuid) will return the tokenDocument pointed to by the uuid (if it's a tokenDocument uuid) or find the document for a token on the scene if the uuid points to an actor.
  - These function replace DAE.DAEfromUuid, DAE.fromActorUuid.


### 11.0.19
* Fix for potential permission errors for macro.execute/macro.ItemMacro etc

### 11.0.18
* Fix for dependent AE (i.e. macro.ce, macro.execute etc) not being run for item passive effects.
* Support enabling/disabling DIME in the title bar separately from DAE in the title bar.
* Fix for macro.actorUpdate running on local client instead of GM when needed.

### 11.0.17
* Fix for chat cards not being displayed when browseer/app reload is done.

### 11.0.16
* Slight addition to macro.execute function.xxxxx calls. You can now use function.myFunc("arg1"...) provided the myFunc returns another function which is then called as the function to execute. Expected use is to have a single module entry point that returns the function to execute, for example getFunc("mytestFunction").


### 11.0.15
* First release with new build scripts thanks @p4535992
* Fix for function. including erroneous reference to workflow. thanks @Elwin

### 11.0.14
* DIME now always writes changes to flags.itemacro.macro. It will still pick flags.dae.macro, but on save will remove flags.dae.macro and write to flags.itemacro.macro.

### 11.0.13
* Fix for effect suppression not working.

### 11.0.14
* switch DIME to always use flags.itemacro, support fetching both flags.dae.macro and flags.itemacro.
* Fix for macro.execute CUSTOM macro-name not working.

### 11.0.13
Fix for suppression not workging


### 11.0.12.4
* Make the DAE active effect editor the default sheet

### 11.0.12.3
* Fix for etror being thrown when editing an item.

### 11.0.12.2
* Dime/Itemacro editors can now be used interchangeably

### 11.0.12.1
* Fix for some missed itemacro/dime interactions
* Added colored dae/dime title bar items - thanks @thatlonelybugbear

### 11.0.12
* Added DAE Item Macro Editor (DIME) which is a complete replacement for itemacro. DIME will pick up any itemacro macros present on the item. When the macro is saved the macro command is stored on flags.dae.macro.
* Fix for getRollData to return a tokenId/tokenUuid where possible.
* When calling item macros preferentially lookup flags.dae.macro and if not present flags.itemacro.macro.
* Fix for not using the preparedData for item effects when applying effects.
* Removed support for pre dnd5e v2.2 tool proficiency keys.
* Added support for post dnd5e v2.2. tool proficiencies. You can set prof/ability/bonus for individual skills or for groups of skills. If you subsequently edit the configuration for a tool proficiency from the tool proficiency config application then the tool proficiency will become permanent (i.e. removing the active effect will not remove the proficiency which you will need to remove by hand).
* Fix for system.traits.weaponProf.value not being reflected in items with proficiency automatic.
* **Breaking** DAE now respects the standard foundry way of setting which sheet to use when editing an effect. You can specify the desired sheet via the sheet configuration dialog. The DAE sheet can either be chosen per effect or set as default.

### 11.0.11
* Patch so that dnd5e dropping of Convenient effects to items does not fail.

### 11.0.10
* Dae now uses the configured vision modes to create the ATL.sight.VisionMode dropdown.
* Dae now uses the configured detection modes when creating the keys ATL.detecectionModes.XXXX.range keys. SO detect magic spell should now e possible via an active effect.

### 11.0.9
* Added support system.abilities.str/dex/etc.max to be set via active effects
* Additonal parameter removeSequencer: boolean = true in deleteItemActiveEffects and deleteEffects, if false sequencer animations attached to the effects will remain.
* Change to active effects processing to improve the type guesses for target fields.

### 11.0.8
* Added new flag on an active effect, dontApply which means both midi and dae will skip that when applying effects to a target. Allows you to have an active effect stored on a item that you can apply manually later. Means you can treat an item as a repositry of effects to be applied by macros.
* Added new api function, to delete applied active effects on a set of tokens from an item
```js DAE.deleteItemActiveEffects({targets: Array<Token | TokenDocument | string>, origin: string}))
```

### 11.0.7.1
* Remove out of date premadeitems compendium

### 11.0.7
* Added a fix for DAE potentially throwing an error when dfreds modules not including convenient-effects are loaded. This is a DAE problem not a dfreds issue.
* Improved some error messages in DAE when running a macro to make it easier to track down where the error occured.

### 11.0.6
* Added support for force displaying passive effect icons on the token and combat tracker. Available in the effect editor on the details tab
  - If creating the effect programatically set effect.flags.dae.showIcon = true.
  
### 11.0.5
* Added dae.safeEval for change values. This is evaluated against the actor's data when the change is applied, but before other processing. This means any target field can have computed expressions (live bonuses etc) even though dae will place the result of the expression as a string. The evaluation is done against actor.getRollData(), so any of the actor data is available as well as functions/constants from Math.
- flags.dae.AcrOrAth OVERRIDE dae.eval(skills.acr.total > skills.ath.total ? "acr" : "ath"), will set the flag value to acr/ath.
* Added dae.roll to allow you to embed evaluated roll expressions in your effects
  - There are some expressions that cause problems when embedded in a bonuses field, e.g. @abilities.str.mod(d4) et al. You can't simply do
  ``bounses.mwak.damage ADD dae.eval(abilities.str.mod)d4``, since when eval is done it is before abilities.str.mod has been calculated and it will resolve to 0d4. You can do 
  ``flags.dae.bonusDamageDice OVERRIDE dae.eval(abilities.str.mod)d4 ``
  and
  ``bonuses.mwak.damage ADD +@flags.dae.bonusDamageDice``
There is nothing that you could not do with macros that is enabled by these functions, they can just be a little bit clearer.

### 11.0.4
* Fix for effects with no flags throwing an error when edited/referencing specialDuration
* fix for calling a dae macro, always pass lastArg.efData.flags.dae.itemData if the item exists.
* Add actorUuid, actorID, tokenUuid (if defined) and tokenId (if defined) to actor.getRollData() - which is used in most condition evaluations.

### 11.0.3
* Replace all occurences of @actorUuid etc when creating an effect, not just the first one.
* Tweaks to effect creation on the item sheet. 
  - New effects on an item will have the name of the item and its image by default. The effect name will have a number attached if an effect of the same name already exists.
  - Created effects correctly have trasnfer (passive)/suspended when created from the core item sheet.
  - Editing effects on actor owned items is supported by core, so I have removed all handling for this in DAE.
* Drag and drop of effects to/from Actors/Items re-enabled.

### 11.0.2
* Fix for DAE.blindToken/restoreVision not working with dfreds convenient effects installed
* Added macro.CLT for condition-lab-triggler effects.
  - macro.CUB will remain supported and behave exactly as if it were a macro.CLT effect.
* More fixes for the DAE Active Effects app. (Thanks #thatlonelybugbear)
  - correctly display time remaining
  - display effect name
* Improved support for condition-lab-triggler. It now replaces Combat utility belt everywhere and support for macro.CLT. (Thanks @thatlonelybugbear)
  - macro.CUB effects will act as macro.CLT effects (no change is required), but you are advised to migrate to macro.CLT over time.
  - Be aware that condition-lab-triggler does not interact with the foundry core effects, like blinded and invisible etc so using CUB condition Blinded won't update the tokens vision. When CLT returns the correct statuses this will work.
* Created StatusEffectName to let you set the name of applied status effects, this supercedes StatusEffectLabel which is now deprecated (but will function as statusEffectName)
* Fix for @targetUuid, @target not being evaluated when applying non-transfer effects (i.e when rolling an item) to a target. This allows things like
  ``flags.midi-qol.advantage.abilities.save.dex CUSTOM checkNearby(1, "@targetUuid", 5)`` to give advantage to saves when the target token has a nearby ally.
* Additon: when applying passive effects (effects added by equipping an item) you may specify @token, @tokenUuid, @actor, @actorUuid (all of which reference the actor/token that has the item) which allows a passive effect which will give advantage when a token has an ally nearby.
``flags.midi-qol.advantage.abilities.save.dex CUSTOM checkNearby(1, "@tokenUuid", 5)``
or
``flags.midi-qol.disadvantage.attack.attack.rwak CUSTOM checkNearby(-1, "@tokenUuid", 5)``
which will give disadvantage to ranged weapon attacks when there is a nearby foe.

### 11.0.1
* Put back support for new CE effects in the DAE actor/item active effect editor.

### 11.0.0
* First v11 only version of dae. This means development of the foundry v10 version will revert to bug fixes.
* Moved to core ActiveEffects for all effects including on owned items. This means there is no special case code for active effects on owned items.
* Fixed a bug with not setting actor.statuses which causes effects like blind/etc not working.
* Update to the active effect sheet to match v11 ActiveEffectConfig sheet.

### 10.0.37
* Fix for removing items not calling item macros with "off".
* Some documentation fixes
* Merged request from @thatlonelybugbear for ActorUpdate special case.
* Fix for error when loading DAE in non-dnd5e system.
* Change for v11/CE statusEffect, will now fetch the effect from dfreds.effects.all matching by the status id in the effect statuses.
* Fix for sometimes not finding the item macro when an item has been deleted.
* FIx for traits.ci.value/all not working when applied as an effect to an actor.
* Do not stack by origin now also checks the name of the effect. This means an item can have two effects (with different names) and specify do not stack by origin and it will work.

### 10.0.36
* Fix for error thrown with v11 only active effects (flags.core.statusId) not defined.
* First fix for ghost concentration (and other effects) being applied to tokens.

### 10.0.35
* Fix for some deprecation warnings for flags.core.statusId
* Fix for speaker error when calling macros
* Support for some honor/sanity effects.

### 10.34.1
* Remove some debugger statements left in by accident

### 10.0.34
* Fix for effect durations of < 1 round of seconds being the same as applying a passive effect, will now default to 1 turn.
* **BREAKING** If an effect specifies both a duration in seconds and one in rounds, the duration in rounds is ignored when applying the effect, only the duration is seconds is used. In this version DAE will preferentially use the duration in rounds, if there is one and the target actor is in combat.

### 10.0.33
* v11 support for new mechanism for special statuses in effects.
* Active effects "StatusEffect" now work correctly in v11.
* Allow Convenient Effects custom effects that are not transferred from an item to stack when do not stack by origin is specified.
* Fix for dae macro.ItemMacro macro effects not being found in v10/11 of dae.
* With some trepidation I have reorganised some of the processing for CE/CUB/token magic effects triggered when creating an effect. Seems to work but I would not be surprised if something crawls out of the woodwork.

### 10.0.32
* To avoid collision with existing macro scope.lastArgValue and therefore lastArgValue are available inside the macro. This replaces scope.lastArg and lastArg being defined. You can refer to lastArvalue in both v10 and v11.
* Name argumets (i.e. targetUuid=@targetUuid) are avaialbe by name in the macro and are not passed in args. Arguments of the form @targetUuid are still passed in args.
* Fix for deprecation warnings for FormDataExtended.
* Fix for CONFIG.abilities deprecation warnings in dnd 2.2.0

### 10.0.31
* Fix for calling macros in v11 stable. DAE uses foundry's built in macro.execute in v11 stable.

### 10.0.30
* Made some changes to the blocking of creating active effects when no duplicates by origin/name are specified.
* Allow multiple effects of the same name when created by hand on an actor.
* made evalInline synchronous to move the inline roll processing to the preCreateActiveEffect hook.
* macros are now called consistently with the v11 arguments processing. 
  - args (an array is still supported)
  - "scope" is also set, supporting scope.args, scope.lastArg (and therefore args and lastArg as values inside the macro). 
  - Named parameters are also supported, so targetUuid=@targetUuid allows you to reference scope.targetUuid or just targetUuid inside the macro without needing to count which element of args it is.
  - support for advanced macros/furnace has been dropped. (It's not needed).
* Added support for options {isUndo: true} in creation and deletion of active effects, which will avoid calling macros or applying macro.effects when an effect is added. actor.createEmbeddedDocuments("ActiveEffect, effectData, {isUndo: true});

### 10.0.29
* Macro.itemMacro effects store the macro on the effect when the effect is created - so any changes to the macro will require the effect to be reapplied. This also means macro.itemMacro calls for consumables that are removed when used will now work as expected.
* A duration of -1 seconds in an effect means that the effect will never expire unless there is a special duration to cancel it.
* Items created via macro.createItem have flags.dae.DAECreated set to true.
* There is now a dedicated discord for my modules https://discord.gg/Xd4NEvw5d7

### 10.0.28
* Incorporate change for auto complete list to be always visible. From chris of CPR.
* Fix for @item.level needing to be surrounded by "".

### 10.0.27
* renable onUpdateTarget/Actor flags which were turned off by mistake.
* Remove dependency on advanced macros when calling macro.execute/macro.itemMacro/macro.createItemRunMacro
* Support v11 args as well as existing args as an array. In line with the v11 arguments to macros you can now reference args.lastArgs and set arguments like "attackerStrength=@abilities.str.value defenderStrength=##abilities.str.value", and acessed as args.attackerStrength and args.defenderStrength, as well as still support args as an array (well args[i] and args.length are supported, but not args.map etc). I've not come across any errors, but I'm leaving the manifest link for 10.0.26 in case there is a breaking problem.
* Fix for sw5e prepareScaleValues not being called

### 10.0.26
* Fix for onUpdateTarget not being applied thanks @thatlonelybugbear.
* Another fix for applying macro.CE effects to unlinked tokens - all the problems seem to be resolved in v11 without the fancy shenanigans.
* Fix for statusEffect not picking up all flags on an effect, means status effect is now more compatible with effectMacro.
* Fix for not triggering effectMacro toggle on/off when toggling an effect.
* A change to macro handling, midi now never uses advanced macros. It turns out there seems to be a bug/feature where AM always uses the selected token. Dae checks that the user has permission to execute the macro and silently forwards to the GM if required.
* First steps for v11 compatibility. More or less works (I think) but not ready for a real game.


### 10.0.25
* Fix for damageBonusMacros that reference an ItemMacro - looks like a brain freeze on my part.

### 10.0.24
* Fix for deleting dependent effects firing at the wrong time and potentially not working.
* Fix for duplicating onUpdateTarget effects if prepareData is called.
* Added setTimeout(nop, 1) in token effect application to try and manage the timing better.
* Some tweaking of application of macro.CE/CUB effects to make it more? robust.

### 10.0.23
* **Breaking** if an active effect has a duration < 60 seconds and the token is in combat the effect duration will be converted to rounds and turns when applied to a target. This does not apply to convenient effects (yet).
* Fix for error "no item macro for undefined" errors when transfer effects have a macro.itemMacro to execute.
* Fix for multiple macro.createItem transfer effects on an actor.

### 10.0.22
* Fix for macro.CE having empty list and not being able to apply CE effects post Convenient Effect 4.0.x

### 10.0.21
* macro.createItemRunMacro behaves the same as macro.createItem, but in addition when the item is created on the actor DAE will run the item's Item Macro with args[0] set to "onCreate" allowing you to save the uuid of the created item (passed in lastArg) somewhere for future reference.
* Items created via macro.createItem will replicate the dnd5e base behaviour of being set not proficient, not equipped and not identified, rather than copying the values of the stored item.
* Fix for effects that have multiple macro.CE changes in them.

### 10.0.20
* Fix for consumable items imported from dbd importer duplicating non-transfer effects on the imported actor. May require a fix from dnd importer as well.
* More cleanup of macro.createItem calls. Needed to put in a dealy for macro.createItem n unlinked tokens.
* Fix for some more cases of duplicating effects on item create.

### 10.0.19
* Updated ATL.xxxx effects in the auto complete. Have not tested evereything. If someone who uses the module could test it I would be grateful. I based the settings on https://github.com/kandashi/Active-Token-Lighting/wiki/Key-Reference
* Fix for some instances of createItem duplicating effects


### 10.0.18
* Fix for DAE breaking scale values in dnd 2.1.3.

### 10.0.17
* Fix for system.traits.dr|di|dv.all not being applied correctly
* updated ja.json

### 10.0.16
* Fix for macro.itemMacro effects in transfer effects( fixes the error no item macro for undefined warning).
* Fix for doCustomArray value error thanks @Elwin

### 10.0.15
* Fix for effect values that are now Sets, specifically traits and profiencies.
* Fix for trait multipliers (damage immunities) with the change to sets.
* Fix for effects being disabled due to condition immunities.

Changes should be backwards compatible with 2.0.3 but have not tested in detail. So only upgrate if you have moved to dnd5e 2.1.x

* Added ko-fi donation link https://ko-fi.com/tposney

### 10.0.14
* Fix for sw5e pact magic bug
* Fix for inline rolls not being processed in some cases.
* Fix for passive items with macro.createItem not creating/removing item on identify/equipped toggle.
* Fix for items with a permanent duration not applying effects correctly.

### 10.0.13
* Fix for some typos in 10.0.12 - thanks @Elwin

### 10.0.12
* Fix for macro.actorUpdate to work on non-owned tokens/actors.
* Updated macro.createItem ItemUuid, permanent. This creates items that are not automatically removed on expiry of the effect.

### 10.0.11
* Fix for error thrown when a vehicle is in the sidebar (in prepareData).
* Fixed support for flags["midi-qol"].castData being set correctly.
* Fix in case you have a self target item AND specify self target in the effect. Thanks @thatLonelyBugbear
* **Reminder** When reporting a bug for an active effect's behaviour please test with DAE enabled and disabled, particularly if reporting to the dnd5e/foundry githubs. They are unable to deal with issues caused by DAE. Also remember core foundry/dnd5e does NOT support referring to @abilities etc in the change.value (except if the field is a bonus field), nor does it allow you to modify derived fields like .mod or .save fields in the change key, so problems with those are DAE specific.

### 10.0.10
* Added new macro effect, macro.createItem CUSTOM uuid, which will create the item referenced by the Uuuid on the target actor. On expiry/removal of the effect the item will be removed, which provides a way of providing a tempoary item/feature to an actor for the duration of the feature. Should simplify a variety of effects that would previously have required a macro to create the feature/item on the target actor.
* Enhanced the effect editor so that dragging an item onto a change value field will place the uuid of the item in the field. (Useful with the above mentioned macro.createItem).
* Fix for overriding system.equipped and system.attunement in preUpdateItem hooks when toggling suppressed status for items. Fixed an error where passive effects were not being disabled/enabled on equipped/attuned toggle.
* Fix for self effects also being applied to the target.
* Allow pact.max to be updated so that long rest will replenish up to the new pact.max value.

### 10.0.9
* Added support for "metaData" to be passed to doEffects which will get added to the active effects applied to the target.
* Added support for system.attributes.ac.calc as an override field to allow you to change the ac calculation on an actor and if set to custom to configure the damage calc via ac.custom.
* Added support for system.attributes.ac.custom to allow you to add effects to configure the ac calc of an actor.
* Fix for effects dr.all/di.all/dv.all not populating the appropriate dr/di/dv values.
* Fix for getRollData breaking @prof max item uses.
* Effects which specify an ItemMacro flag value, like DamageBonusMacro can now simply specify flags.midi-qol.DamageBonusMacro CUSTOM ItemMacro and dae will convert ItemMacro to an actor specific ItemMacro.UUID which will map to the item that caused the effect to be applied. For example Sneak Attack/Hunter's Mark in the sample items compendium (and many others) - means you do not need to rename the item on equip.

### 10.0.8
** Breaking dae now requires dnd5e 2.0.3
* Changes to support dnd5e 2.0.3 di/dr/dv

### 10.0.7
* Fixed some v10 deprecation warnings.
* Cleaned up some of the DAE. fumctions for v10.
* Update DAE.blindToken, DAE.restoreVision to work with v10

### 10.0.6
* Fix for deprecation warning on doing item update.
* Fix some cases of not setting lastArg.effectData.flags.dae.itemData.
* Fix for not fetching item macro sometimes
* Added combat end (combat is ended) and create combatant (actor is added to combat) as special duration expiry options.
* If you have some very old items the origin may incorrectly have OwnedItem in the string which will throw an error in fromUuid. If you see these errors you can run 
```js
await DAE.cleanActorItemsEffectOrigins(_token.actor)
```
while having an a token selected or
```js
await DAE.cleanActorItemsEffectOrigins(game.actors.getName("The name of you actor"));
```

### 10.0.5
This release just cleans up some of the 10.0.4 changes
* Fix for toggle effect item property
* Fix support for custom skills module.
* Fix for incorrect handling of passive effect changes on items.
* Stopgap fix to support foundryvtt 10.279/stable, which currently breaks active effect editing on unlinked targets. You must use the DAE active effect editor.

### 10.0.4
* Stopgap fix to support foundryvtt 10.279/stable, which currently breaks active effect editing on unlinked targets. You must use the DAE active effect editor.
* Fix for toggle effect item property
* Fix support for custom skills module.
* Fix for incorrect handling of passive effect changes on items.

### 10.0.3
* added support for templates via flags.dae.deleteUuid
* Fixed a bug when editing effects on owned items where the drop downs would not populate when an effect was edited. Possibly fixes other odities with editing effects on owned items.
* Fixed a bug in editing special traits using the dae feature to show active effect values.
* Fix for onUpdateTarget not triggering on, for example, data.attributes.hp.value = 0.
* Enhanced treatment of system.abilities.src/dex/etc.bonuses.save/check. Mode custom will now correctly handle the need for a "+" sign, so no ugly double plusses on the roll display.
* Instantaneous durations are converted to 1 second/1 turn.
* Support for dnd5e-custom-skills module and setting .value for the skill.
* Fix for rapid equip/unequip not functioning as expected.
* Effects that are marked as suppressed (attunement required or not equipped) will disable/enable all macro.XXX effects (CE/CUB/tokenMagic/execute/ItemMacro) when suppressed/unsuppressed.
* Updated ja.json thanks @Brother Sharp

### 10.0.2
* Fix for overriding actor sheet flags editor
* Fix for effect.duration.remaining not updating.
* Fix for so statusEffect Restrained (CUB) (etc) will behave as isfCUB has applied the condition.
* remove require item targets setting as it does not do anything.

### 10.0.1
* pre release of DAE for foundry v10.
* This is **NOT** suitable for gameplay and has **NOT** been extensively tested.
* There are bound to be many bugs and am delighted to have them logged on the gitlab so long as they reference that they are v10 bugs.
**Known Bugs**: 
  - There seems to be a foundry (or dae) problem where updating unlinked token actors fails.
  - None of the macro.tokenMagic, CUB support, Convenient Effects support or ItemMacro support has been tested and there are sure to be issues there.

### 0.10.24
* **BREAKING** onUpdateTarget macro calls will now have args[0] set to "onUpdateTarget".
* As a reminder it is strongly recommended that you create onUpdateTarget effects with an update filter which is as precise as you can make it, this will significantly improve performance.
* Support for a new dae effect flag, Self Target (on the effect details tab for effects owned by an item). doEffects now accepts an additional optional argument selfTaget, true means only apply selfTarget effects and false only apply non-selfTarget effects. See midi-qol changelog for details of how to use.

### 0.10.23
* Some improvement to onUpdateTarget to instantiate originItem from effect flags if the item was a consumabl that was deleted through consumption.
* Fix for it.json and editing active effects

### 0.10.22
* Fix for applying macros multiple times if more than one present in an active effect.
* Fix for inadvertent breaking of editing item effects because of change to en.json in languages other than english.
* Fix for incorrect pt-br.json
* Support for midi handled special duration isInitiative to enable effects to expire when initiative is rolled.


### 0.10.21
* Cleaned up active effect creation on owned items. Default is now NOT a transfer effect, changing effect types should correctly remove the effect from the actor, and toggling transfer/not transfer for item effects should be correctly reflected on actor effects.
* Fixed inability to reference item data in DAE effects. Note passive/transfer effects cannot reference item data. (The effect is applied by core foundry and the DAE argument valuation is not performed).
  - effects which simply create a string on the actor (like all of the bonus fields) will pass the value unchanged.
* **BREAKING** Support for @item in non-transfer active effects when rolled with an item. @item refers to item.getRollData().item, so references like @item.formula will work.
  - @itemData still refers to item.data.
* added now working @data.spells.spell1.max etc. to change max spell slots available.
* Experimental. Added "flags.dae.onUpdateTarget" and "flags.dae.onUpdateSource" with the change value being "Label,macroReferece,other args". This effect records a flag on the target actor (onUpdateTarget) or the sourceActor (onUpdateSource) that recordds the origin item, the targetActor and the initiating actor (sourceActor) on the target (flags.dae.onUpdateTarget) or the source actor (flags.dae.onUpdateSource). If a macro is specified the macro will be called whenever the targetActor is updated.
See the DAE Readme.md for more information. This feature is intended to make marking targets and sharing state (i.e. shared damage) simpler, e.g. Hunter's Mark and Warding Bond both included in midi-qol sample items compendium (v0.9.63).
* Updated ja.json. Thanks @Brother Sharp#6921

### 0.10.20
* Fix for CE status effects not being treated as status effects (if you click on the effect in the token HUD it would duplicate the effect).
* Support for StatusEffectLabel to force set the label of an applied StatusEffect.

### 0.10.19
* Added stackable option - don't stack, check by name, to support the RAW when dae is applying effects.
* Fix for movement.all failing for hover.
* Fix for effect.data.disabled being set to 0 on some effects.

### 0.10.18
* Remove dependency on About-time, now uses simple calendar for date/time calculations.

### 0.10.17
* Fix for warning thrown when updating an active effect.

### 0.10.16
* Packaging fix

### 0.10.15
* Don't attempt to apply CUB conditions if enhanced conditions is disabled.
* Possibly **breaking**. I have rewritten the calls to macro.execute so that if advanced macros is not installed execution will still happen (I hope) correctly. Execute as GM macros are **NOT** supported without advanced macros. I would appreciate macro writers test with advanced macros disabled and report any problems.
* Fix for non string active effect changes values (must be a programatically created effect) throwing an error.
* Enhanced [[expr]] inline macros so that "[[@item.level]]d6 + 3d6 + [[1d6]]" will evaluate to "1d6 + 3d6 + 4" for a first level spell and a d6 roll of 4. This allows various effects that would otherwise break the dnd5e roll parser.
* Corrected pt-BR.json

### 0.10.14
* Fix for advantage reminders inline rolls being "eaten" by DAE.

### 0.10.13
* deal with null/undefined actor values when doing numeric operations in macro.actorUpdate
* fix typo in DAE.teleport().
* **Breaking** DAE will treat any effect whose label matches a condition (as in conditiion immunity) as a condition and mark the effect disabled if the actor has immunity to that condition (i.e. unavailable). The conditon will still be present but none of the changes present will be applied.
* Fix for broken initiative advantage and disadvantage flags.
* Updated ja.json thanks @Brother Sharp

### 0.10.12
* Fix for **fields** in macro.actorUpdates

### 0.10.11
* Fix for dnd1.6.0 class advancement being **very slow** (due to DAE recreating active effects on changed items). 
* Tweaks to system compatibility settings.
  - DAE currently ships with dnd5e/sw5e marked as compatible and will load for those systems. 
  - If the system matches the DAE incompatible list (durrently pf2e) DAE will not load.
  - I will update the compatible/incompatible list as requested.
  - If the system.json specifies flags: {daeCompatible: true} DAE will load.
  - If the system.json specifies flags: {daeComapatible: false} DAE will not load.
  - If the dae config setting DaeUntestedSystems is false only systems marked as compatible will allow DAE to load.
  - If the dae config setting DaeUntestedSystems is true DAE will load for systems not marked as incompatible.
So if you want to experiment just enable the DAE setting for untested systems and see what happens.

### 0.10.10
* Fix for ``**fields**`` 
* Warning for system compatibility
* Fix for load errors on non dnd5e systems.
* Fix for setTileVisibility error.
* Fix for actorUpdate effects with multiple ``@fields``

### 0.10.09
* Fix for @item.fields not working, preferred usage is @itemData.
* Fix for macro.actorUpdate to support leaving field references unchanged when applied, use ``**attributes.hp.value**``, which will be converte to @attributes.hp.value on application.
* Fix for error message when no macro is found.
* A slight improvement to the behaviour when no token for the actor is on the canvas, macro.execute and macro.ce will still function, only macro.CUB and macro.tokenMagic will fail to execute.

### 0.10.08
* Fix for macro.actorUpdate not being called correctly.

### 0.10.07
* Fix for vehicles AC effects definitions
* Some fixes for sw5e initialisation.
  - Fixed errors on startup.
  - Process weapon/armor/tool proficiencies correctly for edit list.

### 0.10.06
* Fix for macro.CUB not adding conditions correctly.
* Fix for macro.CE not adding conditions corretcly.
* Fix for macro.execute not working correctly.

### 0.10.05
* fix for flags.dnd5e.meleeCriticalThreshold and others introduced in 0.10.1

### 0.10.04
* Changed support for Conditional Visibility. Support now requires Convenient Effects. All CV effects are available via marco.CE. If you toggle the CV effects to be status effects, you can apply them via statusEffect CUSTOM Condition (CV) (CE) as needed.
* Added DAE.teleportToken(token: Token, scene: Scene, {x:number, y: number});
* Teleport to token will accept a target token id as well as a name.
* DAESetFlag et all will now accept an actorUuid as well as an Id.
* Added a semaphore on add/remove cub effects, convenient effects, token effects and macro.executes, to enforce serialised execution, which should clear up some of the effects not being removed problems. It is likely to make things a little slower.
* Fix for incorrectly showing templates in Token Magic drop down of effects to apply.

### 0.10.03
* Added support for modifying DAE behaviour without having to add another DAESystem, via some hooks called when DAESystem is loaded. Useful for systems released as modules rather than systems - typically variants of a base system.

### 0.10.02
* Fix for a couple of typos - thanks @Elwin

### 0.10.01
* **Majorly** potential breaking. Do not update just before game time, there are almost certain to be bugs. I have provided an archived release of 0.9.12 which you can access from the module page.
  - DAE is now system agnostic. Don't get too excited, without specific system support the features available are limited and on the systems I've tested 2 out of 3 have serious problems without customisation. However, the tweaking to get DAE to work with a system is not too bad. Any system developers out there who want to work with me to develop DAE for you system let me know.
  - dnd5e specific code is isolated to DAESytemdnd5e.js and DAE will auto detect and configure for dnd5e and sw5e.
  - sytem writers can add DAE support via a single class to specify extra fields that can be modified, a custom effect application method, prepareData override method and a few other bits and pieces.
* Inline roll expression [[1d10+20]] will remain evaluated at the time the effect is applied. Deferred inline expressions [[/r 1d10+2d20]] will be applied without rolling, i.e. as a text string to the target field.
* Removed completely out of date sample macros compendium.
* Put back @data filtering for non-transfer effect application.
* Support @item. fields in effect values/arguments, which always refer to the item used by the actor.
* Support for midi-qol toggleEffect item option. (Extra toggle effect optional parameter in doEffects)

### 0.9.12
* Added "sdi", "sdr", "sdv" types for sw5e.
* Fix for removing too many sequencer effects when conditions removed.

### 0.9.11
* Fix for automated animations permanent effects not deleted on manual effect deletion.
* Fix for dnd5e error when computing suppression on unlinked tokens.
* With foundry 0.9.251 the ability to pass numeric fields as changes is restored. DAE will auto detect the foundry version and some oddities in effect application when the target field can be undefined/null will go away.
* Created per actor type effects list. When creating actor effects you'll see a constrained list of fields based on the system template.json. You can still type in whatever field you want, but the auto complete/drop down list will be reduced. **There is a high chance this will cause unexpected bugs so don't update 5 minutes before game time.**
* Fix for armor attribution not displaying correctly.
* Added zeroHP special duration (requires midi-qol 0.9.30)
* Reinstated marking effects as disabled/enabled on item equip/unequip to allow **macro effects to be enabled/disabled on item equip/unequip. MAYBE BREAKING for some macro authors**.

### 0.9.10
* Fix for macro.execute bug introduced in 0.9.09
* Fix for newly created effects not having suppression set correctly.

### 0.9.09
* Fix for @item arguments to macros being broken.

### 0.9.08
* Fix for throwing errors for effects wihtout an origin set.
* Removed dependency on aboutTime for display effect duration.
* Fix for typo when in choosing location for macros to run (thanks @Elwin).

### 0.9.07
* Fix for adding effects to items owned by unlinked tokens.
* Added support for macro repeat start/turn end in macro.actorUpdate so that the updates can be applied each turn, e.g. heroism. You can couple with an overtime effect to have the maro.updateActor run until a save is failed (removal of the overtime change will remove all cchanges in the same effect).

### 0.9.06
* Fix for macro.execute processing drror introduced in 0.9.05

### 0.9.05
* Cleaned up the DAE item/actor effects editor. You can now create/delete effects on owned items. Updates to reflect actor/item changes cleaned up and synched with the actor/item effects tab.
* Changed the DAE title bar icon to the wrench instead of the clipboard. Added option to only display the wrench icon in the title bar.
* Change to support backwards compatibility for midi-qol optional flags .damage, .attack, .check, .save, .skill
* Support for additional resources from the module "5e-sheet resources plus" - up to tenth, if the module is active. flags. data.resources.fourth.max, data.resources.fifth.label etc.
* **Maybe Breaking** I cleaned up the argument evaluation for macro.execute/macro.ItemMacro to hopefully be a little bit cleaner. 
  - I've not seen any edge cases but if your macro suddenly fails to find arguments, that could be it. Please let me know. 
  - Macro arguments can now reference @item.whatever as the item used for the attack/cast is now available.
  - Remember that @fields are evaluated against the item user and item, ##fields are evaulated against the target actor (##item is not supported).

### 0.9.04
* Fix for broken effect list if tidysheets5e not installled.

### 0.9.03
* Fix for broken special duration.

### 0.9.02
* Added @stackCount for stackable effects which can be used in active effect evaluation. Since you almost always want to refer to the stackCount on the target, for non-passive effects remember to use ##stackCount so it will evaluate on the target not the caster/attacker.
* Changed internal calculations to use Roll.replaceFormulaData to be consistent with roll expressions. I've not found any case that cause problems, but if you do let me know (effects that no longer work, macros that get wrong arguments).
* Allow active effects to modify data.attributes.ac.EC and data.attributes.ac.AR (for challenge mode armor).
* Allow active effects to modify maxPreparedSpells (a tidysheet derived fields).
* Fix for DAE.teleportToToken (and others) which broke with v9.xxx
* Removed the toast messages for transfer effects applied to an owned item. It seems that they are correclty appied to the actor so the message has been disabled. If you see any oddities when dropping an effect onto an item let me know.
* **Only relevat to macro writers running into some odd edge cases**. New options for macro.execute and macro.ItemMacro, you can append .local or .GM (so macro.execute.GM) to force the execution of an effect locally or on the GM client. Without the .local/.GM macros will executed according to the ownership of the target token, if owned locally otherwise on a GM client.
  - if an item has multiple changes .GM has precedence over .local which has precedence of no specifier.
  - if any of the effects have .GM the macro will always run on a GM client.
  - if any of the effects have .local (but none have .GM) effects will be run on the local client.
  - Otherwise effects will run locally if the rolling player owns the token and on the GM otherwise,

### 0.9.01
* Fix for longstanding bug with armor/weapon/tool proficiencies that would populate with too short a list (i.e. only the categories).
* Changes to effects on owned items - these can now be edited just like those on world items, including adding effects to owned items.
  - I've shamelessly stolen code from @calego (with permission) that enables full editing of owned item effects and included it in DAE. With DAE enabled you can edit effects on owned items as if there were being edited on world items. This works with both the DAE edit app or the core edit app.
  - All kudos to @calego but all bug reports to me. There could be some so be a little bit wary.
  - In case there are any show stopper issues, you can revert to the old DAE effect editor.behaviour by enabling legacy ownd item edit in the DAE config settings. Toggling this settings forces a reload.
  - As a bonus feature there is now a transfer to actor button on passive effects that lets you reapply the passive effect. Useful if the passive effect was removed from the actor by mistake.
  - I've done some testing and can confirm that the module **Drop effects on items** also from @calego works with DAE. So with that installed you can drag effects from items/actors to actors/items. So far I've only done limited testing but have not found any issues of substance. Installing this module is **higly recommended**.
  - **Breaking** You can now edit item effects by clicking the edit button without worrying about if it is an owned item or not. Hence the item DAE button (in the title bar) is no longer required and I will be removing it in 0.9.x. **This means that you will lose the ability to have active effects on class items so migrate those effects to a non class item before it is too late!**

  Known Issues. None so far, but there are certain to be some. Please include detailed information in error reports. Feature X does not work is useless to me in trying to find out what is going on.

### 0.8.84
* Fix for macro.tokenMagic effects on linked actors with multiple tokens on the scene
* Tested **Drop Effects on Items** and it seems to work fine with DAE. This is very useful functionality and I reccomend it if using DAE, which means I won't seek to develop this myself.
* Fix for breakage in daeApplyEffects if foundry version is not 0.9.245

### 0.8.83
* Fix for durationEpxression not defined and unable to open effect editor.

### 0.8.82
* Fix for movement.all and latest foundry, which sets empty movement to 0.
* Fix for latest foundry (9.245) that seems to **break active effects on numeric fields which are null**, like hp.max for example.
* Added a duration expression to active effects (passive item effects or item applied, but not hand edited effects). This can be any roll expression and the value returned by the roll expression is interpreted as seconds. If the recipient of the effect is in combat the duration will be converted to rounds.
  - If the effect is passive (created when an item is added to the character) the source data for the effect will be the actor that received the item.
  - If the item is applied because an item was used the source data for the expresion will be the actor that used the item.
  - Example if a character with dex 18 adds an item with a passive effect whose duration expression is @abilities.dex.value * 6 the effect will last for 108 seconds or 18 rounds. The ## notation for deferring evaluation is **not** supported.
  - If an actor with dex 14 applied an effect (via using an item) to the same actor the expression would evaluatte to 84 seconds or 14 rounds.
* Removed some items from premdade items compenidum (AC calc effects) and cleaned up some icon references.
* Updated prismatic spray (requires midi-qol).

### 0.8.81
* For movement.all operators (+-/*) will only be applied if the existing movement is non-zero.  
  So for example movement.all CUSTOM +5 will only increase existing movement, not add 5 to those that are 0.
* Fix for stealth disadvantage and heavy armor. DAE now respects the imposes stealth disadvantage field set in the item data, rather than looking at the armor type.
* Fix for generally broken DAE in 9.245
* **BREAKING** Requires DND5e v1.5.0 or later
  
### 0.8.80
* Additional parameter to doEffects removeMatchLabels: boolean, only existing effects whose label matches one of the effects being applied will be removed before reapplication.
* Automatically set stealth disadvantage for heavy armor.
* If status icon counters is active, stackable effects will display the stack count on the icon for the effect. For this to work the icon used in an effect can only appear once on the token.

### 0.8.79
* Added optional effectsToApply: string[] to doEffects and applyNonTransferEffects which specifies an array of effect ids to apply to the target, those that are not in the array will not be applied. If the list is empty or omitted all effects will be applied.
* Added optional parameter to deleteEffects: string[] to DAE.deleteEffect and _deleteEffects, which specify an array of activeEfect.ids which must match (if deleteEffects is present) for the effect to be deleted.
* Changes to support latest version (2.0.1) of Convenient Effects.
* Allow roll expressions for movement.all

### 0.8.78
* Fix for typo in ATL light.bright

### 0.8.77
* Support for new ATL light.bright/dim/etc
* Fix for effects with more than one ## field in an argument
* Updated ja.json

## 0.8.76
* Turns out there are valid use cases for changing ability.str.mod etc. So will not be removed, but the warning applies that they can only be numeric values.
* Moved initiative patching from dae -> midi-qol
* Fix for problem when applying non-transfer effects as a non-GM to unowned tokens in v9.

## 0.8.75
* support for flags.dnd5e.initiativeAdv/flags.dnd5e.initiativeDisadv moved to midi-qol.

## 0.8.74 
* Fix for dnd5e editor duplicating .custom fields on edit.
* Fix so that advantage/disadvantage on ability checks gives +5/-5 to passive skills.
* Move evaluation of attributes.movement.fly/etc to after prepareDerivedData so effects can reference derived fields, dex.mod etc.
* Modification to marco.actorUpdate:
  - fields are a space separated list of
    actorUuid: string, e.g. @actorUuid (the casters uuid) or @targetUuid (the target's uuid)
    type: number, boolean, string (it's important to match these to the type of the target field)
    expression: a roll expression, string, or boolean e.g. "@attributes.dex.mod * 2 + 10" (**must** be in "" marks), the expression can start with one of +-*/ and will treated as a (actor current value + value) etc.
    targetField: "string", e.g. data.attrbutes.hp.temp
    optional undo action values:
     missing/true/restore -> restore original value of target field on expiry
     remove -> subtract the change made to the current value of the field on expiry, i.e. undo the change allowing for changes from other sources.
     +-*/value -> add/subtract etc value to the current value of the target field
     value -> set the target field to the value on expiry. The "value" can be a roll expression, which should be enclosed in quotes. The string "undefined" will set the target field to undefined on expiry, useful for some traits etc.

* **Breaking** removed abilitysave patch/config option, which is no longer needed, and means changing abilities.str/dex/etc.save will not affect saving throw rolls - use abilities.str/dex/etc.bonuses.save instead.
* Deprecation warnings on deprecated fiels abilities.xxx.save/.mod can no longer be disabled. The error is harmless, but meant to get your attention. A subsequent version will actually throw an error and fail on these fields. 


## 0.8.73
* Fix for localisation on stackable effects in non-english games.
* Convenience active effect action added: macro.actorUpdate.
  - There are quite a lot of cases where you want to update some value on an actor's (like temphp) and maybe undo the change when the effect expires. Normally active effects can't effectively handle things like updates to hp, temphp etc since an active effect on the field "locks it", which means you'd have to write macros for those effects. This is just a shorthand way to avoid doing a macro.
  - macro.actorUpdate allows you to update a field on the actor and (optionally) have the update undone when the effect expires, however it does not lock the field value, rather it does an actor.update with the change. This let's you write a variety of effects without having to create macros for them.
  Syntax:
  macro.updateActor CUSTOM actorUuid type expression targetField undo
    actorUuid: string, e.g. @actorUuid (the casters uuid) or @targetUuid (the target's uuid)
    type: number, boolean, string
    expression: a roll expression, string, or boolean e.g. "@attributes.dex.mod * 2 + 10" (**must** to be in "" marks), the expression can start with one of +-*/ and will treated as a (oldvalue + value) etc.
    targetField: "string", e.g. data.attrbutes.hp.temp
    optional undo: boolean true/false, default true. If true the original value will be reinstated when the effect if removed.
  - If you're already writing macros to handle these sorts of changes there is no need to change, this feature is really just a canned update actor macro. 
  - If you have lot's of changes then you are **much** better doing it in a macro since macro.actorUpdate creates a database transaction for each field updated.

## 0.8.72
* Added "force token display" option for effects, which if not empty will force display of the item icon on the character token when the effect is active (can be used with passive effects).
* Updated ja.json

## 0.8.71
* Fix for DAE.deleteActiveEffect not working.
* Update ko.json
* attributes.init.bonus will now accept @abilities.abil.mod as it is documented to do.

## 0.8.70
* Included new fr.json to fix not being able to edit effects.
* cleanup for inline rolls.

## 0.8.69
Fix for editor not launching in french language environments.

## 0.8.68
* updated flags.dae.deleteUuid to allow you to pass the uuid of an active effect.

## 0.8.67
* Fix for stacking options not displaying in 0.9 dev 2.

### 0.8.66 
* Fix for a bad bug that would apply effects multiple times if there was more than one effect on an item.
* Added DAE.daeSpecialDurations() which shows all of the defined special durations.

### 0.8.65
* Support for evaluate once expressions in dae effects.
  For example:
  `data.attributes.ac.value UPGRADE [[1d20+@abilities.dex.mod+5]]`
  When the effect is applied to the actor the expression inside `[[]]` will be evaluated as a roll and the value in the applied change will be replaced with the result of the roll, all the normal substituions will be appliied (and the @ and ## fields are supported).
* new cofniguration setting, show results of inline rolls, (per client setting so GM and players can have different settings). If set the result of the inline roll will be sent to chat.
* For this implementation the `[[expr]]` must be the ONLY expression in the change value, so `[[1d6]]d6`` won't work - yet.

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
