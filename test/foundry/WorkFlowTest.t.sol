// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {Helpers, CalculumVault, IUniswapV2Router02, IERC20MetadataUpgradeable} from "../../src/CalculumVault.sol";
import {USDC} from "../../src/USDC.sol";
import {MockUpOracle} from "../../src/mock/MockUpOracle.sol";
import {UUPSProxy} from "OZ-Upgradeable-Foundry/src/UpgradeUUPS.sol";

contract BasicTest is Test {

    event PendingDeposit(
        address indexed caller, address indexed receiver, uint256 assets, uint256 estimationOfShares
    );

    event Transfer(address indexed from, address indexed to, uint256 amount);

    CalculumVault public implementation;
    CalculumVault public vault;
    USDC public usdc;
    MockUpOracle public oracle;
    IUniswapV2Router02 public router;
    UUPSProxy public proxy;
    
    address public deployer;
    address public traderBotAddress;
    address public transferBotAddress;
    address public transferBotRoleAddress;
    address public treasuryWallet;
    address[3] public investors;
    uint256 public startTime;

    string constant public TOKEN_NAME = "CalculumUSDC1";
    string constant public TOKEN_SYMBOL = "calcUSDC1";
    uint8 constant public TOKEN_DECIMALS = 18;
    uint256 constant public EPOCH_DURATION = 1 weeks;
    uint256 constant public MAINT_TIME_BEFORE = 60 minutes;
    uint256 constant public MAINT_TIME_AFTER = 30 minutes;
    uint256 constant public MIN_DEPOSIT_PER_ADDR = 300 * 10**6;
    uint256 constant public MAX_DEPOSIT_PER_ADDR = 10000 * 10**6;
    uint256 constant public TOKEN_MAX_TOTAL_SUPPLY = 50000 ether;

    uint256[4] public initialValues;

    function setUp() public {
        deployer = makeAddr("deployer");
        traderBotAddress = makeAddr("traderBotAddress");
        transferBotAddress = makeAddr("transferBot");
        transferBotRoleAddress = makeAddr("transferBotRole");
        treasuryWallet = makeAddr("treasury");        

        startTime = block.timestamp;
        initialValues[0] = startTime;
        initialValues[1] = MIN_DEPOSIT_PER_ADDR;
        initialValues[2] = MAX_DEPOSIT_PER_ADDR;
        initialValues[3] = TOKEN_MAX_TOTAL_SUPPLY;

        vm.startPrank(deployer);        
        usdc = new USDC();
        IERC20MetadataUpgradeable iusdc = IERC20MetadataUpgradeable(address(usdc));
        oracle = new MockUpOracle(traderBotAddress, iusdc);
        implementation = new CalculumVault();
        proxy = new UUPSProxy(address(implementation), "");
        vault = CalculumVault(payable(address(proxy)));
        vault.initialize(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            TOKEN_DECIMALS,
            iusdc,
            address(oracle),
            transferBotAddress,
            treasuryWallet,
            transferBotRoleAddress,
            address(router),
            initialValues
        );
        vm.stopPrank();

        hoax(transferBotRoleAddress);
        usdc.approve(address(vault), _usdc(1000_000));

        hoax(transferBotAddress);
        usdc.approve(address(vault), _usdc(1000_000));

        investors[0] = _setUpAccount("investor0");
        investors[1] = _setUpAccount("investor1");
        investors[2] = _setUpAccount("investor2");
    }

    function testBasicValues() public {
        assertEq(vault.owner(), deployer, "init: wrong deployer");
        assertEq(vault.name(), TOKEN_NAME, "init: wrong token name");
        assertEq(vault.symbol(), TOKEN_SYMBOL, "init: wrong token symbol");
        assertEq(vault.decimals(), TOKEN_DECIMALS, "init: wrong token decimals");
        assertEq(vault.asset(), address(usdc), "init: wrong asset");
        assertEq(vault.treasuryWallet(), treasuryWallet, "init: wrong treasury wallet");
        assertEq(address(vault.oracle()), address(oracle), "init: wrong oracle address");
        assertEq(vault.transferBotWallet(), transferBotAddress, "init: wrong transfer bot address");
        assertEq(vault.MANAGEMENT_FEE_PERCENTAGE(), 0.01 ether, "init: wrong management fee percentage");
        assertEq(vault.PERFORMANCE_FEE_PERCENTAGE(), 0.15 ether, "init: wrong performance fee percentage");
        assertEq(vault.EPOCH_START(), startTime, "init: wrong epoch start time");
        assertEq(vault.EPOCH_DURATION(), EPOCH_DURATION, "init: wrong epoch duration");
        assertEq(vault.MAINTENANCE_PERIOD_PRE_START(), MAINT_TIME_BEFORE, "init: wrong pre maintenance period");
        assertEq(vault.MAINTENANCE_PERIOD_POST_START(), MAINT_TIME_AFTER, "init: wrong post maintenance period");
        assertEq(vault.MIN_DEPOSIT(), MIN_DEPOSIT_PER_ADDR, "init: wrong minimal deposit");
        assertEq(vault.MAX_DEPOSIT(), MAX_DEPOSIT_PER_ADDR, "init: wrong maximum deposit");
        assertEq(vault.MAX_TOTAL_SUPPLY(), TOKEN_MAX_TOTAL_SUPPLY, "init: wrong maximum total supply");
    }
 
    function testEpoch1() public {
        vm.startPrank(deployer);
        // Move to after the Maintenance Time Post Maintenance
        vm.warp(block.timestamp + MAINT_TIME_AFTER * 6);
        vault.setEpochDuration(EPOCH_DURATION, MAINT_TIME_AFTER, MAINT_TIME_BEFORE);
        vault.setInitialValue([
            MIN_DEPOSIT_PER_ADDR,
            MAX_DEPOSIT_PER_ADDR,
            TOKEN_MAX_TOTAL_SUPPLY
        ]);
        vm.stopPrank();

        // Test investor0: alice
        address alice = investors[0];
        vm.startPrank(alice);
        uint256 depositAmount = MAX_DEPOSIT_PER_ADDR + 1;
        vm.expectRevert(abi.encodeWithSelector(Helpers.DepositExceededMax.selector, alice, MAX_DEPOSIT_PER_ADDR));
        vault.deposit(depositAmount, alice);
        depositAmount = MIN_DEPOSIT_PER_ADDR - 1;
        vm.expectRevert(abi.encodeWithSelector(Helpers.DepositAmountTooLow.selector, alice, depositAmount));
        vault.deposit(depositAmount, alice);
    
        uint256 balanceBefore = usdc.balanceOf(alice);
        (Helpers.Status statusBefore, , , ) = vault.DEPOSITS(alice);
        assertTrue(statusBefore == Helpers.Status.Inactive, "epoch 1: deposit status should be 0 before deposit");
        depositAmount = _usdc(1500);
        vm.expectEmit(true, true, false, true);
        emit Transfer(alice, address(vault), depositAmount);
        vm.expectEmit(true, true, false, true);
        emit PendingDeposit(alice, alice, depositAmount, 1500 ether);
        vault.deposit(depositAmount, alice);

        (Helpers.Status statusAfter, uint256 amountAssets , uint256 amountShares, uint256 finalAmount) = vault.DEPOSITS(alice);
        assertTrue(statusAfter == Helpers.Status.Pending, "epoch 1: deposit status should be 1 when pending");
        assertEq(amountAssets, _usdc(1500), "epoch 1: wrong assets amount in vault");
        assertEq(amountShares, 1500 ether, "epoch 1: wrong shares amount in vault");
        assertEq(finalAmount, 0, "epoch 1: wrong final amount in vault");
        assertEq(vault.balanceOf(alice), 0, "epoch 1: wrong token balance when pending");
        assertEq(vault.balanceOf(alice), 0, "epoch 1: wrong token balance");
        assertEq(usdc.balanceOf(alice) + depositAmount, balanceBefore, "epoch 1: wrong balance of usdc after deposit");
    }

    function _setUpAccount(string memory accountName) private returns (address account) {
        account = makeAddr(accountName);
        uint256 amount = _usdc(1000_000);
        hoax(deployer);
        usdc.mint(account, amount);
        hoax(account);
        usdc.approve(address(vault), amount);
    }

    function _usdc(uint256 amount) private pure returns (uint256) {
        return amount * 10**6;
    }
}
