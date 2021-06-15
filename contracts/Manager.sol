// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./interfaces/IManager.sol";
import "./ChefFactory.sol";
import "./FridgeFactory.sol";

/// @title Staking system manager
contract Manager {
    ChefFactory public immutable chefFactory;
    FridgeFactory public immutable fridgeFactory;

    constructor() public {
        chefFactory = new ChefFactory();
        fridgeFactory = new FridgeFactory();
    }

    function getFridge(IERC20 token) external view returns (Fridge) {
        return fridgeFactory.fridgeOf(token);
    }
}
