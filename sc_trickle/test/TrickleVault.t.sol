// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {TrickleVault} from "../src/TrickleVault.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol";

contract TrickleVaultTest is Test {
    TrickleVault public vault;
    ERC20Mock public cUSD;

    address employer = makeAddr("employer");
    address employee = makeAddr("employee");
    address employee2 = makeAddr("employee2");

    uint216 constant RATE = 385802469135802; // ~$1000/month in 18-decimal wei/sec (1000e18 / 2592000)
    uint256 constant DEPOSIT = 10_000e18; // 10,000 tokens

    function setUp() public {
        vault = new TrickleVault();
        cUSD = new ERC20Mock("Celo Dollar", "cUSD", 18);

        cUSD.mint(employer, 100_000e18);

        vm.prank(employer);
        cUSD.approve(address(vault), type(uint256).max);
    }

    // ── Deposit ──────────────────────────────────

    function test_deposit() public {
        vm.prank(employer);
        vault.deposit(address(cUSD), DEPOSIT);

        assertEq(vault.balances(employer, address(cUSD)), DEPOSIT);
        assertEq(cUSD.balanceOf(address(vault)), DEPOSIT);
    }

    function test_deposit_revert_zero() public {
        vm.prank(employer);
        vm.expectRevert("zero amount");
        vault.deposit(address(cUSD), 0);
    }

    // ── Create Stream ────────────────────────────

    function test_createStream() public {
        _depositAndCreateStream();

        bytes32 streamId = vault.getStreamId(employer, employee, address(cUSD), RATE);
        TrickleVault.Stream memory stream = vault.getStream(streamId);

        assertEq(stream.payer, employer);
        assertEq(stream.payee, employee);
        assertEq(stream.token, address(cUSD));
        assertEq(stream.amountPerSec, RATE);
        assertGt(stream.startTime, 0);
        assertEq(stream.lastPaid, stream.startTime);
    }

    function test_createStream_tracksPayer() public {
        _depositAndCreateStream();
        assertEq(vault.getPayerStreamCount(employer), 1);
        assertEq(vault.getPayeeStreamCount(employee), 1);
    }

    function test_createStream_revert_duplicate() public {
        _depositAndCreateStream();

        vm.prank(employer);
        vm.expectRevert("stream exists");
        vault.createStream(employee, address(cUSD), RATE);
    }

    function test_createStream_revert_self() public {
        vm.prank(employer);
        vault.deposit(address(cUSD), DEPOSIT);

        vm.prank(employer);
        vm.expectRevert("cannot stream to self");
        vault.createStream(employer, address(cUSD), RATE);
    }

    function test_createStream_revert_zeroPayee() public {
        vm.prank(employer);
        vault.deposit(address(cUSD), DEPOSIT);

        vm.prank(employer);
        vm.expectRevert("invalid payee");
        vault.createStream(address(0), address(cUSD), RATE);
    }

    function test_createStream_revert_zeroRate() public {
        vm.prank(employer);
        vault.deposit(address(cUSD), DEPOSIT);

        vm.prank(employer);
        vm.expectRevert("zero rate");
        vault.createStream(employee, address(cUSD), 0);
    }

    // ── Withdraw ─────────────────────────────────

    function test_withdraw_fullFunded() public {
        _depositAndCreateStream();

        // Advance 30 days
        vm.warp(block.timestamp + 30 days);

        uint256 expected = uint256(RATE) * 30 days;
        uint256 withdrawableAmt = vault.withdrawable(employer, employee, address(cUSD), RATE);
        assertEq(withdrawableAmt, expected);

        vm.prank(employee);
        vault.withdraw(employer, address(cUSD), RATE);

        assertEq(cUSD.balanceOf(employee), expected);
        assertEq(vault.balances(employer, address(cUSD)), DEPOSIT - expected);
    }

    function test_withdraw_partialFunded() public {
        // Deposit only 500 tokens but stream at 1000/month
        vm.startPrank(employer);
        vault.deposit(address(cUSD), 500e18);
        vault.createStream(employee, address(cUSD), RATE);
        vm.stopPrank();

        // Advance 30 days (owes ~1000 but only 500 available)
        vm.warp(block.timestamp + 30 days);

        vm.prank(employee);
        vault.withdraw(employer, address(cUSD), RATE);

        // Should receive at most 500 tokens
        assertEq(cUSD.balanceOf(employee), 500e18);
        assertEq(vault.balances(employer, address(cUSD)), 0);
    }

    function test_withdraw_multipleWithdrawals() public {
        _depositAndCreateStream();

        // Withdraw after 15 days
        vm.warp(block.timestamp + 15 days);
        vm.prank(employee);
        vault.withdraw(employer, address(cUSD), RATE);

        uint256 first = cUSD.balanceOf(employee);
        assertGt(first, 0);

        // Withdraw after another 15 days
        vm.warp(block.timestamp + 15 days);
        vm.prank(employee);
        vault.withdraw(employer, address(cUSD), RATE);

        uint256 total = cUSD.balanceOf(employee);
        assertGt(total, first);
    }

    function test_withdraw_revert_noStream() public {
        vm.prank(employee);
        vm.expectRevert("stream not found");
        vault.withdraw(employer, address(cUSD), RATE);
    }

    // ── Cancel Stream ────────────────────────────

    function test_cancelStream_settlesPending() public {
        _depositAndCreateStream();

        vm.warp(block.timestamp + 15 days);
        uint256 expected = uint256(RATE) * 15 days;

        vm.prank(employer);
        vault.cancelStream(employee, address(cUSD), RATE);

        // Employee should have received pending amount
        assertEq(cUSD.balanceOf(employee), expected);

        // Stream should be deleted
        bytes32 streamId = vault.getStreamId(employer, employee, address(cUSD), RATE);
        TrickleVault.Stream memory stream = vault.getStream(streamId);
        assertEq(stream.startTime, 0);
    }

    function test_cancelStream_revert_notFound() public {
        vm.prank(employer);
        vm.expectRevert("stream not found");
        vault.cancelStream(employee, address(cUSD), RATE);
    }

    // ── Withdraw Balance (Employer) ──────────────

    function test_withdrawBalance() public {
        vm.prank(employer);
        vault.deposit(address(cUSD), DEPOSIT);

        uint256 before = cUSD.balanceOf(employer);

        vm.prank(employer);
        vault.withdrawBalance(address(cUSD), 5000e18);

        assertEq(cUSD.balanceOf(employer), before + 5000e18);
        assertEq(vault.balances(employer, address(cUSD)), DEPOSIT - 5000e18);
    }

    function test_withdrawBalance_revert_insufficient() public {
        vm.prank(employer);
        vault.deposit(address(cUSD), DEPOSIT);

        vm.prank(employer);
        vm.expectRevert("insufficient balance");
        vault.withdrawBalance(address(cUSD), DEPOSIT + 1);
    }

    // ── Multi-stream ─────────────────────────────

    function test_multipleStreams() public {
        vm.startPrank(employer);
        vault.deposit(address(cUSD), DEPOSIT);
        vault.createStream(employee, address(cUSD), RATE);
        vault.createStream(employee2, address(cUSD), RATE);
        vm.stopPrank();

        assertEq(vault.getPayerStreamCount(employer), 2);
        assertEq(vault.totalPaidPerSec(employer, address(cUSD)), uint256(RATE) * 2);

        vm.warp(block.timestamp + 30 days);

        vm.prank(employee);
        vault.withdraw(employer, address(cUSD), RATE);

        vm.prank(employee2);
        vault.withdraw(employer, address(cUSD), RATE);

        uint256 each = uint256(RATE) * 30 days;
        assertEq(cUSD.balanceOf(employee), each);
        assertEq(cUSD.balanceOf(employee2), each);
    }

    // ── View Functions ───────────────────────────

    function test_getStreamIds() public {
        _depositAndCreateStream();

        bytes32[] memory payerIds = vault.getPayerStreamIds(employer);
        bytes32[] memory payeeIds = vault.getPayeeStreamIds(employee);

        assertEq(payerIds.length, 1);
        assertEq(payeeIds.length, 1);
        assertEq(payerIds[0], payeeIds[0]);
    }

    function test_withdrawable_zero_when_noTime() public {
        _depositAndCreateStream();
        assertEq(vault.withdrawable(employer, employee, address(cUSD), RATE), 0);
    }

    // ── Helpers ──────────────────────────────────

    function _depositAndCreateStream() internal {
        vm.startPrank(employer);
        vault.deposit(address(cUSD), DEPOSIT);
        vault.createStream(employee, address(cUSD), RATE);
        vm.stopPrank();
    }
}
