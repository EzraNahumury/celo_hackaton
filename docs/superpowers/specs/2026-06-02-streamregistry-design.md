# StreamRegistry — Design Spec

**Date:** 2026-06-02
**Status:** Approved (brainstorming complete)
**Author:** Trickle team + Claude
**Deadline:** Pre-judge ~June 19 (Celo Proof-of-Ship season ends June 22)

## 1. Summary

`StreamRegistry` is a **new, separate** smart contract on Celo mainnet that lets an
employer (the payer of a Trickle salary stream) publish **on-chain payroll metadata** —
their company name, plus each employee's name, role, and a memo. The Trickle payslip
reads this metadata to render a **verifiable on-chain payslip** instead of relying on
client-only `localStorage`.

It is a **companion** contract: it does not touch, modify, or redeploy the existing
`TrickleVault` (`0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05`). TrickleVault's address,
streaming logic, balances, and full transaction history remain untouched.

## 2. Goals / Non-Goals

**Goals**
- Employer-attested, on-chain, verifiable payslip metadata (employer name, employee name, role, memo).
- Fully decentralized: contract is the only backend; frontend reads/writes directly via wagmi/viem.
- Strictly **non-critical**: if the registry is empty or a read fails, the payslip falls back to the wallet address exactly as today. Streaming is never affected.
- Generate Proof-of-Ship signal: Celo Solidity commits, a verified Celo deploy, real on-chain write txs, unique-wallet activity, and a demoable judge story.

**Non-Goals**
- No change to TrickleVault (any kind).
- No real-world identity / KYC binding (employer name is self-asserted; the trust comes from it being the same wallet that pays the stream).
- No off-chain backend, database, or indexer.
- No enumeration of payers/payees on-chain (deliberately omitted — see Security).
- EAS off-chain mirror is an **optional stretch only**, never the source of truth.

## 3. Decision: custom contract (not EAS)

EAS is deployed on Celo, but reading `[payer][payee]` records through EAS requires UID
tracking or a GraphQL indexer, which fights the `useReadContract` model and the no-infra
requirement. A ~70-line mapping contract gives O(1) free reads, the same on-chain-tx
scoring upside, and stays fully decoupled from TrickleVault.

## 4. Data Model

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

struct Employment { string name; string role; string memo; }

mapping(address => string) private _employerName;                       // payer => company name
mapping(address => mapping(address => Employment)) private _employment; // payer => payee => record
mapping(address => mapping(address => bool)) public payeeCleared;        // payer => payee => suppressed by payee
```

Storage mappings are the **source of truth** (events-only can't be read by
`useReadContract`, and `getLogs` reconstruction is fragile on public Celo RPCs). Every
write **also emits an event** as a free audit/index trail — additive, not the read path.

**Length caps** (revert with a clear message; short strings stay in a single slot ≤31 bytes):
- `name` (employer & employee): ≤ 32 bytes
- `role`: ≤ 32 bytes
- `memo`: ≤ 64 bytes

## 5. Contract Interface

```solidity
// --- writes (gas txs) ---
function setEmployerName(string calldata name) external;
function setEmployment(address payee, string calldata name, string calldata role, string calldata memo) external;
function clearMyEmployment(address payer) external;          // payee suppresses a claim about itself

// --- reads (free) ---
function getEmployerName(address payer) external view returns (string memory);
function getEmployment(address payer, address payee)
    external view returns (string memory name, string memory role, string memory memo);
function payeeCleared(address payer, address payee) external view returns (bool); // auto-getter

