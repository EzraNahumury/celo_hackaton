import { describe, expect, it } from "vitest";
import { parseStream } from "../parseStream";

describe("parseStream", () => {
  it("accepts uint40 fields decoded as JS number (viem default for ≤ uint48)", () => {
    // Viem returns small uints (≤ uint48) as `number`, not bigint. lastPaid
    // and startTime are uint40 on the contract, so they arrive as numbers.
    const raw = {
      payer: "0x1111111111111111111111111111111111111111",
      payee: "0x2222222222222222222222222222222222222222",
      token: "0x3333333333333333333333333333333333333333",
      amountPerSec: 123n,
      lastPaid: 1700000000,
      startTime: 1699000000,
    };
    const out = parseStream(raw);
    expect(out).not.toBeNull();
    expect(out?.lastPaid).toBe(1700000000);
    expect(out?.startTime).toBe(1699000000);
    expect(out?.amountPerSec).toBe(123n);
  });

  it("accepts uint40 fields decoded as bigint (defensive — viem may change)", () => {
    const raw = {
      payer: "0x1111111111111111111111111111111111111111",
      payee: "0x2222222222222222222222222222222222222222",
      token: "0x3333333333333333333333333333333333333333",
      amountPerSec: 123n,
      lastPaid: 1700000000n,
      startTime: 1699000000n,
    };
    const out = parseStream(raw);
    expect(out).not.toBeNull();
    expect(out?.lastPaid).toBe(1700000000);
    expect(out?.startTime).toBe(1699000000);
  });

  it("returns null for non-object input", () => {
    expect(parseStream(null)).toBeNull();
    expect(parseStream(undefined)).toBeNull();
    expect(parseStream("nope")).toBeNull();
    expect(parseStream(42)).toBeNull();
  });

  it("returns null when amountPerSec is not bigint", () => {
    const raw = {
      payer: "0x1111111111111111111111111111111111111111",
      payee: "0x2222222222222222222222222222222222222222",
      token: "0x3333333333333333333333333333333333333333",
      amountPerSec: 123, // wrong: should be bigint
      lastPaid: 1700000000,
      startTime: 1699000000,
    };
    expect(parseStream(raw)).toBeNull();
  });

  it("returns null when any address field is missing", () => {
    const raw = {
      payer: "0x1111111111111111111111111111111111111111",
      // payee missing
      token: "0x3333333333333333333333333333333333333333",
      amountPerSec: 123n,
      lastPaid: 1700000000,
      startTime: 1699000000,
    };
    expect(parseStream(raw)).toBeNull();
  });
});
