// Tests the History -> rules-engine wiring: `firedEvents` is derived LIVE from the
// shared History (no cached copy), so asserting a `scene:*` fact must immediately
// unlock a gated rule, and clearing History must lock it back. Pure: no coordinator
// / WebSocket / VLM. Run: npx tsx --test history-facts.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { History } from "../lib/history";
import { firedNameFromKey, firedEventNames } from "./history-facts";
import { buildEngine, decide } from "./rules";

const sustained = (key: string) =>
  ({ key, clause: key, weight: 2, life: { kind: "sustained" } as const });

test("firedNameFromKey maps scene keys to display names and ignores the rest", () => {
  assert.equal(firedNameFromKey("scene:gunman_falls"), "gunman falls");
  assert.equal(firedNameFromKey("scene:door_opens"), "door opens");
  assert.equal(firedNameFromKey("env:weather"), null);
  assert.equal(firedNameFromKey("fx:fire"), null);
});

test("firedEventNames derives live from History — assert and clear reflect immediately", () => {
  const h = new History();
  assert.deepEqual(firedEventNames(h), []);
  h.assert(sustained("scene:door_opens"));
  assert.deepEqual(firedEventNames(h), ["door opens"]);
  h.assert(sustained("env:weather")); // non-scene facts never appear as fired events
  assert.deepEqual(firedEventNames(h), ["door opens"]);
  h.clear();
  assert.deepEqual(firedEventNames(h), []);
});

test("asserting into History unlocks a gated rule through the engine", async () => {
  const events = [
    { name: "Door Opens" },
    { name: "Enter Room", requires: { fired: ["Door Opens"] } },
  ];
  const engine = buildEngine(events, 0); // warmup 0 → ungated events are eligible at once
  const h = new History();
  const facts = () => ({ firedEvents: firedEventNames(h), health: 100, chunks: 10, inventory: [] });

  // Predecessor not in History → the gated event stays locked.
  const before = await decide(engine, facts());
  assert.ok(!before.includes("Enter Room"), "gated event must be locked before its predecessor fires");

  // Assert the predecessor as a scene fact → firedEvents now derives it → gate opens.
  h.assert(sustained("scene:door_opens"));
  const after = await decide(engine, facts());
  assert.ok(after.includes("Enter Room"), "gated event must unlock once History holds its predecessor");

  // Clearing History locks it back — proves there is no cached firedEvents copy.
  h.clear();
  const cleared = await decide(engine, facts());
  assert.ok(!cleared.includes("Enter Room"), "gated event must re-lock after History is cleared");
});
