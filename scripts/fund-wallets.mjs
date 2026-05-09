import "dotenv/config";
import { readFileSync } from "node:fs";
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

// ── Env ───────────────────────────────────────────────────────────────────
const {
  FUNDER_KEY,
  WALLETS,
  WALLETS_FILE = "scripts/wallets.json",
  RECIPIENTS, // optional: JSON array OR comma-separated addresses
  AMOUNT_CELO = "0.5",
  SKIP_IF_BALANCE_GE = "0.45", // skip wallet if it already has at least this much CELO (idempotent re-runs)
  DRY_RUN = "0",
} = process.env;

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function normalizeKey(raw) {
  let k = String(raw).trim();
  if (!k) return null;
  if (!k.startsWith("0x")) k = "0x" + k;
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return null;
  return k;
}

if (!FUNDER_KEY) die("FUNDER_KEY missing — main wallet that pays out CELO.");
const funderKey = normalizeKey(FUNDER_KEY);
if (!funderKey) die("FUNDER_KEY must be 0x-prefixed 64-hex private key.");

// ── Load recipients ──────────────────────────────────────────────────────
function loadRecipients() {
  // Priority 1: RECIPIENTS env (addresses directly)
  if (RECIPIENTS) {
    let list;
    try {
      list = JSON.parse(RECIPIENTS);
    } catch {
      list = RECIPIENTS.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(list)) die("RECIPIENTS must be array or comma list.");
    const bad = list.filter((a) => !isAddress(a));
    if (bad.length) die(`Invalid addresses in RECIPIENTS: ${bad.join(", ")}`);
    return { addresses: list, source: "RECIPIENTS env" };
  }

  // Priority 2 / 3: derive addresses from private keys (WALLETS env or file)
  let raw = WALLETS;
  let source = "WALLETS env";
  if (!raw) {
    try {
      raw = readFileSync(WALLETS_FILE, "utf8");
      source = `file ${WALLETS_FILE}`;
    } catch {
      die(
        `No recipients. Set RECIPIENTS, WALLETS, or create ${WALLETS_FILE}.`,
      );
    }
  }
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    die(`${source} invalid JSON: ${e.message}`);
  }
  if (!Array.isArray(arr)) die(`${source} must be JSON array.`);
  const addresses = [];
  arr.forEach((k, i) => {
    const norm = normalizeKey(k);
    if (!norm) die(`Invalid key at index ${i} in ${source}.`);
    addresses.push(privateKeyToAccount(norm).address);
  });
  return { addresses, source: `${source} (derived from ${addresses.length} keys)` };
}

const { addresses: RECIPIENT_ADDRS, source: RECIP_SOURCE } = loadRecipients();
const targetWei = parseUnits(AMOUNT_CELO, 18);
const skipWei = parseUnits(SKIP_IF_BALANCE_GE, 18);
const dryRun = DRY_RUN === "1" || DRY_RUN.toLowerCase() === "true";

// ── Clients ───────────────────────────────────────────────────────────────
const funderAccount = privateKeyToAccount(funderKey);
const transport = fallback(
  CHAIN.rpcUrls.default.http.map((url) => http(url)),
  { rank: false, retryCount: 2, retryDelay: 400 },
);
const publicClient = createPublicClient({ chain: CHAIN, transport });
const walletClient = createWalletClient({
  account: funderAccount,
  chain: CHAIN,
  transport,
});

