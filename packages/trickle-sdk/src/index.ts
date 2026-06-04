/**
 * trickle-sdk — TypeScript SDK for Trickle, real-time payroll streaming on Celo.
 *
 * @example
 * ```ts
 * import { createPublicClient, http } from "viem";
 * import { celo } from "viem/chains";
 * import {
 *   TRICKLE_VAULT_ADDRESS,
 *   TRICKLE_VAULT_ABI,
 *   ratePerSecToMonthly,
 *   formatAmount,
 * } from "trickle-sdk";
 *
 * const client = createPublicClient({ chain: celo, transport: http() });
 * const ids = await client.readContract({
 *   address: TRICKLE_VAULT_ADDRESS,
 *   abi: TRICKLE_VAULT_ABI,
 *   functionName: "getPayeeStreamIds",
 *   args: ["0xPayee..."],
 * });
 * ```
 */
export * from "./addresses.js";
export * from "./abis.js";
export * from "./helpers.js";
