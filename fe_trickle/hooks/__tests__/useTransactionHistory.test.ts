import { describe, expect, it } from "vitest";
import { blocksAgo } from "../useTransactionHistory";

describe("blocksAgo", () => {
  describe("seconds window (< 60s)", () => {
    it("0 → '0s ago'", () => {
      expect(blocksAgo(0n)).toBe("0s ago");
    });

    it("1 → '1s ago'", () => {
      expect(blocksAgo(1n)).toBe("1s ago");
    });

    it("59 → '59s ago' (boundary)", () => {
      expect(blocksAgo(59n)).toBe("59s ago");
    });
  });

  describe("minutes window (60s–3599s)", () => {
    it("60 → '1m ago' (boundary)", () => {
      expect(blocksAgo(60n)).toBe("1m ago");
    });

    it("119 → '1m ago' (rounds down)", () => {
      expect(blocksAgo(119n)).toBe("1m ago");
    });

    it("120 → '2m ago'", () => {
      expect(blocksAgo(120n)).toBe("2m ago");
    });

    it("3599 → '59m ago' (boundary)", () => {
      expect(blocksAgo(3599n)).toBe("59m ago");
    });
  });

  describe("hours window (3600s–86399s)", () => {
    it("3600 → '1h ago' (boundary)", () => {
      expect(blocksAgo(3600n)).toBe("1h ago");
    });

    it("7199 → '1h ago' (rounds down)", () => {
      expect(blocksAgo(7199n)).toBe("1h ago");
    });

    it("7200 → '2h ago'", () => {
      expect(blocksAgo(7200n)).toBe("2h ago");
    });

    it("86399 → '23h ago' (boundary)", () => {
      expect(blocksAgo(86399n)).toBe("23h ago");
    });
  });

  describe("days window (>= 86400s)", () => {
    it("86400 → '1d ago' (boundary)", () => {
      expect(blocksAgo(86400n)).toBe("1d ago");
    });

    it("172800 → '2d ago'", () => {
      expect(blocksAgo(172800n)).toBe("2d ago");
    });

    it("604800 → '7d ago' (one week)", () => {
      expect(blocksAgo(604800n)).toBe("7d ago");
    });

    it("31536000 → '365d ago' (one year)", () => {
      expect(blocksAgo(31536000n)).toBe("365d ago");
    });
  });
});
