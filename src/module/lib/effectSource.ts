/**
 * Where an effect came from, as dnd5e 6 records it in `system.origin`, with fallbacks for effects that predate it
 * (DAE flags, the stored origin). Item data is returned as data, never as a new Item, except by getEffectItem.
 */

/** dnd5e 6's `ActiveEffect5e#system.origin`. */
export interface SystemOrigin {
  effect?: string | null;
  behavior?: string | null;
  activity?: string | null;
  item?: string | null;
  actor?: string | null;
  message?: string | null;
  profile?: string | null;
}

export interface EffectSource {
  actorUuid?: string;
  itemUuid?: string;
  activityUuid?: string;
  /** The caster's effect that controls this one (concentration). */
  controllingEffectUuid?: string;
  /** The item effect this one was copied from. */
  sourceEffectUuid?: string;
  messageUuid?: string;
}

/** An effect, or its data (toObject, duplicate) */
interface EffectData {
  origin?: string | null;
  flags?: { dae?: { activity?: string; itemUuid?: string; itemData?: unknown; applicationData?: { itemCardUuid?: string | null; actorUuid?: string | null } } };
  _stats?: { duplicateSource?: string | null; compendiumSource?: string | null };
  system?: unknown;
}
type EffectInput = ActiveEffect.Implementation | EffectData;
type ItemData = Item.Source;

const ITEM_PART = /^(.*?(?:^|\.)Item\.[^.]+)(?:\.|$)/;
const ACTOR_PART = /^(.*?(?:^|\.)Actor\.[^.]+)(?:\.|$)/;

export function itemUuidOf(uuid: string | null | undefined): string | undefined {
  return uuid?.match(ITEM_PART)?.[1];
}

export function actorUuidOf(uuid: string | null | undefined): string | undefined {
  return uuid?.match(ACTOR_PART)?.[1];
}

function uuidType(uuid: string | null | undefined): string | undefined {
  if (!uuid) return undefined;
  try {
    return foundry.utils.parseUuid(uuid)?.type;
  } catch {
    return undefined;
  }
}

/** An effect on an actor (concentration), as opposed to one on an item. */
export function isActorEffectUuid(uuid: string | null | undefined): boolean {
  return uuidType(uuid) === "ActiveEffect" && !itemUuidOf(uuid);
}

export function systemOriginOf(effect: EffectInput | undefined): SystemOrigin {
  // @ts-expect-error no dnd5e-types
  return effect?.system?.origin ?? {};
}

/** The stored (not prepared) flat origin. */
function storedOriginOf(effect: EffectInput): string | null | undefined {
  return effect instanceof ActiveEffect ? effect._source.origin : effect.origin;
}

/** The `system.origin` slot a uuid belongs in. */
export function originSlotFor(uuid: string): keyof SystemOrigin | undefined {
  switch (uuidType(uuid)) {
    case "Activity": return "activity";
    case "ActiveEffect": return "effect";
    case "Item": return "item";
    case "Actor": return "actor";
    case "RegionBehavior": return "behavior";
  }
  return undefined;
}

export function getEffectSource(effect: EffectInput | null | undefined): EffectSource {
  if (!effect) return {};
  const origin = systemOriginOf(effect);
  const dae = effect.flags?.dae;
  const stored = storedOriginOf(effect) ?? undefined;
  const storedType = uuidType(stored);
  const parentItem = effect instanceof ActiveEffect && effect.parent instanceof Item ? effect.parent : undefined;

  const activityUuid = origin.activity ?? dae?.activity ?? (storedType === "Activity" ? stored : undefined);
  const controllingEffectUuid = [origin.effect, stored].find(uuid => isActorEffectUuid(uuid)) ?? undefined;
  const itemEffect = [origin.effect, stored].find(uuid => uuidType(uuid) === "ActiveEffect" && itemUuidOf(uuid));
  const sourceEffectUuid = effect._stats?.duplicateSource ?? effect._stats?.compendiumSource ?? itemEffect ?? undefined;
  const itemUuid = dae?.itemUuid ?? origin.item ?? itemUuidOf(activityUuid) ?? parentItem?.uuid
    ?? (["Item", "Activity", "ActiveEffect"].includes(storedType ?? "") ? itemUuidOf(stored) : undefined);
  const messageUuid = origin.message ?? dae?.applicationData?.itemCardUuid ?? undefined;
  const actorUuid = origin.actor ?? actorUuidOf(itemUuid) ?? actorUuidOf(activityUuid) ?? actorUuidOf(controllingEffectUuid)
    ?? dae?.applicationData?.actorUuid ?? (storedType === "Actor" ? stored : undefined);
  return { actorUuid, itemUuid, activityUuid, controllingEffectUuid, sourceEffectUuid, messageUuid };
}

