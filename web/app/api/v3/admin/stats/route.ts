import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [totalBatches, totalCredentials, totalRevoked, recentBatches] = await Promise.all([
      prisma.batchV3.count(),
      prisma.credentialV3.count(),
      prisma.credentialV3.count({
        where: { isRevoked: true },
      }),
      prisma.batchV3.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      stats: {
        totalBatches,
        totalCredentials,
        totalRevoked,
      },
      recentBatches,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching V3 admin stats:", err);
    return NextResponse.json(
      { ok: false, error: "STATS_FETCH_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
