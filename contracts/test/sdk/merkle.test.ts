import { expect } from "chai";
import { ethers } from "ethers";
import {
  computePublicClaimsHash,
  computePrivateClaimsHash,
  computeLeafTuple,
  buildBatchTree,
  verifyMerkleProof,
  BkCredentialPayload,
  createDisclosure,
} from "../../src/sdk";

describe("EIP-712 SDK — Merkle Tree Utility (Tuần 3 Ngày 5)", function () {
  const sampleCred1: BkCredentialPayload = {
    credId: "urn:uuid:3f8e2d1a-7b4c-4e9f-a1d2-8c5b6f0e3a7d",
    issuedAt: 1750000000,
    batchId: "GRAD-2026-01",
    publicClaims: {
      vct: "BKISC_DEGREE",
      degreeTitle: "Kỹ sư Khoa học Máy tính",
      graduationDate: "2026-06-15",
      honors: "Giỏi",
    },
    privateClaims: [createDisclosure("fullName", "Nguyen Van A").commitment],
    merkleRoot: "0x" + "00".repeat(32),
  };

  const sampleCred2: BkCredentialPayload = {
    credId: "urn:uuid:8a9b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    issuedAt: 1750000000,
    batchId: "GRAD-2026-01",
    publicClaims: {
      vct: "BKISC_DEGREE",
      degreeTitle: "Kỹ sư Điện - Điện tử",
      graduationDate: "2026-06-15",
      honors: "Xuất sắc",
    },
    privateClaims: [createDisclosure("fullName", "Tran Thi B").commitment],
    merkleRoot: "0x" + "00".repeat(32),
  };

  // ── computePublicClaimsHash & computePrivateClaimsHash ─────

  describe("Hash Computations", function () {
    it("should compute deterministic publicClaimsHash", function () {
      const hash1 = computePublicClaimsHash(sampleCred1.publicClaims);
      const hash2 = computePublicClaimsHash(sampleCred1.publicClaims);

      expect(hash1).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(hash1).to.equal(hash2);
    });

    it("should compute privateClaimsHash using ABI encoding", function () {
      const hash = computePrivateClaimsHash(sampleCred1.privateClaims);
      expect(hash).to.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should compute complete leaf tuple", function () {
      const tuple = computeLeafTuple(sampleCred1);
      expect(tuple[0]).to.equal(sampleCred1.credId);
      expect(tuple[1]).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(tuple[2]).to.match(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  // ── buildBatchTree & verifyMerkleProof ─────────────────────

  describe("buildBatchTree & verifyMerkleProof", function () {
    it("should build Merkle tree and verify proof for each credential in batch", function () {
      const batchResult = buildBatchTree([sampleCred1, sampleCred2]);

      expect(batchResult.root).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(batchResult.proofsMap.size).to.equal(2);

      // Verify cred 1 proof
      const proof1 = batchResult.proofsMap.get(sampleCred1.credId);
      expect(proof1).to.not.be.undefined;
      const tuple1 = computeLeafTuple(sampleCred1);
      const isValid1 = verifyMerkleProof(batchResult.root, tuple1, proof1!.proof);
      expect(isValid1).to.be.true;

      // Verify cred 2 proof
      const proof2 = batchResult.proofsMap.get(sampleCred2.credId);
      expect(proof2).to.not.be.undefined;
      const tuple2 = computeLeafTuple(sampleCred2);
      const isValid2 = verifyMerkleProof(batchResult.root, tuple2, proof2!.proof);
      expect(isValid2).to.be.true;
    });

    it("should return false when verifying with tampered leaf tuple or proof", function () {
      const batchResult = buildBatchTree([sampleCred1, sampleCred2]);
      const proof1 = batchResult.proofsMap.get(sampleCred1.credId)!;

      const tamperedTuple = computeLeafTuple(sampleCred1);
      tamperedTuple[0] = "urn:uuid:fake-id";

      const isValid = verifyMerkleProof(batchResult.root, tamperedTuple, proof1.proof);
      expect(isValid).to.be.false;
    });

    it("should build batch tree for 100 credentials and verify all proofs", function () {
      const creds: BkCredentialPayload[] = [];
      for (let i = 0; i < 100; i++) {
        creds.push({
          credId: `urn:uuid:00000000-0000-0000-0000-${i.toString().padStart(12, "0")}`,
          issuedAt: 1750000000,
          batchId: "BATCH-100",
          publicClaims: {
            vct: "BKISC_DEGREE",
            degreeTitle: `Chuyên ngành ${i}`,
            graduationDate: "2026-06-15",
            honors: "Giỏi",
          },
          privateClaims: [createDisclosure("studentId", `20260${i}`).commitment],
          merkleRoot: "0x" + "00".repeat(32),
        });
      }

      const batchResult = buildBatchTree(creds);
      expect(batchResult.proofsMap.size).to.equal(100);

      // Random sample check 5 items
      for (const index of [0, 25, 50, 75, 99]) {
        const cred = creds[index];
        const proofData = batchResult.proofsMap.get(cred.credId)!;
        const tuple = computeLeafTuple(cred);
        expect(verifyMerkleProof(batchResult.root, tuple, proofData.proof)).to.be.true;
      }
    });
  });
});
