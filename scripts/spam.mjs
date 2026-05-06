import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  parseUnits,
  formatUnits,
  defineChain,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ── Chains ────────────────────────────────────────────────────────────────
// Selected automatically from CHAIN env (defaults to mainnet).
const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://forno.celo.org",
        "https://rpc.ankr.com/celo",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://celoscan.io" },
  },
});
const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia Testnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://forno.celo-sepolia.celo-testnet.org",
        "https://celo-sepolia.drpc.org",
        "https://rpc.ankr.com/celo_sepolia",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://sepolia.celoscan.io" },
  },
  testnet: true,
});
const CHAIN =
  (process.env.CHAIN ?? "").toLowerCase() === "sepolia"
    ? celoSepolia
    : celoMainnet;

// ── ABIs ──────────────────────────────────────────────────────────────────
const VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawBalance",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
];

// ── Env ───────────────────────────────────────────────────────────────────
const {
  PRIVATE_KEY,
  VAULT_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS = "6",
  INTERVAL_SECONDS = "45",
  AMOUNT = "0.01",
  MODE = "loop", // "loop" = forever, "once" = single cycle then exit (for CI cron)
} = process.env;

function die(msg) {
  console.error(`\u2717 ${msg}`);
  process.exit(1);
}

if (!PRIVATE_KEY) die("PRIVATE_KEY missing — fill scripts/.env first.");
if (!VAULT_ADDRESS || !isAddress(VAULT_ADDRESS))
  die("VAULT_ADDRESS missing or not a valid 0x address.");
if (!TOKEN_ADDRESS || !isAddress(TOKEN_ADDRESS))
  die("TOKEN_ADDRESS missing or not a valid 0x address.");
if (!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY))
  die("PRIVATE_KEY must be a 0x-prefixed 32-byte hex string.");

const decimals = Number(TOKEN_DECIMALS);
const amountWei = parseUnits(AMOUNT, decimals);
const intervalMs = Math.max(5_000, Number(INTERVAL_SECONDS) * 1000);
const MAX_UINT256 =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
const MIN_GAS_WEI = parseUnits("0.005", 18); // 0.005 CELO — roughly 2–3 tx worth on Sepolia

// ── Clients ───────────────────────────────────────────────────────────────
const account = privateKeyToAccount(PRIVATE_KEY);
const transport = fallback(
  CHAIN.rpcUrls.default.http.map((url) => http(url)),
  { rank: false, retryCount: 2, retryDelay: 400 },
);
const publicClient = createPublicClient({ chain: CHAIN, transport });
const walletClient = createWalletClient({ account, chain: CHAIN, transport });

// ── Helpers ───────────────────────────────────────────────────────────────
function ts() {
  return new Date().toISOString().slice(11, 19);
}

function fmt(weiBig, dec = decimals) {
  return formatUnits(weiBig, dec);
}

const stats = { ok: 0, fail: 0, txs: 0, startedAt: Date.now() };
let stopping = false;

async function ensureAllowance() {
  const current = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, VAULT_ADDRESS],
  });
  if (current >= amountWei * 100n) return;
  console.log(`[${ts()}] allowance below threshold, approving max…`);
  const hash = await walletClient.writeContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [VAULT_ADDRESS, MAX_UINT256],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  stats.txs += 1;
  console.log(`[${ts()}] approve confirmed · ${hash}`);
}

async function preflightChecks() {
  const [gasBal, tokBal] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);
  if (gasBal < MIN_GAS_WEI)
    die(
      `Gas too low: ${fmt(gasBal, 18)} CELO. Fund ${account.address} via Celo Sepolia faucet.`,
    );
  if (tokBal < amountWei)
    die(
      `Token too low: ${fmt(tokBal)} < ${AMOUNT}. Mint or transfer the spam token to ${account.address}.`,
    );
  console.log(
    `[${ts()}] preflight ok · gas ${fmt(gasBal, 18)} CELO · token ${fmt(tokBal)}`,
  );
}

async function pulse(i) {
  try {
    const depHash = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [TOKEN_ADDRESS, amountWei],
    });
    console.log(`[${ts()}] #${i} deposit  → ${depHash}`);
    await publicClient.waitForTransactionReceipt({ hash: depHash });
    stats.txs += 1;

    const wdrHash = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "withdrawBalance",
      args: [TOKEN_ADDRESS, amountWei],
    });
    console.log(`[${ts()}] #${i} withdraw → ${wdrHash}`);
    await publicClient.waitForTransactionReceipt({ hash: wdrHash });
    stats.txs += 1;
    stats.ok += 1;
  } catch (err) {
    stats.fail += 1;
    console.error(
      `[${ts()}] cycle #${i} failed:`,
      err?.shortMessage ?? err?.message ?? String(err),
    );
  }
}

async function loop() {
  let i = 0;
  while (!stopping) {
    await pulse(++i);
    if (stopping) break;
    // self-scheduling loop — prevents overlap if a cycle runs long
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function once() {
  await pulse(1);
}

function installShutdownHandlers() {
  const shutdown = (sig) => {
    if (stopping) return;
    stopping = true;
    const runtime = Math.round((Date.now() - stats.startedAt) / 1000);
    console.log(
      `\n[${ts()}] ${sig} — stopping. ${stats.ok} cycles ok, ${stats.fail} failed, ${stats.txs} txs submitted over ${runtime}s.`,
    );
    setTimeout(() => process.exit(0), 200);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const singleShot = MODE.toLowerCase() === "once";
  installShutdownHandlers();
  console.log(
    singleShot
      ? `[${ts()}] trickle spam (once) · ${CHAIN.name} · ${account.address} · ${AMOUNT} token`
      : `[${ts()}] trickle spam started · ${CHAIN.name} · ${account.address} · every ${INTERVAL_SECONDS}s · ${AMOUNT} token/cycle`,
  );
  await preflightChecks();
  await ensureAllowance();
  if (singleShot) {
    await once();
    const runtime = Math.round((Date.now() - stats.startedAt) / 1000);
    console.log(
      `[${ts()}] done. ok=${stats.ok} fail=${stats.fail} txs=${stats.txs} in ${runtime}s.`,
    );
    process.exit(stats.fail > 0 ? 1 : 0);
  }
  await loop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
