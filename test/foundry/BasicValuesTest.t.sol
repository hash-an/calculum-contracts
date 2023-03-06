// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../../src/CalculumVault.sol";
import "../../src/USDC.sol";
import "../../src/mock/MockUpOracle.sol";

contract BasicValuesTest is Test {

    CalculumVault public vault;
    USDC public usdc;
    MockUpOracle public oracle;
    IUniswapV2Router02 public router;
    
    address public traderBotWallet;
    address public transferBotWallet;
    address public treasuryWallet;
    address[3] public investors;

    string constant public TOKEN_NAME = "CalculumUSDC1";
    string constant public TOKEN_SYMBOL = "calcUSDC1";
    uint8 constant public TOKEN_DECIMALS = 18;
    uint256[4] public initialValues;

    function _usdc(uint256 amount) private pure returns (uint256) {
        return amount * 10**6;
    }
}
