import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const batch = await prisma.batchV3.findUnique({
      where: { id },
    });

    if (!batch) {
      return NextResponse.json(
        { ok: false, error: "BATCH_NOT_FOUND", message: "Không tìm thấy đợt phát hành" },
        { status: 404 }
      );
    }

    const credentials = await prisma.credentialV3.findMany({
      where: { batchId: batch.batchId },
      orderBy: { batchIndex: "asc" },
      select: {
        id: true,
        credId: true,
        batchIndex: true,
        studentId: true,
        degreeTitle: true,
        graduationDate: true,
        honors: true,
        holderEmail: true,
        isRevoked: true,
        revokedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      batch,
      credentials,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching batch details:", err);
    return NextResponse.json(
      { ok: false, error: "FETCH_BATCH_DETAILS_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
