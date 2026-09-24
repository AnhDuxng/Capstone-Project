import { ethers } from "ethers";
import * as crypto from "crypto";
import {
  BkCredentialPayload,
  CredentialFile,
  Disclosure,
  EIP712Domain,
} from "./domain";
import { createDisclosure } from "./disclosure";
import { buildBatchTree, BatchTreeResult } from "./merkle";
import { signCredential } from "./signer";

export interface RawStudentInput {
  fullName: string;
  dob: string;
  studentId: string;
  degreeTitle: string;
  graduationDate: string;
  honors?: string;
  holderEmail?: string;
  credId?: string;
}

export interface ChunkProgressCallback {
  (progress: {
    stage: "disclosures" | "merkle_tree" | "signing" | "completed";
    current: number;
    total: number;
    chunkIndex: number;
    totalChunks: number;
    elapsedMs: number;
    throughputOpsPerSec?: number;
  }): void;
}

export interface BulkEngineOptions {
  chunkSize?: number;
  onProgress?: ChunkProgressCallback;
  issuerName?: string;
}

export interface BulkPipelineResult {
  batchId: string;
  merkleRoot: string;
  size: number;
  issuerAddress: string;
  credentialFiles: CredentialFile[];
  batchTree: BatchTreeResult;
  metrics: {
    disclosureTimeMs: number;
    merkleBuildTimeMs: number;
    signingTimeMs: number;
    totalPipelineTimeMs: number;
    signingThroughputCredsPerSec: number;
    overallThroughputCredsPerSec: number;
  };
}

/**
 * Utility function to partition an array into smaller chunks
 */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * High-performance chunked bulk issuance engine (Phase 3).
 *
 * Implements the 20x500 chunking architecture designed in Week 5 Day 2
 * to efficiently scale up to 10,000+ credentials without memory saturation.
 */
