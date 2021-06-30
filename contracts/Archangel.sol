// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./interfaces/IArchangel.sol";
import "./AngelFactory.sol";
import "./FountainFactory.sol";
import "./libraries/Ownable.sol";
import "./libraries/SafeERC20.sol";

/// @title Staking system manager
contract Archangel is Ownable {
    using SafeERC20 for IERC20;
    AngelFactory public immutable angelFactory;
    FountainFactory public immutable fountainFactory;

    constructor() public {
        angelFactory = new AngelFactory();
        fountainFactory = new FountainFactory();
    }

    function getFountain(IERC20 token) external view returns (Fountain) {
        return fountainFactory.fountainOf(token);
    }

    function rescueERC20(IERC20 token, Fountain from)
        external
        onlyOwner
        returns (uint256)
    {
        if (fountainFactory.isValid(from)) {
            from.rescueERC20(token, _msgSender());
        }
        uint256 amount = token.balanceOf(address(this));
        token.safeTransfer(_msgSender(), amount);
    }
}
