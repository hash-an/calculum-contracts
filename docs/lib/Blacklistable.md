# Contract Blacklistable
**Title:** Blacklistable Methods

**Author:** Alfredo Lopez / Marketingcycle / ValiFI

**Description:** Allows accounts to be blacklisted by Owner


---
### Globals Variables and Mappings

---
### Functions

#### Methods `isBlacklisted(address _account) → bool`  Visibility:  public

**Description**: Checks if account is blacklisted


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _account |

**Outputs:**
| Type | Name |
| ---- | ---- |
| bool | Variable |

**Descriptions of Arguments:**
 **_account**: The address to check 



#### Methods `addBlacklist(address _account)`  Visibility:  public

**Description**: Adds account to blacklist


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _account |


**Descriptions of Arguments:**
 **_account**: The address to blacklist 



#### Methods `dropBlacklist(address _account)`  Visibility:  public

**Description**: Removes account from blacklist


**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _account |


**Descriptions of Arguments:**
 **_account**: The address to remove from the blacklist 



#### Methods `getBlacklist() → address[]`  Visibility:  public

**Description**: Getting the List of Address Blacklisted


**Outputs:**
| Type | Name |
| ---- | ---- |
| address[] | Variable |




---
### Modifiers

#### Modifier `notBlacklisted(address _account)`

**Description:** Throws if argument account is blacklisted

**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _account |

**Descriptions of Arguments:**
 **_account**: The address to check 


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

#### Event `InBlacklisted(address _account)`

**Description:** 
**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _account |



#### Event `OutBlacklisted(address _account)`

**Description:** 
**Arguments:**
| Type | Name |
| ---- | ---- |
| address | _account |



---
### Structs

---
### Enums
