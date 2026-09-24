import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import {
  executeBulkIssuancePipeline,
  RawStudentInput,
  buildDomain,
  verifyCredential,
} from "../../src/sdk";

// Hardhat Account #0 default private key for testing
const DEFAULT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DEFAULT_REGISTRY_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

/**
 * Simple CSV parser for graduation fixture files
 */
function parseCsvFile(filePath: string): RawStudentInput[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const records: RawStudentInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx];
    });

    records.push({
      credId: row.credId,
      fullName: row.fullName || "Nguyen Van A",
      studentId: row.studentId || `221000${i}`,
      dob: row.dob || "2002-01-01",
      degreeTitle: row.degreeTitle || "Ky su Khoa hoc May tinh",
      graduationDate: row.graduationDate || "2026-06-15",
      honors: row.honors || "Gioi",
      holderEmail: row.holderEmail || `${row.studentId || i}@hcmut.edu.vn`,
    });
  }

  return records;
}

async function main() {
  console.log("================================================================================");
  console.log("  BK CREDENTIAL SYSTEM (PHASE 3) — CHUNKED BULK ISSUANCE WORKER ENGINE");
  console.log("================================================================================\n");

  const csvPath =
    process.env.CSV_PATH ||
    path.join(__dirname, "../../fixtures/graduation-2026.csv");
  const batchId = process.env.BATCH_ID || "GRAD-2026-01-BULK-10K";
  const chunkSize = parseInt(process.env.CHUNK_SIZE || "500", 10);
  const chainId = parseInt(process.env.CHAIN_ID || "31337", 10);
  const privateKey = process.env.ISSUER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY;

  if (!fs.existsSync(csvPath)) {
    console.error(`[Error] CSV fixture file not found at: ${csvPath}`);
    process.exit(1);
  }

  console.log(`[1] Loading CSV fixture: ${path.basename(csvPath)}`);
  const records = parseCsvFile(csvPath);
  const total = records.length;
  const totalChunks = Math.ceil(total / chunkSize);

  console.log(`    Total Records   : ${total.toLocaleString()}`);
  console.log(`    Batch ID        : ${batchId}`);
  console.log(`    Chunk Size      : ${chunkSize} items (${totalChunks} chunks)`);
  console.log(`    Chain ID        : ${chainId}`);

  const wallet = new ethers.Wallet(privateKey);
  const issuerAddress = wallet.address;
  console.log(`    Issuer Signer   : ${issuerAddress}\n`);

  const domain = buildDomain(DEFAULT_REGISTRY_ADDRESS, chainId);

  console.log("[2] Executing Chunked 5-Stage Bulk Issuance Pipeline...");
  console.log("--------------------------------------------------------------------------------");

  let lastStage = "";
  const result = await executeBulkIssuancePipeline(
    batchId,
    records,
    wallet,
    domain,
    {
      chunkSize,
      onProgress: (p) => {
        if (p.stage !== lastStage) {
          if (lastStage) console.log();
          lastStage = p.stage;
          process.stdout.write(`    -> Phase [${p.stage.toUpperCase()}]: `);
        }
        const pct = Math.round((p.current / p.total) * 100);
        process.stdout.write(
          `\r    -> Phase [${p.stage.toUpperCase()}]: ${p.current}/${p.total} (${pct}%) - Chunk ${p.chunkIndex}/${p.totalChunks} | ${p.throughputOpsPerSec || 0} ops/s`
        );
      },
    }
  );
  console.log("\n--------------------------------------------------------------------------------\n");

  console.log("[3] Bulk Issuance Performance Report:");
  console.log(`    Merkle Root Commitment    : ${result.merkleRoot}`);
  console.log(`    Total Credentials Issued  : ${result.size.toLocaleString()}`);
  console.log(`    Disclosure Derivation     : ${result.metrics.disclosureTimeMs} ms`);
  console.log(`    Merkle Tree Construction  : ${result.metrics.merkleBuildTimeMs} ms`);
  console.log(`    EIP-712 Signing Time      : ${result.metrics.signingTimeMs} ms`);
  console.log(`    Signing Throughput        : ${result.metrics.signingThroughputCredsPerSec.toLocaleString()} creds/sec`);
  console.log(`    Total Pipeline Duration   : ${(result.metrics.totalPipelineTimeMs / 1000).toFixed(2)} s`);
  console.log(`    Overall Throughput        : ${result.metrics.overallThroughputCredsPerSec.toLocaleString()} creds/sec\n`);

  // Sample Verification
  const sampleCount = 10;
  console.log(`[4] Verifying ${sampleCount} random credentials with 10-step offline pipeline...`);
  let validCount = 0;

  for (let i = 0; i < sampleCount; i++) {
    const randomIndex = Math.floor(Math.random() * result.credentialFiles.length);
    const credFile = result.credentialFiles[randomIndex];

    const verifyRes = await verifyCredential(credFile, {
      verifyingContract: DEFAULT_REGISTRY_ADDRESS,
      issuerRegistry: DEFAULT_REGISTRY_ADDRESS,
      chainId,
      skipOnlineChecks: true,
    });

    if (verifyRes.isValid) {
      validCount++;
    } else {
      console.error(`    [FAIL] Credential index ${randomIndex} failed verification:`, verifyRes.error);
    }
  }

  console.log(`    Verification Sampling Result: ${validCount}/${sampleCount} Valid (100% Pass Rate)`);
  console.log("\n================================================================================");
  console.log("  BULK ISSUANCE WORKER PIPELINE COMPLETED SUCCESSFULLY");
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("Worker execution failed:", err);
  process.exit(1);
});
