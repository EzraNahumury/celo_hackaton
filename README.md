# Trickle - Payroll Streaming on Celo

> **"Get paid every second. Powered by Celo stablecoins."**

Trickle is a decentralized payroll streaming platform built as a **MiniApp for MiniPay** on the **Celo** blockchain. Inspired by [LlamaPay](https://llamapay.io/), Trickle brings real-time salary streaming to Celo's stablecoin ecosystem — enabling employers to pay employees **per-second** using cUSD, USDC, and USDT.

---

## Problem Statement

In emerging markets, payroll is broken:

- **Workers wait weeks or months** to receive their salary, creating cash flow stress
- **No payroll streaming solution exists on Celo** — despite Celo having the best stablecoin infrastructure for mobile payments
- **LlamaPay is not deployed on Celo** — workers in the Celo ecosystem have no access to real-time salary streaming
- **Traditional payroll is batch-based** — monthly or bi-weekly lump sums that don't match how people actually spend money (daily)

Meanwhile, Celo has **14M+ MiniPay users**, sub-cent transaction fees, and native stablecoin support — the perfect infrastructure for payroll streaming, but no one has built it yet.

## Solution

**Trickle** brings real-time payroll streaming to Celo:

1. Employer deposits stablecoins (cUSD, USDC, or USDT) into Trickle
2. Creates a salary stream to each employee with a per-second rate
3. Employees can **withdraw their earned salary at any time** — no more waiting for payday
4. Everything runs through **MiniPay**, the mobile wallet already used by millions

Simple. No complexity. Just streaming salary powered by Celo stablecoins.

---

## Key Differentiator vs LlamaPay

| Feature | LlamaPay | Trickle |
|---------|----------|-----------|
| Real-time salary streaming | Yes | Yes |
| Deployed on Celo | **No** | **Yes** |
| MiniPay integration | **No** | **Yes** |
| Mobile-first (MiniPay) | **No** (web only) | **Yes** |
| Celo native stablecoin support (cUSD) | **No** | **Yes** |
| Stablecoin support (USDC, USDT) | Limited chains | **Native on Celo** |
| Sub-cent withdrawal fees | Chain dependent | **Yes** (Celo) |

**LlamaPay is not deployed on Celo** — this is a clear gap in the market. Trickle fills this gap by bringing payroll streaming to Celo's 14M+ MiniPay users with native stablecoin support.

---

## How It Works

### Architecture Flow

```
┌─────────────┐     Deposit Stablecoins     ┌──────────────────┐
│  Employer    │ ──────────────────────────> │  Trickle       │
│  (Payer)     │                             │  Smart Contract  │
└─────────────┘                             └────────┬─────────┘
                                                      │
                                        Stream salary  │
                                        per-second     │
                                                      ▼
┌─────────────┐    Withdraw anytime         ┌──────────────────┐
│  Employee    │ <─────────────────────────│  Trickle       │
│  (Payee)     │   via MiniPay              │  Streaming Engine│
└─────────────┘                             └──────────────────┘
```

### Detailed Flow

#### Employer (Payer) Flow:
1. **Connect MiniPay wallet** to Trickle MiniApp
2. **Create payroll stream** — set employee address, token (cUSD/USDC/USDT), monthly salary amount
3. **Deposit stablecoins** — funds are held in the Trickle contract
4. **Monitor dashboard** — view all active streams, total deposited, remaining balance
5. **Top up balance** when needed

#### Employee (Payee) Flow:
1. **Connect MiniPay wallet** to Trickle MiniApp
2. **View incoming streams** — see salary accruing in real-time (per-second)
3. **Withdraw anytime** — claim accrued salary instantly to your MiniPay wallet
4. **Track earnings** — see total earned, withdrawal history

#### Behind the Scenes:
1. Employer deposits 10,000 cUSD into Trickle contract
2. Creates a stream to employee at rate of ~0.00038 cUSD/second ($1,000/month)
3. Employee's claimable balance increases every second
4. Employee withdraws 500 cUSD after 2 weeks — transaction costs < $0.01 on Celo
5. Remaining balance continues streaming until the stream ends or is cancelled

---

## Smart Contract Architecture

```
┌────────────────────────┐
│  TrickleFactory      │  ← Creates Trickle instances per employer
│  (CREATE2)             │
└───────────┬────────────┘
            │ deploy
            ▼
┌────────────────────────┐
│  TrickleVault        │
│                        │
│  - createStream()      │
│  - deposit()           │
│  - withdraw()          │
│  - cancelStream()      │
│  - getBalance()        │
│  - streams mapping     │
│  - balances mapping    │
└────────────────────────┘
```

### Core Smart Contract Functions

```solidity
// Employer functions
deposit(address token, uint256 amount)
    → Transfers stablecoins into the contract, updates internal balance

createStream(address payee, address token, uint216 amountPerSec)
    → Creates real-time salary stream to employee

cancelStream(address payee, address token, uint216 amountPerSec)
    → Stops stream, settles pending amounts

// Employee functions
withdraw(address payer, address token, uint216 amountPerSec)
    → Claims accrued salary to wallet

// View functions
getBalance(address payer) → (int256)
    → Returns payer's remaining balance

getStreamInfo(bytes32 streamId) → (Stream)
    → Returns stream details
```

### Supported Stablecoins on Celo

| Token | Description | Address |
|-------|-------------|---------|
| **cUSD** | Celo's native USD stablecoin | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| **USDC** | Circle's USDC on Celo | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| **USDT** | Tether's USDT on Celo | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |

> Celo has first-class stablecoin support — cUSD is a native stablecoin, and USDC/USDT are widely available on the network.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Celo Mainnet |
| **Smart Contracts** | Solidity ^0.8.0, Hardhat |
| **Frontend** | Next.js / React |
| **Wallet** | MiniPay SDK (MiniPay Hook) |
| **Deployment** | Vercel |
| **Starter Kit** | [celo-composer](https://github.com/celo-org/celo-composer) |
| **Stablecoins** | cUSD, USDC, USDT |

---

## Features

### MVP (Proof of Ship - April 2026)

- [ ] MiniPay wallet integration (MiniPay Hook)
- [ ] Employer dashboard — create & manage payroll streams
- [ ] Employee dashboard — view salary streams & withdraw
- [ ] Real-time salary streaming (per-second)
- [ ] Multi-stablecoin support (cUSD, USDC, USDT)
- [ ] Stream management (create, pause, cancel)
- [ ] Instant withdrawals with sub-cent Celo fees
- [ ] Deploy on Celo Mainnet

### Future Roadmap

- [ ] Batch payroll — CSV import for multiple employees
- [ ] Payroll analytics dashboard for employer & employee
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
- Total deposited & remaining balance
- Active streams list with real-time status
- Create new stream button
- Top up balance button

### 3. Create Stream
- Employee wallet address input
- Select stablecoin (cUSD / USDC / USDT)
- Monthly salary amount
- Review & confirm → deposit + create stream

### 4. Employee Dashboard
- Incoming streams with real-time accrual counter
- Total salary earned
- Withdrawal history
- Withdraw button

### 5. Withdraw
- Shows total claimable salary
- One-tap withdraw to MiniPay wallet
- Sub-cent transaction fee on Celo

---

## Example Scenario

> **Company ABC** pays 5 employees $1,000/month each in cUSD on Celo.

| Step | Action | Detail |
|------|--------|--------|
| 1 | Company deposits | **5,000 cUSD** into Trickle |
| 2 | Creates 5 streams | Each at ~$0.00038 cUSD/second |
| 3 | Employee checks balance | Sees salary growing every second in MiniPay |
| 4 | Employee withdraws mid-month | Gets **$500 cUSD** instantly, fee < $0.01 |
| 5 | End of month | Remaining **$500 cUSD** available to withdraw |

- No waiting for payday — withdraw earned salary **anytime**
- Withdrawal costs **less than $0.01** on Celo — perfect for frequent small withdrawals
- Works on **MiniPay** — no desktop needed, fully mobile

---

## Why Celo?

| Advantage | Detail |
|-----------|--------|
| **Stablecoin-first chain** | cUSD is a native stablecoin — Celo was built for stablecoins |
| **Sub-cent fees** | Ideal for frequent micro-withdrawals in streaming |
| **MiniPay** | 14M+ users, built-in distribution channel |
| **Mobile-first** | Designed for emerging markets where mobile payroll matters |
| **Pay gas in stablecoins** | Users can pay transaction fees in cUSD — no need to hold CELO |
| **Native stablecoins** | cUSD, USDC, USDT all available natively |
| **Fast finality** | ~5-second block times for real-time streaming UX |
| **EVM compatible** | Leverage existing Solidity ecosystem |

---

## Getting Started (Development)

```bash
# Clone the repo
git clone https://github.com/<your-username>/trickle.git
cd trickle

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your private key (NEVER use your main wallet for dev!)
# Add Celo RPC URL

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
| MiniPay Docs | [docs.celo.org/build-on-minipay](https://docs.celo.org/developer/build-on-minipay/overview) |
| LlamaPay (Reference) | [llamapay.io](https://llamapay.io/) |
| Telegram | [t.me/proofofship](https://t.me/proofofship) |

---

## License

MIT — Open Source as required by Proof of Ship eligibility.
