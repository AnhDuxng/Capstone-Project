import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { pinata } from "@/lib/pinata";
import { buildDomain } from "@/lib/sdk/domain";
import { executeBulkIssuancePipeline, RawStudentInput } from "@/lib/sdk/bulk";
import { BulkJobManager } from "@/lib/v3/job-manager";
import { CREDENTIAL_REGISTRY_V3_ADDRESS } from "@/lib/v3/contracts";

export const runtime = "nodejs";

// Fallback private key for local dev: Hardhat Account #0
const FALLBACK_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * Background execution function that processes chunks asynchronously
 */
async function runBackgroundWorker(
  jobId: string,
  batchId: string,
  credentials: RawStudentInput[],
  chainId: number,
  chunkSize: number
) {
  try {
    const privateKey = process.env.ISSUER_PRIVATE_KEY || FALLBACK_PRIVATE_KEY;
    const wallet = new ethers.Wallet(privateKey);
    const domain = buildDomain(CREDENTIAL_REGISTRY_V3_ADDRESS, chainId);

    const total = credentials.length;
    const totalChunks = Math.ceil(total / chunkSize);

    BulkJobManager.updateProgress(jobId, {
      stage: "disclosures",
      current: 0,
      total,
      chunkIndex: 0,
      totalChunks,
      message: `Starting chunked pipeline: ${totalChunks} chunks of ${chunkSize} items`,
    });

    // 1. Execute the chunked pipeline (Disclosures -> Merkle Tree -> EIP-712 Signing)
    const pipelineResult = await executeBulkIssuancePipeline(
      batchId,
      credentials,
      wallet,
      domain,
      {
        chunkSize,
        onProgress: (p) => {
          BulkJobManager.updateProgress(jobId, {
            stage: p.stage,
            current: p.current,
            total: p.total,
            chunkIndex: p.chunkIndex,
            totalChunks: p.totalChunks,
            throughputOpsPerSec: p.throughputOpsPerSec,
            message: `Stage ${p.stage}: processed ${p.current}/${p.total} (${p.chunkIndex}/${p.totalChunks} chunks)`,
          });
        },
      }
    );

    // 2. IPFS Metadata Upload (Optional)
    let ipfsCid = "QmDefaultFakeHashV3PendingSepoliaSetup";
    try {
      if (process.env.PINATA_JWT) {
        const metadata = {
          batchId,
          merkleRoot: pipelineResult.merkleRoot,
          size: pipelineResult.size,
          issuer: pipelineResult.issuerAddress,
          createdAt: new Date().toISOString(),
        };
        const uploadRes = await pinata.upload.public.json(metadata);
        ipfsCid = uploadRes.cid;
      }
    } catch (pinErr) {
      console.warn("IPFS upload warning:", pinErr);
    }

    // 3. High-Performance Chunked Database Insertions
    BulkJobManager.updateProgress(jobId, {
      stage: "db_insert",
      current: total,
      total,
      message: "Persisting batch and credentials to database...",
      merkleRoot: pipelineResult.merkleRoot,
      ipfsCid,
      size: total,
    });

    // 3.1 Create BatchV3
    await prisma.batchV3.create({
      data: {
        batchId,
        merkleRoot: pipelineResult.merkleRoot,
        size: pipelineResult.size,
        ipfsCid,
        issuerAddr: pipelineResult.issuerAddress,
        chainId,
      },
    });

    // 3.2 Chunked DB Insertion for Credentials & Disclosures (in batches of 500)
    const credFiles = pipelineResult.credentialFiles;
    const dbChunkSize = 500;

    for (let i = 0; i < credFiles.length; i += dbChunkSize) {
      const fileSlice = credFiles.slice(i, i + dbChunkSize);

      const credRows: Array<{
        id: string;
        credId: string;
        batchId: string;
        batchIndex: number;
        holderEmail: string;
        studentId: string;
        vct: string;
        degreeTitle: string;
        graduationDate: string;
        honors: string;
        signature: string;
        merkleLeaf: string;
        merkleProof: string[];
        privateClaims: string[];
        credentialJson: string;
      }> = [];

      const disclosureRows: Array<{
        id: string;
        credentialId: string;
        salt: string;
        key: string;
        value: string;
        commitment: string;
      }> = [];

      for (const file of fileSlice) {
        const credDbId = crypto.randomUUID();
        const rawRow = credentials[file.merkle.index] || {};
        credRows.push({
          id: credDbId,
          credId: file.credId,
          batchId,
          batchIndex: file.merkle.index,
          holderEmail: rawRow.holderEmail || "",
          studentId: rawRow.studentId || "",
          vct: file.publicClaims.vct,
          degreeTitle: file.publicClaims.degreeTitle,
          graduationDate: file.publicClaims.graduationDate,
          honors: file.publicClaims.honors || "",
          signature: file.signature,
          merkleLeaf: file.merkle.leaf,
          merkleProof: file.merkle.proof,
          privateClaims: file.privateClaims,
          credentialJson: JSON.stringify(file),
        });

        if (file.disclosures && file.disclosures.length > 0) {
          for (const d of file.disclosures) {
            const commitment = ethers.solidityPackedKeccak256(
              ["bytes32", "string", "string"],
              [d.salt, d.key, d.value]
            );
            disclosureRows.push({
              id: crypto.randomUUID(),
              credentialId: credDbId,
              salt: d.salt,
              key: d.key,
              value: d.value,
              commitment,
            });
          }
        }
      }

      await prisma.$transaction(
        async (tx) => {
          await tx.credentialV3.createMany({ data: credRows });
          if (disclosureRows.length > 0) {
            await tx.disclosureV3.createMany({ data: disclosureRows });
          }
        },
        {
          timeout: 30000,
          maxWait: 10000,
        }
      );
    }

    // 4. Mark Job as Completed
    BulkJobManager.completeJob(jobId, {
      merkleRoot: pipelineResult.merkleRoot,
      size: total,
      ipfsCid,
      metrics: pipelineResult.metrics,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Background worker job ${jobId} failed:`, error);
    BulkJobManager.failJob(jobId, error?.message || "Unknown worker error");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { batchId, credentials, chainId = 31337, chunkSize = 500 } = body;

    if (
      !batchId ||
      !credentials ||
      !Array.isArray(credentials) ||
      credentials.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "BAD_REQUEST",
          message: "Mã đợt và danh sách sinh viên không được để trống",
        },
        { status: 400 }
      );
    }

    // Check if batchId already exists
    const existingBatch = await prisma.batchV3.findUnique({
      where: { batchId },
    });
    if (existingBatch) {
      return NextResponse.json(
        {
          ok: false,
          error: "BATCH_EXISTS",
          message: `Đợt cấp với mã ${batchId} đã tồn tại trong hệ thống`,
        },
        { status: 400 }
      );
    }

    const total = credentials.length;
    const totalChunks = Math.ceil(total / chunkSize);
    const jobId = `job_${batchId}_${Date.now()}`;

    // Register job in JobManager
    const job = BulkJobManager.createJob(jobId, batchId, total, totalChunks);

    // Launch background worker without awaiting
    runBackgroundWorker(jobId, batchId, credentials, chainId, chunkSize);

    return NextResponse.json({
      ok: true,
      jobId,
      batchId,
      total,
      chunkSize,
      totalChunks,
      status: job.status,
      message: `Tiến trình cấp phát đợt lớn đã được khởi chạy trong nền (${total} chứng chỉ / ${totalChunks} chunks)`,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error initiating async bulk issuance:", err);
    return NextResponse.json(
      { ok: false, error: "ASYNC_BULK_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
