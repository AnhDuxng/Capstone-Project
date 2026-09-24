import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=== Phase 3 Deploy ===");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  console.log();

  // ── 1. Deploy IssuerRegistry ──────────────────────────────────
  console.log("Deploying IssuerRegistry...");
  const IssuerRegistry = await ethers.getContractFactory("IssuerRegistry");
  const issuerRegistry = await IssuerRegistry.deploy(deployer.address);
  await issuerRegistry.waitForDeployment();

  const issuerAddr = await issuerRegistry.getAddress();
  console.log("IssuerRegistry deployed to:", issuerAddr);

  // ── 2. Deploy CredentialRegistryV3 ────────────────────────────
  console.log("\nDeploying CredentialRegistryV3...");
  const CredentialRegistryV3 = await ethers.getContractFactory("CredentialRegistryV3");
  const credRegistry = await CredentialRegistryV3.deploy(deployer.address, issuerAddr);
  await credRegistry.waitForDeployment();

  const credAddr = await credRegistry.getAddress();
  console.log("CredentialRegistryV3 deployed to:", credAddr);

  // ── 3. Add deployer as default signer ─────────────────────────
  console.log("\nAdding deployer as signer...");
  const tx = await issuerRegistry.addSigner(deployer.address, "0x");
  await tx.wait();
  console.log("Signer added:", deployer.address);

  // ── 4. Save Deployment Manifest ──────────────────────────────
  const chainId = (await ethers.provider.getNetwork()).chainId.toString();
  const deploymentData = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    contracts: {
      IssuerRegistry: issuerAddr,
      CredentialRegistryV3: credAddr,
    },
    defaultSigner: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(__dirname, "../deployments-v3.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2), "utf-8");
  console.log("\nDeployment manifest saved to:", outputPath);

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n=== Phase 3 Deployment Summary ===");
  console.log("Network:              ", network.name, `(Chain ID: ${chainId})`);
  console.log("IssuerRegistry:       ", issuerAddr);
  console.log("CredentialRegistryV3: ", credAddr);
  console.log("Default Signer:       ", deployer.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
