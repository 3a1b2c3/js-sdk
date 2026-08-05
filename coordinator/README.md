# REACTOR Coordinator System

The Coordinator is a stateless event bus that maintains world state for interactive video generation. It sits between the Player (character control), AI Director (agent-driven events), and the World Model (video generator), enabling real-time state synchronization and multi-agent orchestration.

## Core Concepts

### Persistence via Repetition

Video models are **stateless**—they generate one chunk at a time with no memory of the past. The Coordinator solves this by maintaining a **History** of facts that persist only through **continuous re-projection** into each generation step.

```
┌─────────────────────────────────────────────────────────┐
│ Coordinator History                                     │
│  ├─ player:health = 100                                 │
│  ├─ scene:raining (steps: 3 remaining)                  │
│  ├─ inventory:sword (sustained)                         │
│  └─ ai:patrol_active (sustained)                        │
└─────────────────────────────────────────────────────────┘
         ↓ (re-projected every step)
┌─────────────────────────────────────────────────────────┐
│ Conditioning Signal (sent to model)                     │
│ "Player health is 100. Raining outside. Carrying sword. │
│  AI is patrolling."                                     │
└─────────────────────────────────────────────────────────┘
         ↓ (model conditions on this)
┌─────────────────────────────────────────────────────────┐
│ Generated Video Chunk                                   │
│ (3 frames, consistent with state)                       │
└─────────────────────────────────────────────────────────┘
```

### Roles

- **Player** — Character-driven actions (WASD, jump, interact)
- **Human Director** — Manual world events (rain starts, NPC appears, teleport)
- **AI Director** — Agent-driven events (spawn enemies, trigger cutscene, modify objective)

All three can assert/retract facts into the shared History. The Coordinator merges them into a single conditioning signal.

## Architecture

```
┌──────────────────┐
│  LingbotWorld    │  React UI: scene picker, HUD, controls
│  (Browser)       │
└────────┬─────────┘
         │ WebSocket
         │
┌────────▼──────────────────────────────────────────┐
│ Coordinator (TypeScript)                          │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ History (Fact Storage)                      │  │
│  │  - Assert/retract facts                     │  │
│  │  - Age facts (expire instant/steps)         │  │
│  │  - Project into conditioning string         │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ Activity Feed (Audit Trail)                 │  │
│  │  - Log every operation (who, what, when)    │  │
│  │  - Broadcast to all connected clients       │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ Scene Manager                               │  │
│  │  - Load/switch scenes                       │  │
│  │  - Manage scene-local facts                 │  │
│  │  - Clear on scene switch                    │  │
│  └─────────────────────────────────────────────┘  │
└────────┬──────────────────────────────────────────┘
         │
    ┌────┴─────────────────────────┐
    │                              │
┌───▼──────────┐          ┌───────▼───┐
│ Player       │          │ AI        │
│ (Gameplay)   │          │ Director  │
└──────────────┘          └───────────┘
    │                          │
    └──────────┬───────────────┘
               │
         ┌─────▼──────┐
         │ World Model│  (video generation)
         │ (inference)│
         └────────────┘
```

## Key Files

### Backend

- **`coordinator.ts`** (664 lines) — Main WebSocket server, message dispatch, state sync
- **`history-facts.ts`** (21 lines) — History class & Fact interface
- **`event-decide.ts`** (74 lines) — Event decision logic (when AI director can fire events)
- **`event-gate.ts`** (38 lines) — Prerequisite gating (lock/unlock scene events)

### AI Director (Python)

- **`aidirector/director_common.py`** (775 lines) — LLM-driven director, fact assertion, scene probes
- **`aidirector/sim_game.py`** (45 lines) — Game state simulator for planning
- **`aidirector/scene_probes.py`** (184 lines) — Scene-specific decision rules

### Frontend Integration

- **`../lib/DirectorPanel.tsx`** (539 lines) — Manual director UI (HUMAN DIRECTOR panel)
- **`../lib/history.ts`** (169 lines) — Client-side History replica
- **`../lib/player-controller.ts`** (236 lines) — Game state manager

## Message Types

### Player → Coordinator

```typescript
{ op: "assert", role: "player", fact: { key, clause, weight, life } }
{ op: "vital", role: "player", change: { health, addItem, removeItem } }
{ op: "count", role: "player", delta: number }  // spawn/kill counter
```

### AI/Human Director → Coordinator

```typescript
{ op: "assert", role: "human|ai", fact: {...} }
{ op: "retract", role: "human|ai", key: string }
{ op: "clear", role: "human|ai" }  // wipe all facts
{ op: "mode", mode: "human|ai|both" }  // who controls world
```

### Coordinator → All Clients

```typescript
{ type: "facts", prompt: string }  // current conditioning signal
{ type: "state", facts: [...], count: number }  // state snapshot
{ type: "activity", role, op, key, clause, ... }  // audit log entry
{ type: "scene_events", events: [...] }  // available scene events
{ type: "objective", objective: {...} }  // player goal + AI intent
{ type: "vitals", health, inventory }  // game state
```

## Lifetime Model

Facts expire automatically based on their lifetime:

```typescript
type Lifetime =
  | { kind: "instant" }           // Gone after 1 step
  | { kind: "steps"; n: number }  // Expires after n steps
  | { kind: "sustained" }         // Stays until retracted
```

