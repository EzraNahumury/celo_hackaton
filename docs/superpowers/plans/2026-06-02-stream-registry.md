# StreamRegistry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new, separate `StreamRegistry` contract on Celo + frontend integration so Trickle payslips show employer-attested, on-chain-verifiable metadata — without touching TrickleVault.

**Architecture:** A ~60-line mapping contract keyed by `msg.sender` (employer). Reads are free via wagmi `useReadContract`; writes are Celo txs. The frontend payslip reads labels and falls back gracefully to the wallet address. Fully decoupled from TrickleVault.

**Tech Stack:** Solidity 0.8.20 + Foundry (sc_trickle), Next.js 15 + wagmi/viem (fe_trickle), Celo mainnet 42220.

**Spec:** `docs/superpowers/specs/2026-06-02-streamregistry-design.md`

**Branch:** `feat/stream-registry` (already created). Commit per task. Phase A → PR + merge → deploy → Phase B.

**Phase dependency:** Phase B (frontend) needs the deployed address from Task 6. Do Phase A fully first.

---

## Phase A — Contract + Deploy (sc_trickle)

### Task 1: StreamRegistry contract — employer name

**Files:**
- Create: `sc_trickle/src/StreamRegistry.sol`
- Create: `sc_trickle/test/StreamRegistry.t.sol`

- [ ] **Step 1: Write the failing test**

`sc_trickle/test/StreamRegistry.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {StreamRegistry} from "../src/StreamRegistry.sol";

contract StreamRegistryTest is Test {
    StreamRegistry public reg;

    address employer = makeAddr("employer");
    address employer2 = makeAddr("employer2");
    address employee = makeAddr("employee");
    address employee2 = makeAddr("employee2");

    function setUp() public {
        reg = new StreamRegistry();
    }

    // ── Employer name ────────────────────────────
    function test_setEmployerName() public {
        vm.prank(employer);
        reg.setEmployerName("Acme Corp");
        assertEq(reg.getEmployerName(employer), "Acme Corp");
    }

    function test_getEmployerName_empty() public view {
        assertEq(reg.getEmployerName(employer), "");
    }

    function test_setEmployerName_overwrite() public {
        vm.startPrank(employer);
        reg.setEmployerName("Acme Corp");
        reg.setEmployerName("Acme Inc");
        vm.stopPrank();
        assertEq(reg.getEmployerName(employer), "Acme Inc");
    }

    function test_employerName_isolatedByCaller() public {
        vm.prank(employer);
        reg.setEmployerName("Acme Corp");
        assertEq(reg.getEmployerName(employer2), "");
    }
}
```

- [ ] **Step 2: Run test to verify it fails (no contract yet)**

Run: `cd sc_trickle && forge test --match-contract StreamRegistryTest`
Expected: FAIL — compile error, `StreamRegistry` not found.

- [ ] **Step 3: Write minimal contract**

`sc_trickle/src/StreamRegistry.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title StreamRegistry — on-chain employer-attested payroll metadata for Trickle
/// @notice Companion to TrickleVault. Writes are keyed by msg.sender, so a caller can
///         only ever write its own records. Fully independent of TrickleVault.
/// @dev PRIVACY: names/memos are PUBLIC and PERMANENT on-chain. Values persist in
///      history/logs/archive nodes. Surface a consent disclaimer in any UI before writing.
contract StreamRegistry {
    struct Employment {
        string name;
        string role;
        string memo;
    }

    mapping(address => string) private _employerName;                       // payer => company name
    mapping(address => mapping(address => Employment)) private _employment; // payer => payee => record
    mapping(address => mapping(address => bool)) public payeeCleared;        // payer => payee => suppressed

    uint256 private constant MAX_NAME = 32;
    uint256 private constant MAX_ROLE = 32;
    uint256 private constant MAX_MEMO = 64;

    event EmployerNameSet(address indexed payer, string name);
    event EmploymentSet(address indexed payer, address indexed payee, string name, string role, string memo);
    event EmploymentCleared(address indexed payer, address indexed payee);

    /// @notice Set the caller's company name. Published PUBLICLY and PERMANENTLY on Celo.
    function setEmployerName(string calldata name) external {
        require(bytes(name).length <= MAX_NAME, "name too long");
        _employerName[msg.sender] = name;
        emit EmployerNameSet(msg.sender, name);
    }

    function getEmployerName(address payer) external view returns (string memory) {
        return _employerName[payer];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd sc_trickle && forge test --match-contract StreamRegistryTest -vv`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add sc_trickle/src/StreamRegistry.sol sc_trickle/test/StreamRegistry.t.sol
