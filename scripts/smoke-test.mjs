// Read-only smoke test for the spam script's RPC + contract wiring.
// Runs WITHOUT a private key — just confirms the chain, RPCs, and ABIs work.
import "dotenv/config";
import { createPublicClient, http, fallback, defineChain, isAddress } from "viem";

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
  testnet: true,
});

const VAULT_ADDRESS =
  process.env.VAULT_ADDRESS ?? "0x42cADdd47E795A6e04d820A6c140AF04159C7542";
const TOKEN_ADDRESS =
  process.env.TOKEN_ADDRESS ?? "0x01C5C0122039549AD1493B8220cABEdD739BC44E";

if (!isAddress(VAULT_ADDRESS) || !isAddress(TOKEN_ADDRESS)) {
  console.error("✗ bad address in env");
  process.exit(1);
}

const client = createPublicClient({
  chain: celoSepolia,
  transport: fallback(
    celoSepolia.rpcUrls.default.http.map((u) => http(u)),
    { retryCount: 2, retryDelay: 300 },
  ),
});

const ERC20 = [
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
];

const VAULT = [
  {
    type: "function",
    name: "balances",
    inputs: [
      { type: "address" },
      { type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
];

async function main() {
  const checks = [];
  const check = (name, fn) =>
    fn()
      .then((v) => {
        checks.push({ name, ok: true, value: v });
        console.log(`  ✓ ${name}: ${v}`);
      })
      .catch((e) => {
        checks.push({ name, ok: false, err: e.shortMessage ?? e.message });
        console.log(`  ✗ ${name}: ${e.shortMessage ?? e.message}`);
      });

  console.log("chain & rpc:");
  await check("chain id", async () => await client.getChainId());
  await check("block number", async () => await client.getBlockNumber());

  console.log("token @", TOKEN_ADDRESS);
  await check("token symbol", async () =>
    client.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20,
      functionName: "symbol",
    }),
  );
  await check("token decimals", async () =>
    client.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20,
      functionName: "decimals",
    }),
  );

  console.log("vault @", VAULT_ADDRESS);
  await check("vault code present", async () => {
    const code = await client.getBytecode({ address: VAULT_ADDRESS });
    if (!code || code === "0x") throw new Error("no bytecode at address");
    return `${code.length} bytes`;
  });

  const allOk = checks.every((c) => c.ok);
  console.log(
    allOk
      ? "\nsmoke test: ALL PASS"
      : `\nsmoke test: ${checks.filter((c) => !c.ok).length} failed`,
  );
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
