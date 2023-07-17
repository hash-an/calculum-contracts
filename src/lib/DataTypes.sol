// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.17;

/// @title Library DataTypes
library DataTypes {
    /**
    * @title Helpers Methods
    * @dev Structs for Vault Contract
    * @custom:a Alfredo Lopez / Calculum
     */
    enum Status {
        Inactive, // 0
        Pending, // 1
        Claimet, // 2
        Completed, // 3
        PendingRedeem, //4
        PendingWithdraw //5
    }
    /// Struct of Basics

    struct Basics {
        Status status;
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
}
