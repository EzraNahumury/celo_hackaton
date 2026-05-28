import { describe, expect, it } from "vitest";
import { buildPaymentRequestUrl, parsePaymentRequestUrl } from "../invoiceLink";

describe("buildPaymentRequestUrl", () => {
  it("encodes all params into URL", () => {
    const url = buildPaymentRequestUrl({
      to: "0x1234567890123456789012345678901234567890",
      amount: "1500",
      token: "USDm",
      desc: "May 2026 salary",
    });
    expect(url).toContain("/pay");
    expect(url).toContain("to=0x1234567890123456789012345678901234567890");
    expect(url).toContain("amount=1500");
    expect(url).toContain("token=USDm");
    expect(url).toContain("desc=May+2026+salary");
  });

  it("handles desc with special characters", () => {
    const url = buildPaymentRequestUrl({
      to: "0xabcdef0000000000000000000000000000000001",
      amount: "500",
      token: "USDC",
      desc: "Invoice #001 & bonus",
    });
    const parsed = new URL(url, "http://localhost");
    expect(parsed.searchParams.get("desc")).toBe("Invoice #001 & bonus");
  });
});

describe("parsePaymentRequestUrl", () => {
  it("returns null for empty search params", () => {
    expect(parsePaymentRequestUrl(new URLSearchParams())).toBeNull();
  });

  it("returns null when required fields missing", () => {
    const params = new URLSearchParams({ to: "0x1234567890123456789012345678901234567890" });
    expect(parsePaymentRequestUrl(params)).toBeNull();
  });

  it("returns null for invalid address", () => {
    const params = new URLSearchParams({
      to: "notanaddress",
      amount: "1000",
      token: "USDm",
    });
    expect(parsePaymentRequestUrl(params)).toBeNull();
  });

  it("parses valid params correctly", () => {
    const params = new URLSearchParams({
      to: "0x1234567890123456789012345678901234567890",
      amount: "1500",
      token: "USDm",
      desc: "May 2026 salary",
    });
    const result = parsePaymentRequestUrl(params);
    expect(result).not.toBeNull();
    expect(result?.to).toBe("0x1234567890123456789012345678901234567890");
    expect(result?.amount).toBe("1500");
    expect(result?.token).toBe("USDm");
    expect(result?.desc).toBe("May 2026 salary");
  });

  it("returns null when amount is not a positive number", () => {
    const params = new URLSearchParams({
      to: "0x1234567890123456789012345678901234567890",
      amount: "-50",
      token: "USDm",
    });
    expect(parsePaymentRequestUrl(params)).toBeNull();
  });
});
