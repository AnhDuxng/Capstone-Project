import { expect } from "chai";
import { ethers } from "hardhat";
import { CredentialRegistryV3, IssuerRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CredentialRegistryV3", function () {
  let issuerRegistry: IssuerRegistry;
  let credRegistry: CredentialRegistryV3;
  let owner: SignerWithAddress;
  let signer1: SignerWithAddress;
  let signer2: SignerWithAddress;
  let stranger: SignerWithAddress;

  const SAMPLE_ROOT = ethers.keccak256(ethers.toUtf8Bytes("test-batch-root-1"));
  const SAMPLE_ROOT_2 = ethers.keccak256(ethers.toUtf8Bytes("test-batch-root-2"));

  beforeEach(async function () {
    [owner, signer1, signer2, stranger] = await ethers.getSigners();

    const IssuerFactory = await ethers.getContractFactory("IssuerRegistry");
    issuerRegistry = (await IssuerFactory.deploy(owner.address)) as unknown as IssuerRegistry;
    await issuerRegistry.waitForDeployment();

    const CredFactory = await ethers.getContractFactory("CredentialRegistryV3");
    credRegistry = (await CredFactory.deploy(owner.address, await issuerRegistry.getAddress())) as unknown as CredentialRegistryV3;
    await credRegistry.waitForDeployment();

    await issuerRegistry.addSigner(signer1.address, "0x");
    await issuerRegistry.addSigner(signer2.address, "0x");
  });

  // ── Deployment ──────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set the correct owner and reference IssuerRegistry", async function () {
      expect(await credRegistry.owner()).to.equal(owner.address);
      expect(await credRegistry.issuerRegistry()).to.equal(
        await issuerRegistry.getAddress()
      );
    });

    it("should start with nextBatchIndex = 0", async function () {
      expect(await credRegistry.nextBatchIndex()).to.equal(0);
      expect(await credRegistry.getBatchCount()).to.equal(0);
    });

    it("should revert if initialOwner is zero address", async function () {
      const CredFactory = await ethers.getContractFactory("CredentialRegistryV3");
      await expect(
        CredFactory.deploy(ethers.ZeroAddress, await issuerRegistry.getAddress())
      ).to.be.revertedWithCustomError(credRegistry, "OwnableInvalidOwner");
    });
  });

  // ── Emergency Pausable Controls ─────────────────────────────

  describe("Emergency Pausable Controls", function () {
    it("should allow owner to pause and unpause", async function () {
      await expect(credRegistry.pause())
        .to.emit(credRegistry, "Paused")
        .withArgs(owner.address);
      expect(await credRegistry.paused()).to.be.true;

      await expect(credRegistry.unpause())
        .to.emit(credRegistry, "Unpaused")
        .withArgs(owner.address);
      expect(await credRegistry.paused()).to.be.false;
    });

    it("should revert pause/unpause if caller is not owner", async function () {
      await expect(
        credRegistry.connect(stranger).pause()
      ).to.be.revertedWithCustomError(credRegistry, "OwnableUnauthorizedAccount");
    });

    it("should block anchorBatch and revoke when paused, but allow read views", async function () {
      await credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 100, "");

      await credRegistry.pause();

      // State-changing operations revert
      await expect(
        credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT_2, 100, "")
      ).to.be.revertedWithCustomError(credRegistry, "EnforcedPause");

      await expect(
        credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 0)
      ).to.be.revertedWithCustomError(credRegistry, "EnforcedPause");

      await expect(
        credRegistry.connect(signer1).revokeBatch(SAMPLE_ROOT, [0, 1])
      ).to.be.revertedWithCustomError(credRegistry, "EnforcedPause");

      // Read-only view functions still work during pause
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 0)).to.be.false;
      const [anchoredAt] = await credRegistry.getAnchor(SAMPLE_ROOT);
      expect(anchoredAt).to.be.greaterThan(0n);
    });
  });

  // ── anchorBatch ───────────────────────────────────────────

  describe("anchorBatch", function () {
    it("should anchor a batch and emit event", async function () {
      const tx = credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 100, "");
      await expect(tx)
        .to.emit(credRegistry, "BatchAnchored")
        .withArgs(SAMPLE_ROOT, signer1.address, 0, 100, (v: bigint) => v > 0n);
    });

    it("should increment nextBatchIndex & batchCount", async function () {
      await credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 100, "");
      expect(await credRegistry.nextBatchIndex()).to.equal(1);
      expect(await credRegistry.getBatchCount()).to.equal(1);
    });

    it("should store anchor data correctly", async function () {
      await credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 500, "QmTest123");
      const [anchoredAt, issuer, size, ipfsCid] = await credRegistry.getAnchor(SAMPLE_ROOT);

      expect(anchoredAt).to.be.greaterThan(0n);
      expect(issuer).to.equal(signer1.address);
      expect(size).to.equal(500);
      expect(ipfsCid).to.equal("QmTest123");
    });

    it("should map batchIndex to merkleRoot", async function () {
      await credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 100, "");
      expect(await credRegistry.batchRoots(0)).to.equal(SAMPLE_ROOT);
    });

    it("should revert if caller is not a signer", async function () {
      await expect(
        credRegistry.connect(stranger).anchorBatch(SAMPLE_ROOT, 100, "")
      ).to.be.revertedWithCustomError(credRegistry, "NotActiveSigner");
    });

    it("should revert if merkleRoot is zero", async function () {
      await expect(
        credRegistry.connect(signer1).anchorBatch(ethers.ZeroHash, 100, "")
      ).to.be.revertedWithCustomError(credRegistry, "ZeroMerkleRoot");
    });

    it("should revert if batch size is zero", async function () {
      await expect(
        credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 0, "")
      ).to.be.revertedWithCustomError(credRegistry, "ZeroBatchSize");
    });

    it("should revert if batch already anchored", async function () {
      await credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 100, "");
      await expect(
        credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 200, "")
      ).to.be.revertedWithCustomError(credRegistry, "BatchAlreadyAnchored");
    });
  });

  // ── revoke & isRevoked ────────────────────────────────────

  describe("revoke & isRevoked", function () {
    beforeEach(async function () {
      await credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 1000, "");
    });

    it("should revoke a credential and emit event", async function () {
      await expect(credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 42))
        .to.emit(credRegistry, "CredentialRevoked")
        .withArgs(SAMPLE_ROOT, 42, signer1.address);
    });

    it("should mark credential as revoked", async function () {
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 42)).to.be.false;
      await credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 42);
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 42)).to.be.true;
    });

    it("should not affect other indices in the same word", async function () {
      await credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 42);
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 41)).to.be.false;
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 43)).to.be.false;
    });

    it("should handle index at word boundary (255)", async function () {
      await credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 255);
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 255)).to.be.true;
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 256)).to.be.false;
    });

    it("should handle index crossing word boundary (256)", async function () {
      await credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 256);
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 256)).to.be.true;
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 255)).to.be.false;
    });

    it("should handle index 0", async function () {
      await credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 0);
      expect(await credRegistry.isRevoked(SAMPLE_ROOT, 0)).to.be.true;
    });

    it("should handle large indices across multiple bitmap words (65535 and 99999)", async function () {
      const LARGE_ROOT = ethers.keccak256(ethers.toUtf8Bytes("large-batch"));
      await credRegistry.connect(signer1).anchorBatch(LARGE_ROOT, 100000, "");

      await credRegistry.connect(signer1).revoke(LARGE_ROOT, 65535);
      await credRegistry.connect(signer1).revoke(LARGE_ROOT, 99999);

      expect(await credRegistry.isRevoked(LARGE_ROOT, 65535)).to.be.true;
      expect(await credRegistry.isRevoked(LARGE_ROOT, 99999)).to.be.true;
      expect(await credRegistry.isRevoked(LARGE_ROOT, 65534)).to.be.false;
      expect(await credRegistry.isRevoked(LARGE_ROOT, 99998)).to.be.false;
    });

    it("should revert if batch not found", async function () {
      const fakeRoot = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      await expect(
        credRegistry.connect(signer1).revoke(fakeRoot, 0)
      ).to.be.revertedWithCustomError(credRegistry, "BatchNotFound");
    });

    it("should revert if index out of range", async function () {
      await expect(
        credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 1000)
      ).to.be.revertedWithCustomError(credRegistry, "IndexOutOfRange");
    });

    it("should revert if already revoked", async function () {
      await credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 42);
      await expect(
        credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 42)
      ).to.be.revertedWithCustomError(credRegistry, "AlreadyRevoked");
    });

    it("should revert if caller is not the original batch issuer", async function () {
      await expect(
        credRegistry.connect(signer2).revoke(SAMPLE_ROOT, 0)
      ).to.be.revertedWithCustomError(credRegistry, "NotOriginalIssuer");
    });

    it("should revert if caller signer status was revoked in IssuerRegistry", async function () {
      await issuerRegistry.revokeSigner(signer1.address);
      await expect(
        credRegistry.connect(signer1).revoke(SAMPLE_ROOT, 0)
      ).to.be.revertedWithCustomError(credRegistry, "NotActiveSigner");
    });
  });

  // ── revokeBatch & isRevokedBatch ──────────────────────────

  describe("revokeBatch & isRevokedBatch", function () {
    beforeEach(async function () {
      await credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 1000, "");
    });

    it("should revoke multiple credentials in a single transaction", async function () {
      const tx = credRegistry.connect(signer1).revokeBatch(SAMPLE_ROOT, [5, 10, 255, 500]);
      await expect(tx)
        .to.emit(credRegistry, "CredentialsBulkRevoked")
        .withArgs(SAMPLE_ROOT, 4, signer1.address);

      const statuses = await credRegistry.isRevokedBatch(SAMPLE_ROOT, [0, 5, 10, 11, 255, 500]);
      expect(statuses).to.deep.equal([false, true, true, false, true, true]);
    });

    it("should revert revokeBatch if indices array is empty", async function () {
      await expect(
        credRegistry.connect(signer1).revokeBatch(SAMPLE_ROOT, [])
      ).to.be.revertedWithCustomError(credRegistry, "EmptyIndicesArray");
    });

    it("should revert revokeBatch if any index is out of range", async function () {
      await expect(
        credRegistry.connect(signer1).revokeBatch(SAMPLE_ROOT, [10, 1000])
      ).to.be.revertedWithCustomError(credRegistry, "IndexOutOfRange");
    });
  });

  // ── Pagination & Views ──────────────────────────────────────

  describe("Pagination & Views", function () {
    beforeEach(async function () {
      await credRegistry.connect(signer1).anchorBatch(SAMPLE_ROOT, 100, "cid1");
      await credRegistry.connect(signer2).anchorBatch(SAMPLE_ROOT_2, 200, "cid2");
    });

    it("should return paginated batches and roots", async function () {
      const [roots, anchors] = await credRegistry.getBatches(0, 10);
      expect(roots).to.deep.equal([SAMPLE_ROOT, SAMPLE_ROOT_2]);
      expect(anchors[0].size).to.equal(100);
      expect(anchors[1].size).to.equal(200);
      expect(anchors[0].ipfsCid).to.equal("cid1");
      expect(anchors[1].ipfsCid).to.equal("cid2");
    });

    it("should handle partial page limits", async function () {
      const [roots, anchors] = await credRegistry.getBatches(0, 1);
      expect(roots).to.deep.equal([SAMPLE_ROOT]);
      expect(anchors.length).to.equal(1);
    });

    it("should revert on invalid offset", async function () {
      await expect(credRegistry.getBatches(10, 5)).to.be.revertedWithCustomError(
        credRegistry,
        "InvalidPagination"
      );
    });
  });
});
