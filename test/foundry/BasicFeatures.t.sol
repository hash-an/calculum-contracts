// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "../../src/CalculumVault.sol";
import "../../src/USDC.sol";
import "../../src/mock/MockUpOracle.sol";

contract BasicFeaturesTest is Test {
    address public deployer;
    address public traderBot;
    address public treasury;
    address public traderWallet;
    address public router;
    address[3] public investors;
    USDC public usdc;
    CalculumVault public vault;
    MockUpOracle public oracle;
    uint256[4] public initValues;

    string public constant NAME = "CalculumUSDC1";
    string public constant SYMBOL = "calcUSDC1";
    uint8 public constant DECIMALS = 18;
    uint256 public startTime;

    function setUp() public {
        deployer = makeAddr("deployer");
        traderBot = makeAddr("traderBot");
        treasury = makeAddr("treasury");
        traderWallet = makeAddr("traderWallet");
        router = makeAddr("router");
        // investors[0] = _setUpAddress("investor0");
        // investors[1] = _setUpAddress("investor1");
        // investors[2] = _setUpAddress("investor2");

        startTime = block.timestamp;
        initValues[0] = startTime;
        initValues[1] = 300 * 10 ** 6;
        initValues[2] = 10000 * 10 ** 6;
        initValues[3] = 5000 ether;

        vm.startPrank(deployer);
        vault = new CalculumVault();
        usdc = new USDC();
        IERC20MetadataUpgradeable iusdc = IERC20MetadataUpgradeable(address(usdc));
        oracle = new MockUpOracle(traderBot, iusdc);
        vault.initialize(
            NAME,
            SYMBOL,
            DECIMALS,
            iusdc,
            address(oracle),
            traderBot,
            treasury,
            traderWallet,
            router,
            initValues
        );
        vm.stopPrank();
    }

    function testInitialValues() public {
        assertEq(vault.owner(), deployer, "init: wrong deployer address");
        assertEq(abi.encodePacked(vault.name()), abi.encodePacked(NAME), "init: wrong token name");
        assertEq(
            abi.encodePacked(vault.symbol()), abi.encodePacked(SYMBOL), "init: wrong token symbol"
        );
        assertEq(vault.decimals(), DECIMALS, "init: wrong token symbol");
        assertEq(vault.asset(), address(usdc), "init: wrong asset address");
        assertEq(vault.treasuryWallet(), treasury, "init: wrong treasury address");
        assertEq(address(vault.oracle()), address(oracle), "init: wrong oracle address");
        assertEq(vault.transferBotWallet(), traderWallet, "init: wrong trader bot wallet address");
        assertEq(vault.MANAGEMENT_FEE_PERCENTAGE(), 0.01 ether, "init: wrong management fee");
        assertEq(vault.PERFORMANCE_FEE_PERCENTAGE(), 0.15 ether, "init: wrong performance fee");
        assertEq(vault.EPOCH_START(), startTime, "init: wrong epoch start timestamp");
        assertEq(vault.EPOCH_DURATION(), 7 days, "init: wrong epoch duration");
        assertEq(
            vault.MAINTENANCE_PERIOD_PRE_START(), 60 minutes, "init: wrong maintenance pre start"
        );
        assertEq(
            vault.MAINTENANCE_PERIOD_POST_START(), 30 minutes, "init: wrong maintenance post start"
        );
        assertEq(vault.MIN_DEPOSIT(), initValues[1], "init: wrong min deposit amount");
        assertEq(vault.MAX_DEPOSIT(), initValues[2], "init: wrong max deposit amount");
        assertEq(vault.MAX_TOTAL_SUPPLY(), initValues[3], "init: wrong max total supply");
    }

    function _setUpAddress(string memory name) private returns (address account) {
        account = makeAddr(name);
        uint256 amount = 1_000_000 * 10 ** 6;
        hoax(account);
        usdc.mint(account, amount);
        hoax(account);
        usdc.approve(address(vault), amount);
    }
}
