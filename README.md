# StakeFlow - Payroll Streaming with Yield on Celo

> **"Your salary earns yield before it even reaches your wallet."**

StakeFlow is a decentralized payroll streaming platform built as a **MiniApp for MiniPay** on the **Celo** blockchain. Inspired by [LlamaPay](https://llamapay.io/), StakeFlow takes payroll streaming to the next level by **staking idle payroll funds in Aave V3** — so employees don't just receive their salary, they also earn yield on top of it.

---

## Problem Statement

Traditional crypto payroll solutions (like LlamaPay) stream salary in real-time, which is great. But the deposited funds just **sit idle** in the smart contract, earning nothing. This is a missed opportunity:

- **Employers** lock up large sums of capital that generate zero returns
- **Employees** only receive their base salary with no additional benefit
- **Billions of dollars** in payroll reserves across DeFi sit unproductive

Meanwhile, lending protocols like Aave on Celo offer **0.5% - 2.6% APY** on stablecoins. Why not put that idle capital to work?

## Solution

**StakeFlow** solves this by integrating payroll streaming with DeFi yield:

1. Employer deposits stablecoins into StakeFlow
2. Funds are **automatically supplied to Aave V3 on Celo**, earning yield
3. Salary streams to employees in **real-time (per-second)**
4. When employees withdraw, they receive **salary + proportional staking yield**

This creates a win-win: employees earn more, and the protocol drives real onchain activity on Celo.

---

## Key Differentiator vs LlamaPay

| Feature | LlamaPay | StakeFlow |
|---------|----------|-----------|
| Real-time salary streaming | Yes | Yes |
| Deployed on Celo | **No** | **Yes** |
| MiniPay integration | **No** | **Yes** |
| Yield on idle deposits | **No** (funds sit idle) | **Yes** (Aave V3 staking) |
| Employees earn extra yield | **No** | **Yes** |
| Mobile-first (MiniPay) | **No** (web only) | **Yes** |
| Stablecoin support (cUSD, USDC, USDT) | Limited chains | **Native Celo stablecoins** |

**LlamaPay is not deployed on Celo** — this is a clear gap in the market. StakeFlow fills this gap while adding yield generation as a unique value proposition.

---

## How It Works

### Architecture Flow

```
┌─────────────┐     Deposit Stablecoins     ┌──────────────────┐
│  Employer    │ ──────────────────────────> │  StakeFlow       │
│  (Payer)     │                             │  Smart Contract  │
└─────────────┘                             └────────┬─────────┘
                                                      │
                                          Auto-supply  │
                                          to Aave V3   │
                                                      ▼
                                            ┌──────────────────┐
                                            │  Aave V3 (Celo)  │
                                            │  Lending Pool     │
                                            │                   │
                                            │  Deposits earn    │
                                            │  yield (APY)      │
                                            └────────┬─────────┘
                                                      │
                                   aTokens (interest   │
                                   bearing tokens)     │
                                                      ▼
┌─────────────┐    Salary + Yield           ┌──────────────────┐
│  Employee    │ <──────────────────────────│  StakeFlow       │
│  (Payee)     │   withdraw anytime         │  Vault           │
└─────────────┘                             └──────────────────┘
```

### Detailed Flow

#### Employer (Payer) Flow:
1. **Connect MiniPay wallet** to StakeFlow MiniApp
2. **Create payroll stream** — set employee address, token (USDC/cUSD/USDT), monthly salary amount
3. **Deposit stablecoins** — funds are automatically supplied to Aave V3 on Celo
4. **Monitor dashboard** — view all active streams, total deposited, yield earned, remaining balance
5. **Top up balance** when needed — new deposits also auto-stake to Aave

#### Employee (Payee) Flow:
1. **Connect MiniPay wallet** to StakeFlow MiniApp
2. **View incoming streams** — see salary accruing in real-time (per-second)
3. **Withdraw anytime** — claim accrued salary + proportional Aave yield
4. **Track yield earned** — see how much extra you've earned from staking

#### Behind the Scenes:
1. When employer deposits 10,000 USDC, StakeFlow calls `Aave Pool.supply()` → receives ~10,000 aUSDC
2. aUSDC balance grows over time (e.g., 1.92% APY for USDC on Aave Celo)
3. When employee withdraws 1,000 USDC salary, StakeFlow calls `Aave Pool.withdraw()` → redeems aUSDC back to USDC
4. Employee receives 1,000 USDC (salary) + earned yield portion
5. Yield is distributed proportionally based on stream duration and amount

---

## Smart Contract Architecture

```
┌────────────────────────┐
│  StakeFlowFactory      │  ← Creates StakeFlow instances per employer
│  (CREATE2)             │
└───────────┬────────────┘
            │ deploy
            ▼
┌────────────────────────┐       ┌────────────────────┐
│  StakeFlowVault        │ ────> │  Aave V3 Pool      │
│                        │       │  (Celo Mainnet)    │
│  - createStream()      │       │                    │
│  - deposit()           │       │  Pool:             │
│  - withdraw()          │       │  0x3E59A31363...   │
│  - cancelStream()      │       └────────────────────┘
│  - getBalance()        │
│  - getYieldEarned()    │
│  - streams mapping     │
│  - balances mapping    │
└────────────────────────┘
```

### Core Smart Contract Functions

```solidity
// Employer functions
deposit(address token, uint256 amount)
    → Approves & supplies to Aave V3, updates internal balance

createStream(address payee, address token, uint216 amountPerSec)
    → Creates real-time salary stream to employee

cancelStream(address payee, address token, uint216 amountPerSec)
    → Stops stream, settles pending amounts

// Employee functions
withdraw(address payer, address token, uint216 amountPerSec)
    → Claims accrued salary + yield from Aave

// View functions
getBalance(address payer) → (int256)
    → Returns payer's remaining balance (including yield)

getStreamInfo(bytes32 streamId) → (Stream)
    → Returns stream details

getYieldEarned(bytes32 streamId) → (uint256)
    → Returns yield earned for a specific stream
```

### Supported Tokens on Celo (Aave V3)

| Token | Aave Supply APY | aToken Address |
|-------|----------------|----------------|
| **USDC** | ~1.92% | `0xFF8309b9e99bfd2D4021bc71a362aBD93dBd4785` |
| **USDT** | ~0.50% | `0xDeE98402A302e4D707fB9bf2bac66fAEEc31e8Df` |
| **cUSD (USDm)** | ~1.07% | `0xBba98352628B0B0c4b40583F593fFCb630935a45` |
| **CELO** | ~0.57% | `0xC3e77dC389537Db1EEc7C33B95Cf3beECA71A209` |

> Note: APY rates are variable and change based on market utilization.

### Key Contract Addresses (Celo Mainnet)

| Contract | Address |
|----------|---------|
| Aave V3 Pool | `0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402` |
| Aave PoolAddressesProvider | `0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5` |
| USDC (Celo) | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| USDT (Celo) | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| cUSD / USDm (Celo) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Celo Mainnet |
| **Smart Contracts** | Solidity ^0.8.0, Hardhat |
| **DeFi Integration** | Aave V3 (Celo) |
| **Frontend** | Next.js / React |
| **Wallet** | MiniPay SDK (MiniPay Hook) |
| **Deployment** | Vercel |
| **Starter Kit** | [celo-composer](https://github.com/celo-org/celo-composer) |
| **Stablecoins** | USDC, USDT, cUSD (USDm) |

---

## Features

### MVP (Proof of Ship - April 2026)

- [ ] MiniPay wallet integration (MiniPay Hook)
- [ ] Employer dashboard — create & manage payroll streams
- [ ] Employee dashboard — view salary streams & withdraw
- [ ] Real-time salary streaming (per-second)
- [ ] Auto-staking deposits to Aave V3 on Celo
- [ ] Yield distribution to employees on withdrawal
- [ ] Multi-token support (USDC, USDT, cUSD)
- [ ] Stream management (create, pause, cancel)
- [ ] Deploy on Celo Mainnet

### Future Roadmap

- [ ] Batch payroll — CSV import for multiple employees
- [ ] Yield analytics dashboard for employer & employee
- [ ] Notification system (low balance alerts, payment received)
- [ ] Multi-sig / Gnosis Safe support for enterprise
- [ ] Fiat on/off ramp integration
- [ ] Employee NFT payslips (onchain proof of payment)

---

## User Interface (MiniApp Screens)

### 1. Home / Connect Wallet
- Connect via MiniPay
- Choose role: Employer or Employee

### 2. Employer Dashboard
- Total deposited & yield earned
- Active streams list with real-time status
- Create new stream button
- Top up balance button

### 3. Create Stream
- Employee wallet address input
- Select token (USDC / cUSD / USDT)
- Monthly salary amount
- Review & confirm → deposit + create stream

### 4. Employee Dashboard
- Incoming streams with real-time accrual counter
- Base salary earned
- Yield earned (from Aave staking)
- Withdraw button

### 5. Withdraw
- Shows total claimable (salary + yield breakdown)
- One-tap withdraw to MiniPay wallet

---

## Example Scenario

> **Company ABC** pays 5 employees $1,000/month each in USDC on Celo.

| Step | Action | Detail |
|------|--------|--------|
| 1 | Company deposits | **5,000 USDC** into StakeFlow |
| 2 | Auto-stake to Aave | 5,000 USDC → Aave V3 → earns **~1.92% APY** |
| 3 | Streaming | Each employee receives ~$0.00038/second |
| 4 | After 1 month | Each employee withdraws **$1,000 USDC** (salary) |
| 5 | + Yield | Plus **~$1.60 USDC** in Aave yield |
| **Total** | | **$1,001.60 per employee** |

- Over a year: extra **~$19.20/employee** from yield
- For larger payrolls ($100K/month): yield becomes **~$160/month**
- Yield scales with deposit size — the more capital, the more everyone earns

---

## Why Celo?

| Advantage | Detail |
|-----------|--------|
| **Sub-cent fees** | Ideal for frequent micro-withdrawals in streaming |
| **MiniPay** | 14M+ users, built-in distribution channel |
| **Mobile-first** | Designed for emerging markets where mobile payroll matters |
| **Aave V3** | Proven DeFi infrastructure for yield, live on Celo |
| **Native stablecoins** | cUSD, USDC, USDT all available |
| **Fast finality** | ~5-second block times for real-time streaming UX |
| **EVM compatible** | Leverage existing Solidity ecosystem |

---

## Getting Started (Development)

```bash
# Clone the repo
git clone https://github.com/<your-username>/stakeflow.git
cd stakeflow

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your private key (NEVER use your main wallet for dev!)
# Add Celo RPC URL
# Add Aave V3 contract addresses

# Compile smart contracts
npx hardhat compile

# Deploy to Celo testnet (Alfajores)
npx hardhat deploy --network alfajores

# Run frontend
cd frontend
npm run dev
```

### Testnet Tokens
- **Celo Sepolia (CELO)**: https://faucet.celo.org/celo-sepolia
- **USDC & EURC testnet**: https://faucet.circle.com/

---

## Team

- **Ezra Kristanto Nahumury** — Full Stack Developer

---

## Links

| Resource | URL |
|----------|-----|
| Proof of Ship | [talent.app/~/earn/celo-proof-of-ship](https://talent.app/~/earn/celo-proof-of-ship) |
| Celo Docs | [docs.celo.org](https://docs.celo.org/) |
| Aave V3 Celo | [app.aave.com](https://app.aave.com/?marketName=proto_celo_v3) |
| MiniPay Docs | [docs.celo.org/build-on-minipay](https://docs.celo.org/developer/build-on-minipay/overview) |
| LlamaPay (Reference) | [llamapay.io](https://llamapay.io/) |
| Telegram | [t.me/proofofship](https://t.me/proofofship) |

---

## License

MIT — Open Source as required by Proof of Ship eligibility.
