// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "openzeppelin-contracts-upgradeable/contracts/token/ERC20/IERC20Upgradeable.sol";

contract MockUpOracle is Ownable {
    IERC20Upgradeable private _asset;
    uint256 private Assets;
    address private traderBotWallet;

    constructor(address _wallet, IERC20Upgradeable asset) public {
        traderBotWallet = _wallet;
        _transferOwnership(msg.sender);
        _asset = asset;
        Assets = _asset.balanceOf(_wallet); // Simulate the First Deposit of Alice
    }

    function GetAccount(address _wallet) public view returns (uint256) {
        if (_wallet != traderBotWallet) revert("Not authorized");
        return Assets;
    }

    function setAssetValue(uint256 _newValue) public onlyOwner {
        Assets = _newValue;
    }
}
