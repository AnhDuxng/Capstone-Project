import { expect } from "chai";
import { ethers } from "ethers";
import {
  buildDomain,
  signCredential,
  recoverSignerAddress,
  verifySignature,
  BkCredentialPayload,
} from "../../src/sdk";

describe("EIP-712 SDK — Signer & Verification (Tuần 3 Ngày 2)", function () {
  const contractAddress = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
  const domain = buildDomain(contractAddress, 31337);

  // Generate test wallet
  const wallet = ethers.Wallet.createRandom();

  // Sample credential payload
  const samplePayload: BkCredentialPayload = {
    credId: "urn:uuid:3f8e2d1a-7b4c-4e9f-a1d2-8c5b6f0e3a7d",
    issuedAt: 1750000000,
    batchId: "GRAD-2026-01",
    publicClaims: {
      vct: "BKISC_DEGREE",
      degreeTitle: "Kỹ sư Khoa học Máy tính",
      graduationDate: "2026-06-15",
      honors: "Giỏi",
    },
    privateClaims: [
      ethers.keccak256(ethers.toUtf8Bytes("salt1|fullName|Nguyen Van A")),
      ethers.keccak256(ethers.toUtf8Bytes("salt2|studentId|1910001")),
    ],
    merkleRoot: ethers.keccak256(ethers.toUtf8Bytes("sample-merkle-root")),
  };

  // ── signCredential ──────────────────────────────────────────

  describe("signCredential", function () {
    it("should generate a valid 65-byte EIP-712 signature using Wallet instance", async function () {
      const signature = await signCredential(samplePayload, wallet, domain);

      expect(signature).to.be.a("string");
      expect(signature).to.match(/^0x[a-fA-F0-9]{130}$/); // 65 bytes = 130 hex chars + 0x
      expect(signature.length).to.equal(132);
    });

    it("should generate valid signature using private key string", async function () {
      const signature = await signCredential(
        samplePayload,
        wallet.privateKey,
        domain
      );

      expect(signature.length).to.equal(132);
      const recovered = recoverSignerAddress(samplePayload, signature, domain);
      expect(recovered).to.equal(wallet.address);
    });
  });

  // ── recoverSignerAddress ────────────────────────────────────

  describe("recoverSignerAddress", function () {
    it("should recover the exact signer address from payload and signature", async function () {
      const signature = await signCredential(samplePayload, wallet, domain);
      const recovered = recoverSignerAddress(samplePayload, signature, domain);

      expect(recovered).to.equal(wallet.address);
    });

    it("should throw error on invalid signature hex", function () {
      expect(() =>
        recoverSignerAddress(samplePayload, "0x1234", domain)
      ).to.throw("Invalid signature");
    });
  });

  // ── verifySignature & Tamper Resistance ─────────────────────

  describe("verifySignature & Tamper Resistance", function () {
    let validSignature: string;

    beforeEach(async function () {
      validSignature = await signCredential(samplePayload, wallet, domain);
    });

    it("should return true for unmodified payload and correct signer address", function () {
      const isValid = verifySignature(
        samplePayload,
        validSignature,
        wallet.address,
        domain
      );

      expect(isValid).to.be.true;
    });

    it("should return false if expectedSignerAddress is wrong", function () {
      const wrongWallet = ethers.Wallet.createRandom();
      const isValid = verifySignature(
        samplePayload,
        validSignature,
        wrongWallet.address,
        domain
      );

      expect(isValid).to.be.false;
    });

    it("should return false if publicClaims (degreeTitle) is tampered", function () {
      const tamperedPayload: BkCredentialPayload = {
        ...samplePayload,
        publicClaims: {
          ...samplePayload.publicClaims,
          degreeTitle: "Kỹ sư Giả Mạo",
        },
      };

      const isValid = verifySignature(
        tamperedPayload,
        validSignature,
        wallet.address,
        domain
      );

      expect(isValid).to.be.false;
    });

    it("should return false if merkleRoot is tampered", function () {
      const tamperedPayload: BkCredentialPayload = {
        ...samplePayload,
        merkleRoot: ethers.keccak256(ethers.toUtf8Bytes("fake-root")),
      };

      const isValid = verifySignature(
        tamperedPayload,
        validSignature,
        wallet.address,
        domain
      );

      expect(isValid).to.be.false;
    });

    it("should return false if privateClaims commitment is tampered", function () {
      const tamperedPayload: BkCredentialPayload = {
        ...samplePayload,
        privateClaims: [
          ethers.keccak256(ethers.toUtf8Bytes("tampered-commitment")),
        ],
      };

      const isValid = verifySignature(
        tamperedPayload,
        validSignature,
        wallet.address,
        domain
      );

      expect(isValid).to.be.false;
    });

    it("should return false if chainId or contractAddress in domain differs (Anti-Replay)", async function () {
      const differentDomain = buildDomain(
        "0x1111111111111111111111111111111111111111",
        31337
      );

      const isValid = verifySignature(
        samplePayload,
        validSignature,
        wallet.address,
        differentDomain
      );

      expect(isValid).to.be.false;
    });
  });

  // ── Payload Validation Checks ───────────────────────────────

  describe("Payload Validation Checks", function () {
    it("should throw if credId is missing", async function () {
      const invalidPayload = { ...samplePayload, credId: "" };
      await expect(
        signCredential(invalidPayload, wallet, domain)
      ).to.be.rejectedWith("Payload must contain a non-empty credId");
    });

    it("should throw if merkleRoot is not a valid 32-byte hex", async function () {
      const invalidPayload = { ...samplePayload, merkleRoot: "0x1234" };
      await expect(
        signCredential(invalidPayload, wallet, domain)
      ).to.be.rejectedWith("Payload merkleRoot must be a valid 32-byte hex");
    });

    it("should throw if privateClaims commitment is not 32 bytes", async function () {
      const invalidPayload = { ...samplePayload, privateClaims: ["0x1234"] };
      await expect(
        signCredential(invalidPayload, wallet, domain)
      ).to.be.rejectedWith("Invalid privateClaim commitment");
    });
  });
});
