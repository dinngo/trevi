// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./interfaces/IManager.sol";
import "./ChefFactory.sol";
import "./FridgeFactory.sol";

/// @title Staking system manager
contract Manager {
    ChefFactory public immutable _chefFactory;
    FridgeFactory public immutable _fridgeFactory;

    constructor() public {
        _chefFactory = new ChefFactory();
        _fridgeFactory = new FridgeFactory();
    }

    function getFridge(IERC20 token) external view returns (Fridge) {
        return _fridgeFactory.fridgeOf(token);
    }
}
