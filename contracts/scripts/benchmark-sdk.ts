/**
 * Performance Benchmark & Stress Test Suite for EIP-712 SDK (Tuần 3 Ngày 6–7)
 *
 * Measures throughput & execution time for:
 * 1. Selective Disclosure Commitment Generation (10,000 items)
 * 2. Merkle Tree Construction (1,000 & 10,000 items)
 * 3. EIP-712 Signing (1,000 & 10,000 credentials)
 * 4. 10-Step Verification Pipeline (1,000 & 10,000 credentials)
 */

import { ethers } from "ethers";
import {
  buildDomain,
  signCredential,
  verifyCredential,
  createDisclosure,
  buildBatchTree,
  BkCredentialPayload,
  CredentialFile,
} from "../src/sdk";

async function runBenchmark() {
  console.log("=================================================");
  console.log("🚀 EIP-712 SDK PERFORMANCE BENCHMARK & STRESS TEST");
  console.log("=================================================\n");

  const wallet = ethers.Wallet.createRandom();
  const contractAddr = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
  const domain = buildDomain(contractAddr, 31337);

  // ── 1. Benchmark Selective Disclosure (10,000 items) ───────
  console.log("1️⃣  Benchmarking Selective Disclosure Commitment Generation (10,000 items)...");
  const startDisc = Date.now();
  const disclosuresList: any[] = [];
  const privateClaimsList: string[] = [];

  for (let i = 0; i < 10000; i++) {
    const res = createDisclosure("studentId", `2026${i.toString().padStart(5, "0")}`);
    disclosuresList.push(res.disclosure);
    privateClaimsList.push(res.commitment);
  }
  const discTimeMs = Date.now() - startDisc;
  const discThroughput = (10000 / (discTimeMs / 1000)).toFixed(0);
  console.log(`   ⏱️  Total Time: ${discTimeMs} ms | Throughput: ${discThroughput} ops/sec\n`);

  // ── 2. Benchmark Merkle Tree Construction ─────────────────
  console.log("2️⃣  Benchmarking Merkle Tree Construction...");

  const generateBatch = (count: number): BkCredentialPayload[] => {
    const batch: BkCredentialPayload[] = [];
    for (let i = 0; i < count; i++) {
      batch.push({
        credId: `urn:uuid:${(10000000 + i).toString().padStart(8, "0")}-0000-0000-0000-000000000000`,
        issuedAt: 1750000000,
        batchId: "BENCHMARK-BATCH",
        publicClaims: {
          vct: "BKISC_DEGREE",
          degreeTitle: "Kỹ sư Khoa học Máy tính",
          graduationDate: "2026-06-15",
          honors: "Giỏi",
        },
        privateClaims: [privateClaimsList[i]],
        merkleRoot: "0x" + "00".repeat(32),
      });
    }
    return batch;
  };

  // 1,000 batch tree
  const batch1k = generateBatch(1000);
  const startTree1k = Date.now();
  const tree1kResult = buildBatchTree(batch1k);
  const tree1kTime = Date.now() - startTree1k;
  console.log(`   • 1,000 Batch Merkle Tree: ${tree1kTime} ms (Root: ${tree1kResult.root.substring(0, 18)}...)`);

  // 10,000 batch tree
  const batch10k = generateBatch(10000);
  const startTree10k = Date.now();
  const tree10kResult = buildBatchTree(batch10k);
  const tree10kTime = Date.now() - startTree10k;
  console.log(`   • 10,000 Batch Merkle Tree: ${tree10kTime} ms (Root: ${tree10kResult.root.substring(0, 18)}...)\n`);

  // ── 3. Benchmark EIP-712 Signing ───────────────────────────
  console.log("3️⃣  Benchmarking EIP-712 Credential Signing (1,000 credentials)...");
  const credentialFiles1k: CredentialFile[] = [];
  const startSign1k = Date.now();

  for (let i = 0; i < 1000; i++) {
    const credPayload = batch1k[i];
    credPayload.merkleRoot = tree1kResult.root;

    const signature = await signCredential(credPayload, wallet, domain);
    const proofData = tree1kResult.proofsMap.get(credPayload.credId)!;

    credentialFiles1k.push({
      "@context": "https://bkcred.xyz/v3",
      type: "BkCredential",
      credId: credPayload.credId,
      issuedAt: Number(credPayload.issuedAt),
      batchId: credPayload.batchId,
      issuer: {
        name: "Trường Đại học Bách Khoa — ĐHQG-HCM",
        did: "did:ethr:sepolia:" + wallet.address,
        signer: wallet.address,
      },
      publicClaims: credPayload.publicClaims,
      privateClaims: credPayload.privateClaims,
      merkle: proofData,
      signature,
      disclosures: [disclosuresList[i]],
    });
  }

  const sign1kTime = Date.now() - startSign1k;
  const signThroughput = (1000 / (sign1kTime / 1000)).toFixed(0);
  console.log(`   ⏱️  Sign 1,000 credentials: ${sign1kTime} ms | Throughput: ${signThroughput} creds/sec\n`);

  // ── 4. Benchmark Verification Pipeline (Offline Mode) ──────
  console.log("4️⃣  Benchmarking Offline 10-Step Verification Pipeline (1,000 credentials)...");
  const opts = {
    verifyingContract: contractAddr,
    issuerRegistry: "0x1111111111111111111111111111111111111111",
    chainId: 31337,
    skipOnlineChecks: true,
  };

  const startVerify1k = Date.now();
  let passCount = 0;

  for (let i = 0; i < 1000; i++) {
    const res = await verifyCredential(credentialFiles1k[i], opts);
    if (res.isValid) passCount++;
  }

  const verify1kTime = Date.now() - startVerify1k;
  const verifyThroughput = (1000 / (verify1kTime / 1000)).toFixed(0);
  console.log(`   ⏱️  Verify 1,000 credentials: ${verify1kTime} ms | Pass: ${passCount}/1000 | Throughput: ${verifyThroughput} verifications/sec\n`);

  console.log("=================================================");
  console.log("✅ SDK BENCHMARK COMPLETED SUCCESSFULLY");
  console.log("=================================================");
}

// Run benchmark if executed directly
if (require.main === module) {
  runBenchmark().catch((err) => {
    console.error("Benchmark error:", err);
    process.exit(1);
  });
}
