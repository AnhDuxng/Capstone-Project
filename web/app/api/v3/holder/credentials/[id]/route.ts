import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const credential = await prisma.credentialV3.findUnique({
      where: { id },
      include: {
        disclosures: {
          select: {
            salt: true,
            key: true,
            value: true,
          },
        },
      },
    });

    if (!credential) {
      return NextResponse.json(
        { ok: false, error: "CREDENTIAL_NOT_FOUND", message: "Không tìm thấy chứng chỉ" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      credential,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching holder credential detail:", err);
    return NextResponse.json(
      { ok: false, error: "FETCH_CREDENTIAL_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
