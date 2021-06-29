// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./Angel.sol";
import "./interfaces/IAngelFactory.sol";

/// @title The factory of angel.
contract AngelFactory {
    using BoringERC20 for IERC20;
    using BoringMath for uint256;

    IArchangel public immutable archangel;
    mapping(Angel => IERC20) private _rewards;

    event Created(address to);

    constructor() public {
        archangel = IArchangel(msg.sender);
    }

    function isValid(Angel angel) external view returns (bool) {
        return (address(_rewards[angel]) != address(0));
    }

    function rewardOf(Angel angel) external view returns (IERC20) {
        return _rewards[angel];
    }

    /// @notice Create the angel of given token as reward. Multiple angels for the
    /// same token is possible.
    function create(IERC20 reward) external returns (Angel) {
        Angel newAngel = new Angel(reward);
        // bypass loc 0 at Angel
        newAngel.add(0, IERC20(address(0)), IRewarder(address(0)));
        newAngel.transferOwnership(msg.sender, true, false);
        _rewards[newAngel] = reward;

        emit Created(address(newAngel));

        return newAngel;
    }
}
