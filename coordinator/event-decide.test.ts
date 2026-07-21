// Tests the SHARED decider (../lib/event-decide) that both the client gate and the
// coordinator's rules-decide director now use — the same gate-kind coverage the old
// json-rules-engine `rules.test.ts` had, proving the de-duplicated path is equivalent.
//   npx tsx --test event-decide.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { decideEvents } from "../lib/event-decide";

// firedEvents are LOWERCASED (History keys are), matching the coordinator's gameFacts().
const base = { firedEvents: [] as string[], health: 100, chunks: 10, inventory: [] as string[], random: 0 };
const SCENE = [
  { name: "Gunman on the Fire Escape" },
  { name: "Police Car Turns Up", requires: { fired: ["Gunman on the Fire Escape"] } },
  { name: "Player Falls and Dies", requires: { maxHealth: 0 } },
];

test("ungated event waits for warmup, then fires", () => {
  assert.ok(!decideEvents(SCENE, { ...base, chunks: 2 }, 4).includes("Gunman on the Fire Escape"), "silent before warmup");
  assert.ok(decideEvents(SCENE, { ...base, chunks: 10 }, 4).includes("Gunman on the Fire Escape"));
});

test("gated event stays locked until its predecessor has fired", () => {
  assert.ok(!decideEvents(SCENE, base, 4).includes("Police Car Turns Up"), "locked before Gunman");
  assert.ok(
    decideEvents(SCENE, { ...base, firedEvents: ["gunman on the fire escape"] }, 4).includes("Police Car Turns Up"),
    "unlocks after Gunman fires (case-insensitive)",
  );
});

test("an already-fired event does not re-fire", () => {
  assert.ok(!decideEvents(SCENE, { ...base, firedEvents: ["gunman on the fire escape"] }, 4).includes("Gunman on the Fire Escape"));
});

test("health gate: death fires only at health <= 0", () => {
  assert.ok(!decideEvents(SCENE, { ...base, health: 50 }, 4).includes("Player Falls and Dies"));
  assert.ok(decideEvents(SCENE, { ...base, health: 0 }, 4).includes("Player Falls and Dies"));
});

test("notFired mutex: an opener locks out once a sibling has fired", () => {
  const s = [
    { name: "Calm", requires: { notFired: ["Shark"] } },
    { name: "Shark", requires: { notFired: ["Calm"] } },
  ];
  const open = decideEvents(s, base, 0);
  assert.ok(open.includes("Calm") && open.includes("Shark"), "both eligible before either fires");
  const after = decideEvents(s, { ...base, firedEvents: ["shark"] }, 0);
  assert.ok(!after.includes("Calm"), "Calm locked out once Shark fired");
  assert.ok(!after.includes("Shark"), "Shark does not re-fire");
});

test("firedAny gate: unlocks when ANY predecessor has fired (OR)", () => {
  const s = [{ name: "Thrown", requires: { firedAny: ["Shark Lunges", "Rogue Wave"] } }];
  assert.ok(!decideEvents(s, base, 0).includes("Thrown"), "locked with neither fired");
  assert.ok(decideEvents(s, { ...base, firedEvents: ["rogue wave"] }, 0).includes("Thrown"));
});

test("minChunks gate: holds until the chunk floor", () => {
  const s = [{ name: "Fuel Runs Low", requires: { minChunks: 40 } }];
  assert.ok(!decideEvents(s, { ...base, chunks: 39 }, 0).includes("Fuel Runs Low"));
  assert.ok(decideEvents(s, { ...base, chunks: 40 }, 0).includes("Fuel Runs Low"));
});

test("chance gate: fires only when random <= probability", () => {
  const s = [{ name: "Turtle", chance: 0.1 }]; // ungated + 10%/tick
  assert.ok(decideEvents(s, { ...base, chunks: 0, random: 0.05 }, 0).includes("Turtle"), "fires when random < chance");
  assert.ok(!decideEvents(s, { ...base, chunks: 0, random: 0.5 }, 0).includes("Turtle"), "silent when random > chance");
});
