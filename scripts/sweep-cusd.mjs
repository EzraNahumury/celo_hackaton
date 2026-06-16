/**
 * Sweep surplus ERC20 (cUSD) from a pool of wallets back to the funder, leaving
 * KEEP_TOKEN per wallet. Lets us recycle cUSD that piled up unevenly across the
 * pool (multi-spam round-trips it; stream-spam redistributes it) and re-fund new
 * wallets WITHOUT swapping CELO->cUSD at the pool's terrible rate (~15.6 CELO/cUSD).
 *
 * Usage:
 *   FUNDER_KEY=0x... WALLETS=... NEW_WALLETS=... TOKEN_ADDRESS=0x765... \
 *   TOKEN_DECIMALS=18 KEEP_TOKEN=0.003 DRY_RUN=1 node sweep-cusd.mjs
 */
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

const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
  blockExplorers: { default: { name: "Celoscan", url: "https://celoscan.io" } },
});

const ERC20_ABI = [
  { name: "balanceOf", type: "function", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "transfer", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
];

const {
  FUNDER_KEY,
  WALLETS,
  NEW_WALLETS,
  WALLETS_FILE = "wallets.json",
  TOKEN_ADDRESS,
  TOKEN_DECIMALS = "18",
  KEEP_TOKEN = "0.003", // leave this much cUSD per wallet so it can still round-trip
  MIN_SWEEP = "0.001", // skip transfers smaller than this (not worth the gas)
  MIN_GAS_CELO = "0.005", // skip wallets that can't afford the transfer gas
  CONCURRENCY = "8",
  DEST, // optional override; defaults to funder address
  DRY_RUN = "0",
} = process.env;

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

function normalizeKey(raw) {
  let k = String(raw).trim();
  if (!k) return null;
  if (!k.startsWith("0x")) k = "0x" + k;
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return null;
  return k;
}

if (!FUNDER_KEY) die("FUNDER_KEY missing (destination wallet).");
const funderKey = normalizeKey(FUNDER_KEY);
if (!funderKey) die("FUNDER_KEY must be 0x 64-hex.");
if (!TOKEN_ADDRESS || !isAddress(TOKEN_ADDRESS)) die("TOKEN_ADDRESS missing/invalid.");

const funderAddr = privateKeyToAccount(funderKey).address;
const dest = DEST && isAddress(DEST) ? DEST : funderAddr;
const dec = Number(TOKEN_DECIMALS);
const keepWei = parseUnits(KEEP_TOKEN, dec);
const minSweepWei = parseUnits(MIN_SWEEP, dec);
const minGasWei = parseUnits(MIN_GAS_CELO, 18);
const dryRun = DRY_RUN === "1" || DRY_RUN.toLowerCase() === "true";
const concurrency = Math.max(1, Math.min(20, Number(CONCURRENCY)));

function parseKeys(raw, label) {
  if (!raw) return [];
  let arr;
  try { arr = JSON.parse(raw); } catch (e) { die(`${label} invalid JSON: ${e.message}`); }
  if (!Array.isArray(arr)) die(`${label} must be JSON array.`);
  return arr.map((k, i) => {
    const n = normalizeKey(k);
    if (!n) die(`Bad key at index ${i} in ${label}.`);
    return n;
  });
}

function loadKeys() {
  let raw = WALLETS;
  if (!raw) { try { raw = readFileSync(WALLETS_FILE, "utf8"); } catch {} }
  const keys = parseKeys(raw, "WALLETS");
  keys.push(...parseKeys(NEW_WALLETS, "NEW_WALLETS"));
  if (!keys.length) die("No source keys (WALLETS / NEW_WALLETS).");
  return keys;
}

const KEYS = loadKeys();
const transport = http(celoMainnet.rpcUrls.default.http[0], { retryCount: 3, retryDelay: 500, timeout: 30_000 });
const publicClient = createPublicClient({ chain: celoMainnet, transport });

const ts = () => new Date().toISOString().slice(11, 19);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmt = (v) => formatUnits(v, dec);

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
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function sweepOne(privateKey, idx) {
  const account = privateKeyToAccount(privateKey);
  const addr = account.address;
  const tag = `[${idx + 1}/${KEYS.length} ${short(addr)}]`;
  const res = { addr, swept: 0n, ok: false, skip: null };
  if (addr.toLowerCase() === dest.toLowerCase()) { res.skip = "is dest"; return res; }
  try {
    const [bal, gas] = await Promise.all([
      publicClient.readContract({ address: TOKEN_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }),
      publicClient.getBalance({ address: addr }),
    ]);
    if (bal <= keepWei) { res.skip = `bal ${fmt(bal)} <= keep`; return res; }
    const amount = bal - keepWei;
    if (amount < minSweepWei) { res.skip = `surplus ${fmt(amount)} < min`; return res; }
    if (gas < minGasWei) { res.skip = `gas low ${formatUnits(gas, 18)}`; return res; }
    if (dryRun) { res.swept = amount; res.ok = true; console.log(`${tag} would sweep ${fmt(amount)} cUSD`); return res; }
    const wallet = createWalletClient({ account, chain: celoMainnet, transport });
    const hash = await wallet.writeContract({ address: TOKEN_ADDRESS, abi: ERC20_ABI, functionName: "transfer", args: [dest, amount] });
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    res.swept = amount; res.ok = true;
    console.log(`${tag} swept ${fmt(amount)} cUSD · ${hash}`);
  } catch (err) {
    res.skip = `FAIL: ${err?.shortMessage ?? err?.message ?? String(err)}`;
    console.error(`${tag} ${res.skip}`);
  }
  return res;
}

async function main() {
  console.log(`[${ts()}] sweep-cusd · ${KEYS.length} sources → ${short(dest)} · keep ${KEEP_TOKEN}/wallet${dryRun ? " · DRY RUN" : ""}`);
  const results = await pmap(KEYS, concurrency, sweepOne);
  const swept = results.reduce((s, r) => s + r.swept, 0n);
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n[${ts()}] done. swept from ${ok} wallets · total ${fmt(swept)} cUSD${dryRun ? " (DRY RUN)" : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
