# Interactive Tooling for REACTOR

## Vision

Move scenario definition, execution, and debugging from Python scripts → interactive UI. Non-ML engineers can test models, MLEs can iterate faster, everyone gets visibility into what's happening.

## Three Tools

### 1. Scenario Editor

**Goal:** Create and edit `IntegrationScenario` definitions without touching Python

**Interface:**
```
┌─────────────────────────────────────────────────────────┐
│ Scenario Editor                             [Save] [Run] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Scenario Name: lingbot-example-00                      │
│ Tags: [interactive] [camera-control] [4gpu]           │
│ Description: LingBot with camera poses, 4 chunks      │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Inputs                                          │   │
│ ├─────────────────────────────────────────────────┤   │
│ │ • Prompt: [text input field]                    │   │
│ │   "A warrior stands in a foggy forest..."      │   │
│ │                                                 │   │
│ │ • First Frame: [file upload or URL]             │   │
│ │   📁 frame_0000.jpg (512×768)                  │   │
│ │                                                 │   │
│ │ • Camera Poses: [file upload]                   │   │
│ │   📁 poses.json (48 frames, cam trajectory)    │   │
│ │                                                 │   │
│ │ • Control Script: [dropdown: keyboard | poses]  │   │
│ │   ⊙ Use precomputed poses                       │   │
│ │   ○ Record keyboard                             │   │
│ │   ○ Generate random                             │   │
│ │                                                 │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Constraints                                     │   │
│ ├─────────────────────────────────────────────────┤   │
│ │ Max Chunks: [4]                                 │   │
│ │ Max Frames: [96]                                │   │
│ │ Seed: [42] (for reproducibility)                │   │
│ │ Expected Duration: ~6 seconds @ 16fps           │   │
│ │                                                 │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Expected Output (Validation)                    │   │
│ ├─────────────────────────────────────────────────┤   │
│ │ ✓ Shape: 512×768×3 (RGB)                       │   │
│ │ ✓ Frame count: 96 frames                        │   │
│ │ ✓ FPS: 16                                       │   │
│ │ ✓ Finite output (no NaNs)                       │   │
│ │ ✓ Nonzero variance (not blank)                  │   │
│ │ ✓ Latency <10s per chunk                        │   │
│ │                                                 │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Drag-and-drop file uploads (frames, poses, videos)
- Form validation: required fields, file type checks
- Preview: show first frame, pose trajectory as visualization
- Quick actions: "Run now", "Save & run", "Export as JSON"
- Asset gallery: browse recent uploads, reuse across scenarios
- Integration selector: choose which model to test

**Data flow:**
```
UI Form → JSON → IntegrationScenario → save to repo → discoverable in CLI
```

**Example JSON export:**
```json
{
  "slug": "lingbot-example-00",
  "description": "LingBot with camera poses, 4 chunks",
  "tags": ["interactive", "camera-control", "4gpu"],
  "inputs": {
    "prompt": "A warrior stands in a foggy forest...",
    "first_frame": "s3://bucket/frame_0000.jpg",
    "camera_poses": "s3://bucket/poses.json"
  },
  "max_chunks": 4,
  "max_frames": 96,
  "seed": 42,
  "expected": {
    "shape": [512, 768, 3],
    "frame_count": 96,
    "fps": 16,
    "finite": true,
    "nonzero_variance": true,
    "latency_s_max": 10.0
  }
}
```

**Benefits:**
- Non-engineers can create test cases without Python
- Scenarios live in repo, version-controlled
- Quick iteration: edit → save → run in same UI
- Asset reuse reduces duplication

---

### 2. Live Replay

**Goal:** Load a past execution, change parameters, re-run without re-rendering

**Interface:**
```
┌─────────────────────────────────────────────────────┐
│ Live Replay                              [Download] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Past Execution: lingbot-example-00_2026-07-27  │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ Model: LingBot                                  │ │
│ │ Chunk 0/3: [████████░░] 67% complete           │ │
│ │ Runtime: 4.2s / 6.3s (playback speed: 1.0x)    │ │
│ │                                                 │ │
│ │ [Play] [Pause] [Skip to chunk] [Download MP4]  │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Video Viewport                                  │ │
│ │ ┌────────────────────────────────────────────┐ │ │
│ │ │                                            │ │ │
│ │ │      [Frame Preview]                       │ │ │
│ │ │      512×768 @ chunk 0, frame 2            │ │ │
│ │ │                                            │ │ │
│ └────────────────────────────────────────────┘ │ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Replay Parameters                               │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ Prompt: [A warrior stands in a foggy forest]   │ │
│ │ Camera Poses: [Use recorded trajectory]         │ │
│ │                                                 │ │
│ │ Modifications:                                  │ │
│ │ ☐ Enable torch.compile (add 2s startup)        │ │
│ │ ☐ Enable CUDA graphs (save 0.3s per chunk)     │ │
│ │ ☐ Use different optimization profile           │ │
│ │   [quality] [realtime] [benchmark]             │ │
│ │                                                 │ │
│ │ [Re-run with new params]                        │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Comparison (Current vs. Original)               │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ Metric                 Original  | New     | Δ  │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ chunk.total_s          6.3s      | 5.1s    | -19%│ │
│ │ model.denoise_s        2.8s      | 2.1s    | -25%│ │
│ │ model.decode_s         1.2s      | 1.0s    | -17%│ │
│ │ gpu.mem_peak_bytes     18.2GB    | 18.2GB  | —   │ │
│ │ output.pixel_fps       80.8      | 94.1    | +16%│ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Browse past runs: filter by model, scenario, date, status
- Play/pause/skip frame-by-frame
- Overlay metrics on video (timing, GPU load)
- A/B comparison: side-by-side video or metrics table
- Parameter tweaking: modify optimization flags, replay with same inputs
- Diff: which files/configs changed between two runs
- Share: export run metadata + video + metrics as shareable link

