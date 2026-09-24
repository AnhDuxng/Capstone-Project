/**
 * Selective Disclosure Helpers for EIP-712 Credentials (Phase 3)
 *
 * Uses Salted-Hash commitment scheme:
 *   commitment = keccak256(abi.encodePacked(salt, key, value))
 *
 * @see SPEC.md §4 — Selective Disclosure
 */

import { ethers } from "ethers";
import { Disclosure } from "./domain";

export interface CreateDisclosureResult {
  disclosure: Disclosure;
  commitment: string; // bytes32 hex
}

/**
 * Creates a salted disclosure and its corresponding 32-byte commitment hash.
 *
 * @param key Property/claim name (e.g. "fullName", "studentId", "dob").
 * @param value Claim string value (e.g. "Trần Lê Công Minh", "1910001").
 * @param salt Optional 32-byte hex salt string. If omitted, a cryptographically secure random 32-byte salt is generated.
 */
export function createDisclosure(
  key: string,
  value: string,
  salt?: string
): CreateDisclosureResult {
  if (!key || typeof key !== "string") {
    throw new Error("createDisclosure requires a non-empty key string");
  }
  if (value === undefined || value === null) {
    throw new Error("createDisclosure requires a valid value string");
  }

  let finalSalt = salt;
  if (!finalSalt) {
    finalSalt = ethers.hexlify(ethers.randomBytes(32));
  } else if (!ethers.isHexString(finalSalt, 32)) {
    throw new Error(`Invalid salt: ${salt}. Must be a 32-byte hex string.`);
  }

  const commitment = computeDisclosureCommitment(finalSalt, key, value);

  return {
    disclosure: {
      salt: finalSalt,
      key,
      value: String(value),
    },
    commitment,
  };
}

/**
 * Computes the keccak256 salted-hash commitment for a given salt, key, and value.
 * Uses abi.encodePacked(salt, key, value) via ethers.solidityPackedKeccak256.
 */
export function computeDisclosureCommitment(
  salt: string,
  key: string,
  value: string
): string {
  return ethers.solidityPackedKeccak256(
    ["bytes32", "string", "string"],
    [salt, key, String(value)]
  );
}

/**
 * Verifies whether a given disclosure matches an expected commitment hash or is included in a list of privateClaims commitments.
 *
 * @param disclosure The disclosure object containing salt, key, and value.
 * @param expectedCommitment A 32-byte commitment hex string OR an array of 32-byte commitment hex strings.
 */
export function verifyDisclosure(
  disclosure: Disclosure,
  expectedCommitment: string | string[]
): boolean {
  if (!disclosure || !disclosure.salt || !disclosure.key) {
    return false;
  }

  try {
    const computed = computeDisclosureCommitment(
      disclosure.salt,
      disclosure.key,
      disclosure.value
    );

    if (Array.isArray(expectedCommitment)) {
      return expectedCommitment.some(
        (c) => c.toLowerCase() === computed.toLowerCase()
      );
    }

    return computed.toLowerCase() === expectedCommitment.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Converts an array of disclosures or CreateDisclosureResults into an array of bytes32 commitment hashes for privateClaims.
 *
 * @param disclosures Array of disclosures or CreateDisclosureResult objects.
 * @returns Array of 32-byte hex commitment strings.
 */
export function buildPrivateClaims(
  disclosures: (Disclosure | CreateDisclosureResult)[]
): string[] {
  if (!Array.isArray(disclosures)) {
    throw new Error("buildPrivateClaims requires an array of disclosures");
  }

  return disclosures.map((item) => {
    if ("commitment" in item && typeof item.commitment === "string") {
      return item.commitment;
    }
    const disc = item as Disclosure;
    return computeDisclosureCommitment(disc.salt, disc.key, disc.value);
  });
}

/**
 * Filters disclosures for Selective Disclosure sharing (e.g. Holder selects which fields to reveal).
 *
 * @param disclosures Full array of available disclosures.
 * @param selectedKeys Array of keys the holder explicitly chose to share.
 */
export function filterDisclosures(
  disclosures: Disclosure[],
  selectedKeys: string[]
): Disclosure[] {
  if (!Array.isArray(disclosures)) return [];
  const keySet = new Set(selectedKeys);
  return disclosures.filter((d) => keySet.has(d.key));
}
