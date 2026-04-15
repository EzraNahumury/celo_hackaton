// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TrickleVault} from "../src/TrickleVault.sol";

/// @notice Deploys TrickleVault and saves the address to deployments/<chainId>.json
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("===========================================");
        console.log("  TrickleVault Deployment");
        console.log("===========================================");
        console.log("Deployer  :", deployer);
        console.log("Chain ID  :", block.chainid);
        console.log("Block     :", block.number);

        vm.startBroadcast(deployerPrivateKey);

        TrickleVault vault = new TrickleVault();

        vm.stopBroadcast();

        console.log("-------------------------------------------");
        console.log("TrickleVault deployed at:", address(vault));
        console.log("===========================================");

        // Persist address to deployments/<chainId>.json so the frontend and
        // other scripts can read it without hard-coding addresses.
        _saveDeployment(address(vault));
    }

    function _saveDeployment(address vault) internal {
        string memory chainId = vm.toString(block.chainid);
        string memory dir     = string.concat("deployments/", chainId);
        string memory file    = string.concat(dir, ".json");

        // Build a minimal JSON object
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', chainId, ',\n',
            '  "TrickleVault": "', vm.toString(vault), '"\n',
            '}\n'
        );

        // vm.writeFile requires fs_permissions in foundry.toml (already set)
        vm.writeFile(file, json);
        console.log("Deployment saved to:", file);
    }
}
