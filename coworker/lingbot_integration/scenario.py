"""
Scenario dataclasses for the LingBot Integration API.

Defines the canonical types that bridge between:
- JSON files in lib/lingbot-cases/ (StructuredExample format)
- Python runtime execution (IntegrationScenario format)
- Headless scenario runner and Scenario Editor

A scenario is a deterministic workload that can run without a UI.
It is the bridge from integrations to benchmarks.
"""

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Literal, Optional
from datetime import datetime
import numpy as np


class InputType(str, Enum):
    """Control event type."""
    KEYBOARD = "keyboard"
    TEXT_EVENT = "text_event"
    PAUSE = "pause"
    STEP = "step"


@dataclass(frozen=True)
class IntegrationInput:
    """
    Single control event: keyboard, text, or system.

    Represents one timestamped input into the model during scenario execution.
    Multiple inputs are sequenced chronologically in IntegrationScenario.inputs.
    """
    timestamp_s: float
    """Wall-clock or virtual time (seconds) when this input occurs."""

    input_type: InputType
    """Type of input: keyboard key, text event, pause, or step marker."""

    key: Optional[str] = None
    """Keyboard key (e.g., 'w', 'a', 's', 'd', 'space', 'c', '1'-'9')."""

    event_id: Optional[str] = None
    """Event identifier (e.g., 'portal', 'storm') for text events."""

    duration_s: float = 0.0
    """Duration for sustained/repeating inputs (e.g., hold W for 2.5 seconds)."""

    def __post_init__(self):
        """Validate input consistency."""
        if self.input_type == InputType.KEYBOARD and not self.key:
            raise ValueError("KEYBOARD input_type requires 'key' field")
        if self.input_type == InputType.TEXT_EVENT and not self.event_id:
            raise ValueError("TEXT_EVENT input_type requires 'event_id' field")


@dataclass(frozen=True)
class IntegrationScenario:
    """
    Deterministic workload ready for headless execution.

    Converted from lib/lingbot-cases/*.json (StructuredExample format) into
    a canonical form that can be stepped through by IntegrationSession.

    Scenarios drive:
    - Headless CLI runs (python -m lingbot.integration.cli)
    - Benchmark harness (emit manifest.json + metrics)
    - Scenario Editor testing (validate + preview)
    - WebRTC replay (inject events into live session)
    """

    scenario_id: str
    """Unique identifier (e.g., 'farmer-01', 'asteroids-short')."""

    name: str
    """Human-readable name (e.g., 'Farmer tool-swap showcase')."""

    description: str
    """One-line description of what happens in this scenario."""

    spec_id: str
    """Reference to IntegrationSpec schema (e.g., 'lingbot-world-camera-control')."""

    first_frame_image: np.ndarray | Path
    """Starting image: numpy array [H, W, 3] uint8, or Path to JPEG file."""

    first_frame_prompt: str
    """Base prompt describing the scene before events fire."""

    inputs: list[IntegrationInput]
    """Chronological sequence of control events to inject during execution."""

    duration_s: float
    """Total expected duration (seconds). Used for timeout/validation."""

    metadata: dict[str, Any] = field(default_factory=dict)
    """
    Custom fields. Typically stores the original farmer.json chapter data
    for round-tripping and debugging (e.g., 'character', 'environment', 'events').
    """

    def num_inputs(self) -> int:
        """Count of control events."""
        return len(self.inputs)

    def max_input_time_s(self) -> float:
        """Latest timestamp across all inputs."""
        if not self.inputs:
            return 0.0
        return max(inp.timestamp_s + inp.duration_s for inp in self.inputs)


