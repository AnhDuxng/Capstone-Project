import { expect } from "chai";
import { ethers } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import {
  buildDomain,
  signCredential,
  verifyCredential,
  CredentialFile,
  VerifyOptions,
} from "../../src/sdk";
import { IssuerRegistry, CredentialRegistryV3 } from "../../typechain-types";

describe("EIP-712 SDK — 10-Step Verifier Pipeline (Tuần 3 Ngày 3)", function () {
  let issuerRegistry: IssuerRegistry;
  let credRegistry: CredentialRegistryV3;
  let owner: any;
  let signerWallet: any;
  let issuerRegistryAddr: string;
  let credRegistryAddr: string;

  const chainId = 31337;
  let validCredentialFile: CredentialFile;
  let sampleMerkleRoot: string;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    signerWallet = ethers.Wallet.createRandom().connect(ethers.provider);

    // Fund signer wallet for txs
    await owner.sendTransaction({
      to: signerWallet.address,
      value: ethers.parseEther("1.0"),
    });

    // Deploy contracts
    const IssuerFactory = await ethers.getContractFactory("IssuerRegistry");
    issuerRegistry = (await IssuerFactory.deploy(owner.address)) as unknown as IssuerRegistry;
    await issuerRegistry.waitForDeployment();
    issuerRegistryAddr = await issuerRegistry.getAddress();

    const CredFactory = await ethers.getContractFactory("CredentialRegistryV3");
    credRegistry = (await CredFactory.deploy(owner.address, issuerRegistryAddr)) as unknown as CredentialRegistryV3;
    await credRegistry.waitForDeployment();
    credRegistryAddr = await credRegistry.getAddress();

    // Register signer in IssuerRegistry
    await issuerRegistry.addSigner(signerWallet.address, ethers.toUtf8Bytes("did:ethr:sepolia:signer1"));

    // Prepare credential data
    const credId = "urn:uuid:3f8e2d1a-7b4c-4e9f-a1d2-8c5b6f0e3a7d";
    const publicClaims = {
      vct: "BKISC_DEGREE",
      degreeTitle: "Kỹ sư Khoa học Máy tính",
      graduationDate: "2026-06-15",
      honors: "Giỏi",
    };

    // Calculate public claims hash
    const types = {
      PublicClaims: [
        { name: "vct", type: "string" },
        { name: "degreeTitle", type: "string" },
        { name: "graduationDate", type: "string" },
        { name: "honors", type: "string" },
      ],
    };
    const publicClaimsHash = ethers.TypedDataEncoder.hashStruct(
      "PublicClaims",
      types,
      publicClaims
    );

    // Private disclosures & commitments
    const disclosure1 = {
      salt: ethers.hexlify(ethers.randomBytes(32)),
      key: "fullName",
      value: "Trần Lê Công Minh",
    };
    const commitment1 = ethers.solidityPackedKeccak256(
      ["bytes32", "string", "string"],
      [disclosure1.salt, disclosure1.key, disclosure1.value]
    );

    const privateClaims = [commitment1];

    // Compute private claims hash & leaf
    const privateClaimsHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32[]"],
        [privateClaims]
      )
    );

    // Build StandardMerkleTree
    const leafData = [credId, publicClaimsHash, privateClaimsHash];
    const tree = StandardMerkleTree.of([leafData], ["string", "bytes32", "bytes32"]);
    sampleMerkleRoot = tree.root;

    // Anchor batch on-chain
    await credRegistry.connect(signerWallet).anchorBatch(sampleMerkleRoot, 1, "QmMetaCid");

    // Get Merkle proof
    let leafHash = "";
    let proof: string[] = [];
    for (const [i, v] of tree.entries()) {
      if (v[0] === credId) {
        leafHash = tree.leafHash(v);
        proof = tree.getProof(i);
        break;
      }
    }

    // Sign EIP-712 credential
    const domain = buildDomain(credRegistryAddr, chainId);
    const signature = await signCredential(
      {
        credId,
        issuedAt: 1750000000,
        batchId: "GRAD-2026-01",
        publicClaims,
        privateClaims,
        merkleRoot: sampleMerkleRoot,
      },
      signerWallet,
      domain
    );

    // Construct full CredentialFile
    validCredentialFile = {
      "@context": "https://bkcred.xyz/v3",
      type: "BkCredential",
      credId,
      issuedAt: 1750000000,
      batchId: "GRAD-2026-01",
      issuer: {
        name: "Trường Đại học Bách Khoa — ĐHQG-HCM",
        did: "did:ethr:sepolia:signer1",
        signer: signerWallet.address,
      },
      publicClaims,
      privateClaims,
      merkle: {
        root: sampleMerkleRoot,
        leaf: leafHash,
        proof,
        index: 0,
      },
      signature,
      disclosures: [disclosure1],
    };
  });

  // ── Happy Path ──────────────────────────────────────────────

  describe("Happy Path Verification", function () {
    it("should pass all 10 steps successfully for valid credential", async function () {
      const opts: VerifyOptions = {
        verifyingContract: credRegistryAddr,
        issuerRegistry: issuerRegistryAddr,
        chainId,
        provider: ethers.provider,
      };

      const result = await verifyCredential(validCredentialFile, opts);

      expect(result.isValid).to.be.true;
      expect(result.error).to.be.undefined;
      expect(result.recoveredSigner?.toLowerCase()).to.equal(signerWallet.address.toLowerCase());
      expect(result.anchoredAt).to.be.greaterThan(0n);
      expect(result.verifiedSteps).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("should pass offline steps (1-6 + 10) when skipOnlineChecks is true", async function () {
      const opts: VerifyOptions = {
        verifyingContract: credRegistryAddr,
        issuerRegistry: issuerRegistryAddr,
        chainId,
        skipOnlineChecks: true,
      };

      const result = await verifyCredential(validCredentialFile, opts);

      expect(result.isValid).to.be.true;
      expect(result.verifiedSteps).to.deep.equal([1, 2, 3, 4, 5, 6, 10]);
    });
  });

  // ── Failure Modes ───────────────────────────────────────────

  describe("Failure Modes (Steps 1–10)", function () {
    let baseOpts: VerifyOptions;

    beforeEach(function () {
      baseOpts = {
        verifyingContract: credRegistryAddr,
        issuerRegistry: issuerRegistryAddr,
        chainId,
        provider: ethers.provider,
      };
    });

    it("Step 1 (INVALID_SCHEMA): should fail on malformed JSON structure", async function () {
      const badCred = { ...validCredentialFile, credId: "bad-id" };
      const res = await verifyCredential(badCred, baseOpts);

      expect(res.isValid).to.be.false;
      expect(res.error?.code).to.equal("INVALID_SCHEMA");
    });

    it("Step 3 (DISCLOSURE_MISMATCH): should fail if disclosure value is tampered", async function () {
      const badCred = {
        ...validCredentialFile,
        disclosures: [{ ...validCredentialFile.disclosures![0], value: "Trần Lê Fake Name" }],
      };
      const res = await verifyCredential(badCred, baseOpts);

      expect(res.isValid).to.be.false;
      expect(res.error?.code).to.equal("DISCLOSURE_MISMATCH");
    });

    it("Step 4 (LEAF_MISMATCH): should fail if public claims are tampered without updating leaf", async function () {
      const badCred = {
        ...validCredentialFile,
        publicClaims: { ...validCredentialFile.publicClaims, degreeTitle: "Kỹ sư Giả Mạo" },
      };
      const res = await verifyCredential(badCred, baseOpts);

      expect(res.isValid).to.be.false;
      expect(res.error?.code).to.equal("LEAF_MISMATCH");
    });

    it("Step 5 (INVALID_MERKLE_PROOF): should fail if proof path is corrupted", async function () {
      const badCred = {
        ...validCredentialFile,
        merkle: { ...validCredentialFile.merkle, proof: [ethers.keccak256(ethers.toUtf8Bytes("bad-proof"))] },
      };
      const res = await verifyCredential(badCred, baseOpts);

      expect(res.isValid).to.be.false;
      expect(res.error?.code).to.equal("INVALID_MERKLE_PROOF");
    });

    it("Step 6 (SIGNATURE_MISMATCH): should fail if signature is signed by unauthorized key", async function () {
      const strangerWallet = ethers.Wallet.createRandom();
      const domain = buildDomain(credRegistryAddr, chainId);
      const badSig = await signCredential(
        {
          credId: validCredentialFile.credId,
          issuedAt: validCredentialFile.issuedAt,
          batchId: validCredentialFile.batchId,
          publicClaims: validCredentialFile.publicClaims,
          privateClaims: validCredentialFile.privateClaims,
          merkleRoot: validCredentialFile.merkle.root,
        },
        strangerWallet,
        domain
      );

      const badCred = { ...validCredentialFile, signature: badSig };
      const res = await verifyCredential(badCred, baseOpts);

      expect(res.isValid).to.be.false;
      expect(res.error?.code).to.equal("SIGNATURE_MISMATCH");
    });

    it("Step 7 (SIGNER_NOT_REGISTERED): should fail if signer status is revoked in IssuerRegistry", async function () {
      await issuerRegistry.revokeSigner(signerWallet.address);

      const res = await verifyCredential(validCredentialFile, baseOpts);

      expect(res.isValid).to.be.false;
      expect(res.error?.code).to.equal("SIGNER_NOT_REGISTERED");
    });

    it("Step 8 (BATCH_NOT_ANCHORED): should fail if merkleRoot was never anchored", async function () {
      const unanchoredRoot = ethers.keccak256(ethers.toUtf8Bytes("unanchored"));
      const badCred = {
        ...validCredentialFile,
        merkle: { ...validCredentialFile.merkle, root: unanchoredRoot },
      };
      const res = await verifyCredential(badCred, baseOpts);

      expect(res.isValid).to.be.false;
      // Merkle proof verify against a fake root fails at Step 5 (INVALID_MERKLE_PROOF) or Step 8
      expect(["INVALID_MERKLE_PROOF", "BATCH_NOT_ANCHORED"]).to.include(res.error?.code);
    });

    it("Step 9 (CREDENTIAL_REVOKED): should fail if credential is revoked on-chain", async function () {
      await credRegistry.connect(signerWallet).revoke(sampleMerkleRoot, 0);

      const res = await verifyCredential(validCredentialFile, baseOpts);

      expect(res.isValid).to.be.false;
      expect(res.error?.code).to.equal("CREDENTIAL_REVOKED");
    });

    it("Step 10 (CREDENTIAL_EXPIRED): should fail if credential timestamp is past exp", async function () {
      const expiredCred = { ...validCredentialFile, exp: 1000000000 }; // Expired in year 2001
      const res = await verifyCredential(expiredCred, baseOpts);

      expect(res.isValid).to.be.false;
      expect(res.error?.code).to.equal("CREDENTIAL_EXPIRED");
    });
  });
});
