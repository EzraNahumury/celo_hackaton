// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title TrickleVault - Real-time payroll streaming on Celo
/// @notice Employers deposit stablecoins and create per-second salary streams to employees
contract TrickleVault {
    struct Stream {
        address payer;
        address payee;
        address token;
        uint216 amountPerSec;
        uint40 lastPaid;
        uint40 startTime;
    }

    mapping(bytes32 => Stream) public streams;
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => mapping(address => uint256)) public totalPaidPerSec;

    bytes32[] internal _allStreamIds;
    mapping(address => bytes32[]) internal _payerStreamIds;
    mapping(address => bytes32[]) internal _payeeStreamIds;

    event Deposit(address indexed payer, address indexed token, uint256 amount);
    event BalanceWithdrawn(address indexed payer, address indexed token, uint256 amount);
    event StreamCreated(
        bytes32 indexed streamId,
        address indexed payer,
        address indexed payee,
        address token,
        uint216 amountPerSec
    );
    event StreamCancelled(
        bytes32 indexed streamId,
        address indexed payer,
        address indexed payee,
        address token
    );
    event Withdrawn(
        bytes32 indexed streamId,
        address indexed payee,
        address indexed payer,
        uint256 amount
    );

    function getStreamId(
        address payer,
        address payee,
        address token,
        uint216 amountPerSec
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(payer, payee, token, amountPerSec));
    }

    // ──────────────────────────────────────────────
    //  Employer (Payer) Functions
    // ──────────────────────────────────────────────

    function deposit(address token, uint256 amount) external {
        require(amount > 0, "zero amount");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transfer failed");
        balances[msg.sender][token] += amount;
        emit Deposit(msg.sender, token, amount);
    }

    function withdrawBalance(address token, uint256 amount) external {
        require(balances[msg.sender][token] >= amount, "insufficient balance");
        balances[msg.sender][token] -= amount;
        require(IERC20(token).transfer(msg.sender, amount), "transfer failed");
        emit BalanceWithdrawn(msg.sender, token, amount);
    }

    function createStream(
        address payee,
        address token,
        uint216 amountPerSec
    ) external {
        require(payee != address(0), "invalid payee");
        require(payee != msg.sender, "cannot stream to self");
        require(amountPerSec > 0, "zero rate");

        bytes32 streamId = getStreamId(msg.sender, payee, token, amountPerSec);
        require(streams[streamId].startTime == 0, "stream exists");

        streams[streamId] = Stream({
            payer: msg.sender,
            payee: payee,
            token: token,
            amountPerSec: amountPerSec,
            lastPaid: uint40(block.timestamp),
            startTime: uint40(block.timestamp)
        });

        totalPaidPerSec[msg.sender][token] += amountPerSec;
        _allStreamIds.push(streamId);
        _payerStreamIds[msg.sender].push(streamId);
        _payeeStreamIds[payee].push(streamId);

        emit StreamCreated(streamId, msg.sender, payee, token, amountPerSec);
    }

    function cancelStream(
        address payee,
        address token,
        uint216 amountPerSec
    ) external {
        bytes32 streamId = getStreamId(msg.sender, payee, token, amountPerSec);
        Stream storage stream = streams[streamId];
        require(stream.startTime > 0, "stream not found");

        // Settle pending amount to payee
        uint256 elapsed = block.timestamp - stream.lastPaid;
        uint256 owed = uint256(stream.amountPerSec) * elapsed;
        if (owed > 0) {
            uint256 available = balances[msg.sender][token];
            uint256 payout = owed <= available ? owed : available;
            if (payout > 0) {
                balances[msg.sender][token] -= payout;
                require(IERC20(token).transfer(payee, payout), "transfer failed");
                emit Withdrawn(streamId, payee, msg.sender, payout);
            }
        }

        totalPaidPerSec[msg.sender][token] -= amountPerSec;
        delete streams[streamId];

        emit StreamCancelled(streamId, msg.sender, payee, token);
    }

    // ──────────────────────────────────────────────
    //  Employee (Payee) Functions
    // ──────────────────────────────────────────────

    function withdraw(
        address payer,
        address token,
        uint216 amountPerSec
    ) external {
        bytes32 streamId = getStreamId(payer, msg.sender, token, amountPerSec);
        Stream storage stream = streams[streamId];
        require(stream.startTime > 0, "stream not found");

        uint256 elapsed = block.timestamp - stream.lastPaid;
        uint256 owed = uint256(stream.amountPerSec) * elapsed;
        if (owed == 0) return;

        uint256 available = balances[payer][token];
        uint256 payout;

        if (owed <= available) {
            payout = owed;
            stream.lastPaid = uint40(block.timestamp);
        } else {
            payout = available;
            // Advance lastPaid proportionally to what was paid
            uint256 secondsPaid = payout / stream.amountPerSec;
            stream.lastPaid += uint40(secondsPaid);
        }

        if (payout > 0) {
            balances[payer][token] -= payout;
            require(IERC20(token).transfer(msg.sender, payout), "transfer failed");
            emit Withdrawn(streamId, msg.sender, payer, payout);
        }
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    function withdrawable(
        address payer,
        address payee,
        address token,
        uint216 amountPerSec
    ) external view returns (uint256) {
        bytes32 streamId = getStreamId(payer, payee, token, amountPerSec);
        Stream memory stream = streams[streamId];
        if (stream.startTime == 0) return 0;

        uint256 owed = uint256(stream.amountPerSec) * (block.timestamp - stream.lastPaid);
        uint256 available = balances[payer][token];
        return owed <= available ? owed : available;
    }

    function getStream(bytes32 streamId) external view returns (Stream memory) {
        return streams[streamId];
    }

    function getPayerStreamIds(address payer) external view returns (bytes32[] memory) {
        return _payerStreamIds[payer];
    }

    function getPayeeStreamIds(address payee) external view returns (bytes32[] memory) {
        return _payeeStreamIds[payee];
    }

    function getPayerStreamCount(address payer) external view returns (uint256) {
        return _payerStreamIds[payer].length;
    }

    function getPayeeStreamCount(address payee) external view returns (uint256) {
        return _payeeStreamIds[payee].length;
    }
}
