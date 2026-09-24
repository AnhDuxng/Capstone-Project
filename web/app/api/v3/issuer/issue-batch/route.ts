import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { ethers } from "ethers";
import { pinata } from "@/lib/pinata";
import { buildDomain, BkCredentialPayload, CredentialFile, Disclosure } from "@/lib/sdk/domain";
import { signCredential } from "@/lib/sdk/signer";
import { createDisclosure } from "@/lib/sdk/disclosure";
import { buildBatchTree } from "@/lib/sdk/merkle";
import { CREDENTIAL_REGISTRY_V3_ADDRESS } from "@/lib/v3/contracts";

export const runtime = "nodejs";

// Fallback private key for local dev: Hardhat Account #0
const FALLBACK_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { batchId, credentials, chainId = 31337 } = body;

    if (!batchId || !credentials || !Array.isArray(credentials) || credentials.length === 0) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", message: "Mã đợt và danh sách sinh viên không được để trống" },
        { status: 400 }
      );
    }

    // Check if batchId already exists
    const existingBatch = await prisma.batchV3.findUnique({
      where: { batchId },
    });
    if (existingBatch) {
      return NextResponse.json(
        { ok: false, error: "BATCH_EXISTS", message: `Đợt cấp với mã ${batchId} đã tồn tại trong hệ thống` },
        { status: 400 }
      );
    }

    // Get signer private key
    const privateKey = process.env.ISSUER_PRIVATE_KEY || FALLBACK_PRIVATE_KEY;
    const wallet = new ethers.Wallet(privateKey);
    const issuerAddress = wallet.address;

    // Build EIP-712 Domain
    const domain = buildDomain(
      CREDENTIAL_REGISTRY_V3_ADDRESS,
      chainId
    );

    // Prepare credentials payloads and disclosures
    const payloads: BkCredentialPayload[] = [];
    const disclosuresMap = new Map<string, Disclosure[]>();
    const emailMap = new Map<string, string>();
    const studentIdMap = new Map<string, string>();

    // We process each row and generate disclosures for private claims: fullName, dob, studentId
    for (let i = 0; i < credentials.length; i++) {
      const row = credentials[i];
      const credId = `urn:uuid:${uuidv4()}`;

      // Generate disclosures
      const nameDisc = createDisclosure("fullName", row.fullName);
      const dobDisc = createDisclosure("dob", row.dob);
      const idDisc = createDisclosure("studentId", row.studentId);

      const disclosures = [nameDisc.disclosure, dobDisc.disclosure, idDisc.disclosure];
      disclosuresMap.set(credId, disclosures);
      emailMap.set(credId, row.holderEmail || "");
      studentIdMap.set(credId, row.studentId);

      const privateClaims = [nameDisc.commitment, dobDisc.commitment, idDisc.commitment];

      payloads.push({
        credId,
        issuedAt: Math.floor(Date.now() / 1000),
        batchId,
        publicClaims: {
          vct: "BKISC_DEGREE",
          degreeTitle: row.degreeTitle,
          graduationDate: row.graduationDate,
          honors: row.honors || "",
        },
        privateClaims,
        merkleRoot: "", // Will populate after building Merkle tree
      });
    }

    // Build Merkle tree
    // We need to compute leaf tuples and build standard merkle tree.
    // Temporary pass payloads with empty merkleRoot to compute tree, then set root.
    const batchTree = buildBatchTree(payloads);
    const root = batchTree.root;

    // Update payloads with computed Merkle Root
    for (const payload of payloads) {
      payload.merkleRoot = root;
    }

    // Sign each credential and build final Credential Files
    const credentialFiles: CredentialFile[] = [];
    const signatures: string[] = [];

    for (const payload of payloads) {
      const sig = await signCredential(payload, wallet, domain);
      signatures.push(sig);

      const merkleProofData = batchTree.proofsMap.get(payload.credId);
      if (!merkleProofData) {
        throw new Error(`Failed to find Merkle proof for credential ${payload.credId}`);
      }

      credentialFiles.push({
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: "BkCredential",
        credId: payload.credId,
        issuedAt: Number(payload.issuedAt),
        batchId,
        issuer: {
          name: "Trường Đại học Bách khoa - ĐHQG-HCM",
          did: `did:ethr:${issuerAddress}`,
          signer: issuerAddress,
        },
        publicClaims: payload.publicClaims,
        privateClaims: payload.privateClaims,
        merkle: merkleProofData,
        signature: sig,
        disclosures: disclosuresMap.get(payload.credId),
      });
    }

    // Pin batch metadata to IPFS via Pinata (Optional fallback)
    let ipfsCid = "";
    try {
      if (process.env.PINATA_JWT) {
        const metadata = {
          batchId,
          merkleRoot: root,
          size: payloads.length,
          issuer: issuerAddress,
          createdAt: new Date().toISOString(),
        };
        const uploadRes = await pinata.upload.public.json(metadata);
        ipfsCid = uploadRes.cid;
      } else {
        ipfsCid = "QmDefaultFakeHashV3PendingSepoliaSetup";
      }
    } catch (pinErr) {
      console.warn("IPFS upload failed, fallback to default hash:", pinErr);
      ipfsCid = "QmDefaultFakeHashV3UploadFailed";
    }

    // Database writes inside a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create BatchV3
      await tx.batchV3.create({
        data: {
          batchId,
          merkleRoot: root,
          size: payloads.length,
          ipfsCid,
          issuerAddr: issuerAddress,
          chainId,
        },
      });

      // 2. Prepare bulk rows for Credentials & Disclosures
      const credRows: Array<{
        id: string;
        credId: string;
        batchId: string;
        batchIndex: number;
        holderEmail: string;
        studentId: string;
        vct: string;
        degreeTitle: string;
        graduationDate: string;
        honors: string;
        signature: string;
        merkleLeaf: string;
        merkleProof: string[];
        privateClaims: string[];
        credentialJson: string;
      }> = [];

      const disclosureRows: Array<{
        id: string;
        credentialId: string;
        salt: string;
        key: string;
        value: string;
        commitment: string;
      }> = [];

      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        const file = credentialFiles[i];
        const credDbId = uuidv4();

        credRows.push({
          id: credDbId,
          credId: payload.credId,
          batchId,
          batchIndex: file.merkle.index,
          holderEmail: emailMap.get(payload.credId) || "",
          studentId: studentIdMap.get(payload.credId) || "",
          vct: payload.publicClaims.vct,
          degreeTitle: payload.publicClaims.degreeTitle,
          graduationDate: payload.publicClaims.graduationDate,
          honors: payload.publicClaims.honors || "",
          signature: file.signature,
          merkleLeaf: file.merkle.leaf,
          merkleProof: file.merkle.proof,
          privateClaims: payload.privateClaims,
          credentialJson: JSON.stringify(file),
        });

        // Prepare Disclosures
        const disclosures = disclosuresMap.get(payload.credId) || [];
        for (const disc of disclosures) {
          const commitment = ethers.solidityPackedKeccak256(
            ["bytes32", "string", "string"],
            [disc.salt, disc.key, disc.value]
          );

          disclosureRows.push({
            id: uuidv4(),
            credentialId: credDbId,
            salt: disc.salt,
            key: disc.key,
            value: disc.value,
            commitment,
          });
        }
      }

      await tx.credentialV3.createMany({ data: credRows });
      if (disclosureRows.length > 0) {
        await tx.disclosureV3.createMany({ data: disclosureRows });
      }
    }, {
      timeout: 30000,
      maxWait: 10000,
    });

    return NextResponse.json({
      ok: true,
      merkleRoot: root,
      size: payloads.length,
      ipfsCid,
      batchId,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error issuing batch:", err);
    return NextResponse.json(
      { ok: false, error: "ISSUE_BATCH_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
