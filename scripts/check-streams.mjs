/**
 * Check active streams for old wallets.
 */
import "dotenv/config";
import { createPublicClient, http, formatUnits, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
});

const { WALLETS, NEW_WALLETS, TOKEN_ADDRESS, VAULT_ADDRESS, TOKEN_DECIMALS = "18" } = process.env;
if (!TOKEN_ADDRESS || !VAULT_ADDRESS) { console.error("TOKEN_ADDRESS and VAULT_ADDRESS required"); process.exit(1); }

function normalizeKey(raw) {
  let k = String(raw).trim();
  if (!k.startsWith("0x")) k = "0x" + k;
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return null;
  return k;
}

function loadKeys(raw, label) {
  if (!raw) return [];
  const arr = JSON.parse(raw);
  return arr.map((k, i) => {
    const norm = normalizeKey(k);
    if (!norm) { console.error(`Bad key at index ${i} in ${label}`); process.exit(1); }
    return norm;
  });
}

const oldKeys = loadKeys(WALLETS, "WALLETS");
const newKeys = loadKeys(NEW_WALLETS, "NEW_WALLETS");
const keys = [...oldKeys, ...newKeys];

const client = createPublicClient({ chain: celoMainnet, transport: http() });

const VAULT_ABI = [
  { type: "function", name: "getPayerStreamCount", inputs: [{ name: "payer", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getPayerStreamIds", inputs: [{ name: "payer", type: "address" }], outputs: [{ name: "", type: "bytes32[]" }], stateMutability: "view" },
  { type: "function", name: "getStream", inputs: [{ name: "streamId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "payer", type: "address" }, { name: "payee", type: "address" }, { name: "token", type: "address" }, { name: "amountPerSec", type: "uint216" }, { name: "lastPaid", type: "uint40" }, { name: "startTime", type: "uint40" }] }], stateMutability: "view" },
  { type: "function", name: "balances", inputs: [{ name: "", type: "address" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalPaidPerSec", inputs: [{ name: "", type: "address" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
];

const dec = Number(TOKEN_DECIMALS);
const fmt = (v) => formatUnits(v, dec);
const now = Math.floor(Date.now() / 1000);

console.log(`\nChecking ${keys.length} wallets for active streams\n`);

let totalActiveStreams = 0;

for (let i = 0; i < keys.length; i++) {
  const addr = privateKeyToAccount(keys[i]).address;
  const label = i < oldKeys.length ? "OLD" : "NEW";

  const [streamCount, vaultBal, totalPerSec] = await Promise.all([
    client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "getPayerStreamCount", args: [addr] }),
    client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "balances", args: [addr, TOKEN_ADDRESS] }),
    client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "totalPaidPerSec", args: [addr, TOKEN_ADDRESS] }),
  ]);

  if (streamCount > 0n || totalPerSec > 0n) {
    totalActiveStreams += Number(streamCount);
    // Estimate debt: how much is owed but not yet paid?
    // Get stream details to calculate
    const streamIds = await client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "getPayerStreamIds", args: [addr] });
    let totalDebt = 0n;
    for (const id of streamIds) {
      const s = await client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "getStream", args: [id] });
      const elapsed = BigInt(now - Number(s.lastPaid));
      const owed = elapsed * s.amountPerSec;
      totalDebt += owed;
    }
    const canCover = vaultBal >= totalDebt;
    console.log(`[${label}] #${i+1} ${addr}`);
    console.log(`  streams=${streamCount} vaultBal=${fmt(vaultBal)} perSec=${totalPerSec} debtOwed=${fmt(totalDebt)} canCover=${canCover}`);
    if (!canCover) {
      console.log(`  *** UNDERFUNDED: vault=${fmt(vaultBal)} < debt=${fmt(totalDebt)} ***`);
    }
  }
}

if (totalActiveStreams === 0) {
  console.log("No active streams found on any wallet.");
}
console.log(`\nDone. Total active streams: ${totalActiveStreams}`);
