import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  defineChain,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ── Chains ────────────────────────────────────────────────────────────────
const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo.org", "https://rpc.ankr.com/celo"] },
  },
  blockExplorers: { default: { name: "Celoscan", url: "https://celoscan.io" } },
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
  WALLETS,
  NEW_WALLETS,
  WALLETS_FILE = "wallets.json",
  VAULT_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS = "18",
  AMOUNT = "0.001",
  // Optional per-deposit amount randomization. When both are set (and valid),
  // each wallet deposits a random amount in [AMOUNT_MIN, AMOUNT_MAX] instead of
  // the fixed AMOUNT. Varied amounts look organic (not robotic) and lift gross
  // stablecoin volume — useful for nudging the cUSD-volume metric off zero.
  AMOUNT_MIN = "",
  AMOUNT_MAX = "",
  CONCURRENCY = "10",
  // Rotation: fire only this many random wallets per run (0 = all).
  // The full pool stays loaded so unique-wallet count keeps growing, but each
  // wallet only transacts on a fraction of runs → lower tx/wallet ratio.
  SAMPLE_SIZE = "0",
} = process.env;

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!VAULT_ADDRESS || !isAddress(VAULT_ADDRESS))
  die("VAULT_ADDRESS missing or not a valid 0x address.");
if (!TOKEN_ADDRESS || !isAddress(TOKEN_ADDRESS))
  die("TOKEN_ADDRESS missing or not a valid 0x address.");

// ── Load + normalize wallet keys ─────────────────────────────────────────
function normalizeKey(raw) {
  let k = String(raw).trim();
  if (!k) return null;
  if (!k.startsWith("0x")) k = "0x" + k;
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return null;
  return k;
}

