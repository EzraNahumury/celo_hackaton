export function MiniPayBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 backdrop-blur-sm">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981]" />
      </span>
      <span className="text-[11px] font-semibold tracking-tight text-white/75">
        MiniPay
      </span>
    </span>
  );
}
