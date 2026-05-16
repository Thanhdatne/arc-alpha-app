import express from "express";
import cors from "cors";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const ANALYZE_COST = 0.001;
const SERVICE_NAME = "Arc Alpha API";
const NETWORK = "ARC-TESTNET";

function createApiKey() {
  return "arc_" + crypto.randomBytes(24).toString("hex");
}

function createRequestId() {
  return "req_" + crypto.randomBytes(12).toString("hex");
}

function normalizeWallet(wallet: string) {
  return String(wallet || "").trim().toLowerCase();
}

function isValidAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address || "").trim());
}

function getTxKind(reference: string, type: string) {
  if (type === "deposit" && String(reference || "").startsWith("0x")) {
    return "ONCHAIN";
  }

  return "OFFCHAIN";
}

function buildSummary(risk: number, signals: string[]) {
  const signalText = signals.length ? signals.join(", ") : "limited market data";

  if (risk >= 80) {
    return `This token shows high risk. The analysis detected ${signalText}. Traders should be careful because liquidity, volume, or market behavior may be weak.`;
  }

  if (risk >= 50) {
    return `This token presents moderate risk. The report found ${signalText}. It may be tradable, but users should monitor liquidity and recent market behavior closely.`;
  }

  return "This token currently shows lower immediate risk. The available market data suggests healthier liquidity and trading activity, although users should still verify contract and holder data before trading.";
}

async function analyze(address: string) {
  try {
    if (!isValidAddress(address)) {
      return {
        token: address,
        found: false,
        riskScore: 98,
        verdict: "Invalid Address",
        grade: "CRITICAL",
        summary:
          "The submitted value is not a valid EVM contract address. Please provide a 0x-prefixed address with 40 hexadecimal characters.",
        signals: ["Invalid contract address"],
      };
    }

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`
    );

    const data = await response.json();
    const pair = data.pairs?.[0];

    if (!pair) {
      return {
        token: address,
        found: false,
        riskScore: 95,
        verdict: "Token not found",
        grade: "CRITICAL",
        summary:
          "No active liquidity pair was found for this token. This usually means the asset is not tradable on major indexed DEX pools or has extremely limited market visibility.",
        signals: ["No liquidity pair detected"],
      };
    }

    const liquidity = Number(pair.liquidity?.usd || 0);
    const volume = Number(pair.volume?.h24 || 0);
    const pairCreatedAt = pair.pairCreatedAt || Date.now();
    const ageHours = (Date.now() - pairCreatedAt) / (1000 * 60 * 60);

    let risk = 20;

    const signals: string[] = ["DexScreener liquidity detected"];

    if (liquidity < 5000) {
      risk += 25;
      signals.push("Low liquidity");
    }

    if (volume < 1000) {
      risk += 15;
      signals.push("Low trading volume");
    }

    if (ageHours < 24) {
      risk += 25;
      signals.push("Freshly deployed pair");
    }

    if (Number(pair.priceChange?.h24 || 0) < -50) {
      risk += 20;
      signals.push("Heavy 24h price dump");
    }

    const buys24h = Number(pair.txns?.h24?.buys || 0);
    const sells24h = Number(pair.txns?.h24?.sells || 0);

    if (sells24h > buys24h * 2 && sells24h > 10) {
      risk += 10;
      signals.push("Sell pressure detected");
    }

    const riskScore = Math.min(risk, 100);
    const verdict =
      riskScore >= 80 ? "High Risk" : riskScore >= 50 ? "Medium Risk" : "Low Risk";

    const grade =
      riskScore >= 90
        ? "CRITICAL"
        : riskScore >= 80
        ? "HIGH"
        : riskScore >= 50
        ? "MEDIUM"
        : "LOW";

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
      priceChange24h: pair.priceChange?.h24 || 0,
      pairAgeHours: ageHours.toFixed(1),
      fdv: pair.fdv || 0,
      marketCap: pair.marketCap || 0,
      txns24h: buys24h + sells24h,
      buys24h,
      sells24h,
      imageUrl: pair.info?.imageUrl || "",
      url: pair.url || "",
      riskScore,
      verdict,
      grade,
      summary: buildSummary(riskScore, signals),
      signals,
    };
  } catch (err) {
    return {
      token: address,
      found: false,
      riskScore: 99,
      verdict: "Analysis Failed",
      grade: "CRITICAL",
      summary:
        "The analysis request failed. This may be caused by an invalid contract address, network issue, or unavailable market data provider.",
      signals: ["API request failed"],
    };
  }
}

async function getOrCreateWallet(wallet: string) {
  const address = normalizeWallet(wallet);

  let user = await prisma.wallet.findUnique({
    where: { address },
  });

  if (!user) {
    user = await prisma.wallet.create({
      data: {
        address,
        balance: 0,
      },
    });
  }

  return user;
}

async function getUserByApiKey(apiKey: string) {
  return prisma.wallet.findFirst({
    where: {
      apiKey,
    },
  });
}

function mapTransaction(tx: any) {
  const reference = tx.reference || "";
  const kind = getTxKind(reference, tx.type);

  return {
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    reference,
    status: tx.status,
    kind,
    isOnchain: kind === "ONCHAIN",
    explorerUrl:
      kind === "ONCHAIN"
        ? `https://arcscan.testnet.arc.network/tx/${reference}`
        : null,
    metadata: tx.metadata || null,
    createdAt: tx.createdAt,
  };
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: SERVICE_NAME,
    network: NETWORK,
    status: "operational",
    costPerAnalyze: ANALYZE_COST,
    database: "prisma-postgres",
    agentApi: true,
    endpoints: {
      health: "/health",
      credits: "/credits/:wallet",
      generateApiKey: "/api-key/generate",
      regenerateApiKey: "/api-key/regenerate",
      agentAnalyze: "/agent/analyze",
      dashboard: "/dashboard/:wallet",
    },
  });
});

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.json({
      ok: true,
      service: SERVICE_NAME,
      status: "operational",
      network: NETWORK,
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      service: SERVICE_NAME,
      status: "degraded",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/credits/:wallet", async (req: any, res) => {
  try {
    const wallet = normalizeWallet(req.params.wallet);

    if (!wallet) {
      return res.status(400).json({
        error: "Wallet required",
      });
    }

    let user = await prisma.wallet.findUnique({
      where: {
        address: wallet,
      },
      include: {
        transactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
      },
    });

    if (!user) {
      user = await prisma.wallet.create({
        data: {
          address: wallet,
          balance: 0,
        },
        include: {
          transactions: true,
        },
      });
    }

    const transactions = user.transactions.map(mapTransaction);

    return res.json({
      wallet: user.address,
      balance: Number(user.balance),
      apiKey: user.apiKey,
      costPerAnalyze: ANALYZE_COST,
      remainingQueries: Math.floor(Number(user.balance) / ANALYZE_COST),
      transactions,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to load credits",
    });
  }
});

