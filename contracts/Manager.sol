// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./interfaces/IManager.sol";
import "./AngelFactory.sol";
import "./FridgeFactory.sol";

/// @title Staking system manager
contract Manager {
    AngelFactory public immutable angelFactory;
    FridgeFactory public immutable fridgeFactory;

    constructor() public {
        angelFactory = new AngelFactory();
        fridgeFactory = new FridgeFactory();
    }

    function getFridge(IERC20 token) external view returns (Fridge) {
        return fridgeFactory.fridgeOf(token);
    }
}
