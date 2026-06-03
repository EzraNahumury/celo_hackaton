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