git commit -m "feat(sc): StreamRegistry employer name (setEmployerName/getEmployerName)"
```

---

### Task 2: Employment records (set/get + isolation)

**Files:**
- Modify: `sc_trickle/src/StreamRegistry.sol`
- Modify: `sc_trickle/test/StreamRegistry.t.sol`

- [ ] **Step 1: Add failing tests**

Append to `StreamRegistryTest`:
```solidity
    // ── Employment record ────────────────────────
    function test_setEmployment() public {
        vm.prank(employer);
        reg.setEmployment(employee, "Jane Doe", "Engineer", "Payroll Q2");
        (string memory name, string memory role, string memory memo) = reg.getEmployment(employer, employee);
        assertEq(name, "Jane Doe");
        assertEq(role, "Engineer");
        assertEq(memo, "Payroll Q2");
    }

    function test_getEmployment_empty() public view {
        (string memory name, string memory role, string memory memo) = reg.getEmployment(employer, employee);
        assertEq(name, "");
        assertEq(role, "");
        assertEq(memo, "");
    }

    function test_setEmployment_overwrite() public {
        vm.startPrank(employer);
        reg.setEmployment(employee, "Jane Doe", "Engineer", "");
        reg.setEmployment(employee, "Jane Doe", "Senior Engineer", "promo");
        vm.stopPrank();
        (, string memory role,) = reg.getEmployment(employer, employee);
        assertEq(role, "Senior Engineer");
    }

    function test_employment_isolatedByCaller() public {
        vm.prank(employer);
        reg.setEmployment(employee, "Jane Doe", "Engineer", "");
        // employer2 has written nothing for the same payee
        (string memory name,,) = reg.getEmployment(employer2, employee);
        assertEq(name, "");
    }

    function test_employment_perPayee() public {
        vm.startPrank(employer);
        reg.setEmployment(employee, "Jane", "Eng", "");
        reg.setEmployment(employee2, "Bob", "Design", "");
        vm.stopPrank();
        (string memory n1,,) = reg.getEmployment(employer, employee);
        (string memory n2,,) = reg.getEmployment(employer, employee2);
        assertEq(n1, "Jane");
        assertEq(n2, "Bob");
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd sc_trickle && forge test --match-contract StreamRegistryTest`
Expected: FAIL — `setEmployment` / `getEmployment` not defined.

- [ ] **Step 3: Implement**

Add to `StreamRegistry.sol` (after `getEmployerName`):
```solidity
    /// @notice Attest an employment record about `payee`. Caller is the employer.
    ///         Published PUBLICLY and PERMANENTLY on Celo.
    function setEmployment(
        address payee,
        string calldata name,
        string calldata role,
        string calldata memo
    ) external {
        require(payee != address(0), "zero payee");
        require(payee != msg.sender, "self payee");
        require(bytes(name).length <= MAX_NAME, "name too long");
        require(bytes(role).length <= MAX_ROLE, "role too long");
        require(bytes(memo).length <= MAX_MEMO, "memo too long");
        _employment[msg.sender][payee] = Employment(name, role, memo);
        emit EmploymentSet(msg.sender, payee, name, role, memo);
    }

    function getEmployment(address payer, address payee)
        external
        view
        returns (string memory name, string memory role, string memory memo)
    {
        Employment storage e = _employment[payer][payee];
        return (e.name, e.role, e.memo);
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd sc_trickle && forge test --match-contract StreamRegistryTest -vv`
Expected: PASS (all tests so far).

- [ ] **Step 5: Commit**

```bash
git add sc_trickle/src/StreamRegistry.sol sc_trickle/test/StreamRegistry.t.sol
git commit -m "feat(sc): StreamRegistry employment records (setEmployment/getEmployment)"
```

---

### Task 3: Input guards + length caps (revert tests)

**Files:**
- Modify: `sc_trickle/test/StreamRegistry.t.sol`

The guards already exist (Task 2). This task adds the revert tests that lock them in.

- [ ] **Step 1: Add failing tests**

Append:
```solidity
    // ── Guards ───────────────────────────────────
    function test_setEmployment_revert_zeroPayee() public {
        vm.prank(employer);
        vm.expectRevert("zero payee");
        reg.setEmployment(address(0), "x", "y", "z");
    }

    function test_setEmployment_revert_selfPayee() public {
        vm.prank(employer);
        vm.expectRevert("self payee");
        reg.setEmployment(employer, "x", "y", "z");
    }

    function test_setEmployment_revert_nameTooLong() public {
        vm.prank(employer);
        vm.expectRevert("name too long");
        reg.setEmployment(employee, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "y", "z"); // 33 chars
    }

    function test_setEmployment_revert_roleTooLong() public {
        vm.prank(employer);
        vm.expectRevert("role too long");
        reg.setEmployment(employee, "x", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "z"); // 33 chars
    }

    function test_setEmployment_revert_memoTooLong() public {
        vm.prank(employer);
        // 65 chars
        vm.expectRevert("memo too long");
        reg.setEmployment(employee, "x", "y", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    }

    function test_setEmployerName_revert_tooLong() public {
        vm.prank(employer);
        vm.expectRevert("name too long");
        reg.setEmployerName("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); // 33 chars
    }
```

- [ ] **Step 2: Run to verify it passes** (guards already implemented in Task 2)

Run: `cd sc_trickle && forge test --match-contract StreamRegistryTest -vv`
Expected: PASS. If any revert test fails, fix the matching `require` message in `StreamRegistry.sol` to match exactly.

- [ ] **Step 3: Commit**

```bash
git add sc_trickle/test/StreamRegistry.t.sol
git commit -m "test(sc): StreamRegistry input-guard and length-cap reverts"
```

---

### Task 4: Payee clear (dispute/suppress)

**Files:**
- Modify: `sc_trickle/src/StreamRegistry.sol`
- Modify: `sc_trickle/test/StreamRegistry.t.sol`

- [ ] **Step 1: Add failing tests**

Append:
```solidity
    // ── Payee clear ──────────────────────────────
    function test_clearMyEmployment() public {
        vm.prank(employer);
        reg.setEmployment(employee, "Jane", "Eng", "");
        assertEq(reg.payeeCleared(employer, employee), false);

        vm.prank(employee);
        reg.clearMyEmployment(employer);
        assertEq(reg.payeeCleared(employer, employee), true);
    }

    function test_clearMyEmployment_isolatedByCaller() public {
        // Only the payee (msg.sender) can set their own cleared flag.
        vm.prank(employee);
        reg.clearMyEmployment(employer);
        assertEq(reg.payeeCleared(employer, employee), true);
        assertEq(reg.payeeCleared(employer, employee2), false);
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd sc_trickle && forge test --match-contract StreamRegistryTest`
Expected: FAIL — `clearMyEmployment` not defined.

- [ ] **Step 3: Implement**

Add to `StreamRegistry.sol`:
```solidity
    /// @notice Payee suppresses an employer's claim about them (display-only;
    ///         does not erase on-chain history).
    function clearMyEmployment(address payer) external {
        payeeCleared[payer][msg.sender] = true;
        emit EmploymentCleared(payer, msg.sender);
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd sc_trickle && forge test --match-contract StreamRegistryTest -vv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sc_trickle/src/StreamRegistry.sol sc_trickle/test/StreamRegistry.t.sol
git commit -m "feat(sc): StreamRegistry payee clear (clearMyEmployment)"
```

---

### Task 5: Event assertions

**Files:**
- Modify: `sc_trickle/test/StreamRegistry.t.sol`

- [ ] **Step 1: Add failing tests**

Append (declare the events locally to use `vm.expectEmit`):
```solidity
    event EmployerNameSet(address indexed payer, string name);
    event EmploymentSet(address indexed payer, address indexed payee, string name, string role, string memo);
    event EmploymentCleared(address indexed payer, address indexed payee);

    function test_emit_employerNameSet() public {
        vm.expectEmit(true, false, false, true);
        emit EmployerNameSet(employer, "Acme Corp");
        vm.prank(employer);
        reg.setEmployerName("Acme Corp");
    }

    function test_emit_employmentSet() public {
        vm.expectEmit(true, true, false, true);
        emit EmploymentSet(employer, employee, "Jane", "Eng", "memo");
        vm.prank(employer);
        reg.setEmployment(employee, "Jane", "Eng", "memo");
    }

    function test_emit_employmentCleared() public {
        vm.expectEmit(true, true, false, false);
        emit EmploymentCleared(employer, employee);
        vm.prank(employee);
        reg.clearMyEmployment(employer);
    }
```

- [ ] **Step 2: Run to verify it passes** (events already emitted in earlier tasks)

Run: `cd sc_trickle && forge test --match-contract StreamRegistryTest -vv`
Expected: PASS (full suite green).

- [ ] **Step 3: Commit**

```bash
git add sc_trickle/test/StreamRegistry.t.sol
git commit -m "test(sc): StreamRegistry event emission assertions"
```

---

### Task 6: Deploy script + Celo config

**Files:**
- Create: `sc_trickle/script/DeployStreamRegistry.s.sol`
- Modify: `sc_trickle/foundry.toml`

- [ ] **Step 1: Add the etherscan profile to foundry.toml**

Append to `sc_trickle/foundry.toml` (after the existing `[rpc_endpoints]` block):
```toml
[etherscan]
celo = { key = "${ETHERSCAN_API_KEY}", chain = 42220 }
```

Also add `evm_version = "paris"` under `[profile.default]` if not present.

- [ ] **Step 2: Write the deploy script** (mirrors existing `Deploy.s.sol`)

`sc_trickle/script/DeployStreamRegistry.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {StreamRegistry} from "../src/StreamRegistry.sol";

contract DeployStreamRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer  :", deployer);
        console.log("Chain ID  :", block.chainid);

        vm.startBroadcast(deployerPrivateKey);
        StreamRegistry reg = new StreamRegistry();
        vm.stopBroadcast();

        console.log("StreamRegistry deployed at:", address(reg));

        string memory chainId = vm.toString(block.chainid);
        string memory file = string.concat("deployments/streamregistry-", chainId, ".json");
        string memory json = string.concat(
            '{\n  "chainId": ', chainId,
            ',\n  "StreamRegistry": "', vm.toString(address(reg)), '"\n}\n'
        );
        vm.writeFile(file, json);
        console.log("Deployment saved to:", file);
    }
}
```

- [ ] **Step 3: Build to verify it compiles**

Run: `cd sc_trickle && forge build`
Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add sc_trickle/script/DeployStreamRegistry.s.sol sc_trickle/foundry.toml
git commit -m "feat(sc): StreamRegistry deploy script + Celo etherscan config"
```

- [ ] **Step 5: Dry-run on Celo Sepolia first**

Set env (PowerShell), using the funder key as deployer (it has CELO; ensure it has Sepolia CELO from a faucet, or use any funded testnet key):
```powershell
$env:PRIVATE_KEY = "0x<deployer key>"
forge script script/DeployStreamRegistry.s.sol:DeployStreamRegistry `
  --rpc-url https://forno.celo-sepolia.celo-testnet.org/ --broadcast
```
Expected: prints a deployed address; `deployments/streamregistry-11142220.json` written.

- [ ] **Step 6: Deploy to Celo mainnet + verify**

```powershell
$env:PRIVATE_KEY       = "0x<deployer key>"     # funder 0x5682c0… (~0.1 CELO is plenty)
$env:ETHERSCAN_API_KEY = "<etherscan.io key>"
forge script script/DeployStreamRegistry.s.sol:DeployStreamRegistry `
  --rpc-url celo --broadcast --verify
```
Expected: deployed to mainnet (42220), source verified on Celoscan, `deployments/streamregistry-42220.json` written.
If `--verify` fails, run standalone: `forge verify-contract --chain-id 42220 --etherscan-api-key $env:ETHERSCAN_API_KEY --watch <ADDR> src/StreamRegistry.sol:StreamRegistry`.

- [ ] **Step 7: Record the address + commit deployment artifact**

Note the mainnet address (call it `<DEPLOYED_ADDRESS>` — used in Phase B).
```bash
git add sc_trickle/deployments/streamregistry-42220.json
git commit -m "chore(sc): record StreamRegistry mainnet deployment address"
```

- [ ] **Step 8: Open PR for Phase A and merge**

```bash
git push -u origin feat/stream-registry
gh pr create --title "feat: StreamRegistry contract + Celo deploy" --body "New companion contract for on-chain employer-attested payslip metadata. Does NOT touch TrickleVault. Full Foundry test suite, deployed + verified on Celo mainnet. Spec: docs/superpowers/specs/2026-06-02-streamregistry-design.md"
gh pr merge --squash
```
(Keep working from `feat/stream-registry` for Phase B, or branch off main after merge.)

---

## Phase B — Frontend Integration (fe_trickle)

> No FE test framework in this repo. "Verify" = `rtk tsc` (typecheck) + `rtk next build` (production build) + manual check. Each task ends with typecheck/build before commit.

### Task 7: Add StreamRegistry ABI + address to config

**Files:**
- Modify: `fe_trickle/config/contracts.ts`

- [ ] **Step 1: Append the ABI + address constant**

Add to `fe_trickle/config/contracts.ts` (after `TRICKLE_VAULT_ABI`):
```ts
// StreamRegistry — companion contract for on-chain payslip metadata (see spec).
// Replace the fallback with the deployed mainnet address from Phase A Task 6.
export const STREAM_REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_STREAM_REGISTRY_ADDRESS ??
  "<DEPLOYED_ADDRESS>"
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
] as const;
```

- [ ] **Step 2: Typecheck**

Run: `cd fe_trickle && rtk tsc`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/config/contracts.ts
git commit -m "feat(fe): add StreamRegistry ABI + address"
```

---

### Task 8: Payslip reads on-chain employer/employee labels (graceful fallback)

**Files:**
- Modify: `fe_trickle/app/employee/payslip/page.tsx`

The payslip already shows the streams' payer addresses and an `employerName` from localStorage. Add on-chain reads that take precedence, with fallback.

- [ ] **Step 1: Read the registry for the primary stream's payer + connected payee**

In `payslip/page.tsx`, import the registry constants and add reads after `streams` is computed:
```ts
import { TRICKLE_VAULT_ABI, STREAM_REGISTRY_ABI, STREAM_REGISTRY_ADDRESS } from "@/config/contracts";
```
```ts
// Primary payer = the payer of the first stream (single-employer is the common case).
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

const { data: cleared } = useReadContract({
  address: STREAM_REGISTRY_ADDRESS,
  abi: STREAM_REGISTRY_ABI,
  functionName: "payeeCleared",
  args: primaryPayer && address ? [primaryPayer, address] : undefined,
  query: { enabled: !!primaryPayer && !!address },
});

// On-chain value wins; fall back to localStorage name; then nothing.
const verifiedEmployerName =
  (typeof onchainEmployerName === "string" && onchainEmployerName.length > 0)
    ? onchainEmployerName
    : "";
const displayEmployerName = verifiedEmployerName || employerName; // employerName = existing localStorage state
const employeeName = !cleared && Array.isArray(onchainEmployment) ? (onchainEmployment[0] as string) : "";
const employeeRole = !cleared && Array.isArray(onchainEmployment) ? (onchainEmployment[1] as string) : "";
```

- [ ] **Step 2: Render the verified employer + employee details**

In the payslip header's employer box, when `verifiedEmployerName` is present show a "✓ verified on-chain" badge; otherwise render `displayEmployerName` (or fall back to wallet address exactly as today). Add employee name/role lines when present:
```tsx
{displayEmployerName && (
  <div className="rounded-lg bg-gray-50 dark:bg-white/5 px-4 py-3 print:bg-gray-50 print:border print:border-gray-200">
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 print:text-gray-500 mb-1">
      Employer {verifiedEmployerName && <span className="text-[var(--success)]">· verified on-chain</span>}
    </p>
    <p className="text-[13px] font-semibold text-[var(--fg)] print:text-black">{displayEmployerName}</p>
    {employeeName && (
      <p className="mt-1 text-[12px] text-[var(--fg-mute)] print:text-gray-600">
        {employeeName}{employeeRole ? ` · ${employeeRole}` : ""}
      </p>
    )}
  </div>
)}
```
**Graceful fallback (non-negotiable):** if all reads are empty/failed, the existing wallet-address box renders unchanged. Never gate the payslip render on these reads.

- [ ] **Step 3: Typecheck + build**

Run: `cd fe_trickle && rtk tsc` then `rtk next build`
Expected: both clean (0 errors).

- [ ] **Step 4: Commit**

```bash
git add fe_trickle/app/employee/payslip/page.tsx
git commit -m "feat(fe): payslip reads on-chain verified employer/employee labels"
```

---

### Task 9: Employer write — set company name (with permanence disclaimer)

**Files:**
- Create: `fe_trickle/components/SetEmployerNameCard.tsx`
- Modify: `fe_trickle/app/employer/page.tsx`

- [ ] **Step 1: Create the write component**

`fe_trickle/components/SetEmployerNameCard.tsx`:
```tsx
"use client";

import * as React from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { STREAM_REGISTRY_ABI, STREAM_REGISTRY_ADDRESS } from "@/config/contracts";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/Toast";

export function SetEmployerNameCard() {
  const { address } = useAccount();
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [ack, setAck] = React.useState(false);

  const { data: current } = useReadContract({
    address: STREAM_REGISTRY_ADDRESS,
    abi: STREAM_REGISTRY_ABI,
    functionName: "getEmployerName",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  React.useEffect(() => {
    if (isSuccess) toast({ type: "success", message: "Company name set on-chain" });
  }, [isSuccess, toast]);

  const tooLong = new TextEncoder().encode(name).length > 32;

  return (
    <Card padded={false} className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-faint)]">
        Company name {typeof current === "string" && current ? "· on-chain ✓" : ""}
      </p>
      <p className="mt-1 mb-3 text-[12px] text-[var(--fg-mute)]">
        Appears as the verified employer on your team's payslips.
      </p>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={typeof current === "string" && current ? current : "e.g. Acme Corp"} />
      {tooLong && <p className="mt-1 text-[11.5px] text-[var(--danger)]">Max 32 bytes.</p>}
      <label className="mt-3 flex items-start gap-2 text-[11.5px] text-[var(--fg-mute)]">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
        I understand this name is published <strong>publicly and permanently</strong> on Celo and cannot be deleted.
      </label>
      <Button
        shape="pill"
        className="mt-3 w-full"
        disabled={!name || tooLong || !ack || isPending}
        loading={isPending}
        onClick={() =>
          writeContract({
            address: STREAM_REGISTRY_ADDRESS,
            abi: STREAM_REGISTRY_ABI,
            functionName: "setEmployerName",
            args: [name],
          })
        }
      >
        Set company name on-chain
      </Button>
    </Card>
  );
}
```

- [ ] **Step 2: Mount it on the employer dashboard**

In `fe_trickle/app/employer/page.tsx`, import and render `<SetEmployerNameCard />` in the dashboard body (e.g. near the top of the connected view). Add:
```tsx
import { SetEmployerNameCard } from "@/components/SetEmployerNameCard";
```
and place `<SetEmployerNameCard />` inside the connected layout where it fits visually (e.g. above or beside the deposit/withdraw panel).

- [ ] **Step 3: Typecheck + build**

Run: `cd fe_trickle && rtk tsc` then `rtk next build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add fe_trickle/components/SetEmployerNameCard.tsx fe_trickle/app/employer/page.tsx
git commit -m "feat(fe): employer sets company name on-chain (with permanence consent)"
```

---

### Task 10: Employer write — per-employee labels

**Files:**
- Create: `fe_trickle/components/SetEmploymentDialog.tsx`
- Modify: `fe_trickle/app/employer/page.tsx`

- [ ] **Step 1: Create the per-employee label component**

`fe_trickle/components/SetEmploymentDialog.tsx` — a small inline form that takes the payee address and writes `setEmployment`. Mirror the consent + length-cap pattern from `SetEmployerNameCard` (name ≤32B, role ≤32B, memo ≤64B; checkbox consent). Signature:
```tsx
"use client";
import * as React from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { STREAM_REGISTRY_ABI, STREAM_REGISTRY_ADDRESS } from "@/config/contracts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/Toast";

export function SetEmploymentDialog({ payee }: { payee: `0x${string}` }) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [memo, setMemo] = React.useState("");
  const [ack, setAck] = React.useState(false);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  React.useEffect(() => { if (isSuccess) toast({ type: "success", message: "Payslip details saved on-chain" }); }, [isSuccess, toast]);

  const enc = (s: string) => new TextEncoder().encode(s).length;
  const invalid = enc(name) > 32 || enc(role) > 32 || enc(memo) > 64;

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--color-surface)] p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Employee name (≤32)" />
      <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (≤32)" />
      <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo (≤64)" />
      <label className="flex items-start gap-2 text-[11.5px] text-[var(--fg-mute)]">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
        Published <strong>publicly &amp; permanently</strong> on Celo; cannot be deleted.
      </label>
      <Button
        shape="pill" className="w-full" disabled={!name || invalid || !ack || isPending} loading={isPending}
        onClick={() => writeContract({ address: STREAM_REGISTRY_ADDRESS, abi: STREAM_REGISTRY_ABI, functionName: "setEmployment", args: [payee, name, role, memo] })}
      >
        Save payslip details
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Surface it per stream on the employer dashboard**

In `fe_trickle/app/employer/page.tsx`, in the employer's stream list, add a collapsible "Add payslip details" toggle per stream row that renders `<SetEmploymentDialog payee={stream.payee as 0x...} />`. Use existing local `useState` to track which row is open.

- [ ] **Step 3: Typecheck + build**

Run: `cd fe_trickle && rtk tsc` then `rtk next build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add fe_trickle/components/SetEmploymentDialog.tsx fe_trickle/app/employer/page.tsx
git commit -m "feat(fe): employer sets per-employee payslip details on-chain"
```

---

### Task 11: Optional — payee "hide my name" + final PR

**Files:**
- Modify: `fe_trickle/app/employee/payslip/page.tsx`

- [ ] **Step 1: Add a payee clear control (only when a label about them exists)**

In `payslip/page.tsx`, add the write hook near the other reads:
```ts
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"; // already importing useReadContract
const { writeContract: doClear, data: clearHash, isPending: clearing } = useWriteContract();
useWaitForTransactionReceipt({ hash: clearHash }); // triggers refetch via queryClient invalidation on success
```
Then in the screen controls block (the `print:hidden` div), render the button only when there's a label to hide:
```tsx
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
    className="text-[12px] text-[var(--fg-mute)] underline hover:text-[var(--fg)] disabled:opacity-50"
  >
    {clearing ? "Hiding…" : "Hide my name from this payslip"}
  </button>
)}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd fe_trickle && rtk tsc` then `rtk next build`
Expected: clean.

- [ ] **Step 3: Commit + open Phase B PR**

```bash
git add fe_trickle/app/employee/payslip/page.tsx
git commit -m "feat(fe): payee can hide their name from the payslip (clearMyEmployment)"
git push
gh pr create --title "feat(fe): StreamRegistry frontend integration" --body "Reads on-chain verified employer/employee labels on the payslip (graceful fallback to wallet address), employer write UI for company name + per-employee details with permanence consent, and a payee opt-out. Spec: docs/superpowers/specs/2026-06-02-streamregistry-design.md"
gh pr merge --squash
```

---

## Post-implementation

- [ ] Update `fe_trickle` env / Vercel: set `NEXT_PUBLIC_STREAM_REGISTRY_ADDRESS` to the deployed address (or confirm the hardcoded fallback is correct), so production reads the right contract.
- [ ] Optionally seed a few attestations from funded wallets to generate on-chain txs + a demoable payslip (helps Proof-of-Ship metrics).
- [ ] Verify the live payslip shows "verified on-chain" for a seeded employer.

## Notes

- **Never add enumeration arrays** to the contract (gas-DoS footgun).
- The contract is **immutable** — `clearMyEmployment` and all guards must be right before mainnet deploy. The full Foundry suite (Tasks 1-5) must be green first.
- Keep the registry **strictly non-critical** in the frontend: every read is `enabled`-gated and the payslip renders regardless.
