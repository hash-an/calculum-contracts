# Contract CalculumVault
**Title:** 
**Author:** 

**Description:** 

---
### Globals Variables and Mappings

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| contract IERC20MetadataUpgradeable | _asset |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | EPOCH_START |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| address | traderBotWallet |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| address | treasuryWallet |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | MANAGEMENT_FEE_PERCENTAGE |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | PERFORMANCE_FEE_PERCENTAGE |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| contract Oracle | oracle |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | EPOCH_DURATION |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | CURRENT_EPOCH |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | MAINTENANCE_PERIOD_PRE_START |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | MAINTENANCE_PERIOD_POST_START |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | MAX_DEPOSIT |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | MIN_DEPOSIT |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| uint256 | MAX_TOTAL_SUPPLY |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| mapping(address => struct Helpers.Basics) | DEPOSITS |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| mapping(address => struct Helpers.Basics) | WITHDRAWALS |  |  |

#### Variable
| Type | Name | Visibility | Description |
| ---- | ---- | ---------- | ----------- |
| mapping(uint256 => struct Helpers.NetTransfer) | netTransfer |  |  |

---
### Functions

#### Methods `constructor()`  Visibility:  public

**Description**: 






#### Methods `initialize(string _name, string _symbol, uint8 decimals_, contract IERC20MetadataUpgradeable _USDCToken, address _oracle, address _traderBotWallet, address _treasuryWallet, address _transferBotRoleAddress, uint256[4] _initialValue)`  Visibility:  public

**Description**: 

**Arguments:**
| Type | Name |
| ---- | ---- |
| string | _name |
| string | _symbol |
| uint8 | decimals_ |
| contract IERC20MetadataUpgradeable | _USDCToken |
| address | _oracle |
| address | _traderBotWallet |
| address | _treasuryWallet |
| address | _transferBotRoleAddress |
| uint256[4] | _initialValue |





#### Methods `pause()`  Visibility:  external

**Description**: Callable by admin or operator






#### Methods `unpause()`  Visibility:  external

**Description**: 






#### Methods `totalAssets() → uint256`  Visibility:  public

**Description**: Returns the total amount of the underlying asset that is “managed” by Vault.
TODO: About this guys the point is how reflect the real value of the asset in the Trader Bot during the  Trading Period,
TODO: Because from this depend the amount of shares that can be mint/burn in the Deposit or Withdraw methods
- SHOULD include any compounding that occurs from yield.
- MUST be inclusive of any fees that are charged against assets in the Vault.
- MUST NOT revert.


**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `NextEpoch() → uint256`  Visibility:  internal

**Description**: 


**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `CurrentEpoch() → uint256`  Visibility:  public

**Description**: Method to Update Current Epoch starting timestamp


**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `getCurrentEpoch() → uint256`  Visibility:  public

**Description**: 


**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `getNextEpoch() → uint256`  Visibility:  public

**Description**: 


**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `deposit(uint256 _assets, address _receiver) → uint256`  Visibility:  external

**Description**: Mints Vault shares to receiver by depositing exactly amount of underlying tokens.

- MUST emit the Deposit event.
- MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the
  deposit execution, and are accounted for during deposit.
- MUST revert if all of assets cannot be deposited (due to deposit limit being reached, slippage, the user not
  approving enough underlying tokens to the Vault contract, etc).

NOTE: most implementations will require pre-approval of the Vault with the Vault’s underlying asset token.

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | _assets |
| address | _receiver |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `mint(uint256 _shares, address _receiver) → uint256`  Visibility:  external

**Description**: Mints exactly Vault shares to receiver by depositing amount of underlying tokens.

- MUST emit the Deposit event.
- MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the mint
  execution, and are accounted for during mint.
- MUST revert if all of shares cannot be minted (due to deposit limit being reached, slippage, the user not
  approving enough underlying tokens to the Vault contract, etc).

NOTE: most implementations will require pre-approval of the Vault with the Vault’s underlying asset token.

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | _shares |
| address | _receiver |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `withdraw(uint256 _assets, address _receiver, address _owner) → uint256`  Visibility:  external

**Description**: Burns shares from owner and sends exactly assets of underlying tokens to receiver.

- MUST emit the Withdraw event.
- MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the
  withdraw execution, and are accounted for during withdraw.
- MUST revert if all of assets cannot be withdrawn (due to withdrawal limit being reached, slippage, the owner
  not having enough shares, etc).

Note that some implementations will require pre-requesting to the Vault before a withdrawal may be performed.
Those methods should be performed separately.

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | _assets |
| address | _receiver |
| address | _owner |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `redeem(uint256 _shares, address _receiver, address _owner) → uint256`  Visibility:  external

**Description**: Burns exactly shares from owner and sends assets of underlying tokens to receiver.

- MUST emit the Withdraw event.
- MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the
  redeem execution, and are accounted for during redeem.
- MUST revert if all of shares cannot be redeemed (due to withdrawal limit being reached, slippage, the owner
  not having enough shares, etc).

NOTE: some implementations will require pre-requesting to the Vault before a withdrawal may be performed.
Those methods should be performed separately.

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | _shares |
| address | _receiver |
| address | _owner |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `claimShares(address _owner)`  Visibility:  external

**Description**: Method to Claim Shares of the Vault (Mint)


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _owner |


**Descriptions of Arguments:**
 **_owner**: Owner of the Vault Shares to be claimed 



#### Methods `claimAssets(address _receiver, address _owner)`  Visibility:  external

