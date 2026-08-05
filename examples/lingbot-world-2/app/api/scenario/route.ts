/**
 * Scenario API endpoints
 *
 * POST /api/scenario/validate - Validate scenario against spec
 * POST /api/scenario/test - Run scenario through canonical loop
 * GET /api/specs - List available integration specs
 */

import { NextRequest, NextResponse } from "next/server";

// Mock spec for MVP
const LINGBOT_SPEC = {
  spec_id: "lingbot-world-camera-control",
  display_name: "LingBot World 2 with Camera Control",
  description: "Interactive camera-controlled LingBot World 2 scenario.",
  input_schema: {
    frame_size: { width: 720, height: 480 },
    fps: 16,
    supported_keys: ["w", "a", "s", "d", "c", "space", "1", "9"],
  },
  output_schema: {
    video: { shape: [480, 720, 3], fps: 16 },
    metrics: ["chunk_index", "latency_s", "memory_bytes"],
  },
};

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.includes("/validate")) {
    return handleValidate(request);
  }

  if (pathname.includes("/test")) {
    return handleTest(request);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.includes("/specs")) {
    return handleListSpecs();
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

async function handleValidate(request: NextRequest) {
  try {
    const scenario = await request.json();

    const errors: Array<{ field: string; message: string; severity: string }> =
      [];

    // Basic validation
    if (!scenario.scenario_id) {
      errors.push({
        field: "scenario_id",
        message: "Required",
        severity: "error",
      });
    }

    if (!scenario.name) {
      errors.push({
        field: "name",
        message: "Required",
        severity: "error",
      });
    }

    if (!scenario.first_frame_prompt) {
      errors.push({
        field: "first_frame_prompt",
        message: "Prompt cannot be empty",
        severity: "error",
      });
    }

    if (scenario.duration_s <= 0) {
      errors.push({
        field: "duration_s",
        message: "Must be positive",
        severity: "error",
      });
    }

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
}

// Track test jobs in memory (MVP only)
const testJobs = new Map<
  string,
  {
    status: string;
    progress: number;
    num_chunks?: number;
    num_frames?: number;
    duration_s?: number;
    fps?: number;
    error?: string;
  }
>();

async function handleTest(request: NextRequest) {
  try {
    const scenario = await request.json();
    const jobId = Math.random().toString(36).substr(2, 9);

    // Validate first
    const validationErrors: any[] = [];
    if (!scenario.scenario_id || !scenario.name || !scenario.first_frame_prompt) {
      validationErrors.push("Missing required fields");
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({
        job_id: jobId,
        status: "failed",
        error: "Validation failed",
      });
    }

    // Start job
    testJobs.set(jobId, {
      status: "running",
      progress: 0,
    });

    // Simulate async test (MVP: would call run_integration_scenario)
    setTimeout(() => {
      const chunks = Math.ceil(scenario.duration_s / 0.75);
      const frames = chunks * 3;
      const duration = chunks * 0.75;

      testJobs.set(jobId, {
        status: "done",
        progress: 100,
        num_chunks: chunks,
        num_frames: frames,
        duration_s: duration,
        fps: frames / duration,
      });
    }, 2000);

    return NextResponse.json({
      job_id: jobId,
      status: "running",
      progress: 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
}

function handleListSpecs() {
  return NextResponse.json({
    specs: [LINGBOT_SPEC],
  });
}
