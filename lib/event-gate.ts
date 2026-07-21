// Declarative event-availability gate — the SINGLE gating predicate shared by the
// client (chip / director-button availability) and the coordinator's rules-decide
// director. Kept in its OWN dependency-free file: no Next.js `@/` aliases and no
// scene data, so the coordinator's plain `tsx` can import the exact same gating logic
// without pulling in browser/Next-only modules.

// A declarative gate. All present fields must hold for the event to be available.
export interface EventGate {
  fired?: string[]; //     ALL of these must have fired already (AND)
  firedAny?: string[]; //  ANY one of these must have fired (OR)
  notFired?: string[]; //  names of events that must NOT have fired yet
  minChunks?: number; //   only after N generation chunks elapsed
  maxHealth?: number; //   only when health <= this (e.g. 0 for a death trigger)
  minHealth?: number; //   only when health >= this
  hasItem?: string; //     only when this item is in the inventory
}

// Shared-state snapshot the gate is evaluated against.
export interface GateState {
  fired: ReadonlySet<string>;
  chunks: number;
  health: number;
  inventory: readonly string[];
}

// Is an event with this `requires` gate currently available? No gate → always available.
export function isEventAvailable(event: { requires?: EventGate }, s: GateState): boolean {
  const g = event.requires;
  if (!g) return true;
  if (g.fired && !g.fired.every((n) => s.fired.has(n))) return false;
  if (g.firedAny && !g.firedAny.some((n) => s.fired.has(n))) return false;
  if (g.notFired && g.notFired.some((n) => s.fired.has(n))) return false;
  if (g.minChunks !== undefined && s.chunks < g.minChunks) return false;
  if (g.maxHealth !== undefined && s.health > g.maxHealth) return false;
  if (g.minHealth !== undefined && s.health < g.minHealth) return false;
  if (g.hasItem !== undefined && !s.inventory.includes(g.hasItem)) return false;
  return true;
}
