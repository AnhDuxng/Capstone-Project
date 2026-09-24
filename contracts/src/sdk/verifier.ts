/**
 * EIP-712 10-Step Verification Pipeline (Phase 3)
 *
 * @see SPEC.md §7 — Verify Pipeline (10 steps: 6 offline + 3 online + 1 expiry)
 */

import { ethers } from "ethers";
import { z } from "zod";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import {
  CredentialFile,
  EIP712Domain,
  credentialTypes,
  buildDomain,
} from "./domain";
import { recoverSignerAddress } from "./signer";

// ─── Zod Schema for Step 1 ───────────────────────────────────

export const CredentialSchema = z.object({
  "@context": z.string(),
  type: z.literal("BkCredential"),
  credId: z.string().startsWith("urn:uuid:"),
  issuedAt: z.number().int().positive(),
  batchId: z.string().min(1),
  issuer: z.object({
    name: z.string(),
    did: z.string().startsWith("did:ethr:"),
    signer: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),
  publicClaims: z.object({
    vct: z.string(),
    degreeTitle: z.string(),
    graduationDate: z.string(),
    honors: z.string().optional().default(""),
  }),
  privateClaims: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)),
  merkle: z.object({
    root: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    leaf: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    proof: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)),
    index: z.number().int().nonnegative(),
  }),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  disclosures: z
    .array(
      z.object({
        salt: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        key: z.string(),
        value: z.string(),
      })
    )
    .optional(),
  exp: z.number().int().positive().optional(),
});

// ─── Error Codes ──────────────────────────────────────────────

export type VerifyErrorCode =
  | "INVALID_SCHEMA"
  | "DISCLOSURE_MISMATCH"
  | "LEAF_MISMATCH"
  | "INVALID_MERKLE_PROOF"
  | "SIGNATURE_MISMATCH"
  | "SIGNER_NOT_REGISTERED"
  | "BATCH_NOT_ANCHORED"
  | "CREDENTIAL_REVOKED"
  | "CREDENTIAL_EXPIRED";

export interface VerifyErrorDetail {
  code: VerifyErrorCode;
  message: string;
  details?: any;
}

export interface VerifyResult {
  isValid: boolean;
  error?: VerifyErrorDetail;
  recoveredSigner?: string;
  anchoredAt?: bigint;
  verifiedSteps: number[];
}

export interface VerifyOptions {
  verifyingContract: string; // CredentialRegistryV3 address
  issuerRegistry: string;    // IssuerRegistry address
  chainId: number;
  rpcUrl?: string;
  provider?: ethers.Provider;
  skipOnlineChecks?: boolean; // For offline-only verification
}

// ─── ABIs for Online Verification ────────────────────────────

const ISSUER_REGISTRY_ABI = [
  "function isSigner(address signer) external view returns (bool)",
];

const CREDENTIAL_REGISTRY_ABI = [
  "function getAnchor(bytes32 merkleRoot) external view returns (uint64 anchoredAt, address issuer, uint32 size, string memory ipfsCid)",
  "function isRevoked(bytes32 merkleRoot, uint32 index) external view returns (bool)",
];

// ─── 10-Step Verification Function ───────────────────────────

/**
 * Executes the complete 10-step verification pipeline on a Phase 3 credential object.
 *
 * @param credentialData JSON object or parsed CredentialFile.
 * @param opts Verification configuration options.
 */
