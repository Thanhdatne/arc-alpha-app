import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../../lib/prisma";

const ANALYZE_COST = 0.001;

function buildSummary(risk: number, signals: string[]) {
  if (risk >= 80) {
    return `This token shows high risk. The analysis detected ${signals.join(
      ", "
    )}.`;
  }

  if (risk >= 50) {
    return `This token presents moderate risk. The report found ${signals.join(
      ", "
    )}.`;
  }

  return `This token currently shows lower immediate risk.`;
}

async function analyze(address: string) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`
    );

    const data = await response.json();

    const pair = data.pairs?.[0];

    if (!pair) {
      return {
        found: false,
        riskScore: 95,
        verdict: "Token not found",
        signals: ["No liquidity pair detected"],
      };
    }

    const liquidity = Number(pair.liquidity?.usd || 0);
    const volume = Number(pair.volume?.h24 || 0);

    let risk = 20;

    const signals: string[] = [
      "DexScreener liquidity detected",
    ];

    if (liquidity < 5000) {
      risk += 25;
      signals.push("Low liquidity");
    }

    if (volume < 1000) {
      risk += 15;
      signals.push("Low trading volume");
    }

    const riskScore = Math.min(risk, 100);

    return {
      found: true,
      token: pair.baseToken?.symbol,
      name: pair.baseToken?.name,
      address,
      chain: pair.chainId,
      dex: pair.dexId,
      priceUsd: pair.priceUsd,
      liquidityUsd: liquidity,
      volume24h: volume,
      imageUrl: pair.info?.imageUrl || "",
      url: pair.url || "",
      riskScore,
      verdict:
        riskScore >= 80
          ? "High Risk"
          : riskScore >= 50
          ? "Medium Risk"
          : "Low Risk",
      summary: buildSummary(riskScore, signals),
      signals,
    };
  } catch {
    return {
      found: false,
      riskScore: 99,
      verdict: "Analysis Failed",
      signals: ["API request failed"],
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const apiKey = String(
      req.headers.get("x-api-key") || ""
    );

    const address = String(body.address || "");

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key" },
        { status: 401 }
      );
    }

    const user = await prisma.wallet.findFirst({
      where: { apiKey },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    if (Number(user.balance) < ANALYZE_COST) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    await prisma.wallet.update({
      where: {
        address: user.address,
      },
      data: {
        balance: {
          decrement: ANALYZE_COST,
        },
      },
    });

    const requestId = crypto.randomUUID();

    await prisma.creditTransaction.create({
      data: {
        walletAddress: user.address,
        type: "agent_analyze",
        amount: ANALYZE_COST,
        reference: requestId,
        status: "CONFIRMED",
        metadata: {
          address,
        },
      },
    });

    const report = await analyze(address);

    return NextResponse.json({
      success: true,
      requestId,
      charged: ANALYZE_COST,
      report,
    });
  } catch {
    return NextResponse.json(
      { error: "Agent analyze failed" },
      { status: 500 }
    );
  }
}