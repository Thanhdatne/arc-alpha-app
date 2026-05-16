import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const wallet = String(body.wallet || "").toLowerCase();
    const amount = Number(body.amount || 0);
    const tx = String(body.tx || "");

    if (!wallet || !tx || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid deposit payload" },
        { status: 400 }
      );
    }

    const exists = await prisma.creditTransaction.findUnique({
      where: { reference: tx },
    });

    if (exists) {
      return NextResponse.json(
        { error: "Transaction already credited" },
        { status: 400 }
      );
    }

    await prisma.wallet.upsert({
      where: { address: wallet },
      update: {},
      create: {
        address: wallet,
        balance: 0,
      },
    });

    await prisma.wallet.update({
      where: { address: wallet },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    await prisma.creditTransaction.create({
      data: {
        walletAddress: wallet,
        type: "deposit",
        amount,
        reference: tx,
        status: "CONFIRMED",
        metadata: {
          settlement: "ONCHAIN",
          chain: "Arc Testnet",
        },
      },
    });

    return NextResponse.json({
      success: true,
      tx,
      credited: amount,
    });
  } catch {
    return NextResponse.json(
      { error: "Deposit failed" },
      { status: 500 }
    );
  }
}