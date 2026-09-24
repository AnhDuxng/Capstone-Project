import { BulkJobManager, BulkIssuanceJob } from "@/lib/v3/job-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId) {
    return new Response("Job ID is required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return;
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might have closed
        }
      };

      // 1. Subscribe to real-time updates from BulkJobManager
      const unsubscribe = BulkJobManager.subscribe(
        jobId,
        (job: BulkIssuanceJob) => {
          const percent =
            job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;
          sendEvent("progress", { ...job, percent });

          if (job.status === "completed" || job.status === "failed") {
            setTimeout(() => {
              if (!isClosed) {
                isClosed = true;
                unsubscribe();
                clearInterval(heartbeat);
                try {
                  controller.close();
                } catch {
                  // Controller might already be closed
                }
              }
            }, 500);
          }
        }
      );

      // 2. Initial state if job already exists
      const currentJob = BulkJobManager.getJob(jobId);
      if (currentJob) {
        const percent =
          currentJob.total > 0
            ? Math.round((currentJob.current / currentJob.total) * 100)
            : 0;
        sendEvent("init", { ...currentJob, percent });
      } else {
        sendEvent("waiting", {
          jobId,
          message: "Đang chờ tiến trình khởi động...",
        });
      }

      // 3. Heartbeat ping every 15s to keep SSE connection alive through proxies
      const heartbeat = setInterval(() => {
        if (!isClosed) {
          sendEvent("ping", { time: Date.now() });
        }
      }, 15000);

      // 4. Handle client abort/disconnect
      req.signal.addEventListener("abort", () => {
        isClosed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
