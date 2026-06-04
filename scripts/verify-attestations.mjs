/**
 * Verify StreamRegistry attestations written by seed-attestations.mjs.
 *
 * Read-only. For each loaded wallet it reads getEmployerName(employer) and
 * getEmployment(employer, nextPayee) and reports how many are populated, so you
 * can confirm a seed run landed on-chain without trusting the seed's own logs.
 *
 * Usage:
 *   WALLETS_FILE=new-wallets-4.json node verify-attestations.mjs
 *   WALLETS_FILE=new-wallets-4.json LIMIT=10 node verify-attestations.mjs
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  http,
  defineChain,
  isAddress,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo.org", "https://rpc.ankr.com/celo"] },
  },
  blockExplorers: { default: { name: "Celoscan", url: "https://celoscan.io" } },
});

const STREAM_REGISTRY_ABI = [
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

const {
  WALLETS,
  NEW_WALLETS,
  WALLETS_FILE = "wallets.json",
  STREAM_REGISTRY_ADDRESS = "0x84D03930631b37Ae71A1b3c6C333ADcD32B88d99",
  LIMIT = "0",
} = process.env;

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!isAddress(STREAM_REGISTRY_ADDRESS)) die("STREAM_REGISTRY_ADDRESS invalid.");
const REGISTRY = getAddress(STREAM_REGISTRY_ADDRESS);

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
  if (!Array.isArray(arr)) die(`${source} must be a JSON array.`);
  return arr.map((k, i) => {
    const n = normalizeKey(k);
    if (!n) die(`Invalid key at index ${i} in ${source}.`);
    return n;
  });
}
function loadKeys() {
  let raw = WALLETS;
  let source = "env WALLETS";
  if (!raw) {
    try {
      raw = readFileSync(WALLETS_FILE, "utf8");
      source = `file ${WALLETS_FILE}`;
    } catch {
      die(`No keys. Set WALLETS or create ${WALLETS_FILE}.`);
    }
  }
  const keys = parseKeyArray(raw, source);
  if (NEW_WALLETS) keys.push(...parseKeyArray(NEW_WALLETS, "env NEW_WALLETS"));
  return keys;
}

const KEYS = loadKeys();
if (KEYS.length < 2) die("Need at least 2 wallets.");
const ACCOUNTS = KEYS.map((k) => privateKeyToAccount(k));
const limit = Math.max(0, Number(LIMIT) || 0);
const N = limit > 0 && limit < ACCOUNTS.length ? limit : ACCOUNTS.length;

const transport = http(celoMainnet.rpcUrls.default.http[0], {
  retryCount: 3,
  retryDelay: 500,
  timeout: 30_000,
});
const publicClient = createPublicClient({ chain: celoMainnet, transport });
const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function main() {
  console.log(`verify-attestations · registry ${shortAddr(REGISTRY)} · checking ${N}/${ACCOUNTS.length} wallets\n`);
  let withName = 0;
  let withEmployment = 0;

  for (let i = 0; i < N; i++) {
    const employer = ACCOUNTS[i].address;
    const payee = ACCOUNTS[(i + 1) % ACCOUNTS.length].address;
    const [name, [empName, empRole]] = await Promise.all([
      publicClient.readContract({
        address: REGISTRY,
        abi: STREAM_REGISTRY_ABI,
        functionName: "getEmployerName",
        args: [employer],
      }),
      publicClient.readContract({
        address: REGISTRY,
        abi: STREAM_REGISTRY_ABI,
        functionName: "getEmployment",
        args: [employer, payee],
      }),
    ]);
    const hasName = name && name.length > 0;
    const hasEmp = empName && empName.length > 0;
    if (hasName) withName++;
    if (hasEmp) withEmployment++;
    console.log(
      `${shortAddr(employer)}  name=${hasName ? `"${name}"` : "—"}  ` +
        `employs ${shortAddr(payee)}=${hasEmp ? `"${empName}/${empRole}"` : "—"}`,
    );
  }

  console.log(
    `\nsummary: ${withName}/${N} employer names set · ${withEmployment}/${N} employments set`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
