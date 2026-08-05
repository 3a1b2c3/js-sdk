"""
Canonical scenario execution loop.

run_integration_scenario() is the shared entry point for:
- Headless CLI runs
- Benchmark harness
- Scenario Editor testing
- WebRTC replay

Emits manifest.json + metrics.ndjson artifacts.
"""

import json
import time
from pathlib import Path
from typing import Optional

from .scenario import IntegrationScenario, IntegrationSpec, ScenarioExecutionResult
from .runtime import LingbotIntegrationRuntime, RuntimeConfig


def run_integration_scenario(
    scenario: IntegrationScenario,
    spec: IntegrationSpec,
    output_dir: Path = Path("outputs"),
    runtime_config: Optional[RuntimeConfig] = None,
) -> ScenarioExecutionResult:
    """
    Canonical scenario execution loop.

    Orchestrates:
    1. Runtime initialization
    2. Session creation
    3. Chunk stepping until scenario complete
    4. Metrics emission (metrics.ndjson)
    5. Artifact writing (manifest.json, video.mp4)

    Args:
        scenario: IntegrationScenario to execute
        spec: IntegrationSpec that defines the runtime
        output_dir: Where to write artifacts
        runtime_config: Runtime configuration (uses defaults if None)

    Returns:
        ScenarioExecutionResult with success status and artifact paths
    """
    if runtime_config is None:
        runtime_config = RuntimeConfig(output_dir=output_dir)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Create run-specific output directory
    run_id = scenario.scenario_id
    scenario_output_dir = output_dir / run_id
    scenario_output_dir.mkdir(parents=True, exist_ok=True)

    metrics_path = scenario_output_dir / "metrics.ndjson"
    manifest_path = scenario_output_dir / "manifest.json"

    runtime: Optional[LingbotIntegrationRuntime] = None
    session = None

    try:
        # Initialize runtime
        runtime = LingbotIntegrationRuntime(spec, runtime_config)
        runtime_info = runtime.initialize()

        # Prewarm (compile CUDA graphs, etc.)
        warmup_result = runtime.prewarm()

        # Start session for this scenario
        session = runtime.start_session(scenario)

        # Execute scenario: step through chunks until done
        execution_start_time = time.time()

        with open(metrics_path, "w") as metrics_file:
            # Step until scenario duration exceeded
            while True:
                # Check if we've reached scenario duration
                if (
                    session.chunk_index * 0.75 >= scenario.duration_s
                    and session.chunk_index > 0
                ):
                    break

                # Execute one chunk
                metrics = session.step()

                # Write per-chunk metrics to NDJSON
                metrics_dict = {
                    "chunk_index": metrics.chunk_index,
                    "num_frames": metrics.num_frames,
                    "latency_s": metrics.latency_s,
                    "timestamp_s": metrics.timestamp_s,
                    "timings": metrics.timings,
                    "memory_bytes": metrics.memory_bytes,
                }
                metrics_file.write(json.dumps(metrics_dict) + "\n")

        execution_time = time.time() - execution_start_time

        # Finalize session and collect result
        result = session.finish()
        result.duration_s = execution_time

        # Write artifacts
        result.artifacts = {
            "metrics": metrics_path,
            "manifest": manifest_path,
        }

        # Write manifest.json
        manifest_data = {
            **result.as_dict(),
            "runtime_info": runtime_info,
            "warmup_result": warmup_result,
        }
        with open(manifest_path, "w") as f:
            json.dump(manifest_data, f, indent=2)

        return result

    except Exception as e:
        # Return failed result with error details
        execution_time = time.time() - execution_start_time
        return ScenarioExecutionResult(
            scenario_id=scenario.scenario_id,
            spec_id=scenario.spec_id,
            success=False,
            duration_s=execution_time,
            error=str(e),
            error_type=type(e).__name__,
            artifacts={"metrics": metrics_path, "manifest": manifest_path},
        )

    finally:
        # Cleanup
        if session is not None:
            session.close()
        if runtime is not None:
            runtime.close()
