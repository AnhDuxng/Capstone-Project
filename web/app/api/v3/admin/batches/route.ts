import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const batches = await prisma.batchV3.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      batches,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching batches:", err);
    return NextResponse.json(
      { ok: false, error: "FETCH_BATCHES_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
