import { TRICKLE_VAULT_ADDRESS as SDK_TRICKLE_VAULT_ADDRESS } from "trickle-sdk";

// TrickleVault live on Celo Mainnet (chain 42220). Sepolia still supported via
// the chain-aware lookup in config/chains.ts — use `useVaultAddress()` in
// components. This constant is the mainnet fallback for non-React code.
// Mainnet address is sourced from the published trickle-sdk (single source of
// truth); override either env var to repoint without code changes.
export const TRICKLE_VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS ??
  process.env.NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS_MAINNET ??
  SDK_TRICKLE_VAULT_ADDRESS
) as `0x${string}`;

// ABI generated from: forge inspect TrickleVault abi --json
export const TRICKLE_VAULT_ABI = [
  {
    type: "function",
    name: "balances",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "cancelStream",
    inputs: [
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createStream",
    inputs: [
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPayeeStreamCount",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPayeeStreamIds",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPayerStreamCount",
    inputs: [{ name: "payer", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPayerStreamIds",
    inputs: [{ name: "payer", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStream",
    inputs: [{ name: "streamId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "payer", type: "address" },
          { name: "payee", type: "address" },
          { name: "token", type: "address" },
          { name: "amountPerSec", type: "uint216" },
          { name: "lastPaid", type: "uint40" },
          { name: "startTime", type: "uint40" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStreamId",
    inputs: [
      { name: "payer", type: "address" },
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "streams",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "payer", type: "address" },
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
      { name: "lastPaid", type: "uint40" },
      { name: "startTime", type: "uint40" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalPaidPerSec",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "payer", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawBalance",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawable",
    inputs: [
      { name: "payer", type: "address" },
      { name: "payee", type: "address" },
      { name: "token", type: "address" },
      { name: "amountPerSec", type: "uint216" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BalanceWithdrawn",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StreamCancelled",
    inputs: [
      { name: "streamId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StreamCreated",
    inputs: [
      { name: "streamId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amountPerSec", type: "uint216", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "streamId", type: "bytes32", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

// StreamRegistry — companion contract for on-chain employer-attested payslip
// metadata (see docs/superpowers/specs/2026-06-02-streamregistry-design.md).
// Deployed + verified on Celo mainnet (chain 42220). Strictly non-critical: the
// payslip falls back to the wallet address if reads are empty/fail.
export const STREAM_REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_STREAM_REGISTRY_ADDRESS ??
  "0x84D03930631b37Ae71A1b3c6C333ADcD32B88d99"
) as `0x${string}`;

export const STREAM_REGISTRY_ABI = [
  {
    type: "function",
    name: "setEmployerName",
    inputs: [{ name: "name", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setEmployment",
    inputs: [
      { name: "payee", type: "address" },
      { name: "name", type: "string" },
      { name: "role", type: "string" },
      { name: "memo", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "clearMyEmployment",
    inputs: [{ name: "payer", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEmployerName",
    inputs: [{ name: "payer", type: "address" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEmployment",
    inputs: [
      { name: "payer", type: "address" },
      { name: "payee", type: "address" },
    ],
    outputs: [
      { name: "name", type: "string" },
      { name: "role", type: "string" },
      { name: "memo", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "payeeCleared",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "EmployerNameSet",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EmploymentSet",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "role", type: "string", indexed: false },
      { name: "memo", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EmploymentCleared",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
    ],
  },
] as const;
