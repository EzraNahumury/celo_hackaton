# Trickle onchain spam

Background cron that keeps the Trickle leaderboard busy by running tiny
`deposit` → `withdrawBalance` cycles from a hot wallet on Celo Sepolia.
Each cycle submits 2 onchain txs.

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
