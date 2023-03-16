// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {Helpers} from "../../src/CalculumVault.sol";
import {BasicTest} from "./BasicTest.t.sol";

contract WorkFlowTest is BasicTest {

    event PendingDeposit(
        address indexed caller, address indexed receiver, uint256 assets, uint256 estimationOfShares
    );

    event Transfer(address indexed from, address indexed to, uint256 amount);
 
    function testEpoch0() public {
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
    
        // before Alice 
        uint256 balanceBefore = usdc.balanceOf(alice);
        (Helpers.Status statusBefore, , , ) = vault.DEPOSITS(alice);
        assertTrue(statusBefore == Helpers.Status.Inactive, "epoch 0: deposit status should be 0 before deposit");
        depositAmount = _usdc(1500);
        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(alice, address(vault), depositAmount);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PendingDeposit(alice, alice, depositAmount, 1500 ether);
        vault.deposit(depositAmount, alice);

        (Helpers.Status status, uint256 amountAssets , uint256 amountShares, uint256 finalAmount) = vault.DEPOSITS(alice);
        assertTrue(status == Helpers.Status.Pending, "epoch 0: deposit status should be 1 when pending");
        assertEq(amountAssets, _usdc(1500), "epoch 0: wrong assets amount in vault");
        assertEq(amountShares, 1500 ether, "epoch 0: wrong shares amount in vault");
        assertEq(finalAmount, 0, "epoch 0: wrong final amount in vault");
        assertEq(vault.balanceOf(alice), 0, "epoch 0: wrong token balance when pending");
        assertEq(vault.balanceOf(alice), 0, "epoch 0: wrong token balance");
        assertEq(usdc.balanceOf(alice) + depositAmount, balanceBefore, "epoch 0: wrong balance of usdc after deposit");

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
        emit Transfer(address(vault), transferBotAddress, _usdc(1500));
        vault.dexTransfer();
        uint256 vaultBalanceAfter = usdc.balanceOf(address(vault));
        assertEq(vaultBalanceAfter + _usdc(1500), vaultBalanceBefore, "epoch 0: wrong USDC balance change of vault");
        assertEq(vaultBalanceAfter, 0, "epoch 0: USDC balance in vault should be 0");

        vm.expectRevert(Helpers.FirstEpochNoFeeTransfer.selector);
        vault.feesTransfer();
        vm.stopPrank();

        nextEpochTime = vault.getNextEpoch();
        vm.warp(nextEpochTime + 1);
        hoax(deployer);
        vault.CurrentEpoch();
    }

    function testEpoch1() public {
        testEpoch0();
        assertEq(vault.CURRENT_EPOCH(), 1, "epoch 1: already in epoch 1 after updating epoch");

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
        oracle.setAssetValue(_usdc(1350));
        vm.startPrank(transferBotRoleAddress);
        vm.expectRevert(abi.encodeWithSelector(Helpers.VaultOutMaintenance.selector, transferBotRoleAddress, block.timestamp));
        vault.finalizeEpoch();
        vm.warp(vault.getNextEpoch() + MAINT_TIME_AFTER - 43 minutes);
        vault.finalizeEpoch();

        (,, uint256 transferAmount) = vault.netTransfer(vault.CURRENT_EPOCH());

        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(transferBotAddress, address(vault), transferAmount);
        vault.dexTransfer();

        vm.expectEmit(true, true, false, true, address(usdc));
        emit Transfer(address(vault), treasuryWallet, transferAmount);
        vault.feesTransfer();
        vm.stopPrank();

        vm.warp(vault.getNextEpoch() + 1);
        hoax(deployer);
        vault.CurrentEpoch();
    }
}