function parseKeyArray(raw, source) {
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    die(`${source} is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(arr)) die(`${source} must be a JSON array of keys.`);
  const keys = [];
  const bad = [];
  arr.forEach((k, i) => {
    const norm = normalizeKey(k);
    if (norm) keys.push(norm);
    else bad.push(i);
  });
  if (bad.length)
    die(`Invalid key at indices in ${source}: ${bad.join(", ")} (must be 64-hex).`);
  return keys;
}

function loadKeys() {
  let raw = WALLETS;
  let source = "env WALLETS";
  if (!raw) {
    try {
      raw = readFileSync(WALLETS_FILE, "utf8");
      source = `file ${WALLETS_FILE}`;
    } catch {
      die(
        `No keys found. Set WALLETS env (JSON array) or create ${WALLETS_FILE}.`,
      );
    }
  }
  const keys = parseKeyArray(raw, source);

  // Merge NEW_WALLETS if provided (additive — old wallets untouched)
  if (NEW_WALLETS) {
    const extra = parseKeyArray(NEW_WALLETS, "env NEW_WALLETS");
    keys.push(...extra);
    source += ` + NEW_WALLETS (${extra.length})`;
  }

  if (!keys.length) die("No valid keys after parsing.");
  // Shuffle so NEW wallets don't always run last — helps detect ordering/RPC bias
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return { keys, source };
}

const { keys: ALL_KEYS, source: KEY_SOURCE } = loadKeys();
// Rotation slice — ALL_KEYS is already shuffled, so the first N are a random
// subset. Each run exercises a different slice → per-wallet tx count drops while
// every wallet still fires often enough over many runs to stay season-active.
const sampleSize = Math.max(0, Number(SAMPLE_SIZE) || 0);
const KEYS =
  sampleSize > 0 && sampleSize < ALL_KEYS.length
    ? ALL_KEYS.slice(0, sampleSize)
    : ALL_KEYS;
const decimals = Number(TOKEN_DECIMALS);
const fixedAmountWei = parseUnits(AMOUNT, decimals);

// Amount randomization (opt-in via AMOUNT_MIN/AMOUNT_MAX in human units).
const amtMin = parseFloat(AMOUNT_MIN);
const amtMax = parseFloat(AMOUNT_MAX);
const randomizeAmount =
  Number.isFinite(amtMin) && Number.isFinite(amtMax) && amtMin > 0 && amtMax >= amtMin;
// Upper bound used for the funder/allowance checks (the most a wallet can need).
const amountMaxWei = randomizeAmount
  ? parseUnits(amtMax.toFixed(6), decimals)
  : fixedAmountWei;

// Pick this wallet's deposit amount. Random in [min,max] when enabled, else fixed.
function pickAmountWei() {
  if (!randomizeAmount) return fixedAmountWei;
  const v = amtMin + Math.random() * (amtMax - amtMin);
  return parseUnits(v.toFixed(6), decimals);
}

const concurrency = Math.max(1, Math.min(50, Number(CONCURRENCY)));
const MAX_UINT256 =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
const MIN_GAS_WEI = parseUnits("0.005", 18);

// ── Shared transport (pinned to primary RPC to avoid cross-node read-after-write races) ────────────
// Multi-node fallback caused "exceeded allowance" / "insufficient balance" reverts because
// dependent tx hit a different node than the one that confirmed the prior tx receipt.
const transport = http(CHAIN.rpcUrls.default.http[0], {
  retryCount: 3,
  retryDelay: 500,
  timeout: 30_000, // 30s — primary RPC slows under high concurrent load
});
const publicClient = createPublicClient({ chain: CHAIN, transport });

const settleMs = 1200; // wait for state propagation between dependent tx
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err?.shortMessage ?? err?.message ?? "";
      const transient = /timeout|took too long|network|fetch|503|504/i.test(msg);
      if (!transient || i === attempts - 1) throw err;
      console.warn(`${label} retry (${msg})`);
      await sleep(1500);
    }
  }
  throw lastErr;
}

function ts() {
  return new Date().toISOString().slice(11, 19);
}
function fmt(weiBig, dec = decimals) {
  return formatUnits(weiBig, dec);
}
function shortAddr(addr) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Per-wallet pipeline ──────────────────────────────────────────────────
async function processWallet(privateKey, idx) {
  const account = privateKeyToAccount(privateKey);
  const tag = `[${idx + 1}/${KEYS.length} ${shortAddr(account.address)}]`;
  const wallet = createWalletClient({ account, chain: CHAIN, transport });
  const result = { idx, address: account.address, ok: false, txs: 0, err: null };

  // This wallet's deposit amount for this run (random when enabled).
  const amountWei = pickAmountWei();

  try {
    // preflight
    const [gas, tok] = await Promise.all([
      publicClient.getBalance({ address: account.address }),
      publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      }),
    ]);
    if (gas < MIN_GAS_WEI)
      throw new Error(`gas low: ${fmt(gas, 18)} CELO`);
    if (tok < amountWei)
      throw new Error(`token low: ${fmt(tok)} < ${fmt(amountWei)}`);

    // ensure allowance (only first time, max approval)
    const allowance = await publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account.address, VAULT_ADDRESS],
    });
    if (allowance < amountMaxWei * 100n) {
      const hash = await withRetry(
        () =>
          wallet.writeContract({
            address: TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [VAULT_ADDRESS, MAX_UINT256],
          }),
        `${tag} approve`,
      );
      await withRetry(
        () =>
          publicClient.waitForTransactionReceipt({ hash, confirmations: 2 }),
        `${tag} approve-receipt`,
      );
      result.txs += 1;
      console.log(`${tag} approve ${hash}`);
      await sleep(settleMs);
    }

    // deposit
    const depHash = await withRetry(
      () =>
        wallet.writeContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: "deposit",
          args: [TOKEN_ADDRESS, amountWei],
        }),
      `${tag} deposit`,
    );
    await withRetry(
      () =>
        publicClient.waitForTransactionReceipt({ hash: depHash, confirmations: 2 }),
      `${tag} deposit-receipt`,
    );
    result.txs += 1;
    console.log(`${tag} deposit ${depHash}`);
    await sleep(settleMs);

    // withdrawBalance
    const wdrHash = await withRetry(
      () =>
        wallet.writeContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: "withdrawBalance",
          args: [TOKEN_ADDRESS, amountWei],
        }),
      `${tag} withdraw`,
    );
    await withRetry(
      () =>
        publicClient.waitForTransactionReceipt({ hash: wdrHash, confirmations: 2 }),
      `${tag} withdraw-receipt`,
    );
    result.txs += 1;
    console.log(`${tag} withdraw ${wdrHash}`);

    result.ok = true;
  } catch (err) {
    result.err = err?.shortMessage ?? err?.message ?? String(err);
    const reason = err?.cause?.reason ?? err?.cause?.shortMessage ?? err?.details ?? "";
    const data = err?.cause?.data ?? err?.data ?? "";
    console.error(`${tag} FAIL: ${result.err}${reason ? ` | reason: ${reason}` : ""}${data ? ` | data: ${data}` : ""}`);
  }
  return result;
}

// ── Concurrency-limited batch runner ─────────────────────────────────────
async function pmap(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  const poolNote =
    KEYS.length < ALL_KEYS.length
      ? `${KEYS.length}/${ALL_KEYS.length} wallets (rotating slice)`
      : `${KEYS.length} wallets`;
  const amountNote = randomizeAmount
    ? `${amtMin}–${amtMax} token/wallet (random)`
    : `${AMOUNT} token/wallet`;
  console.log(
    `[${ts()}] multi-spam · ${CHAIN.name} · ${poolNote} (from ${KEY_SOURCE}) · concurrency ${concurrency} · ${amountNote}`,
  );

  const results = await pmap(KEYS, concurrency, processWallet);

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const txs = results.reduce((sum, r) => sum + r.txs, 0);
  const runtime = Math.round((Date.now() - startedAt) / 1000);

  console.log(
    `\n[${ts()}] done. ok=${ok}/${results.length} fail=${fail} txs=${txs} in ${runtime}s.`,
  );

  if (fail > 0) {
    console.log("\nFailed wallets:");
    results
      .filter((r) => !r.ok)
      .forEach((r) =>
        console.log(`  ${shortAddr(r.address)}: ${r.err}`),
      );
  }

  // Only fail the run if EVERY wallet failed (real outage: RPC down, bad secret).
  // Partial failures are normal — a few wallets drift low on gas/token between
  // refunds — and shouldn't paint the whole scheduled run red.
  process.exit(ok === 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
