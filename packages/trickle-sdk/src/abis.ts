/**
 * Contract ABIs for the Trickle protocol, typed `as const` so they compose
 * cleanly with viem / wagmi (full type inference on reads, writes and events).
 */

/** TrickleVault — deposits, per-second streams, withdrawals. */
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
    name: "getPayeeStreamIds",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
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
    name: "Deposit",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
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
] as const;

/** StreamRegistry — optional on-chain payslip attestations (employer-keyed). */
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

/** Minimal ERC-20 ABI (approve/allowance/balanceOf/transfer) for token flows. */
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
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;
