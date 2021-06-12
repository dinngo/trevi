// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IFridgeFactory {
    function create(address token) external returns (address);
    function fridgeOf(address token) external view returns (address);
}
