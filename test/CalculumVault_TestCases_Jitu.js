import { ethers, run, network, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    setBalance,
    impersonateAccount,
} from "@nomicfoundation/hardhat-network-helpers";
import fetch from "node-fetch";
import dotenv from "dotenv";
import moment from "moment";
import chai from "chai";
import {
    USDC__factory,
    USDC,
    CalculumVault__factory,
    CalculumVault,
    MockUpOracle,
    MockUpOracle__factory,
    // eslint-disable-next-line node/no-missing-import
} from "../typechain-types";
import { USDC_ABI } from "../files/USDC.json";
import exp from "constants";

dotenv.config();
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CalculumVault", () => {
  let vaultContract;
  let assetToken;
  let accounts;
  let owner;
  let receiver;

  before(async () => {
    // Deploy the CalculumVault contract and ERC20 token for testing
    const VaultContract = await ethers.getContractFactory("CalculumVault");
    vaultContract = await VaultContract.deploy();
    await vaultContract.deployed();

    const ERC20Token = await ethers.getContractFactory("ERC20Token");
    assetToken = await ERC20Token.deploy();
    await assetToken.deployed();

    // Get test accounts
    accounts = await ethers.getSigners();
    owner = accounts[0];
    receiver = accounts[1];
  });

  describe("Modifiers", () => {
    it("should revert when calling a whitelisted function with non-whitelisted wallet", async () => {
      await expect(vaultContract.deposit(100, receiver)).to.be.revertedWith(
        "NotWhitelisted"
      );
    });

    it("should revert when calling a function while the contract is paused", async () => {
      await vaultContract.pause();
      await expect(vaultContract.deposit(100, receiver)).to.be.revertedWith(
        "Paused"
      );
    });

    it("should revert when calling a function with an invalid address", async () => {
      await expect(
        vaultContract.deposit(100, ethers.constants.AddressZero)
      ).to.be.revertedWith("InvalidAddress");
    });
  });

  describe("Deposit", () => {
    it("should allow a whitelisted wallet to deposit assets and mint shares", async () => {
      // Add receiver to whitelist
      await vaultContract.addWhitelist(receiver);

      // Approve asset transfer to the vault contract
      await assetToken.approve(vaultContract.address, 100);

      // Deposit assets
      await expect(vaultContract.deposit(100, receiver))
        .to.emit(vaultContract, "PendingDeposit")
        .withArgs(owner.address, receiver.address, 100, 100);

      // Check receiver's balance and shares
      expect(await vaultContract.balanceOf(receiver.address)).to.equal(100);
      expect(await vaultContract.totalSupply()).to.equal(100);
    });
  });

  describe("Withdraw", () => {
    it("should allow a whitelisted wallet to withdraw assets and burn shares", async () => {
      // Approve asset transfer to the vault contract
      await assetToken.approve(vaultContract.address, 100);

      // Withdraw assets
      await expect(vaultContract.withdraw(100, receiver, receiver))
        .to.emit(vaultContract, "PendingWithdraw")
        .withArgs(receiver.address, receiver.address, 100, 100);

      // Check receiver's balance and shares
      expect(await vaultContract.balanceOf(receiver.address)).to.equal(0);
      expect(await vaultContract.totalSupply()).to.equal(0);
    });
  });

  describe("ClaimShares", () => {
    it("should allow a whitelisted wallet to claim shares and mint them", async () => {
      // Add receiver as a claimer
      await vaultContract.addClaimerMint(receiver);

      // Mint shares for the receiver
      await expect(vaultContract.claimShares(receiver))
        .to.emit(vaultContract, "Deposit")
        .withArgs(owner.address, receiver.address, 0, 100);

      // Check receiver's balance and shares
      expect(await vaultContract.balanceOf(receiver.address)).to.equal(100);
      expect(await vaultContract.totalSupply()).to.equal(100);
    });
  });

  describe("Mint", () => {
    it("should allow minting of shares directly to a receiver", async () => {
      // Mint shares directly
      await expect(vaultContract.mint(100, receiver))
        .to.emit(vaultContract, "Mint")
        .withArgs(owner.address, receiver.address, 100);

      // Check receiver's balance and shares
      expect(await vaultContract.balanceOf(receiver.address)).to.equal(100);
      expect(await vaultContract.totalSupply()).to.equal(100);
    });
  });

  describe("Redeem", () => {
    it("should allow redeeming of shares and receiving corresponding assets", async () => {
      // Redeem shares
      await expect(vaultContract.redeem(100, receiver, receiver))
        .to.emit(vaultContract, "Redeem")
        .withArgs(receiver.address, receiver.address, 100, 100);

      // Check receiver's balance and shares
      expect(await vaultContract.balanceOf(receiver.address)).to.equal(0);
      expect(await vaultContract.totalSupply()).to.equal(0);
    });
  });

  describe("Pause/Unpause", () => {
    it("should allow the contract owner to pause and unpause the contract", async () => {
      // Pause the contract
      await vaultContract.pause();
      expect(await vaultContract.paused()).to.be.true;

      // Unpause the contract
      await vaultContract.unpause();
      expect(await vaultContract.paused()).to.be.false;
    });
  });

  describe("TotalAssets", () => {
    it("should return the total assets managed by the vault", async () => {
      // Deposit assets
      await assetToken.approve(vaultContract.address, 100);
      await vaultContract.deposit(100, receiver);

      // Check the total assets
      expect(await vaultContract.totalAssets()).to.equal(100);
    });
  });

  // ...
  describe("ClaimAssets", () => {
    it("should allow claiming of assets and transferring to the receiver", async () => {
      // Claim assets
      await expect(vaultContract.claimAssets(receiver.address, owner.address))
        .to.emit(vaultContract, "Withdraw")
        .withArgs(owner.address, receiver.address, owner.address, 100, 100);

      // Check receiver's balance
      expect(await assetToken.balanceOf(receiver.address)).to.equal(100);
    });
  });

  describe("SetEpochDuration", () => {
    it("should allow the contract owner to set the epoch duration", async () => {
      // Set epoch duration
      await vaultContract.setEpochDuration(2 * 1 * 7 * 24 * 60 * 60 * 1000, 30 * 60 * 1000, 15 * 60 * 1000); //2 * 1 weeks, 30 minutes, 15 minutes

      // Check the updated epoch duration
      expect(await vaultContract.EPOCH_DURATION()).to.equal(2 * 1 * 7 * 24 * 60 * 60 * 1000); //2 * 1 weeks
      expect(await vaultContract.MAINTENANCE_PERIOD_PRE_START()).to.equal(30 * 60 * 1000); //30 minutes
      expect(await vaultContract.MAINTENANCE_PERIOD_POST_START()).to.equal(15 * 60 * 1000); //15 minutes
    });
  });

  describe("DexWalletBalance", () => {
    it("should update the DEX wallet balance", async () => {
      // Call DexWalletBalance function
      await vaultContract.DexWalletBalance();

      // Check the updated DEX wallet balance
      expect(await vaultContract.DEX_WALLET_BALANCE()).to.equal(100);
    });
  });

  describe("FinalizeEpoch", () => {
    it("should finalize the epoch and update the parameters", async () => {
      // Finalize the epoch
      await vaultContract.finalizeEpoch();

      // TODO: Add assertions for updated parameters
      // Verify updated parameters
      expect(await vaultContract.TOTAL_VAULT_TOKEN_SUPPLY(CURRENT_EPOCH)).to.equal(expectedTotalSupply);
      // Add more assertions for other updated parameters
    });
  });

  describe("MgtFeePerVaultToken", () => {
    it("should return the management fee per vault token", async () => {
      // Call MgtFeePerVaultToken function
      const fee = await vaultContract.MgtFeePerVaultToken();

      // TODO: Add assertions for the returned fee
      expect(fee).to.equal(expectedManagementFee);
    });
  });

  describe("PerfFeePerVaultToken", () => {
    it("should return the performance fee per vault token", async () => {
      // Call PerfFeePerVaultToken function
      const fee = await vaultContract.PerfFeePerVaultToken();

      // TODO: Add assertions for the returned fee
      expect(fee).to.equal(expectedPerformanceFee);
    });
  });

  describe("PnLPerVaultToken", () => {
    it("should return the profit/loss per vault token generated by the trading strategy", async () => {
      // Call PnLPerVaultToken function
      const pnl = await vaultContract.PnLPerVaultToken();

      // TODO: Add assertions for the returned PnL
      expect(pnl).to.equal(expectedPnL);
    });
  });

  describe("getPnLPerVaultToken", () => {
    it("should return whether the profit/loss per vault token is positive or negative", async () => {
      // Call getPnLPerVaultToken function
      const pnlPositive = await vaultContract.getPnLPerVaultToken();

      // TODO: Add assertions for the returned value
      expect(pnlPositive).to.equal(expectedPnlPositive);
    });
  });

  describe("getPriceInPaymentToken", () => {
    it("should return the price of 1 token in payment token equivalent", async () => {
      // Call getPriceInPaymentToken function
      const price = await vaultContract.getPriceInPaymentToken(paymentToken.address);

      // TODO: Add assertions for the returned price
      expect(price).to.equal(expectedPrice);
    });
  });

  describe("UpdateTotalSupply", () => {
    it("should update the total supply of vault tokens", async () => {
      // Call updateTotalSupply function
      await vaultContract.updateTotalSupply();

      // TODO: Add assertions for the updated total supply
      expect(await vaultContract.TOTAL_VAULT_TOKEN_SUPPLY(CURRENT_EPOCH)).to.equal(expectedTotalSupply);
    });
  });
  describe("CalculateTransferBotGasReserveDA", () => {
    it("should calculate the transfer bot gas reserve in USDC for the current epoch", async () => {
      // Set up the necessary state for the calculation
      const expectedGasReserve = 100; // Set the expected gas reserve value

      // Set CURRENT_EPOCH, targetBalance, and currentBalance
      const CURRENT_EPOCH = 1;
      const targetBalance = 1000;
      const currentBalance = 900;
      await vaultContract.setCurrentEpoch(CURRENT_EPOCH);
      await vaultContract.setTargetBalance(targetBalance);
      await vaultContract.setCurrentBalance(currentBalance);

      // Call CalculateTransferBotGasReserveDA function
      const gasReserve = await vaultContract.CalculateTransferBotGasReserveDA();

      // Add assertions for the calculated gas reserve
      expect(gasReserve).to.equal(expectedGasReserve);
    });
  });

  describe("SwapDAforETH", () => {
    it("should swap ERC20 whitelisted tokens for ETH", async () => {
      // Set up the necessary state for the swap
      const expectedBalance = 1000; // Set the expected balance after the swap

      // Set openZeppelinDefenderWallet balance and _asset balanceOf
      const openZeppelinDefenderWallet = accounts[0];
      const _asset = accounts[1];
      await vaultContract.setOpenZeppelinDefenderWallet(openZeppelinDefenderWallet);
      await vaultContract.setAsset(_asset);

      // Call _swapDAforETH function
      await vaultContract._swapDAforETH();

      // Add assertions for the swapped tokens and ETH balance
      // Verify that the tokens are swapped for ETH
      const tokenBalance = await tokenContract.balanceOf(_asset);
      expect(tokenBalance).to.equal(0);
      // Verify the updated balances of openZeppelinDefenderWallet and _asset
      const ethBalance = await provider.getBalance(openZeppelinDefenderWallet);
      expect(ethBalance).to.equal(expectedBalance);
    });
  });

  describe("_swapTokensForETH", () => {
    it("should swap ERC20 tokens for ETH using the Uniswap v2 router", async () => {
      // Set up the necessary state for the swap
      const tokenAddress = "0x123..."; // Set the token address to be swapped
      const tokenAmount = 100; // Set the token amount to be swapped
      const expectedAmount = 1000; // Set the expected ETH amount after the swap

      // Call _swapTokensForETH function
      await vaultContract._swapTokensForETH(tokenAddress, tokenAmount, expectedAmount);

      // Add assertions for the swapped tokens and ETH balance
      // Verify that the tokens are swapped for ETH
      // Verify the updated balances of the token and ETH
      // ...
    });
  });

  describe("netTransferBalance", () => {
    it("should calculate the net transfer balance for the current epoch", async () => {
      // Set up the necessary state for the calculation
      const expectedBalance = 100; // Set the expected net transfer balance

      // Set totalSupply, CURRENT_EPOCH, newDeposits, newWithdrawals, MgtFeePerVaultToken, PerfFeePerVaultToken, totalAssets, etc.
      const totalSupply = 1000;
      const CURRENT_EPOCH = 1;
      const newDeposits = 100;
      const newWithdrawals = 50;
      const MgtFeePerVaultToken = 0.01;
      const PerfFeePerVaultToken = 0.05;
      const totalAssets = 10000;
      await vaultContract.setTotalSupply(totalSupply);
      await vaultContract.setCurrentEpoch(CURRENT_EPOCH);
      await vaultContract.setNewDeposits(newDeposits);
      await vaultContract.setNewWithdrawals(newWithdrawals);
      await vaultContract.setMgtFeePerVaultToken(MgtFeePerVaultToken);
      await vaultContract.setPerfFeePerVaultToken(PerfFeePerVaultToken);
      await vaultContract.setTotalAssets(totalAssets);

      // Call netTransferBalance function
      await vaultContract.netTransferBalance();

      // Add assertions for the calculated net transfer balance
      // Verify the updated net transfer balance in the netTransfer struct
      const balance = await vaultContract.netTransferBalance();
      expect(balance).to.equal(expectedBalance);
    });
  });

  describe("dexTransfer", () => {
    it("should perform a transfer of assets between the vault and dexWallet", async () => {
      // Set up the necessary state for the transfer
      const expectedPending = true; // Set the expected value of actualTx.pending

      // Set CURRENT_EPOCH, actualTx.pending, actualTx.direction, and actualTx.amount
      const CURRENT_EPOCH = 1;
      const pending = true;
      const direction = "in";
      const amount = 100;
      await vaultContract.setCurrentEpoch(CURRENT_EPOCH);
      await vaultContract.setActualTx(pending, direction, amount);

      // Call dexTransfer function
      await vaultContract.dexTransfer();

      // Add assertions for the transfer of assets
      // Verify the transfer of assets based on the actualTx direction and amount
      // Verify the updated actualTx.pending value
      const actualTx = await vaultContract.actualTx();
      expect(actualTx.pending).to.equal(expectedPending);
    });
  });

  describe("feesTransfer", () => {
    it("should perform a transfer of fees to the treasury wallet", async () => {
      // Set up the necessary state for the transfer
      const expectedFeesTransferred = 100; // Set the expected fees transferred

      // Set CURRENT_EPOCH, getPnLPerVaultToken, MgtFeePerVaultToken, PerfFeePerVaultToken, CalculateTransferBotGasReserveDA, etc.
      const CURRENT_EPOCH = 1;
      const getPnLPerVaultToken = 0.01;
      const MgtFeePerVaultToken = 0.005;
      const PerfFeePerVaultToken = 0.02;
      const CalculateTransferBotGasReserveDA = 100;
      await vaultContract.setCurrentEpoch(CURRENT_EPOCH);
      await vaultContract.setGetPnLPerVaultToken(getPnLPerVaultToken);
      await vaultContract.setMgtFeePerVaultToken(MgtFeePerVaultToken);
      await vaultContract.setPerfFeePerVaultToken(PerfFeePerVaultToken);
      await vaultContract.setCalculateTransferBotGasReserveDA(CalculateTransferBotGasReserveDA);

      // Call feesTransfer function
      await vaultContract.feesTransfer();

      // Add assertions for the transfer of fees
      const feesTransferred = await vaultContract.getFeesTransferred(); // Assuming there's a getter function for feesTransferred
      expect(feesTransferred).to.equal(expectedFeesTransferred);
    });
  });

  describe("addDropWhitelist", () => {
    it("should add a wallet to the drop whitelist", async () => {
      // Set up the necessary state for adding to the whitelist
      const expectedStatus = true; // Set the expected status after adding to the whitelist

      // Set _wallet and status
      const _wallet = accounts[0];
      const status = true;

      // Call addDropWhitelist function
      await vaultContract.addDropWhitelist(_wallet, status);

      // Add assertions for adding to the whitelist
      const whitelistStatus = await vaultContract.getDropWhitelistStatus(_wallet); // Assuming there's a getter function for whitelistStatus
      expect(whitelistStatus).to.equal(expectedStatus);
    });
  });

  describe("convertToAssets", () => {
    it("should convert the specified number of shares to assets", async () => {
      // Set up the necessary state for the conversion
      const expectedAssets = 100; // Set the expected number of assets after conversion

      // Set _shares, totalSupply, CURRENT_EPOCH, totalAssets, UpdateVaultPriceToken, etc.
      const _shares = 1000;
      const totalSupply = 10000;
      const CURRENT_EPOCH = 1;
      const totalAssets = 100000;
      await vaultContract.setTotalSupply(totalSupply);
      await vaultContract.setCurrentEpoch(CURRENT_EPOCH);
      await vaultContract.setTotalAssets(totalAssets);

      // Call convertToAssets function
      const assets = await vaultContract.convertToAssets(_shares);

      // Add assertions for the converted assets
      expect(assets).to.equal(expectedAssets);
    });
  });

  describe("convertToShares", () => {
    it("should convert the specified number of assets to shares", async () => {
      // Set up the necessary state for the conversion
      const expectedShares = 1000; // Set the expected number of shares after conversion

      // Set _assets, totalSupply, CURRENT_EPOCH, totalAssets, UpdateVaultPriceToken, etc.
      const _assets = 100;
      const totalSupply = 10000;
      const CURRENT_EPOCH = 1;
      const totalAssets = 100000;
      await vaultContract.setTotalSupply(totalSupply);
      await vaultContract.setCurrentEpoch(CURRENT_EPOCH);
      await vaultContract.setTotalAssets(totalAssets);

      // Call convertToShares function
      const shares = await vaultContract.convertToShares(_assets);

      // Add assertions for the converted shares
      expect(shares).to.equal(expectedShares);
    });
  });

  describe("UpdateVaultPriceToken", () => {
    it("should update the vault price token based on the PnL per vault token", async () => {
      // Set up the necessary state for the update
      const expectedVaultPriceToken = 1000; // Set the expected vault price token

      // Set getPnLPerVaultToken, VAULT_TOKEN_PRICE, PnLPerVaultToken, MgtFeePerVaultToken, PerfFeePerVaultToken, etc.
      const getPnLPerVaultToken = 0.01;
      const VAULT_TOKEN_PRICE = 10000;
      const PnLPerVaultToken = 100;
      const MgtFeePerVaultToken = 0.005;
      const PerfFeePerVaultToken = 0.02;
      await vaultContract.setGetPnLPerVaultToken(getPnLPerVaultToken);
      await vaultContract.setVaultTokenPrice(VAULT_TOKEN_PRICE);
      await vaultContract.setPnLPerVaultToken(PnLPerVaultToken);
      await vaultContract.setMgtFeePerVaultToken(MgtFeePerVaultToken);
      await vaultContract.setPerfFeePerVaultToken(PerfFeePerVaultToken);

      // Call UpdateVaultPriceToken function
      const vaultPriceToken = await vaultContract.UpdateVaultPriceToken();

      // Add assertions for the updated vault price token
      expect(vaultPriceToken).to.equal(expectedVaultPriceToken);
    });
  });

  describe("isClaimerMint", () => {
    it("should check if the caller is a claimer of a pending deposit", async () => {
      // Set up the necessary state for the check
      const expectedIsClaimer = true; // Set the expected isClaimer value

      // Set _claimer and DEPOSITS[_claimer].status
      const _claimer = accounts[0];
      await vaultContract.addClaimerMint(_claimer);

      // Call isClaimerMint function
      const isClaimer = await vaultContract.isClaimerMint(_claimer);

      // Add assertions for the isClaimerMint check
      expect(isClaimer).to.equal(expectedIsClaimer);
    });
  });

  describe("isClaimerWithdraw", () => {
    it("should check if the caller is a claimer of a pending withdrawal", async () => {
      // Set up the necessary state for the check
      const expectedIsClaimer = true; // Set the expected isClaimer value

      // Set _claimer and WITHDRAWALS[_claimer].status
      const _claimer = accounts[0];
      await vaultContract.addClaimerWithdraw(_claimer);

      // Call isClaimerWithdraw function
      const isClaimer = await vaultContract.isClaimerWithdraw(_claimer);

      // Add assertions for the isClaimerWithdraw check
      expect(isClaimer).to.equal(expectedIsClaimer);
    });
  });

  describe("setdexWallet", () => {
    it("should set the dexWallet address", async () => {
      // Set up the necessary state for setting the dexWallet
      const expectedDexWallet = "0x123..."; // Set the expected dexWallet address

      // Set _dexWallet
      const _dexWallet = "0x123...";
      await vaultContract.setdexWallet(_dexWallet);

      // Call setdexWallet function
      await vaultContract.setdexWallet(_dexWallet);

      // Add assertions for setting the dexWallet address
      // Verify that the dexWallet address is set to the expected value
      const dexWallet = await vaultContract.dexWallet();
      expect(dexWallet).to.equal(expectedDexWallet);
    });
  });

  describe("isDepositWallet", () => {
    it("should check if the specified wallet is a deposit wallet", async () => {
      // Set up the necessary state for the check
      const expectedIsDeposit = true; // Set the expected isDeposit value

      // Set _wallet and depositWallets
      const _wallet = accounts[0];
      await vaultContract.addDepositWallet(_wallet);

      // Call isDepositWallet function
      const isDeposit = await vaultContract.isDepositWallet(_wallet);

      // Add assertions for the isDepositWallet check
      expect(isDeposit).to.equal(expectedIsDeposit);
    });
  });

  describe("isWithdrawWallet", () => {
    it("should check if the specified wallet is a withdraw wallet", async () => {
      // Set up the necessary state for the check
      const expectedIsWithdraw = true; // Set the expected isWithdraw value

      // Set _wallet and withdrawWallets
      const _wallet = accounts[0];
      await vaultContract.addWithdrawWallet(_wallet);

      // Call isWithdrawWallet function
      const isWithdraw = await vaultContract.isWithdrawWallet(_wallet);

      // Add assertions for the isWithdrawWallet check
      expect(isWithdraw).to.equal(expectedIsWithdraw);
    });
  });

  describe("newDeposits", () => {
    it("should calculate the total amount of new deposits in the current epoch", async () => {
      // Set up the necessary state for the calculation
      const expectedTotalDeposits = 100; // Set the expected total amount of new deposits

      // Set depositWallets and DEPOSITS status
      const depositWallets = [accounts[0], accounts[1]];
      const depositAmount = 50;
      for (const wallet of depositWallets) {
        await vaultContract.addDepositWallet(wallet);
        await vaultContract.addDeposit(wallet, depositAmount);
      }

      // Call newDeposits function
      const totalDeposits = await vaultContract.newDeposits();

      // Add assertions for the total amount of new deposits
      expect(totalDeposits).to.equal(expectedTotalDeposits);
    });
  });

  describe("newShares", () => {
    it("should calculate the total number of new shares in the current epoch", async () => {
      // Set up the necessary state for the calculation
      const expectedTotalShares = 1000; // Set the expected total number of new shares

      // Set depositWallets and DEPOSITS status
      const depositWallets = [accounts[0], accounts[1]];
      const depositAmount = 50;
      for (const wallet of depositWallets) {
        await vaultContract.addDepositWallet(wallet);
        await vaultContract.addDeposit(wallet, depositAmount);
      }

      // Call newShares function
      const totalShares = await vaultContract.newShares();

      // Add assertions for the total number of new shares
      expect(totalShares).to.equal(expectedTotalShares);
    });
  });

  describe("newWithdrawals", () => {
    it("should calculate the total amount of new withdrawals in the current epoch", async () => {
      // Set up the necessary state for the calculation
      const expectedTotalWithdrawals = 50; // Set the expected total amount of new withdrawals

      // Set withdrawWallets and WITHDRAWALS status
      const withdrawWallets = [accounts[0], accounts[1]];
      const withdrawalAmount = 25;
      for (const wallet of withdrawWallets) {
        await vaultContract.addWithdrawWallet(wallet);
        await vaultContract.addWithdrawal(wallet, withdrawalAmount);
      }

      // Call newWithdrawals function
      const totalWithdrawals = await vaultContract.newWithdrawals();

      // Add assertions for the total amount of new withdrawals
      expect(totalWithdrawals).to.equal(expectedTotalWithdrawals);
    });
  });

  describe("newWithdrawalsShares", () => {
    it("should calculate the total number of new withdrawal shares in the current epoch", async () => {
      // Set up the necessary state for the calculation
      const expectedTotalWithdrawalShares = 500; // Set the expected total number of new withdrawal shares

      // Set withdrawWallets and WITHDRAWALS status
      const withdrawWallets = [accounts[0], accounts[1]];
      const withdrawalAmount = 25;
      for (const wallet of withdrawWallets) {
        await vaultContract.addWithdrawWallet(wallet);
        await vaultContract.addWithdrawal(wallet, withdrawalAmount);
      }

      // Call newWithdrawalsShares function
      const totalWithdrawalShares = await vaultContract.newWithdrawalsShares();

      // Add assertions for the total number of new withdrawal shares
      expect(totalWithdrawalShares).to.equal(expectedTotalWithdrawalShares);
    });
  });

  describe("asset", () => {
    it("should return the address of the asset", async () => {
      // Call asset function
      const expectedAssetAddress = "0x123..."; // Set the expected asset address

      // Call asset function
      const assetAddress = await vaultContract.asset();

      // Add assertions for the asset address
      expect(assetAddress).to.equal(expectedAssetAddress);
    });
  });

  describe("previewDeposit", () => {
    it("should preview the conversion of assets to shares for a deposit", async () => {
      // Set up the necessary state for the preview
      const expectedShares = 1000; // Set the expected number of shares after the preview

      // Set _assets
      const _assets = 10000;
      await vaultContract.setTotalAssets(_assets);

      // Call previewDeposit function
      const shares = await vaultContract.previewDeposit(_assets);

      // Add assertions for the previewed shares
      expect(shares).to.equal(expectedShares);
    });
  });

  describe("previewWithdraw", () => {
    it("should preview the conversion of shares to assets for a withdrawal", async () => {
      // Set up the necessary state for the preview
      const expectedAssets = 10000; // Set the expected number of assets after the preview

      // Set _shares
      const _shares = 1000;
      await vaultContract.setTotalSupply(_shares);

      // Call previewWithdraw function
      const assets = await vaultContract.previewWithdraw(_shares);

      // Add assertions for the previewed assets
      expect(assets).to.equal(expectedAssets);
    });
  });

  describe("previewRedeem", () => {
    it("should preview the conversion of shares to assets for a redemption", async () => {
      // Set up the necessary state for the preview
      const expectedAssets = 10000; // Set the expected number of assets after the preview

      // Set _shares
      const _shares = 1000;
      await vaultContract.setTotalSupply(_shares);

      // Call previewRedeem function
      const assets = await vaultContract.previewRedeem(_shares);

      // Add assertions for the previewed assets
      expect(assets).to.equal(expectedAssets);
    });
  });

  describe("maxDeposit", () => {
    it("should return the maximum deposit amount for a wallet", async () => {
      // Set up the necessary state for getting the maximum deposit amount
      const expectedMaxDepositAmount = 1000; // Set the expected maximum deposit amount

      // Set _owner
      const _owner = accounts[0];
      await vaultContract.setMaxDeposit(_owner, expectedMaxDepositAmount);

      // Call maxDeposit function
      const maxDepositAmount = await vaultContract.maxDeposit(_owner);

      // Add assertions for the maximum deposit amount
      expect(maxDepositAmount).to.equal(expectedMaxDepositAmount);
    });
  });

  describe("maxWithdraw", () => {
    it("should return the maximum withdrawal amount for a wallet", async () => {
      // Set up the necessary state for getting the maximum withdrawal amount
      const expectedMaxWithdrawalAmount = 1000; // Set the expected maximum withdrawal amount

      // Set _owner
      const _owner = accounts[0];
      await vaultContract.setMaxWithdraw(_owner, expectedMaxWithdrawalAmount);

      // Call maxWithdraw function
      const maxWithdrawalAmount = await vaultContract.maxWithdraw(_owner);

      // Add assertions for the maximum withdrawal amount
      expect(maxWithdrawalAmount).to.equal(expectedMaxWithdrawalAmount);
    });
  });

  describe("maxRedeem", () => {
    it("should return the maximum redemption amount for a wallet", async () => {
      // Set up the necessary state for getting the maximum redemption amount
      const expectedMaxRedemptionAmount = 1000; // Set the expected maximum redemption amount

      // Set _owner
      const _owner = accounts[0];
      await vaultContract.setMaxRedeem(_owner, expectedMaxRedemptionAmount);

      // Call maxRedeem function
      const maxRedemptionAmount = await vaultContract.maxRedeem(_owner);

      // Add assertions for the maximum redemption amount
      expect(maxRedemptionAmount).to.equal(expectedMaxRedemptionAmount);
    });
  });
});
