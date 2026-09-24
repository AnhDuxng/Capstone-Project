/**
 * Merkle Tree Utility for Batch Issuance (Phase 3)
 *
 * Wrapper on OpenZeppelin StandardMerkleTree for building batch Merkle trees
 * and generating proofs for individual credentials.
 *
 * Leaf structure: [credId (string), publicClaimsHash (bytes32), privateClaimsHash (bytes32)]
 *
 * @see SPEC.md §6 — Merkle Tree Scheme
 */

import { ethers } from "ethers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { BkCredentialPayload, MerkleProofData, credentialTypes } from "./domain";

export interface BatchTreeResult {
  root: string; // 0x... 32-byte hex root
  proofsMap: Map<string, MerkleProofData>; // credId -> MerkleProofData
  tree: StandardMerkleTree<[string, string, string]>;
}

export type LeafTuple = [string, string, string]; // [credId, publicClaimsHash, privateClaimsHash]

/**
 * Computes the public claims hash for a credential payload using EIP-712 struct hash.
 */
export function computePublicClaimsHash(publicClaims: BkCredentialPayload["publicClaims"]): string {
  const types = credentialTypes();
  return ethers.TypedDataEncoder.hashStruct(
    "PublicClaims",
    { PublicClaims: types.PublicClaims },
    publicClaims
  );
}

/**
 * Computes the private claims hash for a credential payload by ABI encoding the privateClaims array.
 */
export function computePrivateClaimsHash(privateClaims: string[]): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32[]"],
      [privateClaims]
    )
  );
}

/**
 * Computes the leaf tuple [credId, publicClaimsHash, privateClaimsHash] for a credential payload.
 */
export function computeLeafTuple(cred: BkCredentialPayload): LeafTuple {
  const publicClaimsHash = computePublicClaimsHash(cred.publicClaims);
  const privateClaimsHash = computePrivateClaimsHash(cred.privateClaims);
  return [cred.credId, publicClaimsHash, privateClaimsHash];
}

/**
 * Builds an OpenZeppelin StandardMerkleTree from a batch of credential payloads.
 *
 * @param credentials Array of BkCredentialPayload objects.
 * @returns BatchTreeResult containing Merkle root, proof map indexed by credId, and tree object.
 */
export function buildBatchTree(credentials: BkCredentialPayload[]): BatchTreeResult {
  if (!Array.isArray(credentials) || credentials.length === 0) {
    throw new Error("buildBatchTree requires a non-empty array of credential payloads");
  }

  // Map credentials to leaf tuples
  const leafTuples: LeafTuple[] = credentials.map((c) => computeLeafTuple(c));

  // Construct OpenZeppelin StandardMerkleTree
  const tree = StandardMerkleTree.of(leafTuples, ["string", "bytes32", "bytes32"]);
  const root = tree.root;

  const proofsMap = new Map<string, MerkleProofData>();

  for (const [i, v] of tree.entries()) {
    const credId = v[0];
    const leafHash = tree.leafHash(v);
    const proof = tree.getProof(i);

    proofsMap.set(credId, {
      root,
      leaf: leafHash,
      proof,
      index: i,
    });
  }

  return {
    root,
    proofsMap,
    tree,
  };
}

/**
 * Verifies a Merkle proof against a known root.
 *
 * @param root Merkle root (bytes32 hex).
 * @param leafTuple [credId, publicClaimsHash, privateClaimsHash].
 * @param proof Array of bytes32 hex proof hashes.
 */
export function verifyMerkleProof(
  root: string,
  leafTuple: LeafTuple,
  proof: string[]
): boolean {
  try {
    return StandardMerkleTree.verify(
      root,
      ["string", "bytes32", "bytes32"],
      leafTuple,
      proof
    );
  } catch {
    return false;
  }
}
