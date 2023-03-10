// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {Helpers, CalculumVault, IUniswapV2Router02, IERC20MetadataUpgradeable} from "../../src/CalculumVault.sol";
import {USDC} from "../../src/USDC.sol";
import {MockUpOracle} from "../../src/mock/MockUpOracle.sol";
import {UUPSProxy} from "OZ-Upgradeable-Foundry/src/UpgradeUUPS.sol";

contract BasicTest is Test {

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

    uint256[4] public initialValues;

    function setUp() public {
        deployer = makeAddr("deployer");
        traderBotAddress = makeAddr("traderBotAddress");
        transferBotAddress = makeAddr("transferBot");
        transferBotRoleAddress = makeAddr("transferBotRole");
        treasuryWallet = makeAddr("treasury");

        startTime = block.timestamp;
        initialValues[0] = startTime;
        initialValues[1] = _usdc(300);
        initialValues[2] = _usdc(10000);
        initialValues[3] = 50000 ether;

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
        assertEq(vault.MIN_DEPOSIT(), _usdc(300), "init: wrong minimal deposit");
        assertEq(vault.MAX_DEPOSIT(), _usdc(10000), "init: wrong maximum deposit");
        assertEq(vault.MAX_TOTAL_SUPPLY(), 50000 ether, "init: wrong maximum total supply");
    }

    function testEpochSequence() public {
        uint256 timestamp = block.timestamp;
        // uint256 DENOMINATOR = type(uint8).max + 1;
        uint256 currentTime;
        uint256 currentEpoch;
        vm.startPrank(deployer);
        vm.expectRevert(abi.encodeWithSelector(Helpers.VaultInMaintenance.selector, deployer, timestamp));
        vault.setEpochDuration(EPOCH_DURATION, MAINT_TIME_AFTER, MAINT_TIME_BEFORE);
        // Move to after the Maintenance Time Post Maintenance
        vm.warp(timestamp + MAINT_TIME_AFTER);
        vault.setEpochDuration(EPOCH_DURATION, MAINT_TIME_AFTER, MAINT_TIME_BEFORE);

        // Move to after Finalize the Next Epoch (1st Epoch)
        vm.warp(timestamp + EPOCH_DURATION);
        timestamp = block.timestamp;
        currentEpoch = 1;
        currentTime = vault.CurrentEpoch();
        emit log_uint(currentEpoch);
        emit log_uint(currentTime);
        assertEq(currentTime, vault.CurrentEpoch());
        assertEq(currentEpoch, vault.CURRENT_EPOCH());
        vm.warp(timestamp + EPOCH_DURATION / 4);
        assertEq(currentTime, vault.CurrentEpoch());
        assertEq(currentEpoch, vault.CURRENT_EPOCH());

        // Move to after Finalize the Next Epoch (2nd Epoch)
        vm.warp(timestamp + EPOCH_DURATION);
        timestamp = block.timestamp;
        currentEpoch = 2;
        currentTime = vault.CurrentEpoch();
        emit log_uint(currentEpoch);
        emit log_uint(currentTime);
        assertEq(currentTime, vault.CurrentEpoch());
        assertEq(currentEpoch, vault.CURRENT_EPOCH());
        vm.warp(timestamp + EPOCH_DURATION / 2);
        assertEq(currentTime, vault.CurrentEpoch());
        assertEq(currentEpoch, vault.CURRENT_EPOCH());

        // Move to after Finalize the Next Epoch (3rd Epoch)
        vm.warp(timestamp + EPOCH_DURATION);
        timestamp = block.timestamp;
        currentEpoch = 3;
        currentTime = vault.CurrentEpoch();
        emit log_uint(currentEpoch);
        emit log_uint(currentTime);
        assertEq(currentTime, vault.CurrentEpoch());
        assertEq(currentEpoch, vault.CURRENT_EPOCH());
        vm.warp(timestamp + EPOCH_DURATION / 5);
        assertEq(currentTime, vault.CurrentEpoch());
        assertEq(currentEpoch, vault.CURRENT_EPOCH());

        vm.stopPrank();
    }

    function testTransferOwnership(address otherDeveloper) public {
        vm.assume(otherDeveloper != address(0));
        hoax(deployer);
        vault.transferOwnership(otherDeveloper);
        assertEq(vault.owner(), otherDeveloper, "owner: wrong owner after transfer ownership");
        hoax(otherDeveloper);
        vault.renounceOwnership();
        assertEq(vault.owner(), address(0), "owner: wrong owner after renounce ownership");
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
