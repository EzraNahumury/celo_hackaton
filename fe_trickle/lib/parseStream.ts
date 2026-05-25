/**
 * Runtime-validated decoder for TrickleVault `getStream` results.
 *
 * `useReadContract`'s return type is statically inferred from the ABI but
 * downstream code historically reached for `as unknown as` casts to shape it.
 * That bypasses TypeScript: if the ABI changes shape, the cast silently lies.
 * `parseStream` validates the shape at runtime and returns `null` on mismatch,
 * letting callers filter bad rows instead of crashing on access.
 */

export type Stream = {
  payer: string;
  payee: string;
  token: string;
  amountPerSec: bigint;
  lastPaid: number;
  startTime: number;
};

type StreamShape = {
  payer: string;
  payee: string;
  token: string;
  amountPerSec: bigint;
  lastPaid: bigint;
  startTime: bigint;
};

function isStreamShape(v: unknown): v is StreamShape {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.payer === "string" &&
    typeof o.payee === "string" &&
    typeof o.token === "string" &&
    typeof o.amountPerSec === "bigint" &&
    typeof o.lastPaid === "bigint" &&
    typeof o.startTime === "bigint"
  );
}

export function parseStream(raw: unknown): Stream | null {
  if (!isStreamShape(raw)) return null;
  return {
    payer: raw.payer,
    payee: raw.payee,
    token: raw.token,
    amountPerSec: raw.amountPerSec,
    lastPaid: Number(raw.lastPaid),
    startTime: Number(raw.startTime),
  };
}
