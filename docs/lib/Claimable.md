# Contract Claimable
**Title:** Claimable Methods

**Author:** Alfredo Lopez / Marketingcycle / ValiFI

**Description:** Implementation of the claiming utils that can be useful for withdrawing accidentally sent tokens that are not used in bridge operations.


---
### Globals Variables and Mappings

---
### Functions

#### Methods `receive()`  Visibility:  external

**Description**: 






#### Methods `claimValues(address _token, address _to)`  Visibility:  public

**Description**: Withdraws the erc20 tokens or native coins from this contract.
Caller should additionally check that the claimed token is not a part of bridge operations (i.e. that token != erc20token()).


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _token |
| address | _to |


**Descriptions of Arguments:**
 **_token**: address of the claimed token or address(0) for native coins.
  **_to**: address of the tokens/coins receiver. 



#### Methods `_claimErc721Tokens(address _token, address _to)`  Visibility:  public

**Description**: Internal function for withdrawing all tokens of some particular ERC721 contract from this contract.


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _token |
| address | _to |


**Descriptions of Arguments:**
 **_token**: address of the claimed ERC721 token.
  **_to**: address of the tokens receiver. 



#### Methods `_claimErc1155Tokens(address _token, address _to, uint256 _id)`  Visibility:  public

**Description**: Internal function for withdrawing all tokens of some particular ERC721 contract from this contract.


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _token |
| address | _to |
| uint256 | _id |


**Descriptions of Arguments:**
 **_token**: address of the claimed ERC721 token.
  **_to**: address of the tokens receiver. 



---
### Modifiers

#### Modifier `validAddress(address _to)`

**Description:** Throws if a given address is equal to address(0)

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _to |

**Descriptions of Arguments:**
 **_to**: The address to check 


---
### Events

#### Event `ValueReceived(address sender, uint256 value)`

**Description:** 
**Arguments:**
| Type | Name |
| ---- | ---- |
| address | sender |
| uint256 | value |



---
### Structs

---
### Enums
