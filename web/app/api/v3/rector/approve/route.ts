import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { prisma } from "@/lib/prisma";
import {
  buildRectorApprovalMessage,
  RECTOR_APPROVAL_MAX_AGE_SEC,
} from "@/lib/v3/rectorApproval";

export const runtime = "nodejs";

/**
 * POST /api/v3/rector/approve
 * Verifies the rector's USB-keystore signature over a specific batch.
 * Body: { batchId, merkleRoot, size, chainId, approvedAt, signature }
 */
export async function POST(req: Request) {
  try {
    const rectorAddress = process.env.RECTOR_ADDRESS;
    if (!rectorAddress) {
      return NextResponse.json(
        { ok: false, error: "NOT_CONFIGURED", message: "Chưa cấu hình RECTOR_ADDRESS trên máy chủ" },
        { status: 500 }
      );
    }

    const { batchId, merkleRoot, size, chainId, approvedAt, signature } = await req.json();
    if (!batchId || !merkleRoot || !signature || typeof approvedAt !== "number") {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", message: "Thiếu dữ liệu phê duyệt" },
        { status: 400 }
      );
    }

    // 1. Freshness: prevent replay of an old approval
    const now = Math.floor(Date.now() / 1000);
    if (approvedAt > now + 60 || now - approvedAt > RECTOR_APPROVAL_MAX_AGE_SEC) {
      return NextResponse.json(
        { ok: false, error: "APPROVAL_EXPIRED", message: "Chữ ký phê duyệt đã hết hạn, vui lòng ký lại" },
        { status: 400 }
      );
    }

    // 2. The approval must match the batch actually stored on the server
    const batch = await prisma.batchV3.findUnique({ where: { batchId } });
    if (!batch) {
      return NextResponse.json(
        { ok: false, error: "BATCH_NOT_FOUND", message: `Không tìm thấy đợt ${batchId}` },
        { status: 404 }
      );
    }
    if (batch.merkleRoot.toLowerCase() !== String(merkleRoot).toLowerCase() || batch.size !== Number(size)) {
      return NextResponse.json(
        { ok: false, error: "BATCH_MISMATCH", message: "Merkle Root/số lượng không khớp với đợt trên máy chủ" },
        { status: 400 }
      );
    }

    // 3. Recover signer and compare with the registered rector address
    const message = buildRectorApprovalMessage({
      batchId,
      merkleRoot,
      size: Number(size),
      chainId: Number(chainId),
      approvedAt,
    });
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== rectorAddress.toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "NOT_RECTOR", message: "Chữ ký không thuộc về Hiệu trưởng đã đăng ký" },
        { status: 403 }
      );
    }

    console.log(`[rector-approve] batch=${batchId} root=${merkleRoot} approvedBy=${recovered} at=${approvedAt}`);

    return NextResponse.json({ ok: true, rectorAddress: recovered, approvedAt });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, error: "INTERNAL", message: err.message || "Lỗi xác minh phê duyệt" },
      { status: 500 }
    );
  }
}
