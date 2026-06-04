# trickle-sdk

TypeScript SDK for **[Trickle](https://trickle-black.vercel.app)** — real-time
payroll streaming on **Celo**. Employers deposit stablecoins (cUSD / USDC / USDT)
into the on-chain **TrickleVault** and open **per-second salary streams**;
employees withdraw accrued earnings anytime. MiniPay-native.

This package ships the Celo Mainnet **addresses**, fully-typed **ABIs**
(`TrickleVault`, `StreamRegistry`, ERC-20), and dependency-free **helpers** for
stream math — so you can build on Trickle with [viem](https://viem.sh) or
[wagmi](https://wagmi.sh) in a few lines.

## Install

```bash
npm install trickle-sdk viem
```

`viem` is a peer — bring your own (works with wagmi too).

## What's inside

| Export | Purpose |
|---|---|
| `TRICKLE_VAULT_ADDRESS`, `STREAM_REGISTRY_ADDRESS` | Celo Mainnet contracts |
| `TOKENS`, `CELO_CHAIN_ID`, `celoscan()` | tokens, chain id, explorer links |
| `TRICKLE_VAULT_ABI`, `STREAM_REGISTRY_ABI`, `ERC20_ABI` | `as const` ABIs |
| `ratePerSecToMonthly`, `monthlyToRatePerSec` | quote salaries per month ↔ per second |
| `accrued`, `runwayDays` | live earnings + vault runway |
| `formatAmount`, `parseAmount`, `shortenAddress`, `isAddress` | formatting utils |

## Read a payee's live earnings

```ts
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import {
  TRICKLE_VAULT_ADDRESS,
  TRICKLE_VAULT_ABI,
  formatAmount,
  ratePerSecToMonthly,
} from "trickle-sdk";

const client = createPublicClient({ chain: celo, transport: http() });

const streamIds = await client.readContract({
  address: TRICKLE_VAULT_ADDRESS,
  abi: TRICKLE_VAULT_ABI,
  functionName: "getPayeeStreamIds",
  args: ["0xPayee..."],
});

const stream = await client.readContract({
  address: TRICKLE_VAULT_ADDRESS,
  abi: TRICKLE_VAULT_ABI,
  functionName: "getStream",
  args: [streamIds[0]],
});

const monthly = ratePerSecToMonthly(stream.amountPerSec);
console.log(`${formatAmount(monthly, 18)} cUSD / month`);
```

## Read an on-chain payslip attestation

```ts
import {
  STREAM_REGISTRY_ADDRESS,
  STREAM_REGISTRY_ABI,
} from "trickle-sdk";

const employer = await client.readContract({
  address: STREAM_REGISTRY_ADDRESS,
  abi: STREAM_REGISTRY_ABI,
  functionName: "getEmployerName",
  args: ["0xPayer..."],
});
// → "Celo Labs" when the employer has stamped it on-chain
```

## Contracts (Celo Mainnet · 42220)

| Contract | Address |
|---|---|
| TrickleVault | [`0x8a3e…dc05`](https://celoscan.io/address/0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05) |
| StreamRegistry | [`0x84D0…8d99`](https://celoscan.io/address/0x84D03930631b37Ae71A1b3c6C333ADcD32B88d99) |

## License

MIT