/**
 * The origin DAE gave an applied effect before it recorded its source as dnd5e does: the caster's concentration
 * effect, else the item effect it was copied from. Other effects keep their origin.
 */
export function getLegacyOrigin(effect: EffectInput): string | undefined {
  const source = getEffectSource(effect);
  if (source.controllingEffectUuid) return source.controllingEffectUuid;
  if (systemOriginOf(effect).activity && source.sourceEffectUuid) return source.sourceEffectUuid;
  return effect.origin ?? undefined;
}

/**
 * Whether an effect came from `uuid`: its item (or an activity or effect of it), activity, source effect or
 * controlling effect, or its origin. An actor's uuid matches only effects whose origin is that actor.
 */
export function effectMatchesSource(effect: ActiveEffect.Implementation, uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  // @ts-expect-error no dnd5e-types
  if (effect.matchesOrigin?.(uuid) || effect.origin === uuid) return true;
  const source = getEffectSource(effect);
  if ([source.itemUuid, source.activityUuid, source.sourceEffectUuid, source.controllingEffectUuid].includes(uuid)) return true;
  return uuidType(uuid) === "Item" && !!effect.origin?.startsWith(`${uuid}.`);
}

function resolve(uuid: string | null | undefined) {
  if (!uuid) return undefined;
  try {
    return fromUuidSync(uuid, { strict: false }) ?? undefined;
  } catch {
    return undefined;
  }
}

function storedItemData(message: ChatMessage.Implementation): ItemData | undefined {
  // @ts-expect-error no dnd5e-types
  const id: string | undefined = message.system?.item?.id ?? message.flags?.dnd5e?.item?.id;
  // @ts-expect-error no dnd5e-types
  const deleted: ItemData[] | undefined = message.system?.deltas?.deleted;
  // @ts-expect-error no dnd5e-types
  const snapshot: ItemData | undefined = message.flags?.dnd5e?.item?.data;
  return deleted?.find(data => data._id === id) ?? snapshot ?? message.flags?.dae?.itemSnapshot;
}

/** A card's item as data: the live item's source, else dnd5e's snapshot, the originating card's, or DAE's. */
export function getMessageItemData(messageOrUuid: ChatMessage.Implementation | string | null | undefined): ItemData | undefined {
  const message = typeof messageOrUuid === "string" ? resolve(messageOrUuid) : messageOrUuid;
  if (!(message instanceof ChatMessage)) return undefined;
  // @ts-expect-error no dnd5e-types
  const uuid: string | undefined = message.system?.item?.uuid ?? message.flags?.dnd5e?.item?.uuid;
  const live = resolve(uuid);
  if (live instanceof Item) return live.toObject();
  // @ts-expect-error no dnd5e-types
  const originating = message.getOriginatingMessage?.();
  return storedItemData(message) ?? (originating && originating !== message ? storedItemData(originating) : undefined);
}

/**
 * An effect's item as data: the live item's source, else its card's snapshot, else the copy DAE stored on effects
 * before 14.6.3. Source data, unscaled (the spell level and scaling are in flags.dnd5e).
 */
