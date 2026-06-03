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
}
