<div align="center">
  <img src="./public/logo.png" alt="Trickle" width="96" />

  <h1>Trickle — MiniApp</h1>

  <p><strong>Next.js 16 frontend for the TrickleVault payroll-streaming protocol on Celo.</strong></p>

  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.2-000?style=flat-square&logo=nextdotjs&logoColor=white" />
    <img alt="React" src="https://img.shields.io/badge/React-19.2-149ECA?style=flat-square&logo=react&logoColor=white" />
    <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
    <img alt="wagmi" src="https://img.shields.io/badge/wagmi-v3-1C1B1B?style=flat-square" />
    <img alt="viem" src="https://img.shields.io/badge/viem-v2-FFC517?style=flat-square" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  </p>
</div>

> The web client for **Trickle** — a MiniApp surface that lets employers fund a vault and open per-second salary streams, and lets employees withdraw accrued earnings inside MiniPay. For protocol-level docs see the [root README](../README.md). For the Solidity side see [`../sc_trickle/README.md`](../sc_trickle/README.md).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The app ships pre-pointed at the live Celo Mainnet vault — no env vars needed to develop against production reads. To override:

```dotenv
# .env.local
NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS_MAINNET=0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS_SEPOLIA=0x42cADdd47E795A6e04d820A6c140AF04159C7542
NEXT_PUBLIC_MOCK_TOKEN_ADDRESS=0x...      # tUSDC mock with public mint() on Sepolia
```

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server with HMR |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (next config) |

---

## Architecture

```mermaid
flowchart TB
    subgraph APP["app/  (Next.js App Router)"]
        ROOT["/  · onboarding"]
        HOME["/home  · role select"]
        EMPR["/employer  · vault dashboard"]
        EMPC["/employer/create  · new stream"]
        EMPE["/employee  · live earnings"]
    end

    subgraph LAYOUT["layout.tsx"]
        FONTS["Inter + JetBrains Mono<br/>(next/font/google)"]
        BG["AnimatedBackground"]
        PROV["Providers<br/>(Wagmi + React Query)"]
    end

    subgraph CFG["config/"]
        CHAINS["chains.ts<br/>vault / explorer / label per chainId"]
        WAGMI["wagmi.ts<br/>celo + celoSepolia, EIP-6963 connectors"]
        TOKENS["tokens.ts<br/>USDC · USDm · tUSDC"]
        CTR["contracts.ts<br/>TRICKLE_VAULT_ABI · ERC20_ABI"]
    end

    subgraph HOOKS["hooks/"]
        UC["useChain<br/>useVaultAddress · useChainTokens · useExplorerUrl"]
        UD["useDeposit<br/>chained approve → deposit"]
    end

    subgraph CHAIN["Celo (42220 / 11142220)"]
        VAULT["TrickleVault"]
    end

    APP --> LAYOUT
    APP --> HOOKS
    HOOKS --> CFG
    HOOKS -- "wagmi useWriteContract /<br/>useWaitForTransactionReceipt" --> VAULT
    PROV --> WAGMI

    classDef app fill:#0F1119,stroke:#3A4055,color:#F5F7FB;
    classDef cfg fill:#161927,stroke:#6366F1,color:#F5F7FB;
    classDef chain fill:#1D2131,stroke:#6366F1,stroke-width:2px,color:#F5F7FB;
    class ROOT,HOME,EMPR,EMPC,EMPE,FONTS,BG,PROV app
    class CHAINS,WAGMI,TOKENS,CTR,UC,UD cfg
    class VAULT chain
```

---

## File layout

```
fe_trickle/
├── app/                     Next.js 16 App Router
│   ├── layout.tsx           Inter + JBMono fonts, AnimatedBackground, Providers
│   ├── page.tsx             /            — onboarding / brand pill / hero CTA
│   ├── home/                /home        — role select after wallet connect
│   ├── employer/
│   │   ├── page.tsx         /employer    — vault overview, active streams
│   │   └── create/          /employer/create — new-stream form
│   └── employee/
│       └── page.tsx         /employee    — live earnings + withdraw-all
│
├── components/
│   ├── DashboardLayout.tsx  shared shell for /employer & /employee
│   ├── Navbar.tsx           top bar with wallet + chain badge
│   ├── BottomNav.tsx        mobile tab bar (MiniPay form factor)
│   ├── ProfileSheet.tsx     bottom-sheet profile/disconnect
│   ├── HeroSection.tsx      onboarding hero
│   ├── StreamCard.tsx       per-stream row with live accrual
│   ├── ConnectWalletPrompt.tsx
│   ├── WrongNetworkBanner.tsx
│   ├── Toast.tsx
│   ├── Providers.tsx        WagmiProvider + QueryClientProvider
│   ├── ThemeProvider.tsx
│   └── ui/                  primitives — Button, Card, Badge, Input, Tabs,
│                            StatCard, MiniChart, AnimatedNumber, TokenIcon,
│                            FlowIllustration, animated-background, wallet-modal
│
├── config/
│   ├── chains.ts            VAULT_ADDRESS_BY_CHAIN, EXPLORER_URL_BY_CHAIN, helpers
│   ├── wagmi.ts             createConfig — celo + celoSepolia, EIP-6963 auto-discover
│   ├── tokens.ts            TOKENS_BY_CHAIN — USDC (mainnet) · USDC/USDm/tUSDC (sepolia)
│   └── contracts.ts         TRICKLE_VAULT_ABI + ERC20_ABI (forge inspect)
│
├── hooks/
│   ├── useChain.ts          chain-aware reads (vault addr, tokens, explorer, label)
│   └── useDeposit.ts        approve → deposit state machine with receipt-waiting
│
├── lib/
│   └── cn.ts                clsx wrapper
│
└── public/
    ├── logo.png · favicon.png · apple-icon
    └── tokens/              token glyphs
```

