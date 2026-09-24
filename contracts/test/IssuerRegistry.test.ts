import { expect } from "chai";
import { ethers } from "hardhat";
import { IssuerRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("IssuerRegistry", function () {
  let registry: IssuerRegistry;
  let owner: SignerWithAddress;
  let newOwner: SignerWithAddress;
  let signer1: SignerWithAddress;
  let signer2: SignerWithAddress;
  let stranger: SignerWithAddress;

  beforeEach(async function () {
    [owner, newOwner, signer1, signer2, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IssuerRegistry");
    registry = (await Factory.deploy(owner.address)) as unknown as IssuerRegistry;
    await registry.waitForDeployment();
  });

  // ── Deployment ──────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should start with zero signers", async function () {
      expect(await registry.getSignerCount()).to.equal(0);
      expect(await registry.getAllSigners()).to.deep.equal([]);
    });

    it("should revert if initialOwner is zero address", async function () {
      const Factory = await ethers.getContractFactory("IssuerRegistry");
      await expect(Factory.deploy(ethers.ZeroAddress)).to.be.reverted;
    });
  });

  // ── addSigner ─────────────────────────────────────────────

  describe("addSigner", function () {
    it("should add a signer with DID and update count/list", async function () {
      const didLabel = ethers.toUtf8Bytes("did:ethr:sepolia:0x123");
      await expect(registry.addSigner(signer1.address, didLabel))
        .to.emit(registry, "SignerAdded")
        .withArgs(signer1.address, ethers.hexlify(didLabel));

      expect(await registry.isSigner(signer1.address)).to.be.true;
      expect(await registry.did(signer1.address)).to.equal(ethers.hexlify(didLabel));
      expect(await registry.getSignerCount()).to.equal(1);
      expect(await registry.getAllSigners()).to.deep.equal([signer1.address]);
    });

    it("should add a signer with empty DID", async function () {
      await registry.addSigner(signer1.address, "0x");
      expect(await registry.isSigner(signer1.address)).to.be.true;
    });

    it("should revert if caller is not owner", async function () {
      await expect(
        registry.connect(stranger).addSigner(signer1.address, "0x")
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should revert if signer is zero address", async function () {
      await expect(
        registry.addSigner(ethers.ZeroAddress, "0x")
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("should revert if signer already exists", async function () {
      await registry.addSigner(signer1.address, "0x");
      await expect(
        registry.addSigner(signer1.address, "0x")
      ).to.be.revertedWithCustomError(registry, "AlreadySigner");
    });
  });

  // ── updateDid ──────────────────────────────────────────────

  describe("updateDid", function () {
    beforeEach(async function () {
      await registry.addSigner(signer1.address, ethers.toUtf8Bytes("did:ethr:old"));
    });

    it("should allow owner to update DID of active signer", async function () {
      const newDid = ethers.toUtf8Bytes("did:ethr:new");
      await expect(registry.updateDid(signer1.address, newDid))
        .to.emit(registry, "SignerDidUpdated")
        .withArgs(signer1.address, ethers.hexlify(newDid));

      expect(await registry.did(signer1.address)).to.equal(ethers.hexlify(newDid));
    });

    it("should revert if signer is not active", async function () {
      await expect(
        registry.updateDid(signer2.address, "0x1234")
      ).to.be.revertedWithCustomError(registry, "NotSigner");
    });

    it("should revert if caller is not owner", async function () {
      await expect(
        registry.connect(stranger).updateDid(signer1.address, "0x1234")
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  // ── revokeSigner ──────────────────────────────────────────

  describe("revokeSigner", function () {
    beforeEach(async function () {
      await registry.addSigner(signer1.address, "0x");
    });

    it("should revoke an active signer", async function () {
      await expect(registry.revokeSigner(signer1.address))
        .to.emit(registry, "SignerRevoked")
        .withArgs(signer1.address);

      expect(await registry.isSigner(signer1.address)).to.be.false;
      // Should remain in historical signers array
      expect(await registry.getSignerCount()).to.equal(1);
      expect(await registry.getAllSigners()).to.deep.equal([signer1.address]);
    });

    it("should allow re-adding a revoked signer", async function () {
      await registry.revokeSigner(signer1.address);
      await registry.addSigner(signer1.address, "0x9999");
      expect(await registry.isSigner(signer1.address)).to.be.true;
      expect(await registry.getSignerCount()).to.equal(1); // Array index preserved
    });

    it("should revert if signer is not active", async function () {
      await expect(
        registry.revokeSigner(signer2.address)
      ).to.be.revertedWithCustomError(registry, "NotSigner");
    });

    it("should revert if caller is not owner", async function () {
      await expect(
        registry.connect(stranger).revokeSigner(signer1.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  // ── Pagination & Views ──────────────────────────────────────

  describe("Pagination & Views", function () {
    beforeEach(async function () {
      await registry.addSigner(signer1.address, "0x1111");
      await registry.addSigner(signer2.address, "0x2222");
      await registry.revokeSigner(signer2.address);
    });

    it("should return correct paginated signers and active status", async function () {
      const [signers, activeStatuses] = await registry.getSigners(0, 10);
      expect(signers).to.deep.equal([signer1.address, signer2.address]);
      expect(activeStatuses).to.deep.equal([true, false]);
    });

    it("should handle partial page limits", async function () {
      const [signers, activeStatuses] = await registry.getSigners(0, 1);
      expect(signers).to.deep.equal([signer1.address]);
      expect(activeStatuses).to.deep.equal([true]);
    });

    it("should handle offset pagination", async function () {
      const [signers, activeStatuses] = await registry.getSigners(1, 5);
      expect(signers).to.deep.equal([signer2.address]);
      expect(activeStatuses).to.deep.equal([false]);
    });

    it("should revert on invalid offset", async function () {
      await expect(registry.getSigners(10, 5)).to.be.revertedWithCustomError(
        registry,
        "InvalidPagination"
      );
    });
  });

  // ── Ownable2Step ───────────────────────────────────────────

  describe("Ownable2Step ownership transfer", function () {
    it("should require 2-step process to transfer ownership", async function () {
      await registry.transferOwnership(newOwner.address);
      expect(await registry.owner()).to.equal(owner.address); // Pending, not transferred yet
      expect(await registry.pendingOwner()).to.equal(newOwner.address);

      await registry.connect(newOwner).acceptOwnership();
      expect(await registry.owner()).to.equal(newOwner.address);
      expect(await registry.pendingOwner()).to.equal(ethers.ZeroAddress);
    });
  });
});
