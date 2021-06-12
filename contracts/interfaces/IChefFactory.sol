// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IChefFactory {
    function manager() external view returns (address);
    function createChef(address rewardToken) external;
}
