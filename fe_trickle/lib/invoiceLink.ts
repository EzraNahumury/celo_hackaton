import { isAddress } from "viem";

export type PaymentRequest = {
  to: `0x${string}`;
  amount: string;
  token: string;
  desc?: string;
};

export function buildPaymentRequestUrl(params: PaymentRequest): string {
  const search = new URLSearchParams({
    to: params.to,
    amount: params.amount,
    token: params.token,
  });
  if (params.desc) search.set("desc", params.desc);
  return `/pay?${search.toString()}`;
}

export function parsePaymentRequestUrl(
  params: URLSearchParams,
): PaymentRequest | null {
  const to = params.get("to");
  const amount = params.get("amount");
  const token = params.get("token");

  if (!to || !amount || !token) return null;
  if (!isAddress(to)) return null;
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) return null;

  return {
    to: to as `0x${string}`,
    amount,
    token,
    desc: params.get("desc") ?? undefined,
  };
}
