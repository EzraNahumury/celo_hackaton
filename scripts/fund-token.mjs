/**
 * Distribute an ERC20 token to a list of wallets.
 * Optionally swaps CELO → cUSD via Mento v1 Exchange before distributing.
 *
 * Usage:
 *   FUNDER_KEY=0x...  WALLETS_FILE=new-wallets-3.json  TOKEN_ADDRESS=0x765...  AMOUNT_TOKEN=0.05  node fund-token.mjs
 *   # With Mento swap first:
 *   FUNDER_KEY=0x...  WALLETS_FILE=new-wallets-3.json  TOKEN_ADDRESS=0x765...  AMOUNT_TOKEN=0.05  SWAP_CELO=22  node fund-token.mjs
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

// ── Chain ─────────────────────────────────────────────────────────────────
const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo.org"] },
  },
  blockExplorers: { default: { name: "Celoscan", url: "https://celoscan.io" } },
});

// ── ABIs ──────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
];

// Mento v2 Broker ABI
const BROKER_ABI = [
  {
    name: "swapIn",
    type: "function",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "getAmountOut",
    type: "function",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "view",
  },
];

// CELO as ERC20 (GoldToken) — needed for approve() before Mento swap
const CELO_ERC20_ADDRESS = "0x471EcE3750Da237f93B8E339c536989b8978a438";
// Mento v2
const MENTO_BROKER_ADDRESS = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD";
const MENTO_BIPOOLMANAGER_ADDRESS = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901";
// CELO/cUSD exchange ID on BiPoolManager (from getExchanges())
const MENTO_CELO_CUSD_EXCHANGE_ID =
  "0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c";

// ── Env ───────────────────────────────────────────────────────────────────
const {
  FUNDER_KEY,
  WALLETS,
  WALLETS_FILE = "wallets.json",
  RECIPIENTS,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS = "18",
  AMOUNT_TOKEN = "0.05",
  // Set SWAP_CELO=<amount> to swap that many CELO → TOKEN before distributing
  SWAP_CELO = "0",
  // Slippage tolerance: min fraction of expected buy amount (default 95%)
  SLIPPAGE = "0.95",
  // Skip wallets that already have at least this much token (idempotent re-runs)
  SKIP_IF_TOKEN_GE = "0",
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

if (!FUNDER_KEY) die("FUNDER_KEY missing.");
const funderKey = normalizeKey(FUNDER_KEY);
if (!funderKey) die("FUNDER_KEY must be 0x-prefixed 64-hex private key.");
if (!TOKEN_ADDRESS || !isAddress(TOKEN_ADDRESS))
  die("TOKEN_ADDRESS missing or invalid.");

const dec = Number(TOKEN_DECIMALS);
const amountEach = parseUnits(AMOUNT_TOKEN, dec);
const skipThreshold = parseUnits(SKIP_IF_TOKEN_GE, dec);
const swapCeloAmount = parseFloat(SWAP_CELO);
const dryRun = DRY_RUN === "1" || DRY_RUN.toLowerCase() === "true";

// ── Load recipients ──────────────────────────────────────────────────────
function loadRecipients() {
  if (RECIPIENTS) {
    let list;
    try {
      list = JSON.parse(RECIPIENTS);
    } catch {
      list = RECIPIENTS.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const bad = list.filter((a) => !isAddress(a));
    if (bad.length) die(`Invalid addresses in RECIPIENTS: ${bad.join(", ")}`);
    return { addresses: list, source: "RECIPIENTS env" };
  }

  let raw = WALLETS;
  let source = "WALLETS env";
  if (!raw) {
    try {
      raw = readFileSync(WALLETS_FILE, "utf8");
      source = `file ${WALLETS_FILE}`;
    } catch {
      die(`No recipients. Set RECIPIENTS, WALLETS, or create ${WALLETS_FILE}.`);
    }
  }
  const arr = JSON.parse(raw);
  const addresses = arr.map((k, i) => {
    const norm = normalizeKey(k);
    if (!norm) die(`Invalid key at index ${i} in ${source}.`);
    return privateKeyToAccount(norm).address;
  });
  return { addresses, source: `${source} (${addresses.length} keys)` };
}

const { addresses: RECIPIENT_ADDRS, source: RECIP_SOURCE } = loadRecipients();

// ── Clients ───────────────────────────────────────────────────────────────
const funderAccount = privateKeyToAccount(funderKey);
const transport = http(celoMainnet.rpcUrls.default.http[0], {
  retryCount: 3,
  retryDelay: 500,
  timeout: 30_000,
});
const publicClient = createPublicClient({ chain: celoMainnet, transport });
const walletClient = createWalletClient({
  account: funderAccount,
  chain: celoMainnet,
  transport,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ts() { return new Date().toISOString().slice(11, 19); }
function shortAddr(addr) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }
function fmt(v, d = dec) { return formatUnits(v, d); }

// ── Mento v2 swap CELO → token ───────────────────────────────────────────
async function swapCeloToToken(celoAmountStr) {
  const celoWei = parseUnits(celoAmountStr, 18);
  console.log(`\n[${ts()}] Mento v2 swap: ${celoAmountStr} CELO → token`);
  console.log(`[${ts()}] Broker: ${MENTO_BROKER_ADDRESS}`);

  // Get expected output
  const expectedOut = await publicClient.readContract({
    address: MENTO_BROKER_ADDRESS,
    abi: BROKER_ABI,
    functionName: "getAmountOut",
    args: [MENTO_BIPOOLMANAGER_ADDRESS, MENTO_CELO_CUSD_EXCHANGE_ID, CELO_ERC20_ADDRESS, TOKEN_ADDRESS, celoWei],
  });
  const minBuy = BigInt(Math.floor(Number(expectedOut) * parseFloat(SLIPPAGE)));
  console.log(
    `[${ts()}] expected ${fmt(expectedOut)} token, min ${fmt(minBuy)} (slippage ${SLIPPAGE})`,
  );

  if (dryRun) {
    console.log(`[${ts()}] DRY RUN — skipping swap.`);
    return;
  }

  // Approve CELO ERC20 for Broker
  const approveHash = await walletClient.writeContract({
    address: CELO_ERC20_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [MENTO_BROKER_ADDRESS, celoWei],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 2 });
  console.log(`[${ts()}] CELO approved for Broker: ${approveHash}`);
  await sleep(1500);

  // Swap via Mento v2 Broker
  const swapHash = await walletClient.writeContract({
    address: MENTO_BROKER_ADDRESS,
    abi: BROKER_ABI,
    functionName: "swapIn",
    args: [MENTO_BIPOOLMANAGER_ADDRESS, MENTO_CELO_CUSD_EXCHANGE_ID, CELO_ERC20_ADDRESS, TOKEN_ADDRESS, celoWei, minBuy],
  });
  await publicClient.waitForTransactionReceipt({ hash: swapHash, confirmations: 2 });
  console.log(`[${ts()}] swap confirmed: ${swapHash}`);
  await sleep(1500);

  const newBal = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [funderAccount.address],
  });
  console.log(`[${ts()}] funder token balance after swap: ${fmt(newBal)}`);
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  console.log(
    `[${ts()}] fund-token · funder ${shortAddr(funderAccount.address)} · ${RECIPIENT_ADDRS.length} recipients (${RECIP_SOURCE}) · ${AMOUNT_TOKEN} token/wallet · token ${shortAddr(TOKEN_ADDRESS)}${dryRun ? " · DRY RUN" : ""}`,
  );

  // Optional Mento swap
  if (swapCeloAmount > 0) {
    await swapCeloToToken(String(swapCeloAmount));
  }

  // Read funder token balance
  const funderTokenBal = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [funderAccount.address],
  });
  console.log(`\n[${ts()}] funder token balance: ${fmt(funderTokenBal)}`);

  // Read all recipient token balances in parallel
  const recipBalances = await Promise.all(
    RECIPIENT_ADDRS.map((addr) =>
      publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [addr],
      }),
    ),
  );

  // Build queue
  const queue = [];
  let skipCount = 0;
  RECIPIENT_ADDRS.forEach((addr, i) => {
    const bal = recipBalances[i];
    if (skipThreshold > 0n && bal >= skipThreshold) {
      console.log(`skip ${shortAddr(addr)} · already has ${fmt(bal)}`);
      skipCount++;
    } else {
      queue.push({ addr, idx: i, currentBal: bal });
    }
  });

  const totalNeeded = amountEach * BigInt(queue.length);
  console.log(
    `\n[${ts()}] queue: ${queue.length} wallets (${skipCount} skipped) · total need ${fmt(totalNeeded)}`,
  );

  if (funderTokenBal < totalNeeded) {
    die(
      `Funder token ${fmt(funderTokenBal)} < needed ${fmt(totalNeeded)}. Use SWAP_CELO to get more.`,
    );
  }

  if (dryRun) {
    console.log(`[${ts()}] DRY RUN — no transfers sent.`);
    process.exit(0);
  }

  // Distribute sequentially (single nonce)
  let ok = 0;
  let fail = 0;

  for (const { addr, idx } of queue) {
    const tag = `[${idx + 1}/${RECIPIENT_ADDRS.length} ${shortAddr(addr)}]`;
    try {
      const hash = await walletClient.writeContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [addr, amountEach],
      });
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      ok++;
      console.log(`${tag} sent ${AMOUNT_TOKEN} token · ${hash}`);
    } catch (err) {
      fail++;
      console.error(
        `${tag} FAIL: ${err?.shortMessage ?? err?.message ?? String(err)}`,
      );
    }
  }

  const runtime = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `\n[${ts()}] done in ${runtime}s. ok=${ok} fail=${fail} skipped=${skipCount}`,
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