---

## State of the box

### Multi-chain by default
`config/chains.ts` keys everything (vault address, explorer URL, label) by `chainId`. Components never hard-code a network — they call `useVaultAddress()` / `useExplorerUrl()` and the right value follows the connected wallet. Mainnet is the default; Sepolia is supported for testing.

```ts
const vault    = useVaultAddress();    // 0x8a3e…dc05 on mainnet, 0x42cA…7542 on sepolia
const tokens   = useChainTokens();     // { USDC } on mainnet, { tUSDC, USDC, USDm } on sepolia
const explorer = useExplorerUrl();     // celoscan.io / sepolia.celoscan.io
```

### Wallet discovery
`config/wagmi.ts` ships **zero** hard-coded connectors. wagmi auto-discovers any EIP-6963 wallet (MiniPay, MetaMask, Rabby, OKX, Brave, Talisman, …) and renders each with its own `name` + `icon` + `rdns`. Inside MiniPay's WebView this means the user sees one option — MiniPay — already selected.

### Deposit flow
ERC-20 approve → vault deposit is a notoriously fragile two-step. `useDeposit()` runs it as a real state machine driven by `useWaitForTransactionReceipt`, not by `setTimeout` guesses:

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> approving: deposit(token, amount)
    approving --> depositing: approve receipt confirmed
    approving --> error: approve reverts / write fails
    depositing --> done: deposit receipt confirmed
    depositing --> error: deposit reverts / write fails
    done --> idle: reset()
    error --> idle: reset()
```

Returned API:
```ts
const { deposit, phase, approveTxHash, depositTxHash,
        isPending, isDone, isError, error, reset } = useDeposit();
```

### RPC strategy
Default transports use **Forno** (`https://forno.celo.org` / `https://forno.celo-sepolia.celo-testnet.org`). `chains.ts` declares `drpc` and `ankr` as backup RPCs on the chain object so a `viem` `fallback` transport can be wired in if a single endpoint flakes.

---

## Visual system

Trickle is a **dark-indigo SaaS** app, not a generic web3 dApp. The reference quality is Stripe / Linear / Ramp — restraint over decoration.

| Token | Value | Use |
|---|---|---|
| Page bg | `#0A0B14` | base canvas |
| Surface | `#161927` | cards |
| Elevated | `#1D2131` | popovers, sheets |
| Hover | `#252A3D` | interactive surface state |
| Text | `#F5F7FB` / `#B8BECE` / `#828AA0` | primary / secondary / muted |
| **Accent** | `#6366F1` (indigo-500) | single brand colour, used sparingly |
| Success | `#10B981` | the only secondary colour |
| Danger / Warn | `#EF4444` / `#F59E0B` | states only, never decoration |

Type stack: **Inter** (UI) + **JetBrains Mono** (numerics, addresses), both via `next/font/google` for zero-CLS subsetting. No external font CSS links.

Motion: 0.2–0.35s with `cubic-bezier(0.16, 1, 0.3, 1)`. Buttons get `whileHover scale 1.02`, `whileTap scale 0.98`. Ambient background = soft indigo radial blobs with `mix-blend-mode: screen` — no particles, no wireframes, no glow abuse.

---

## MiniApp surfaces

| Route | Role | Purpose |
|---|---|---|
| `/` | — | Onboarding · brand pill, hero illustration, primary CTA |
| `/home` | both | Role select (Employer / Employee) after wallet connect |
| `/employer` | payer | Vault overview · token tabs · 3-action row · active streams |
| `/employer/create` | payer | New-stream form — payee, token, monthly rate, review |
| `/employee` | payee | Live withdrawable counter · sparklines · area chart · withdraw-all |

The reference layout pattern is a 3-screen crypto-mobile flow: **onboarding → dashboard → detail**. Big tabular numerics (44–56px), uppercase eyebrow labels (12–13px tracking-[0.14em]), large breathing room.

---

## Tech stack

| | |
|---|---|
| **Framework** | Next.js 16.2 (App Router, RSC, Turbopack dev) |
| **UI** | React 19.2, Tailwind v4, framer-motion 12, lucide-react |
| **Web3** | wagmi v3.6, viem v2.47, @tanstack/react-query 5 |
| **Wallet** | EIP-6963 auto-discovery (MiniPay, MetaMask, Rabby, …) |
| **Hero asset** | Spline (`@splinetool/react-spline`) |
| **Type system** | TypeScript 5, strict mode |
| **Lint** | ESLint 9 with `eslint-config-next` |

> ⚠️ **Heads up to AI coding assistants:** see [`AGENTS.md`](./AGENTS.md). This is Next.js 16 — APIs and conventions differ from older training data. Always check `node_modules/next/dist/docs/` before writing route or layout code.

---

## Deploy

The app deploys cleanly to **Vercel** with no extra config (Next.js 16 is detected automatically). Set the same env vars listed in [Quick start](#quick-start) in the Vercel dashboard if you want to repoint to a non-default vault.

---

## Related

| | |
|---|---|
| Root README (protocol overview) | [`../README.md`](../README.md) |
| Smart contracts (Foundry) | [`../sc_trickle/README.md`](../sc_trickle/README.md) |
| Heartbeat script | [`../scripts/README.md`](../scripts/README.md) |
| Live mainnet vault | [celoscan.io/address/0x8a3e…dc05](https://celoscan.io/address/0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05) |
