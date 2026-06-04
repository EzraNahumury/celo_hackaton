/**
 * Pure helpers for working with Trickle streams. Zero runtime dependencies —
 * bigint math only — so the SDK stays tiny and tree-shakeable. Use alongside
 * viem/wagmi for the actual on-chain reads and writes.
 */

/** Seconds in a 30-day month — the unit Trickle uses to quote salaries. */
export const SECONDS_PER_MONTH = 2_592_000n;

/** Format a token amount (base units) as a human decimal string. */
export function formatAmount(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const v = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}

/** Parse a human decimal string into base units (the inverse of formatAmount). */
export function parseAmount(value: string, decimals: number): bigint {
  if (!/^-?\d*\.?\d*$/.test(value) || value === "" || value === ".") {
    throw new Error(`parseAmount: invalid number "${value}"`);
  }
  const negative = value.startsWith("-");
  const s = negative ? value.slice(1) : value;
  const [whole = "0", frac = ""] = s.split(".");
  if (frac.length > decimals) {
    throw new Error(`parseAmount: too many decimals for ${decimals}-dp token`);
  }
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const result = BigInt((whole || "0") + fracPadded);
  return negative ? -result : result;
}

/** Convert a per-second stream rate into the equivalent monthly amount. */
export function ratePerSecToMonthly(amountPerSec: bigint): bigint {
  return amountPerSec * SECONDS_PER_MONTH;
}

/** Convert a desired monthly salary into a per-second stream rate (floored). */
export function monthlyToRatePerSec(monthly: bigint): bigint {
  return monthly / SECONDS_PER_MONTH;
}

/**
 * Amount accrued (and withdrawable, balance permitting) on a stream between
 * `lastPaid` and `now`. Times are unix seconds; never returns negative.
 */
export function accrued(
  amountPerSec: bigint,
  lastPaidSec: number,
  nowSec: number,
): bigint {
  const elapsed = Math.max(0, Math.floor(nowSec) - Math.floor(lastPaidSec));
  return amountPerSec * BigInt(elapsed);
}

/**
 * How many days of runway a deposited balance covers at a given total rate.
 * Returns Infinity when the rate is zero. Useful for "top up before dry" UX.
 */
export function runwayDays(balance: bigint, totalRatePerSec: bigint): number {
  if (totalRatePerSec <= 0n) return Number.POSITIVE_INFINITY;
  const secondsLeft = balance / totalRatePerSec;
  return Number(secondsLeft) / 86_400;
}

/** Shorten an address for display, e.g. 0x1234…aBcD. */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length < 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

/** Loose 0x-address shape check (not a checksum verification). */
export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}
