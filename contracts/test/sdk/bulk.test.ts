import { expect } from "chai";
import { ethers } from "ethers";
import {
  executeBulkIssuancePipeline,
  chunkArray,
  RawStudentInput,
  buildDomain,
  verifyCredential,
} from "../../src/sdk";

describe("EIP-712 SDK — Chunked Bulk Issuance Engine (Tuần 5 Ngày 2)", function () {
  this.timeout(30000); // 30s for batch processing tests

  const TEST_PRIVATE_KEY =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const TEST_REGISTRY_ADDR = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const CHAIN_ID = 31337;
  const wallet = new ethers.Wallet(TEST_PRIVATE_KEY);
  const domain = buildDomain(TEST_REGISTRY_ADDR, CHAIN_ID);

  describe("chunkArray()", () => {
    it("should split array into exact chunk sizes", () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const chunks = chunkArray(items, 10);
      expect(chunks.length).to.equal(3);
      expect(chunks[0].length).to.equal(10);
      expect(chunks[1].length).to.equal(10);
      expect(chunks[2].length).to.equal(5);
    });

    it("should handle empty arrays and single-item chunks", () => {
      expect(chunkArray([], 10)).to.deep.equal([]);
      expect(chunkArray([1], 10)).to.deep.equal([[1]]);
    });
  });

  describe("executeBulkIssuancePipeline()", () => {
    function generateMockStudents(count: number): RawStudentInput[] {
      return Array.from({ length: count }, (_, i) => ({
        fullName: `Student Test ${i + 1}`,
        studentId: `22100${i.toString().padStart(3, "0")}`,
        dob: "2002-05-15",
        degreeTitle: "Kỹ sư Khoa học Máy tính",
        graduationDate: "2026-06-15",
        honors: i % 5 === 0 ? "Xuất sắc" : "Giỏi",
        holderEmail: `student${i + 1}@hcmut.edu.vn`,
      }));
    }

    it("should execute 5-stage bulk issuance for 50 records in chunks of 15", async () => {
      const records = generateMockStudents(50);
      const progressEvents: string[] = [];

      const result = await executeBulkIssuancePipeline(
        "BATCH-TEST-50",
        records,
        wallet,
        domain,
        {
          chunkSize: 15,
          onProgress: (p) => {
            progressEvents.push(`${p.stage}:${p.current}/${p.total}`);
          },
        }
      );

      expect(result.batchId).to.equal("BATCH-TEST-50");
      expect(result.size).to.equal(50);
      expect(result.merkleRoot).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(result.credentialFiles.length).to.equal(50);
      expect(progressEvents.length).to.be.greaterThan(0);

      // Verify metrics
      expect(result.metrics.disclosureTimeMs).to.be.at.least(0);
      expect(result.metrics.signingTimeMs).to.be.at.least(0);
      expect(result.metrics.totalPipelineTimeMs).to.be.at.least(0);

      // Verify first, middle, and last credentials
      const sampleIndices = [0, 24, 49];
      for (const idx of sampleIndices) {
        const cred = result.credentialFiles[idx];
        expect(cred.merkle.index).to.equal(idx);
        expect(cred.merkle.root).to.equal(result.merkleRoot);
        expect(cred.signature).to.match(/^0x[0-9a-fA-F]{130}$/);
        expect(cred.disclosures?.length).to.equal(3);

        const verifyRes = await verifyCredential(cred, {
          verifyingContract: TEST_REGISTRY_ADDR,
          issuerRegistry: TEST_REGISTRY_ADDR,
          chainId: CHAIN_ID,
          skipOnlineChecks: true,
        });

        expect(verifyRes.isValid).to.be.true;
      }
    });

    it("should scale to 100 credentials with chunk size 25 and maintain 100% verification validity", async () => {
      const records = generateMockStudents(100);
      const result = await executeBulkIssuancePipeline(
        "BATCH-TEST-100",
        records,
        wallet,
        domain,
        { chunkSize: 25 }
      );

      expect(result.size).to.equal(100);
      expect(result.credentialFiles.length).to.equal(100);

      // Verify all 100 credentials pass offline verification
      for (let i = 0; i < result.credentialFiles.length; i++) {
        const verifyRes = await verifyCredential(result.credentialFiles[i], {
          verifyingContract: TEST_REGISTRY_ADDR,
          issuerRegistry: TEST_REGISTRY_ADDR,
          chainId: CHAIN_ID,
          skipOnlineChecks: true,
        });
        expect(verifyRes.isValid).to.be.true;
      }
    });
  });
});
