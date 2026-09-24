import { NextResponse } from "next/server";
import { BulkJobManager } from "@/lib/v3/job-manager";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", message: "Job ID is required" },
        { status: 400 }
      );
    }

    if (jobId === "all") {
      const jobs = BulkJobManager.getAllJobs();
      return NextResponse.json({ ok: true, jobs });
    }

    const job = BulkJobManager.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { ok: false, error: "JOB_NOT_FOUND", message: `Không tìm thấy tiến trình với ID: ${jobId}` },
        { status: 404 }
      );
    }

    const percent = job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;

    return NextResponse.json({
      ok: true,
      job: {
        ...job,
        percent,
      },
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { ok: false, error: "GET_JOB_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
