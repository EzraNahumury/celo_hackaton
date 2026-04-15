# TrickleVault – Real-time Payroll Streaming on Celo

TrickleVault is a non-custodial payroll streaming protocol. Employers deposit stablecoins (e.g. USDC) and open per-second salary streams to employees. Employees can withdraw their accrued earnings at any time.

Built with [Foundry](https://book.getfoundry.sh/) and deployed on the **Celo** blockchain (EVM-compatible Layer 2 on Ethereum using the OP Stack).

---

## Deployed Contract

| | |
|---|---|
| **Network** | Celo Sepolia Testnet (chain 11142220) |
| **Contract** | `0x42cADdd47E795A6e04d820A6c140AF04159C7542` |
| **Deployer** | `0x5682c0FF0ba3E6B0d78755c4684aEc5EA05c2a6F` |
| **Block** | 22951573 |
| **Tx Hash** | `0xe98773f4205e37a239451fd117e5b518b2b43508dff64e621cb17c1330f413ff` |
| **Gas paid** | 0.059034 CELO (1,180,698 gas @ 50 gwei) |
| **Status** | Verified on Celoscan |
| **Explorer** | https://sepolia.celoscan.io/address/0x42caddd47e795a6e04d820a6c140af04159c7542 |

**Primary token (USDC on Celo Sepolia):** `0x01C5C0122039549AD1493B8220cABEdD739BC44E`

---

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
4. [Compile](#compile)
5. [Run Tests](#run-tests)
6. [Deploy to Celo Sepolia Testnet](#deploy-to-celo-sepolia-testnet)
7. [Verify on Celoscan](#verify-on-celoscan)
8. [Interacting with the Contract](#interacting-with-the-contract)
9. [Contract Reference](#contract-reference)
10. [Network Reference](#network-reference)

---

## Architecture

```
TrickleVault
├── deposit(token, amount)               – employer deposits stablecoins
├── withdrawBalance(token, amount)       – employer reclaims unstreamed balance
├── createStream(payee, token, rate)     – open a per-second stream
├── cancelStream(payee, token, rate)     – close a stream (settles pending pay)
└── withdraw(payer, token, rate)         – employee claims accrued earnings
```

Stream accounting is fully on-chain with no oracle dependency. The `amountPerSec` field uses the token's native decimals (18 for USDC on Celo).

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| [Foundry](https://book.getfoundry.sh/getting-started/installation) | latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Git | any | system package manager |
| A wallet with Celo Sepolia CELO | — | [Celo Faucet](https://faucet.celo.org) |

> **Windows users**: run all commands in Git Bash or WSL2, not PowerShell.

---

## Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd sc_trickle

# 2. Install Foundry submodule dependencies (forge-std)
forge install

# 3. Copy the environment file
cp .env.example .env
```

Edit `.env` with your values:

```dotenv
# Your deployer wallet private key
PRIVATE_KEY=0xabc123...

# Celoscan API key for contract verification
# Get one free at https://celoscan.io/myapikey
CELOSCAN_API_KEY=ABC123...
```

> **Security**: `.env` is already in `.gitignore`. Never commit it.

---

## Compile

```bash
forge build
```

Expected output:
```
[⠒] Compiling...
[⠃] Compiling 1 files with 0.8.20
Compiler run successful!
```

---

## Run Tests

Tests run against a local Anvil fork — no testnet tokens or internet connection needed.

```bash
# Run all tests
forge test

# Run with verbose output (show logs, traces)
forge test -vvvv

# Run a single test
forge test --match-test test_withdraw_fullFunded -vvvv

# Gas report
forge test --gas-report
```

### Test Coverage

| Test | What it validates |
|------|------------------|
| `test_deposit` | Tokens transferred, balance recorded |
| `test_deposit_revert_zero` | Zero-amount guard |
| `test_createStream` | Stream struct stored correctly |
| `test_createStream_revert_duplicate` | Duplicate stream rejected |
| `test_createStream_revert_self` | Self-stream rejected |
| `test_withdraw_fullFunded` | Correct accrual over 30 days |
| `test_withdraw_partialFunded` | Partial payout when vault runs low |
| `test_withdraw_multipleWithdrawals` | Incremental withdrawals over time |
| `test_cancelStream_settlesPending` | Pending pay settled on cancel |
| `test_withdrawBalance` | Employer can reclaim deposits |
| `test_multipleStreams` | Multiple concurrent streams |

---

## Deploy to Celo Sepolia Testnet

> **Note**: Celo Alfajores was sunset at the end of 2025. **Celo Sepolia** (chain **11142220**) is now the active testnet.

### 1. Fund your deployer wallet

Get test CELO from the [Celo Faucet](https://faucet.celo.org) for your deployer address.

A typical deployment costs around **0.06 CELO** in gas.

### 2. Dry-run first (no broadcast)

Simulate the deployment without spending any gas:

```bash
forge script script/Deploy.s.sol \
  --rpc-url celo-sepolia \
  -vvvv
```

### 3. Deploy and verify in one step

```bash
forge script script/Deploy.s.sol \
  --rpc-url celo-sepolia \
  --broadcast \
  --verify \
  -vvvv
```

Or using the Makefile shortcut:

```bash
make deploy
```

**What happens:**
1. Foundry reads `PRIVATE_KEY` and `CELOSCAN_API_KEY` from `.env`
2. `TrickleVault` is deployed to Celo Sepolia
3. The deployed address is saved to `deployments/11142220.json`
4. Foundry submits the source code to Celoscan for verification automatically

**Actual deployment output (for reference):**
```
===========================================
  TrickleVault Deployment
===========================================
Deployer  : 0x5682c0FF0ba3E6B0d78755c4684aEc5EA05c2a6F
Chain ID  : 11142220
Block     : 22951548
-------------------------------------------
TrickleVault deployed at: 0x42cADdd47E795A6e04d820A6c140AF04159C7542
===========================================
Deployment saved to: deployments/11142220.json

✅ Hash: 0xe98773f4205e37a239451fd117e5b518b2b43508dff64e621cb17c1330f413ff
Paid: 0.059034900001180698 CELO (1180698 gas * 50 gwei)

Pass - Verified
Contract successfully verified
```

The broadcast receipt is also saved to:
```
broadcast/Deploy.s.sol/11142220/run-latest.json
```

---

## Verify on Celoscan

### Automatic (recommended)

Verification is already included in the `--verify` flag above. If it succeeded you'll see:

```
Pass - Verified
Contract successfully verified
```

### Manual (if automatic verification failed)

```bash
forge verify-contract \
  <DEPLOYED_ADDRESS> \
  src/TrickleVault.sol:TrickleVault \
  --chain celo-sepolia \
  --watch
```

Or via the Makefile (reads address from `deployments/11142220.json`):

```bash
make verify
```

### View on Celoscan

Once verified, open:

```
https://sepolia.celoscan.io/address/<DEPLOYED_ADDRESS>
```

From the **Contract** tab you can:
- Read state variables directly
- Call write functions (connect MetaMask with Celo Sepolia network)
- See all events and transaction history

---

## Interacting with the Contract

Use **Cast** (Foundry's CLI) for quick on-chain interactions.

```bash
# Set convenience variables
export RPC=https://rpc.ankr.com/celo_sepolia
export VAULT=0x42cADdd47E795A6e04d820A6c140AF04159C7542

# USDC on Celo Sepolia
export TOKEN=0x01C5C0122039549AD1493B8220cABEdD739BC44E

# Check your USDC balance
cast call $TOKEN "balanceOf(address)(uint256)" $YOUR_ADDRESS --rpc-url $RPC

# Approve TrickleVault to spend USDC
cast send $TOKEN "approve(address,uint256)" $VAULT 100000000000000000000 \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# Deposit 100 USDC into the vault
cast send $VAULT "deposit(address,uint256)" $TOKEN 100000000000000000000 \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# Create a stream: ~$1000/month to employee
# amountPerSec = 1000e18 / 2592000 ≈ 385802469135802 (wei/sec)
cast send $VAULT "createStream(address,address,uint216)" \
  $EMPLOYEE_ADDRESS $TOKEN 385802469135802 \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# Check withdrawable amount (as employee)
cast call $VAULT \
  "withdrawable(address,address,address,uint216)(uint256)" \
  $EMPLOYER_ADDRESS $EMPLOYEE_ADDRESS $TOKEN 385802469135802 \
  --rpc-url $RPC

# Withdraw as employee
cast send $VAULT "withdraw(address,address,uint216)" \
  $EMPLOYER_ADDRESS $TOKEN 385802469135802 \
  --rpc-url $RPC --private-key $EMPLOYEE_PRIVATE_KEY
```

---

## Contract Reference

### Events

| Event | Emitted when |
|-------|-------------|
| `Deposit(payer, token, amount)` | Employer deposits tokens |
| `BalanceWithdrawn(payer, token, amount)` | Employer reclaims balance |
| `StreamCreated(streamId, payer, payee, token, amountPerSec)` | New stream opened |
| `StreamCancelled(streamId, payer, payee, token)` | Stream closed |
| `Withdrawn(streamId, payee, payer, amount)` | Employee claims earnings |

### Key Calculations

**`amountPerSec` for a monthly salary:**

```
amountPerSec = monthlySalary_in_wei / 2_592_000
```

Example: $1 000/month in USDC (18 decimals):
```
amountPerSec = 1000 * 10^18 / 2592000 ≈ 385_802_469_135_802
```

**Accrued earnings at any point:**
```
owed = amountPerSec * (block.timestamp - lastPaid)
payout = min(owed, balances[payer][token])
```

---

## Network Reference

| Network | Chain ID | RPC (primary) | Explorer | Status |
|---------|----------|---------------|----------|--------|
| Celo Mainnet | 42220 | `https://forno.celo.org` | [celoscan.io](https://celoscan.io) | Live |
| Celo Sepolia | **11142220** | `https://rpc.ankr.com/celo_sepolia` | [sepolia.celoscan.io](https://sepolia.celoscan.io) | **Active testnet** |
| ~~Celo Alfajores~~ | ~~44787~~ | — | — | Sunset end of 2025 |

**RPC options for Celo Sepolia (all pointing to chain 11142220):**

| Provider | URL | Latency | Notes |
|----------|-----|---------|-------|
| Ankr | `https://rpc.ankr.com/celo_sepolia` | 0.342s | Best reliability |
| dRPC | `https://celo-sepolia.drpc.org` | 0.387s | Good fallback |
| Official Celo | `https://forno.celo-sepolia.celo-testnet.org` | 0.821s | Slower |

**Token addresses on Celo Sepolia (chain 11142220):**

| Token | Symbol | Address |
|-------|--------|---------|
| USD Coin | **USDC** | `0x01C5C0122039549AD1493B8220cABEdD739BC44E` |
| Mento Dollar | USDm | `0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80` |
| Mento Euro | EURm | `0x6B172e333e2978484261D7eCC3DE491E79764BbC` |
| Mento Kenyan Shilling | KESm | `0xC7e4635651E3e3Af82b61d3E23c159438daE3BbF` |
| Tether USD | USDT | `0xd077A400968890Eacc75cdc901F0356c943e4fDb` |
| Wrapped Ether | WETH | `0x2cE73DC897A3E10b3FF3F86470847c36ddB735cf` |

---

## Makefile Quick Reference

```bash
make install       # forge install
make build         # forge build
make test          # forge test
make test-verbose  # forge test -vvvv
make snapshot      # forge snapshot (gas)
make deploy-dry    # simulate deployment (no broadcast)
make deploy        # deploy + verify to celo-sepolia
make verify        # verify already-deployed contract
make clean         # forge clean
make help          # list all targets
```
