# Transaction History — Design Spec

**Goal:** Embed a "Recent activity" section at the bottom of `/employer` and `/employee` dashboards showing on-chain events from TrickleVault for the connected wallet.

**Architecture:** A `useTransactionHistory` hook fetches the last 10,000 blocks of events via `publicClient.getLogs()` (safe for all Celo RPC providers including Forno). Results are normalized into a flat `TxEvent[]`, sorted newest-first, sliced to 20. A `TransactionHistorySection` component renders the list with skeleton/empty/error states. Both dashboard pages append the section with no layout changes to existing content.

**Tech Stack:** viem `getLogs`, wagmi `usePublicClient` + `useBlockNumber`, tanstack `useQuery` (already in project), `formatUnits`, existing `useChainTokenList` + `useVaultAddress` hooks.

---

## Data Model

```typescript
// hooks/useTransactionHistory.ts

type TxEventKind =
  | "deposit"             // Deposit(payer, token, amount)
  | "balance-withdrawn"   // BalanceWithdrawn(payer, token, amount)
  | "stream-created"      // StreamCreated(streamId, payer, payee, token, amountPerSec)
  | "stream-cancelled"    // StreamCancelled(streamId, payer, payee, token)
  | "withdrawn"           // Withdrawn(streamId, payee, payer, amount)

type TxEvent = {
  kind: TxEventKind
  blockNumber: bigint
  txHash: `0x${string}`
  tokenAddress: `0x${string}`
  amount?: bigint          // present for deposit, balance-withdrawn, withdrawn
  counterparty?: `0x${string}` // payee (payer view) or payer (payee view) for streams
}
```

---

## Hook: `useTransactionHistory`

**File:** `fe_trickle/hooks/useTransactionHistory.ts`

**Signature:**
```typescript
export function useTransactionHistory(
  address: `0x${string}` | undefined,
  role: "payer" | "payee"
): { events: TxEvent[]; isLoading: boolean }
```

**Implementation strategy:**
1. `usePublicClient()` + `useBlockNumber()` from wagmi
2. `useQuery` from `@tanstack/react-query` with:
   - `queryKey: ['tx-history', role, address, blockEpoch]` where `blockEpoch = blockNumber / 10_000n` (refreshes every ~10k blocks, not every block — avoids RPC spam)
   - `queryFn`: run `Promise.all` of `getLogs` calls in parallel
   - `enabled: !!address && !!blockNumber && !!publicClient`
   - `staleTime: 30_000`
3. Block range: `fromBlock: blockNumber - 10_000n`, `toBlock: blockNumber`
4. Each `getLogs` call wrapped in individual `try/catch` — one failing event type does NOT prevent others from rendering

**Events fetched per role:**

| Role | Event | Filter arg |
|------|-------|-----------|
| payer | `Deposit` | `args: { payer: address }` |
| payer | `BalanceWithdrawn` | `args: { payer: address }` |
| payer | `StreamCreated` | `args: { payer: address }` |
| payer | `StreamCancelled` | `args: { payer: address }` |
| payee | `Withdrawn` | `args: { payee: address }` |
| payee | `StreamCreated` | `args: { payee: address }` |
| payee | `StreamCancelled` | `args: { payee: address }` |

**getLogs call pattern:**
```typescript
await publicClient.getLogs({
  address: vaultAddress,
  abi: TRICKLE_VAULT_ABI,
  eventName: 'Deposit',
  args: { payer: address },
  fromBlock: blockNumber - 10_000n,
  toBlock: blockNumber,
})
```

**Post-processing:**
- Map each log to `TxEvent` (normalize args → typed fields)
- Merge all arrays, sort by `blockNumber` descending
- `slice(0, 20)` — show at most 20 rows
- Return `{ events, isLoading }`

**Relative time helper (same file, not exported):**
```typescript
function blocksAgo(delta: bigint): string {
  const s = Number(delta) // ~1s/block on Celo mainnet
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
```

---

