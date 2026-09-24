import { ethers } from "hardhat";

async function main() {
  const issuerRegistryAddr = "0x5B7f91FF33EB0032Ce803aCF2B9f00a6DbaD744F";
  const signerToAdd = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const IssuerRegistry = await ethers.getContractFactory("IssuerRegistry");
  const issuer = IssuerRegistry.attach(issuerRegistryAddr);

  console.log(`Adding ${signerToAdd} as authorized signer on Sepolia...`);
  const tx = await (issuer as any).addSigner(signerToAdd, "0x");
  console.log("Transaction sent:", tx.hash);
  await tx.wait();
  console.log("Transaction confirmed!");

  const isSigner = await (issuer as any).isSigner(signerToAdd);
  console.log(`isSigner(${signerToAdd}):`, isSigner);
}

main().catch(console.error);
