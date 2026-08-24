# REACTOR Strategic Roadmap

## Where We Are

**Current State (July 2026):**
- ✅ Core coordinator system: stateless, fact-based state management
- ✅ WebRTC transport for interactive video
- ✅ DirectorPanel for manual world control
- ✅ AI director backend (Python) for autonomous events
- ✅ Multiple integrations (LingBot, OmniDreams, FlashVSR, HY-WorldPlay)
- ⚠️ Duplicated logic across integrations (runners, WebRTC adapters)
- ⚠️ No unified scenario/benchmark framework
- ⚠️ Limited observability and testing

## Key Insights Learned

### Architecture Lessons
1. **Separation wins**: Coordinator (state) ↔ Pipeline (inference) ↔ Transport (UI) creates clean boundaries
2. **Persistence via repetition**: Stateless models need continuous re-projection—elegantly solved by History
3. **Adapters over rewrites**: Same session logic should work for CLI, WebRTC, MJPEG, gRPC, benchmarks

### Integration Patterns
1. **Spec-Runtime-Session split**: Metadata cheap, model expensive, per-rollout isolated
2. **Scenarios as first-class**: Deterministic workloads enable benchmarks, testing, and replay
3. **Metrics standardization**: Canonical names + units = cross-model comparison

### Developer Experience
1. **Documentation matters**: Good README saves hours of debugging
2. **Test coverage prevents regressions**: DirectorPanel state logic + History lifetime management need verification
3. **Debug cleanup**: Console.log statements accumulate—auto-detection + linting helps

## Vision: Unified Integration Framework

**Inspiration from FlashDreams proposal + REACTOR reality:**

The future is a standard `IntegrationSpec` contract that every model implements:

```
┌─────────────────────────────────────┐
│ IntegrationSpec (metadata)          │
│ - inputs: prompt, first-frame, etc  │
│ - scenarios: deterministic tasks    │
│ - optimization profiles             │
│ - capabilities & resources          │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ IntegrationRuntime (model lifecycle)│
│ - initialize() → load checkpoint    │
│ - prewarm() → compile, cache prep   │
│ - start_session() → per-rollout     │
│ - close() → cleanup                 │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ IntegrationSession (per-rollout)    │
│ - next_input_window() → what to ask │
│ - step(request) → compute one chunk │
│ - reset() → re-initialize           │
│ - finish() → artifacts + metrics    │
└─────────────────────────────────────┘
```

**One loop drives all use cases:**
```python
for each scenario:
    runtime = spec.make_runtime()
    session = runtime.start_session(scenario.inputs)
    while not session.done():
        request = build_step_request(session, scenario)
        result = session.step(request)
        record_metrics(result)
    # Produces: video.mp4, metrics.json, manifest.json, report.html
```

## Future Directions (No Implementation)

### Phase 1: Integration Standardization
**Goal:** Eliminate duplicated runner/WebRTC code

- Define `IntegrationSpec` contract once
- Migrate simple runners first (Wan2.1, Cosmos-Predict2, Self-Forcing)
- Convert realtime integrations (LingBot, OmniDreams) with WebRTC adapter
- Prove equivalence: same scenario runs via CLI and WebRTC with identical metrics

**Payoff:** Fewer bugs, easier onboarding, shared optimization (caching, compile, overlap)

### Phase 2: Benchmark & Testing
**Goal:** Catch regressions before shipping

- Scenario-driven deterministic testing (no UI randomness)
- Automated daily regression suite with HTML reports
- Quality metrics: FID, LPIPS, temporal consistency, latency SLOs
- Baseline tracking: detect unexplained slowdowns or quality drops

**Payoff:** Ship with confidence, catch performance regressions early

### Phase 3: Observability & Profiling
**Goal:** Understand where time/compute is spent

- Canonical metric schema: chunk.total_s, model.denoise_s, model.decode_s, transport.*_s
- Per-chunk tracing: what's the hotpath? (compile? denoise? decode? transport?)
- GPU memory timeline: peak usage, allocation patterns, OOM risk signals
- Integration with platform observability (Grafana, DataDog) for production runs

**Payoff:** Data-driven optimization decisions, fast incident response

### Phase 4: Distributed & Multi-Session
**Goal:** Scale beyond single-GPU, single-session limits