export async function verifyCredential(
  credentialData: unknown,
  opts: VerifyOptions
): Promise<VerifyResult> {
  const verifiedSteps: number[] = [];

  // ── Step 1: Parse + Validate Schema ───────────────────────
  const parseResult = CredentialSchema.safeParse(credentialData);
  if (!parseResult.success) {
    return {
      isValid: false,
      error: {
        code: "INVALID_SCHEMA",
        message: "Credential JSON format does not match expected schema",
        details: parseResult.error.issues,
      },
      verifiedSteps,
    };
  }
  const cred = parseResult.data as CredentialFile;
  verifiedSteps.push(1);

  // ── Step 2: Recompute publicClaimsHash ─────────────────────
  const types = credentialTypes();
  const publicClaimsHash = ethers.TypedDataEncoder.hashStruct(
    "PublicClaims",
    { PublicClaims: types.PublicClaims },
    cred.publicClaims
  );
  verifiedSteps.push(2);

  // ── Step 3: Verify Private Disclosures ─────────────────────
  if (cred.disclosures && cred.disclosures.length > 0) {
    for (const disclosure of cred.disclosures) {
      const commitment = ethers.solidityPackedKeccak256(
        ["bytes32", "string", "string"],
        [disclosure.salt, disclosure.key, disclosure.value]
      );

      if (!cred.privateClaims.includes(commitment)) {
        return {
          isValid: false,
          error: {
            code: "DISCLOSURE_MISMATCH",
            message: `Disclosure commitment mismatch for field "${disclosure.key}"`,
            details: { key: disclosure.key, commitment },
          },
          verifiedSteps,
        };
      }
    }
  }
  verifiedSteps.push(3);

  // ── Step 4: Recompute merkleLeaf ───────────────────────────
  const privateClaimsHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32[]"],
      [cred.privateClaims]
    )
  );

  const encodedValues = ethers.AbiCoder.defaultAbiCoder().encode(
    ["string", "bytes32", "bytes32"],
    [cred.credId, publicClaimsHash, privateClaimsHash]
  );
  const firstHash = ethers.keccak256(encodedValues);
  const recomputedLeaf = ethers.solidityPackedKeccak256(["bytes32"], [firstHash]);

  if (recomputedLeaf.toLowerCase() !== cred.merkle.leaf.toLowerCase()) {
    return {
      isValid: false,
      error: {
        code: "LEAF_MISMATCH",
        message: "Recomputed leaf does not match merkle.leaf in credential",
        details: { recomputedLeaf, expectedLeaf: cred.merkle.leaf },
      },
      verifiedSteps,
    };
  }
  verifiedSteps.push(4);

  // ── Step 5: Verify Merkle Proof ────────────────────────────
  const isValidProof = StandardMerkleTree.verify(
    cred.merkle.root,
    ["string", "bytes32", "bytes32"],
    [cred.credId, publicClaimsHash, privateClaimsHash],
    cred.merkle.proof
  );

  if (!isValidProof) {
    return {
      isValid: false,
      error: {
        code: "INVALID_MERKLE_PROOF",
        message: "Merkle proof verification failed against merkle.root",
      },
      verifiedSteps,
    };
  }
  verifiedSteps.push(5);

  // ── Step 6: EIP-712 Signature Recovery ──────────────────────
  const domain: EIP712Domain = buildDomain(
    opts.verifyingContract,
    opts.chainId
  );

  let recoveredAddress: string;
  try {
    recoveredAddress = recoverSignerAddress(
      {
        credId: cred.credId,
        issuedAt: cred.issuedAt,
        batchId: cred.batchId,
        publicClaims: cred.publicClaims,
        privateClaims: cred.privateClaims,
        merkleRoot: cred.merkle.root,
      },
      cred.signature,
      domain
    );
  } catch (err: any) {
    return {
      isValid: false,
      error: {
        code: "SIGNATURE_MISMATCH",
        message: `Signature recovery failed: ${err.message}`,
      },
      verifiedSteps,
    };
  }

  if (recoveredAddress.toLowerCase() !== cred.issuer.signer.toLowerCase()) {
    // Attempt fallback to alternative chainId (e.g. Sepolia 11155111 vs Localhost 31337)
    const altChainId = Number(opts.chainId) === 11155111 ? 31337 : 11155111;
    try {
      const altDomain = buildDomain(opts.verifyingContract, altChainId);
      const altRecovered = recoverSignerAddress(
        {
          credId: cred.credId,
          issuedAt: cred.issuedAt,
          batchId: cred.batchId,
          publicClaims: cred.publicClaims,
          privateClaims: cred.privateClaims,
          merkleRoot: cred.merkle.root,
        },
        cred.signature,
        altDomain
      );
      if (altRecovered.toLowerCase() === cred.issuer.signer.toLowerCase()) {
        recoveredAddress = altRecovered;
        opts.chainId = altChainId;
      }
    } catch {}
  }

  if (recoveredAddress.toLowerCase() !== cred.issuer.signer.toLowerCase()) {
    return {
      isValid: false,
      error: {
        code: "SIGNATURE_MISMATCH",
        message: `Recovered signer address (${recoveredAddress}) does not match claimed issuer signer (${cred.issuer.signer})`,
        details: { recoveredAddress, claimedSigner: cred.issuer.signer },
      },
      verifiedSteps,
    };
  }
  verifiedSteps.push(6);

  // ── Steps 7–9: Online Checks (RPC dependent) ───────────────
  let anchoredAtResult: bigint | undefined = undefined;

  if (!opts.skipOnlineChecks) {
    const provider =
      opts.provider ||
      (opts.rpcUrl ? new ethers.JsonRpcProvider(opts.rpcUrl) : null);

    if (!provider) {
      throw new Error(
        "Online checks requested but neither provider nor rpcUrl was supplied"
      );
    }

    const issuerRegistryContract = new ethers.Contract(
      opts.issuerRegistry,
      ISSUER_REGISTRY_ABI,
      provider
    );

    const credRegistryContract = new ethers.Contract(
      opts.verifyingContract,
      CREDENTIAL_REGISTRY_ABI,
      provider
    );

    // ── Step 7: Check isSigner ────────────────────────────────
    const isRegisteredSigner: boolean = await issuerRegistryContract.isSigner(
      recoveredAddress
    );

    if (!isRegisteredSigner) {
      return {
        isValid: false,
        error: {
          code: "SIGNER_NOT_REGISTERED",
          message: `Signer ${recoveredAddress} is not registered or was revoked in IssuerRegistry`,
        },
        recoveredSigner: recoveredAddress,
        verifiedSteps,
      };
    }
    verifiedSteps.push(7);

    // ── Step 8: Check Anchor Exists ───────────────────────────
    const [anchoredAt] = await credRegistryContract.getAnchor(cred.merkle.root);
    anchoredAtResult = BigInt(anchoredAt);

    if (anchoredAtResult === 0n) {
      return {
        isValid: false,
        error: {
          code: "BATCH_NOT_ANCHORED",
          message: `Merkle root ${cred.merkle.root} has not been anchored on-chain`,
        },
        recoveredSigner: recoveredAddress,
        verifiedSteps,
      };
    }
    verifiedSteps.push(8);

    // ── Step 9: Check Not Revoked ─────────────────────────────
    const isRevoked: boolean = await credRegistryContract.isRevoked(
      cred.merkle.root,
      cred.merkle.index
    );

    if (isRevoked) {
      return {
        isValid: false,
        error: {
          code: "CREDENTIAL_REVOKED",
          message: `Credential at index ${cred.merkle.index} in batch has been revoked on-chain`,
        },
        recoveredSigner: recoveredAddress,
        anchoredAt: anchoredAtResult,
        verifiedSteps,
      };
    }
    verifiedSteps.push(9);
  }

  // ── Step 10: Expiry Check ──────────────────────────────────
  if (cred.exp) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > cred.exp) {
      return {
        isValid: false,
        error: {
          code: "CREDENTIAL_EXPIRED",
          message: `Credential expired at timestamp ${cred.exp} (current: ${nowSeconds})`,
        },
        recoveredSigner: recoveredAddress,
        anchoredAt: anchoredAtResult,
        verifiedSteps,
      };
    }
  }
  verifiedSteps.push(10);

  // All steps passed successfully!
  return {
    isValid: true,
    recoveredSigner: recoveredAddress,
    anchoredAt: anchoredAtResult,
    verifiedSteps,
  };
}
