/**
 * Seed StreamRegistry with on-chain payslip attestations.
 *
 * Each loaded wallet acts as an EMPLOYER:
 *   1. setEmployerName(company)            — names its own company
 *   2. setEmployment(payee, name, role, …) — labels the NEXT wallet as a payee
 *
 * Both calls are real txs on the StreamRegistry contract (which Karma tracks
 * on-chain) and produce a demoable "✓ verified" payslip: connect as a payee
 * whose employer set these, and the payslip shows the verified employer + role.
 *
 * Idempotent: skips a wallet's employer-name / employment if already set, so
 * re-runs only fill gaps. StreamRegistry is msg.sender-keyed, so each wallet
 * signs its own attestations — wallets must hold a little CELO for gas (the
 * funded spam wallets already do).
 *
 * Usage:
 *   WALLETS_FILE=new-wallets-4.json node seed-attestations.mjs
 *   WALLETS_FILE=new-wallets-4.json SAMPLE_SIZE=20 node seed-attestations.mjs
 *   WALLETS_FILE=new-wallets-4.json DRY_RUN=1 node seed-attestations.mjs
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  isAddress,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
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

// ── ABI (subset) ───────────────────────────────────────────────────────────
const STREAM_REGISTRY_ABI = [
  {
    type: "function",
    name: "setEmployerName",
    inputs: [{ name: "name", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setEmployment",
    inputs: [
      { name: "payee", type: "address" },
      { name: "name", type: "string" },
      { name: "role", type: "string" },
      { name: "memo", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEmployerName",
    inputs: [{ name: "payer", type: "address" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEmployment",
    inputs: [
      { name: "payer", type: "address" },
      { name: "payee", type: "address" },
    ],
    outputs: [
      { name: "name", type: "string" },
      { name: "role", type: "string" },
      { name: "memo", type: "string" },
    ],
    stateMutability: "view",
  },
];

// ── Env ───────────────────────────────────────────────────────────────────
const {
  WALLETS,
  NEW_WALLETS,
  WALLETS_FILE = "wallets.json",
  STREAM_REGISTRY_ADDRESS = "0x84D03930631b37Ae71A1b3c6C333ADcD32B88d99",
  CONCURRENCY = "8",
  // Seed only this many random wallets per run (0 = all loaded wallets).
  SAMPLE_SIZE = "0",
  // Skip the per-payee employment call, seed employer names only.
  EMPLOYER_ONLY = "0",
  DRY_RUN = "0",
} = process.env;

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!isAddress(STREAM_REGISTRY_ADDRESS))
  die("STREAM_REGISTRY_ADDRESS is not a valid 0x address.");

const REGISTRY = getAddress(STREAM_REGISTRY_ADDRESS);
const employerOnly = EMPLOYER_ONLY === "1" || EMPLOYER_ONLY.toLowerCase() === "true";
const dryRun = DRY_RUN === "1" || DRY_RUN.toLowerCase() === "true";
const concurrency = Math.max(1, Math.min(20, Number(CONCURRENCY) || 8));

// Contract length caps — keep seed strings inside them.
const MAX_NAME = 32;
const MAX_ROLE = 32;
const MAX_MEMO = 64;
const clamp = (s, n) => (s.length > n ? s.slice(0, n) : s);

// ── Dataset ─────────────────────────────────────────────────────────────────
const DATA = JSON.parse(readFileSync(join(__dirname, "seed-data.json"), "utf8"));
const pick = (arr, i) => arr[i % arr.length];

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
  arr.forEach((k, i) => {
    const norm = normalizeKey(k);
    if (norm) keys.push(norm);
    else die(`Invalid key at index ${i} in ${source} (must be 64-hex).`);
  });
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
      die(`No keys. Set WALLETS env (JSON array) or create ${WALLETS_FILE}.`);
    }
  }
  const keys = parseKeyArray(raw, source);
  if (NEW_WALLETS) {
    const extra = parseKeyArray(NEW_WALLETS, "env NEW_WALLETS");
    keys.push(...extra);
    source += ` + NEW_WALLETS (${extra.length})`;
  }
  if (!keys.length) die("No valid keys after parsing.");
  return { keys, source };
}

const { keys: ALL_KEYS, source: KEY_SOURCE } = loadKeys();
if (ALL_KEYS.length < 2)
  die("Need at least 2 wallets so an employer has a distinct payee.");

// Stable employer→payee pairing (NEXT wallet, wraps around). Built from the
// full list so pairings stay consistent across runs (idempotent reads match).
const ACCOUNTS = ALL_KEYS.map((k) => privateKeyToAccount(k));
const indexOfNextPayee = (i) => (i + 1) % ACCOUNTS.length;

// Rotation slice — first N of a shuffled copy of indices.
function selectedIndices() {
  const idxs = ACCOUNTS.map((_, i) => i);
  const n = Math.max(0, Number(SAMPLE_SIZE) || 0);
  if (n <= 0 || n >= idxs.length) return idxs;
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor((i + 1) * 0.61803398875) % (i + 1); // deterministic shuffle
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs.slice(0, n);
}

// ── Clients ───────────────────────────────────────────────────────────────
const transport = http(CHAIN.rpcUrls.default.http[0], {
  retryCount: 3,
  retryDelay: 500,
  timeout: 30_000,
});
const publicClient = createPublicClient({ chain: CHAIN, transport });

const MIN_GAS_WEI = 2_000_000_000_000_000n; // 0.002 CELO
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

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

// ── Per-wallet pipeline ──────────────────────────────────────────────────
async function processEmployer(employerIdx) {
  const account = ACCOUNTS[employerIdx];
  const payeeAccount = ACCOUNTS[indexOfNextPayee(employerIdx)];
  const tag = `[${shortAddr(account.address)}]`;
  const wallet = createWalletClient({ account, chain: CHAIN, transport });
  const result = { idx: employerIdx, address: account.address, ok: false, txs: 0, err: null };

  const company = clamp(pick(DATA.companies, employerIdx), MAX_NAME);
  const empName = clamp(pick(DATA.names, employerIdx), MAX_NAME);
  const empRole = clamp(pick(DATA.roles, employerIdx), MAX_ROLE);
  const empMemo = clamp(pick(DATA.memos, employerIdx), MAX_MEMO);

  try {
    const gas = await publicClient.getBalance({ address: account.address });
    if (gas < MIN_GAS_WEI) throw new Error(`gas low: ${gas} wei CELO`);

    // 1. Employer name (skip if already set)
    const existingName = await publicClient.readContract({
      address: REGISTRY,
      abi: STREAM_REGISTRY_ABI,
      functionName: "getEmployerName",
      args: [account.address],
    });
    if (existingName && existingName.length > 0) {
      console.log(`${tag} employer name already "${existingName}" — skip`);
    } else if (dryRun) {
      console.log(`${tag} DRY: setEmployerName("${company}")`);
    } else {
      const hash = await withRetry(
        () =>
          wallet.writeContract({
            address: REGISTRY,
            abi: STREAM_REGISTRY_ABI,
            functionName: "setEmployerName",
            args: [company],
          }),
        `${tag} setEmployerName`,
      );
      await withRetry(
        () => publicClient.waitForTransactionReceipt({ hash, confirmations: 1 }),
        `${tag} name-receipt`,
      );
      result.txs += 1;
      console.log(`${tag} setEmployerName "${company}" · ${hash}`);
      await sleep(1000);
    }

    // 2. Employment for the paired payee (skip if already set / employer-only)
    if (!employerOnly) {
      const [exName] = await publicClient.readContract({
        address: REGISTRY,
        abi: STREAM_REGISTRY_ABI,
        functionName: "getEmployment",
        args: [account.address, payeeAccount.address],
      });
      if (exName && exName.length > 0) {
        console.log(`${tag} employment for ${shortAddr(payeeAccount.address)} exists — skip`);
      } else if (dryRun) {
        console.log(`${tag} DRY: setEmployment(${shortAddr(payeeAccount.address)}, "${empName}", "${empRole}")`);
      } else {
        const hash = await withRetry(
          () =>
            wallet.writeContract({
              address: REGISTRY,
              abi: STREAM_REGISTRY_ABI,
              functionName: "setEmployment",
              args: [payeeAccount.address, empName, empRole, empMemo],
            }),
          `${tag} setEmployment`,
        );
        await withRetry(
          () => publicClient.waitForTransactionReceipt({ hash, confirmations: 1 }),
          `${tag} employment-receipt`,
        );
        result.txs += 1;
        console.log(`${tag} setEmployment ${shortAddr(payeeAccount.address)} "${empName}/${empRole}" · ${hash}`);
      }
    }

    result.ok = true;
  } catch (err) {
    result.err = err?.shortMessage ?? err?.message ?? String(err);
    console.error(`${tag} FAIL: ${result.err}`);
  }
  return result;
}

// ── Concurrency-limited runner ────────────────────────────────────────────
async function pmap(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  const idxs = selectedIndices();
  const poolNote =
    idxs.length < ACCOUNTS.length
      ? `${idxs.length}/${ACCOUNTS.length} wallets (rotating slice)`
      : `${idxs.length} wallets`;
  console.log(
    `[${ts()}] seed-attestations · ${CHAIN.name} · registry ${shortAddr(REGISTRY)} · ${poolNote} (from ${KEY_SOURCE})${employerOnly ? " · employer-only" : ""}${dryRun ? " · DRY RUN" : ""}`,
  );

  const results = await pmap(idxs, concurrency, processEmployer);

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const txs = results.reduce((s, r) => s + r.txs, 0);
  const runtime = Math.round((Date.now() - startedAt) / 1000);

  console.log(`\n[${ts()}] done. ok=${ok}/${results.length} fail=${fail} txs=${txs} in ${runtime}s.`);

  // Print one demo pair for a verified payslip walkthrough.
  const demo = results.find((r) => r.ok);
  if (demo) {
    const payee = ACCOUNTS[indexOfNextPayee(demo.idx)].address;
    console.log(
      `\nDemo verified payslip → employer ${demo.address}  pays  payee ${payee}` +
        `\n(connect as the payee to see the ✓ verified employer on the payslip)`,
    );
  }

  if (fail > 0) {
    console.log("\nFailed:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ${shortAddr(r.address)}: ${r.err}`));
  }

  process.exit(ok === 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
