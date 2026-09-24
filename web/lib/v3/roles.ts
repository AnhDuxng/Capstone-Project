import { type Address } from "viem";
import { getPrivyClients } from "../privy";
import { ISSUER_REGISTRY_ADDRESS, issuerRegistryAbi } from "./contracts";

export interface UserRoleV3 {
  isAdmin: boolean;   // Owner of IssuerRegistry
  isIssuer: boolean;  // Registered signer in IssuerRegistry or Admin
  walletAddress: Address | null;
}

/**
 * Check user role for Phase 3 (EIP-712 Trust Anchor)
 * @param wallet Privy wallet object
 */
export async function checkUserRoleV3(wallet: {
  getEthereumProvider: () => Promise<unknown>;
}): Promise<UserRoleV3> {
  if (!ISSUER_REGISTRY_ADDRESS) {
    throw new Error("Missing ISSUER_REGISTRY_ADDRESS");
  }

  try {
    const { publicClient, account } = await getPrivyClients(wallet);

    // 1. Check if user is the Owner (Admin)
    const ownerAddress = (await publicClient.readContract({
      address: ISSUER_REGISTRY_ADDRESS,
      abi: issuerRegistryAbi,
      functionName: "owner",
    })) as Address;

    const isAdmin = ownerAddress.toLowerCase() === account.toLowerCase();

    // 2. Check if user is a registered Signer (Issuer)
    const isSigner = (await publicClient.readContract({
      address: ISSUER_REGISTRY_ADDRESS,
      abi: issuerRegistryAbi,
      functionName: "isSigner",
      args: [account],
    })) as boolean;

    return {
      isAdmin,
      isIssuer: isSigner || isAdmin, // Admin can also perform issuer actions
      walletAddress: account,
    };
  } catch (error) {
    console.error("Error checking V3 user role:", error);
    return {
      isAdmin: false,
      isIssuer: false,
      walletAddress: null,
    };
  }
}