export async function executeBulkIssuancePipeline(
  batchId: string,
  records: RawStudentInput[],
  walletOrSigner: ethers.Signer,
  domain: EIP712Domain,
  options: BulkEngineOptions = {}
): Promise<BulkPipelineResult> {
  const startTime = Date.now();
  const chunkSize = options.chunkSize || 500;
  const onProgress = options.onProgress;
  const issuerAddress = await walletOrSigner.getAddress();
  const issuerName = options.issuerName || "Trường Đại học Bách khoa - ĐHQG-HCM";

  const total = records.length;
  const chunks = chunkArray(records, chunkSize);
  const totalChunks = chunks.length;

  // ─────────────────────────────────────────────────────────────
  // STAGE 1: Chunked Disclosures & Payloads Preparation
  // ─────────────────────────────────────────────────────────────
  const stage1Start = Date.now();
  const payloads: BkCredentialPayload[] = [];
  const disclosuresMap = new Map<string, Disclosure[]>();

  for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
    const chunk = chunks[cIdx];
    for (const row of chunk) {
      const credId = row.credId || `urn:uuid:${crypto.randomUUID()}`;

      // Generate salted disclosures for private claims (fullName, dob, studentId)
      const nameDisc = createDisclosure("fullName", row.fullName);
      const dobDisc = createDisclosure("dob", row.dob);
      const idDisc = createDisclosure("studentId", row.studentId);

      const disclosures: Disclosure[] = [
        nameDisc.disclosure,
        dobDisc.disclosure,
        idDisc.disclosure,
      ];
      disclosuresMap.set(credId, disclosures);

      const privateClaims = [
        nameDisc.commitment,
        dobDisc.commitment,
        idDisc.commitment,
      ];

      payloads.push({
        credId,
        issuedAt: Math.floor(Date.now() / 1000),
        batchId,
        publicClaims: {
          vct: "BKISC_DEGREE",
          degreeTitle: row.degreeTitle,
          graduationDate: row.graduationDate,
          honors: row.honors || "",
        },
        privateClaims,
        merkleRoot: "", // Will be filled after Merkle construction
      });
    }

    if (onProgress) {
      const currentProcessed = payloads.length;
      const elapsed = Date.now() - stage1Start;
      onProgress({
        stage: "disclosures",
        current: currentProcessed,
        total,
        chunkIndex: cIdx + 1,
        totalChunks,
        elapsedMs: elapsed,
        throughputOpsPerSec:
          elapsed > 0 ? Math.round((currentProcessed * 1000) / elapsed) : 0,
      });
    }
  }
  const disclosureTimeMs = Date.now() - stage1Start;

  // ─────────────────────────────────────────────────────────────
  // STAGE 2: Global Merkle Tree Construction (O(n))
  // ─────────────────────────────────────────────────────────────
  const stage2Start = Date.now();
  const batchTree = buildBatchTree(payloads);
  const root = batchTree.root;

  // Populate Merkle root across all payloads
  for (const payload of payloads) {
    payload.merkleRoot = root;
  }
  const merkleBuildTimeMs = Date.now() - stage2Start;

  if (onProgress) {
    onProgress({
      stage: "merkle_tree",
      current: total,
      total,
      chunkIndex: totalChunks,
      totalChunks,
      elapsedMs: merkleBuildTimeMs,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 3: Chunked EIP-712 Signing Pipeline
  // ─────────────────────────────────────────────────────────────
  const stage3Start = Date.now();
  const credentialFiles: CredentialFile[] = [];
  const payloadChunks = chunkArray(payloads, chunkSize);

  for (let cIdx = 0; cIdx < payloadChunks.length; cIdx++) {
    const chunk = payloadChunks[cIdx];

    // Sign items within the chunk
    for (const payload of chunk) {
      const sig = await signCredential(payload, walletOrSigner, domain);
      const proofData = batchTree.proofsMap.get(payload.credId);

      if (!proofData) {
        throw new Error(
          `Merkle proof not found for credential UUID: ${payload.credId}`
        );
      }

      credentialFiles.push({
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: "BkCredential",
        credId: payload.credId,
        issuedAt: Number(payload.issuedAt),
        batchId,
        issuer: {
          name: issuerName,
          did: `did:ethr:${issuerAddress}`,
          signer: issuerAddress,
        },
        publicClaims: payload.publicClaims,
        privateClaims: payload.privateClaims,
        merkle: proofData,
        signature: sig,
        disclosures: disclosuresMap.get(payload.credId),
      });
    }

    if (onProgress) {
      const currentSigned = credentialFiles.length;
      const elapsed = Date.now() - stage3Start;
      onProgress({
        stage: "signing",
        current: currentSigned,
        total,
        chunkIndex: cIdx + 1,
        totalChunks,
        elapsedMs: elapsed,
        throughputOpsPerSec:
          elapsed > 0 ? Math.round((currentSigned * 1000) / elapsed) : 0,
      });
    }
  }
  const signingTimeMs = Date.now() - stage3Start;
  const totalPipelineTimeMs = Date.now() - startTime;

  const signingThroughputCredsPerSec =
    signingTimeMs > 0 ? Math.round((total * 1000) / signingTimeMs) : 0;
  const overallThroughputCredsPerSec =
    totalPipelineTimeMs > 0
      ? Math.round((total * 1000) / totalPipelineTimeMs)
      : 0;

  if (onProgress) {
    onProgress({
      stage: "completed",
      current: total,
      total,
      chunkIndex: totalChunks,
      totalChunks,
      elapsedMs: totalPipelineTimeMs,
      throughputOpsPerSec: overallThroughputCredsPerSec,
    });
  }

  return {
    batchId,
    merkleRoot: root,
    size: total,
    issuerAddress,
    credentialFiles,
    batchTree,
    metrics: {
      disclosureTimeMs,
      merkleBuildTimeMs,
      signingTimeMs,
      totalPipelineTimeMs,
      signingThroughputCredsPerSec,
      overallThroughputCredsPerSec,
    },
  };
}