Example:
```typescript
// Sustained — lasts until retracted
{ key: "scene:raining", clause: "It is raining.", weight: 2, life: { kind: "sustained" } }

// Temporary — appears for 3 steps only
{ key: "fx:explosion", clause: "Explosion nearby!", weight: 1, life: { kind: "steps", n: 3 } }

// Instant — just this step
{ key: "sfx:footstep", clause: "Footsteps.", weight: 0, life: { kind: "instant" } }
```

## Usage: Manual Control (HUMAN DIRECTOR)

### Start the Coordinator

```bash
cd coordinator
npm install
npx ts-node coordinator.ts  # runs on ws://localhost:8090
```

### Connect via Web UI

Open LingbotWorld2 and click **"state"** button to show the DirectorPanel.

### Assert a Fact

Type in the key/clause fields:
```
key:      weather:storm
clause:   A fierce thunderstorm rages overhead.
assert ↦
```

This adds the fact to History and re-projects into the next generation.

### Scene Events

Load a scene → scene-specific events appear as buttons. Click to fire (fires the event as a fact + applies any vitals).

### Monitor Activity

The activity feed shows every operation:
```
[12:34:56] human  assert weather:storm
[12:34:57] ai     assert npc:appear → Villain appears
[12:35:01] player vital health=-10
[12:35:02] ai     retract npc:appear
```

## Usage: AI Director

### Run the AI Director

```bash
cd coordinator/aidirector
pip install -r requirements.txt
python director_nim.py --scene noir-alley-patrol
```

The AI director:
1. **Observes** the current game state (history, health, inventory)
2. **Plans** what events would make sense next (using scene probes + LLM)
3. **Asserts** facts into the coordinator
4. **Monitors** the player's progress toward the objective

### Scene Probes

Each scene defines decision rules in `scene_probes.py`:

```python
probes = {
  "noir-alley-patrol": {
    "can_spawn_enemy": lambda state: state.health > 50,
    "can_trigger_ambush": lambda state: state.location == "alley",
    "end_condition": lambda state: state.player_escaped,
  }
}
```

The AI checks these before firing events.

## Development: Coordinator.ts Walkthrough

### Message Handler (simplified)

```typescript
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  
  if (msg.op === "assert") {
    // Apply fact to History (may be rejected by constraints)
    history.assert(msg.fact);
    
    // Broadcast new state to all clients
    broadcast({ type: "state", facts: history.snapshot() });
    
    // Log to activity feed
    broadcast({ type: "activity", role: msg.role, op: "assert", key: msg.fact.key });
  }
  
  if (msg.op === "retract") {
    history.retract(msg.key);
    broadcast({ type: "state", facts: history.snapshot() });
  }
};
```

### Projection (conditioning signal)

```typescript
// Every step, flatten History into a single string
const signal = history.project();
// → "Player health is 100. It is raining. Carrying sword."

// Send to model
broadcast({ type: "facts", prompt: signal });
```

## Testing

Run coordinator tests:

```bash
cd coordinator
npm test -- event-decide.test.ts
npm test -- history-facts.test.ts
```

Run AI director tests:

```bash
cd coordinator/aidirector
python -m pytest test_director.py -v
python test_scene_probes.py
```

## Common Patterns

### Gated Events

Unlock an event only when a prerequisite fact exists:

```typescript
// Director can only spawn the boss if the player has the key
const canSpawnBoss = (history) => history.has("item:keycard");
```

### Temporary Status Effects

Apply a 3-step speed buff:

```typescript
history.assert({
  key: "buff:haste",
  clause: "Player is moving fast.",
  life: { kind: "steps", n: 3 },
  weight: 1,
});
```

### Scene Cleanup

When switching scenes, the coordinator clears all facts:

```typescript
history.clear();  // wipes all facts
broadcast({ type: "facts", prompt: "" });  // empty signal for fresh world
```

## Debugging

### View Live State

Open browser DevTools → Network → WebSocket messages. Watch fact assertions in real-time.

### Enable History Debug Mode

```typescript
const history = new History({ debug: true });
// Logs every state change: [history] + scene:raining  ⟶  [scene:raining, player:health]
```

### Coordinator Logs

```bash
npx ts-node coordinator.ts 2>&1 | tee coordinator.log
```

Monitor:
- Connection/disconnection events
- Fact assertions (who, what, when)
- Scene switches
- Mode changes (human/ai/both)

## Performance Notes

- **Projection cost**: O(n facts) per step—usually <1ms with <50 facts
- **Activity feed**: Capped at 40 entries in UI (100+ entries = memory leak risk)
- **WebSocket bandwidth**: ~1KB per step (state + activity) at 10fps
- **History memory**: ~10KB per 50 facts (serialized)

## Next Steps

1. **Connect a custom scene** — Add scene JSON with events/probes
2. **Extend AI director** — Add new decision rules via scene_probes
3. **Build a dashboard** — Real-time state visualization (D3, Plotly)
4. **Integrate a game engine** — Replace video model with game physics (for testing)

## References

- [History.ts](../lib/history.ts) — Client-side fact storage
- [DirectorPanel.tsx](../lib/DirectorPanel.tsx) — UI for manual director control
- [LingbotWorldController.tsx](../examples/lingbot-world-2/components/lingbot-world-2/LingbotWorldController.tsx) — Game integration
- [aidirector/](./aidirector/) — AI director backend