**Data sources:**
```
$output_dir/run_id/
  manifest.json          (metadata, params, status)
  metrics.ndjson         (per-frame/per-chunk timings)
  outputs/
    video.mp4            (rendered output)
    metrics.csv          (aggregate stats)
```

**Replay logic:**
```python
# Load run from disk
run = load_run('lingbot-example-00_2026-07-27')

# Modify parameters
run.optimization_profile = 'realtime'  # instead of 'quality'
run.enable_torch_compile = True

# Re-execute with same inputs, new params
new_result = replay_scenario(run.scenario, new_params=run.params)

# Compare side-by-side
compare(run.result, new_result)
```

**Benefits:**
- Post-mortem debugging: load past failure, inspect what happened
- A/B optimization: test feature flag without retraining
- Regression detection: compare against baseline
- Knowledge sharing: "this run had a weird spike, let me show you"

---

### 3. Profiler UI

**Goal:** Visualize where time is spent per chunk (compile? denoise? decode? transport?)

**Interface:**
```
┌────────────────────────────────────────────────────┐
│ Performance Profiler                 [Export] [Share]│
├────────────────────────────────────────────────────┤
│                                                    │
│ Scenario: lingbot-example-00                       │
│ Total Runtime: 6.3s (4 chunks)                     │
│ Avg Per Chunk: 1.575s                              │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ Flame Graph (Stacked Timeline)                 │ │
│ ├────────────────────────────────────────────────┤ │
│ │                                                │ │
│ │ Startup (prewarm + compile)     ████░░░░░░ 1.2s│ │
│ │ ├─ torch.compile               ███░░░░░░░░ 0.8s│ │
│ │ ├─ CUDA graph capture          █░░░░░░░░░░░ 0.2s│ │
│ │ └─ GPU warmup                  ░░░░░░░░░░░░ 0.2s│ │
│ │                                                │ │
│ │ Chunk 0 (frames 0-2)            █████░░░░░ 1.6s│ │
│ │ ├─ model.encode_s              ░░░░░░░░░░░ 0.1s│ │
│ │ ├─ model.denoise_s (20 steps)  ██████░░░░░ 0.9s│ │
│ │ ├─ model.decode_s              ░░░░░░░░░░░ 0.3s│ │
│ │ ├─ postprocess.pixel_s         ░░░░░░░░░░░ 0.1s│ │
│ │ └─ transport.gpu_to_cpu_copy_s ░░░░░░░░░░░ 0.2s│ │
│ │                                                │ │
│ │ Chunk 1 (frames 3-5)            ████░░░░░░░ 1.5s│ │
│ │ ├─ model.cache_update_wait_s   ░░░░░░░░░░░ 0.1s│ │
│ │ ├─ model.denoise_s             ██████░░░░░ 0.8s│ │
│ │ ├─ model.decode_s              ░░░░░░░░░░░ 0.3s│ │
│ │ └─ ...                                        │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ Breakdown (Bar Chart)                          │ │
│ ├────────────────────────────────────────────────┤ │
│ │ Denoise (30 steps total)   ██████████░░ 47%    │ │
│ │ Decode                     ███░░░░░░░░░ 15%    │ │
│ │ GPU ↔ CPU copy             ███░░░░░░░░░ 12%    │ │
│ │ Transport/JPEG             ███░░░░░░░░░ 10%    │ │
│ │ Compile (one-time)         ████░░░░░░░░ 8%    │ │
│ │ Encode + other             ██░░░░░░░░░░ 8%    │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ Optimization Opportunities                     │ │
│ ├────────────────────────────────────────────────┤ │
│ │                                                │ │
│ │ 🔥 Hotspot: Denoise 47% of time                │ │
│ │    Suggestion: Enable CUDA graphs (est. -15%) │ │
│ │    Suggestion: Reduce steps (est. -20%)        │ │
│ │                                                │ │
│ │ ⚠️  GPU ↔ CPU copy: 12% of time                 │ │
│ │    Current: sync copy, blocks GPU              │ │
│ │    Suggestion: Enable async overlap            │ │
│ │                                                │ │
│ │ 💡 Compile: 8% (one-time startup cost)         │ │
│ │    This goes away on subsequent sessions       │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ Drilling Down: Chunk 0, Denoise                │ │
│ ├────────────────────────────────────────────────┤ │
│ │ Step 1-5:   ████░░░░░░ 250ms (compile latency) │ │
│ │ Step 6-20:  ░░░░░░░░░░ 650ms (steadystate)     │ │
│ │ Step 21-30: ░░░░░░░░░░ 150ms (final refine)    │ │
│ │                                                │ │
│ │ Observation: Compile overhead on first step,   │ │
│ │ then steady 32ms/step = 2.8 TFLOPS utilization│ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Features:**
- **Timeline view**: stacked bars showing what % of time is spent where
- **Breakdown pie/bar chart**: visual proportion of each phase
- **Drill-down**: click a chunk to see per-step timings
- **Comparisons**: overlay two profiler results to see where optimization helped
- **Anomaly detection**: flag unusual spikes (compile hiccups, GPU stalls)
- **Optimization hints**: suggest which knob to turn based on hotspots
- **Export**: save as JSON or HTML report

**Data sources:**
```
Canonical metrics:
  timings_s:
    chunk.total_s
    model.encode_s
    model.denoise_s
    model.decode_s
    model.cache_prepare_s
    model.cache_update_wait_s
    postprocess.pixel_s
    transport.gpu_to_cpu_copy_s
    transport.frame_layout_s
    startup.load_s
    startup.prewarm_s
  
  gauges:
    gpu.mem_peak_bytes
    output.pixel_fps
    queue.depth
  
  flags:
    compile.active
    cuda_graph.captured
    overlap.decode
    overlap.cache_update
