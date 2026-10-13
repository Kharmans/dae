import { warn } from "../../dae.js";
import { getEffectItem, getEffectSource } from "./effectSource.js";

/** Resolve macro command text from an item or raw item data, checking dae and legacy itemacro flag paths. */
export function getItemMacroCommand(source: unknown): string | undefined {
  const s = source as Record<string, any> | null | undefined;
  return s?.flags?.dae?.macro?.command
    ?? s?.flags?.itemacro?.macro?.command
    ?? s?.flags?.itemacro?.macro?.data?.command;
}

/**
 * Walk an effect's origin chain to find the originating Item.
 * Falls back to the effect's recorded source (lib/effectSource.ts): the live item, else one built from its card's
 * snapshot or the item copy older effects carry.
 */
export async function resolveItemFromEffect(
  effectData: ActiveEffect.Source,
  actor?: Actor.Implementation
): Promise<Item.Implementation | null> {
  // Follow the origin trail backwards through nested ActiveEffects
  let source: any | undefined = effectData.origin ? await fromUuid(effectData.origin) : undefined;
  let count: number;
  for (count = 0; count < 10 && source instanceof ActiveEffect && !(source.parent instanceof Item); count++) {
    const newSource: any = await fromUuid(source.origin);
    if (!newSource) source = source.parent;
    else source = newSource;
  }
  if (count === 10) {
    console.warn("dae | resolveItemFromEffect | too many levels of origin", effectData);
  } else if (source instanceof Item) return source as Item.Implementation;
  else if (source?.parent instanceof Item) return source.parent as Item.Implementation;
  else if (source?.item instanceof Item) return source.item as Item.Implementation;

  const item = getEffectItem(effectData);
  if (item) return item;
  // An old effect's item copy, when its source names no actor.
  const itemData = effectData.flags?.dae?.itemData as Item.CreateData | undefined;
  if (itemData && actor) {
    return new CONFIG.Item.documentClass(itemData, { parent: actor }) as Item.Implementation;
  }

  return null;
}

/** Create a synthetic script Macro from command text. */
export function createSyntheticMacro(command: string, name = "DAE-Item-Macro"): Macro.Implementation {
  return new CONFIG.Macro.documentClass({
    name,
    type: "script",
    img: null,
    command,
    author: game.user?.id,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
    flags: { dnd5e: { itemMacro: true } }
  }) as Macro.Implementation;
}

/**
 * Create a synthetic script Macro that calls a global function.
 * Supports paths like "myModule.myFunction" or "myModule.myFunction("arg1", "arg2")".
 */
export function createFunctionMacro(functionPath: string): Macro.Implementation {
  return createSyntheticMacro(
    `return await ${functionPath}.bind(this)({ speaker, actor, token, character, item, args, scope })`,
    "DAE-Function-Macro"
  );
}

/**
 * Resolve a world or compendium Macro by name or UUID.
 * If the UUID points to an Item, extracts the macro command from its flags.
 */
export async function resolveWorldMacro(nameOrUuid: string): Promise<Macro.Implementation | undefined> {
  const macro = game.macros?.getName(nameOrUuid);
  if (macro) return macro;
  const doc = await fromUuid(nameOrUuid);
  if (doc instanceof Macro) return doc as Macro.Implementation;
  if (doc instanceof Item) {
    const macroData = (doc as any).flags?.dae?.macro ?? (doc as any).flags?.itemacro?.macro as Macro.CreateData;
    if (macroData) {
      macroData.flags = foundry.utils.mergeObject(macroData.flags ?? {}, { dnd5e: { itemMacro: true } });
      return new CONFIG.Macro.documentClass(macroData) as Macro.Implementation;
    }
  }
  return undefined;
}

/**
 * Resolve an ItemMacro's command text from multiple sources:
 * effect flags → item flags → DAE itemData fallback → origin chain → activity parent.
 */
export async function resolveItemMacroCommand(
  item: Item.Implementation | null | undefined,
  effectData?: ActiveEffect.Source,
  effectUuid?: string
): Promise<string | undefined> {
  // Try effect-level itemMacro flag
  let command = effectData?.flags?.dae?.itemMacro as string | undefined;
  if (command) return command;

  // Try resolving item from effectUuid if not provided
  if (!item && effectUuid) {
    const effect = fromUuidSync(effectUuid);
    if (effect instanceof ActiveEffect && effect.parent instanceof Item) {
      item = effect.parent as Item.Implementation;
    }
  }

  // Try item flags
  command = getItemMacroCommand(item);
  if (command) return command;

  // Try DAE itemData stored in effect flags
  const itemData = effectData?.flags?.dae?.itemData;
  if (itemData) {
    command = getItemMacroCommand(itemData);
    if (command) return command;
  }

  // Last ditch: resolve from origin chain
  if (!item && effectData?.origin) {
    warn("resolveItemMacroCommand: fetching item from effectData/origin", effectData.origin);
    const itemOrEffect = fromUuidSync(effectData.origin);
    if (itemOrEffect instanceof CONFIG.Item.documentClass) {
      item = itemOrEffect as Item.Implementation;
    }
    if (!item) {
      const activityUuid = getEffectSource(effectData).activityUuid;
      if (activityUuid) {
        const activity = fromUuidSync(activityUuid);
        // @ts-expect-error no dnd5e-types for activity.item
        if (activity) item = activity.item as Item.Implementation;
      }
    }
    command = getItemMacroCommand(item);
    if (command) return command;
  }

  // Check effect-level flag one more time (may have been set elsewhere)
  return effectData?.flags?.dae?.itemMacro as string | undefined;
}

/**
 * Resolve an ActivityMacro's command text from the activity UUID stored in effect flags.
 */
export async function resolveActivityMacroCommand(effectData?: ActiveEffect.Source): Promise<string | undefined> {
  const activityUuid = getEffectSource(effectData).activityUuid;
  if (!activityUuid) return undefined;
  const activity: any = await fromUuid(activityUuid);
  return activity?.macro?.command as string | undefined;
}

/**
 * High-level macro resolver. Given a change key and name, resolves the appropriate Macro instance.
 * Handles macro.execute (world/compendium), macro.itemMacro (item flags), and macro.activityMacro (activity).
 */
export async function resolveMacro(
  changeKey: string,
  name: string,
  item: Item.Implementation | null | undefined,
  effectData?: ActiveEffect.Source,
  effectUuid?: string
): Promise<Macro.Implementation | undefined> {
  if (changeKey.includes("macro.execute")) {
    return resolveWorldMacro(name);
  }

  let macroCommand: string | undefined;
  if (changeKey.startsWith("macro.activityMacro")) {
    macroCommand = await resolveActivityMacroCommand(effectData);
  } else if (changeKey.startsWith("macro.itemMacro")) {
    macroCommand = await resolveItemMacroCommand(item, effectData, effectUuid);
  }

  // Fallback: try resolving name as UUID to a Macro or Item
  if (!macroCommand) {
    const doc = await fromUuid(name);
    if (doc instanceof Macro) macroCommand = (doc as Macro.Implementation).command;
    if (doc instanceof Item) macroCommand = getItemMacroCommand(doc);
  }

  if (!macroCommand) {
    warn(`resolveMacro: No macro found for ${changeKey}, item ${item?.name}`);
    macroCommand = `if (!args || args[0] === "on") {ui.notifications.warn("${changeKey} | No macro found for item ${item?.name ?? "unknown"}");}`;
  }

  return createSyntheticMacro(macroCommand);
}
