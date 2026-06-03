// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {StreamRegistry} from "../src/StreamRegistry.sol";

/// @notice Deploys StreamRegistry and saves the address to
///         deployments/streamregistry-<chainId>.json. Companion to TrickleVault;
///         does NOT touch the existing vault deployment.
contract DeployStreamRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("===========================================");
        console.log("  StreamRegistry Deployment");
        console.log("===========================================");
        console.log("Deployer  :", deployer);
        console.log("Chain ID  :", block.chainid);
        console.log("Block     :", block.number);

        vm.startBroadcast(deployerPrivateKey);

        StreamRegistry reg = new StreamRegistry();

        vm.stopBroadcast();

        console.log("-------------------------------------------");
        console.log("StreamRegistry deployed at:", address(reg));
        console.log("===========================================");

        _saveDeployment(address(reg));
    }

    function _saveDeployment(address reg) internal {
        string memory chainId = vm.toString(block.chainid);
        string memory file = string.concat("deployments/streamregistry-", chainId, ".json");

        string memory json = string.concat(
            '{\n',
            '  "chainId": ', chainId, ',\n',
            '  "StreamRegistry": "', vm.toString(reg), '"\n',
            '}\n'
        );

        // vm.writeFile requires fs_permissions in foundry.toml (already set for ./deployments)
        vm.writeFile(file, json);
        console.log("Deployment saved to:", file);
    }
}
