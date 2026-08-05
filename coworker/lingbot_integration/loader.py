"""
Load farmer.json scenarios (StructuredExample format) into IntegrationScenario objects.

Handles backward compatibility: old farmer.json files map to the new schema,
with raw JSON stored in metadata for round-tripping.
"""

import json
from pathlib import Path
from typing import Any, Optional
import numpy as np
from PIL import Image
import requests

from .scenario import IntegrationScenario, IntegrationInput, InputType


def load_scenario_from_json(
    json_data: dict[str, Any],
    scenario_id: str,
    spec_id: str = "lingbot-world-camera-control",
    public_assets_dir: Optional[Path] = None,
) -> IntegrationScenario:
    """
    Convert a farmer.json (StructuredExample) into an IntegrationScenario.

    Args:
        json_data: Parsed JSON dict (StructuredExample format)
        scenario_id: Unique identifier (e.g., 'farmer-01')
        spec_id: Integration spec this scenario targets
        public_assets_dir: Path to public/lingbot-cases/ for loading images

    Returns:
        IntegrationScenario ready for headless execution
    """
    # Extract metadata
    name = json_data.get("name", scenario_id)
    description = json_data.get("description", "")

    # Load first frame image
    first_frame_image = _load_first_frame_image(
        json_data, scenario_id, public_assets_dir
    )

    # Extract base prompt from scene.base.default
    scene = json_data.get("scene", {})
    base_versions = scene.get("base", {})
    first_frame_prompt = base_versions.get("default", "")

    # Build input sequence from events
    inputs = _build_input_sequence(json_data)

    # Estimate duration (1 chunk ≈ 0.75s, default 8 chunks = 6 seconds)
    duration_s = json_data.get("objective", {}).get("durationChunks", 8) * 0.75

    # Store original JSON for round-tripping
    metadata = {
        "original_json": json_data,
        "scene_id": json_data.get("id", scenario_id),
        "hidden": json_data.get("hidden", False),
    }

    return IntegrationScenario(
        scenario_id=scenario_id,
        name=name,
        description=description,
        spec_id=spec_id,
        first_frame_image=first_frame_image,
        first_frame_prompt=first_frame_prompt,
        inputs=inputs,
        duration_s=duration_s,
        metadata=metadata,
    )


def _load_first_frame_image(
    json_data: dict[str, Any],
    scenario_id: str,
    public_assets_dir: Optional[Path] = None,
) -> np.ndarray | Path:
    """
    Load or resolve the first frame image.

    Tries in order:
    1. URL in image.src (download and return as numpy array)
    2. Local file in public/lingbot-cases/ (return as Path)
    3. Fallback: return Path object for deferred loading
    """
    image_data = json_data.get("image", {})
    src = image_data.get("src", "")

    if not src:
        # Fallback: assume public/lingbot-cases/{scenario_id}.jpg
        if public_assets_dir:
            fallback = public_assets_dir / f"{scenario_id}.jpg"
            if fallback.exists():
                return fallback
        return Path(f"public/lingbot-cases/{scenario_id}.jpg")

    # If it's a URL, download and return as numpy
    if src.startswith("http://") or src.startswith("https://"):
        try:
            response = requests.get(src, timeout=10)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content)).convert("RGB")
            return np.array(img, dtype=np.uint8)
        except Exception as e:
            print(f"Warning: Failed to download image from {src}: {e}")
            return Path(src)

    # If it's a local path, resolve it
    if public_assets_dir:
        local_path = public_assets_dir / src.split("/")[-1]
        if local_path.exists():
            return local_path

    return Path(src)


def _build_input_sequence(json_data: dict[str, Any]) -> list[IntegrationInput]:
    """
    Build chronological input sequence from scenario.

    For now, returns empty list. Real implementation would:
    - Parse keyboard_inputs.tsv if provided
    - Convert event timings from JSON
    - Sequence control events chronologically
    """
    inputs: list[IntegrationInput] = []

    # Future: Parse events + keyboard_inputs.tsv
    # For MVP, scenarios run without explicit control inputs;
    # the model receives the composed prompt once at start.

    return inputs


def load_all_scenarios_from_dir(
    lingbot_cases_dir: Path,
    public_assets_dir: Optional[Path] = None,
) -> dict[str, IntegrationScenario]:
    """
    Load all .json scenario files from lib/lingbot-cases/.

    Args:
        lingbot_cases_dir: Path to lib/lingbot-cases/
        public_assets_dir: Path to public/lingbot-cases/ (for images)

    Returns:
        Dict mapping scenario_id → IntegrationScenario
    """
    scenarios = {}

    for json_file in lingbot_cases_dir.glob("*.json"):
        scenario_id = json_file.stem  # Remove .json extension

        try:
            with open(json_file, "r", encoding="utf-8") as f:
                json_data = json.load(f)

            scenario = load_scenario_from_json(
                json_data,
                scenario_id=scenario_id,
                public_assets_dir=public_assets_dir,
            )
            scenarios[scenario_id] = scenario
        except Exception as e:
            print(f"Warning: Failed to load scenario {scenario_id}: {e}")

    return scenarios