## Component: `TransactionHistorySection`

**File:** `fe_trickle/components/ui/TransactionHistorySection.tsx`

**Props:**
```typescript
interface TransactionHistorySectionProps {
  role: "payer" | "payee"
}
```

**Internal deps:**
- `useAccount()` → address
- `useTransactionHistory(address, role)` → events, isLoading
- `useChainTokenList()` → token lookup for symbol + decimals
- `useBlockNumber()` → for relative time calculation
- `useVaultAddress()` → pass to hook

**Render states:**

| State | UI |
|-------|----|
| `isLoading` | 3 skeleton rows (`<div className="skeleton h-11 rounded-xl" />`) |
| `events.length === 0` | `<p className="text-[12.5px] text-[var(--fg-faint)]">No recent activity.</p>` |
| `events.length > 0` | List of `TxRow` items |

**Per-row display:**

```
[icon]  Label           ~2h ago     +45.30 cUSD
[icon]  Stream started  ~5h ago     → 0xAb12…ef
[icon]  Stream ended    ~1d ago
```

| Kind | Icon (lucide) | Label (payer) | Label (payee) | Amount shown |
|------|---------------|---------------|----------------|--------------|
| deposit | `ArrowDownToLine` | "Deposited" | — | `+amount symbol` in green |
| balance-withdrawn | `ArrowUpFromLine` | "Withdrew balance" | — | `amount symbol` |
| stream-created | `Play` | "Stream started" | "Stream received" | `→ 0xAb12…ef` (counterparty) |
| stream-cancelled | `X` | "Stream cancelled" | "Stream ended" | — |
| withdrawn | `ArrowDownToLine` | — | "Claimed" | `+amount symbol` in green |

**Icon styling:** 28×28px circle, color varies by kind:
- deposit / withdrawn: `bg-[var(--color-success-soft)] text-[var(--success)]`
- balance-withdrawn: `bg-[var(--color-surface-3)] text-[var(--fg-mute)]`
- stream-created: `bg-[var(--color-accent-soft)] text-[var(--accent-3)]`
- stream-cancelled: `bg-[var(--danger)]/10 text-[var(--danger)]`

**Amount formatting:**
```typescript
// Look up token by address (same pattern as employee/page.tsx tokenMetaFor)
const meta = tokenList.find(t => t.address.toLowerCase() === event.tokenAddress.toLowerCase())
const symbol = meta?.symbol ?? "?"
const decimals = meta?.decimals ?? 18
const formatted = parseFloat(formatUnits(event.amount, decimals)).toFixed(2)
```

**Tx hash link:** Each row wraps txHash in Celoscan link:
```
https://celoscan.io/tx/{txHash}
```
Opens `target="_blank" rel="noopener noreferrer"`.

**Section header:**
```tsx
<h2 className="font-display text-[16px] font-semibold tracking-tight text-[var(--fg)]">
  Recent activity
</h2>
```

---

## Integration

**`app/employer/page.tsx`** — append after closing `</motion.div>` of "Active streams" section:
```tsx
import { TransactionHistorySection } from "@/components/ui/TransactionHistorySection"

// At bottom of main content div, after streams section:
<motion.div
  initial={{ opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.22, delay: 0.18 }}
  className="mt-8"
>
  <TransactionHistorySection role="payer" />
</motion.div>
```

**`app/employee/page.tsx`** — same pattern, `role="payee"`, append after incoming streams section.

---

## Error Handling

- Each `getLogs` call in its own `try/catch`. Failure = empty array for that event type, not a thrown error.
- `useQuery` error state is ignored at component level — shows empty state instead of error UI (silent degradation, production safe).
- If `blockNumber` undefined on first mount: `enabled: false` → hook returns `{ events: [], isLoading: false }` → empty state shown, no crash.

---

## Out of Scope

- Pagination (>20 events)
- Push notifications for new events
- Filter by token or event type
- Real block timestamps (estimation is sufficient)
- Smart contract changes (none — frontend only)