function ts() {
  return new Date().toISOString().slice(11, 19);
}
function shortAddr(addr) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  console.log(
    `[${ts()}] fund-wallets · ${CHAIN.name} · funder ${shortAddr(funderAccount.address)} · ${RECIPIENT_ADDRS.length} recipients (${RECIP_SOURCE}) · target ${AMOUNT_CELO} CELO each${dryRun ? " · DRY RUN" : ""}`,
  );

  // Read balances in parallel
  console.log(`[${ts()}] reading balances...`);
  const [funderBal, ...recipientBals] = await Promise.all([
    publicClient.getBalance({ address: funderAccount.address }),
    ...RECIPIENT_ADDRS.map((addr) => publicClient.getBalance({ address: addr })),
  ]);
  console.log(
    `[${ts()}] funder balance: ${formatUnits(funderBal, 18)} CELO`,
  );

  // Build queue: recipients that need topping up
  const queue = [];
  let skipCount = 0;
  RECIPIENT_ADDRS.forEach((addr, i) => {
    const bal = recipientBals[i];
    if (bal >= skipWei) {
      console.log(
        `[${ts()}] skip ${shortAddr(addr)} · already has ${formatUnits(bal, 18)} CELO`,
      );
      skipCount++;
    } else {
      const need = targetWei - bal;
      queue.push({ addr, idx: i, need, currentBal: bal });
    }
  });

  if (queue.length === 0) {
    console.log(`[${ts()}] nothing to fund. all ${skipCount} recipients already topped up.`);
    process.exit(0);
  }

  const totalNeed = queue.reduce((sum, q) => sum + q.need, 0n);
  const reserveGas = parseUnits("0.05", 18); // ~50 tx worth of gas reserve
  const required = totalNeed + reserveGas;

  console.log(
    `[${ts()}] queue: ${queue.length} wallets need top-up · total ${formatUnits(totalNeed, 18)} CELO + ~${formatUnits(reserveGas, 18)} CELO gas reserve`,
  );

  if (funderBal < required) {
    die(
      `Funder balance ${formatUnits(funderBal, 18)} CELO < required ${formatUnits(required, 18)} CELO. Top up funder first.`,
    );
  }

  if (dryRun) {
    console.log(`[${ts()}] DRY RUN — no transactions sent. Exiting.`);
    process.exit(0);
  }

  // Send sequentially with manual nonce — funder has single nonce, must order
  let nonce = await publicClient.getTransactionCount({
    address: funderAccount.address,
  });
  console.log(`[${ts()}] starting nonce ${nonce}`);

  const pending = [];
  let sent = 0;
  let failed = 0;

  for (const { addr, idx, need, currentBal } of queue) {
    const tag = `[${idx + 1}/${RECIPIENT_ADDRS.length} ${shortAddr(addr)}]`;
    try {
      const hash = await walletClient.sendTransaction({
        to: addr,
        value: need,
        nonce: nonce++,
      });
      pending.push({ hash, addr, need });
      sent++;
      console.log(
        `${tag} send ${formatUnits(need, 18)} CELO (had ${formatUnits(currentBal, 18)}) · ${hash}`,
      );
    } catch (err) {
      failed++;
      console.error(
        `${tag} SEND FAIL: ${err?.shortMessage ?? err?.message ?? String(err)}`,
      );
    }
  }

  // Wait for all receipts in parallel
  console.log(`\n[${ts()}] waiting for ${pending.length} receipts...`);
  const results = await Promise.allSettled(
    pending.map((p) =>
      publicClient.waitForTransactionReceipt({ hash: p.hash }),
    ),
  );
  let confirmed = 0;
  let receiptFailed = 0;
  results.forEach((r, i) => {
    const p = pending[i];
    if (r.status === "fulfilled" && r.value.status === "success") {
      confirmed++;
    } else {
      receiptFailed++;
      const reason =
        r.status === "rejected"
          ? r.reason?.shortMessage ?? r.reason?.message
          : `tx reverted`;
      console.error(`✗ ${shortAddr(p.addr)} · ${reason}`);
    }
  });

  const totalSent = pending.reduce((sum, p) => sum + p.need, 0n);
  const runtime = Math.round((Date.now() - startedAt) / 1000);

  console.log(
    `\n[${ts()}] done in ${runtime}s. confirmed=${confirmed}/${pending.length} send-fail=${failed} receipt-fail=${receiptFailed} skipped=${skipCount} · total ${formatUnits(totalSent, 18)} CELO sent`,
  );

  process.exit(failed > 0 || receiptFailed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
