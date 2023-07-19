// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./Errors.sol";
import "./IRouter.sol";
import "./TickMath.sol";
import "./FullMath.sol";
import "@openzeppelin-contracts-upgradeable/contracts/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin-contracts-upgradeable/contracts/utils/math/MathUpgradeable.sol";
import "@openzeppelin-contracts-upgradeable/contracts/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

/// @custom:oz-upgrades-unsafe-allow external-library-linking
library UniswapLibV3 {
    using SafeMathUpgradeable for uint256;
    using MathUpgradeable for uint256;

    uint256 constant private TWAP_INTERVAL = 60*15; // 15 minutes twap;

    /// @dev Method to get the price of 1 token of tokenAddress if swapped for paymentToken
    /// @param tokenAddress ERC20 token address of a whitelisted ERC20 token
    /// @return price Price in payment Token equivalent with its decimals
    function getPriceInPaymentToken(
        address tokenAddress,
        address routerAddress
    ) public view returns (uint256 price) {
        IRouter router = IRouter(routerAddress);
        if (tokenAddress == address(router.WETH9())) return 1;
        IUniFactory factory = IUniFactory(router.factory());
        IUniPool pool;
        pool = IUniPool(factory.getPool(tokenAddress, address(router.WETH9()), 500));
        
        if(address(pool) == address(0)) {
            pool = IUniPool(factory.getPool(address(router.WETH9()), tokenAddress, 500));
            if(address(pool) == address(0)) revert Errors.NotZeroAddress();
        }
        
        address poolToken0 = pool.token0();
        address poolToken1 = pool.token1();

        bool invertPrice;

        if (
            poolToken0 == tokenAddress && poolToken1 == address(router.WETH9())
        ) {
            invertPrice = false;
        } else if ( 
            poolToken0 == address(router.WETH9()) && poolToken1 == tokenAddress 
        ) {
            invertPrice = true;
        } else revert Errors.WrongUniswapConfig();


        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = uint32(TWAP_INTERVAL);
        secondsAgos[1] = 0;
        
        (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 tick = int24(tickCumulativesDelta / int56(int256(TWAP_INTERVAL)));

        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int256(TWAP_INTERVAL) != 0)) {
            tick--;
        }

        uint256 baseAmount = 10 ** IERC20MetadataUpgradeable(tokenAddress).decimals();

        price = uint256(_getQuoteAtTick(tick, baseAmount, tokenAddress, address(router.WETH9())));
    }

    /// Internal methods

    /// @dev Internal method to calculate quote price at a determined Uniswap tick value
    function _getQuoteAtTick(
        int24 tick,
        uint256 baseAmount,
        address baseToken,
        address quoteToken
    ) public pure returns (uint256 quoteAmount) {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);

        // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
                : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    } 

}