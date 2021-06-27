// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./MiniChefV2.sol";
import "./interfaces/IChefFactory.sol";

/// @title The factory of chef.
contract ChefFactory {
    using BoringERC20 for IERC20;
    using BoringMath for uint256;

    IManager public immutable manager;
    mapping(MiniChefV2 => IERC20) private _rewards;

    event Created(address to);

    constructor() public {
        manager = IManager(msg.sender);
    }

    function isValid(MiniChefV2 chef) external view returns (bool) {
        return (address(_rewards[chef]) != address(0));
    }

    function rewardOf(MiniChefV2 chef) external view returns (IERC20) {
        return _rewards[chef];
    }

    /// @notice Create the chef of given token as reward. Multiple chefs for the
    /// same token is possible.
    function create(IERC20 reward) external returns (MiniChefV2) {
        MiniChefV2 newChef = new MiniChefV2(reward);
        // bypass loc 0 at miniChef
        newChef.add(0, IERC20(address(0)), IRewarder(address(0)));
        newChef.transferOwnership(msg.sender, true, false);
        _rewards[newChef] = reward;

        emit Created(address(newChef));

        return newChef;
    }
}
