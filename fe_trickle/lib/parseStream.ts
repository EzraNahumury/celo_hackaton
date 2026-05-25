/**
 * Runtime-validated decoder for TrickleVault `getStream` results.
 *
 * `useReadContract`'s return type is statically inferred from the ABI but
 * downstream code historically reached for `as unknown as` casts to shape it.
 * That bypasses TypeScript: if the ABI changes shape, the cast silently lies.
 * `parseStream` validates the shape at runtime and returns `null` on mismatch,
 * letting callers filter bad rows instead of crashing on access.
 *
 * Viem ABI decoding quirk: small uints (≤ uint48) are decoded as `number`,
 * not `bigint`. `lastPaid` and `startTime` are `uint40` on-chain, so the
 * shape check must accept both. `amountPerSec` is `uint216` so it stays
 * bigint-only.
 */

export type Stream = {
  payer: string;
  payee: string;
  token: string;
  amountPerSec: bigint;
  lastPaid: number;
  startTime: number;
};

function isNumericLike(v: unknown): v is number | bigint {
  return typeof v === "number" || typeof v === "bigint";
}

function isStreamShape(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.payer === "string" &&
    typeof o.payee === "string" &&
    typeof o.token === "string" &&
    typeof o.amountPerSec === "bigint" &&
    isNumericLike(o.lastPaid) &&
    isNumericLike(o.startTime)
  );
}

export function parseStream(raw: unknown): Stream | null {
  if (!isStreamShape(raw)) return null;
  const o = raw as {
    payer: string;
    payee: string;
    token: string;
    amountPerSec: bigint;
    lastPaid: number | bigint;
    startTime: number | bigint;
  };
  return {
    payer: o.payer,
    payee: o.payee,
    token: o.token,
    amountPerSec: o.amountPerSec,
    lastPaid: Number(o.lastPaid),
    startTime: Number(o.startTime),
  };
}
