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

/**
 * stream-spam — REAL cUSD volume generator.
 *
 * The deposit→withdrawBalance loop in multi-spam.mjs returns funds to the SAME
 * wallet, so the on-chain net flow (and the leaderboard "stablecoin volume"
 * metric) is ~0. This script instead pairs wallets as employer→employee and
 * runs the genuine payroll path:
 *
 *     payer.deposit(token, D)
 *     payer.createStream(payee, token, ratePerSec)
 *     …dwell a few seconds so salary accrues…
 *     payee.withdraw(payer, token, ratePerSec)   ← cUSD leaves payer's vault
 *                                                  balance and lands in the
 *                                                  payee WALLET = real volume
 *     payer.cancelStream(payee, token, ratePerSec)
 *
 * Idempotent and defensive because TrickleVault is immutable mainnet code:
 *  - skips createStream if the (payer,payee,token,rate) stream already exists,
 *  - skips withdraw when nothing has accrued,
 *  - tolerates a cancel revert (e.g. stream already gone) without failing.
 *
 * DRY_RUN=1 prints the plan and sends no transactions.
 */

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
    name: "createStream",
    inputs: [
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelStream",
    inputs: [
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "payer", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawable",
    inputs: [
      { name: "payer", type: "address" },
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStreamId",
    inputs: [
      { name: "payer", type: "address" },
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "getStream",
    inputs: [{ name: "streamId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "payer", type: "address" },
          { name: "payee", type: "address" },
          { name: "token", type: "address" },
          { name: "amountPerSec", type: "uint216" },
          { name: "lastPaid", type: "uint40" },
          { name: "startTime", type: "uint40" },
        ],
      },
    ],
    stateMutability: "view",
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
  // Per-pair payroll knobs (human token units / seconds).
  STREAM_DEPOSIT = "0.0006", // payer deposits this much before streaming
  STREAM_RATE_PER_SEC = "0.0001", // salary accrual per second
  STREAM_DWELL_SEC = "6", // seconds to let salary accrue before withdraw
  CONCURRENCY = "8",
  // Rotation: stream only this many random PAIRS per run (0 = all pairs).
  SAMPLE_PAIRS = "0",
  // A full pair cycle is deposit→createStream→withdraw→cancel (~4-5 txs). On
  // Celo, gas is capped by balance/gasPrice, so when the network is congested
  // (gasPrice spikes to 100-200 gwei) a near-floor payer reverts mid-cycle with
  // "gas required exceeds allowance". Require enough headroom up front so such
  // wallets are skipped cleanly at preflight instead of half-running.
  MIN_GAS_CELO = "0.03",
  DRY_RUN = "",
} = process.env;

const dryRun = DRY_RUN === "1" || DRY_RUN.toLowerCase?.() === "true";

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
      die(`No keys found. Set WALLETS env (JSON array) or create ${WALLETS_FILE}.`);
    }
  }
  const keys = parseKeyArray(raw, source);
  if (NEW_WALLETS) {
    const extra = parseKeyArray(NEW_WALLETS, "env NEW_WALLETS");
    keys.push(...extra);
    source += ` + NEW_WALLETS (${extra.length})`;
  }
  if (keys.length < 2) die("Need at least 2 wallets to form an employer→employee pair.");
  // Shuffle so pairings vary run to run.
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return { keys, source };
}

const { keys: ALL_KEYS, source: KEY_SOURCE } = loadKeys();

// Disjoint pairs: (0,1),(2,3),… — a wallet is never both payer and payee in the
// same run, so there are no self-nonce races.
const pairs = [];
for (let i = 0; i + 1 < ALL_KEYS.length; i += 2) {
  pairs.push({ payerKey: ALL_KEYS[i], payeeKey: ALL_KEYS[i + 1] });
}
const samplePairs = Math.max(0, Number(SAMPLE_PAIRS) || 0);
const PAIRS =
  samplePairs > 0 && samplePairs < pairs.length
    ? pairs.slice(0, samplePairs)
    : pairs;

const decimals = Number(TOKEN_DECIMALS);
const depositWei = parseUnits(STREAM_DEPOSIT, decimals);
const ratePerSecWei = parseUnits(STREAM_RATE_PER_SEC, decimals);
const dwellMs = Math.max(1, Number(STREAM_DWELL_SEC) || 6) * 1000;
const concurrency = Math.max(1, Math.min(50, Number(CONCURRENCY)));

if (ratePerSecWei <= 0n) die("STREAM_RATE_PER_SEC must be > 0.");
if (depositWei <= 0n) die("STREAM_DEPOSIT must be > 0.");

