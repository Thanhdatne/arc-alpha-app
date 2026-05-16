import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const wallet = String(body.wallet || "").toLowerCase();

    if (!wallet) {
      return NextResponse.json({ error: "Wallet required" }, { status: 400 });
    }

    const existing = await prisma.wallet.findUnique({
      where: { address: wallet },
    });

    if (existing?.apiKey) {
      return NextResponse.json({
        success: true,
        apiKey: existing.apiKey,
      });
    }

    const apiKey = "arc_" + crypto.randomBytes(24).toString("hex");

    const user = await prisma.wallet.upsert({
      where: { address: wallet },
      update: { apiKey },
      create: {
        address: wallet,
        balance: 0,
        apiKey,
      },
    });

    return NextResponse.json({
      success: true,
      apiKey: user.apiKey,
    });
  } catch {
    return NextResponse.json(
      { error: "API key generation failed" },
      { status: 500 }
    );
  }
}