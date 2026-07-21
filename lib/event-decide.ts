// Shared deterministic director decide — ONE gating semantics for both the client
// (chip availability) and the coordinator's rules-decide director. The requires-gate
// itself is `isEventAvailable` (a single implementation, reused here); this only adds
// the coordinator-only layers on top:
//   • don't-re-fire — an event already in History is not offered again,
//   • warmup       — ungated events wait N chunks so the scene settles first,
//   • chance        — a per-tick probability roll once the gate holds.
// Names are matched case-insensitively because the coordinator's `firedEvents` come
// from lowercased History keys (`scene:foo` -> "foo").
import { isEventAvailable, type EventGate, type GateState } from "./event-gate";

// The minimal event shape the decider needs (SceneEvent / NamedEvent both satisfy it).
export interface DecideEvent {
  name: string;
  requires?: EventGate | unknown;
  chance?: number;
}

// The live-state snapshot (the coordinator's gameFacts() satisfies it; extra fields
// are ignored).
export interface DecideFacts {
  firedEvents: string[];
  health: number;
  chunks: number;
  inventory: readonly string[];
  random?: number; // 0..1 for `chance`; a chance-gated event can't fire without it
}

const lower = (a?: string[]): string[] | undefined => a?.map((s) => s.toLowerCase());

/** Names of the events that should fire NOW, given the live facts. Pure + deterministic
 *  (the only nondeterminism is the caller-supplied `facts.random`). */
export function decideEvents(
  events: DecideEvent[],
  facts: DecideFacts,
  warmup = 4,
): string[] {
  const fired = new Set(facts.firedEvents.map((s) => s.toLowerCase()));
  const gate: GateState = {
    fired,
    chunks: facts.chunks,
    health: facts.health,
    inventory: facts.inventory,
  };
  const out: string[] = [];
  for (const e of events) {
    if (fired.has(e.name.toLowerCase())) continue; // don't re-fire
    const g = e.requires as EventGate | undefined;
    if (!g && facts.chunks < warmup) continue; // ungated events wait out the warmup
    // Reuse the shared gate predicate. Lowercase the fired-name fields so they match
    // the lowercased `fired` set; health/chunk/item facts are compared as-is.
    const normalized = {
      requires: g
        ? { ...g, fired: lower(g.fired), firedAny: lower(g.firedAny), notFired: lower(g.notFired) }
        : undefined,
    };
    if (!isEventAvailable(normalized, gate)) continue;
    // Per-tick probability once the gate holds — the event lands at a varied time.
    if (e.chance != null && !(facts.random != null && facts.random <= e.chance)) continue;
    out.push(e.name);
  }
  return out;
}
