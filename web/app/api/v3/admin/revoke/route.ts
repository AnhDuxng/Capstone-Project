import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { credentialId, txHash, revokedBy } = body;

    if (!credentialId || !txHash || !revokedBy) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", message: "Thông tin thu hồi không đầy đủ" },
        { status: 400 }
      );
    }

    const credential = await prisma.credentialV3.findUnique({
      where: { id: credentialId },
      include: { batch: true },
    });

    if (!credential) {
      return NextResponse.json(
        { ok: false, error: "CREDENTIAL_NOT_FOUND", message: "Không tìm thấy chứng chỉ để thu hồi" },
        { status: 404 }
      );
    }

    // Sync DB with onchain revocation state
    await prisma.$transaction(async (tx) => {
      // 1. Update credential status
      await tx.credentialV3.update({
        where: { id: credentialId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });

      // 2. Create revocation log
      await tx.revocationV3.create({
        data: {
          credentialId,
          merkleRoot: credential.batch.merkleRoot,
          batchIndex: credential.batchIndex,
          revokedBy,
          txHash,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      message: "Đồng bộ trạng thái thu hồi thành công",
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error syncing revocation:", err);
    return NextResponse.json(
      { ok: false, error: "SYNC_REVOCATION_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
