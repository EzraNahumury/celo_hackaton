// TrickleVault live on Celo Mainnet (chain 42220). Sepolia still supported via
// the chain-aware lookup in config/chains.ts — use `useVaultAddress()` in
// components. This constant is the mainnet fallback for non-React code.
// Override either env var to repoint without code changes.
export const TRICKLE_VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS ??
  process.env.NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS_MAINNET ??
  "0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05"
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
