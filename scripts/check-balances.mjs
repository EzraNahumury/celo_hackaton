/**
 * Diagnostic: print USDC balance, vault balance, and allowance for each wallet.
 * Usage: WALLETS=... NEW_WALLETS=... TOKEN_ADDRESS=... VAULT_ADDRESS=... node check-balances.mjs
 */
import "dotenv/config";
import { createPublicClient, http, parseUnits, formatUnits, defineChain, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
});

const { WALLETS, NEW_WALLETS, TOKEN_ADDRESS, VAULT_ADDRESS, TOKEN_DECIMALS = "6" } = process.env;
if (!TOKEN_ADDRESS || !VAULT_ADDRESS) { console.error("TOKEN_ADDRESS and VAULT_ADDRESS required"); process.exit(1); }

const AMOUNT = parseUnits("0.001", Number(TOKEN_DECIMALS));

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

const keys = [...loadKeys(WALLETS, "WALLETS"), ...loadKeys(NEW_WALLETS, "NEW_WALLETS")];
if (!keys.length) { console.error("No keys found"); process.exit(1); }

const client = createPublicClient({ chain: celoMainnet, transport: http() });

const ERC20 = [
  { type: "function", name: "balanceOf", inputs: [{ name: "a", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "allowance", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
];
const VAULT = [
  { type: "function", name: "balances", inputs: [{ name: "", type: "address" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
];

const dec = Number(TOKEN_DECIMALS);
const fmt = (v) => formatUnits(v, dec);
const fmtCelo = (v) => formatUnits(v, 18);

console.log(`\nChecking ${keys.length} wallets · token decimals=${dec}\n`);
console.log(`${"#".padEnd(4)} ${"address".padEnd(42)} ${"wallet_usdc".padEnd(14)} ${"vault_usdc".padEnd(14)} ${"allowance".padEnd(14)} status`);
console.log("-".repeat(110));

let okCount = 0, noUsdcCount = 0, noAllowCount = 0;

for (let i = 0; i < keys.length; i++) {
  const addr = privateKeyToAccount(keys[i]).address;
  const [walletBal, vaultBal, allowance, celoGas] = await Promise.all([
    client.readContract({ address: TOKEN_ADDRESS, abi: ERC20, functionName: "balanceOf", args: [addr] }),
    client.readContract({ address: VAULT_ADDRESS, abi: VAULT, functionName: "balances", args: [addr, TOKEN_ADDRESS] }),
    client.readContract({ address: TOKEN_ADDRESS, abi: ERC20, functionName: "allowance", args: [addr, VAULT_ADDRESS] }),
    client.getBalance({ address: addr }),
  ]);

  const hasToken = walletBal >= AMOUNT;
  const hasAllow = allowance >= AMOUNT;
  const hasGas = celoGas >= parseUnits("0.005", 18);
  let status = "OK";
  if (!hasGas) { status = "NO_GAS"; }
  else if (!hasToken) { status = "NO_USDC"; noUsdcCount++; }
  else if (!hasAllow) { status = "NO_ALLOW"; noAllowCount++; }
  else { okCount++; }

  const label = i < (WALLETS ? JSON.parse(WALLETS).length : 0) ? "OLD" : "NEW";
  console.log(`${String(i+1).padEnd(4)} ${addr}  ${fmt(walletBal).padEnd(14)} ${fmt(vaultBal).padEnd(14)} ${allowance > 10n**30n ? "MAX".padEnd(14) : fmt(allowance).padEnd(14)} [${label}] ${status}`);
}

console.log(`\nSummary: ok=${okCount} no_usdc=${noUsdcCount} no_allow=${noAllowCount} total=${keys.length}`);