```

**Benefits:**
- **Understanding**: see exactly where time goes, no guessing
- **Iteration**: test optimization → see if it moved the needle
- **Debugging**: "why did this run take 2s longer?" → profiler shows it
- **Sharing**: "look at this anomaly" → send profiler report

---

## Implementation Strategy

### Phase 1: Scenario Editor (Week 1-2)
```
1. Design JSON schema for scenarios (DONE in ROADMAP)
2. Build React form component
3. Wire to backend: save scenarios to disk
4. Integration: scenarios appear in `flashdreams-integration-bench`
5. Test: create 3 scenarios for each model via UI
```

### Phase 2: Live Replay (Week 3-4)
```
1. Standardize artifact structure (manifest.json, metrics.ndjson, video.mp4)
2. Build replay loader: deserialize run from disk
3. Build parameter diff: show what changed
4. Implement re-run logic: same scenario + new params
5. Test: replay a past run, toggle compile flag, compare metrics
```

### Phase 3: Profiler UI (Week 5-6)
```
1. Extract metrics from NDJSON → timeline format
2. Build flame-graph component (or embed D3 Flamegraph)
3. Build breakdown chart (Plotly or similar)
4. Implement drill-down (click chunk → see per-step breakdown)
5. Add heuristics for "here's what's slow, try this"
6. Test: profile 10 different runs, spot optimization opportunities
```

### Integration Points
```
Scenario Editor → Saved JSON → flashdreams-integration-bench --scenario <slug>
                              ↓
                        IntegrationSession
                              ↓
                        metrics.ndjson + video.mp4
                              ↓
                        Live Replay UI (load past run)
                              ↓
                        Profiler UI (visualize timings)
