/**
 * Rector (Principal) Approval — shared between client and server.
 *
 * The rector's signing key lives in an encrypted keystore file on a removable
 * USB drive (demo stand-in for a hardware PKI token). Before a batch can be
 * anchored, the rector signs an EIP-191 message binding the exact batch
 * (batchId + merkleRoot + size + chainId) and a timestamp.
 */

export const RECTOR_APPROVAL_MAX_AGE_SEC = 10 * 60; // approval valid for 10 minutes

export interface RectorApprovalInput {
  batchId: string;
  merkleRoot: string;
  size: number;
  chainId: number;
  approvedAt: number; // unix seconds
}

export function buildRectorApprovalMessage(a: RectorApprovalInput): string {
  return [
    "BK Credential - Rector Batch Approval",
    `Batch ID: ${a.batchId}`,
    `Merkle Root: ${a.merkleRoot.toLowerCase()}`,
    `Size: ${a.size}`,
    `Chain ID: ${a.chainId}`,
    `Approved At: ${a.approvedAt}`,
  ].join("\n");
}
