# Trickle onchain spam

Background cron that keeps the Trickle leaderboard busy by running tiny
`deposit` → `withdrawBalance` cycles from a hot wallet. Defaults to **Celo
Mainnet**; set `CHAIN=sepolia` in `.env` to target Sepolia instead. Each
cycle submits 2 onchain txs.

## Setup

```bash
cd scripts
npm install
cp .env.example .env
# edit .env: paste PRIVATE_KEY, confirm VAULT_ADDRESS + TOKEN_ADDRESS
```

The hot wallet needs:
- Some CELO for gas (Celo Sepolia faucet) — script refuses to start below 0.005 CELO
- A balance of the spam token (tUSDC mint, or a transfer of USDC/USDm)

## Run

```bash
npm run spam
```

Flow on startup:
1. Validates env (private key format, address format).
2. Preflight: reads gas + token balance, aborts with a human error if too low.
3. Approves max allowance once (skipped if already approved).
4. Loops `deposit → wait → withdrawBalance → wait → sleep INTERVAL_SECONDS`.

`Ctrl+C` prints a summary of cycles ok / failed / txs submitted.

## Tune

| env | meaning | default |
| --- | --- | --- |
| `INTERVAL_SECONDS` | gap between bursts (min 5s) | `45` |
| `AMOUNT` | token per cycle (human units) | `0.01` |
| `TOKEN_DECIMALS` | 6 for tUSDC/USDC, 18 for USDm | `6` |

Lower `INTERVAL_SECONDS` = more leaderboard pressure, more gas burn. 30–60s
is the sweet spot on Sepolia.

## Reliability

- RPC uses viem `fallback` across forno / drpc / ankr — one endpoint down
  won't kill the loop.
- Self-scheduling loop (not `setInterval`) so a slow cycle can't overlap
  the next one.
- Per-cycle errors are logged and counted but don't stop the process; only
  startup misconfig or fatal signals exit.

---

## Seeding StreamRegistry attestations

`seed-attestations.mjs` writes on-chain payslip metadata to the
[StreamRegistry](https://celoscan.io/address/0x84D03930631b37Ae71A1b3c6C333ADcD32B88d99)
contract so the app can show a **✓ verified** employer + role on payslips.

Each loaded wallet acts as an **employer**: it calls `setEmployerName(company)`
and `setEmployment(payee, name, role, memo)` for the next wallet in the list.
Both are real txs on the Karma-tracked StreamRegistry. The contract is
`msg.sender`-keyed, so each wallet signs its own attestations — they only need
a little CELO for gas (the funded spam wallets already have it).

```bash
# preview without sending (read-only)
WALLETS_FILE=new-wallets-4.json DRY_RUN=1 npm run seed-attestations

# seed a random 20-wallet slice
WALLETS_FILE=new-wallets-4.json SAMPLE_SIZE=20 npm run seed-attestations

# seed everything
WALLETS_FILE=new-wallets-4.json npm run seed-attestations
```

The run is **idempotent** — it reads `getEmployerName` / `getEmployment` first
and skips anything already set, so re-runs only fill gaps. It prints a demo
`employer → payee` pair at the end: connect as that payee in the app to see the
verified employer on the payslip.

| env | meaning | default |
| --- | --- | --- |
| `WALLETS_FILE` / `WALLETS` / `NEW_WALLETS` | wallet key source (same as multi-spam) | `wallets.json` |
| `STREAM_REGISTRY_ADDRESS` | registry contract | mainnet StreamRegistry |
| `SAMPLE_SIZE` | seed only N random wallets (0 = all) | `0` |
| `EMPLOYER_ONLY` | set employer names only, skip per-payee employment | `0` |
| `CONCURRENCY` | parallel wallets | `8` |
| `DRY_RUN` | print intended calls, send nothing | `0` |

## Real cUSD volume (employer → employee streams)

`stream-spam.mjs` generates **genuine on-chain stablecoin volume**. The
`multi-spam` loop deposits and withdraws from the *same* wallet, so the net flow
is ~0 and the leaderboard's stablecoin-volume metric stays at zero. This script
pairs wallets and runs the real payroll path so cUSD actually moves
wallet-to-wallet:

```
payer.deposit(token, D)
payer.createStream(payee, token, ratePerSec)
…dwell…
payee.withdraw(payer, token, ratePerSec)   ← cUSD lands in the payee WALLET
payer.cancelStream(...)
```

```bash
# dry run — preflight + plan, no transactions
WALLETS_FILE=new-wallets-4.json DRY_RUN=1 npm run stream-spam
# small live test — one pair
WALLETS_FILE=new-wallets-4.json SAMPLE_PAIRS=1 npm run stream-spam
# full pool
WALLETS_FILE=new-wallets-4.json npm run stream-spam
# read-only audit: active streams + pending withdrawable
WALLETS_FILE=new-wallets-4.json npm run verify-streams
```

It is **defensive** for the immutable mainnet vault: skips `createStream` when
the stream already exists, skips `withdraw` when nothing accrued, and tolerates
a `cancel` revert. The per-role **gas floor scales to the live gasPrice** — when
Celo congests (gasPrice spikes to 100-200 gwei) gas-poor pairs are skipped at
preflight instead of reverting mid-cycle. Run it when gasPrice is calm
(~5-25 gwei) for cheap full-pool volume.

Per-cycle volume is capped by each wallet's cUSD balance (~0.002), so this gets
the metric **off zero** and grows it steadily; a large jump needs the wallets
funded with more cUSD first (then raise `STREAM_DEPOSIT`).

| env | meaning | default |
| --- | --- | --- |
| `WALLETS_FILE` / `WALLETS` / `NEW_WALLETS` | wallet key source | `wallets.json` |
| `VAULT_ADDRESS` / `TOKEN_ADDRESS` | vault + stablecoin | — (required) |
| `STREAM_DEPOSIT` | payer deposit per cycle (token units) | `0.0006` |
| `STREAM_RATE_PER_SEC` | salary accrual per second | `0.0001` |
| `STREAM_DWELL_SEC` | seconds to accrue before withdraw | `6` |
| `SAMPLE_PAIRS` | run only N random pairs (0 = all) | `0` |
| `MIN_GAS_CELO` | static gas floor (live-gasPrice floor also applies) | `0.03` |
| `CONCURRENCY` | parallel pairs | `8` |
| `DRY_RUN` | print plan, send nothing | `0` |
