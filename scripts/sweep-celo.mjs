/**
 * Sweep native CELO out of the whole spam pool (and the funder) back to a single
 * destination address. Post-hackathon refund: the season is over, the crons are
 * off, and the gas parked across ~300 throwaway wallets is just sitting there.
 *
 * Each wallet pays its own gas out of its own balance, so the value sent is
 *   value = balance - 21000 * maxFeePerGas
 * which is exactly affordable in the worst case (actual cost is lower, since the
 * effective gas price is usually below maxFeePerGas — that dust stays behind).
 *
 * WARNING: after this runs a wallet has ~0 gas, so any ERC20 (cUSD) left in it is
 * STRANDED — it can never pay for a transfer again. Sweep cUSD FIRST if you want it.
 *
 * Usage:
 *   DEST=0x... DRY_RUN=1 node sweep-celo.mjs      # report only, sends nothing
 *   DEST=0x... node sweep-celo.mjs                # actually sweep
 *
 * Reads FUNDER_KEY from scripts/.env and the pool keys from the new-wallets*.json
 * files (all gitignored — never commit them).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  parseGwei,
  formatGwei,
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
];

const {
  FUNDER_KEY,
  DEST,
  TOKEN_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD, for the stranded-balance warning
  KEY_FILES = "new-wallets.json,new-wallets-3.json,new-wallets-4.json,new-wallets-5.json,new-wallets-6.json,new-wallets-7.json,new-wallets-8.json",
  MIN_SWEEP_CELO = "0.0005", // below this the transfer costs more than it returns
  CONCURRENCY = "8",
  DRY_RUN = "0",
} = process.env;

const GAS_LIMIT = 21000n; // plain native transfer

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

function normalizeKey(raw) {
  let k = String(raw).trim();
  if (!k) return null;
  if (!k.startsWith("0x")) k = "0x" + k;
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return null;
  return k;
}

if (!DEST || !isAddress(DEST)) die("DEST missing/invalid — pass the destination address.");
const dryRun = DRY_RUN === "1" || DRY_RUN.toLowerCase() === "true";
const concurrency = Math.max(1, Math.min(20, Number(CONCURRENCY)));
const minSweepWei = parseUnits(MIN_SWEEP_CELO, 18);

// Dedupe: the same key can appear in more than one file, and we must never sweep
// a wallet twice (the second pass would just burn gas on a dust transfer).
const seen = new Set();
const KEYS = [];
function addKey(raw, origin) {
  const k = normalizeKey(raw);
  if (!k) die(`Bad key in ${origin}.`);
  const lower = k.toLowerCase();
  if (seen.has(lower)) return;
  seen.add(lower);
  KEYS.push(k);
}

for (const file of KEY_FILES.split(",").map((s) => s.trim()).filter(Boolean)) {
  let arr;
  try { arr = JSON.parse(readFileSync(file, "utf8")); } catch { console.warn(`· skip ${file} (unreadable)`); continue; }
  if (!Array.isArray(arr)) die(`${file} must be a JSON array of keys.`);
  arr.forEach((k) => addKey(k, file));
}
if (FUNDER_KEY) addKey(FUNDER_KEY, ".env FUNDER_KEY");
if (!KEYS.length) die("No keys found.");

const transport = http(celoMainnet.rpcUrls.default.http[0], { retryCount: 3, retryDelay: 500, timeout: 30_000 });
const publicClient = createPublicClient({ chain: celoMainnet, transport });

const ts = () => new Date().toISOString().slice(11, 19);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const celo = (v) => Number(formatUnits(v, 18)).toFixed(6);

// Tight EIP-1559 policy. viem's default maxFeePerGas is ~2x baseFee, which would
// force us to hold back 2x the real gas cost as unsweepable headroom.
let maxFeePerGas;
let maxPriorityFeePerGas;
async function computeFeePolicy() {
  const blk = await publicClient.getBlock();
  if (!blk.baseFeePerGas) die("no baseFeePerGas from RPC");
  maxPriorityFeePerGas = parseGwei("1");
  maxFeePerGas = blk.baseFeePerGas + blk.baseFeePerGas / 10n + maxPriorityFeePerGas;
  console.log(`[${ts()}] fee · base ${formatGwei(blk.baseFeePerGas)} → maxFee ${formatGwei(maxFeePerGas)} gwei · reserve ${celo(GAS_LIMIT * maxFeePerGas)} CELO/wallet`);
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

async function sweepOne(privateKey, idx) {
  const account = privateKeyToAccount(privateKey);
  const addr = account.address;
  const tag = `[${String(idx + 1).padStart(3)}/${KEYS.length} ${short(addr)}]`;
  const res = { addr, sent: 0n, token: 0n, ok: false, skip: null };

  if (addr.toLowerCase() === DEST.toLowerCase()) { res.skip = "is dest"; return res; }

  try {
    const [bal, token] = await Promise.all([
      publicClient.getBalance({ address: addr }),
      publicClient.readContract({ address: TOKEN_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }).catch(() => 0n),
    ]);
    res.token = token;

    const reserve = GAS_LIMIT * maxFeePerGas;
    if (bal <= reserve) { res.skip = `dust ${celo(bal)} <= gas reserve`; return res; }
    const value = bal - reserve;
    if (value < minSweepWei) { res.skip = `net ${celo(value)} < min`; return res; }

    if (dryRun) {
      res.sent = value; res.ok = true;
      console.log(`${tag} would send ${celo(value)} CELO (bal ${celo(bal)})`);
      return res;
    }

    const wallet = createWalletClient({ account, chain: celoMainnet, transport });
    const hash = await wallet.sendTransaction({ to: DEST, value, gas: GAS_LIMIT, maxFeePerGas, maxPriorityFeePerGas });
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    res.sent = value; res.ok = true;
    console.log(`${tag} sent ${celo(value)} CELO · ${hash}`);
  } catch (err) {
    res.skip = `FAIL: ${err?.shortMessage ?? err?.message ?? String(err)}`;
    console.error(`${tag} ${res.skip}`);
  }
  return res;
}

async function main() {
  console.log(`[${ts()}] sweep-celo · ${KEYS.length} wallets → ${DEST}${dryRun ? " · DRY RUN (nothing sent)" : ""}`);
  await computeFeePolicy();

  const results = await pmap(KEYS, concurrency, sweepOne);

  const sent = results.reduce((s, r) => s + r.sent, 0n);
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => r.skip?.startsWith("FAIL"));
  const strandedToken = results.reduce((s, r) => s + r.token, 0n);
  const withToken = results.filter((r) => r.token > 0n).length;

  console.log(`\n[${ts()}] done. ${ok}/${KEYS.length} wallets · ${celo(sent)} CELO → ${short(DEST)}${dryRun ? " (DRY RUN)" : ""}`);
  if (failed.length) console.log(`  failed: ${failed.length}`);
  if (strandedToken > 0n) {
    console.log(`  ⚠ ${withToken} wallets still hold ${Number(formatUnits(strandedToken, 18)).toFixed(4)} cUSD total —`);
    console.log(`    sweep that FIRST (sweep-cusd.mjs) or it is stranded once gas is gone.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
