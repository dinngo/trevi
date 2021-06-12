// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./sushiswap/MiniChefV2.sol";
import "./interfaces/IChefFactory.sol";

/// @title The factory of chef.
contract ChefFactory {
    using BoringERC20 for IBERC20;
    using BoringMath for uint256;

    IManager public immutable manager;
    mapping(MiniChefV2 => IBERC20) private _chefs;

    constructor() public {
        manager = IManager(msg.sender);
    }

    /// @notice Create the chef of given token as reward. Multiple chefs for the
    /// same token is possible.
    function createChef(IBERC20 reward) external returns (MiniChefV2) {
        MiniChefV2 newChef = new MiniChefV2(reward);
        // bypass loc 0 at miniChef
        newChef.add(0, IBERC20(address(0)), IRewarder(address(0)));
        newChef.transferOwnership(msg.sender, true, false);
        _chefs[newChef] = reward;

        return newChef;
    }
}
