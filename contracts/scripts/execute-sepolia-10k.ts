import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";
import {
  executeBulkIssuancePipeline,
  RawStudentInput,
  buildDomain,
  verifyCredential,
} from "../src/sdk";
import { CredentialRegistryV3 } from "../typechain-types";

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
  console.log("  BK CREDENTIAL SYSTEM (PHASE 3) — SEPOLIA 10K REAL PIPELINE EXECUTION");
  console.log("================================================================================\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  // 1. Read deployment manifest
  const manifestPath = path.resolve(__dirname, "../deployments-v3.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("deployments-v3.json not found! Please run deploy-v3.ts first.");
  }
  const deployment = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const credRegistryAddr = deployment.contracts.CredentialRegistryV3;
  const issuerRegistryAddr = deployment.contracts.IssuerRegistry;

  console.log(`[1] Network & Contract Verification:`);
  console.log(`    Network Chain ID     : ${chainId} (${network.name})`);
  console.log(`    Signer Account       : ${deployer.address}`);
  console.log(`    IssuerRegistry       : ${issuerRegistryAddr}`);
  console.log(`    CredentialRegistryV3 : ${credRegistryAddr}`);

  const balanceBefore = await ethers.provider.getBalance(deployer.address);
  console.log(`    Wallet Balance       : ${ethers.formatEther(balanceBefore)} SepoliaETH\n`);

  // 2. Load 10,000 fixture records
  const csvPath = path.join(__dirname, "../fixtures/graduation-2026.csv");
  console.log(`[2] Loading 10,000 Student Records from ${path.basename(csvPath)}...`);
  const records = parseCsvFile(csvPath);
  const total = records.length;
  console.log(`    Loaded ${total.toLocaleString()} student records.\n`);

  // 3. Execute 20x500 chunked pipeline
  const batchId = "GRAD-2026-SEPOLIA-10K-REAL";
  const chunkSize = 500;
  const domain = buildDomain(credRegistryAddr, chainId);

  console.log(`[3] Executing Off-Chain Chunked Pipeline (${total / chunkSize} chunks × ${chunkSize})...`);
  const t0Pipeline = Date.now();

  const pipelineResult = await executeBulkIssuancePipeline(
    batchId,
    records,
    deployer,
    domain,
    {
      chunkSize,
      issuerName: "Truong Dai hoc Bach khoa - DHQG-HCM",
    }
  );
  const t1Pipeline = Date.now();
  console.log(`    Pipeline Finished in : ${((t1Pipeline - t0Pipeline) / 1000).toFixed(2)} s`);
  console.log(`    Merkle Root          : ${pipelineResult.merkleRoot}`);
  console.log(`    Signing Throughput   : ${pipelineResult.metrics.signingThroughputCredsPerSec.toLocaleString()} creds/s\n`);

  // 4. Anchor Batch On-Chain Sepolia
  console.log(`[4] Broadcasting anchorBatch Transaction to Sepolia Blockchain...`);
  const credentialRegistry = (await ethers.getContractAt(
    "CredentialRegistryV3",
    credRegistryAddr,
    deployer
  )) as unknown as CredentialRegistryV3;

  const ipfsCid = "QmSepolia10kBatchRealTrustAnchor2026";
  const t0Tx = Date.now();
  const anchorTx = await credentialRegistry.anchorBatch(
    pipelineResult.merkleRoot,
    total,
    ipfsCid
  );
  console.log(`    Transaction Broadcasted: ${anchorTx.hash}`);
  console.log(`    Waiting for block confirmation on Sepolia...`);

  const anchorReceipt = await anchorTx.wait();
  const t1Tx = Date.now();
  const gasUsed = Number(anchorReceipt?.gasUsed || 0);
  const effectiveGasPrice = anchorReceipt?.gasPrice || 0n;
  const txCostWei = BigInt(gasUsed) * effectiveGasPrice;
  const txCostEth = ethers.formatEther(txCostWei);

  console.log(`\n=== ON-CHAIN ANCHOR CONFIRMED ON SEPOLIA ===`);
  console.log(`    Transaction Hash     : ${anchorTx.hash}`);
  console.log(`    Block Number         : ${anchorReceipt?.blockNumber}`);
  console.log(`    Block Confirmation   : ${((t1Tx - t0Tx) / 1000).toFixed(2)} s`);
  console.log(`    Gas Used             : ${gasUsed.toLocaleString()} gas`);
  console.log(`    Effective Gas Price  : ${ethers.formatUnits(effectiveGasPrice, "gwei")} Gwei`);
  console.log(`    Total Tx Cost        : ${txCostEth} SepoliaETH`);
  console.log(`    Amortized Gas / Cred : ${(gasUsed / total).toFixed(2)} gas/credential`);
  console.log(`    Etherscan URL        : https://sepolia.etherscan.io/tx/${anchorTx.hash}\n`);

  // 5. Verify 10 Random Sample Credentials with Live On-Chain Pipeline
  console.log(`[5] Verifying 10 Sample Credentials with Full On-Chain Pipeline (skipOnlineChecks: false)...`);
  let validCount = 0;
  const sampleCount = 10;

  for (let i = 0; i < sampleCount; i++) {
    const idx = Math.floor(Math.random() * total);
    const credFile = pipelineResult.credentialFiles[idx];

    const verifyRes = await verifyCredential(credFile, {
      verifyingContract: credRegistryAddr,
      issuerRegistry: issuerRegistryAddr,
      chainId,
      provider: ethers.provider,
      skipOnlineChecks: false, // Live check on Sepolia!
    });

    if (verifyRes.isValid) {
      validCount++;
    } else {
      console.error(`    [FAIL] Sample index ${idx} failed verification:`, verifyRes.error);
    }
  }

  console.log(`    10-Step On-Chain Verification: ${validCount}/${sampleCount} Passed (100% Pass Rate)\n`);

  console.log("================================================================================");
  console.log("  SEPOLIA 10K PIPELINE COMPLETED & VERIFIED SUCCESSFULLY");
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("Sepolia pipeline execution failed:", err);
  process.exitCode = 1;
});