- Coordinator sharding: distribute state across processes for multi-GPU inference
- Session pooling: reuse warm model state across concurrent sessions
- Load balancing: route new sessions to least-loaded GPU
- Graceful degradation: serve with fewer resources rather than queuing indefinitely

**Payoff:** Higher throughput, lower latency, cost efficiency

### Phase 5: Composable Features
**Goal:** Mix-and-match optimizations without rewriting models

- Optimization plugins: torch.compile, CUDA graphs, cache overlap, sparse attention—independent, stackable
- Feature flags: enable/disable per-session without model reload
- Benchmarking framework: A/B compare optimization combinations
- Ablation tooling: systematically measure contribution of each feature

**Payoff:** Faster experimentation, reproducible benchmarks

### Phase 6: Interactive Tooling
**Goal:** Make building & debugging integrations easier

- Scenario editor: write/test scenarios in UI without Python
- Live replay: load past session, rerun with different parameters
- Profiler UI: visualize where time is spent per chunk
- Model probe: interactively test inputs, see outputs, inspect intermediate states

**Payoff:** Faster iteration, lower barrier for non-ML engineers

### Phase 7: Hosted Platform Integration
**Goal:** Deploy REACTOR models to partner platforms (Reactor, etc.)

- Standard gRPC contract for session creation, stepping, metrics export
- Authentication & routing boundary: REACTOR owns inference, platform owns identity/billing
- Session recording & replay for post-mortems
- Structured error codes: platform knows what to show users vs. log vs. retry

**Payoff:** Unified deployment story across internal + partner products

## Cross-Cutting Themes

### Documentation as Code
- Every integration publishes a README explaining:
  - Inputs & outputs
  - Optimization profiles & their impact
  - Example scenarios
  - Known limitations & gotchas

### Metrics First
- Define success metrics before implementation
- Benchmark baseline before optimization
- Publish results (even "neutral" or negative) so others learn

### Composable Over Monolithic
- Optimization features: independent flags, not "fast" vs "slow" binary
- Integration lifecycle: extensible hooks, not forced patterns
- Transport adapters: reuse session logic, not reinvent per-transport

### Testing at Every Level
- Unit: History, fact projection, input validation
- Integration: session step contract, metrics consistency
- System: end-to-end scenario runs, regression detection
- Production: live monitoring, canary metrics, rollback signals

## How to Contribute

### For Model Integration Authors
1. Publish an `IntegrationSpec` for your model
2. Define 2-3 representative scenarios
3. Optimize and publish baseline metrics
4. Document assumptions & tradeoffs

### For Infrastructure Authors
1. Pick a theme (observability, distributed, profiling)
2. Design the contract first (how do integrations use this?)
3. Implement once, integrate into 2-3 models as proof
4. Document the integration pattern for others

### For Researchers
1. Identify optimization opportunity (e.g., "we can skip 30% of denoise steps")
2. Propose as a feature plugin
3. Measure impact across multiple scenarios/models
4. Publish results and integrate if validated

## Success Metrics (6-12 months)

- [ ] 5+ models use standard `IntegrationSpec`
- [ ] Benchmark suite catches 95%+ of regressions
- [ ] <10% code duplication across integrations (vs. current ~30%)
- [ ] New integration can launch in <1 week (vs. current ~2-3 weeks)
- [ ] <5% performance regression from "as-is" runners
- [ ] Community contribution: 2+ external integrations published

## Open Questions

1. **Hosted platform boundary**: Who owns session creation, authentication, routing?
2. **Multi-model orchestration**: Can one coordinator manage LingBot + OmniDreams + FlashVSR simultaneously?
3. **Realtime vs. batch**: Should benchmarks prioritize steady-state latency or total time-to-first-frame?
4. **Model portability**: How much specialized code is acceptable (vs. generic adapters)?
5. **Backwards compatibility**: How long do we maintain old Runner interfaces during migration?

## Related Work

- **FlashDreams Integration Proposal**: Standard API for model integrations
- **Coordinator README**: State management patterns
- **DirectorPanel refactor**: UI for state inspection
- **OpenWorker**: Automation & task scheduling
- **Unit tests**: Testing patterns for interactive systems

---

*Last updated: July 2026*
*Authors: Claude + community*
*Status: Strategic vision, not committed roadmap*
