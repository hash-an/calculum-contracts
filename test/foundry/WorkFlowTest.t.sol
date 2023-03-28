// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {Helpers} from "../../src/CalculumVault.sol";
import {USDC} from "../../src/USDC.sol";
import {MockUpOracle} from "../../src/mock/MockUpOracle.sol";
import {UUPSProxy} from "OZ-Upgradeable-Foundry/UpgradeUUPS.sol";
import {BasicTest} from "./BasicTest.t.sol";

contract WorkFlowTest is BasicTest {

    event PendingDeposit(
        address indexed caller, address indexed receiver, uint256 assets, uint256 estimationOfShares
    );

    event PendingWithdraw(
        address indexed receiver, address indexed owner, uint256 assets, uint256 estimationOfShares
    );

    event Transfer(address indexed from, address indexed to, uint256 amount);

    event FeesTranfer(uint256 indexed epoch, uint256 Amount);

    function testEpoch0() public {
        vm.startPrank(deployer);
        // Move to after the Maintenance Time Post Maintenance
        vm.warp(block.timestamp + MAINT_TIME_AFTER + MAINT_TIME_BEFORE);
        vault.setEpochDuration(EPOCH_DURATION, MAINT_TIME_AFTER, MAINT_TIME_BEFORE);
        vault.setInitialValue([MIN_DEPOSIT_PER_ADDR, MAX_DEPOSIT_PER_ADDR, TOKEN_MAX_TOTAL_DEPOSIT]);
        vm.stopPrank();

        // Test investor0: alice
        address alice = investors[0];
        vm.startPrank(alice);
        uint256 depositAmount = MAX_DEPOSIT_PER_ADDR + 1;
        vm.expectRevert(
            abi.encodeWithSelector(Helpers.DepositExceededMax.selector, alice, MAX_DEPOSIT_PER_ADDR)
        );
        vault.deposit(depositAmount, alice);
        depositAmount = MIN_DEPOSIT_PER_ADDR - 1;
        vm.expectRevert(
            abi.encodeWithSelector(Helpers.DepositAmountTooLow.selector, alice, depositAmount)
        );
        vault.deposit(depositAmount, alice);
        vm.stopPrank();

        // before Alice
        hoax(deployer); 
        oracle.setAssetValue(_usdc(1500));
        vm.startPrank(alice);
        uint256 balanceBefore = usdc.balanceOf(alice);
        (Helpers.Status statusBefore,,,) = vault.DEPOSITS(alice);
        assertTrue(
            statusBefore == Helpers.Status.Inactive,
            "epoch 0: deposit status should be 0 before deposit"
        );
        depositAmount = _usdc(1500);
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(alice, address(vault), depositAmount);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PendingDeposit(alice, alice, depositAmount, 1500 ether);
        vault.deposit(depositAmount, alice);

        (Helpers.Status status, uint256 amountAssets, uint256 amountShares, uint256 finalAmount) =
            vault.DEPOSITS(alice);
        assertTrue(
            status == Helpers.Status.Pending, "epoch 0: deposit status should be 1 when pending"
        );
        assertEq(amountAssets, _usdc(1500), "epoch 0: wrong assets amount in vault");
        assertEq(amountShares, 1500 ether, "epoch 0: wrong shares amount in vault");
        assertEq(finalAmount, 0, "epoch 0: wrong final amount in vault");
        assertEq(vault.balanceOf(alice), 0, "epoch 0: wrong token balance when pending");
        assertEq(vault.balanceOf(alice), 0, "epoch 0: wrong token balance");
        assertEq(
            usdc.balanceOf(alice) + depositAmount,
            balanceBefore,
            "epoch 0: wrong balance of usdc after deposit"
        );

        uint256 nextEpochTime = vault.getNextEpoch();
        vm.warp(nextEpochTime - 70 minutes);
        vm.stopPrank();

        vm.startPrank(transferBotRoleAddress);
        vm.expectRevert(abi.encodeWithSelector(Helpers.VaultOutMaintenance.selector, transferBotRoleAddress, block.timestamp));
        vault.finalizeEpoch();
        vm.warp(block.timestamp + 55 minutes);
        vault.finalizeEpoch();

        (status, amountAssets , amountShares, finalAmount) = vault.DEPOSITS(alice);
        assertTrue(status == Helpers.Status.Claimet, "epoch 0: deposit status should be 2 after finalize previous epoch");
        uint256 currentEpoch = vault.CURRENT_EPOCH();
        assertEq(currentEpoch, 0, "epoch 0: should be epoch 0");
        assertEq(amountAssets, 0, "epoch 0: wrong assets amount in vault");
        assertEq(amountShares, 1500 ether, "epoch 0: wrong shares amount in vault");
        assertEq(finalAmount, _usdc(1500), "epoch 0: wrong final amount in vault");
        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(address(vault), transferBotWallet, _usdc(1500));
        vault.dexTransfer();
        uint256 vaultBalanceAfter = usdc.balanceOf(address(vault));
        assertEq(vaultBalanceAfter + _usdc(1500), vaultBalanceBefore, "epoch 0: wrong USDC balance change of vault");
        assertEq(vaultBalanceAfter, 0, "epoch 0: USDC balance in vault should be 0");
        assertEq(usdc.balanceOf(transferBotWallet), _usdc(1500), "epoch 0: wrong USDC balance of tranfer bot");

        vm.expectRevert(Helpers.FirstEpochNoFeeTransfer.selector);
        vault.feesTransfer();
        vm.stopPrank();

        nextEpochTime = vault.getNextEpoch();
        vm.warp(nextEpochTime + 1);
        hoax(deployer);
        vault.CurrentEpoch();
    }

    function testEpoch1() public returns (uint256, uint256) {
        testEpoch0();
        assertEq(vault.CURRENT_EPOCH(), 1, "epoch 1: already in epoch 1");

        address alice = investors[0];
        address bob = investors[1];

        vm.expectRevert(abi.encodeWithSelector(Helpers.VaultInMaintenance.selector, deployer, block.timestamp));
        hoax(deployer);
        vault.setEpochDuration(EPOCH_DURATION, MAINT_TIME_AFTER, MAINT_TIME_BEFORE);
        
        vm.expectRevert(abi.encodeWithSelector(Helpers.VaultInMaintenance.selector, alice, block.timestamp));
        hoax(alice);
        vault.claimShares(alice);

        vm.warp(vault.getCurrentEpoch() + MAINT_TIME_AFTER + MAINT_TIME_BEFORE);
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(Helpers.CallerIsNotOwner.selector, bob, alice));
        vault.claimShares(alice);
        vm.expectRevert(abi.encodeWithSelector(Helpers.CalletIsNotClaimerToDeposit.selector, bob));
        vault.claimShares(bob);
        vm.stopPrank();

        vm.expectEmit(true, true, false, true, address(vault));
        emit Transfer(address(0), alice, 1500 ether);
        hoax(alice);
        vault.claimShares(alice);
        assertEq(vault.balanceOf(alice), 1500 ether, "epoch 1: wrong balance of shares");
        (Helpers.Status status,, uint256 amountShares, uint256 finalAmount) = vault.DEPOSITS(alice);
        assertTrue(uint8(status) == 3, "epoch 1: deposit status should be 3");
        assertEq(amountShares, 0, "epoch 1: wrong balance of shares in vault");
        assertEq(finalAmount, _usdc(1500), "epoch 1: wrong balance of final shares");
    
        hoax(deployer);
        oracle.setAssetValue(1350000000);
        vm.startPrank(transferBotRoleAddress);
        vm.expectRevert(abi.encodeWithSelector(Helpers.VaultOutMaintenance.selector, transferBotRoleAddress, block.timestamp));
        vault.finalizeEpoch();
        vm.warp(vault.getNextEpoch() + MAINT_TIME_AFTER - 43 minutes);
        vault.finalizeEpoch();

        (,, uint256 transferAmount) = vault.netTransfer(vault.CURRENT_EPOCH());

        assertEq(usdc.balanceOf(address(vault)), 0, "epoch 1: wrong vault balance before dex transfer");

        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(transferBotWallet, address(vault), transferAmount);
        vault.dexTransfer();

        assertEq(usdc.balanceOf(address(vault)), transferAmount, "epoch 1: wrong vault balance after dex transfer");
        assertEq(usdc.balanceOf(transferBotWallet), _usdc(1500) - transferAmount, "epoch 1: wrong transfer bot balance after dex transfer");

        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(address(vault), treasuryWallet, 0);
        vm.expectEmit(true, false, false, true, address(vault));
        emit FeesTranfer(vault.CURRENT_EPOCH(), 0);
        vault.feesTransfer();
        vm.stopPrank();

        vm.warp(vault.getNextEpoch() + 1);
        hoax(deployer);
        vault.CurrentEpoch();

        return (usdc.balanceOf(address(vault)), usdc.balanceOf(transferBotWallet));
    }

    function testEpoch2() public returns (uint256, uint256) {
        (uint256 vaultBalance, uint256 transferBotBalance) = testEpoch1();
        assertEq(vault.CURRENT_EPOCH(), 2, "epoch 2: already in epoch 2");

        address bob = investors[1];
        uint256 depositAmount = _usdc(500);
        uint256 expectShares = 555.67965734569609435 ether;

        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(Helpers.VaultInMaintenance.selector, bob, block.timestamp));
        vault.deposit(depositAmount, bob);

        vm.warp(vault.getCurrentEpoch() + MAINT_TIME_AFTER + MAINT_TIME_BEFORE);
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(bob, address(vault), depositAmount);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PendingDeposit(bob, bob, depositAmount, expectShares);
        vault.deposit(depositAmount, bob);
        vm.stopPrank();

        (Helpers.Status status, uint256 amountAssets, uint256 amountShares, uint256 finalAmount) = vault.DEPOSITS(bob);
        assertTrue(status == Helpers.Status.Pending, "epoch 2: deposit status should be 0 before deposit");
        assertEq(amountAssets, _usdc(500), "epoch 2: wrong asset amount in vault");
        assertEq(amountShares, expectShares, "epoch 2: wrong shares amount in vault");
        assertEq(finalAmount, 0, "epoch 2: wrong shares amount in vault");

        assertEq(usdc.balanceOf(address(vault)), vaultBalance + _usdc(500), "epoch 2: wrong vault balance after deposit");

        hoax(deployer);
        oracle.setAssetValue(1282226400);
        vm.warp(vault.getNextEpoch() + MAINT_TIME_AFTER - 43 minutes);
        hoax(transferBotRoleAddress);
        vault.finalizeEpoch();

        (status, amountAssets, amountShares, finalAmount) = vault.DEPOSITS(bob);
        assertEq(amountShares, 585.038232248477438001 ether, "epoch 2: wrong shares amount after finalize");

        (,, uint256 transferAmount) = vault.netTransfer(vault.CURRENT_EPOCH());

        vm.startPrank(transferBotRoleAddress);
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(address(vault), transferBotWallet, transferAmount);
        vault.dexTransfer();

        assertEq(usdc.balanceOf(address(vault)), vaultBalance + _usdc(500) - transferAmount, "epoch 2: wrong vault balance after dex transfer");
        assertEq(usdc.balanceOf(transferBotWallet), transferBotBalance + transferAmount, "epoch 2: wrong transfer bot balance after dex transfer");

        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(address(vault), treasuryWallet, 0);
        vm.expectEmit(true, false, false, true, address(vault));
        emit FeesTranfer(vault.CURRENT_EPOCH(), 0);
        vault.feesTransfer();
        vm.stopPrank();

        vm.warp(vault.getNextEpoch() + 1);
        hoax(deployer);
        vault.CurrentEpoch();

        return (usdc.balanceOf(address(vault)), usdc.balanceOf(transferBotWallet));
    }

    function testEpoch3() public returns (uint256, uint256) {
        (uint256 vaultBalance, uint256 transferBotBalance) = testEpoch2();
        assertEq(vault.CURRENT_EPOCH(), 3, "epoch 3: already in epoch 3");

        address alice = investors[0];
        address bob = investors[1];
        address carla = investors[2];
        uint256 depositAmount = _usdc(1000);
        uint256 bobExpectedShares = 585.038232248477438001 ether;
        uint256 aliceExpectedShares = 1626.539926675580105465 ether;
        uint256 carlaExpectedShares = 487.961978002674031640 ether;

        vm.startPrank(carla);
        vm.expectRevert(abi.encodeWithSelector(Helpers.VaultInMaintenance.selector, carla, block.timestamp));
        vault.deposit(depositAmount, carla);

        vm.warp(vault.getCurrentEpoch() + MAINT_TIME_AFTER + MAINT_TIME_BEFORE);

        vm.expectRevert(abi.encodeWithSelector(Helpers.CallerIsNotOwner.selector, carla, alice));
        vault.claimShares(alice);
        vm.expectRevert(abi.encodeWithSelector(Helpers.CalletIsNotClaimerToDeposit.selector, carla));
        vault.claimShares(carla);
        vm.stopPrank();

        //
        // Bob
        //
        vm.startPrank(bob);
        (Helpers.Status status, uint256 amountAssets, uint256 amountShares, uint256 finalAmount) = vault.DEPOSITS(bob);
        assertTrue(status == Helpers.Status.Claimet, "epoch 3: wrong status of bob's deposit before claiming");
        assertEq(finalAmount, _usdc(500), "epoch 3: wrong amount of assets for bob before claiming");
        assertEq(bobExpectedShares, amountShares, "epoch 3: wrong amount of shares for bob before claiming");

        vm.expectEmit(true, true, false, true, address(vault));
        emit Transfer(address(0), bob, bobExpectedShares);
        vault.claimShares(bob);
        assertEq(vault.balanceOf(bob), bobExpectedShares, "epoch 3: wrong amount of balance for bob after claiming");

        (status,, amountShares, finalAmount) = vault.DEPOSITS(bob);
        assertEq(uint8(status), 3, "epoch 3: wrong status of bob's deposit after claiming");
        assertEq(finalAmount, _usdc(500), "epoch 3: wrong amount of assets for bob after claiming");
        assertEq(amountShares, 0 ether, "epoch 3: wrong amount of shares for bob after claiming");
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(Helpers.VaultOutMaintenance.selector, transferBotRoleAddress, block.timestamp));
        hoax(transferBotRoleAddress);
        vault.finalizeEpoch();

        //
        // Alice
        //
        uint256 aliceUsdcBalanceBefore = usdc.balanceOf(alice);
        (status,,,) = vault.DEPOSITS(alice);
        assertTrue(uint8(status) == 3, "epoch 3: wrong status of alice's deposit before depositing");

        vm.startPrank(alice);
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(alice, address(vault), depositAmount);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PendingDeposit(alice, alice, depositAmount, aliceExpectedShares);
        vault.deposit(depositAmount, alice);
        vm.stopPrank();

        (status, amountAssets, amountShares, finalAmount) = vault.DEPOSITS(alice);
        assertTrue(status == Helpers.Status.Pending, "epoch 3: wrong status of alice's deposit after depositing");
        assertEq(amountAssets, depositAmount, "epoch 3: wrong alice's assets in vault after depositing");
        assertEq(amountShares, aliceExpectedShares, "epoch 3: wrong alice's shares in vault after depositing");
        assertEq(finalAmount, _usdc(1500), "epoch 3: wrong alice's final amount after depositing");
        assertEq(aliceUsdcBalanceBefore - usdc.balanceOf(alice), _usdc(1000), "epoch 3: wrong change of alice's USDC balance");

        // Carla
        uint256 carlaUsdcBalanceBefore = usdc.balanceOf(carla);
        (status,,,) = vault.DEPOSITS(carla);
        assertTrue(status == Helpers.Status.Inactive, "epoch 3: wrong status of carla's deposit before depositing");

        vm.startPrank(carla);
        depositAmount = _usdc(300);
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(carla, address(vault), depositAmount);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PendingDeposit(carla, carla, depositAmount, carlaExpectedShares);
        vault.deposit(depositAmount, carla);
        vm.stopPrank();

        (status, amountAssets, amountShares, finalAmount) = vault.DEPOSITS(carla);
        assertTrue(status == Helpers.Status.Pending, "epoch 3: wrong status of carla's deposit after depositing");
        assertEq(amountAssets, depositAmount, "epoch 3: wrong carla's assets in vault after depositing");
        assertEq(amountShares, carlaExpectedShares, "epoch 3: wrong carla's shares in vault after depositing");
        assertEq(finalAmount, 0 ether, "epoch 3: wrong carla's final amount after depositing");
        assertEq(carlaUsdcBalanceBefore - usdc.balanceOf(carla), _usdc(300), "epoch 3: wrong change of carla's USDC balance");

        hoax(deployer);
        oracle.setAssetValue(1871065245);

        vm.warp(vault.getNextEpoch() + MAINT_TIME_AFTER - 43 minutes);
        hoax(transferBotRoleAddress);
        vault.finalizeEpoch();

        aliceExpectedShares = 1122.582658567606979321 ether;
        carlaExpectedShares = 336.774797570282093797 ether;

        (,amountAssets, amountShares,) = vault.DEPOSITS(alice);
        assertEq(amountAssets, 0, "epoch 3: wrong alice's assets in vault after finalize");
        assertEq(amountShares, aliceExpectedShares, "epoch 3: wrong alice's shares in vault after finalize");

        (,amountAssets, amountShares,) = vault.DEPOSITS(carla);
        assertEq(amountAssets, 0, "epoch 3: wrong alice's assets in vault after finalize");
        assertEq(amountShares, carlaExpectedShares, "epoch 3: wrong alice's shares in vault after finalize");

        (,, uint256 transferAmount) = vault.netTransfer(vault.CURRENT_EPOCH());

        vm.startPrank(transferBotRoleAddress);
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(address(vault), transferBotWallet, transferAmount);
        vault.dexTransfer();

        assertEq(usdc.balanceOf(address(vault)), vaultBalance + _usdc(1300) - transferAmount, "epoch 3: wrong vault balance after dex transfer");
        assertEq(usdc.balanceOf(transferBotWallet), transferBotBalance + transferAmount, "epoch 3: wrong transfer bot balance after dex transfer");

        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(address(vault), treasuryWallet, 0);
        vm.expectEmit(true, false, false, true, address(vault));
        emit FeesTranfer(vault.CURRENT_EPOCH(), 0);
        vault.feesTransfer();
        vm.stopPrank();

        vm.warp(vault.getNextEpoch() + 1);
        hoax(deployer);
        vault.CurrentEpoch();

        return (usdc.balanceOf(address(vault)), usdc.balanceOf(transferBotWallet));
    }

    function testEpoch4() public returns (uint256, uint256) {
        (uint256 vaultBalance, uint256 transferBotBalance) = testEpoch3();
        assertEq(vault.CURRENT_EPOCH(), 4, "epoch 4: already in epoch 4");

        address alice = investors[0];
        address carla = investors[2];
        uint256 aliceExpectedShares = 1122.582658567606979321 ether;
        uint256 carlaExpectedShares = 336.774797570282093797 ether;

        vm.warp(vault.getCurrentEpoch() + MAINT_TIME_AFTER + MAINT_TIME_BEFORE);

        (Helpers.Status status, uint256 amountAssets, uint256 amountShares, uint256 finalAmount) = vault.DEPOSITS(alice);
        assertTrue(status == Helpers.Status.Claimet, "epoch 4: wrong status of alice's deposit");
        assertEq(amountShares, aliceExpectedShares, "epoch 4: wrong amount of alice's shares");
        assertEq(finalAmount, _usdc(2500), "epoch 4: wrong final amount of alice");

        (status,, amountShares, finalAmount) = vault.DEPOSITS(carla);
        assertTrue(status == Helpers.Status.Claimet, "epoch 4: wrong status of carla's deposit");
        assertEq(amountShares, carlaExpectedShares, "epoch 4: wrong amount of carla's shares");
        assertEq(finalAmount, _usdc(300), "epoch 4: wrong final amount of carla");

        vm.startPrank(alice);
        vm.expectEmit(true, true, false, true, address(vault));
        emit Transfer(address(0), address(alice), aliceExpectedShares);
        vault.claimShares(alice);
        (status, amountAssets, amountShares, finalAmount) = vault.DEPOSITS(alice);
        assertTrue(uint8(status) == 3, "epoch 4: wrong status of alice desposit after claiming");
        assertEq(amountShares, 0, "epoch 4: wrong amount of alice shares after claiming");
        assertEq(finalAmount, _usdc(2500), "epoch 4: wrong final amount of alice after claiming");
        vm.stopPrank();

        vm.startPrank(carla);
        vm.expectEmit(true, true, false, true, address(vault));
        emit Transfer(address(0), address(carla), carlaExpectedShares);
        vault.claimShares(carla);
        (status, amountAssets, amountShares, finalAmount) = vault.DEPOSITS(carla);
        assertTrue(uint8(status) == 3, "epoch 4: wrong status of carla desposit after claiming");
        assertEq(amountShares, 0, "epoch 4: wrong amount of carla shares after claiming");
        assertEq(finalAmount, _usdc(300), "epoch 4: wrong final amount of carla after claiming");
        vm.stopPrank();

        hoax(deployer);
        oracle.setAssetValue(3315226114);

        vm.warp(vault.getNextEpoch() + MAINT_TIME_AFTER - 43 minutes);
        hoax(transferBotRoleAddress);
        vault.finalizeEpoch();

        (,, uint256 transferAmount) = vault.netTransfer(vault.CURRENT_EPOCH());

        vm.startPrank(transferBotRoleAddress);
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(transferBotWallet, address(vault), transferAmount);
        vault.dexTransfer();

        assertEq(usdc.balanceOf(address(vault)), vaultBalance + transferAmount, "epoch 3: wrong vault balance after dex transfer");
        assertEq(usdc.balanceOf(transferBotWallet), transferBotBalance - transferAmount, "epoch 3: wrong transfer bot balance after dex transfer");

        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(address(vault), treasuryWallet, 0);
        vm.expectEmit(true, false, false, true, address(vault));
        emit FeesTranfer(vault.CURRENT_EPOCH(), 0);
        vault.feesTransfer();
        vm.stopPrank();

        vm.warp(vault.getNextEpoch() + 1);
        hoax(deployer);
        vault.CurrentEpoch();

        return (usdc.balanceOf(address(vault)), usdc.balanceOf(transferBotWallet));
    }

    function testEpoch5() public returns (uint256, uint256) {
        (uint256 vaultBalance, uint256 transferBotBalance) = testEpoch4();
        assertEq(vault.CURRENT_EPOCH(), 5, "epoch 5: already in epoch 5");

        address alice = investors[0];
        uint256 withdrawAmount = _usdc(1269);
        uint256 aliceExpectedShares = 1358.471660504122517230 ether;

        vm.warp(vault.getCurrentEpoch() + MAINT_TIME_AFTER + MAINT_TIME_BEFORE);

        vm.expectEmit(true, true, false, true, address(vault));
        emit PendingWithdraw(address(alice), address(alice), withdrawAmount, aliceExpectedShares);
        hoax(alice);
        vault.withdraw(withdrawAmount, alice, alice);

        (Helpers.Status status, uint256 amountAssets, uint256 amountShares, uint256 finalAmount) = vault.WITHDRAWALS(alice);
        assertTrue(status == Helpers.Status.Pending, "epoch 5: wrong status of alice's withdrawal");
        assertEq(amountAssets, withdrawAmount, "epoch 5: wrong assets of alice after withdrawal");
        assertEq(amountShares, aliceExpectedShares, "epoch 5: wrong shares of alice after withdrawal");
        assertEq(finalAmount, 0, "epoch 5: wrong final amount of alice after withdrawal");

        hoax(deployer);
        oracle.setAssetValue(3455486910);

        vm.warp(vault.getNextEpoch() + MAINT_TIME_AFTER - 43 minutes);
        hoax(transferBotRoleAddress);
        vault.finalizeEpoch();

        (status, amountAssets, amountShares, finalAmount) = vault.WITHDRAWALS(alice);
        assertTrue(status == Helpers.Status.Claimet, "epoch 5: wrong status of alice's withdrawal after finalizing");
        assertEq(amountAssets, 0, "epoch 5: wrong assets of alice after finalizing");
        assertEq(amountShares, 1311.256553699520755879 ether, "epoch 5: wrong shares of alice after finalizing");
        assertEq(finalAmount, withdrawAmount, "epoch 5: wrong final amount of alice after finalizing");

        (,, uint256 transferAmount) = vault.netTransfer(vault.CURRENT_EPOCH());

        vm.startPrank(transferBotRoleAddress);
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(transferBotWallet, address(vault), transferAmount);
        vault.dexTransfer();

        assertEq(usdc.balanceOf(address(vault)), vaultBalance + transferAmount, "epoch 3: wrong vault balance after dex transfer");
        assertEq(usdc.balanceOf(transferBotWallet), transferBotBalance - transferAmount, "epoch 3: wrong transfer bot balance after dex transfer");

        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(address(vault), treasuryWallet, 0);
        vm.expectEmit(true, false, false, true, address(vault));
        emit FeesTranfer(vault.CURRENT_EPOCH(), 0);
        vault.feesTransfer();
        vm.stopPrank();

        vm.warp(vault.getNextEpoch() + 1);
        hoax(deployer);
        vault.CurrentEpoch();

        return (usdc.balanceOf(address(vault)), usdc.balanceOf(transferBotWallet));
    }

    function testEpoch6() public returns (uint256, uint256) {
        (uint256 vaultBalance, uint256 transferBotBalance) = testEpoch5();
        assertEq(vault.CURRENT_EPOCH(), 6, "epoch 5: already in epoch 6");

        return (usdc.balanceOf(address(vault)), usdc.balanceOf(transferBotWallet));
    }
}
