"use client";

import { cn } from "@/lib/cn";
import { TokenIcon } from "@/components/ui/TokenIcon";

interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  icon?: string;
}

const TOKEN_COLORS: Record<string, { bg: string; fg: string }> = {
  USDm: { bg: "#1E2141", fg: "#A5B4FC" },
  USDC: { bg: "#0F2A4A", fg: "#7DD3FC" },
  USDT: { bg: "#0E2A22", fg: "#6EE7B7" },
  CELO: { bg: "#2A2A1A", fg: "#FCFF52" },
};

interface TokenSelectorProps {
  tokens: Token[];
  selected: string;
  onChange: (symbol: string) => void;
}

export function TokenSelector({ tokens, selected, onChange }: TokenSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {tokens.map((t) => {
        const isSelected = selected === t.symbol;
        const fallback = TOKEN_COLORS[t.symbol] ?? { bg: "#252A3D", fg: "#B8BECE" };
        return (
          <button
            key={t.symbol}
            onClick={() => onChange(t.symbol)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ease-out",
              isSelected
                ? "border-[var(--accent)]/40 bg-[var(--color-accent-soft)]"
                : "border-[var(--border)] bg-[var(--color-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            <TokenIcon
              symbol={t.symbol}
              icon={t.icon}
              size={28}
              rounded="lg"
              fallback={fallback}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[13px] font-semibold leading-none",
                  isSelected ? "text-[var(--accent-3)]" : "text-[var(--fg)]"
                )}
              >
                {t.symbol}
              </p>
              <p className="mt-1 truncate text-[11px] text-[var(--fg-mute)]">{t.name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
