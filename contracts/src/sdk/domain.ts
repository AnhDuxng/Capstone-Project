/**
 * EIP-712 Domain & Type Builder for BK Credential System (Phase 3)
 *
 * @see SPEC.md §2 — EIP-712 Domain & Type Schema
 */

import { ethers } from "ethers";

// ─── Default Domain Constants ────────────────────────────────

export const DEFAULT_DOMAIN_NAME = "BKCredential";
export const DEFAULT_DOMAIN_VERSION = "3";
export const SEPOLIA_CHAIN_ID = 11155111;

// ─── Interfaces ──────────────────────────────────────────────

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: bigint | number;
  verifyingContract: string;
}

export interface PublicClaims {
  vct: string;
  degreeTitle: string;
  graduationDate: string; // ISO-8601: "YYYY-MM-DD"
  honors: string;
}

export interface BkCredentialPayload {
  credId: string;
  issuedAt: bigint | number;
  batchId: string;
  publicClaims: PublicClaims;
  privateClaims: string[]; // bytes32 hex commitments
  merkleRoot: string; // bytes32 hex
}

export interface IssuerInfo {
  name: string;
  did: string;
  signer: string; // 0x... address
}

export interface MerkleProofData {
  root: string;
  leaf: string;
  proof: string[];
  index: number;
}

export interface Disclosure {
  salt: string;
  key: string;
  value: string;
}

export interface CredentialFile {
  "@context": string;
  type: string;
  credId: string;
  issuedAt: number;
  batchId: string;
  issuer: IssuerInfo;
  publicClaims: PublicClaims;
  privateClaims: string[];
  merkle: MerkleProofData;
  signature: string;
  disclosures?: Disclosure[];
  exp?: number;
}

// ─── EIP-712 Types Specification ────────────────────────────

export const CREDENTIAL_EIP712_TYPES: Record<string, ethers.TypedDataField[]> = {
  PublicClaims: [
    { name: "vct", type: "string" },
    { name: "degreeTitle", type: "string" },
    { name: "graduationDate", type: "string" },
    { name: "honors", type: "string" },
  ],
  BkCredential: [
    { name: "credId", type: "string" },
    { name: "issuedAt", type: "uint64" },
    { name: "batchId", type: "string" },
    { name: "publicClaims", type: "PublicClaims" },
    { name: "privateClaims", type: "bytes32[]" },
    { name: "merkleRoot", type: "bytes32" },
  ],
};

// ─── Domain Builder ──────────────────────────────────────────

/**
 * Builds the EIP-712 Domain Separator object.
 *
 * @param verifyingContract Address of the CredentialRegistryV3 contract.
 * @param chainId Chain ID (e.g. 11155111 for Sepolia, 31337 for Hardhat local).
 * @param name Domain name (defaults to "BKCredential").
 * @param version Domain version (defaults to "3").
 */
export function buildDomain(
  verifyingContract: string,
  chainId: number | bigint = SEPOLIA_CHAIN_ID,
  name: string = DEFAULT_DOMAIN_NAME,
  version: string = DEFAULT_DOMAIN_VERSION
): EIP712Domain {
  if (!ethers.isAddress(verifyingContract)) {
    throw new Error(`Invalid verifyingContract address: ${verifyingContract}`);
  }

  return {
    name,
    version,
    chainId,
    verifyingContract: ethers.getAddress(verifyingContract), // Checksummed address
  };
}

/**
 * Returns the EIP-712 type definition map for signing and verification.
 * Standard template matches SPEC.md §2.5.
 */
export function credentialTypes() {
  return CREDENTIAL_EIP712_TYPES;
}
