// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TrickleVault} from "../src/TrickleVault.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        TrickleVault vault = new TrickleVault();
        console.log("TrickleVault deployed at:", address(vault));

        vm.stopBroadcast();
    }
}