// --- events ---
event EmployerNameSet(address indexed payer, string name);
event EmploymentSet(address indexed payer, address indexed payee, string name, string role, string memo);
event EmploymentCleared(address indexed payer, address indexed payee);
```

## 6. Access Control & Security

- **The mapping key IS the authorization.** All employer writes are keyed by `msg.sender`;
  `payer` is never a parameter, so a caller can only ever write their own namespace. No
  `require(msg.sender == payer)` is needed or possible. No `Ownable`, pause, proxy, or
  admin keys — the contract is immutable and cannot be weaponized.
- **Last-write-wins** for the payer (name/role corrections are normal). `employerName` is
  freely updatable (no "set once" enforcement — zero cost reason to restrict).
- **Payee dispute right:** `clearMyEmployment(payer)` sets `payeeCleared[payer][msg.sender] = true`;
  the frontend then hides the label. Honest limitation: this suppresses *display*, it does
  not erase chain history.
- **Input guards:** `payee != address(0)`, `payee != msg.sender`, and the length caps above.
- **Front-running:** harmless — a caller can only write its own namespace; no value to
  extract and last-write-wins makes ordering irrelevant. No mitigation needed.
- **No enumeration arrays.** Pure mappings only. Adding `address[] allPayers` or
  `payee => payer[]` would convert cheap self-funded spam into a real gas-DoS. The frontend
  discovers `(payer, payee)` pairs from TrickleVault stream events instead.
- **Privacy (required, not optional):** names/memos are **public and permanent** — `delete`
  zeroes the live slot but the value survives in history/logs/archive nodes. On-chain
  labeling is **opt-in** with a signing-time UI disclaimer: *"This name is published
  publicly and permanently on Celo and cannot be deleted."* Setters carry a NatSpec
  `@notice` saying the same. (Production-only path, out of scope: store a hash/commitment.)

## 7. Relationship to TrickleVault

**Fully independent — no cross-contract read.** Gating writes on an active TrickleVault
stream would couple a non-critical contract to the critical one, break the legitimate
"label before funding" and "payslip after a cancelled stream" cases, and not even stop
spam (a griefer can open a 1-wei stream). Stream-relevance is enforced in the **display
layer**: the payslip only renders a label when the registry `payer` matches the actual
on-chain stream payer for that payee.

## 8. Frontend Integration (fe_trickle)

- **Employer — company name:** employer dashboard/settings action "Set your company name
  on-chain" → `setEmployerName`. Show the permanence disclaimer + explicit consent before signing.
- **Employer — per-employee labels:** on the employer's stream/employee row, an "Add
  payslip details" action → `setEmployment(payee, name, role, memo)`. Same disclaimer.
- **Payslip read** (existing payslip/PDF path) via `useReadContract`:
  - `getEmployerName(streamPayer)` → header employer name.
  - `getEmployment(streamPayer, connectedPayee)` → employee name / role / memo lines.
  - `payeeCleared(payer, payee)` true → suppress the employee label.
  - Show a "✓ verified on-chain" indicator when a label is present.
- **Graceful fallback (non-negotiable):** empty string or read failure → truncated wallet
  address (today's behavior). Only render a label when registry `payer` == actual stream
  payer for that payee. The registry must never block the payslip from rendering.
- **Existing localStorage employer-name** stays as an instant offline fallback; on-chain
  value takes precedence when present.
- **Payee clear (optional UI):** employee-side "Hide my name from this payslip" → `clearMyEmployment(payer)`.

## 9. Deploy & Verify (Celo mainnet 42220)

`foundry.toml` additions:
```toml
[profile.default]
solc = "0.8.20"
optimizer = true
optimizer_runs = 200
evm_version = "paris"

[etherscan]
celo = { key = "${ETHERSCAN_API_KEY}", chain = 42220 }
```

Env (PowerShell):
```powershell
$env:ETHERSCAN_API_KEY = "<etherscan.io key>"   # single Etherscan V2 key works for Celo
$env:PRIVATE_KEY       = "0x<deployer key>"      # deployer wallet, ~0.1 CELO funded
```

Mirror the existing `Deploy.s.sol` pattern (reads `PRIVATE_KEY`, saves address to
`deployments/<chainId>.json`). Add a `DeployStreamRegistry.s.sol` script.

Verify on Celoscan via Etherscan V2 (`forge verify-contract --chain-id 42220
--etherscan-api-key $env:ETHERSCAN_API_KEY`). Do **not** hardcode the deprecated
`api.celoscan.io/api` verifier URL. Pay gas in native CELO (no `--fee-currency`). Keep
solc/optimizer identical between deploy and verify.

**Dry-run on Celo Sepolia (11142220, RPC `https://forno.celo-sepolia.celo-testnet.org/`) first.**
Deploy cost ≤ ~0.02 CELO; the funder `0x5682c0FF0ba3E6B0d78755c4684aEc5EA05c2a6F` can be the deployer.

## 10. Testing

Mirror `test/TrickleVault.t.sol` (Foundry). Cover:
- `setEmployerName` / `getEmployerName` round-trip; overwrite.
- `setEmployment` / `getEmployment` round-trip; overwrite; per-(payer,payee) isolation.
- Namespace isolation: wallet A cannot write into wallet B's records.
- Length-cap reverts (name/role > 32B, memo > 64B) and input guards (`payee == 0`, `payee == self`).
- `clearMyEmployment` sets the flag; only the payee can clear their own.
- Events emitted with correct args.

## 11. Proof-of-Ship Scoring Map

- **Celo GitHub commits:** new `StreamRegistry.sol` + tests + deploy script + frontend
  wiring = a clean batch of commits in the (now Celo-topic-tagged) repo.
- **Onchain txs:** every `setEmployerName` / `setEmployment` / `clearMyEmployment` is a
  real Celo tx (~$0.001). The funded wallet batches can attest records to grow tx count.
- **Unique wallets:** spreading attestations across employer/employee wallets raises the
  unique-wallet count and improves the flagged tx/wallet ratio.
- **Judge appeal:** "your payslip is verifiable on-chain" is a concrete, demoable story;
  verified source on Celoscan is credible; the privacy-consent disclaimer is responsible-design polish.

## 12. Risks / Flags for June 19

- **Never add enumeration arrays** — biggest footgun (self-spam → gas-DoS). Pure mappings.
- **Privacy disclaimer is required** — ship the UI consent text with the first write path.
- **Dry-run on Sepolia** before mainnet to avoid burning the demo window on a verify mismatch.
- **Keep the registry strictly non-critical** — any read failure must fall through to the
  address; never block payslip render.
- **EAS off-chain mirror is stretch-only** — skip if time is tight.

## 13. Out of Scope (this spec)

- EAS off-chain attestation mirror (optional stretch).
- Hash/commitment privacy mode (production-only).
- On-chain enumeration / directory of employers or employees.
- Any TrickleVault modification.
