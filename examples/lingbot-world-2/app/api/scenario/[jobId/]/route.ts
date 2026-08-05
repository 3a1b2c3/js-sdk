/**
 * Poll test execution status
 *
 * GET /api/scenario/test/:jobId - Get status of running test
 */

import { NextRequest, NextResponse } from "next/server";

// Mock job storage (MVP only - would be persistent in production)
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

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;

  const job = testJobs.get(jobId);

  if (!job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    job_id: jobId,
    status: job.status,
    progress: job.progress,
    ...(job.status === "done" && {
      num_chunks: job.num_chunks,
      num_frames: job.num_frames,
      duration_s: job.duration_s,
      fps: job.fps,
    }),
    ...(job.status === "failed" && {
      error: job.error,
    }),
  });
}
