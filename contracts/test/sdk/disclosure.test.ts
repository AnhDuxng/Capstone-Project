import { expect } from "chai";
import { ethers } from "ethers";
import {
  createDisclosure,
  computeDisclosureCommitment,
  verifyDisclosure,
  buildPrivateClaims,
  filterDisclosures,
  Disclosure,
} from "../../src/sdk";

describe("EIP-712 SDK — Selective Disclosure Helpers (Tuần 3 Ngày 4)", function () {
  // ── createDisclosure ────────────────────────────────────────

  describe("createDisclosure", function () {
    it("should generate a random 32-byte salt and compute valid commitment", function () {
      const res = createDisclosure("fullName", "Trần Lê Công Minh");

      expect(res.disclosure.key).to.equal("fullName");
      expect(res.disclosure.value).to.equal("Trần Lê Công Minh");
      expect(res.disclosure.salt).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(res.commitment).to.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should accept custom 32-byte hex salt", function () {
      const customSalt = ethers.hexlify(ethers.randomBytes(32));
      const res = createDisclosure("studentId", "1910001", customSalt);

      expect(res.disclosure.salt).to.equal(customSalt);
      const expectedCommitment = computeDisclosureCommitment(
        customSalt,
        "studentId",
        "1910001"
      );
      expect(res.commitment).to.equal(expectedCommitment);
    });

    it("should throw error on empty key or invalid salt format", function () {
      expect(() => createDisclosure("", "val")).to.throw(
        "createDisclosure requires a non-empty key"
      );
      expect(() => createDisclosure("key", "val", "0x1234")).to.throw(
        "Invalid salt"
      );
    });
  });

  // ── verifyDisclosure ────────────────────────────────────────

  describe("verifyDisclosure", function () {
    let d1: Disclosure;
    let c1: string;

    beforeEach(function () {
      const res = createDisclosure("fullName", "Nguyen Van A");
      d1 = res.disclosure;
      c1 = res.commitment;
    });

    it("should return true for matching disclosure and commitment", function () {
      expect(verifyDisclosure(d1, c1)).to.be.true;
    });

    it("should return true when commitment exists in privateClaims array", function () {
      const otherCommitment = ethers.keccak256(ethers.toUtf8Bytes("other"));
      expect(verifyDisclosure(d1, [otherCommitment, c1])).to.be.true;
    });

    it("should return false if value or salt is tampered", function () {
      const tamperedValue: Disclosure = { ...d1, value: "Nguyen Van B" };
      expect(verifyDisclosure(tamperedValue, c1)).to.be.false;

      const tamperedSalt: Disclosure = {
        ...d1,
        salt: ethers.hexlify(ethers.randomBytes(32)),
      };
      expect(verifyDisclosure(tamperedSalt, c1)).to.be.false;
    });

    it("should return false for invalid commitment string", function () {
      const wrongCommitment = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
      expect(verifyDisclosure(d1, wrongCommitment)).to.be.false;
    });
  });

  // ── buildPrivateClaims ──────────────────────────────────────

  describe("buildPrivateClaims", function () {
    it("should map array of disclosures to commitment hex strings", function () {
      const disc1 = createDisclosure("fullName", "Nguyen Van A");
      const disc2 = createDisclosure("dob", "2000-01-01");

      const commitments = buildPrivateClaims([disc1, disc2.disclosure]);

      expect(commitments).to.be.an("array").with.lengthOf(2);
      expect(commitments[0]).to.equal(disc1.commitment);
      expect(commitments[1]).to.equal(disc2.commitment);
    });
  });

  // ── filterDisclosures ───────────────────────────────────────

  describe("filterDisclosures", function () {
    it("should filter disclosures matching selected keys for holder sharing", function () {
      const d1 = createDisclosure("fullName", "Nguyen Van A").disclosure;
      const d2 = createDisclosure("studentId", "1910001").disclosure;
      const d3 = createDisclosure("gpa", "3.8").disclosure;

      const selected = filterDisclosures([d1, d2, d3], ["fullName", "gpa"]);

      expect(selected).to.have.lengthOf(2);
      expect(selected.map((d) => d.key)).to.deep.equal(["fullName", "gpa"]);
    });
  });
});
