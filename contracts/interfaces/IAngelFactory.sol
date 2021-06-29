// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IAngelFactory {
    function manager() external view returns (address);
    function create(address rewardToken) external;
}
