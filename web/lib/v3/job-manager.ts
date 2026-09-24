export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type JobStage =
  | "queued"
  | "disclosures"
  | "merkle_tree"
  | "signing"
  | "db_insert"
  | "anchoring"
  | "completed";

export interface JobProgressUpdate {
  stage?: JobStage;
  current?: number;
  total?: number;
  chunkIndex?: number;
  totalChunks?: number;
  message?: string;
  throughputOpsPerSec?: number;
  metrics?: Record<string, unknown>;
  merkleRoot?: string;
  ipfsCid?: string;
  size?: number;
}

export interface BulkIssuanceJob {
  jobId: string;
  batchId: string;
  status: JobStatus;
  stage: JobStage;
  total: number;
  current: number;
  chunkIndex: number;
  totalChunks: number;
  message: string;
  throughputOpsPerSec: number;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  merkleRoot?: string;
  ipfsCid?: string;
  size?: number;
  error?: string;
  metrics?: Record<string, unknown>;
}

export type JobSubscriber = (job: BulkIssuanceJob) => void;

// Global in-memory job store on globalThis (persists across Next.js API route chunks in dev)
const globalForJobs = globalThis as unknown as {
  bulkJobStore?: Map<string, BulkIssuanceJob>;
  bulkSubscribers?: Map<string, Set<JobSubscriber>>;
};

const globalJobStore = globalForJobs.bulkJobStore ?? new Map<string, BulkIssuanceJob>();
const globalSubscribers = globalForJobs.bulkSubscribers ?? new Map<string, Set<JobSubscriber>>();

if (process.env.NODE_ENV !== "production") {
  globalForJobs.bulkJobStore = globalJobStore;
  globalForJobs.bulkSubscribers = globalSubscribers;
}

/**
 * Job Manager for Asynchronous Bulk Issuance & SSE Progress Streaming (Week 5 Day 2 & 3)
 */
export class BulkJobManager {
  /**
   * Subscribe to real-time progress events for a given job
   */
  static subscribe(jobId: string, callback: JobSubscriber): () => void {
    if (!globalSubscribers.has(jobId)) {
      globalSubscribers.set(jobId, new Set());
    }
    const subs = globalSubscribers.get(jobId)!;
    subs.add(callback);

    // Immediately emit current state if job already exists
    const currentJob = globalJobStore.get(jobId);
    if (currentJob) {
      try {
        callback(currentJob);
      } catch (err) {
        console.error(`Error notifying initial subscriber for job ${jobId}:`, err);
      }
    }

    // Return un-subscription function
    return () => {
      subs.delete(callback);
      if (subs.size === 0) {
        globalSubscribers.delete(jobId);
      }
    };
  }

  /**
   * Notify all active subscribers of a job
   */
  private static notifySubscribers(jobId: string, job: BulkIssuanceJob) {
    const subs = globalSubscribers.get(jobId);
    if (!subs) return;
    for (const callback of subs) {
      try {
        callback(job);
      } catch (err) {
        console.error(`Error notifying subscriber for job ${jobId}:`, err);
      }
    }
  }

  /**
   * Create and register a new bulk issuance job
   */
  static createJob(
    jobId: string,
    batchId: string,
    total: number,
    totalChunks: number = 20
  ): BulkIssuanceJob {
    const job: BulkIssuanceJob = {
      jobId,
      batchId,
      status: "pending",
      stage: "queued",
      total,
      current: 0,
      chunkIndex: 0,
      totalChunks,
      message: `Đang chuẩn bị xử lý ${total} chứng chỉ (${totalChunks} chunks)`,
      throughputOpsPerSec: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    globalJobStore.set(jobId, job);
    this.notifySubscribers(jobId, job);
    return job;
  }

  /**
   * Update progress for an active job
   */
  static updateProgress(
    jobId: string,
    updates: JobProgressUpdate
  ): BulkIssuanceJob | null {
    const job = globalJobStore.get(jobId);
    if (!job) return null;

    job.status = "processing";
    if (updates.stage) job.stage = updates.stage;
    if (typeof updates.current === "number") job.current = updates.current;
    if (typeof updates.total === "number") job.total = updates.total;
    if (typeof updates.chunkIndex === "number") job.chunkIndex = updates.chunkIndex;
    if (typeof updates.totalChunks === "number") job.totalChunks = updates.totalChunks;
    if (updates.message) job.message = updates.message;
    if (typeof updates.throughputOpsPerSec === "number") {
      job.throughputOpsPerSec = updates.throughputOpsPerSec;
    }
    if (updates.merkleRoot) job.merkleRoot = updates.merkleRoot;
    if (updates.ipfsCid) job.ipfsCid = updates.ipfsCid;
    if (typeof updates.size === "number") job.size = updates.size;
    if (updates.metrics) job.metrics = { ...job.metrics, ...updates.metrics };

    job.updatedAt = Date.now();
    globalJobStore.set(jobId, job);
    this.notifySubscribers(jobId, job);
    return job;
  }

  /**
   * Mark job as successfully completed
   */
  static completeJob(
    jobId: string,
    result: {
      merkleRoot: string;
      size: number;
      ipfsCid?: string;
      metrics?: Record<string, unknown>;
    }
  ): BulkIssuanceJob | null {
    const job = globalJobStore.get(jobId);
    if (!job) return null;

    job.status = "completed";
    job.stage = "completed";
    job.current = job.total;
    job.chunkIndex = job.totalChunks;
    job.merkleRoot = result.merkleRoot;
    job.size = result.size;
    job.ipfsCid = result.ipfsCid;
    job.metrics = result.metrics;
    job.message = `Cấp phát hoàn tất thành công cho ${result.size} chứng chỉ!`;
    job.updatedAt = Date.now();
    job.completedAt = Date.now();

    globalJobStore.set(jobId, job);
    this.notifySubscribers(jobId, job);
    return job;
  }

  /**
   * Mark job as failed
   */
  static failJob(jobId: string, error: string): BulkIssuanceJob | null {
    const job = globalJobStore.get(jobId);
    if (!job) return null;

    job.status = "failed";
    job.error = error;
    job.message = `Quá trình cấp phát thất bại: ${error}`;
    job.updatedAt = Date.now();
    job.completedAt = Date.now();

    globalJobStore.set(jobId, job);
    this.notifySubscribers(jobId, job);
    return job;
  }

  /**
   * Get current job status
   */
  static getJob(jobId: string): BulkIssuanceJob | null {
    return globalJobStore.get(jobId) || null;
  }

  /**
   * Get all active and completed jobs
   */
  static getAllJobs(): BulkIssuanceJob[] {
    return Array.from(globalJobStore.values()).sort(
      (a, b) => b.startedAt - a.startedAt
    );
  }
}