const MAX_UINT256 =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const MIN_GAS_WEI = parseUnits(MIN_GAS_CELO, 18);

// Gas the two roles burn per run. The payer does deposit + createStream +
// cancel; createStream is the heavy one (~256k — it cold-writes three index
// arrays). The payee only withdraws. Celo caps a tx's gas by balance/gasPrice,
// so the required CELO floor scales with the live gasPrice — computed in main().
const PAYER_CYCLE_GAS = 400_000n;
const PAYEE_CYCLE_GAS = 80_000n;
let payerFloorWei = MIN_GAS_WEI; // set from live gasPrice before the run
let payeeFloorWei = parseUnits("0.005", 18);

const transport = http(CHAIN.rpcUrls.default.http[0], {
  retryCount: 3,
  retryDelay: 500,
  timeout: 30_000,
});
const publicClient = createPublicClient({ chain: CHAIN, transport });

const settleMs = 1200;
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

async function streamExists(payer, payee) {
  const id = await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getStreamId",
    args: [payer, payee, TOKEN_ADDRESS, ratePerSecWei],
  });
  const stream = await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getStream",
    args: [id],
  });
  return stream.payer.toLowerCase() !== ZERO_ADDR;
}

// ── Per-pair payroll cycle ───────────────────────────────────────────────
async function processPair({ payerKey, payeeKey }, idx) {
  const payer = privateKeyToAccount(payerKey);
  const payee = privateKeyToAccount(payeeKey);
  const tag = `[${idx + 1}/${PAIRS.length} ${shortAddr(payer.address)}→${shortAddr(payee.address)}]`;
  const payerWallet = createWalletClient({ account: payer, chain: CHAIN, transport });
  const payeeWallet = createWalletClient({ account: payee, chain: CHAIN, transport });
  const result = { idx, payer: payer.address, payee: payee.address, ok: false, txs: 0, movedWei: 0n, err: null };

  try {
    // preflight: both need gas; payer needs token to deposit.
    const [payerGas, payeeGas, payerTok] = await Promise.all([
      publicClient.getBalance({ address: payer.address }),
      publicClient.getBalance({ address: payee.address }),
      publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [payer.address],
      }),
    ]);
    if (payerGas < payerFloorWei)
      throw new Error(`payer gas low: ${fmt(payerGas, 18)} < ${fmt(payerFloorWei, 18)} CELO`);
    if (payeeGas < payeeFloorWei)
      throw new Error(`payee gas low: ${fmt(payeeGas, 18)} < ${fmt(payeeFloorWei, 18)} CELO`);
    if (payerTok < depositWei) throw new Error(`payer token low: ${fmt(payerTok)} < ${fmt(depositWei)}`);

    if (dryRun) {
      console.log(
        `${tag} DRY: deposit ${fmt(depositWei)} → stream ${fmt(ratePerSecWei)}/s → dwell ${dwellMs / 1000}s → payee withdraw → cancel`,
      );
      result.ok = true;
      return result;
    }

    // 1) allowance (max approval, once)
    const allowance = await publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [payer.address, VAULT_ADDRESS],
    });
    if (allowance < depositWei * 100n) {
      const hash = await withRetry(
        () =>
          payerWallet.writeContract({
            address: TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [VAULT_ADDRESS, MAX_UINT256],
          }),
        `${tag} approve`,
      );
      await withRetry(
        () => publicClient.waitForTransactionReceipt({ hash, confirmations: 2 }),
        `${tag} approve-receipt`,
      );
      result.txs += 1;
      console.log(`${tag} approve ${hash}`);
      await sleep(settleMs);
    }

    // 2) deposit into the vault (funds the stream)
    const depHash = await withRetry(
      () =>
        payerWallet.writeContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: "deposit",
          args: [TOKEN_ADDRESS, depositWei],
        }),
      `${tag} deposit`,
    );
    await withRetry(
      () => publicClient.waitForTransactionReceipt({ hash: depHash, confirmations: 2 }),
      `${tag} deposit-receipt`,
    );
    result.txs += 1;
    console.log(`${tag} deposit ${depHash}`);
    await sleep(settleMs);

    // 3) createStream (skip if this exact stream already exists — idempotent)
    const exists = await streamExists(payer.address, payee.address);
    if (!exists) {
      const csHash = await withRetry(
        () =>
          payerWallet.writeContract({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: "createStream",
            args: [payee.address, TOKEN_ADDRESS, ratePerSecWei],
          }),
        `${tag} createStream`,
      );
      await withRetry(
        () => publicClient.waitForTransactionReceipt({ hash: csHash, confirmations: 2 }),
        `${tag} createStream-receipt`,
      );
      result.txs += 1;
      console.log(`${tag} createStream ${csHash}`);
    } else {
      console.log(`${tag} stream exists — reusing`);
    }

    // 4) let salary accrue
    await sleep(dwellMs);

    // 5) payee withdraws accrued salary → cUSD moves to the payee WALLET
    const owed = await publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "withdrawable",
      args: [payer.address, payee.address, TOKEN_ADDRESS, ratePerSecWei],
    });
    if (owed > 0n) {
      const wHash = await withRetry(
        () =>
          payeeWallet.writeContract({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: "withdraw",
            args: [payer.address, TOKEN_ADDRESS, ratePerSecWei],
          }),
        `${tag} withdraw`,
      );
      await withRetry(
        () => publicClient.waitForTransactionReceipt({ hash: wHash, confirmations: 2 }),
        `${tag} withdraw-receipt`,
      );
      result.txs += 1;
      result.movedWei = owed;
      console.log(`${tag} withdraw ${fmt(owed)} ${wHash}`);
      await sleep(settleMs);
    } else {
      console.log(`${tag} nothing accrued — skip withdraw`);
    }

    // 6) cancelStream — stops further accrual. Tolerate a revert (already gone).
    try {
      const cHash = await withRetry(
        () =>
          payerWallet.writeContract({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: "cancelStream",
            args: [payee.address, TOKEN_ADDRESS, ratePerSecWei],
          }),
        `${tag} cancelStream`,
      );
      await withRetry(
        () => publicClient.waitForTransactionReceipt({ hash: cHash, confirmations: 2 }),
        `${tag} cancelStream-receipt`,
      );
      result.txs += 1;
      console.log(`${tag} cancelStream ${cHash}`);
    } catch (err) {
      console.warn(`${tag} cancel skipped: ${err?.shortMessage ?? err?.message ?? err}`);
    }

    result.ok = true;
  } catch (err) {
    result.err = err?.shortMessage ?? err?.message ?? String(err);
    const reason = err?.cause?.reason ?? err?.cause?.shortMessage ?? err?.details ?? "";
    console.error(`${tag} FAIL: ${result.err}${reason ? ` | reason: ${reason}` : ""}`);
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

  // Scale the gas floors to the live gasPrice (with a 30% cushion). Keeps the
  // floor near-zero when Celo is calm and high enough to skip wallets that
  // would revert mid-cycle when gasPrice spikes. Never drops below MIN_GAS_CELO.
  const gasPrice = await publicClient.getGasPrice();
  const cushion = (g) => (g * gasPrice * 13n) / 10n;
  payerFloorWei = cushion(PAYER_CYCLE_GAS) > MIN_GAS_WEI ? cushion(PAYER_CYCLE_GAS) : MIN_GAS_WEI;
  const payeeStatic = parseUnits("0.005", 18);
  payeeFloorWei = cushion(PAYEE_CYCLE_GAS) > payeeStatic ? cushion(PAYEE_CYCLE_GAS) : payeeStatic;
  console.log(
    `[${ts()}] gasPrice ${(Number(gasPrice) / 1e9).toFixed(1)} gwei · gas floor payer ${fmt(payerFloorWei, 18)} / payee ${fmt(payeeFloorWei, 18)} CELO`,
  );

  const poolNote =
    PAIRS.length < pairs.length
      ? `${PAIRS.length}/${pairs.length} pairs (rotating slice)`
      : `${PAIRS.length} pairs`;
  console.log(
    `[${ts()}] stream-spam · ${CHAIN.name} · ${poolNote} (from ${KEY_SOURCE}) · concurrency ${concurrency} · deposit ${STREAM_DEPOSIT} · rate ${STREAM_RATE_PER_SEC}/s · dwell ${dwellMs / 1000}s${dryRun ? " · DRY_RUN" : ""}`,
  );

  const results = await pmap(PAIRS, concurrency, processPair);

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const txs = results.reduce((sum, r) => sum + r.txs, 0);
  const moved = results.reduce((sum, r) => sum + r.movedWei, 0n);
  const runtime = Math.round((Date.now() - startedAt) / 1000);

  console.log(
    `\n[${ts()}] done. ok=${ok}/${results.length} fail=${fail} txs=${txs} volume=${fmt(moved)} token in ${runtime}s.`,
  );

  if (fail > 0) {
    console.log("\nFailed pairs:");
    results
      .filter((r) => !r.ok)
      .forEach((r) => console.log(`  ${shortAddr(r.payer)}→${shortAddr(r.payee)}: ${r.err}`));
  }

  // Only fail the run if EVERY pair failed (real outage). Partial fails are normal.
  process.exit(ok === 0 && !dryRun ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
