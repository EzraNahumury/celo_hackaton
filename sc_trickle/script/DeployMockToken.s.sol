// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC20Mock} from "../test/mocks/ERC20Mock.sol";

contract DeployMockToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("===========================================");
        console.log("  Deploy Mock Token (tUSDC)");
        console.log("===========================================");
        console.log("Deployer :", deployer);
        console.log("Chain ID :", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        ERC20Mock token = new ERC20Mock("Test USD Coin", "tUSDC", 6);

        // Mint 100,000 tUSDC langsung ke deployer
        token.mint(deployer, 100_000 * 10 ** 6);

        vm.stopBroadcast();

        console.log("-------------------------------------------");
        console.log("MockToken deployed at :", address(token));
        console.log("Minted 100,000 tUSDC  -> ", deployer);
        console.log("===========================================");

        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "MockToken": "', vm.toString(address(token)), '"\n',
            '}\n'
        );
        vm.writeFile("deployments/mocktoken.json", json);
        console.log("Saved to: deployments/mocktoken.json");
    }
}
