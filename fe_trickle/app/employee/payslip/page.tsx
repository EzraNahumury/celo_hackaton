"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useBlockNumber } from "wagmi";
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits } from "viem";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileSpreadsheet } from "lucide-react";
import { TRICKLE_VAULT_ABI, STREAM_REGISTRY_ABI, STREAM_REGISTRY_ADDRESS } from "@/config/contracts";
import { useVaultAddress, useChainTokenList, useExplorerUrl } from "@/hooks/useChain";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { parseStream, type Stream } from "@/lib/parseStream";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import type { TokenInfo } from "@/config/tokens";

type TokenMeta = Pick<TokenInfo, "symbol" | "decimals">;
const FALLBACK: TokenMeta = { symbol: "???", decimals: 18 };

function tokenFor(list: TokenInfo[], addr: string): TokenMeta {
  return list.find((t) => t.address.toLowerCase() === addr.toLowerCase()) ?? FALLBACK;
}

function fmtDate(unixSec: number): string {
  if (!unixSec) return "—";
  return new Date(unixSec * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtMonth(list: TokenInfo[], s: Stream): string {
  const m = tokenFor(list, s.token);
  return parseFloat(formatUnits(s.amountPerSec * 2592000n, m.decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

/** Human label for a transaction event kind (shared by the table and CSV export). */
function eventLabel(kind: string): string {
  switch (kind) {
    case "withdrawn": return "Salary claimed";
    case "stream-created": return "Stream opened";
    case "stream-cancelled": return "Stream cancelled";
    case "deposit": return "Deposit";
    default: return "Balance withdrawn";
  }
}

/** RFC-4180 cell escaping: quote and double-up internal quotes when needed. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export default function PayslipPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const VAULT = useVaultAddress();
  const TOKEN_LIST = useChainTokenList();
  const explorerUrl = useExplorerUrl();

  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Math.floor(Date.now() / 1000)); }, []);

  const [employerName, setEmployerName] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem("trickle_employer_name");
    if (saved) setEmployerName(saved);
  }, []);

  const { data: streamIds } = useReadContract({
    address: VAULT,
    abi: TRICKLE_VAULT_ABI,
    functionName: "getPayeeStreamIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const streamCalls = (streamIds ?? []).map((id: `0x${string}`) => ({
    address: VAULT,
    abi: TRICKLE_VAULT_ABI,
    functionName: "getStream" as const,
    args: [id] as const,
  }));

  const { data: streamResults } = useReadContracts({
    contracts: streamCalls,
    query: { enabled: streamCalls.length > 0 },
  });

  const streams: Stream[] = (streamResults ?? [])
    .filter((r) => r.status === "success" && r.result)
    .map((r) => parseStream(r.result))
    .filter((s): s is Stream => s !== null && s.startTime > 0);

  // ── On-chain payslip labels (StreamRegistry) ──────────────────────────────
  // Strictly non-critical: every read is enabled-gated and the payslip renders
  // regardless. On-chain values take precedence over the localStorage name; if
  // empty or the read fails, we fall back to the wallet address as before.
  // Primary payer = the first stream's payer (single-employer is the common case).
  const primaryPayer = streams[0]?.payer as `0x${string}` | undefined;

  const { data: onchainEmployerName } = useReadContract({
    address: STREAM_REGISTRY_ADDRESS,
    abi: STREAM_REGISTRY_ABI,
    functionName: "getEmployerName",
    args: primaryPayer ? [primaryPayer] : undefined,
    query: { enabled: !!primaryPayer },
  });

  const { data: onchainEmployment } = useReadContract({
    address: STREAM_REGISTRY_ADDRESS,
    abi: STREAM_REGISTRY_ABI,
    functionName: "getEmployment",
    args: primaryPayer && address ? [primaryPayer, address] : undefined,
    query: { enabled: !!primaryPayer && !!address },
  });

  const { data: cleared, refetch: refetchCleared } = useReadContract({
    address: STREAM_REGISTRY_ADDRESS,
    abi: STREAM_REGISTRY_ABI,
    functionName: "payeeCleared",
    args: primaryPayer && address ? [primaryPayer, address] : undefined,
    query: { enabled: !!primaryPayer && !!address },
  });

  // Payee opt-out: suppress an employer's label about them (display-only).
  const { writeContract: doClear, data: clearHash, isPending: clearing } = useWriteContract();
  const { isSuccess: cleared_ok } = useWaitForTransactionReceipt({ hash: clearHash });
  useEffect(() => {
    if (cleared_ok) refetchCleared();
  }, [cleared_ok, refetchCleared]);

  const verifiedEmployerName =
    typeof onchainEmployerName === "string" && onchainEmployerName.length > 0
      ? onchainEmployerName
      : "";
  // On-chain name wins; otherwise the manual localStorage name; otherwise nothing.
  const displayEmployerName = verifiedEmployerName || employerName;
  const employeeName =
    !cleared && Array.isArray(onchainEmployment) ? (onchainEmployment[0] as string) : "";
  const employeeRole =
    !cleared && Array.isArray(onchainEmployment) ? (onchainEmployment[1] as string) : "";

  const totalMonthly = useMemo(
    () => streams.reduce((acc, s) => {
      const m = tokenFor(TOKEN_LIST, s.token);
      return acc + parseFloat(formatUnits(s.amountPerSec * 2592000n, m.decimals));
    }, 0),
    [streams, TOKEN_LIST],
  );

  const { data: currentBlock } = useBlockNumber();
  const { events, isLoading: txLoading } = useTransactionHistory(address, "payee");
  const txReady = currentBlock != null;

  const generatedAt = useMemo(
    () => new Date().toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }),
    [],
  );

  // Symbol shown next to the monthly rate. Uses the first stream's token (payroll
  // is almost always single-token) instead of the old hardcoded "USDm".
  const primarySymbol = streams.length
    ? tokenFor(TOKEN_LIST, streams[0].token).symbol
    : TOKEN_LIST[0]?.symbol ?? "—";

  // Approximate calendar date of a tx from its block height (Celo ≈ 1 block/sec).
  // A dated statement reads better than "3d ago", which goes stale once the PDF
  // is saved and viewed weeks later.
  const txDate = (blockNumber: bigint): string => {
    if (currentBlock == null || now === 0) return "—";
    const delta =
      currentBlock >= blockNumber ? Number(currentBlock - blockNumber) : 0;
    return fmtDate(now - delta);
  };

  // CSV export of the transaction history — for accounting / bookkeeping import,
  // complementing the human-readable PDF. Pure client-side Blob download.
  function handleCsvExport() {
    if (!events.length) return;
    const header = ["Date", "Type", "Amount", "Token", "Transaction Hash"];
    const dataRows = events.map((ev) => {
      const m = tokenFor(TOKEN_LIST, ev.tokenAddress);
      const amount =
        "amount" in ev
          ? parseFloat(formatUnits(ev.amount, m.decimals)).toString()
          : "";
      const token = "amount" in ev ? m.symbol : "";
      return [txDate(ev.blockNumber), eventLabel(ev.kind), amount, token, ev.txHash];
    });
    const body = [header, ...dataRows]
      .map((row) => row.map((cell) => csvCell(String(cell))).join(","))
      .join("\r\n");
    // Leading BOM so Excel opens the UTF-8 file with correct encoding.
    const BOM = String.fromCharCode(0xfeff);
    const blob = new Blob([BOM + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `trickle-payslip-${address?.slice(0, 6) ?? "wallet"}-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (!isConnected || !address) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-5 pt-8">
        <button
          onClick={() => router.back()}
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={13} /> Back
        </button>
        <ConnectWalletPrompt
          eyebrow="Sign in required"
          title="Connect to generate payslip"
          body="Connect your wallet to export your earnings statement."
        />
      </div>
    );
  }

  return (
    <>
      {/* Screen-only controls */}
      <div className="mx-auto w-full max-w-[680px] px-5 pt-10 print:hidden">
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-mute)] hover:text-[var(--fg)] transition-colors"
          >
            <ArrowLeft size={13} /> Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCsvExport}
              disabled={!events.length}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileSpreadsheet size={13} />
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--fg)] px-4 py-2 text-[13px] font-semibold text-[var(--bg)] transition-opacity hover:opacity-80"
            >
              <Download size={13} />
              Export PDF
            </button>
          </div>
        </div>
        <p className="mb-4 text-[12px] text-[var(--fg-faint)]">
          <span className="font-medium text-[var(--fg-mute)]">PDF</span> — printable statement (browser Print → Save as PDF).{" "}
          <span className="font-medium text-[var(--fg-mute)]">CSV</span> — transaction history for accounting / spreadsheets.
        </p>
        {employeeName && !cleared && primaryPayer && (
          <button
            onClick={() =>
              doClear({
                address: STREAM_REGISTRY_ADDRESS,
                abi: STREAM_REGISTRY_ABI,
                functionName: "clearMyEmployment",
                args: [primaryPayer],
              })
            }
            disabled={clearing}
            className="mb-4 text-[12px] text-[var(--fg-mute)] underline transition-colors hover:text-[var(--fg)] disabled:opacity-50"
          >
            {clearing ? "Hiding…" : "Hide my name from this payslip"}
          </button>
        )}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-faint)] mb-1.5">
            Employer name (appears on payslip)
          </label>
          <input
            type="text"
            value={employerName}
            onChange={(e) => {
              setEmployerName(e.target.value);
              localStorage.setItem("trickle_employer_name", e.target.value);
            }}
            placeholder="e.g. Acme Corp, PT Maju Bersama"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--accent-3)] transition-colors"
          />
        </div>
      </div>

      {/* Payslip document */}
      <div
        id="payslip"
        className="mx-auto w-full max-w-[680px] px-5 pt-4 pb-12 print:max-w-none print:px-10 print:pt-10 print:pb-0"
      >
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-5 mb-6 print:border-gray-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Trickle"
                width={40}
                height={40}
                className="rounded-xl object-contain"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 print:text-gray-500">
                  Income Statement
                </p>
                <h1 className="mt-1 text-[26px] font-bold leading-tight text-[var(--fg)] print:text-black">
                  Trickle Payslip
                </h1>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-400 print:text-gray-500">Generated</p>
              <p className="text-[12px] font-medium text-[var(--fg)] print:text-black">{generatedAt}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {displayEmployerName && (
              <div className="rounded-lg bg-gray-50 dark:bg-white/5 px-4 py-3 print:bg-gray-50 print:border print:border-gray-200">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 print:text-gray-500 mb-1">
                  Employer
                  {verifiedEmployerName && (
                    <span className="ml-1.5 normal-case tracking-normal text-[var(--success,#16a34a)]">
                      · verified on-chain
                    </span>
                  )}
                </p>
                <p className="text-[13px] font-semibold text-[var(--fg)] print:text-black">
                  {displayEmployerName}
                </p>
                {employeeName && (
                  <p className="mt-1 text-[12px] text-[var(--fg-mute)] print:text-gray-600">
                    {employeeName}{employeeRole ? ` · ${employeeRole}` : ""}
                  </p>
                )}
              </div>
            )}
            <div className={`rounded-lg bg-gray-50 dark:bg-white/5 px-4 py-3 print:bg-gray-50 print:border print:border-gray-200 ${displayEmployerName ? "" : "sm:col-span-2"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 print:text-gray-500 mb-1">
                Recipient wallet
              </p>
              <p className="font-mono text-[13px] text-[var(--fg)] print:text-black break-all">
                {address}
              </p>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-8 print:gap-4">
          {[
            { label: "Active streams", value: String(streams.length) },
            {
              label: "Monthly rate",
              value: totalMonthly > 0
                ? `${totalMonthly.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${primarySymbol}`
                : "—",
            },
            { label: "Since", value: streams.length ? fmtDate(Math.min(...streams.map(s => s.startTime))) : "—" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 print:border-gray-300"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 print:text-gray-500">
                {label}
              </p>
              <p className="mt-1 text-[16px] font-bold text-[var(--fg)] print:text-black">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Streams */}
        {streams.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 print:text-gray-500">
              Active Streams
            </h2>
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 print:border-gray-300">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 print:border-gray-300 bg-gray-50 dark:bg-white/5 print:bg-gray-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 print:text-gray-600">From (payer)</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-500 print:text-gray-600">Monthly rate</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-500 print:text-gray-600">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {streams.map((s, i) => {
                    const m = tokenFor(TOKEN_LIST, s.token);
                    return (
                      <tr
                        key={i}
                        className="border-b last:border-0 border-gray-100 dark:border-gray-800 print:border-gray-200"
                      >
                        <td className="px-4 py-3 font-mono text-[11.5px] text-[var(--fg)] print:text-black">
                          {s.payer.slice(0, 10)}…{s.payer.slice(-8)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[var(--fg)] print:text-black">
                          {fmtMonth(TOKEN_LIST, s)} {m.symbol}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 print:text-gray-600">
                          {fmtDate(s.startTime)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Transaction history */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 print:text-gray-500">
            Transaction History
          </h2>
          {txLoading || !txReady ? (
            <p className="text-[13px] text-gray-400 print:text-gray-500">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-[13px] text-gray-400 print:text-gray-500">No recent transactions.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 print:border-gray-300">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 print:border-gray-300 bg-gray-50 dark:bg-white/5 print:bg-gray-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 print:text-gray-600">Type</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-500 print:text-gray-600">Amount</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-500 print:text-gray-600">Date</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-500 print:text-gray-600 print:hidden">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => {
                    const m = tokenFor(TOKEN_LIST, ev.tokenAddress);
                    const label = eventLabel(ev.kind);
                    const amount =
                      "amount" in ev
                        ? `${parseFloat(formatUnits(ev.amount, m.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${m.symbol}`
                        : "—";

                    return (
                      <tr
                        key={i}
                        className="border-b last:border-0 border-gray-100 dark:border-gray-800 print:border-gray-200"
                      >
                        <td className="px-4 py-3 text-[var(--fg)] print:text-black">{label}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--fg)] print:text-black">
                          {amount}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 print:text-gray-600">
                          {txDate(ev.blockNumber)}
                        </td>
                        <td className="px-4 py-3 text-right print:hidden">
                          <a
                            href={`${explorerUrl}/tx/${ev.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
                          >
                            <ExternalLink size={11} />
                            View
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Footer */}
        <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-4 print:border-gray-300">
          <p className="text-[11px] text-gray-400 print:text-gray-500">
            Generated by Trickle · https://trickle-black.vercel.app · Celo Mainnet
          </p>
          <p className="text-[10px] text-gray-300 print:text-gray-400 mt-1">
            This document reflects on-chain data from the TrickleVault contract. Amounts shown are based on blockchain records and may be used as proof of income.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          nav, header { display: none !important; }
          /* Keep table rows whole across page breaks and repeat the header row
             at the top of each printed page so multi-page statements stay readable. */
          tr { break-inside: avoid; }
          thead { display: table-header-group; }
          h2 { break-after: avoid; }
          @page { margin: 16mm; }
        }
      `}</style>
    </>
  );
}
