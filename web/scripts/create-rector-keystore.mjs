#!/usr/bin/env node
/**
 * Create the Rector's encrypted keystore file to be copied onto a USB drive.
 *
 * Usage:
 *   node scripts/create-rector-keystore.mjs <PIN> [outputPath]
 * Example:
 *   node scripts/create-rector-keystore.mjs 246810 E:\BKCRED_TOKEN\rector.keystore.json
 *
 * The private key never touches the server: it is encrypted (scrypt + AES-128-CTR,
 * standard Ethereum keystore v3) with the PIN and only decrypted in the browser.
 */
import { Wallet } from "ethers";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [, , pin, outArg] = process.argv;
if (!pin || pin.length < 6) {
  console.error("PIN must be at least 6 characters.\nUsage: node scripts/create-rector-keystore.mjs <PIN> [outputPath]");
  process.exit(1);
}

const out = resolve(outArg || "rector.keystore.json");
const wallet = Wallet.createRandom();

console.log("Encrypting keystore (scrypt, may take a few seconds)...");
const json = await wallet.encrypt(pin);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, json, "utf8");

console.log("\n✅ Keystore created:", out);
console.log("Rector address:", wallet.address);
console.log("\nAdd these lines to web/.env, then restart `npm run dev`:");
console.log(`RECTOR_ADDRESS=${wallet.address}`);
console.log(`NEXT_PUBLIC_RECTOR_ADDRESS=${wallet.address}`);
console.log(`NEXT_PUBLIC_RECTOR_NAME="Hiệu trưởng - Trường ĐH Bách Khoa"`);
console.log("\n⚠️  Keep a backup copy of the keystore file and remember the PIN.");
