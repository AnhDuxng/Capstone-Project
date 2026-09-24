import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("=== SEPOLIA ACCOUNT CHECK ===");
  console.log("Địa chỉ ví :", signer.address);
  console.log("Số dư      :", ethers.formatEther(balance), "SepoliaETH");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
