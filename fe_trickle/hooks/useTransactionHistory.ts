import { useQuery } from "@tanstack/react-query";
import { useBlockNumber, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { TRICKLE_VAULT_ABI } from "@/config/contracts";
import { useVaultAddress } from "@/hooks/useChain";

export type TxEventKind =
  | "deposit"
  | "balance-withdrawn"
  | "stream-created"
  | "stream-cancelled"
  | "withdrawn";

export type TxEvent = {
  kind: TxEventKind;
  blockNumber: bigint;
  txHash: `0x${string}`;
  tokenAddress: `0x${string}`;
  amount?: bigint;
  counterparty?: `0x${string}`;
};

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

export function blocksAgo(delta: bigint): string {
  const s = Number(delta);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function useTransactionHistory(
  address: `0x${string}` | undefined,
  role: "payer" | "payee"
): { events: TxEvent[]; isLoading: boolean } {
  const vaultAddress = useVaultAddress();
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber();

  // Refresh key changes every 10k blocks (~2.7h) — avoids RPC spam on every block
  const blockEpoch = blockNumber != null ? blockNumber / 10_000n : 0n;

  const { data: events = [], isLoading } = useQuery<TxEvent[]>({
    queryKey: ["tx-history", role, address, blockEpoch.toString()],
    queryFn: async (): Promise<TxEvent[]> => {
      if (!address || blockNumber == null || !publicClient) return [];

      const fromBlock = blockNumber > 10_000n ? blockNumber - 10_000n : 0n;
      const toBlock = blockNumber;

      if (role === "payer") {
        const [deposits, balanceWithdrawals, streamsCreated, streamsCancelled] =
          await Promise.all([
            publicClient
              .getLogs({
                address: vaultAddress,
                event: ABI_DEPOSIT,
                args: { payer: address },
                fromBlock,
                toBlock,
              })
              .catch(() => []),
            publicClient
              .getLogs({
                address: vaultAddress,
                event: ABI_BALANCE_WITHDRAWN,
                args: { payer: address },
                fromBlock,
                toBlock,
              })
              .catch(() => []),
            publicClient
              .getLogs({
                address: vaultAddress,
                event: ABI_STREAM_CREATED,
                args: { payer: address },
                fromBlock,
                toBlock,
              })
              .catch(() => []),
            publicClient
              .getLogs({
                address: vaultAddress,
                event: ABI_STREAM_CANCELLED,
                args: { payer: address },
                fromBlock,
                toBlock,
              })
              .catch(() => []),
          ]);

        const all: TxEvent[] = [
          ...deposits
            .filter((l) => l.blockNumber != null)
            .map((l) => ({
              kind: "deposit" as TxEventKind,
              blockNumber: l.blockNumber!,
              txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
              tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
              amount: l.args.amount,
            })),
          ...balanceWithdrawals
            .filter((l) => l.blockNumber != null)
            .map((l) => ({
              kind: "balance-withdrawn" as TxEventKind,
              blockNumber: l.blockNumber!,
              txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
              tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
              amount: l.args.amount,
            })),
          ...streamsCreated
            .filter((l) => l.blockNumber != null)
            .map((l) => ({
              kind: "stream-created" as TxEventKind,
              blockNumber: l.blockNumber!,
              txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
              tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
              counterparty: l.args.payee ?? undefined,
            })),
          ...streamsCancelled
            .filter((l) => l.blockNumber != null)
            .map((l) => ({
              kind: "stream-cancelled" as TxEventKind,
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
      const [withdrawals, streamsCreated, streamsCancelled] = await Promise.all([
        publicClient
          .getLogs({
            address: vaultAddress,
            event: ABI_WITHDRAWN,
            args: { payee: address },
            fromBlock,
            toBlock,
          })
          .catch(() => []),
        publicClient
          .getLogs({
            address: vaultAddress,
            event: ABI_STREAM_CREATED,
            args: { payee: address },
            fromBlock,
            toBlock,
          })
          .catch(() => []),
        publicClient
          .getLogs({
            address: vaultAddress,
            event: ABI_STREAM_CANCELLED,
            args: { payee: address },
            fromBlock,
            toBlock,
          })
          .catch(() => []),
      ]);

      // Withdrawn event has no token field — resolve via getStream(streamId)
      const withdrawalsResolved = await Promise.all(
        withdrawals
          .filter((l) => l.blockNumber != null)
          .map(async (l) => {
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
              kind: "withdrawn" as TxEventKind,
              blockNumber: l.blockNumber!,
              txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
              tokenAddress,
              amount: l.args.amount,
              counterparty: l.args.payer ?? undefined,
            };
          })
      );

      const all: TxEvent[] = [
        ...withdrawalsResolved,
        ...streamsCreated
          .filter((l) => l.blockNumber != null)
          .map((l) => ({
            kind: "stream-created" as TxEventKind,
            blockNumber: l.blockNumber!,
            txHash: (l.transactionHash ?? ZERO_ADDR) as `0x${string}`,
            tokenAddress: (l.args.token ?? ZERO_ADDR) as `0x${string}`,
            counterparty: l.args.payer ?? undefined,
          })),
        ...streamsCancelled
          .filter((l) => l.blockNumber != null)
          .map((l) => ({
            kind: "stream-cancelled" as TxEventKind,
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
    staleTime: 30_000,
  });

  return { events, isLoading };
}
