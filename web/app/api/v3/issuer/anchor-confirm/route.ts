import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { batchId, txHash } = body;

    if (!batchId || !txHash) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", message: "Mã đợt và Hash giao dịch không được để trống" },
        { status: 400 }
      );
    }

    const batch = await prisma.batchV3.findUnique({
      where: { batchId },
    });

    if (!batch) {
      return NextResponse.json(
        { ok: false, error: "BATCH_NOT_FOUND", message: `Không tìm thấy đợt cấp với mã ${batchId}` },
        { status: 404 }
      );
    }

    // Update the transaction details
    const updatedBatch = await prisma.batchV3.update({
      where: { batchId },
      data: {
        txHash,
        anchoredAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      batch: updatedBatch,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error confirming anchor transaction:", err);
    return NextResponse.json(
      { ok: false, error: "ANCHOR_CONFIRM_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
