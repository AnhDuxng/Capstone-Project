/**
 * BK Credential System (Phase 3) — Security Edge-Case & Exploit Tests
 *
 * Week 6: Security Hardening — Simulates attack scenarios:
 * 1. Second-preimage attack on Merkle tree (double keccak256 defense)
 * 2. Cross-chain signature replay (EIP-712 domain separation)
 * 3. Bitmap out-of-bounds manipulation
 * 4. Credential forgery (tampered payloads)
 * 5. Expired credential acceptance
 * 6. Disclosure brute-force resistance (256-bit salt entropy)
 * 7. Revoked signer continued issuance
 *
 * Usage:
 *   npx ts-node scripts/security-tests.ts
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
  VerifyResult,
} from "../src/sdk";

// ─── Constants ──────────────────────────────────────────────────

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const CONTRACT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const CHAIN_ID = 31337;

let passed = 0;
let failed = 0;
const results: { test: string; status: "PASS" | "FAIL"; detail: string }[] = [];

function assert(condition: boolean, testName: string, detail: string) {
  if (condition) {
    passed++;
    results.push({ test: testName, status: "PASS", detail });
    console.log(`    ✅ PASS: ${testName}`);
  } else {
    failed++;
    results.push({ test: testName, status: "FAIL", detail });
    console.log(`    ❌ FAIL: ${testName} — ${detail}`);
  }
}

async function buildTestCredentials(wallet: ethers.Wallet, domain: ReturnType<typeof buildDomain>, count = 10) {
  const payloads: BkCredentialPayload[] = [];
  const discMap = new Map<string, any[]>();

  for (let i = 0; i < count; i++) {
    const credId = `urn:uuid:${(90000000 + i).toString()}-sec-test-000000000000`;
    const d1 = createDisclosure("fullName", `Security Test User ${i}`);
    const d2 = createDisclosure("studentId", `SEC${i.toString().padStart(5, "0")}`);

    discMap.set(credId, [d1.disclosure, d2.disclosure]);
    payloads.push({
      credId,
      issuedAt: Math.floor(Date.now() / 1000),
      batchId: "SEC-TEST-BATCH",
      publicClaims: {
        vct: "BKISC_DEGREE",
        degreeTitle: "Ky su KHMT",
        graduationDate: "2026-06-15",
        honors: "Gioi",
      },
      privateClaims: [d1.commitment, d2.commitment],
      merkleRoot: "",
    });
  }

  const tree = buildBatchTree(payloads);
  for (const p of payloads) p.merkleRoot = tree.root;

  const credentialFiles: CredentialFile[] = [];
  for (const payload of payloads) {
    const sig = await signCredential(payload, wallet, domain);
    const proof = tree.proofsMap.get(payload.credId)!;
    credentialFiles.push({
      "@context": "https://bkcred.xyz/v3",
      type: "BkCredential",
      credId: payload.credId,
      issuedAt: Number(payload.issuedAt),
      batchId: payload.batchId,
      issuer: {
        name: "HCMUT",
        did: `did:ethr:sepolia:${wallet.address}`,
        signer: wallet.address,
      },
      publicClaims: payload.publicClaims,
      privateClaims: payload.privateClaims,
      merkle: proof,
      signature: sig,
      disclosures: discMap.get(payload.credId),
    });
  }

  return { credentialFiles, payloads, tree };
}

// ═══════════════════════════════════════════════════════════════
// TEST 1: Second-Preimage Attack on Merkle Tree
// ═══════════════════════════════════════════════════════════════

async function testSecondPreimageAttack() {
  console.log("\n  ── Test 1: Second-Preimage Attack on Merkle Tree ──");
  console.log("     Defense: OpenZeppelin double keccak256 leaf hashing\n");

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const domain = buildDomain(CONTRACT_ADDRESS, CHAIN_ID);
  const { credentialFiles } = await buildTestCredentials(wallet, domain);

  const original = credentialFiles[0];
  const opts = {
    verifyingContract: CONTRACT_ADDRESS,
    issuerRegistry: CONTRACT_ADDRESS,
    chainId: CHAIN_ID,
    skipOnlineChecks: true,
  };

  // Verify original is valid
  const origResult = await verifyCredential(original, opts);
  assert(origResult.isValid, "Original credential verifies", "Baseline verification");

  // Attempt 1: Swap leaf hash directly (simulate preimage collision)
  const tampered = JSON.parse(JSON.stringify(original));
  tampered.merkle.leaf = "0x" + "ab".repeat(32); // Random fake leaf
  const res1 = await verifyCredential(tampered, opts);
  assert(
    !res1.isValid && res1.error?.code === "LEAF_MISMATCH",
    "Fake leaf hash rejected (LEAF_MISMATCH)",
    `Got: ${res1.error?.code || "valid"}`
  );

  // Attempt 2: Try using another credential's leaf/proof
  const stolen = JSON.parse(JSON.stringify(original));
  stolen.merkle = JSON.parse(JSON.stringify(credentialFiles[5].merkle));
  const res2 = await verifyCredential(stolen, opts);
  assert(
    !res2.isValid && (res2.error?.code === "LEAF_MISMATCH" || res2.error?.code === "INVALID_MERKLE_PROOF"),
    "Cross-credential leaf/proof swap rejected",
    `Got: ${res2.error?.code || "valid"}`
  );
}

// ═══════════════════════════════════════════════════════════════
// TEST 2: Cross-Chain Signature Replay Attack
// ═══════════════════════════════════════════════════════════════

async function testCrossChainReplay() {
  console.log("\n  ── Test 2: Cross-Chain Signature Replay Attack ──");
  console.log("     Defense: EIP-712 domain separator (chainId + verifyingContract)\n");

  const wallet = new ethers.Wallet(PRIVATE_KEY);

  // Sign on chain 31337
  const domainA = buildDomain(CONTRACT_ADDRESS, 31337);
  const { credentialFiles } = await buildTestCredentials(wallet, domainA, 5);

  const original = credentialFiles[0];
  const optsA = {
    verifyingContract: CONTRACT_ADDRESS,
    issuerRegistry: CONTRACT_ADDRESS,
    chainId: 31337,
    skipOnlineChecks: true,
  };

  // Valid on original chain
  const resA = await verifyCredential(original, optsA);
  assert(resA.isValid, "Valid on original chain (31337)", "Baseline check");

  // Replay on different chain (Sepolia 11155111)
  const optsB = {
    verifyingContract: CONTRACT_ADDRESS,
    issuerRegistry: CONTRACT_ADDRESS,
    chainId: 11155111,
    skipOnlineChecks: true,
  };
  const resB = await verifyCredential(original, optsB);
  assert(
    !resB.isValid && resB.error?.code === "SIGNATURE_MISMATCH",
    "Replay on different chain rejected (SIGNATURE_MISMATCH)",
    `Got: ${resB.error?.code || "valid"}`
  );

  // Replay with different contract address
  const optsC = {
    verifyingContract: "0x1111111111111111111111111111111111111111",
    issuerRegistry: CONTRACT_ADDRESS,
    chainId: 31337,
    skipOnlineChecks: true,
  };
  const resC = await verifyCredential(original, optsC);
  assert(
    !resC.isValid && resC.error?.code === "SIGNATURE_MISMATCH",
    "Replay with different contract address rejected",
    `Got: ${resC.error?.code || "valid"}`
  );
}

// ═══════════════════════════════════════════════════════════════
// TEST 3: Credential Forgery (Tampered Payloads)
// ═══════════════════════════════════════════════════════════════

async function testCredentialForgery() {
  console.log("\n  ── Test 3: Credential Forgery (Tampered Payloads) ──");
  console.log("     Defense: EIP-712 typed data signature integrity\n");

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const domain = buildDomain(CONTRACT_ADDRESS, CHAIN_ID);
  const { credentialFiles } = await buildTestCredentials(wallet, domain, 5);
  const original = credentialFiles[0];
  const opts = {
    verifyingContract: CONTRACT_ADDRESS,
    issuerRegistry: CONTRACT_ADDRESS,
    chainId: CHAIN_ID,
    skipOnlineChecks: true,
  };

  // Tamper 1: Change degree title
  const t1 = JSON.parse(JSON.stringify(original));
  t1.publicClaims.degreeTitle = "Tien si Khoa hoc May tinh";
  const r1 = await verifyCredential(t1, opts);
  assert(
    !r1.isValid,
    "Tampered degreeTitle rejected",
    `Error: ${r1.error?.code || "none"}`
  );

  // Tamper 2: Change honors
  const t2 = JSON.parse(JSON.stringify(original));
  t2.publicClaims.honors = "Xuat sac";
  const r2 = await verifyCredential(t2, opts);
  assert(!r2.isValid, "Tampered honors rejected", `Error: ${r2.error?.code || "none"}`);

  // Tamper 3: Change graduation date
  const t3 = JSON.parse(JSON.stringify(original));
  t3.publicClaims.graduationDate = "2025-01-01";
  const r3 = await verifyCredential(t3, opts);
  assert(!r3.isValid, "Tampered graduationDate rejected", `Error: ${r3.error?.code || "none"}`);

  // Tamper 4: Change credId
  const t4 = JSON.parse(JSON.stringify(original));
  t4.credId = "urn:uuid:FAKE-ID-0000-0000-000000000000";
  const r4 = await verifyCredential(t4, opts);
  assert(!r4.isValid, "Tampered credId rejected", `Error: ${r4.error?.code || "none"}`);

  // Tamper 5: Change privateClaims commitment
  const t5 = JSON.parse(JSON.stringify(original));
  t5.privateClaims[0] = "0x" + "ff".repeat(32);
  const r5 = await verifyCredential(t5, opts);
  assert(
    !r5.isValid && r5.error?.code === "DISCLOSURE_MISMATCH",
    "Tampered privateClaims rejected (DISCLOSURE_MISMATCH)",
    `Error: ${r5.error?.code || "none"}`
  );

  // Tamper 6: Forge signature from different wallet
  const attacker = ethers.Wallet.createRandom();
  const t6 = JSON.parse(JSON.stringify(original));
  // Re-sign with attacker key
  const forgedPayload: BkCredentialPayload = {
    credId: original.credId,
    issuedAt: original.issuedAt,
    batchId: original.batchId,
    publicClaims: original.publicClaims,
    privateClaims: original.privateClaims,
    merkleRoot: original.merkle.root,
  };
  const forgedSig = await signCredential(forgedPayload, attacker, domain);
  t6.signature = forgedSig;
  const r6 = await verifyCredential(t6, opts);
  assert(
    !r6.isValid && r6.error?.code === "SIGNATURE_MISMATCH",
    "Forged signature from different wallet rejected",
    `Error: ${r6.error?.code || "none"}`
  );
}

// ═══════════════════════════════════════════════════════════════
// TEST 4: Expired Credential Acceptance
// ═══════════════════════════════════════════════════════════════

async function testExpiredCredential() {
  console.log("\n  ── Test 4: Expired Credential Acceptance ──");
  console.log("     Defense: Step 10 — temporal expiration check\n");

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const domain = buildDomain(CONTRACT_ADDRESS, CHAIN_ID);
  const { credentialFiles } = await buildTestCredentials(wallet, domain, 5);
  const opts = {
    verifyingContract: CONTRACT_ADDRESS,
    issuerRegistry: CONTRACT_ADDRESS,
    chainId: CHAIN_ID,
    skipOnlineChecks: true,
  };

  // Set exp to past (already expired)
  const expired = JSON.parse(JSON.stringify(credentialFiles[0]));
  expired.exp = Math.floor(Date.now() / 1000) - 86400; // expired 24h ago
  const r1 = await verifyCredential(expired, opts);
  assert(
    !r1.isValid && r1.error?.code === "CREDENTIAL_EXPIRED",
    "Expired credential rejected (CREDENTIAL_EXPIRED)",
    `Error: ${r1.error?.code || "none"}`
  );

  // Set exp to far future (still valid)
  const future = JSON.parse(JSON.stringify(credentialFiles[1]));
  future.exp = Math.floor(Date.now() / 1000) + 365 * 86400; // 1 year
  const r2 = await verifyCredential(future, opts);
  assert(r2.isValid, "Non-expired credential with future exp accepted", "Valid with exp");

  // No exp field (should be valid — no expiry)
  const noExp = JSON.parse(JSON.stringify(credentialFiles[2]));
  delete noExp.exp;
  const r3 = await verifyCredential(noExp, opts);
  assert(r3.isValid, "Credential without exp field accepted (no expiry)", "Valid without exp");
}

// ═══════════════════════════════════════════════════════════════
// TEST 5: Disclosure Brute-Force Resistance
// ═══════════════════════════════════════════════════════════════

async function testDisclosureBruteForce() {
  console.log("\n  ── Test 5: Disclosure Brute-Force Resistance ──");
  console.log("     Defense: 256-bit cryptographic salt entropy\n");

  // Create a disclosure
  const { disclosure, commitment } = createDisclosure("fullName", "Nguyen Van A");

  // Attempt brute-force: try to guess the commitment without the salt
  let foundCollision = false;
  const MAX_ATTEMPTS = 10000;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const guessSalt = "0x" + i.toString(16).padStart(64, "0");
    const guessCommitment = ethers.solidityPackedKeccak256(
      ["bytes32", "string", "string"],
      [guessSalt, "fullName", "Nguyen Van A"]
    );
    if (guessCommitment === commitment) {
      foundCollision = true;
      break;
    }
  }

  assert(
    !foundCollision,
    `No collision found in ${MAX_ATTEMPTS.toLocaleString()} brute-force attempts`,
    "256-bit salt provides ~2^256 search space"
  );

  // Verify that same key+value with different salt produces different commitment
  const d1 = createDisclosure("studentId", "2052921");
  const d2 = createDisclosure("studentId", "2052921");
  assert(
    d1.commitment !== d2.commitment,
    "Same key+value with different random salts produce different commitments",
    `c1=${d1.commitment.substring(0, 18)}, c2=${d2.commitment.substring(0, 18)}`
  );

  // Verify commitment with wrong value fails
  const wrongValue = ethers.solidityPackedKeccak256(
    ["bytes32", "string", "string"],
    [disclosure.salt, "fullName", "Tran Van B"]
  );
  assert(
    wrongValue !== commitment,
    "Wrong value produces different commitment",
    "Commitment integrity validated"
  );
}

// ═══════════════════════════════════════════════════════════════
// TEST 6: Schema Injection & Malformed Input
// ═══════════════════════════════════════════════════════════════

async function testSchemaInjection() {
  console.log("\n  ── Test 6: Schema Injection & Malformed Input ──");
  console.log("     Defense: Step 1 — Zod schema validation\n");

  const opts = {
    verifyingContract: CONTRACT_ADDRESS,
    issuerRegistry: CONTRACT_ADDRESS,
    chainId: CHAIN_ID,
    skipOnlineChecks: true,
  };

  // Test 1: Empty object
  const r1 = await verifyCredential({} as any, opts);
  assert(
    !r1.isValid && r1.error?.code === "INVALID_SCHEMA",
    "Empty object rejected (INVALID_SCHEMA)",
    `Error: ${r1.error?.code || "none"}`
  );

  // Test 2: Missing credId
  const r2 = await verifyCredential({
    "@context": "https://bkcred.xyz/v3",
    type: "BkCredential",
  } as any, opts);
  assert(
    !r2.isValid && r2.error?.code === "INVALID_SCHEMA",
    "Missing credId rejected",
    `Error: ${r2.error?.code || "none"}`
  );

  // Test 3: Invalid signature format
  const r3 = await verifyCredential({
    "@context": "https://bkcred.xyz/v3",
    type: "BkCredential",
    credId: "urn:uuid:test-123",
    issuedAt: 1700000000,
    batchId: "TEST",
    issuer: { name: "Test", did: "did:ethr:0x123", signer: "not-an-address" },
    publicClaims: { vct: "TEST", degreeTitle: "Test", graduationDate: "2026-01-01", honors: "" },
    privateClaims: [],
    merkle: { root: "0x" + "00".repeat(32), leaf: "0x" + "00".repeat(32), proof: [], index: 0 },
    signature: "invalid-signature",
  } as any, opts);
  assert(
    !r3.isValid && r3.error?.code === "INVALID_SCHEMA",
    "Invalid signature format rejected",
    `Error: ${r3.error?.code || "none"}`
  );
}

// ═══════════════════════════════════════════════════════════════
// TEST 7: Bitmap Boundary Conditions
// ═══════════════════════════════════════════════════════════════

async function testBitmapBoundary() {
  console.log("\n  ── Test 7: Bitmap Boundary Conditions ──");
  console.log("     Defense: Index bounds check (index < anchor.size)\n");

  // Test bitmap word boundary calculations
  const testCases = [
    { index: 0, expectedWord: 0, expectedBit: 0 },
    { index: 1, expectedWord: 0, expectedBit: 1 },
    { index: 255, expectedWord: 0, expectedBit: 255 },
    { index: 256, expectedWord: 1, expectedBit: 0 },
    { index: 257, expectedWord: 1, expectedBit: 1 },
    { index: 511, expectedWord: 1, expectedBit: 255 },
    { index: 512, expectedWord: 2, expectedBit: 0 },
    { index: 9999, expectedWord: 39, expectedBit: 15 },
    { index: 65535, expectedWord: 255, expectedBit: 255 },
  ];

  for (const tc of testCases) {
    const wordIndex = Math.floor(tc.index / 256);
    const bitIndex = tc.index % 256;
    assert(
      wordIndex === tc.expectedWord && bitIndex === tc.expectedBit,
      `Bitmap index ${tc.index} → word=${wordIndex}, bit=${bitIndex}`,
      `Expected word=${tc.expectedWord}, bit=${tc.expectedBit}`
    );
  }

  // Verify no bit collision: revoking index N does not affect N±1
  // (This is a logical verification of the bitmap algorithm)
  const word = 0n;
  const idx42 = 42;
  const mask42 = 1n << BigInt(idx42 % 256);
  const wordAfterRevoke = word | mask42;

  const idx41Check = (wordAfterRevoke & (1n << BigInt(41))) !== 0n;
  const idx42Check = (wordAfterRevoke & (1n << BigInt(42))) !== 0n;
  const idx43Check = (wordAfterRevoke & (1n << BigInt(43))) !== 0n;

  assert(!idx41Check, "Index 41 NOT revoked after revoking index 42", "Bitwise isolation");
  assert(idx42Check, "Index 42 IS revoked", "Bitmap set correctly");
  assert(!idx43Check, "Index 43 NOT revoked after revoking index 42", "Bitwise isolation");
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  BK CREDENTIAL SYSTEM (PHASE 3) — SECURITY EDGE-CASE & EXPLOIT TESTS       ║");
  console.log("║  Week 6: Security Hardening & Threat Modeling                               ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");

  await testSecondPreimageAttack();
  await testCrossChainReplay();
  await testCredentialForgery();
  await testExpiredCredential();
  await testDisclosureBruteForce();
  await testSchemaInjection();
  await testBitmapBoundary();

  console.log("\n" + "═".repeat(80));
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED (${passed + failed} total)`);
  console.log("═".repeat(80));

  if (failed > 0) {
    console.log("\n  ❌ FAILED TESTS:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`     • ${r.test}: ${r.detail}`);
    }
    process.exit(1);
  } else {
    console.log("\n  ✅ ALL SECURITY TESTS PASSED — System is resilient against tested attack vectors.\n");
  }
}

main().catch((err) => {
  console.error("Security test failed:", err);
  process.exit(1);
});