@dataclass(frozen=True)
class IntegrationSpec:
    """
    Input/output schema contract for an integration (e.g., LingBot).

    Metadata and factories: cheap to import, must NOT load model checkpoints.
    Answers "what can this integration do?" without creating the model.

    Used by:
    - Scenario Editor (validate scenarios against schema)
    - Benchmark harness (select scenarios, optimization profiles)
    - Hosted platforms (discover capabilities)
    - CLI discovery (list available integrations)
    """

    spec_id: str
    """Unique integration identifier (e.g., 'lingbot-world-camera-control')."""

    display_name: str
    """Human-readable name (e.g., 'LingBot World 2 with Camera Control')."""

    description: str
    """Multi-sentence explanation of what this integration does."""

    input_schema: dict[str, Any]
    """JSON Schema for inputs. Validates frame size, fps, supported keys, etc."""

    output_schema: dict[str, Any]
    """JSON Schema for outputs. Declares video shape, metrics fields, artifacts."""

    default_config: dict[str, Any] = field(default_factory=dict)
    """
    Default configuration to merge with scenario metadata.
    E.g., default fps=16, num_frames_per_block=3, seed=42.
    """

    def validate_scenario(self, scenario: IntegrationScenario) -> list[str]:
        """
        Validate a scenario against this spec's schemas.

        Returns list of validation errors (empty = valid).
        Checks input types, event names, and basic constraints.
        """
        errors = []

        # Check spec_id matches
        if scenario.spec_id != self.spec_id:
            errors.append(
                f"Scenario spec_id '{scenario.spec_id}' does not match "
                f"IntegrationSpec spec_id '{self.spec_id}'"
            )

        # Check input types are recognized
        for inp in scenario.inputs:
            if inp.input_type not in [e.value for e in InputType]:
                errors.append(
                    f"Input at {inp.timestamp_s}s has unknown type: {inp.input_type}"
                )

        return errors


@dataclass(frozen=True)
class ExecutionMetrics:
    """
    Per-step metrics emitted by IntegrationSession.step().

    Used to build manifest.json and metrics.ndjson.
    Canonical metric names include units in the key (e.g., chunk.total_s).
    """

    chunk_index: int
    """Which chunk was just processed (0-indexed)."""

    num_frames: int
    """Number of output frames in this chunk."""

    latency_s: float
    """Wall-clock time to execute this chunk (seconds)."""

    timestamp_s: float
    """Wall-clock time when this chunk finished (seconds since execution start)."""

    timings: dict[str, float] = field(default_factory=dict)
    """
    Breakdown of where time was spent (e.g., 'model.denoise_s', 'transport.copy_s').
    Keys follow canonical naming: component.operation_unit.
    """

    memory_bytes: int = 0
    """Peak GPU memory allocated during this chunk."""

    metadata: dict[str, Any] = field(default_factory=dict)
    """Custom fields (e.g., 'compile_status', 'cuda_graph_captured')."""


@dataclass
class ScenarioExecutionResult:
    """
    Result of running run_integration_scenario().

    Contains success status, collected artifacts, and summary metrics.
    Written as manifest.json at the end of execution.
    """

    scenario_id: str
    """The scenario that was executed."""

    spec_id: str
    """The integration spec that ran it."""

    success: bool
    """Whether execution completed without errors."""

    duration_s: float
    """Total wall-clock time (seconds)."""

    num_chunks: int = 0
    """Number of chunks processed before completion or error."""

    num_frames: int = 0
    """Total frames generated."""

    artifacts: dict[str, Path] = field(default_factory=dict)
    """
    Output file paths (e.g., 'video': Path('output.mp4'), 'metrics': Path('metrics.ndjson')).
    Keys: 'video', 'metrics', 'logs', 'manifest'.
    """

    error: Optional[str] = None
    """Error message if success=False."""

    error_type: Optional[str] = None
    """Exception class name if success=False (e.g., 'RuntimeError')."""

    metrics_summary: dict[str, Any] = field(default_factory=dict)
    """
    Aggregate metrics: average latency, peak memory, frame rate, etc.
    Computed from per-chunk metrics in metrics.ndjson.
    """

    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    """ISO 8601 timestamp when execution started."""

    def as_dict(self) -> dict[str, Any]:
        """Serialize to JSON-compatible dict for manifest.json."""
        return {
            "scenario_id": self.scenario_id,
            "spec_id": self.spec_id,
            "success": self.success,
            "duration_s": self.duration_s,
            "num_chunks": self.num_chunks,
            "num_frames": self.num_frames,
            "artifacts": {k: str(v) for k, v in self.artifacts.items()},
            "error": self.error,
            "error_type": self.error_type,
            "metrics_summary": self.metrics_summary,
            "created_at": self.created_at,
        }
