// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IManager {
    function chefFactory() external view returns (address);
    function fridgeFactory() external view returns (address);
    function getFridge(address token) external view returns (address);
}
