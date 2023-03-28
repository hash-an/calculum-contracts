// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./lib/IERC4626.sol";
import "./lib/Claimable.sol";
import "./lib/Helpers.sol";
import "@openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin-contracts-upgradeable/contracts/security/PausableUpgradeable.sol";
import "@openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "@openzeppelin-contracts-upgradeable/contracts/security/ReentrancyGuardUpgradeable.sol";
import "@uniswap/v2-periphery/interfaces/IUniswapV2Router02.sol";

// import "hardhat/console.sol";

interface Oracle {
    function GetAccount(address _wallet) external view returns (uint256);
}

/**
 * @title Calculum Vault
 * @dev Vault based on ERC-4626
 * @custom:a Alfredo Lopez / Calculum
 */
contract CalculumVault is
    IERC4626,
    ERC20Upgradeable,
    PausableUpgradeable,
    Claimable,
    Helpers,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeMathUpgradeable for uint256;
    using MathUpgradeable for uint256;
    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    // Principal private Variable of ERC4626

    IERC20MetadataUpgradeable internal _asset;
    uint8 private _decimals;
    // Flag to Control Start Sales of Shares
    uint256 public EPOCH_START; // start 10 July 2022, Sunday 22:00:00  UTC
    // Transfer Bot Wallet in DEX
    address payable private transferBotRoleWallet;
    // Transfer Bot Wallet in DEX
    address payable public transferBotWallet;
    // Treasury Wallet of Calculum
    address public treasuryWallet;
    // Management Fee percentage , e.g. 1% = 1 / 100
    uint256 public MANAGEMENT_FEE_PERCENTAGE;
    // Performace Fee percentage , e.g. 15% = 15 / 100
    uint256 public PERFORMANCE_FEE_PERCENTAGE;
    // Vault Token Price per EPOCH
    mapping(uint256 => uint256) private VAULT_TOKEN_PRICE;
    // Total Supply per EPOCH
    mapping(uint256 => uint256) private TOTAL_VAULT_TOKEN_SUPPLY;
    /// @dev Address of Uniswap v2 router to swap whitelisted ERC20 tokens to router.WETH()
    IUniswapV2Router02 public router;
    // Interface for Oracle
    Oracle public oracle;
    // Period
    uint256 public EPOCH_DURATION; // 604800 seconds = 1 week
    // Number of Periods
    uint256 public CURRENT_EPOCH; // Number of epochs since the start
    // Maintenance Period Before Start (in seconds)
    uint256 public MAINTENANCE_PERIOD_PRE_START;
    // Maintenance Period After Start (in seconds)
    uint256 public MAINTENANCE_PERIOD_POST_START;
    // Actual Value of Assets during Trader Period
    uint256 private DEX_WALLET_BALANCE;
    // Max Deposit
    uint256 public MAX_DEPOSIT;
    // Min Deposit
    uint256 public MIN_DEPOSIT;
    // Max Total Assets
    uint256 public MAX_TOTAL_DEPOSIT;
    // Minimal Wallet Ballance USDC in Transfer Bot
    uint256 public MIN_WALLET_BALANCE_USDC_TRANSFER_BOT;
    // Wallet Target Balance USDC in Transfer Bot
    uint256 public TARGET_WALLET_BALANCE_USDC_TRANSFER_BOT;
    // Minimal Wallet Balance of ETH in Transfer Bot
    uint256 public MIN_WALLET_BALANCE_ETH_TRANSFER_BOT;
    // ETH Gas Reserve in USDC in Transfer Bot
    uint256 public ETH_GAS_RESERVE_USDC_TRANSFER_BOT;
    // Array of Wallet Addresses with Deposit
    address[] private depositWallets;
    // Mapping Deposits
    mapping(address => Basics) public DEPOSITS; // Mapping of Deposits Realized
    // Array of Wallet Addresses with Withdraw
    address[] private withdrawWallets;
    // Mapping Withdrawals
    mapping(address => Basics) public WITHDRAWALS; // Mapping of Withdrawals Realized
    // Constant for TraderBot Role
    bytes32 private constant TRANSFER_BOT_ROLE = keccak256("TRANSFER_BOT_ROLE");
    // Mapping of Struct NetTransfer
    mapping(uint256 => NetTransfer) public netTransfer; // Mapping of Struct NetTransfer based on EPOCH
    // mapping for whitelist of wallet to access the Vault
    mapping(address => bool) public whitelist;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier whitelisted(address wallet) {
        if (whitelist[wallet] == false) {
            revert NotWhitelisted(wallet);
        }
        _;
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        uint8 decimals_,
        IERC20MetadataUpgradeable _USDCToken,
        address _oracle,
        address _transferBotWallet,
        address _treasuryWallet,
        address _transferBotRoleAddress,
        address _router,
        uint256[7] memory _initialValue // 0: Start timestamp, 1: Min Deposit, 2: Max Deposit, 3: Max Total Supply Value
    ) public reinitializer(1) {
        if (!address(_USDCToken).isContract()) {
            revert AddressIsNotContract(address(_USDCToken));
        }
        if (!_oracle.isContract()) revert AddressIsNotContract(_oracle);
        __Ownable_init();
        __ReentrancyGuard_init();
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(TRANSFER_BOT_ROLE, _transferBotRoleAddress);
        __ERC20_init(_name, _symbol);
        _asset = _USDCToken;
        _decimals = decimals_;
        oracle = Oracle(_oracle);
        router = IUniswapV2Router02(_router);
        transferBotWallet = payable(_transferBotWallet);
        transferBotRoleWallet = payable(_transferBotRoleAddress);
        treasuryWallet = _treasuryWallet;
        EPOCH_START = _initialValue[0];
        MIN_DEPOSIT = _initialValue[1];
        MAX_DEPOSIT = _initialValue[2];
        MAX_TOTAL_DEPOSIT = _initialValue[3];
        MIN_WALLET_BALANCE_USDC_TRANSFER_BOT = _initialValue[4];
        TARGET_WALLET_BALANCE_USDC_TRANSFER_BOT = _initialValue[5];
        MIN_WALLET_BALANCE_ETH_TRANSFER_BOT = _initialValue[6];
        EPOCH_DURATION = 1 weeks; // 604800 seconds = 1 week
        MAINTENANCE_PERIOD_PRE_START = 60 minutes; // 60 minutes
        MAINTENANCE_PERIOD_POST_START = 30 minutes; // 30 minutes
        CurrentEpoch();
        MANAGEMENT_FEE_PERCENTAGE = 1 ether / 100; // Represent 1%
        PERFORMANCE_FEE_PERCENTAGE = 15 ether / 100; // Represent 15%
    }

    /**
     * @notice called by the admin to pause, triggers stopped state
     * @dev Callable by admin or operator
     */
    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    /**
     * @notice called by the admin to unpause, returns to normal state
     * Reset genesis state. Once paused, the rounds would need to be kickstarted by genesis
     */
    function unpause() external whenPaused onlyOwner {
        _unpause();
    }

    /**
     * @dev Returns the total amount of the underlying asset that is “managed” by Vault.
     * TODO: About this guys the point is how reflect the real value of the asset in the Trader Bot during the  Trading Period,
     * TODO: Because from this depend the amount of shares that can be mint/burn in the Deposit or Withdraw methods
     * - SHOULD include any compounding that occurs from yield.
     * - MUST be inclusive of any fees that are charged against assets in the Vault.
     * - MUST NOT revert.
     */
    function totalAssets() public view override returns (uint256) {
        return DEX_WALLET_BALANCE;
    }

    /**
     * Method to Update Next Epoch starting timestamp
     */
    function NextEpoch() internal returns (uint256) {
        if (
            block.timestamp >
            EPOCH_START + (EPOCH_DURATION * (CURRENT_EPOCH + 1))
        ) {
            ++CURRENT_EPOCH;
        }
        return EPOCH_START + (EPOCH_DURATION * (CURRENT_EPOCH + 1));
    }

    /**
     * @dev Method to Update Current Epoch starting timestamp
     */
    function CurrentEpoch() public onlyOwner returns (uint256) {
        return NextEpoch() - EPOCH_DURATION;
    }

    function getCurrentEpoch() public view returns (uint256) {
        return getNextEpoch() - EPOCH_DURATION;
    }

    function getNextEpoch() public view returns (uint256) {
        return EPOCH_START + (EPOCH_DURATION * (CURRENT_EPOCH + 1));
    }

    /**
     * @dev Mints Vault shares to receiver by depositing exactly amount of underlying tokens.
     *
     * - MUST emit the Deposit event.
     * - MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the
     *   deposit execution, and are accounted for during deposit.
     * - MUST revert if all of assets cannot be deposited (due to deposit limit being reached, slippage, the user not
     *   approving enough underlying tokens to the Vault contract, etc).
     *
     * NOTE: most implementations will require pre-approval of the Vault with the Vault’s underlying asset token.
     */
    function deposit(
        uint256 _assets,
        address _receiver
    )
        external
        override
        validAddress(_receiver)
        whitelisted(_msgSender())
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        _checkVaultInMaintenance();
        address caller = _msgSender();
        Basics storage depositor = DEPOSITS[_receiver];
        if (_receiver != caller) {
            revert CallerIsNotOwner(caller, _receiver);
        }
        if (_assets < MIN_DEPOSIT) {
            revert DepositAmountTooLow(_receiver, _assets);
        }
        if (
            _assets >
            (
                maxDeposit(_receiver).sub(
                    depositor.finalAmount.add(depositor.amountAssets)
                )
            )
        ) {
            // Verify the maximun value per user
            revert DepositExceededMax(
                _receiver,
                maxDeposit(_receiver).sub(
                    depositor.finalAmount.add(depositor.amountAssets)
                )
            );
        }
        if (totalAssets().add(_assets) > MAX_TOTAL_DEPOSIT) {
            revert DepositExceedTotalVaultMax(
                _receiver,
                totalAssets().add(_assets),
                MAX_TOTAL_DEPOSIT
            );
        }

        uint256 shares = previewDeposit(_assets);

        // if _asset is ERC777, transferFrom can call reenter BEFORE the transfer happens through
        // the tokensToSend hook, so we need to transfer before we mint to keep the invariants.
        SafeERC20Upgradeable.safeTransferFrom(
            _asset,
            _receiver,
            address(this),
            _assets
        );
        addDeposit(_receiver, shares, _assets);

        emit PendingDeposit(caller, _receiver, _assets, shares);

        return shares;
    }

    /**
     * @dev Mints exactly Vault shares to receiver by depositing amount of underlying tokens.
     *
     * - MUST emit the Deposit event.
     * - MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the mint
     *   execution, and are accounted for during mint.
     * - MUST revert if all of shares cannot be minted (due to deposit limit being reached, slippage, the user not
     *   approving enough underlying tokens to the Vault contract, etc).
     *
     * NOTE: most implementations will require pre-approval of the Vault with the Vault’s underlying asset token.
     */
    function mint(
        uint256 _shares,
        address _receiver
    ) external override returns (uint256) {}

    /**
     * @dev Burns shares from owner and sends exactly assets of underlying tokens to receiver.
     *
     * - MUST emit the Withdraw event.
     * - MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the
     *   withdraw execution, and are accounted for during withdraw.
     * - MUST revert if all of assets cannot be withdrawn (due to withdrawal limit being reached, slippage, the owner
     *   not having enough shares, etc).
     *
     * Note that some implementations will require pre-requesting to the Vault before a withdrawal may be performed.
     * Those methods should be performed separately.
     */
    function withdraw(
        uint256 _assets,
        address _receiver,
        address _owner
    )
        external
        override
        validAddress(_owner)
        validAddress(_receiver)
        whitelisted(_msgSender())
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        _checkVaultInMaintenance();
        address caller = _msgSender();
        if ((_owner != caller) || (_receiver != caller)) {
            revert CallerIsNotOwnerOrReceiver(caller, _owner, _receiver);
        }
        if (_assets == 0) revert AmountMustBeGreaterThanZero(caller);
        if (_assets > maxWithdraw(_owner)) {
            revert NotEnoughBalance(_assets, maxWithdraw(_owner));
        }

        uint256 shares = previewWithdraw(_assets);

        // if _asset is ERC777, transfer can call reenter AFTER the transfer happens through
        // the tokensReceived hook, so we need to transfer after we burn to keep the invariants.
        addWithdraw(_receiver, shares, _assets);

        emit PendingWithdraw(_receiver, _owner, _assets, shares);

        return shares;
    }

    /**
     * @dev Burns exactly shares from owner and sends assets of underlying tokens to receiver.
     *
     * - MUST emit the Withdraw event.
     * - MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the
     *   redeem execution, and are accounted for during redeem.
     * - MUST revert if all of shares cannot be redeemed (due to withdrawal limit being reached, slippage, the owner
     *   not having enough shares, etc).
     *
     * NOTE: some implementations will require pre-requesting to the Vault before a withdrawal may be performed.
     * Those methods should be performed separately.
     */
    function redeem(
        uint256 _shares,
        address _receiver,
        address _owner
    )
        external
        override
        validAddress(_owner)
        validAddress(_receiver)
        whitelisted(_msgSender())
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        _checkVaultInMaintenance();
        address caller = _msgSender();
        if ((_owner != caller) || (_receiver != caller)) {
            revert CallerIsNotOwnerOrReceiver(caller, _owner, _receiver);
        }
        if (_shares == 0) revert AmountMustBeGreaterThanZero(caller);
        if (_shares > maxRedeem(_owner)) {
            revert NotEnoughBalance(_shares, maxRedeem(_owner));
        }

        uint256 assets = previewRedeem(_shares);

        // if _asset is ERC777, transfer can call reenter AFTER the transfer happens through
        // the tokensReceived hook, so we need to transfer after we burn to keep the invariants.
        addWithdraw(_receiver, _shares, assets);

        emit PendingWithdraw(_receiver, _owner, assets, _shares);

        return assets;
    }

    /**
     * @dev Add deposit wallet, assets and shares
     * @param _wallet address of the wallet
     * @param _shares amount of shares to add for minting
     * @param _assets amount of assets the deposit
     */
    // Add Epoch Time
    function addDeposit(
        address _wallet,
        uint256 _shares,
        uint256 _assets
    ) private {
        if (!isDepositWallet(_wallet)) depositWallets.push(_wallet);
        if (DEPOSITS[_wallet].status == Status.Inactive) {
            DEPOSITS[_wallet] = Basics({
                status: Status.Pending,
                amountAssets: _assets,
                amountShares: _shares,
                finalAmount: uint256(0)
            });
        } else {
            DEPOSITS[_wallet].status = Status.Pending;
            DEPOSITS[_wallet].amountAssets += _assets;
            DEPOSITS[_wallet].amountShares += _shares;
        }
    }

    /**
     * @dev Add withdraws wallet, assets and shares
     * @param _wallet address of the wallet
     * @param _shares amount of shares to add for minting
     * @param _assets amount of assets the deposit
     */
    function addWithdraw(
        address _wallet,
        uint256 _shares,
        uint256 _assets
    ) private {
        if (!isWithdrawWallet(_wallet)) withdrawWallets.push(_wallet);
        if (WITHDRAWALS[_wallet].status == Status.Inactive) {
            WITHDRAWALS[_wallet] = Basics({
                status: Status.Pending,
                // pending: true,
                // claimer: false,
                amountAssets: _assets,
                amountShares: _shares,
                finalAmount: uint256(0)
            });
        } else {
            WITHDRAWALS[_wallet].status = Status.Pending;
            WITHDRAWALS[_wallet].amountAssets += _assets;
            WITHDRAWALS[_wallet].amountShares += _shares;
        }
    }

    /**
     * @dev Method to Claim Shares of the Vault (Mint)
     * @param _owner Owner of the Vault Shares to be claimed
     */
    function claimShares(
        address _owner
    ) external whitelisted(_msgSender()) nonReentrant {
        _checkVaultInMaintenance();
        address caller = _msgSender();
        if (_owner != caller) {
            revert CallerIsNotOwner(caller, _owner);
        }
        if (!isClaimerMint(_owner)) revert CalletIsNotClaimerToDeposit(_owner);
        _mint(_owner, DEPOSITS[_owner].amountShares);
        emit Deposit(
            caller,
            _owner,
            DEPOSITS[_owner].finalAmount,
            DEPOSITS[_owner].amountShares
        );
        delete DEPOSITS[_owner].amountShares;
        DEPOSITS[_owner].status = Status.Completed;
    }

    /**
     * @dev Method to Claim Assets of the Vault (Redeem)
     * @param _receiver address of the receiver wallet
     * @param _owner Owner of the Vault Assets to be claimed
     */
    function claimAssets(
        address _receiver,
        address _owner
    ) external whitelisted(_msgSender()) nonReentrant {
        _checkVaultInMaintenance();
        address caller = _msgSender();
        Basics storage withdrawer = WITHDRAWALS[_owner];
        if (_owner != caller) {
            revert CallerIsNotOwner(caller, _owner);
        }
        if (!isClaimerWithdraw(_owner)) {
            revert CalletIsNotClaimerToRedeem(_owner);
        }
        // TODO: add a verification of the amount shares to be redeemed
        if (withdrawer.finalAmount > _asset.balanceOf(address(this))) {
            revert NotEnoughBalance(
                withdrawer.finalAmount,
                _asset.balanceOf(address(this))
            );
        }
        _burn(_owner, withdrawer.amountShares);
        SafeERC20Upgradeable.safeTransfer(
            _asset,
            _receiver,
            withdrawer.finalAmount
        );
        emit Withdraw(
            caller,
            _receiver,
            _owner,
            withdrawer.finalAmount,
            withdrawer.amountShares
        );
        delete withdrawer.amountAssets;
        delete withdrawer.amountShares;
        withdrawer.status = Status.Completed;
    }

    /**
     * @dev Setting epoch duration
     * @param _epochDuration New epoch duration
     * @param _maintTimeBefore New maintenance time before start epoch
     * @param _maintTimeAfter New maintenance time after end epoch
     */
    function setEpochDuration(
        uint256 _epochDuration,
        uint256 _maintTimeBefore,
        uint256 _maintTimeAfter
    ) external onlyOwner {
        _checkVaultInMaintenance();
        if (_epochDuration < 1 minutes || _epochDuration > 12 weeks) {
            revert WrongEpochDuration(_epochDuration);
        }
        if (
            _epochDuration.mod(1 minutes) != 0 &&
            _epochDuration.mod(1 days) != 0 &&
            _epochDuration.mod(1 weeks) != 0 &&
            _maintTimeBefore.mod(1 minutes) != 0 &&
            _maintTimeBefore.mod(1 days) != 0 &&
            _maintTimeBefore.mod(1 weeks) != 0 &&
            _maintTimeAfter.mod(1 minutes) != 0 &&
            _maintTimeAfter.mod(1 days) != 0 &&
            _maintTimeAfter.mod(1 weeks) != 0
        ) {
            revert WrongEpochDefinition(
                _epochDuration,
                _maintTimeBefore,
                _maintTimeAfter
            );
        }
        uint256 oldEpochDuration = EPOCH_DURATION;
        EPOCH_DURATION = _epochDuration;
        MAINTENANCE_PERIOD_PRE_START = _maintTimeBefore;
        MAINTENANCE_PERIOD_POST_START = _maintTimeAfter;
        emit EpochChanged(
            oldEpochDuration,
            _epochDuration,
            _maintTimeBefore,
            _maintTimeAfter
        );
    }

    /**
     * @dev Contract for Getting Actual Balance of the TraderBot Wallet in Dydx
     */
    function DexWalletBalance() private {
        if ((totalSupply() == 0) && (CURRENT_EPOCH == 0)) {
            DEX_WALLET_BALANCE = newDeposits();
        } else {
            DEX_WALLET_BALANCE = oracle.GetAccount(address(transferBotWallet));
            if (DEX_WALLET_BALANCE == 0) {
                revert ActualAssetValueIsZero(
                    address(oracle),
                    address(transferBotWallet)
                );
            }
        }
    }

    /**
     * @dev Method to Finalize the Epoch, and Update all parameters and prepare for start the new Epoch
     */
    function finalizeEpoch() external onlyRole(TRANSFER_BOT_ROLE) nonReentrant {
        /**
         * Follow the Initial Vault Mechanics Define by Simplified Implementation
         */
        _checkVaultOutMaintenance();
        DexWalletBalance();
        VAULT_TOKEN_PRICE[CURRENT_EPOCH] = convertToAssets(1 ether);
        for (uint256 i = 0; i < depositWallets.length; i++) {
            if (DEPOSITS[depositWallets[i]].status == Status.Pending) {
                DEPOSITS[depositWallets[i]].amountShares = convertToShares(
                    DEPOSITS[depositWallets[i]].amountAssets
                );
            }
        }
        for (uint256 i = 0; i < withdrawWallets.length; i++) {
            if (WITHDRAWALS[withdrawWallets[i]].status == Status.Pending) {
                WITHDRAWALS[withdrawWallets[i]].amountShares = convertToShares(
                    WITHDRAWALS[withdrawWallets[i]].amountAssets
                );
            }
        }

        updateTotalSupply();
        netTransferBalance();
        for (uint256 i = 0; i < depositWallets.length; i++) {
            if (DEPOSITS[depositWallets[i]].status == Status.Pending) {
                DEPOSITS[depositWallets[i]].status = Status.Claimet;
                DEPOSITS[depositWallets[i]].amountShares = convertToShares(
                    DEPOSITS[depositWallets[i]].amountAssets
                );
                DEPOSITS[depositWallets[i]].finalAmount += DEPOSITS[
                    depositWallets[i]
                ].amountAssets;
                delete DEPOSITS[depositWallets[i]].amountAssets;
            }
        }
        for (uint256 i = 0; i < withdrawWallets.length; i++) {
            if (WITHDRAWALS[withdrawWallets[i]].status == Status.Pending) {
                WITHDRAWALS[withdrawWallets[i]].status = Status.Claimet;
                WITHDRAWALS[withdrawWallets[i]].amountShares = convertToShares(
                    WITHDRAWALS[withdrawWallets[i]].amountAssets
                );
                WITHDRAWALS[withdrawWallets[i]].finalAmount += WITHDRAWALS[
                    withdrawWallets[i]
                ].amountAssets;
                delete WITHDRAWALS[withdrawWallets[i]].amountAssets;
            }
        }
    }

    function MgtFeePerVaultToken() public view returns (uint256) {
        if (CURRENT_EPOCH == 0) {
            return 0;
        } else {
            return
                VAULT_TOKEN_PRICE[CURRENT_EPOCH.sub(1)].mulDiv(
                    MANAGEMENT_FEE_PERCENTAGE.mulDiv(EPOCH_DURATION, 31556926), // the constants is the more appropriate way to indicate a years (equivalent 365.24 days)
                    10 ** decimals(),
                    MathUpgradeable.Rounding.Up
                );
        }
    }

    function PerfFeePerVaultToken() public view returns (uint256) {
        if (CURRENT_EPOCH == 0) return 0;
        if (getPnLPerVaultToken()) {
            return
                PnLPerVaultToken().mulDiv(
                    PERFORMANCE_FEE_PERCENTAGE,
                    10 ** decimals(),
                    MathUpgradeable.Rounding.Up
                );
        } else {
            return 0;
        }
    }

    /**
     * @dev Method for getting Profit/Loss per vault token generated by the trading strategy for the epoch
     */
    function PnLPerVaultToken() public view returns (uint256) {
        if (CURRENT_EPOCH == 0) return 0;
        if (getPnLPerVaultToken()) {
            return (
                DEX_WALLET_BALANCE
                    .mulDiv(
                        10 ** _asset.decimals(),
                        TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH.sub(1)].mulDiv(
                            10 ** _asset.decimals(),
                            10 ** decimals()
                        )
                    )
                    .sub(VAULT_TOKEN_PRICE[CURRENT_EPOCH.sub(1)])
            );
        } else {
            return (
                VAULT_TOKEN_PRICE[CURRENT_EPOCH.sub(1)].sub(
                    DEX_WALLET_BALANCE.mulDiv(
                        10 ** _asset.decimals(),
                        TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH.sub(1)].mulDiv(
                            10 ** _asset.decimals(),
                            10 ** decimals()
                        )
                    )
                )
            );
        }
    }

    /**
     * @dev Method for update Profit/Loss per vault token generated by the trading strategy for the epoch
     * TODO: check the sign of the profit/loss, because it is negative in some cases
     */
    function getPnLPerVaultToken() public view returns (bool) {
        if (CURRENT_EPOCH == 0) return false;
        return (DEX_WALLET_BALANCE.mulDiv(
            10 ** _asset.decimals(),
            TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH.sub(1)].mulDiv(
                10 ** _asset.decimals(),
                10 ** decimals()
            )
        ) >= VAULT_TOKEN_PRICE[CURRENT_EPOCH.sub(1)]);
    }

    /// @dev Method to get the price of 1 token of tokenAddress if swapped for router.WETH()
    /// @param tokenAddress ERC20 token address of a whitelisted ERC20 token
    /// @return price Price in payment Token equivalent with its decimals
    function getPriceInPaymentToken(
        address tokenAddress
    ) public view returns (uint256 price) {
        if (tokenAddress == address(router.WETH())) return 1;

        address[] memory path = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        path[0] = address(tokenAddress);
        path[1] = address(router.WETH());
        amounts = router.getAmountsOut(
            1 * 10 ** IERC20MetadataUpgradeable(tokenAddress).decimals(),
            path
        );

        price = amounts[1];
    }

    /**
     * @dev  Method for Update Total Supply
     */
    function updateTotalSupply() private {
        if (CURRENT_EPOCH != 0) {
            TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH] = TOTAL_VAULT_TOKEN_SUPPLY[
                CURRENT_EPOCH.sub(1)
            ].add(newShares()).sub(newWithdrawalsShares());
        } else {
            TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH] = newShares();
        }
    }

    /**
     * @dev Method to Calculate the Transfer Bot Gas Reserve in USDC in the current epoch
     */
    function CalculateTransferBotGasReserveDA() public view returns (uint256) {
        if (CURRENT_EPOCH == 0) return 0;
        uint256 targetBalance = TARGET_WALLET_BALANCE_USDC_TRANSFER_BOT;
        uint256 currentBalance = _asset.balanceOf(transferBotRoleWallet);

        // Calculate the missing USDC amount to reach the target balance
        uint256 missingAmount = targetBalance > currentBalance
            ? targetBalance - currentBalance
            : 0;

        // Calculate the total fees to be collected for the current epoch
        uint256 totalFees = getPnLPerVaultToken()
            ? (MgtFeePerVaultToken().add(PerfFeePerVaultToken())).mul(
                TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH.sub(1)].mulDiv(
                    1,
                    10 ** decimals()
                )
            )
            : MgtFeePerVaultToken().mul(
                TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH.sub(1)].mulDiv(
                    1,
                    10 ** decimals()
                )
            );

        // Take the smallest amount between the missing USDC and the total fees
        // Deduct the amount from the fees sent to the protocol Treasury Wallet
        return missingAmount < totalFees ? missingAmount : totalFees;
    }

    function _swapDAforETH() private {
        if (
            (transferBotWallet.balance < MIN_WALLET_BALANCE_ETH_TRANSFER_BOT) &&
            (_asset.balanceOf(transferBotWallet) >
                MIN_WALLET_BALANCE_USDC_TRANSFER_BOT)
        ) {
            uint256 swapAmount = _asset.balanceOf(transferBotWallet);
            _swapTokensForETH(
                address(_asset),
                swapAmount,
                swapAmount.mulDiv(
                    getPriceInPaymentToken(address(_asset)),
                    1 ether
                )
            );
        }
    }

    /// @dev Internal method to swap ERC20 whitelisted tokens for payment Token
    /// @param tokenAddress ERC20 token address of the whitelisted address
    /// @param tokenAmount Amount of tokens to be swapped with UniSwap v2 router to payment Token
    function _swapTokensForETH(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 expectedAmount
    ) private {
        address[] memory path = new address[](2);
        path[0] = address(tokenAddress);
        path[1] = address(router.WETH());

        /// do the swap
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            expectedAmount.mulDiv(0.9 ether, 1 ether), // Allow for up to 10% max slippage
            path,
            address(this),
            block.timestamp
        );
    }

    function netTransferBalance() private {
        NetTransfer storage actualTx = netTransfer[CURRENT_EPOCH];
        if ((totalSupply() == 0) && (CURRENT_EPOCH == 0)) {
            actualTx.pending = true;
            actualTx.direction = true;
            actualTx.amount = newDeposits();
        } else {
            if (
                newDeposits() >
                newWithdrawals().add(
                    MgtFeePerVaultToken().add(PerfFeePerVaultToken()).mulDiv(
                        TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH.sub(1)],
                        10 ** decimals()
                    )
                )
            ) {
                actualTx.pending = true;
                actualTx.direction = true;
                actualTx.amount = newDeposits().sub(
                    newWithdrawals().add(
                        MgtFeePerVaultToken()
                            .add(PerfFeePerVaultToken())
                            .mulDiv(
                                TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH.sub(1)],
                                10 ** decimals()
                            )
                    )
                );
            } else {
                actualTx.pending = true;
                actualTx.direction = false;
                actualTx.amount = newWithdrawals()
                    .add(
                        MgtFeePerVaultToken()
                            .add(PerfFeePerVaultToken())
                            .mulDiv(
                                TOTAL_VAULT_TOKEN_SUPPLY[CURRENT_EPOCH.sub(1)],
                                10 ** decimals()
                            )
                    )
                    .sub(newDeposits());
            }
        }
    }

    function dexTransfer() external onlyRole(TRANSFER_BOT_ROLE) nonReentrant {
        NetTransfer storage actualTx = netTransfer[CURRENT_EPOCH];
        _checkVaultOutMaintenance();
        if (actualTx.pending) {
            if (actualTx.direction) {
                SafeERC20Upgradeable.safeTransfer(
                    _asset,
                    address(transferBotWallet),
                    actualTx.amount
                );
                uint256 reserveGas = CalculateTransferBotGasReserveDA();
                if (reserveGas > 0) {
                    if (_asset.balanceOf(address(this)) < reserveGas) {
                        revert NotEnoughBalance(
                            reserveGas,
                            _asset.balanceOf(address(this))
                        );
                    }
                    SafeERC20Upgradeable.safeTransfer(
                        _asset,
                        transferBotRoleWallet,
                        reserveGas
                    );
                }
            } else {
                SafeERC20Upgradeable.safeTransferFrom(
                    _asset,
                    address(transferBotWallet),
                    address(transferBotRoleWallet),
                    actualTx.amount
                );
            }
            actualTx.pending = false;
        }
        emit DexTransfer(CURRENT_EPOCH, actualTx.amount);
    }

    /**
     * @dev FeesTranfer per Epoch
     */
    function feesTransfer() external onlyRole(TRANSFER_BOT_ROLE) nonReentrant {
        _checkVaultOutMaintenance();
        if (CURRENT_EPOCH == 0) revert FirstEpochNoFeeTransfer();
		uint256 rest = _asset.balanceOf(address(this));
        if (rest > 0) SafeERC20Upgradeable.safeTransfer(_asset, treasuryWallet, rest);
        emit FeesTransfer(CURRENT_EPOCH, rest);
    }

    /**
     * @dev Fucntion to add wallet in the mapping of whitelist
     */
    function addDropWhitelist(address _wallet, bool status) external onlyOwner {
        whitelist[_wallet] = status;
    }

    /**
     * @dev See {IERC4262-convertToAssets}
     */
    function convertToAssets(
        uint256 _shares
    ) public view override returns (uint256 _assets) {
        uint256 supply = totalSupply();
        if (CURRENT_EPOCH == 0) {
            return
                (supply == 0)
                    ? (_shares * 10 ** _asset.decimals()) / 10 ** decimals()
                    : (_shares * totalAssets()) / supply;
        } else {
            _assets = _shares.mulDiv(
                UpdateVaultPriceToken(),
                10 ** decimals(),
                MathUpgradeable.Rounding.Up
            );
        }
    }

    /**
     * @dev See {IERC4262-convertToAssets}
     */
    function convertToShares(
        uint256 _assets
    ) public view override returns (uint256 _shares) {
        uint256 supply = totalSupply();
        if (CURRENT_EPOCH == 0) {
            return
                (_assets == 0 || supply == 0)
                    ? (_assets * 10 ** decimals()) / 10 ** _asset.decimals()
                    : (_assets * supply) / totalAssets();
        } else {
            _shares = _assets.mulDiv(
                10 ** decimals(),
                UpdateVaultPriceToken(),
                MathUpgradeable.Rounding.Up
            );
        }
    }

    function UpdateVaultPriceToken() private view returns (uint256) {
        if (getPnLPerVaultToken()) {
            return
                (
                    VAULT_TOKEN_PRICE[CURRENT_EPOCH.sub(1)].add(
                        PnLPerVaultToken()
                    )
                ).sub(MgtFeePerVaultToken().add(PerfFeePerVaultToken())).add(1);
        } else {
            return
                VAULT_TOKEN_PRICE[CURRENT_EPOCH.sub(1)]
                    .sub(
                        PnLPerVaultToken().add(
                            MgtFeePerVaultToken().add(PerfFeePerVaultToken())
                        )
                    )
                    .add(1);
        }
    }

    /**
     * @dev Method for Verify if any caller is a Claimer of Pending Deposit
     * @param _claimer address of the wallet
     */
    function isClaimerMint(address _claimer) public view returns (bool) {
        return DEPOSITS[_claimer].status == Status.Claimet;
    }

    /**
     * @dev Method for Verify if any caller is a Claimer of Pending Deposit
     * @param _claimer address of the wallet
     */
    function isClaimerWithdraw(address _claimer) public view returns (bool) {
        return WITHDRAWALS[_claimer].status == Status.Claimet;
    }

    /**
     * @dev Setter for the TraderBot Wallet
     */
    function setTransferBotWallet(
        address _transferBotWallet
    ) external onlyOwner {
        transferBotWallet = payable(_transferBotWallet);
    }

    function isDepositWallet(address _wallet) public view returns (bool) {
        for (uint256 i = 0; i < depositWallets.length; i++) {
            if (depositWallets[i] == _wallet) {
                return true;
            }
        }
        return false;
    }

    function isWithdrawWallet(address _wallet) public view returns (bool) {
        for (uint256 i = 0; i < withdrawWallets.length; i++) {
            if (withdrawWallets[i] == _wallet) {
                return true;
            }
        }
        // TODO: Analyse if need to delete the withdraw wallets
        return false;
    }

    function newDeposits() private view returns (uint256 _total) {
        for (uint256 i = 0; i < depositWallets.length; i++) {
            if (DEPOSITS[depositWallets[i]].status == Status.Pending) {
                _total += DEPOSITS[depositWallets[i]].amountAssets;
            }
        }
    }

    function newShares() private view returns (uint256 _total) {
        for (uint256 i = 0; i < depositWallets.length; i++) {
            if (DEPOSITS[depositWallets[i]].status == Status.Pending) {
                _total += DEPOSITS[depositWallets[i]].amountShares;
            }
        }
    }

    function newWithdrawals() private view returns (uint256 _total) {
        for (uint256 i = 0; i < withdrawWallets.length; i++) {
            if (WITHDRAWALS[withdrawWallets[i]].status == Status.Pending) {
                _total += WITHDRAWALS[withdrawWallets[i]].amountAssets;
            }
        }
    }

    function newWithdrawalsShares() private view returns (uint256 _total) {
        for (uint256 i = 0; i < withdrawWallets.length; i++) {
            if (WITHDRAWALS[withdrawWallets[i]].status == Status.Pending) {
                _total += WITHDRAWALS[withdrawWallets[i]].amountShares;
            }
        }
    }

    /**
     * @dev See {IERC4262-asset}
     */
    function asset() public view virtual override returns (address) {
        return address(_asset);
    }

    /**
     * @dev See {IERC4262-previewDeposit}
     */
    function previewDeposit(uint256 _assets) public view returns (uint256) {
        return convertToShares(_assets);
    }

    /**
     * @dev See {IERC4262-previewMint}
     */
    function previewMint(uint256 shares) public view returns (uint256) {}

    /**
     * @dev See {IERC4262-previewWithdraw}
     */
    function previewWithdraw(uint256 assets) public view returns (uint256) {
        uint256 shares = convertToShares(assets);
        return shares + (convertToAssets(shares) < assets ? 1 : 0);
    }

    /**
     * @dev See {IERC4262-previewRedeem}
     */
    function previewRedeem(uint256 shares) public view returns (uint256) {
        return convertToAssets(shares);
    }

    /**
     * @dev See {IERC4262-maxDeposit}
     */
    function maxDeposit(address) public view override returns (uint256) {
        // return type(uint256).max;
        return MAX_DEPOSIT;
    }

    /**
     * @dev Set Min and Max Value of the Deposit and Max Total Supply of Value
     */
    function setInitialValue(
        uint256[3] memory _initialValue
    ) external onlyOwner {
        MIN_DEPOSIT = _initialValue[0];
        MAX_DEPOSIT = _initialValue[1];
        MAX_TOTAL_DEPOSIT = _initialValue[2];
    }

    /**
     * @dev See {IERC4262-maxMint}
     */
    function maxMint(address) public pure virtual override returns (uint256) {
        // return type(uint256).max;
    }

    /**
     * @dev See {IERC4262-maxWithdraw}
     */
    function maxWithdraw(address _owner) public view returns (uint256) {
        return convertToAssets(balanceOf(_owner));
    }

    /**
     * @dev See {IERC4262-maxRedeem}
     */
    function maxRedeem(address _owner) public view returns (uint256) {
        return balanceOf(_owner);
    }

    function decimals()
        public
        view
        override(ERC20Upgradeable, IERC20MetadataUpgradeable)
        returns (uint8)
    {
        return _decimals;
    }

    function _checkVaultInMaintenance() private view {
        if (
            (block.timestamp >
                (getNextEpoch().sub(MAINTENANCE_PERIOD_PRE_START))) ||
            (block.timestamp <
                (getCurrentEpoch().add(MAINTENANCE_PERIOD_POST_START)))
        ) {
            revert VaultInMaintenance(_msgSender(), block.timestamp);
        }
    }

    function _checkVaultOutMaintenance() private view {
        if (
            (block.timestamp <
                (getNextEpoch().sub(MAINTENANCE_PERIOD_PRE_START))) ||
            (block.timestamp > (getNextEpoch()))
        ) {
            revert VaultOutMaintenance(_msgSender(), block.timestamp);
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC20Upgradeable) {
        require(
            !paused(),
            "ERC20 Vault: can't create or transfer any shares or Assets while paused"
        );
        super._beforeTokenTransfer(from, to, tokenId);
    }
}
