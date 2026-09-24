import { type Address } from "viem";
import { issuerRegistryAbi, credentialRegistryV3Abi } from "@/abis/V3Contracts";

// V3 Contract Addresses
// Priority: 
// 1. Environment variables
// 2. Default hardcoded local Hardhat network deployment fallback
export const ISSUER_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_ISSUER_REGISTRY_ADDRESS || 
  "0x5FbDB2315678afecb367f032d93F642f64180aa3") as Address;

export const CREDENTIAL_REGISTRY_V3_ADDRESS = (process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_V3_ADDRESS || 
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512") as Address;

export { issuerRegistryAbi, credentialRegistryV3Abi };
