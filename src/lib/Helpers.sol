// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title Helpers Methods
 * @dev Events, Errors  and Structs for Vault Contract
 * @custom:a Alfredo Lopez / Calculum
 */
abstract contract Helpers {
    /**
     * @dev Helpers Smart Contract for Events and Errors
     */
    enum Status {
        Inactive, // 0
        Pending, // 1
        Claimet, // 2
        Completed // 3
    }
    /// Struct of Basics

    struct Basics {
        Status status;
        // bool pending;
        // bool claimer;
        uint256 amountAssets; // Expresed in Amount of Assets of the Vault
        uint256 amountShares; // Expresed in Amount of Shares of the Vault
        uint256 finalAmount; // Expresed in Amount of Assets of the Vault
    }
    /// Net Transfer Struct

    struct NetTransfer {
        bool pending;
        bool direction; // true = deposit, false = withdrawal
        uint256 amount;
    }
    /// Events
    /**
     * @dev Events of Mint/Deposit Process
     * @param caller Caller of Deposit/Mint Method
     * @param receiver Wallet Address where receive the Assets to Deposit/Mint
     * @param assets Amount of Assets to Deposit/Mint
     * @param estimationOfShares Estimation of Amount of Shares to Mint
     */

    event PendingDeposit(
        address indexed caller, address indexed receiver, uint256 assets, uint256 estimationOfShares
    );

    /**
     * @dev Events of Withdraw/Redeem Process
     * @param receiver Wallet Address where receive the Assets to Deposit/Mint
     * @param owner Caller of Deposit/Mint Method
     * @param assets Amount of Assets to Deposit/Mint
     * @param estimationOfShares Estimation of Amount of Shares to Mint
     */
    event PendingWithdraw(
        address indexed receiver, address indexed owner, uint256 assets, uint256 estimationOfShares
    );
    /**
     * @dev Epoch Changed
     */
    event EpochChanged(
        uint256 OldPeriod, uint256 NewPeriod, uint256 newMaintTimeBefore, uint256 newMaintTimeAfter
    );
    /**
     * @dev Fees Transfer
     */
    event FeesTransfer(uint256 indexed epoch, uint256 Amount);
	/**
     * @dev Dex Transfer
     */
    event DexTransfer(uint256 indexed epoch, uint256 Amount);

    /// Errors
    /// The User `_claimer` is not allowed to claim this deposit
    error CalletIsNotClaimerToDeposit(address _claimer);
    /// The User `_claimer` is not allowed to redeem the Assets
    error CalletIsNotClaimerToRedeem(address _claimer);
    /// The Caller `_owner` is not the Caller `_caller` of the Method
    error CallerIsNotOwnerOrReceiver(address _caller, address _owner, address _receiver);
    /// The Caller `_owner` is not the Caller `_caller` of the Method
    error CallerIsNotOwner(address _caller, address _owner);
    /// The Caller  require amount of assets `_assets` more than Max amount of assets Avaliable `_amountMax`
    error NotEnoughBalance(uint256 _assests, uint256 _amountMax);
    /// The Caller `_receiver` Try to Deposit a Value  over the Max Amount Permitted `_amountMax`
    error DepositExceededMax(address _receiver, uint256 _amountMax);
    /// The Caller `_receiver` Try to Deposit a Value  over the Max Amount Total Supply Permitted `_amountMax`
    error DepositExceedTotalVaultMax(address _receiver, uint256 _amountExceed, uint256 _amountMax);
    /// The Caller `_caller` Try to Deposit a Zero Amount
    error AmountMustBeGreaterThanZero(address _caller);
    /// The Oracle `_oracle` getting a wrong answer of the Balance of the Trader Bot Wallet `_traderBotWallet`
    error ActualAssetValueIsZero(address _oracle, address _traderBotWallet);
    /// The Caller `_caller` try to call Principal Method in Maintenance Period
    error VaultInMaintenance(address _caller, uint256 _timeStamp);

    error VaultOutMaintenance(address _caller, uint256 _timeStamp);
    ///	The Owner try to set a wrong value for the Period of the Epoch `_period`
    error WrongEpochDuration(uint256 _epochDuration);
    /// The Owner try to set a wrong value for the Period of the Epoch or Maintenace Period `_period` not multiple of minutes, days or weeks
    error WrongEpochDefinition(
        uint256 _epochDefinition, uint256 _maintTimeBefore, uint256 _maintTimeAfter
    );
    /// Address is not a Contract
    error AddressIsNotContract(address _address);
    /// Transfer to `_to` with the amount `_amount` Fail
    error TransferFail(address _to, uint256 _amount);
    // The Owner try to Execute a Fee Transfer in the Epoch 0
    error FirstEpochNoFeeTransfer();
    /// The User `_caller` try to deposit a value `_amount`, under the Minimal Permitted
    error DepositAmountTooLow(address _caller, uint256 _amount);
	/// The Wallet not whitelisted
	error NotWhitelisted(address _wallet);
	///  Transfer Faild
	error TransferFailed(address _to, uint256 _amount);

}
