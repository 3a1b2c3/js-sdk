"""
LingbotIntegrationRuntime and LingbotIntegrationSession implementations.

Runtime: Manages model lifecycle (initialize, prewarm, create sessions)
Session: Per-scenario execution (step, collect metrics, finish)
"""

import json
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass
import numpy as np

from .scenario import (
    IntegrationScenario,
    IntegrationSpec,
    ExecutionMetrics,
    ScenarioExecutionResult,
)


@dataclass
class RuntimeConfig:
    """Configuration for IntegrationRuntime initialization."""
    device: str = "cuda"
    seed: int = 42
    output_dir: Path = Path("outputs")
    optimization_profile: str = "quality"
    num_frames_per_block: int = 3
    fps: int = 16


class LingbotIntegrationRuntime:
    """
    Wraps model initialization and session management.

    Responsibilities:
    - Load model checkpoint
    - Manage KV cache and warm cache
    - Create per-scenario sessions
    - Emit runtime metadata
    """

    def __init__(self, spec: IntegrationSpec, config: RuntimeConfig):
        self.spec = spec
        self.config = config
        self.model = None  # Lazy: load on first session
        self.metrics_buffer: list[ExecutionMetrics] = []

    def initialize(self) -> dict[str, Any]:
        """
        Initialize runtime: load model, setup distributed if needed.
        Returns runtime info dict.
        """
        # MVP: Model loading deferred to first session
        return {
            "spec_id": self.spec.spec_id,
            "device": self.config.device,
            "seed": self.config.seed,
            "optimization_profile": self.config.optimization_profile,
        }

    def prewarm(self, warmup_chunks: int = 1) -> dict[str, float]:
        """
        Pre-compile model and compile CUDA graphs if applicable.
        Returns warmup timing info.
        """
        # MVP: Deferred to first session
        return {"warmup_chunks": warmup_chunks, "warmup_time_s": 0.0}

    def start_session(
        self,
        scenario: IntegrationScenario,
    ) -> "LingbotIntegrationSession":
        """
        Create a new session for this scenario.

        Args:
            scenario: The scenario to execute

        Returns:
            LingbotIntegrationSession ready to step()
        """
        session = LingbotIntegrationSession(
            runtime=self,
            scenario=scenario,
            config=self.config,
        )
        return session

    def close(self) -> None:
        """Clean up runtime resources."""
        if self.model is not None:
            # TODO: Unload model, free GPU memory
            pass


class LingbotIntegrationSession:
    """
    Per-scenario execution context.

    Manages:
    - Scenario stepping (one chunk at a time)
    - Metric collection per-step
    - Artifact accumulation
    - Completion detection
    """

    def __init__(
        self,
        runtime: LingbotIntegrationRuntime,
        scenario: IntegrationScenario,
        config: RuntimeConfig,
    ):
        self.runtime = runtime
        self.scenario = scenario
        self.config = config

        self.chunk_index = 0
        self.start_time_s = 0.0
        self.collected_metrics: list[ExecutionMetrics] = []
        self.collected_frames: list[np.ndarray] = []

    def step(self) -> ExecutionMetrics:
        """
        Execute one video chunk.

        Returns metrics for this chunk.
        In MVP: returns synthetic metrics; real impl calls model.generate().
        """
        # Simulate model execution
        import time

        step_start = time.time()

        # MVP: Synthetic metrics for testing
        num_frames = self.config.num_frames_per_block
        latency_s = 0.75  # ~0.75s per chunk @ 16fps
        memory_bytes = 2_147_483_648  # 2GB

        # Collect synthetic frame (for testing)
        frame = np.random.randint(0, 256, (480, 720, 3), dtype=np.uint8)
        self.collected_frames.append(frame)

        elapsed = time.time() - step_start

        # Create metrics
        metrics = ExecutionMetrics(
            chunk_index=self.chunk_index,
            num_frames=num_frames,
            latency_s=latency_s,
            timestamp_s=self.chunk_index * 0.75 + elapsed,
            timings={
                "model.total_s": latency_s * 0.8,
                "transport.copy_s": latency_s * 0.2,
            },
            memory_bytes=memory_bytes,
        )

        self.collected_metrics.append(metrics)
        self.chunk_index += 1

        return metrics

    def finish(self) -> ScenarioExecutionResult:
        """
        Finalize scenario execution.

        Returns result with collected artifacts and metrics summary.
        """
        total_frames = len(self.collected_frames)
        total_chunks = len(self.collected_metrics)
        total_time = sum(m.latency_s for m in self.collected_metrics)

        # Compute summary metrics
        latencies = [m.latency_s for m in self.collected_metrics]
        avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
        peak_memory = max(
            (m.memory_bytes for m in self.collected_metrics), default=0
        )

        result = ScenarioExecutionResult(
            scenario_id=self.scenario.scenario_id,
            spec_id=self.scenario.spec_id,
            success=True,
            duration_s=total_time,
            num_chunks=total_chunks,
            num_frames=total_frames,
            artifacts={},  # Populated by artifact writer
            metrics_summary={
                "avg_latency_s": avg_latency,
                "peak_memory_bytes": peak_memory,
                "fps": total_frames / total_time if total_time > 0 else 0,
            },
        )

        return result

    def close(self) -> None:
        """Clean up session resources."""
        self.collected_frames.clear()
