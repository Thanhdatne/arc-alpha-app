"use client";

import { useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, parseUnits } from "viem";
import {
  LayoutDashboard,
  Search,
  ArrowLeftRight,
  CreditCard,
  KeyRound,
  BookOpen,
  Settings,
  Wallet,
  Target,
  BarChart3,
  Database,
  Shield,
  Zap,
  Globe,
  Receipt,
  ArrowDownToLine,
  Sparkles,
  Copy,
  CheckCircle2,
  ExternalLink,
  Send,
  Coins,
} from "lucide-react";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const API_URL = "http://localhost:3001";
const ARC_TESTNET_CHAIN_ID = "0x4CEF52";
const ARC_TREASURY = "0xf002faea186f4084b588dd288922a36f7262ff43";

const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
} as const;

type Tab =
  | "Dashboard"
  | "Analyze"
  | "Transactions"
  | "Billing"
  | "API Access"
  | "Docs"
  | "Settings";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [tokenAddress, setTokenAddress] = useState("");
  const [wallet, setWallet] = useState("");
  const [balance, setBalance] = useState(0);
  const [depositAmount, setDepositAmount] = useState("0.1");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [apiKey, setApiKey] = useState("");

  const ANALYZE_COST = 0.001;
  const remainingQueries = Math.floor(balance / ANALYZE_COST);

  const totalDeposited = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === "deposit")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [transactions]
  );

  const totalSpent = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === "agent_analyze")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [transactions]
  );

  async function loadCredits(walletAddress: string) {
    try {
      const res = await fetch(`${API_URL}/credits/${walletAddress}`);
      const data = await res.json();

      setBalance(Number(data.balance || 0));
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadApiKey(walletAddress: string) {
    if (!walletAddress) return;

    try {
      const res = await fetch(`${API_URL}/api-key/${walletAddress}`);
      const data = await res.json();

      if (data.apiKey) {
        setApiKey(data.apiKey);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (wallet) loadCredits(wallet);
  }, [wallet]);

  function shortAddress(addr: string) {
    if (!addr) return "-";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function getRiskColor(score: number) {
    if (score >= 80) return "text-red-400";
    if (score >= 50) return "text-yellow-400";
    return "text-emerald-400";
  }

  function getRiskBar(score: number) {
    if (score >= 80) return "bg-red-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-emerald-500";
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Install MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    const connectedWallet = accounts[0];
    setWallet(connectedWallet);

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET_CHAIN_ID }],
      });
    } catch {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARC_TESTNET_CHAIN_ID,
            chainName: "Arc Testnet",
            nativeCurrency: {
              name: "USDC",
              symbol: "USDC",
              decimals: 18,
            },
            rpcUrls: ["https://rpc.testnet.arc.network"],
            blockExplorerUrls: [],
          },
        ],
      });
    }

    await fetch(`${API_URL}/api-key/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        wallet: connectedWallet,
      }),
    });

    await loadCredits(connectedWallet);
    await loadApiKey(connectedWallet);
  }

  async function depositBalance() {
    if (!wallet) {
      alert("Connect wallet first");
      return;
    }

    setLoading(true);

    try {
      const client = createWalletClient({
        chain: ARC_TESTNET,
        transport: custom(window.ethereum),
        account: wallet as `0x${string}`,
      });

      const tx = await client.sendTransaction({
        to: ARC_TREASURY as `0x${string}`,
        value: parseUnits(depositAmount, 18),
      });

      const depositRes = await fetch(`${API_URL}/credits/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          amount: Number(depositAmount),
          tx,
        }),
      });

      const depositData = await depositRes.json();

      if (!depositData.success) {
        alert(depositData.error || "Deposit failed");
        setLoading(false);
        return;
      }

      await loadCredits(wallet);
    } catch (err) {
      console.error(err);
      alert("Deposit failed");
    }

    setLoading(false);
  }

  async function analyzeToken() {
  if (!wallet) {
    alert("Connect wallet first");
    return;
  }

  if (!tokenAddress) {
    alert("Enter token address");
    return;
  }

  setLoading(true);

  try {
    const apiKeyRes = await fetch(
      `${API_URL}/api-key/${wallet}`
    );

    const apiKeyData = await apiKeyRes.json();

    if (!apiKeyData.apiKey) {
      alert("Generate API key first");
      setLoading(false);
      return;
    }

    const res = await fetch(`${API_URL}/agent/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKeyData.apiKey,
      },
      body: JSON.stringify({
        address: tokenAddress,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Analyze failed");
      setLoading(false);
      return;
    }

    setReport(data.report);

    setActiveTab("Analyze");

    await loadCredits(wallet);
  } catch (err) {
    console.error(err);
    alert("Analyze failed");
  }

  setLoading(false);
}

  return (
    <main className="min-h-screen bg-[#020403] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1560px]">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#050807] p-6 lg:block">
          <div className="mb-10 text-center">
            <img
              src="/arc-logo.jpg"
              alt="Arc Alpha logo"
              className="mx-auto h-28 w-28 rounded-[28px] border border-white/10 object-cover shadow-[0_0_55px_rgba(16,185,129,0.22)]"
            />
            <p className="mt-5 text-3xl font-black leading-none">ARC ALPHA</p>
            <p className="mt-2 text-sm font-bold uppercase tracking-wider text-emerald-400">
              AI Crypto Intelligence
            </p>
          </div>

          <nav className="space-y-2 text-sm">
            <SidebarButton icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === "Dashboard"} onClick={() => setActiveTab("Dashboard")} />
            <SidebarButton icon={<Search size={18} />} label="Analyze" active={activeTab === "Analyze"} onClick={() => setActiveTab("Analyze")} />
            <SidebarButton icon={<ArrowLeftRight size={18} />} label="Transactions" active={activeTab === "Transactions"} onClick={() => setActiveTab("Transactions")} />
            <SidebarButton icon={<CreditCard size={18} />} label="Billing" active={activeTab === "Billing"} onClick={() => setActiveTab("Billing")} />
            <SidebarButton icon={<KeyRound size={18} />} label="API Access" active={activeTab === "API Access"} onClick={() => setActiveTab("API Access")} />
            <SidebarButton icon={<BookOpen size={18} />} label="Docs" active={activeTab === "Docs"} onClick={() => setActiveTab("Docs")} />
            <SidebarButton icon={<Settings size={18} />} label="Settings" active={activeTab === "Settings"} onClick={() => setActiveTab("Settings")} />
          </nav>

          <div className="mt-9 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
            <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Network</p>
            <p className="flex items-center gap-2 font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Arc Testnet
            </p>

            <p className="mt-5 text-xs uppercase tracking-widest text-zinc-500">Wallet</p>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-black/40 px-3 py-2 text-sm">
              <span>{wallet ? shortAddress(wallet) : "Not connected"}</span>
              <Copy size={14} className="text-zinc-500" />
            </div>

            <p className="mt-5 text-xs uppercase tracking-widest text-zinc-500">Balance</p>
            <p className="mt-1 text-xl font-black text-emerald-400">
              ${balance.toFixed(6)} <span className="text-sm text-zinc-500">USDC</span>
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-semibold">Arc Alpha API</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Prepaid AI intelligence powered by Arc network and secure onchain infrastructure.
            </p>
          </div>

          <p className="mt-10 text-xs text-zinc-600">© 2026 Arc Alpha</p>
        </aside>

        <section className="flex-1 p-5 md:p-8">
          <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_34%),#080a0a] p-6 shadow-2xl md:p-8">
            <header className="mb-8 border-b border-white/10 pb-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-emerald-400 px-4 py-1 text-xs font-black uppercase tracking-widest text-black">
                      Arc Testnet
                    </span>
                    <span className="text-xs uppercase tracking-[0.3em] text-purple-200">
                      Prepaid AI Intelligence
                    </span>
                  </div>

                  <h1 className="text-5xl font-black tracking-tight md:text-6xl">
                    Arc Alpha API
                  </h1>

                  <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                    AI-native crypto intelligence powered by prepaid USDC credits
                    and Arc agentic payment infrastructure.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300 md:block">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    API Status <span className="text-emerald-400">Operational</span>
                  </div>

                  <button
                    onClick={connectWallet}
                    className="rounded-2xl bg-white px-5 py-3 font-black text-black transition hover:bg-emerald-300"
                  >
                    {wallet ? shortAddress(wallet) : "Connect Wallet"}
                  </button>
                </div>
              </div>

              <div className="mt-6 hidden justify-end lg:flex">
                <div className="relative h-24 w-72 opacity-80">
                  <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/20 blur-2xl" />
                  <img
                    src="/arc-logo.jpg"
                    alt="Arc Alpha"
                    className="absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 rounded-[26px] object-cover shadow-[0_0_70px_rgba(16,185,129,0.25)]"
                  />
                  <div className="absolute inset-x-0 bottom-0 mx-auto h-[1px] w-72 bg-emerald-400/40" />
                </div>
              </div>
            </header>

            {activeTab === "Dashboard" && (
              <Dashboard
                balance={balance}
                remainingQueries={remainingQueries}
                depositAmount={depositAmount}
                setDepositAmount={setDepositAmount}
                loading={loading}
                wallet={wallet}
                depositBalance={depositBalance}
                tokenAddress={tokenAddress}
                setTokenAddress={setTokenAddress}
                analyzeToken={analyzeToken}
                report={report}
                transactions={transactions}
                getRiskColor={getRiskColor}
                getRiskBar={getRiskBar}
                shortAddress={shortAddress}
              />
            )}

            {activeTab === "Analyze" && (
              <AnalyzeSection
                tokenAddress={tokenAddress}
                setTokenAddress={setTokenAddress}
                loading={loading}
                analyzeToken={analyzeToken}
                report={report}
                getRiskColor={getRiskColor}
                getRiskBar={getRiskBar}
                shortAddress={shortAddress}
              />
            )}

            {activeTab === "Transactions" && <TransactionsSection transactions={transactions} />}
            {activeTab === "Billing" && (
              <BillingSection
                balance={balance}
                remainingQueries={remainingQueries}
                totalDeposited={totalDeposited}
                totalSpent={totalSpent}
                depositAmount={depositAmount}
                setDepositAmount={setDepositAmount}
                loading={loading}
                wallet={wallet}
                depositBalance={depositBalance}
              />
            )}
            {activeTab === "API Access" && (
              <ApiAccessSection
                wallet={wallet}
                apiKey={apiKey}
                loadApiKey={loadApiKey}
              />
            )}
            {activeTab === "Docs" && <DocsSection />}
            {activeTab === "Settings" && <SettingsSection wallet={wallet} shortAddress={shortAddress} />}
          </div>
        </section>
      </div>
    </main>
  );
}

function Dashboard(props: any) {
  return (
    <>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Stat label="Available Balance" value={`$${props.balance.toFixed(6)}`} sub="~ verified USDC" accent icon={<Wallet size={22} />} />
        <Stat label="Cost Per Analyze" value="$0.001" sub="Per request" icon={<Target size={22} />} purple />
        <Stat label="Remaining Queries" value={`${props.remainingQueries}`} sub="Available" icon={<BarChart3 size={22} />} blue />
        <Stat label="API Status" value="LIVE" sub="Agent endpoint active" icon={<Zap size={22} />} purple />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel icon={<Coins size={24} />} title="Add Credits" subtitle="Deposit Arc Testnet USDC into your verified balance." badge="Prisma Database Active">
          <CreditInput {...props} />
        </Panel>

        <Panel icon={<Search size={24} />} title="Analyze Token" subtitle="Get AI-powered intelligence about any token.">
          <AnalyzeInput {...props} />
        </Panel>
      </div>

      {props.report && <ReportCard {...props} />}
      <TransactionsPreview transactions={props.transactions} />
      <FooterFeatures />
    </>
  );
}

function AnalyzeSection(props: any) {
  return (
    <div className="space-y-6">
      <Panel icon={<Search size={24} />} title="Token Intelligence" subtitle="Paste a contract address and generate a paid intelligence report.">
        <AnalyzeInput {...props} />
      </Panel>
      {props.report ? <ReportCard {...props} /> : <EmptyState title="No report yet" text="Run an analysis to generate a market intelligence report." />}
    </div>
  );
}

function BillingSection(props: any) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Current Balance" value={`$${props.balance.toFixed(6)}`} sub="Stored in Supabase" accent icon={<Wallet size={22} />} />
        <Stat label="Query Price" value="$0.001" sub="Flat rate" icon={<Target size={22} />} />
        <Stat label="Remaining" value={`${props.remainingQueries}`} sub="Queries" icon={<BarChart3 size={22} />} />
        <Stat label="Total Spent" value={`$${Number(props.totalSpent || 0).toFixed(3)}`} sub="Analysis charges" icon={<Receipt size={22} />} purple />
      </div>

      <Panel icon={<ArrowDownToLine size={24} />} title="Top Up Balance" subtitle="Fund prepaid credits using Arc Testnet USDC." badge="Onchain Verified">
        <CreditInput {...props} />
      </Panel>
    </div>
  );
}

function TransactionsSection({ transactions }: { transactions: any[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xl font-black">Transactions</p>
          <p className="text-sm text-zinc-500">Verified deposits and analysis charges.</p>
        </div>
        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-400">
          Verified Ledger
        </span>
      </div>
      {transactions.length > 0 ? <TransactionList transactions={transactions} /> : <EmptyState title="No transactions" text="Deposits and analysis charges will appear here." />}
    </div>
  );
}

function ApiAccessSection({
  wallet,
  apiKey,
  loadApiKey,
}: {
  wallet: string;
  apiKey: string;
  loadApiKey: (walletAddress: string) => Promise<void>;
}) {
  async function copyApiKey() {
    if (!apiKey) return;

    await navigator.clipboard.writeText(apiKey);
    alert("API key copied");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel
        icon={<KeyRound size={24} />}
        title="Agent API Key"
        subtitle="Use this key for Circle Agent Stack / AI agent calls."
        badge="LIVE"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Connected Wallet
            </p>
            <p className="mt-2 break-all font-black">
              {wallet || "Connect wallet first"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              API Key
            </p>
            <p className="mt-2 break-all font-mono text-sm text-emerald-300">
              {apiKey || "No API key loaded"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => loadApiKey(wallet)}
              disabled={!wallet}
              className="rounded-2xl bg-white px-5 py-3 font-black text-black transition hover:bg-emerald-300 disabled:opacity-40"
            >
              Load Key
            </button>

            <button
              onClick={copyApiKey}
              disabled={!apiKey}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 font-black text-white transition hover:border-emerald-400 disabled:opacity-40"
            >
              Copy Key
            </button>
          </div>
        </div>
      </Panel>

      <Panel
        icon={<CreditCard size={24} />}
        title="Agent Pricing"
        subtitle="Prepaid usage-based pricing for autonomous agents."
      >
        <div className="rounded-2xl bg-black/40 p-5">
          <p className="text-4xl font-black">$0.001</p>
          <p className="mt-2 text-zinc-500">
            per token intelligence request
          </p>
        </div>
      </Panel>

      <Panel
        icon={<BookOpen size={24} />}
        title="Agent Request"
        subtitle="Example request for an AI agent or external app."
      >
        <CodeBlock
          text={`curl -X POST ${API_URL}/agent/analyze \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${apiKey || "arc_your_api_key"}" \
  -d '{"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}'`}
        />
      </Panel>

      <Panel
        icon={<Zap size={24} />}
        title="Circle Agent Stack Fit"
        subtitle="How Arc Alpha maps into agentic commerce."
        badge="USDC Native"
      >
        <div className="space-y-3 text-sm leading-6 text-zinc-400">
          <p>Agent Wallet funds prepaid USDC credits.</p>
          <p>API key authorizes the agent to call Arc Alpha.</p>
          <p>Each request spends $0.001 from the wallet-linked balance.</p>
          <p>
            Deposits are onchain. Agent usage is tracked in the internal ledger.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function DocsSection() {
  return (
    <div className="space-y-5">
      <Panel icon={<BookOpen size={24} />} title="How it works" subtitle="Arc Alpha prepaid intelligence flow.">
        <div className="grid gap-4 md:grid-cols-4">
          <Step n="01" title="Connect" text="Connect MetaMask on Arc Testnet." />
          <Step n="02" title="Deposit" text="Send test USDC to verified treasury." />
          <Step n="03" title="Verify" text="Backend verifies the transaction onchain." />
          <Step n="04" title="Analyze" text="Spend credits for token reports." />
        </div>
      </Panel>
      <Panel icon={<Database size={24} />} title="Architecture" subtitle="Production-oriented stack.">
        <CodeBlock text={`Frontend: Next.js + Tailwind\nWallet: MetaMask + Arc Testnet\nBackend: Express + Prisma\nDatabase: Supabase Postgres\nData: DexScreener API`} />
      </Panel>
    </div>
  );
}

function SettingsSection({ wallet, shortAddress }: { wallet: string; shortAddress: (addr: string) => string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel icon={<Settings size={24} />} title="Connected Wallet" subtitle="Current wallet session.">
        <Info label="Wallet" value={wallet ? shortAddress(wallet) : "Not connected"} />
      </Panel>
      <Panel icon={<Globe size={24} />} title="Network" subtitle="Current supported network.">
        <Info label="Network" value="Arc Testnet" />
        <div className="mt-4">
          <Info label="Treasury" value={shortAddress(ARC_TREASURY)} />
        </div>
      </Panel>
    </div>
  );
}

function CreditInput(props: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 shadow-inner shadow-black/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
          <span className="text-lg font-black">$</span>
        </div>
        <input
          value={props.depositAmount}
          onChange={(e) => props.setDepositAmount(e.target.value)}
          className="w-full bg-transparent py-4 outline-none"
        />
        <span className="text-sm font-bold text-zinc-400">USDC</span>
        <button
          onClick={() => props.setDepositAmount("1")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
        >
          MAX
        </button>
      </div>

      <button
        onClick={props.depositBalance}
        disabled={props.loading || !props.wallet}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-7 py-4 font-black text-black transition hover:bg-emerald-300 disabled:opacity-40"
      >
        <Send size={18} />
        {props.loading ? "Processing..." : "Deposit"}
      </button>
    </div>
  );
}

function AnalyzeInput(props: any) {
  return (
    <div className="space-y-4">
      <input
        value={props.tokenAddress}
        onChange={(e) => props.setTokenAddress(e.target.value)}
        placeholder="Paste token contract address..."
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-lg outline-none placeholder:text-zinc-500"
      />
      <div className="flex justify-end">
        <button
          onClick={props.analyzeToken}
          disabled={props.loading || !props.tokenAddress}
          className="flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-black text-black transition hover:bg-emerald-300 disabled:opacity-40"
        >
          <Send size={18} />
          {props.loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>
    </div>
  );
}

function ReportCard(props: any) {
  const { report, shortAddress, getRiskColor, getRiskBar } = props;
  return (
    <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-black/30 p-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black">
          {report.imageUrl ? (
            <img src={report.imageUrl} alt={report.token} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-black">{String(report.token || "?").slice(0, 1)}</span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-zinc-500">Full Intelligence Report</p>
          <h2 className="text-3xl font-black">{report.name || report.token || "Unknown Token"}</h2>
          <p className="text-sm text-zinc-500">{report.chain} · {report.dex} · {shortAddress(report.address)}</p>
        </div>
        {report.url && (
          <a href={report.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold hover:border-emerald-400">
            DexScreener <ExternalLink size={15} />
          </a>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-black/40 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500">Risk Engine</p>
            <p className={`text-4xl font-black ${getRiskColor(report.riskScore)}`}>
              {report.riskScore}/100
            </p>
          </div>
          <p className={`text-lg font-black ${getRiskColor(report.riskScore)}`}>{report.verdict}</p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
          <div className={`h-full ${getRiskBar(report.riskScore)}`} style={{ width: `${report.riskScore}%` }} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Info label="Price" value={`$${report.priceUsd || "N/A"}`} />
        <Info label="24H Change" value={`${Number(report.priceChange24h || 0).toFixed(2)}%`} />
        <Info label="Liquidity" value={`$${Number(report.liquidityUsd || 0).toLocaleString()}`} />
        <Info label="Volume 24h" value={`$${Number(report.volume24h || 0).toLocaleString()}`} />
        <Info label="FDV" value={`$${Number(report.fdv || 0).toLocaleString()}`} />
        <Info label="Market Cap" value={`$${Number(report.marketCap || 0).toLocaleString()}`} />
        <Info label="Txns 24h" value={`${report.txns24h || 0}`} />
        <Info label="Buy / Sell" value={`${report.buys24h || 0} / ${report.sells24h || 0}`} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5">
        <p className="mb-3 text-sm font-semibold text-zinc-400">Detected Signals</p>
        <ul className="space-y-2">
          {report.signals?.map((s: string, i: number) => (
            <li key={i} className="text-sm text-zinc-300">
              <span className="mr-2 text-emerald-400">●</span>{s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TransactionsPreview({ transactions }: { transactions: any[] }) {
  if (!transactions.length) return null;
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 font-black">
          <Receipt size={18} /> Recent Transactions
        </p>
        <p className="text-xs uppercase tracking-widest text-emerald-400">View All</p>
      </div>
      <TransactionList transactions={transactions.slice(0, 4)} />
    </div>
  );
}

function TransactionList({ transactions }: { transactions: any[] }) {
  return (
    <div className="space-y-3">
      {transactions.map((tx, i) => (
        <div key={i} className="grid grid-cols-[1.5fr_1.5fr_1fr_1.5fr_1fr] items-center gap-4 rounded-2xl bg-black/40 p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tx.type === "deposit" ? "bg-emerald-400/10 text-emerald-400" : "bg-purple-400/10 text-purple-300"}`}>
              {tx.type === "deposit" ? <ArrowDownToLine size={18} /> : <Sparkles size={18} />}
            </div>
            <div>
              <p className="font-semibold capitalize">{tx.type}</p>
              <p className="text-sm text-zinc-500">{tx.type === "deposit" ? "Credit" : "AI Analyze Charge"}</p>
            </div>
          </div>
          <p className="text-sm text-zinc-400">{tx.createdAt}</p>
          <p className={`font-black ${tx.type === "deposit" ? "text-emerald-400" : "text-purple-300"}`}>
            {tx.type === "deposit" ? "+" : "-"}{tx.amount} USDC
          </p>
          {tx.type === "deposit" && (tx.reference || tx.tx)?.startsWith("0x") ? (
            <a
              href={`https://testnet.arcscan.app/tx/${tx.reference || tx.tx}`}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm text-emerald-400 hover:underline"
            >
              tx: {(tx.reference || tx.tx)?.slice(0, 16)}...
            </a>
          ) : (
            <p className="truncate text-sm text-zinc-500">
              ref: {(tx.reference || tx.tx)?.slice(0, 16)}...
            </p>
          )}
          <p className="flex items-center justify-end gap-2 text-sm font-bold text-emerald-400">
            Confirmed <CheckCircle2 size={16} />
          </p>
        </div>
      ))}
    </div>
  );
}

function SidebarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${
        active
          ? "border border-emerald-400/25 bg-emerald-400/10 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.12)]"
          : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Panel({
  title,
  subtitle,
  badge,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex gap-4">
          {icon && <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400">{icon}</div>}
          <div>
            <p className="text-lg font-black">{title}</p>
            <p className="text-sm leading-6 text-zinc-500">{subtitle}</p>
          </div>
        </div>
        {badge && (
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-400">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  icon,
  purple,
  blue,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  icon?: React.ReactNode;
  purple?: boolean;
  blue?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-5">
      <div className="mb-5 flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${purple ? "bg-purple-400/10 text-purple-300" : blue ? "bg-blue-400/10 text-blue-300" : "bg-emerald-400/10 text-emerald-400"}`}>
          {icon}
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      </div>
      <p className={`text-4xl font-black ${accent ? "text-emerald-400" : "text-white"}`}>{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{sub}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 break-all font-black">{value}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-xs font-black text-emerald-400">{n}</p>
      <p className="mt-2 font-black">{title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-500">{text}</p>
    </div>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <pre className="overflow-auto rounded-2xl border border-white/10 bg-black/50 p-5 text-sm leading-7 text-emerald-300">
      {text}
    </pre>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <p className="text-xl font-black">{title}</p>
      <p className="mt-2 text-zinc-500">{text}</p>
    </div>
  );
}

function FooterFeatures() {
  return (
    <div className="mt-6 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5 md:grid-cols-4">
      <Feature icon={<Shield size={18} />} title="Secure & Encrypted" text="Enterprise-grade security for your data" />
      <Feature icon={<Zap size={18} />} title="Real-time AI" text="Powered by advanced intelligence models" />
      <Feature icon={<Globe size={18} />} title="Arc Native" text="Built on Arc Testnet for the future" />
      <Feature icon={<CreditCard size={18} />} title="Pay-as-you-go" text="Only pay for what you use" />
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 text-zinc-300">{icon}</div>
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-500">{text}</p>
      </div>
    </div>
  );
}
