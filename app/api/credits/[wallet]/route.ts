import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const address = wallet.toLowerCase();

    let user = await prisma.wallet.findUnique({
      where: { address },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!user) {
      user = await prisma.wallet.create({
        data: {
          address,
          balance: 0,
        },
        include: {
          transactions: true,
        },
      });
    }

    return NextResponse.json({
      balance: Number(user.balance),
      apiKey: user.apiKey,
      transactions: user.transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        reference: tx.reference,
        status: tx.status,
        metadata: tx.metadata,
        createdAt: tx.createdAt,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load credits" },
      { status: 500 }
    );
  }
}