# LingBot Integration API

Headless scenario execution framework for LingBot World 2. Runs deterministic scenarios without a UI, emitting metrics and artifacts for benchmarking and testing.

## Architecture

```
┌─────────────────────────────────────────────┐
│    Integration API                          │
├─────────────────────────────────────────────┤
│ IntegrationScenario (from lib/lingbot-cases)│
│           ↓                                  │
│ run_integration_scenario()                  │
│ (canonical execution loop)                  │
│           ↓                                  │
│ LingbotIntegrationRuntime                   │
│ + LingbotIntegrationSession                 │
│           ↓                                  │
│ metrics.ndjson + manifest.json              │
│ + video.mp4 + logs                          │
└─────────────────────────────────────────────┘
```

## Core Types

### IntegrationScenario
Deterministic workload: scenario ID, first frame, prompt, and control inputs.

Converted from `lib/lingbot-cases/*.json` (StructuredExample format) into canonical form.

```python
from lingbot_integration.scenario import IntegrationScenario

scenario = IntegrationScenario(
    scenario_id="farmer-01",
    name="Farmer tool-swap",
    spec_id="lingbot-world-camera-control",
    first_frame_image=np.array(...),  # or Path
    first_frame_prompt="A farmer in a wheat field.",
    inputs=[...],  # Control events
    duration_s=10.0,
)
```

### IntegrationSpec
Input/output schema and metadata. Cheap to import, doesn't load model.

```python
from lingbot_integration.scenario import IntegrationSpec

spec = IntegrationSpec(
    spec_id="lingbot-world-camera-control",
    display_name="LingBot World 2",
    description="...",
    input_schema={...},
    output_schema={...},
)

# Validate scenarios against spec
errors = spec.validate_scenario(scenario)
```

### ExecutionMetrics
Per-step metrics: chunk index, latency, memory, timings.

Written to `metrics.ndjson` (one JSON object per line).

```json
{"chunk_index": 0, "num_frames": 12, "latency_s": 0.52, "memory_bytes": 2147483648}
{"chunk_index": 1, "num_frames": 12, "latency_s": 0.53, "memory_bytes": 2147483648}
```

## Usage

### Python API: Run a Scenario

```python
from lingbot_integration.loader import load_all_scenarios_from_dir
from lingbot_integration.runner import run_integration_scenario
from lingbot_integration.scenario import IntegrationSpec

# Load scenarios from lib/lingbot-cases/
scenarios = load_all_scenarios_from_dir(
    Path("lib/lingbot-cases"),
    Path("examples/lingbot-world-2/public/lingbot-cases"),
)

scenario = scenarios["farmer-01"]

# Define spec
spec = IntegrationSpec(
    spec_id="lingbot-world-camera-control",
    display_name="LingBot World 2",
    description="Interactive scenario execution",
    input_schema={},
    output_schema={},
)

# Run scenario (headless)
result = run_integration_scenario(
    scenario,
    spec,
    output_dir=Path("outputs"),
)

print(f"Success: {result.success}")
print(f"Chunks: {result.num_chunks}")
print(f"FPS: {result.metrics_summary['fps']:.2f}")
print(f"Manifest: {result.artifacts['manifest']}")
```

### CLI: Run from Terminal

```bash
# Basic run
python -m lingbot_integration.cli --scenario farmer-01

# With options
python -m lingbot_integration.cli \
  --scenario farmer-01 \
  --output-dir /tmp/scenarios \
  --seed 42 \
  --verbose
```

### Scenario Editor: Test Scenarios

The Scenario Editor uses `run_integration_scenario()` to validate and preview scenarios:

```typescript
// React/TypeScript (frontend)
const result = await fetch("/api/scenario/test", {
  method: "POST",
  body: JSON.stringify({ scenario, spec_id }),
});
const status = await result.json();
// Backend runs run_integration_scenario(), emits metrics
```

## Artifacts

Each scenario run produces:

```
outputs/{scenario_id}/
  manifest.json       # Metadata + success status + metrics summary
  metrics.ndjson      # Per-chunk metrics (one JSON object per line)
  logs.txt            # Execution logs (if any)
  outputs/
    video.mp4         # Generated video (if applicable)
```

### manifest.json

```json
{
  "scenario_id": "farmer-01",
  "spec_id": "lingbot-world-camera-control",
  "success": true,
  "duration_s": 10.5,
  "num_chunks": 14,
  "num_frames": 168,
  "artifacts": {
    "metrics": "outputs/farmer-01/metrics.ndjson",
    "video": "outputs/farmer-01/outputs/video.mp4"
  },
  "metrics_summary": {
    "avg_latency_s": 0.75,
    "peak_memory_bytes": 2147483648,
    "fps": 15.95
  },
  "created_at": "2026-07-27T15:32:00.123456"
}
```

## Testing

```bash
# Unit tests for scenario types
pytest coworker/tests/test_scenario_types.py -v

# E2E tests (loader → runtime → runner)
pytest coworker/tests/test_lingbot_integration_e2e.py -v

# All tests
pytest coworker/tests/ -v
```

## Integration with Scenario Editor

The Scenario Editor (Phase 2) uses this API to:

1. **Load scenarios**: `load_all_scenarios_from_dir()` → list in sidebar
2. **Validate scenarios**: `spec.validate_scenario()` → show errors in form
3. **Test scenarios**: `run_integration_scenario()` → emit metrics in real-time
4. **Export scenarios**: Save edited scenarios back to `lib/lingbot-cases/`

## Future Enhancements

- [ ] Real model integration (currently uses synthetic metrics)
- [ ] Video output (MP4 encoding from collected frames)
- [ ] Distributed execution (multi-GPU scaling)
- [ ] Quality metrics (LPIPS, FID, temporal consistency)
- [ ] Live WebRTC adapter (replay scenarios in live session)

## See Also

- [Scenario Editor](../../../examples/lingbot-world-2/app/scenario-editor/)
- [ROADMAP.md](../../../ROADMAP.md)
- [StructuredExample Format](../../../lib/lingbot-world-prompts.ts)
