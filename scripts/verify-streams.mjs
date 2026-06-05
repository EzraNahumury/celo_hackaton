import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  http,
  formatUnits,
  defineChain,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * verify-streams — read-only audit of the stream-spam payroll flow.
 *
 * For every wallet it reads the vault's payer/payee stream indexes and, for each
 * live stream, the currently `withdrawable` amount. Reports active stream counts
 * and total cUSD pending withdrawal — a quick way to confirm stream-spam.mjs
 * actually opened streams and that salary is accruing. Sends NO transactions.
 */

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

const VAULT_ABI = [
  {
    type: "function",
    name: "getPayerStreamIds",
    inputs: [{ name: "payer", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPayeeStreamIds",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
    stateMutability: "view",
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
];

const {
  WALLETS,
  NEW_WALLETS,
  WALLETS_FILE = "wallets.json",
  VAULT_ADDRESS,
  TOKEN_DECIMALS = "18",
  SAMPLE_SIZE = "0",
} = process.env;

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!VAULT_ADDRESS || !isAddress(VAULT_ADDRESS))
  die("VAULT_ADDRESS missing or not a valid 0x address.");

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
  return arr.map(normalizeKey).filter(Boolean);
}
function loadKeys() {
  let raw = WALLETS;
  if (!raw) {
    try {
      raw = readFileSync(WALLETS_FILE, "utf8");
    } catch {
      die(`No keys found. Set WALLETS env or create ${WALLETS_FILE}.`);
    }
  }
  const keys = parseKeyArray(raw, "WALLETS");
  if (NEW_WALLETS) keys.push(...parseKeyArray(NEW_WALLETS, "NEW_WALLETS"));
  if (!keys.length) die("No valid keys.");
  return keys;
}

const KEYS = loadKeys();
const decimals = Number(TOKEN_DECIMALS);
const sampleSize = Math.max(0, Number(SAMPLE_SIZE) || 0);
const SELECTED = sampleSize > 0 ? KEYS.slice(0, sampleSize) : KEYS;

const transport = http(CHAIN.rpcUrls.default.http[0], { retryCount: 3, timeout: 30_000 });
const publicClient = createPublicClient({ chain: CHAIN, transport });

const fmt = (w) => formatUnits(w, decimals);
const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function read(fn, args) {
  return publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: fn, args });
}

async function main() {
  console.log(`[verify-streams] ${CHAIN.name} · ${SELECTED.length} wallets · vault ${shortAddr(VAULT_ADDRESS)}`);

  let asPayer = 0;
  let asPayee = 0;
  let pendingWei = 0n;
  let withPayerStreams = 0;
  let withPayeeStreams = 0;

  for (let i = 0; i < SELECTED.length; i++) {
    const addr = privateKeyToAccount(SELECTED[i]).address;
    const [payerIds, payeeIds] = await Promise.all([
      read("getPayerStreamIds", [addr]),
      read("getPayeeStreamIds", [addr]),
    ]);
    asPayer += payerIds.length;
    asPayee += payeeIds.length;
    if (payerIds.length) withPayerStreams++;
    if (payeeIds.length) withPayeeStreams++;

    // Sum what this wallet can withdraw across the streams paid TO it.
    for (const id of payeeIds) {
      const s = await read("getStream", [id]);
      const owed = await read("withdrawable", [s.payer, addr, s.token, s.amountPerSec]);
      pendingWei += owed;
    }

    if (payerIds.length || payeeIds.length) {
      console.log(`  ${shortAddr(addr)}: payer=${payerIds.length} payee=${payeeIds.length}`);
    }
  }

  console.log(
    `\n[verify-streams] done. wallets-with-outgoing=${withPayerStreams} wallets-with-incoming=${withPayeeStreams} active-streams payer=${asPayer} payee=${asPayee} pending-withdrawable=${fmt(pendingWei)} token`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