app.get("/dashboard/:wallet", async (req: any, res) => {
  try {
    const wallet = normalizeWallet(req.params.wallet);

    const user = await prisma.wallet.findUnique({
      where: {
        address: wallet,
      },
      include: {
        transactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 100,
        },
      },
    });

    if (!user) {
      return res.json({
        wallet,
        balance: 0,
        apiKey: null,
        requests: 0,
        totalDeposited: 0,
        totalSpent: 0,
        remainingQueries: 0,
        lastActivity: null,
        transactions: [],
      });
    }

    const transactions = user.transactions.map(mapTransaction);

    const totalDeposited = transactions
      .filter((tx) => tx.type === "deposit")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const totalSpent = transactions
      .filter((tx) => tx.type === "agent_analyze" || tx.type === "analyze")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const requests = transactions.filter(
      (tx) => tx.type === "agent_analyze" || tx.type === "analyze"
    ).length;

    return res.json({
      wallet: user.address,
      balance: Number(user.balance),
      apiKey: user.apiKey,
      requests,
      totalDeposited,
      totalSpent,
      remainingQueries: Math.floor(Number(user.balance) / ANALYZE_COST),
      lastActivity: transactions[0]?.createdAt || null,
      transactions,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to load dashboard",
    });
  }
});

app.post("/credits/deposit", async (req: any, res) => {
  try {
    const wallet = normalizeWallet(req.body.wallet);
    const amount = Number(req.body.amount || 0);
    const tx = String(req.body.tx || "").trim();

    if (!wallet || !tx || amount <= 0) {
      return res.status(400).json({
        error: "Invalid deposit payload",
      });
    }

    const exists = await prisma.creditTransaction.findUnique({
      where: {
        reference: tx,
      },
    });

    if (exists) {
      return res.status(400).json({
        error: "Transaction already credited",
      });
    }

    await getOrCreateWallet(wallet);

    const updatedWallet = await prisma.wallet.update({
      where: {
        address: wallet,
      },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    const transaction = await prisma.creditTransaction.create({
      data: {
        walletAddress: wallet,
        type: "deposit",
        amount,
        reference: tx,
        status: "CONFIRMED",
        metadata: {
          source: "arc_testnet",
          kind: "ONCHAIN",
        },
      },
    });

    return res.json({
      success: true,
      credited: amount,
      balance: Number(updatedWallet.balance),
      transaction: mapTransaction(transaction),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Deposit failed",
    });
  }
});

app.post("/credits/charge", async (req: any, res) => {
  try {
    const wallet = normalizeWallet(req.body.wallet);
    const requestId = createRequestId();

    const user = await prisma.wallet.findUnique({
      where: {
        address: wallet,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "Wallet not found",
        requestId,
      });
    }

    if (Number(user.balance) < ANALYZE_COST) {
      return res.status(400).json({
        error: "Insufficient balance",
        requestId,
        balance: Number(user.balance),
        required: ANALYZE_COST,
      });
    }

    const updatedWallet = await prisma.wallet.update({
      where: {
        address: wallet,
      },
      data: {
        balance: {
          decrement: ANALYZE_COST,
        },
      },
    });

    const transaction = await prisma.creditTransaction.create({
      data: {
        walletAddress: wallet,
        type: "agent_analyze",
        amount: ANALYZE_COST,
        reference: requestId,
        status: "CONFIRMED",
        metadata: {
          kind: "OFFCHAIN",
          source: "manual_charge_endpoint",
        },
      },
    });

    return res.json({
      success: true,
      charged: ANALYZE_COST,
      balance: Number(updatedWallet.balance),
      requestId,
      transaction: mapTransaction(transaction),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Charge failed",
    });
  }
});

app.post("/api-key/generate", async (req: any, res) => {
  try {
    const wallet = normalizeWallet(req.body.wallet);

    if (!wallet) {
      return res.status(400).json({
        error: "Wallet required",
      });
    }

    const existing = await prisma.wallet.findUnique({
      where: {
        address: wallet,
      },
    });

    if (existing?.apiKey) {
      return res.json({
        success: true,
        apiKey: existing.apiKey,
        regenerated: false,
      });
    }

    const apiKey = createApiKey();

    const user = await prisma.wallet.upsert({
      where: {
        address: wallet,
      },
      update: {
        apiKey,
      },
      create: {
        address: wallet,
        balance: 0,
        apiKey,
      },
    });

    return res.json({
      success: true,
      apiKey: user.apiKey,
      regenerated: false,
    });
  } catch (err) {
    return res.status(500).json({
      error: "API key generation failed",
    });
  }
});

app.post("/api-key/regenerate", async (req: any, res) => {
  try {
    const wallet = normalizeWallet(req.body.wallet);

    if (!wallet) {
      return res.status(400).json({
        error: "Wallet required",
      });
    }

    await getOrCreateWallet(wallet);

    const apiKey = createApiKey();

    const user = await prisma.wallet.update({
      where: {
        address: wallet,
      },
      data: {
        apiKey,
      },
    });

    return res.json({
      success: true,
      apiKey: user.apiKey,
      regenerated: true,
    });
  } catch (err) {
    return res.status(500).json({
      error: "API key regeneration failed",
    });
  }
});

app.get("/api-key/:wallet", async (req: any, res) => {
  try {
    const wallet = normalizeWallet(req.params.wallet);

    const user = await prisma.wallet.findUnique({
      where: {
        address: wallet,
      },
    });

    return res.json({
      wallet,
      apiKey: user?.apiKey || null,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch api key",
    });
  }
});

app.post("/agent/analyze", async (req: any, res) => {
  const requestId = createRequestId();

  try {
    const apiKey = String(req.headers["x-api-key"] || "");
    const address = String(req.body.address || "").trim();

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: "Missing API key",
        requestId,
      });
    }

    if (!address) {
      return res.status(400).json({
        success: false,
        error: "Token address required",
        requestId,
      });
    }

    const user = await getUserByApiKey(apiKey);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid API key",
        requestId,
      });
    }

    if (Number(user.balance) < ANALYZE_COST) {
      return res.status(400).json({
        success: false,
        error: "Insufficient balance",
        requestId,
        balance: Number(user.balance),
        required: ANALYZE_COST,
      });
    }

    console.log(`[${requestId}] Agent analyze started`, {
      wallet: user.address,
      address,
    });

    const report = await analyze(address);

    const updatedWallet = await prisma.wallet.update({
      where: {
        address: user.address,
      },
      data: {
        balance: {
          decrement: ANALYZE_COST,
        },
      },
    });

    const transaction = await prisma.creditTransaction.create({
      data: {
        walletAddress: user.address,
        type: "agent_analyze",
        amount: ANALYZE_COST,
        reference: requestId,
        status: "CONFIRMED",
        metadata: {
          address,
          kind: "OFFCHAIN",
          provider: "dexscreener",
          riskScore: report.riskScore,
          verdict: report.verdict,
        },
      },
    });

    console.log(`[${requestId}] Agent analyze completed`, {
      wallet: user.address,
      charged: ANALYZE_COST,
      riskScore: report.riskScore,
    });

    return res.json({
      success: true,
      requestId,
      charged: ANALYZE_COST,
      balance: Number(updatedWallet.balance),
      transaction: mapTransaction(transaction),
      report,
    });
  } catch (err) {
    console.error(`[${requestId}] Agent analyze failed`, err);

    return res.status(500).json({
      success: false,
      error: "Agent analyze failed",
      requestId,
    });
  }
});

app.get("/analyze", async (req: any, res) => {
  const address = String(req.query.address || "").trim();
  const report = await analyze(address);

  return res.json({
    success: true,
    requestId: createRequestId(),
    report,
  });
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
