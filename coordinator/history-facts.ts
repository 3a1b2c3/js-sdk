// Pure derivation of the `firedEvents` fact from the shared
// History. Extracted from coordinator.ts so it can be unit-tested WITHOUT importing
// the coordinator module (which starts a WebSocket server on import).
//
// The invariant under test: `firedEvents` is DERIVED live from History (no cached
// copy), so asserting a `scene:*` fact is immediately visible to the rules engine,
// and clearing History clears it too.
import type { History } from "../lib/history";

/** Fired display name for a History key (`scene:gunman_falls` -> "gunman falls"), or null. */
export function firedNameFromKey(key: string): string | null {
  return key.startsWith("scene:") ? key.slice("scene:".length).replace(/_/g, " ") : null;
}

/** Fired scene-event display names, DERIVED from a History snapshot (no cached copy). */
export function firedEventNames(history: History): string[] {
  return history
    .snapshot()
    .map((f) => firedNameFromKey(f.key))
    .filter((n): n is string => n !== null);
}
