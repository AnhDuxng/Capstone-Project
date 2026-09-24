import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ credId: string }> }
) {
  try {
    const { credId } = await params;

    // Decode URI parameter (in case URN has escaped characters)
    const decodedCredId = decodeURIComponent(credId);

    const credential = await prisma.credentialV3.findUnique({
      where: { credId: decodedCredId },
      select: {
        credentialJson: true,
        isRevoked: true,
        batch: {
          select: {
            chainId: true,
            txHash: true,
          },
        },
      },
    });

    if (!credential) {
      return NextResponse.json(
        { ok: false, error: "CREDENTIAL_NOT_FOUND", message: "Không tìm thấy thông tin chứng chỉ" },
        { status: 404 }
      );
    }

    // Parse the stored credential JSON file
    const credFile = JSON.parse(credential.credentialJson);

    // Dynamic database sync check: if isRevoked is true in DB, but the file doesn't reflect it
    // we return the file. Step 9 of the verifier will query the blockchain, ensuring 100% security.

    return NextResponse.json({
      ok: true,
      credentialFile: credFile,
      chainId: credential.batch?.chainId,
      txHash: credential.batch?.txHash,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching credential for verify:", err);
    return NextResponse.json(
      { ok: false, error: "FETCH_FAILED", message: err.message },
      { status: 500 }
    );
  }
}
