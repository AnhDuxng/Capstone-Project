/**
 * EIP-712 Credential Signing & Signature Verification Module (Phase 3)
 *
 * @see SPEC.md §2 — EIP-712 Domain & Type Schema
 * @see SPEC.md §3.4 — Signature Verification Pipeline
 */

import { ethers } from "ethers";
import {
  BkCredentialPayload,
  EIP712Domain,
  credentialTypes,
} from "./domain";

/**
 * Signs a BkCredential payload using an Ethereum private key or Wallet signer.
 *
 * @param payload Credential data payload to sign.
 * @param signer Private key hex string OR an ethers.Signer instance.
 * @param domain EIP-712 Domain Separator.
 * @returns 65-byte signature hex string (0x... r, s, v).
 */
export async function signCredential(
  payload: BkCredentialPayload,
  signer: ethers.Signer | string,
  domain: EIP712Domain
): Promise<string> {
  validatePayload(payload);

  const walletSigner =
    typeof signer === "string" ? new ethers.Wallet(signer) : signer;

  const message = formatTypedMessage(payload);
  const types = credentialTypes();

  return await walletSigner.signTypedData(domain, types, message);
}

/**
 * Recovers the Ethereum address that created the EIP-712 signature for a credential payload.
 *
 * @param payload Credential payload object.
 * @param signature 65-byte signature hex string.
 * @param domain EIP-712 Domain Separator.
 * @returns Recovered Ethereum address string (checksummed).
 */
export function recoverSignerAddress(
  payload: BkCredentialPayload,
  signature: string,
  domain: EIP712Domain
): string {
  validatePayload(payload);

  if (!signature || !ethers.isHexString(signature) || signature.length !== 132) {
    throw new Error("Invalid signature: must be a 65-byte hex string (132 chars)");
  }

  const message = formatTypedMessage(payload);
  const types = credentialTypes();

  return ethers.verifyTypedData(domain, types, message, signature);
}

/**
 * Verifies if an EIP-712 signature for a credential payload matches the expected signer address.
 *
 * @param payload Credential payload object.
 * @param signature 65-byte signature hex string.
 * @param expectedSignerAddress Address of the expected signer.
 * @param domain EIP-712 Domain Separator.
 * @returns True if signature is valid and matches expectedSignerAddress.
 */
export function verifySignature(
  payload: BkCredentialPayload,
  signature: string,
  expectedSignerAddress: string,
  domain: EIP712Domain
): boolean {
  if (!ethers.isAddress(expectedSignerAddress)) {
    throw new Error(`Invalid expectedSignerAddress: ${expectedSignerAddress}`);
  }

  try {
    const recovered = recoverSignerAddress(payload, signature, domain);
    return recovered.toLowerCase() === expectedSignerAddress.toLowerCase();
  } catch {
    return false;
  }
}

// ─── Internal Helpers ────────────────────────────────────────

function validatePayload(payload: BkCredentialPayload): void {
  if (!payload) throw new Error("Payload is required");
  if (!payload.credId || typeof payload.credId !== "string") {
    throw new Error("Payload must contain a non-empty credId");
  }
  if (!payload.batchId || typeof payload.batchId !== "string") {
    throw new Error("Payload must contain a non-empty batchId");
  }
  if (!payload.publicClaims) {
    throw new Error("Payload must contain publicClaims object");
  }
  if (!payload.merkleRoot || !ethers.isHexString(payload.merkleRoot, 32)) {
    throw new Error("Payload merkleRoot must be a valid 32-byte hex string (0x...)");
  }
  if (!Array.isArray(payload.privateClaims)) {
    throw new Error("Payload privateClaims must be an array of bytes32 strings");
  }
  for (const claim of payload.privateClaims) {
    if (!ethers.isHexString(claim, 32)) {
      throw new Error(`Invalid privateClaim commitment: ${claim}. Must be a 32-byte hex string.`);
    }
  }
}

function formatTypedMessage(payload: BkCredentialPayload) {
  return {
    credId: payload.credId,
    issuedAt: BigInt(payload.issuedAt),
    batchId: payload.batchId,
    publicClaims: {
      vct: payload.publicClaims.vct || "",
      degreeTitle: payload.publicClaims.degreeTitle || "",
      graduationDate: payload.publicClaims.graduationDate || "",
      honors: payload.publicClaims.honors || "",
    },
    privateClaims: payload.privateClaims,
    merkleRoot: payload.merkleRoot,
  };
}
