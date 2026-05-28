import { useQuery } from "@tanstack/react-query";
import { useBlockNumber, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { TRICKLE_VAULT_ABI } from "@/config/contracts";
import { useVaultAddress } from "@/hooks/useChain";

/** Fields shared by every {@link TxEvent} variant. */
type TxEventCommon = {
  /** Block where the tx was mined. */
  blockNumber: bigint;
  /** Transaction hash, suitable for explorer links. */
  txHash: `0x${string}`;
  /** ERC20 the event was about (zero address when the log doesn't carry it
   *  and the `getStream` fallback also failed). */
  tokenAddress: `0x${string}`;
};

/**
 * Normalized on-chain TrickleVault event for the activity feed.
 *
 * Discriminated union over `kind` — amount and counterparty are present only
 * on the variants that actually carry them. Consumers can narrow with a
 * `switch (event.kind)` or `"amount" in event` check.
 *
 * Variants:
 *  - `deposit` — payer topped up their vault balance for a token. Carries `amount`.
 *  - `balance-withdrawn` — payer pulled idle balance back to their wallet. Carries `amount`.
 *  - `stream-created` — a new stream was opened (either side, depending on query role).
 *  - `stream-cancelled` — a stream was terminated.
 *  - `withdrawn` — payee claimed accrued earnings from a stream. Carries both
 *    `amount` and `counterparty`.
 *
 * `counterparty` is the *other* address in the relationship: payee for a
 * payer-side query, payer for a payee-side query.
 */
export type TxEvent =
  | (TxEventCommon & { kind: "deposit"; amount: bigint })
  | (TxEventCommon & { kind: "balance-withdrawn"; amount: bigint })
  | (TxEventCommon & { kind: "stream-created"; counterparty?: `0x${string}` })
  | (TxEventCommon & { kind: "stream-cancelled"; counterparty?: `0x${string}` })
  | (TxEventCommon & {
      kind: "withdrawn";
      amount: bigint;
      counterparty?: `0x${string}`;
    });

/** Union of all {@link TxEvent} kind discriminators. */
export type TxEventKind = TxEvent["kind"];

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;

// viem 2.x parseAbiItem for typed getLogs with args filter
const ABI_DEPOSIT = parseAbiItem(
  "event Deposit(address indexed payer, address indexed token, uint256 amount)"
);
const ABI_BALANCE_WITHDRAWN = parseAbiItem(
  "event BalanceWithdrawn(address indexed payer, address indexed token, uint256 amount)"
);
const ABI_STREAM_CREATED = parseAbiItem(
  "event StreamCreated(bytes32 indexed streamId, address indexed payer, address indexed payee, address token, uint216 amountPerSec)"
);
const ABI_STREAM_CANCELLED = parseAbiItem(
  "event StreamCancelled(bytes32 indexed streamId, address indexed payer, address indexed payee, address token)"
);
const ABI_WITHDRAWN = parseAbiItem(
  "event Withdrawn(bytes32 indexed streamId, address indexed payee, address indexed payer, uint256 amount)"
);

/**
 * Formats a *seconds delta* as a short relative phrase ("3m ago", "2d ago").
 *
 * Despite the name, `delta` is in **seconds**, not blocks. The name is a
 * historical artifact from before Celo blocks were 1s — keeping it stable
 * to avoid touching the call sites.
 *
 * Strings are English-only by design (the app is not yet localized).
 *
 * @example
 *   blocksAgo(45n)     // "45s ago"
 *   blocksAgo(120n)    // "2m ago"
 *   blocksAgo(7200n)   // "2h ago"
 *   blocksAgo(172800n) // "2d ago"
 */
export function blocksAgo(delta: bigint): string {
  const s = Number(delta);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Fetches the last ~14 days of TrickleVault activity for a given address,
 * normalized into {@link TxEvent}s sorted newest-first and capped at 20 rows.
 *
 * Behavior:
 *  - `role` controls which side's events are fetched. A `payer` sees their
 *    own deposits / balance-withdraws / streams opened or cancelled. A
 *    `payee` sees withdrawals they claimed plus streams targeting them.
 *  - The deposit/withdraw window is the last 200k blocks (~14d on Celo).
 *    Stream open/close events use a wider 500k block window because streams
 *    may have started months ago and the user still wants to see "X stream
 *    created on Y" context.
 *  - The hook is gated on the address, the public client, and the latest
 *    block number — it does not fire until all three are available.
 *  - `withdrawn` event logs don't carry the token address, so the hook
 *    falls back to `getStream(streamId)` to resolve it. If that read fails
 *    (e.g. stream was already cleaned up) the row renders without a symbol
 *    instead of being dropped.
 *  - Per-event-type RPC failures use `Promise.allSettled` so partial outages
 *    surface whatever data is available; only when *every* event-type call
 *    in the role branch rejects does `isError` flip.
 *
 * @param address — wallet address to query for, or undefined to disable.
 * @param role — which side of the relationship to fetch.
 * @returns events plus loading/error flags and a stable refetch callback.
 */
export function useTransactionHistory(
  address: `0x${string}` | undefined,
  role: "payer" | "payee"
): {
  events: TxEvent[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const vaultAddress = useVaultAddress();
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber();

  // Refresh key changes every 50k blocks (~3d) — stream events are infrequent.
  // Guard against the undefined→defined transition emitting two cache keys
  // (0n then real epoch) which used to trigger a duplicate fetch on first load.
  const blockEpochKey =
    blockNumber != null ? (blockNumber / 50_000n).toString() : null;

  const { data: events = [], isLoading, isError, refetch } = useQuery<TxEvent[]>({
    queryKey: ["tx-history", role, address, blockEpochKey],
    queryFn: async (): Promise<TxEvent[]> => {
      if (!address || blockNumber == null || !publicClient) return [];

      // ~14 days of recent tx (deposits/withdrawals). Stream events use a wider
      // window since streams may have been opened months ago.
      const fromBlock = blockNumber > 200_000n ? blockNumber - 200_000n : 0n;
      const streamFromBlock = blockNumber > 500_000n ? blockNumber - 500_000n : 0n;
      const toBlock = blockNumber;

      if (role === "payer") {
        const settled = await Promise.allSettled([
          publicClient.getLogs({
            address: vaultAddress,
            event: ABI_DEPOSIT,
            args: { payer: address },
            fromBlock,
            toBlock,
          }),
          publicClient.getLogs({
            address: vaultAddress,
            event: ABI_BALANCE_WITHDRAWN,
            args: { payer: address },
            fromBlock,
            toBlock,
          }),
          publicClient.getLogs({
            address: vaultAddress,
            event: ABI_STREAM_CREATED,
            args: { payer: address },
            fromBlock: streamFromBlock,
            toBlock,
          }),
          publicClient.getLogs({
            address: vaultAddress,
            event: ABI_STREAM_CANCELLED,
            args: { payer: address },
            fromBlock: streamFromBlock,
            toBlock,
          }),
        ]);

        const [depositsR, balanceWithdrawalsR, streamsCreatedR, streamsCancelledR] = settled;
        const labels = ["Deposit", "BalanceWithdrawn", "StreamCreated", "StreamCancelled"] as const;
        settled.forEach((r, i) => {
          if (r.status === "rejected") {
            console.warn(`[tx-history payer] ${labels[i]} getLogs failed:`, r.reason);
          }
        });
        if (settled.every((r) => r.status === "rejected")) {
          throw new Error("All payer tx-history RPC calls failed");
        }
        const deposits = depositsR.status === "fulfilled" ? depositsR.value : [];
        const balanceWithdrawals = balanceWithdrawalsR.status === "fulfilled" ? balanceWithdrawalsR.value : [];
        const streamsCreated = streamsCreatedR.status === "fulfilled" ? streamsCreatedR.value : [];
        const streamsCancelled = streamsCancelledR.status === "fulfilled" ? streamsCancelledR.value : [];

        const all: TxEvent[] = [
          ...deposits
            .filter((l) => l.blockNumber != null && l.args.amount != null)
            .map((l): TxEvent => ({
              kind: "deposit",
              blockNumber: l.blockNumber!,
              txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
              tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
              amount: l.args.amount!,
            })),
          ...balanceWithdrawals
            .filter((l) => l.blockNumber != null && l.args.amount != null)
            .map((l): TxEvent => ({
              kind: "balance-withdrawn",
              blockNumber: l.blockNumber!,
              txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
              tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
              amount: l.args.amount!,
            })),
          ...streamsCreated
            .filter((l) => l.blockNumber != null)
            .map((l): TxEvent => ({
              kind: "stream-created",
              blockNumber: l.blockNumber!,
              txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
              tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
              counterparty: l.args.payee ?? undefined,
            })),
          ...streamsCancelled
            .filter((l) => l.blockNumber != null)
            .map((l): TxEvent => ({
              kind: "stream-cancelled",
              blockNumber: l.blockNumber!,
              txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
              tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
              counterparty: l.args.payee ?? undefined,
            })),
        ];

        return all
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, 20);
      }

      // payee role
      const settled = await Promise.allSettled([
        publicClient.getLogs({
          address: vaultAddress,
          event: ABI_WITHDRAWN,
          args: { payee: address },
          fromBlock,
          toBlock,
        }),
        publicClient.getLogs({
          address: vaultAddress,
          event: ABI_STREAM_CREATED,
          args: { payee: address },
          fromBlock: streamFromBlock,
          toBlock,
        }),
        publicClient.getLogs({
          address: vaultAddress,
          event: ABI_STREAM_CANCELLED,
          args: { payee: address },
          fromBlock: streamFromBlock,
          toBlock,
        }),
      ]);

      const [withdrawalsR, streamsCreatedR, streamsCancelledR] = settled;
      const labels = ["Withdrawn", "StreamCreated", "StreamCancelled"] as const;
      settled.forEach((r, i) => {
        if (r.status === "rejected") {
          console.warn(`[tx-history payee] ${labels[i]} getLogs failed:`, r.reason);
        }
      });
      if (settled.every((r) => r.status === "rejected")) {
        throw new Error("All payee tx-history RPC calls failed");
      }
      const withdrawals = withdrawalsR.status === "fulfilled" ? withdrawalsR.value : [];
      const streamsCreated = streamsCreatedR.status === "fulfilled" ? streamsCreatedR.value : [];
      const streamsCancelled = streamsCancelledR.status === "fulfilled" ? streamsCancelledR.value : [];

      // Withdrawn event has no token field — resolve via getStream(streamId)
      const withdrawalsResolved: TxEvent[] = await Promise.all(
        withdrawals
          .filter((l) => l.blockNumber != null && l.args.amount != null)
          .map(async (l): Promise<TxEvent> => {
            let tokenAddress: `0x${string}` = ZERO_ADDR;
            try {
              const stream = await publicClient.readContract({
                address: vaultAddress,
                abi: TRICKLE_VAULT_ABI,
                functionName: "getStream",
                args: [l.args.streamId!],
              });
              if (stream.token !== ZERO_ADDR) tokenAddress = stream.token;
            } catch {
              // stream gone or RPC error — show amount without token symbol
            }
            return {
              kind: "withdrawn",
              blockNumber: l.blockNumber!,
              txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
              tokenAddress,
              amount: l.args.amount!,
              counterparty: l.args.payer ?? undefined,
            };
          })
      );

      const all: TxEvent[] = [
        ...withdrawalsResolved,
        ...streamsCreated
          .filter((l) => l.blockNumber != null)
          .map((l): TxEvent => ({
            kind: "stream-created",
            blockNumber: l.blockNumber!,
            txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
            tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
            counterparty: l.args.payer ?? undefined,
          })),
        ...streamsCancelled
          .filter((l) => l.blockNumber != null)
          .map((l): TxEvent => ({
            kind: "stream-cancelled",
            blockNumber: l.blockNumber!,
            txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
            tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
            counterparty: l.args.payer ?? undefined,
          })),
      ];

      return all
        .sort((a, b) => Number(b.blockNumber - a.blockNumber))
        .slice(0, 20);
    },
    enabled: !!address && blockNumber != null && !!publicClient,
    staleTime: 0,
    retry: 1,
  });

  return { events, isLoading, isError, refetch: () => void refetch() };
}
