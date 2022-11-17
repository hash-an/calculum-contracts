# Contract Helpers
**Title:** 
**Author:** 

**Description:** 

---
### Globals Variables and Mappings

---
### Functions

---
### Modifiers

---
### Events

#### Event `PendingDeposit(address caller, address receiver, uint256 assets, uint256 estimationOfShares)`

**Description:** Events of Mint/Deposit Process

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | caller |
| address | receiver |
| uint256 | assets |
| uint256 | estimationOfShares |

**Descriptions of Arguments:**
 **caller**: Caller of Deposit/Mint Method
  **receiver**: Wallet Address where receive the Assets to Deposit/Mint
  **assets**: Amount of Assets to Deposit/Mint
  **estimationOfShares**: Estimation of Amount of Shares to Mint 


#### Event `PendingWithdraw(address receiver, address owner, uint256 assets, uint256 estimationOfShares)`

**Description:** Events of Withdraw/Redeem Process

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | receiver |
| address | owner |
| uint256 | assets |
| uint256 | estimationOfShares |

**Descriptions of Arguments:**
 **receiver**: Wallet Address where receive the Assets to Deposit/Mint
  **owner**: Caller of Deposit/Mint Method
  **assets**: Amount of Assets to Deposit/Mint
  **estimationOfShares**: Estimation of Amount of Shares to Mint 


#### Event `EpochChanged(uint256 OldPeriod, uint256 NewPeriod, uint256 newMaintTimeBefore, uint256 newMaintTimeAfter)`

**Description:** Epoch Changed
**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | OldPeriod |
| uint256 | NewPeriod |
| uint256 | newMaintTimeBefore |
| uint256 | newMaintTimeAfter |



#### Event `FeesTranfer(uint256 epoch, uint256 Amount)`

**Description:** Fees Transfer
**Arguments:**
| Type | Name |
| ---- | ---- |
| uint256 | epoch |
| uint256 | Amount |



---
### Structs

```solidity
struct Basics {
    enum Helpers.Status status
    uint256 amountAssets
    uint256 amountShares
    uint256 finalAmount
}
```

```solidity
struct NetTransfer {
    bool pending
    bool direction
    uint256 amount
}
```

---
### Enums
```solidity
enum Status {
    ,
    ,
    ,
    
}
```
