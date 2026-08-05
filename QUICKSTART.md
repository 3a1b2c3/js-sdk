# FlashDreams Integration API + Scenario Editor - Quick Start

## 5-Minute Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git

### 1. Install Python Dependencies (30 seconds)

```bash
cd /c/workspace/world/REACTOR_js-sdk/coworker

# Create virtual environment
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate

# Install packages
pip install numpy pillow requests pytest pytest-cov
```

### 2. Run Your First Scenario (CLI)

```bash
# List available scenarios
python -m lingbot_integration.cli --help

# Run a scenario
python -m lingbot_integration.cli \
  --scenario farmer-01 \
  --output-dir /tmp/results \
  --verbose

# Check results
ls -la /tmp/results/farmer-01/
cat /tmp/results/farmer-01/manifest.json
```

### 3. Run Tests (60 seconds)

```bash
# Unit tests
pytest tests/test_scenario_types.py -v

# E2E tests
pytest tests/test_lingbot_integration_e2e.py -v

# All tests with coverage
pytest tests/ -v --cov=lingbot_integration
```

### 4. Launch Scenario Editor (optional, requires Next.js)

```bash
cd ../examples/lingbot-world-2

# Install dependencies
npm install

# Start dev server
npm run dev

# Open browser: http://localhost:3000/scenario-editor
```

---

## Common Tasks

### Load and Run a Scenario Programmatically

```python
from pathlib import Path
from lingbot_integration.loader import load_all_scenarios_from_dir
from lingbot_integration.runner import run_integration_scenario
from lingbot_integration.scenario import IntegrationSpec

# Load all scenarios
scenarios = load_all_scenarios_from_dir(Path("lib/lingbot-cases"))

# Create spec
spec = IntegrationSpec(
    spec_id="lingbot-world-camera-control",
    display_name="LingBot World 2",
    description="Camera-controlled interactive world",
    input_schema={},
    output_schema={},
)

# Run scenario
result = run_integration_scenario(
    scenarios["farmer-01"],
    spec,
    output_dir=Path("outputs"),
)

# Inspect results
print(f"Success: {result.success}")
print(f"Chunks: {result.num_chunks}")
print(f"Frames: {result.num_frames}")
print(f"FPS: {result.metrics_summary['fps']:.2f}")

# Read metrics
with open(result.artifacts["metrics"]) as f:
    for line in f:
        print(line.rstrip())
```

### Validate a Scenario

```python
from lingbot_integration.scenario import IntegrationSpec
import json

spec = IntegrationSpec(
    spec_id="lingbot-world-camera-control",
    display_name="LingBot World 2",
    description="...",
    input_schema={},
    output_schema={},
)

# Load scenario JSON
with open("lib/lingbot-cases/farmer.json") as f:
    json_data = json.load(f)

# Check for errors
errors = spec.validate_scenario(json_data)

if errors:
    for err in errors:
        print(f"❌ {err['field']}: {err['message']}")
else:
    print("✅ Scenario is valid")
```

### Run Scenario Editor Tests

```bash
cd examples/lingbot-world-2

# E2E tests (requires Playwright or similar)
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## File Locations

| Component | Location |
|-----------|----------|
| Core API | `coworker/lingbot_integration/` |
| Tests | `coworker/tests/` |
| Editor UI | `examples/lingbot-world-2/app/scenario-editor/` |
| API Routes | `examples/lingbot-world-2/app/api/scenario/` |
| Scenarios | `lib/lingbot-cases/` |
| Scenario Assets | `examples/lingbot-world-2/public/lingbot-cases/` |

---

## Troubleshooting

### "Module not found: lingbot_integration"
```bash
# Make sure you're in the coworker directory
cd coworker

# And the module is in PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python -m lingbot_integration.cli --help
```

### "No module named 'PIL'" or "numpy"
```bash
# Install missing dependencies
pip install numpy pillow requests
```

### Scenario file not found
```bash
# Check file exists
ls lib/lingbot-cases/farmer.json

# Verify the scenario ID matches filename (without .json)
ls lib/lingbot-cases/ | grep -E "\.json$"
```

### Editor UI not loading
```bash
# Make sure Next.js dev server is running
cd examples/lingbot-world-2
npm run dev

# Check port 3000 is accessible
curl http://localhost:3000/scenario-editor
```

---

## Next: Deep Dive

- **Full Documentation**: See [coworker/lingbot_integration/README.md](coworker/lingbot_integration/README.md)
- **Implementation Details**: See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Architecture Design**: See [ROADMAP.md](ROADMAP.md)
- **Integration Proposal**: See [FlashDreams Standard Integration API Proposal](#)

---

## Support

**Questions?**
1. Check this quick-start guide
2. Read the full [README.md](coworker/lingbot_integration/README.md)
3. Review test examples in `coworker/tests/`
4. Open an issue on GitHub

**Want to contribute?**
- Add support for real model integration
- Implement video output (MP4 encoding)
- Add more test scenarios
- Improve documentation

---

**Happy scenario testing! 🚀**