export function getEffectItemData(effect: EffectInput | null | undefined): ItemData | undefined {
  if (!effect) return undefined;
  const source = getEffectSource(effect);
  const live = resolve(source.itemUuid);
  if (live instanceof Item) return live.toObject();
  return getMessageItemData(source.messageUuid) ?? effect.flags?.dae?.itemData as ItemData | undefined;
}

/**
 * An item's data from the effects it applied to an actor, given the uuid of the item or of one of its activities or
 * effects (an `ItemMacro.<uuid>` whose item is gone).
 */
export function getActorItemData(actor: Actor.Implementation, uuid: string | null | undefined): ItemData | undefined {
  const itemId = itemUuidOf(uuid)?.split(".").pop();
  if (!itemId) return undefined;
  const effect = actor.effects.find(e => getEffectSource(e).itemUuid?.split(".").pop() === itemId
    || (e.flags?.dae?.itemData as ItemData | undefined)?._id === itemId);
  return getEffectItemData(effect);
}

const builtItems = new Map<string, Item.Implementation>();

let preparationDepth = 0;
let warnedDuringPreparation = false;

/** Run an actor's data preparation, so getEffectItem knows not to build an item during it (synchronous, so a counter suffices) */
export function duringPreparation<T>(prepare: () => T): T {
  preparationDepth++;
  try {
    return prepare();
  } finally {
    preparationDepth--;
  }
}

/**
 * An effect's item: the live item, else one built once from getEffectItemData (by card, else by effect). Not during
 * data preparation, where building an item re-enters it: there a deleted item that has not been built yet gives
 * undefined (use getEffectItemData).
 */
export function getEffectItem(effect: EffectInput | null | undefined): Item.Implementation | undefined {
  if (!effect) return undefined;
  if (effect instanceof ActiveEffect && effect.parent instanceof Item) return effect.parent;
  const source = getEffectSource(effect);
  const live = resolve(source.itemUuid);
  if (live instanceof Item) return live;
  const key = source.messageUuid ?? (effect instanceof ActiveEffect ? effect.uuid : undefined) ?? source.itemUuid;
  const cached = key ? builtItems.get(key) : undefined;
  if (cached) return cached;
  if (preparationDepth > 0) {
    if (!warnedDuringPreparation) {
      warnedDuringPreparation = true;
      console.warn("dae | getEffectItem cannot build a deleted item during data preparation; use DAE.getEffectItemData there.");
    }
    return undefined;
  }
  const data = getEffectItemData(effect);
  if (!data) return undefined;
  const actor = resolve(source.actorUuid);
  const item = new CONFIG.Item.documentClass(data, { parent: actor instanceof Actor ? actor : undefined }) as Item.Implementation;
  if (key) builtItems.set(key, item);
  return item;
}

/**
 * For items being deleted, the cards of effects they applied (on actors and unlinked tokens) that hold no snapshot
 * of the item, so its data can still be found once it is gone. By item uuid.
 */
export function cardsNeedingSnapshot(items: Iterable<Item.Implementation>): Map<string, string[]> {
  const itemUuids = new Set([...items].map(item => item.uuid));
  const cards = new Map<string, Set<string>>();
  const check = (effect: ActiveEffect.Implementation) => {
    const source = getEffectSource(effect);
    if (!source.itemUuid || !source.messageUuid || !itemUuids.has(source.itemUuid)) return;
    if (!cards.has(source.itemUuid)) cards.set(source.itemUuid, new Set());
    cards.get(source.itemUuid)!.add(source.messageUuid);
  };
  for (const actor of game.actors ?? []) for (const effect of actor.effects) check(effect);
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens) {
      if (!token.actorLink) for (const effect of token.delta?.effects ?? []) check(effect);
    }
  }
  const result = new Map<string, string[]>();
  for (const [itemUuid, messages] of cards) {
    const needed = [...messages].filter(uuid => {
      const message = resolve(uuid);
      return message instanceof ChatMessage && !storedItemData(message);
    });
    if (needed.length) result.set(itemUuid, needed);
  }
  return result;
}
