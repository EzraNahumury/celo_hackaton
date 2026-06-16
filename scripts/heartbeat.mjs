/**
 * Cheap DAU heartbeat. Each selected wallet sends a tiny RANDOM CELO amount to a
 * RANDOM OTHER pool wallet (looks like organic p2p payments, not a robotic loop).
 * A plain value transfer is ~21k gas — at a 200+ gwei spike that's ~0.004 CELO,
 * ~20x cheaper than a vault deposit+withdraw cycle (~0.09 CELO). This guarantees
 * each wallet is "daily active" even when the heavier multi-spam cycle can't afford
 * gas, decoupling DAU from the gas-price spike.
 *
 * DAU only needs ONE onchain tx per wallet per day — this is the floor that keeps
 * the metric up cheaply; multi-spam / stream-spam still add tx + cUSD volume when
 * gas is calm.
 *
 * Env:
 *   WALLETS, NEW_WALLETS  JSON arrays of keys (merged; same pool as multi-spam)
 *   SAMPLE_SIZE           fire only N random wallets per run (0 = all). Ramps DAU.
 *   AMOUNT_MIN/MAX        random CELO sent per heartbeat (default 0.000001-0.00001)
 *   MIN_GAS_CELO          skip wallet below this gas (default 0.01 — must afford tx)
 *   CONCURRENCY           parallel sends (default 12)
 *   DRY_RUN=1             no tx
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  formatGwei,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org", "https://rpc.ankr.com/celo"] } },
  blockExplorers: { default: { name: "Celoscan", url: "https://celoscan.io" } },
});
const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia Testnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] } },
  testnet: true,
});
const CHAIN = (process.env.CHAIN ?? "").toLowerCase() === "sepolia" ? celoSepolia : celoMainnet;

const {
  WALLETS,
  NEW_WALLETS,
  WALLETS_FILE = "wallets.json",
  SAMPLE_SIZE = "0",
  AMOUNT_MIN = "0.000001",
  AMOUNT_MAX = "0.00001",
  MIN_GAS_CELO = "0.01",
  CONCURRENCY = "12",
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

function parseKeys(raw, label) {
  if (!raw) return [];
  let arr;
  try { arr = JSON.parse(raw); } catch (e) { die(`${label} invalid JSON: ${e.message}`); }
  if (!Array.isArray(arr)) die(`${label} must be a JSON array.`);
  return arr.map((k, i) => {
    const n = normalizeKey(k);
    if (!n) die(`Bad key at index ${i} in ${label}.`);
    return n;
  });
}

function loadKeys() {
  let raw = WALLETS;
  if (!raw) { try { raw = readFileSync(WALLETS_FILE, "utf8"); } catch {} }
  const keys = [...parseKeys(raw, "WALLETS"), ...parseKeys(NEW_WALLETS, "NEW_WALLETS")];
  if (!keys.length) die("No keys (WALLETS / NEW_WALLETS).");
  // shuffle so the SAMPLE_SIZE slice is a random subset
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys;
}

const ALL = loadKeys();
const ADDRS = ALL.map((k) => privateKeyToAccount(k).address);
const sampleSize = Math.max(0, Number(SAMPLE_SIZE) || 0);
const KEYS = sampleSize > 0 && sampleSize < ALL.length ? ALL.slice(0, sampleSize) : ALL;
const minGasWei = parseUnits(MIN_GAS_CELO, 18);
const amtMin = parseFloat(AMOUNT_MIN);
const amtMax = parseFloat(AMOUNT_MAX);
const dryRun = DRY_RUN === "1" || DRY_RUN.toLowerCase() === "true";
const concurrency = Math.max(1, Math.min(30, Number(CONCURRENCY)));

const transport = http(CHAIN.rpcUrls.default.http[0], { retryCount: 3, retryDelay: 500, timeout: 30_000 });
const publicClient = createPublicClient({ chain: CHAIN, transport });

const ts = () => new Date().toISOString().slice(11, 19);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function pickRecipient(selfAddr) {
  // random other pool wallet (organic p2p look); fall back to self if pool tiny
  for (let tries = 0; tries < 5; tries++) {
    const r = ADDRS[Math.floor(Math.random() * ADDRS.length)];
    if (r.toLowerCase() !== selfAddr.toLowerCase()) return r;
  }
  return selfAddr;
}

function pickAmountWei() {
  const v = amtMin + Math.random() * (amtMax - amtMin);
  return parseUnits(v.toFixed(18), 18);
}

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

async function beat(privateKey, idx) {
  const account = privateKeyToAccount(privateKey);
  const addr = account.address;
  const tag = `[${idx + 1}/${KEYS.length} ${short(addr)}]`;
  const res = { addr, ok: false, skip: null };
  try {
    const gas = await publicClient.getBalance({ address: addr });
    if (gas < minGasWei) { res.skip = `gas low ${formatUnits(gas, 18)}`; return res; }
    const to = pickRecipient(addr);
    const value = pickAmountWei();
    if (dryRun) { res.ok = true; console.log(`${tag} → ${short(to)} ${formatUnits(value, 18)} CELO (dry)`); return res; }
    const wallet = createWalletClient({ account, chain: CHAIN, transport });
    const hash = await wallet.sendTransaction({ to, value });
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    res.ok = true;
    console.log(`${tag} → ${short(to)} ${formatUnits(value, 18)} CELO · ${hash}`);
  } catch (err) {
    res.skip = `FAIL: ${err?.shortMessage ?? err?.message ?? String(err)}`;
    console.error(`${tag} ${res.skip}`);
  }
  return res;
}

async function main() {
  const gp = await publicClient.getGasPrice();
  const note = KEYS.length < ALL.length ? `${KEYS.length}/${ALL.length} (sample)` : `${KEYS.length}`;
  console.log(`[${ts()}] heartbeat · ${CHAIN.name} · ${note} wallets · gas ${formatGwei(gp)} gwei${dryRun ? " · DRY RUN" : ""}`);
  const results = await pmap(KEYS, concurrency, beat);
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n[${ts()}] done. active=${ok}/${results.length} (DAU contribution)`);
  process.exit(ok === 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
