import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", message: "Vui lòng nhập MSSV hoặc Credential ID" },
        { status: 400 }
      );
    }

    // Search by studentId (exact match) or credId (exact match)
    const credentials = await prisma.credentialV3.findMany({
      where: {
        OR: [
          { studentId: query.trim() },
          { credId: query.trim() },
        ],
      },
      include: {
        batch: true,
      },
    });

    return NextResponse.json({
      ok: true,
      credentials,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error searching credentials:", err);
    return NextResponse.json(
      { ok: false, error: "SEARCH_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
