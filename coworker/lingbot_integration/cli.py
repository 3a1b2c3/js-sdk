"""
CLI entry point for running scenarios headlessly.

Usage:
    python -m lingbot_integration.cli --scenario farmer-01 --output-dir outputs
"""

import argparse
import json
import sys
from pathlib import Path

from .loader import load_all_scenarios_from_dir
from .runner import run_integration_scenario
from .scenario import IntegrationSpec


def get_default_spec() -> IntegrationSpec:
    """Return the default LingBot World spec."""
    return IntegrationSpec(
        spec_id="lingbot-world-camera-control",
        display_name="LingBot World 2 with Camera Control",
        description="Interactive camera-controlled LingBot World 2 scenario.",
        input_schema={
            "frame_size": {"width": 720, "height": 480},
            "fps": 16,
            "supported_keys": ["w", "a", "s", "d", "c", "space", "1", "9"],
        },
        output_schema={
            "video": {"shape": [480, 720, 3], "fps": 16},
            "metrics": ["chunk_index", "latency_s", "memory_bytes"],
        },
    )


def main():
    """Parse args and run scenario."""
    parser = argparse.ArgumentParser(
        description="Run LingBot scenario headlessly"
    )
    parser.add_argument(
        "--scenario",
        type=str,
        required=True,
        help="Scenario ID (e.g., 'farmer-01')",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("outputs"),
        help="Output directory for artifacts",
    )
    parser.add_argument(
        "--lingbot-cases-dir",
        type=Path,
        default=Path(__file__).parent.parent.parent / "lib" / "lingbot-cases",
        help="Path to lib/lingbot-cases/",
    )
    parser.add_argument(
        "--public-assets-dir",
        type=Path,
        default=Path(__file__).parent.parent.parent / "examples" / "lingbot-world-2" / "public" / "lingbot-cases",
        help="Path to public/lingbot-cases/",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose output",
    )

    args = parser.parse_args()

    # Load scenarios
    if not args.lingbot_cases_dir.exists():
        print(f"Error: lingbot-cases directory not found: {args.lingbot_cases_dir}")
        sys.exit(1)

    scenarios = load_all_scenarios_from_dir(
        args.lingbot_cases_dir,
        args.public_assets_dir if args.public_assets_dir.exists() else None,
    )

    if args.scenario not in scenarios:
        print(f"Error: Scenario '{args.scenario}' not found")
        print(f"Available scenarios: {', '.join(sorted(scenarios.keys()))}")
        sys.exit(1)

    scenario = scenarios[args.scenario]
    spec = get_default_spec()

    if args.verbose:
        print(f"Running scenario: {scenario.name}")
        print(f"  ID: {scenario.scenario_id}")
        print(f"  Inputs: {scenario.num_inputs()}")
        print(f"  Duration: {scenario.duration_s}s")
        print(f"  Output: {args.output_dir}")

    # Run scenario
    result = run_integration_scenario(
        scenario,
        spec,
        output_dir=args.output_dir,
    )

    # Print result
    if result.success:
        print(f"✅ Success")
        print(f"  Chunks: {result.num_chunks}")
        print(f"  Frames: {result.num_frames}")
        print(f"  Time: {result.duration_s:.2f}s")
        print(f"  FPS: {result.metrics_summary.get('fps', 0):.2f}")
        print(f"  Manifest: {result.artifacts.get('manifest', 'N/A')}")
        sys.exit(0)
    else:
        print(f"❌ Failed")
        print(f"  Error: {result.error}")
        print(f"  Type: {result.error_type}")
        sys.exit(1)


if __name__ == "__main__":
    main()
