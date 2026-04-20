/**
 * Registry-based change handler dispatch for DAE effect changes.
 * Each handler declares what to do on add/remove and where it runs (local/GM/mixed).
 * Replaces the switch statement in processEffectChanges and the parallel classification arrays.
 */

export type ChangeHandlerAction = "on" | "off";
export type ChangeDestination = "local" | "GM" | "mixed";

export interface ChangeHandlerContext {
  actor: Actor.Implementation;
  change: ActiveEffect.ChangeData;
  effect: ActiveEffect.Implementation;
  token?: foundry.canvas.placeables.Token;
  tokens: (foundry.canvas.placeables.Token | null | undefined)[];
  context: any;
}

export interface ChangeHandler {
  on(ctx: ChangeHandlerContext): Promise<void>;
  off(ctx: ChangeHandlerContext): Promise<void>;
  destination: ChangeDestination;
  /** If true, changes with this key are batched through daeMacro rather than dispatched individually. */
  isMacroKey?: boolean;
}

const registry = new Map<string, ChangeHandler>();

export function registerChangeHandler(key: string, handler: ChangeHandler): void {
  registry.set(key, handler);
}

export function getChangeHandler(key: string): ChangeHandler | undefined {
  // Exact match first
  if (registry.has(key)) return registry.get(key);
  // Prefix match for keys like "macro.execute.local" → "macro.execute"
  for (const [registeredKey, handler] of registry) {
    if (key.startsWith(registeredKey) && handler.isMacroKey) return handler;
  }
  return undefined;
}

export function isRegisteredMacroKey(key: string): boolean {
  const handler = getChangeHandler(key);
  return handler?.isMacroKey === true;
}

export function getChangeDestination(key: string): ChangeDestination {
  // Check for exact match with suffix override (e.g. "macro.execute.local")
  if (key.endsWith(".local")) return "local";
  if (key.endsWith(".GM")) return "GM";
  return getChangeHandler(key)?.destination ?? "mixed";
}

/** Get all registered keys that are macro keys (for backward compat with allMacroEffects). */
export function getAllMacroEffectKeys(): string[] {
  const keys: string[] = [];
  for (const [key, handler] of registry) {
    if (handler.isMacroKey) {
      keys.push(key);
      // Also include the .local and .GM variants if destination is mixed
      if (handler.destination === "mixed") {
        keys.push(`${key}.local`, `${key}.GM`);
      }
    }
  }
  return keys;
}

export { registry as changeHandlerRegistry };