```

---

## Expected User Journeys

### Journey 1: Non-Engineer Tests a Model
```
1. Open Scenario Editor
2. Upload first frame, write prompt
3. Click [Run]
4. See video, metrics appear in Profiler UI
5. Share results with team
→ No Python, no CLI, no scripts needed
```

### Journey 2: Optimization A/B Test
```
1. Load a past run in Live Replay
2. Enable torch.compile, disable CUDA graphs
3. Click [Re-run with new params]
4. Side-by-side metrics comparison shows +15% speedup
5. Commit optimization to codebase
→ Iterate fast, see impact immediately
```

### Journey 3: Regression Investigation
```
1. Load baseline profiler (old run)
2. Load new run
3. Overlay on same timeline
4. Anomaly: denoise took 2s instead of 0.8s
5. Drill down: first step got slower
6. Investigate: torch version change? GPU driver? Ambient load?
→ Data-driven debugging
```

---

## Why This Matters

**Current state:** 
- "How do I test this model?" → Read docs, write Python script
- "Why is it slow?" → Run model locally, grep timings, build own chart
- "Did my optimization work?" → Run twice, diff output files manually

**With Interactive Tooling:**
- "How do I test?" → Upload files, click Run
- "Why is it slow?" → Open Profiler, see breakdown instantly
- "Did it work?" → A/B side-by-side in same UI

**Impact:**
- Faster iteration: test scenarios in minutes, not hours
- Better visibility: profile tells story without diving into logs
- Lower barrier: non-engineers can contribute test cases
- Knowledge sharing: "look at this run" is a link, not a 50-line reproduction

---

## Open Threads

1. **Asset hosting**: Where do users upload first-frames, poses, videos?
   - Option A: Local file picker (works for dev, not hosted)
   - Option B: S3 integration (managed hosting)
   - Option C: GitHub releases (version-controlled scenarios)

2. **Real-time profiling**: Should profile update as run executes?
   - Option A: Batch after run completes (simpler, 10s latency)
   - Option B: Streaming metrics via WebSocket (more data, more complexity)

3. **Baseline tracking**: How do scenarios relate to regression detection?
   - Option A: Save baseline on first run, compare future runs to it
   - Option B: Explicit baseline snapshots (git tags for "approved" runs)

4. **Sharing & collaboration**: How do teams share scenarios + baselines?
   - Option A: Export/import JSON files in git repo
   - Option B: Hosted scenario registry (shared between teams)

---

*Interactive Tooling transforms REACTOR from a research project into a product that non-ML engineers can use.*
