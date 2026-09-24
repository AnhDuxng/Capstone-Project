import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST", message: "Email không được để trống" },
        { status: 400 }
      );
    }

    const credentials = await prisma.credentialV3.findMany({
      where: { holderEmail: email },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        credId: true,
        batchId: true,
        batchIndex: true,
        vct: true,
        degreeTitle: true,
        graduationDate: true,
        honors: true,
        isRevoked: true,
        issuedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      credentials,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching holder credentials:", err);
    return NextResponse.json(
      { ok: false, error: "FETCH_HOLDER_CREDENTIALS_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
