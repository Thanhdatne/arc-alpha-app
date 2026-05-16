import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const address = wallet.toLowerCase();

    const user = await prisma.wallet.findUnique({
      where: { address },
    });

    return NextResponse.json({
      apiKey: user?.apiKey || null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch api key" },
      { status: 500 }
    );
  }
}