**Description**: Method to Claim Assets of the Vault (Redeem)


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _receiver |
| address | _owner |


**Descriptions of Arguments:**
 **_receiver**: address of the receiver wallet
  **_owner**: Owner of the Vault Assets to be claimed 



#### Methods `setEpochDuration(uint256 _epochDuration, uint256 _maintTimeBefore, uint256 _maintTimeAfter)`  Visibility:  external

**Description**: Setting epoch duration


**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | _epochDuration |
| uint256 | _maintTimeBefore |
| uint256 | _maintTimeAfter |


**Descriptions of Arguments:**
 **_epochDuration**: New epoch duration
  **_maintTimeBefore**: New maintenance time before start epoch
  **_maintTimeAfter**: New maintenance time after end epoch 



#### Methods `finalizeEpoch()`  Visibility:  external

**Description**: Method to Finalize the Epoch, and Update all parameters and prepare for start the new Epoch






#### Methods `MgtFeePerVaultToken() → uint256`  Visibility:  public

**Description**: 


**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `PerfFeePerVaultToken() → uint256`  Visibility:  public

**Description**: 


**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `PnLPerVaultToken() → uint256`  Visibility:  public

**Description**: Method for getting Profit/Loss per vault token generated by the trading strategy for the epoch


**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `getPnLPerVaultToken() → bool`  Visibility:  public

**Description**: Method for update Profit/Loss per vault token generated by the trading strategy for the epoch
TODO: check the sign of the profit/loss, because it is negative in some cases


**Outputs:**
| Type | Name |
| ---- | ---- |
| bool | Variable |




#### Methods `dexTransfer()`  Visibility:  external

**Description**: 






#### Methods `feesTransfer()`  Visibility:  external

**Description**: FeesTranfer per Epoch






#### Methods `convertToAssets(uint256 _shares) → uint256 _assets`  Visibility:  public

**Description**: See {IERC4262-convertToAssets}

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | _shares |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | _assets |




#### Methods `convertToShares(uint256 _assets) → uint256 _shares`  Visibility:  public

**Description**: See {IERC4262-convertToAssets}

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | _assets |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | _shares |




#### Methods `isClaimerMint(address _claimer) → bool`  Visibility:  public

**Description**: Method for Verify if any caller is a Claimer of Pending Deposit


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _claimer |

**Outputs:**
| Type | Name |
| ---- | ---- |
| bool | Variable |

**Descriptions of Arguments:**
 **_claimer**: address of the wallet 



#### Methods `isClaimerWithdraw(address _claimer) → bool`  Visibility:  public

**Description**: Method for Verify if any caller is a Claimer of Pending Deposit


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _claimer |

**Outputs:**
| Type | Name |
| ---- | ---- |
| bool | Variable |

**Descriptions of Arguments:**
 **_claimer**: address of the wallet 



#### Methods `setTraderBotWallet(address _traderBotWallet)`  Visibility:  external

**Description**: Setter for the TraderBot Wallet

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _traderBotWallet |





#### Methods `isDepositWallet(address _wallet) → bool`  Visibility:  public

**Description**: 

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _wallet |

**Outputs:**
| Type | Name |
| ---- | ---- |
| bool | Variable |




#### Methods `isWithdrawWallet(address _wallet) → bool`  Visibility:  public

**Description**: 

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _wallet |

**Outputs:**
| Type | Name |
| ---- | ---- |
| bool | Variable |




#### Methods `asset() → address`  Visibility:  public

**Description**: See {IERC4262-asset}


**Outputs:**
| Type | Name |
| ---- | ---- |
| address | Variable |




#### Methods `previewDeposit(uint256 _assets) → uint256`  Visibility:  public

**Description**: See {IERC4262-previewDeposit}

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | _assets |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `previewMint(uint256 shares) → uint256`  Visibility:  public

**Description**: See {IERC4262-previewMint}

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | shares |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `previewWithdraw(uint256 assets) → uint256`  Visibility:  public

**Description**: See {IERC4262-previewWithdraw}

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | assets |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `previewRedeem(uint256 shares) → uint256`  Visibility:  public

**Description**: See {IERC4262-previewRedeem}

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | shares |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `maxDeposit(address) → uint256`  Visibility:  public

**Description**: See {IERC4262-maxDeposit}

**Arguments:**
| Type | Name |
| ---- | ---- |
| address |  |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `setInitialValue(uint256[3] _initialValue)`  Visibility:  external

**Description**: Set Min and Max Value of the Deposit and Max Total Supply of Value

**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256[3] | _initialValue |





#### Methods `maxMint(address) → uint256`  Visibility:  public

**Description**: See {IERC4262-maxMint}

**Arguments:**
| Type | Name |
| ---- | ---- |
| address |  |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `maxWithdraw(address _owner) → uint256`  Visibility:  public

**Description**: See {IERC4262-maxWithdraw}

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _owner |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `maxRedeem(address _owner) → uint256`  Visibility:  public

**Description**: See {IERC4262-maxRedeem}

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _owner |

**Outputs:**
| Type | Name |
| ---- | ---- |
| uint256 | Variable |




#### Methods `decimals() → uint8`  Visibility:  public

**Description**: 


**Outputs:**
| Type | Name |
| ---- | ---- |
| uint8 | Variable |




#### Methods `_beforeTokenTransfer(address from, address to, uint256 tokenId)`  Visibility:  internal

**Description**: 

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | from |
| address | to |
| uint256 | tokenId |





---
### Modifiers

---
### Events

---
### Structs

---
### Enums
